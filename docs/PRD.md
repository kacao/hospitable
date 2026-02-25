# Product Requirements Document: Hospitable TypeScript SDK

**Version:** 1.0.0
**Status:** Implemented
**Last Updated:** February 25, 2026
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

- Personal Access Token (via config or `HOSPITABLE_PAT` env var)
- OAuth2 client credentials (machine-to-machine)
- OAuth2 refresh token flow (long-lived sessions)
- Automatic pre-call token refresh when expiry is imminent
- Automatic 401 → token refresh → request retry (silent re-auth)

### 4.2 Resources

| Resource | Operations | Priority | Status |
| :--- | :--- | :--- | :--- |
| **Properties** | list, get, iter, updateCalendar | P0 | ✅ Done |
| **Reservations** | list, get, iter, getUpcoming | P0 | ✅ Done |
| **Calendar** | get, update, block, unblock | P1 | ✅ Done |
| **Messages** | list, send, listTemplates, sendTemplate | P1 | ✅ Done |
| **Reviews** | list, get, respond, iter | P2 | ✅ Done |

### 4.3 Utilities

- **Pagination:** `iter()` async generators on every resource — no cursor tracking required.
- **Bulk collection:** `collectAll()` helper for small datasets.
- **Filter builders:** Immutable fluent builders (`ReservationFilter`, `PropertyFilter`) for complex list queries.
- **PII sanitization:** Recursive masking of sensitive fields (`email`, `phone`, tokens, etc.) in debug output.

---

## 5. Non-Functional Requirements

### 5.1 Performance & Scalability

- Async/Await throughout — no blocking I/O.
- Streaming via async generators keeps memory overhead low for large exports.

### 5.2 Security

- Credentials never written to disk.
- Guest PII automatically masked in all debug log output.
- `Authorization` headers stripped from sanitized logs.

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
| Test count | — | ✅ 178 tests across 14 files |

---

## 8. Constraints & Risks

- **API Evolution:** Hospitable API is living. The `User-Agent` header includes the SDK version for deprecation tracking. Resource models should be updated as the API changes.
- **Rate Limits:** Users with high property counts may hit limits quickly. The `onRateLimit` callback makes throttle state observable without crashing.
- **OAuth Token Expiry:** Long-running processes require refresh token support; the SDK handles this transparently with the `refreshToken` + `clientId` + `clientSecret` config.
