# Security & Authorization Model

## Philosophy
- **Authentication != Authorization**: Being logged in only proves identity. Authorization rules strictly verify roles, states, and data ownership.
- **Backend Supremacy**: Sensitive writes (payments, passes, capacity, roles) must be driven by Cloud Functions, never by direct client writes.
- **Least Privilege**: Defaults to `DENY`. Allow rules must explicitly match the operation.
- **Immutability**: Logs (audit, payment webhook events, pass events, security events) are append-only by the backend. Clients cannot overwrite them.

## Roles & Identity Models

### 1. `SUPER_ADMIN`
- **Identity**: Firebase Auth Custom Claim `super_admin: true` AND active `admins/{uid}` document (or hardcoded master email `yashgadge11155@gmail.com`).
- **Permissions**: Full read/write access to all collections except immutable backend-generated logs (which are read-only). Can manage other Admins and Volunteers.

### 2. `ADMIN`
- **Identity**: Firebase Auth Custom Claim `admin: true` AND active `admins/{uid}` document.
- **Permissions**: Full operational access. Cannot manage `SUPER_ADMIN`s or alter core system rules.

### 3. `VOLUNTEER`
- **Identity**: Firebase Auth Custom Claim `volunteer: true` AND active `volunteers/{uid}` document.
- **Permissions**: Explicitly granted via `permissions` array in their document. 
  - `SCAN_PASS`: Can read `passes`, write `checkins`.
  - `VIEW_PARTICIPANT_BASIC`: Can read safe fields of `participants`.

### 4. `PARTICIPANT` (Public User)
- **Identity**: Standard Firebase Auth user (no specific custom claims required).
- **Permissions**: 
  - Can read/write their own `users/{uid}` document (restricted fields).
  - Can read/create `participants` where `uid` == `request.auth.uid`.
  - Can read `registrations` where `uid` == `request.auth.uid`.
  - Can read global active `packages`, `colleges`, `formConfigs`, `eventSettings`.
  - Cannot change `status`, `verificationStatus`, or issue passes.

## Client Write Restrictions
The following operations are **banned** from direct client execution and must be handled by Cloud Functions:
- Modifying `capacity` or `soldCount` on `packages`.
- Modifying `verificationStatus` directly by participants.
- Creating or modifying `payments`, `paymentEvents`.
- Creating `passes` or `passEvents`.
- Generating `auditLogs` or `securityEvents`.

## Privilege Escalation Defense
Security rules explicitly prevent a `PARTICIPANT` from writing to `role`, `status`, or injecting arbitrary custom claims into their documents.

## Storage Threats & Mitigation

### Arbitrary File Upload & Malicious File Types
**Threat**: User uploads an executable (`.exe`, `.sh`) or HTML/JS (`.html`) file to execute XSS or distribute malware.
**Mitigation**: `storage.rules` strictly checks `request.resource.contentType.matches()`. Only `image/jpeg`, `image/png`, and `application/pdf` are allowed in participant directories.

### Oversized Uploads
**Threat**: User uploads a 10GB ISO to consume bandwidth and storage quotas, causing denial of wallet/service.
**Mitigation**: `request.resource.size` is strictly enforced. Participant uploads are capped at 5MB per file.

### Cross-User Access
**Threat**: Participant A modifies their HTTP request to upload an ID card into Participant B's directory (`/participants/{Participant_B_UID}/verification/`).
**Mitigation**: The Storage path `match /participants/{uid}/...` strictly enforces `request.auth.uid == uid`. Path manipulation is cryptographically denied.

### Storage Enumeration & Predictable Paths
**Threat**: Attacker guesses filenames in a flat bucket structure to scrape ID cards.
**Mitigation**: Files are segregated into UID-prefixed namespaces. `allow read` strictly requires matching authentication. Even if an attacker guesses the path, Firebase denies the read.

### Deleted Referenced Files (Orphaned DB Docs)
**Threat**: User deletes their ID card after submitting their application, causing the backend reviewer to encounter 404 Not Found errors, breaking the Admin UI.
**Mitigation**: `allow delete` is restricted to Admins. Participants can only `update` (overwrite) a file. This guarantees that if a file reference exists in Firestore, a file exists in Storage.

### Compromised Volunteer Account
**Threat**: A volunteer scans a pass, sees the participant's data, and attempts to mass-download all participant ID cards.
**Mitigation**: The `SCAN_PASS` permission does not grant Storage read access. Volunteers explicitly require `VIEW_PARTICIPANT_DETAILS` to read verification documents, enforcing Least Privilege.
