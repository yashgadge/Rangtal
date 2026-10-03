# Rangtal Database Schema

This document defines the Firestore collections, fields, and relationships for the Rangtal event system.

## 1. Identity & Access

### `users/{uid}`
Base identity for public users.
- `uid` (string): Firebase Auth UID
- `email` (string)
- `displayName` (string)
- `phone` (string)
- `role` (string): 'PARTICIPANT'
- `status` (string): 'ACTIVE', 'DISABLED', 'SUSPENDED'
- `emailVerified` (boolean)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `admins/{uid}`
- `uid` (string)
- `name` (string)
- `email` (string)
- `role` (string): 'ADMIN', 'SUPER_ADMIN'
- `status` (string): 'ACTIVE', 'DISABLED'
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `createdBy` (string): UID of creator

### `volunteers/{uid}`
- `uid` (string)
- `name` (string)
- `email` (string)
- `phone` (string)
- `status` (string): 'ACTIVE', 'DISABLED'
- `permissions` (array of strings)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `createdBy` (string)

## 2. Event Configuration

### `colleges/{collegeId}`
- `name` (string)
- `code` (string)
- `active` (boolean)
- `displayOrder` (number)
- `verificationRequired` (boolean)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `formConfigs/{configId}`
- `fieldId` (string)
- `label` (string)
- `type` (string): 'TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', etc.
- `required` (boolean)
- `enabled` (boolean)
- `placeholder` (string)
- `options` (array of strings, optional)
- `validation` (map, optional)
- `order` (number)
- `participantType` (string)
- `collegeRestrictions` (array of strings)

### `packages/{packageId}`
- `name` (string)
- `code` (string)
- `description` (string)
- `price` (number)
- `currency` (string)
- `participantCount` (number): 1 for SINGLE, 2 for COUPLE
- `active` (boolean)
- `capacity` (number)
- `soldCount` (number)
- `eligibilityRules` (map)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `eventSettings/{eventId}`
Authoritative global event configuration. (Document ID usually 'primary')
- `eventName` (string)
- `organizer` (string)
- `venue` (string)
- `eventDate` (timestamp)
- `startTime` (timestamp)
- `endTime` (timestamp)
- `registrationOpenAt` (timestamp)
- `registrationCloseAt` (timestamp)
- `registrationEnabled` (boolean)
- `paymentEnabled` (boolean)
- `verificationEnabled` (boolean)
- `passGenerationEnabled` (boolean)
- `scannerEnabled` (boolean)
- `capacity` (number)
- `updatedAt` (timestamp)
- `updatedBy` (string)

## 3. Participants & Registration

### `participants/{participantId}`
- `uid` (string)
- `fullName` (string)
- `email` (string)
- `phone` (string)
- `collegeId` (string)
- `collegeNameSnapshot` (string)
- `registrationNumber` (string)
- `department` (string)
- `year` (string)
- `gender` (string)
- `photoPath` (string)
- `idCardPath` (string)
- `receiptPath` (string)
- `verificationStatus` (string): 'PENDING', 'VERIFIED', 'REJECTED'
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `registrations/{registrationId}`
- `registrationNumber` (string)
- `uid` (string): Creator's UID
- `type` (string): 'SINGLE', 'COUPLE'
- `packageId` (string)
- `status` (string)
- `amount` (number)
- `currency` (string)
- `paymentId` (string)
- `verificationStatus` (string)
- `passStatus` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `registrationParticipants/{relationshipId}`
Linking collection. Document ID format: `registrationId_participantId`
- `registrationId` (string)
- `participantId` (string)
- `role` (string): 'PRIMARY', 'SECONDARY'
- `createdAt` (timestamp)

### `couples/{coupleId}`
- `registrationId` (string)
- `participantAId` (string)
- `participantBId` (string)
- `status` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## 4. Payments

### `payments/{paymentId}`
- `registrationId` (string)
- `provider` (string): 'RAZORPAY'
- `providerOrderId` (string)
- `providerPaymentId` (string)
- `amount` (number)
- `currency` (string)
- `status` (string): 'CREATED', 'SUCCESS', 'FAILED'
- `method` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `paymentEvents/{eventId}`
Immutable webhook/event logs.
- `provider` (string)
- `eventType` (string)
- `providerEventId` (string)
- `paymentId` (string)
- `registrationId` (string)
- `receivedAt` (timestamp)
- `processedAt` (timestamp)
- `processingStatus` (string)

## 5. Passes & Check-in

### `passes/{passId}`
- `registrationId` (string)
- `participantIds` (array of strings)
- `packageId` (string)
- `passNumber` (string)
- `version` (number)
- `status` (string): 'ACTIVE', 'USED', 'REVOKED', 'EXPIRED'
- `credentialVersion` (string)
- `issuedAt` (timestamp)
- `updatedAt` (timestamp)
- `revokedAt` (timestamp)
- `revocationReason` (string)

### `passEvents/{eventId}`
Immutable pass lifecycle log.
- `passId` (string)
- `registrationId` (string)
- `actorId` (string)
- `actorRole` (string)
- `eventType` (string)
- `previousVersion` (number)
- `newVersion` (number)
- `timestamp` (timestamp)
- `reason` (string)

### `checkins/{checkinId}`
- `passId` (string)
- `registrationId` (string)
- `participantId` (string)
- `scannerId` (string)
- `volunteerId` (string)
- `result` (string): 'SUCCESS', 'ALREADY_USED', 'INVALID', 'REVOKED'
- `timestamp` (timestamp)
- `requestId` (string)

## 6. Logs & Security

### `auditLogs/{auditId}`
- `actorId` (string)
- `actorRole` (string)
- `action` (string)
- `targetType` (string)
- `targetId` (string)
- `requestId` (string)
- `timestamp` (timestamp)
- `metadata` (map)

### `securityEvents/{eventId}`
- `eventType` (string): 'PERMISSION_DENIED', 'INVALID_QR', etc.
- `actorId` (string)
- `targetId` (string)
- `metadata` (map)
- `timestamp` (timestamp)

### `scannerSessions/{sessionId}`
- `volunteerId` (string)
- `startedAt` (timestamp)
- `endedAt` (timestamp)
- `status` (string)
- `lastActivityAt` (timestamp)

### `exports/{exportId}`
- `requestedBy` (string)
- `exportType` (string)
- `status` (string)
- `createdAt` (timestamp)
- `completedAt` (timestamp)
- `filePath` (string)
- `filters` (map)
- `expiresAt` (timestamp)
