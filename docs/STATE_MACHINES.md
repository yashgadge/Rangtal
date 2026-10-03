# State Machines

## 1. Registration Status

The `registrations` collection transitions through the following states securely:

1. **DRAFT**: Initial state when participant starts the process.
2. **SUBMITTED**: Form completed.
3. **VERIFICATION_PENDING**: If `college.verificationRequired` is true.
4. **VERIFIED**: Approved by Admin (or skipped if verification not required).
5. **PAYMENT_PENDING**: User is redirected to Razorpay.
6. **PAYMENT_SUCCESS**: Webhook confirmed successful capture.
7. **PAYMENT_FAILED**: Webhook reported failure.
8. **PASS_ISSUED**: Final state once pass generation succeeds.
9. **REJECTED**: Admin rejected verification.
10. **CANCELLED**: User or admin cancelled before payment.

### Authorized Transitions
- `DRAFT` -> `SUBMITTED`: Client (Participant)
- `SUBMITTED` -> `VERIFICATION_PENDING` / `PAYMENT_PENDING`: Backend
- `VERIFICATION_PENDING` -> `VERIFIED` / `REJECTED`: Admin only (via Backend function)
- `PAYMENT_PENDING` -> `PAYMENT_SUCCESS` / `PAYMENT_FAILED`: Backend (Razorpay Webhook)
- `PAYMENT_SUCCESS` -> `PASS_ISSUED`: Backend

## 2. Verification Status

Applies to `participants` and `registrations`:
- **PENDING**: Awaiting review.
- **UNDER_REVIEW**: An admin is actively reviewing.
- **VERIFIED**: Approved.
- **REJECTED**: Denied.
- **REQUIRES_CORRECTION**: Sent back to user to fix ID card or details.

## 3. Pass Status

The authoritative status for entry at the gate:
- **ACTIVE**: Ready to be scanned.
- **USED**: Scanned successfully and participant is inside.
- **REVOKED**: Cancelled by Admin (fraud, refund, disciplinary).
- **EXPIRED**: Event is over.
- **SUPERSEDED**: A new pass was issued overriding this one.

### Check-in Logic
`ACTIVE` -> Scanner checks pass. If valid, Backend Transaction writes `checkins` document, and sets pass to `USED`. If already `USED`, returns `ALREADY_USED`.

## 4. Payment Status

- **CREATED**: Razorpay Order ID generated.
- **SUCCESS**: Payment captured.
- **FAILED**: Payment failed or timed out.
- **REFUNDED**: Admin initiated refund.
