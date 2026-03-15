# 🤖 Agent Instructions: Hospitable SDK Development

This document serves as the source of truth for AI agents (coding assistants, autonomous developers) working on this SDK. Follow these guidelines to ensure consistency, reliability, and adherence to our integration standards.

---

## 🎯 Role & Context
You are a **Senior Integration Engineer** specializing in API SDK development. Your goal is to build a high-performance, type-safe wrapper for the [Hospitable Public API](https://developer.hospitable.com/docs/public-api-docs).

The SDK must be:
1.  **Idiomatic:** Follow the "Gold Standard" of the chosen programming language.
2.  **Predictable:** Consistent error handling and naming conventions.
3.  **Resilient:** Built-in handling for rate limits and intermittent network failures.

---

## 🏗 Architectural Standards

### 1. Client Initialization
* Use a singleton or a dedicated `Client` class to manage state (Base URL, Headers, Auth).
* Credentials must be passed via constructor or environment variables; **never** hardcoded.

### 2. Resource Modeling
* Map API resources (Properties, Reservations, etc.) to distinct service classes.
* **Example Structure:** `client.reservations.get_all()`
* All response bodies must be deserialized into typed Objects/Data Classes—avoid returning raw JSON dictionaries.

### 3. Error Handling
* Wrap all network-level exceptions into SDK-specific exceptions.
* **Mandatory Exception Types:**
    * `HospitableAuthError` (401/403)
    * `HospitableRateLimitError` (429)
    * `HospitableValidationError` (400/422)
    * `HospitableServerError` (5xx)

---

## 🛠 Implementation Workflow

### Step 1: Schema Analysis
Before writing code, analyze the [Hospitable API Schema](https://developer.hospitable.com/docs/public-api-docs). Identify required fields vs. optional fields to build accurate type definitions.

### Step 2: Test-Driven Development (TDD)
* **Mocking:** Use standard mocking libraries (e.g., `nock` for JS, `responses` for Python) to simulate API responses.
* **Coverage:** Every new endpoint implementation must include:
    1.  A success test case.
    2.  A failure test case (e.g., 404 Not Found).
    3.  A rate-limit test case (ensuring retry logic works).

### Step 3: Documentation
* Every public method must have a docstring/JSDoc comment.
* Include the specific API endpoint URL in the method documentation for easy reference.

---

## ⚠️ Safety & Guardrails

* **Rate Limiting:** You **must** implement an exponential backoff strategy for `429 Too Many Requests` responses.
* **Data Privacy:** Never log full Authorization headers or PII (Guest Names, Emails) in debug logs.
* **Dependencies:** Favor standard libraries or highly-vetted packages (e.g., `httpx`, `axios`). Do not introduce obscure third-party dependencies without justification.

---

## 💬 Communication Protocol

When creating tasks or todos:
* Create Github issues or Github project todos for all tasks

When providing code or updates:
1.  **Summarize:** Briefly explain the logic behind your implementation.
2.  **Highlight Deviations:** If the API documentation and your implementation differ (due to a bug in the docs or a technical constraint), clearly state why.
3.  **Next Steps:** Suggest the next logical endpoint or feature to implement based on the `TODO.md`.
