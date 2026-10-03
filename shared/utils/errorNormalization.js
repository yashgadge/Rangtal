/**
 * Centralized error normalization utility.
 * Maps raw technical errors (Firebase, network, JS) to human-readable strings.
 */
export function normalizeError(error) {
  if (!error) return "Something went wrong. Please try again.";

  // Extract raw message or code
  const message = error.message || error.code || String(error);
  const code = error.code || '';

  // Network & Offline
  if (message.includes('offline') || code === 'unavailable' || message.includes('Failed to fetch') || message.includes('Network Error')) {
    return "You're offline. Please reconnect and try again.";
  }

  // Authentication & Permissions
  if (code === 'permission-denied' || message.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
    return "You don't have permission to perform this action.";
  }
  if (code === 'unauthenticated' || message.includes('unauthenticated')) {
    return "Your session has expired. Please sign in again.";
  }

  // Common Event & Validation Errors (Match from Cloud Functions)
  if (message.includes('INVALID_PASS')) return "This pass is invalid or could not be verified.";
  if (message.includes('REVOKED_PASS') || message.includes('REVOKED')) return "This pass has been revoked and cannot be used.";
  if (message.includes('EXPIRED_PASS') || message.includes('EXPIRED')) return "This pass has expired.";
  if (message.includes('SUPERSEDED_PASS')) return "This pass has been superseded by a newer one.";
  if (message.includes('ALREADY_CHECKED_IN')) return "This participant has already been checked in.";
  if (message.includes('INVALID_GROUP_MEMBER')) return "This participant does not belong to this group.";
  if (message.includes('VERIFICATION_REQUIRED')) return "This participant must be verified before entry.";
  
  if (message.includes('Payment must be successful')) return "Payment is required before generating a pass.";
  if (message.includes('already checked in')) return "This participant was already checked in.";

  // Internal Server Error
  if (code === 'internal' || message.includes('internal')) {
    return "The server could not complete this request. Please try again.";
  }

  // Fallback for known specific strings that might bypass the above
  if (message.includes('Registration not found')) return "Registration could not be found.";
  if (message.includes('Participant not found')) return "Participant could not be found.";
  if (message.includes('Unauthorized')) return "You don't have permission to perform this action.";
  if (message.includes('Missing')) return "Required information is missing. Please check your input.";

  // Default
  return "Something went wrong. Please try again.";
}
