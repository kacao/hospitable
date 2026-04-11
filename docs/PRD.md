# Product Requirements Document: Hospitable TypeScript SDK

**Version:** 1.0.0
**Status:** Implemented
**Last Updated:** 2026-04-11
**Owner:** Engineering & Product Teams

---

## 1. Executive Summary

Hospitable provides a world-class platform for Short-Term Rental (STR) management. While their Public API is robust, manual integration requires developers to repeatedly solve the same challenges: OAuth2 handshakes, rate-limit backoffs, and JSON-to-model mapping.

**The Mission:** Build a high-abstraction TypeScript SDK that serves as the definitive bridge between developer applications and the Hospitable ecosystem, reducing integration friction by 80%.

---

## 2. Target Audience

- **Property Management Software (PMS):** Platforms looking to sync reservation data.
- **Third-Party App Developers:** Tools for cleaning, dynamic pricing, or guest screening.
- **Autonomous AI Agents:** Automated systems managing guest communication or listing updates.

---

## 3. Goals & Objectives

- **Simplify Auth:** Abstract OAuth2 / API Key complexity into a single `HospitableClient` initialization.
- **Type Safety:** 100% typed request/response models to eliminate runtime surprises.
- **Operational Resilience:** Native handling of rate limits (429) and transient failures (5xx), plus automatic 401 token refresh.
- **Developer Joy:** Idiomatic TypeScript API with async generators, fluent filter builders, and zero boilerplate.

---

## 4. Functional Requirements

### 4.1 Authentication

- Personal Access Token (via config or `HOSPITABLE_API_PAT` env var)
- OAuth2 client credentials (machine-to-machine)
- OAuth2 refresh token flow (long-lived sessions)
- Automatic pre-call token refresh when expiry is imminent
- Automatic 401 → token refresh → request retry (silent re-auth)

### 4.2 Resources

| Resource | Operations | Priority | Status |
| :--- | :--- | :--- | :--- |
| **Properties** | list, get, listTags, getImages, search, iter | P0 | ✅ Done |
| **Reservations** | list, get, getUpcoming, getInHouse, iter | P0 | ✅ Done |
| **Calendar** | get, update, block, unblock | P1 | ✅ Done |
| **Messages** | list, send, sendForInquiry, listTemplates, sendTemplate | P1 | ✅ Done |
| **Reviews** | list, respond, iter | P2 | ✅ Done |
| **Inquiries** | list, get, iter | P2 | ✅ Done |
| **User / Billing** | get | P2 | ✅ Done |
| **Transactions** | list, iter *(financials:read scope)* | P2 | ✅ Done |
| **Payouts** | list, iter *(financials:read scope)* | P2 | ✅ Done |

### 4.3 Utilities

- **Pagination:** `iter()` async generators on every resource — no cursor tracking required.
- **Bulk collection:** `collectAll()` helper for small datasets.
- **Filter builders:** Immutable fluent builders (`ReservationFilter`, `PropertyFilter`, `InquiryFilter`) for complex list queries. `ReservationFilter.toParams()` and `InquiryFilter.toParams()` throw `ConfigurationError` if `.properties()` was not called.
- **Convenience helpers with semantic names:** `reservations.getUpcoming()` (accepted reservations arriving ≥ today) and `reservations.getInHouse()` (guests currently checked in — arrived and not yet departed).
- **Runtime validation with informative errors:** Missing required params throw `ConfigurationError` locally before any HTTP request, with error messages that name the field and show an example call.
- **Status normalization:** `normalizeReservation()` rewrites legacy American `canceled` → British `cancelled` in `statusHistory[].status`, so agents doing strict-equality comparisons get correct results.
- **PII + business-identity sanitization:** Recursive masking of guest PII (`email`, `phone`, names), credentials (`token`, `secret`), and business identity (`taxId`, `vat`, `bankAccount`, `streetLine*`, `postalCode`) in both debug output and thrown `ValidationError.fields`.
- **URL path encoding:** Every `${id}` interpolation goes through `encodeURIComponent()`, preventing path traversal via attacker-controlled IDs.

---

## 5. Non-Functional Requirements

### 5.1 Performance & Scalability

- Async/Await throughout — no blocking I/O.
- Streaming via async generators keeps memory overhead low for large exports.

### 5.2 Security

- Credentials never written to disk; PAT lives only in process memory or env.
- Guest PII + business identity automatically masked in debug log output **and** in `ValidationError.fields` on thrown errors (Sentry/winston-safe by default).
- `Authorization` headers stripped from sanitized logs.
- Path traversal prevention: every URL path parameter is encoded with `encodeURIComponent()` at the interpolation site, so attacker-controlled IDs cannot rewrite the request path.
- Sensitive fields redacted: guest PII (`email`, `phone`, `firstName`, `lastName`, …), credentials (`token`, `secret`, `apiKey`, `authorization`), and business identity (`taxId`, `vat`, `bankAccount`, `streetLine1/2`, `postalCode`).

### 5.3 Reliability

- Jittered exponential backoff for 429 and 5xx (configurable: attempts, baseDelay, maxDelay).
- `retryAfter` header honored on 429 responses.
- Single silent retry on 401 after token refresh.
- `ServerError` wraps exhausted retries with attempt count.

### 5.4 Developer Experience

- Dual ESM + CJS output (compatible with both `import` and `require`).
- Full TypeScript declarations shipped in `dist/`.
- `User-Agent: hospitable-ts/{VERSION}` on every request for API-side tracking.

---

## 6. User Stories

1. **As a Developer,** I want to initialize a client with `new HospitableClient({ token })` so that I don't have to manually construct HTTP headers for every request.
2. **As a System Architect,** I want the SDK to automatically handle rate limits so that my application doesn't crash during high-volume syncs.
3. **As an AI Agent,** I want clear method names like `getUpcoming()` so that I can easily find the data I need to generate guest reports.
4. **As a Developer,** I want `iter()` on every resource so I can stream large datasets without tracking cursors manually.

---

## 7. Success Metrics

| Metric | Target | Achieved |
| :--- | :--- | :--- |
| Time-to-first-request | < 5 min | ✅ ~2 min (3 lines of code) |
| Error wrapping | 100% — no raw HTTP errors | ✅ Full typed error hierarchy |
| Test coverage (statements) | > 95% | ✅ 100% |
| Test coverage (branches) | > 95% | ✅ 97.77% |
| Test coverage (functions) | > 95% | ✅ 100% |
| Test count | — | ✅ 420 tests across 22 files |
| Resource coverage | All read-heavy Public API endpoints | ✅ 9 resources (properties, reservations, inquiries, calendar, messages, reviews, user, transactions, payouts) |
| Schema drift between declared types and live API | 0 | ✅ Empirically verified via probe scripts; regression guards in place |

---

## 8. Constraints & Risks

- **API Evolution:** Hospitable API is living. The `User-Agent` header includes the SDK version for deprecation tracking. Resource models should be updated as the API changes.
- **Rate Limits:** Users with high property counts may hit limits quickly. The `onRateLimit` callback makes throttle state observable without crashing.
- **OAuth Token Expiry:** Long-running processes require refresh token support; the SDK handles this transparently with the `refreshToken` + `clientId` + `clientSecret` config.
