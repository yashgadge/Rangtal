# Feature Synchronization Matrix

This document tracks how features map across the Participant UI, Admin UI, Volunteer UI, backend Cloud Functions, and Firestore data structures.

## Package Management
- **Source of Truth**: Firestore `packages` collection
- **Admin UI**: Configured via the `Packages` dashboard. Admin can create, edit, disable, or adjust capacity/price.
- **Participant UI**: Dynamically reads active packages from Firestore during Registration step 1.
- **Volunteer UI**: N/A
- **Cloud Functions**: `createRegistration` reads the active price from the database rather than trusting the client-provided cost.
- **Security / Permissions**: `allow write: if isAdmin();`, `allow read: if true;`

## College Configuration
- **Source of Truth**: Firestore `colleges` collection
- **Admin UI**: Configured via the `Colleges` dashboard. Admin can add, edit, or disable colleges.
- **Participant UI**: Dynamically populates the College dropdown during Registration step 2.
- **Volunteer UI**: N/A
- **Security / Permissions**: `allow write: if isAdmin();`, `allow read: if true;`

## Participant Registration & Verification
- **Source of Truth**: Firestore `registrations`, `participants`, `registrationParticipants` collections
- **Admin UI**: Admin queues Registrations (`Registrations` page) and Participants (`Participants` page). Admin triggers `approveVerification` or `requestVerificationCorrection` which updates status.
- **Participant UI**: Reads current registration status (`SUBMITTED`, `VERIFICATION_PENDING`, `VERIFIED`, `REQUIRES_CORRECTION`) via `Account` page.
- **Volunteer UI**: N/A (unless manual check is required)
- **Cloud Functions**: `createRegistration`, `submitRegistration`, `approveVerification`, `requestVerificationCorrection`
- **Security / Permissions**: Validated server-side via `isOwner` and `isAdmin()` rules. Client cannot skip directly to `VERIFIED`.

## Passes & Generation
- **Source of Truth**: Firestore `passes` collection
- **Admin UI**: Admin can view all generated passes in the `Passes` dashboard and revoke them if necessary.
- **Participant UI**: After verification and successful payment, user can view the Digital Pass and QR code via the `PassViewer`.
- **Volunteer UI**: Reads Pass records during scanning/verification.
- **Cloud Functions**: `generatePass` (Triggered after successful payment simulation/integration).
- **Security / Permissions**: Read by `isAdmin()`, `isVolunteer()` with `SCAN_PASS` permission, or `isOwner()`.

## Check-ins
- **Source of Truth**: Firestore `checkins` collection and transactional updates to `passes`.
- **Admin UI**: Live-streams total check-ins in `Dashboard` and displays history in `Checkins` page.
- **Participant UI**: Once scanned, participant status transitions to "Checked-In" implicitly or explicitly via Pass UI.
- **Volunteer UI**: Performs transactional check-ins via `html5-qrcode` scanner linked to Cloud Functions.
- **Cloud Functions**: `verifyPass`, `checkInParticipant` (transaction-based to prevent duplicate entries).
- **Security / Permissions**: Checkins collection is strictly read-only for Admin and Volunteers. All writes must go through Cloud Functions.

## Volunteer Provisioning
- **Source of Truth**: Firestore `volunteers` collection and Firebase Auth Custom Claims.
- **Admin UI**: *Deferred for now due to Google Cloud constraints. Super Admin temporarily acts as a Volunteer.*
- **Participant UI**: N/A
- **Volunteer UI**: Depends strictly on Auth custom claim `volunteer: true` and permissions array in Firestore.
- **Cloud Functions**: `createVolunteer`, `disableVolunteer`.
- **Security / Permissions**: Custom claims are authoritative; checked in rules (`isVolunteer()`) and middleware.

## Payment Processing (Razorpay - DEFERRED)
- **Source of Truth**: Firestore `payments` collection
- **Admin UI**: Payment Logs UI (*Placeholder*)
- **Participant UI**: Awaiting integration
- **Cloud Functions**: Webhook listeners to handle `verifyPayment` and transition Registration to `PAYMENT_SUCCESS`.
