const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const db = getFirestore();

/**
 * Creates an immutable audit log entry in the backend.
 */
async function createAuditLog({ actorId, actorRole, action, targetType, targetId, result = 'SUCCESS', metadata = {} }) {
  await db.collection("auditLogs").add({
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    result,
    metadata,
    timestamp: FieldValue.serverTimestamp()
  });
}

/**
 * Creates an immutable security event entry for suspicious activities.
 */
async function createSecurityEvent({ actorId, actorRole = 'UNKNOWN', action, targetType, targetId, severity = 'WARNING', metadata = {} }) {
  await db.collection("securityEvents").add({
    actorId,
    actorRole,
    action,
    severity,
    targetType,
    targetId,
    metadata,
    timestamp: FieldValue.serverTimestamp()
  });
}

module.exports = {
  createAuditLog,
  createSecurityEvent
};
