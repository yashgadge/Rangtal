# Backend Cloud Functions Architecture

## Overview
All business logic for state transitions, payments, verification, and pass generation is enforced by Firebase Cloud Functions. The client is strictly an untrusted UI layer.

## 1. Registrations (`api/registrations.js`)
*   **`createRegistration`**:
    *   **Auth**: Authenticated User.
    *   **Inputs**: `packageId`, `collegeId`, `type`, `participants` array, `formFields`.
    *   **Logic**: Validates single/couple constraints, verifies package exists and is active, computes authoritative `amount` from the backend package definition, and creates the registration (`DRAFT`) and participant records transactionally.
*   **`submitRegistration`**:
    *   **Auth**: Authenticated User (Owner).
    *   **Inputs**: `registrationId`.
    *   **Logic**: Transitions state from `DRAFT` or `REQUIRES_CORRECTION` to `SUBMITTED`.

## 2. Payments (`api/payments.js`)

**Razorpay Gateway Integration: DEFERRED**
*Payment Architecture:*
*   backend-authoritative
*   client cannot set PAYMENT_SUCCESS
*   transaction-safe
*   idempotent
*   ready for future Razorpay integration

*   **`createPaymentOrder`**:
    *   **Auth**: Authenticated User (Owner).
    *   **Inputs**: `registrationId`.
    *   **Logic**: Validates registration is `VERIFIED` or `PAYMENT_PENDING`. Validates package capacity constraint (`soldCount < capacity`). Creates local `payments` record and updates registration to `PAYMENT_PENDING`. (Currently returns a deferred fixture order).
*   **`verifyPayment`**:
    *   **Auth**: Authenticated User (Owner).
    *   **Inputs**: `paymentId`, `gatewayPaymentId`, `gatewaySignature`.
    *   **Logic**: Idempotent verification. Cryptographic validation is DEFERRED. Currently only accepts explicit `TEST_PAYMENT` or `EMULATOR_PAYMENT` identifiers strictly for testing. Reserves capacity transactionally (`soldCount++`). Updates registration to `PAYMENT_SUCCESS`.

## 3. Verification (`api/verification.js`)
*   **`submitVerification`**:
    *   **Auth**: Authenticated User (Owner).
    *   **Logic**: Transitions `SUBMITTED` -> `VERIFICATION_PENDING`.
*   **`approveVerification`**:
    *   **Auth**: `ADMIN` or `SUPER_ADMIN`.
    *   **Logic**: Transitions `VERIFICATION_PENDING` -> `VERIFIED`.
*   **`requestVerificationCorrection`**:
    *   **Auth**: `ADMIN` or `SUPER_ADMIN`.
    *   **Logic**: Transitions `VERIFICATION_PENDING` -> `REQUIRES_CORRECTION` with a reason.

## 4. Passes (`api/passes.js`)
*   **`generatePass`**:
    *   **Auth**: `PARTICIPANT` (Owner) or `ADMIN`.
    *   **Logic**: Requires `PAYMENT_SUCCESS`. Generates an opaque `secureCode` for the pass, stores it in `passes`, updates registration to `PASS_ISSUED`.

## 5. Check-Ins (`api/checkins.js`)
*   **`checkInParticipant`**:
    *   **Auth**: `VOLUNTEER` with `SCAN_PASS` permission.
    *   **Inputs**: `secureCode`.
    *   **Logic**: Finds the pass, verifies it is `ACTIVE`, ensures it isn't already checked in, and atomically creates a checkin record to prevent race conditions during simultaneous scans.

## 6. Volunteers (`api/volunteers.js`)
*   **`createVolunteer`** & **`disableVolunteer`**:
    *   **Auth**: `ADMIN` or `SUPER_ADMIN`.
    *   **Logic**: Creates user, assigns `volunteer: true` custom claim, and manages `volunteers` database records.

## Shared Utilities
*   **`shared/auth.js`**: Reusable authorization guards (`requireAdmin`, `requirePermission`, `requireOwnership`).
*   **`shared/audit.js`**: Enforces immutable, backend-controlled audit logging and security event generation. Never trusts client timestamps.
