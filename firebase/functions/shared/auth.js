const { HttpsError } = require("firebase-functions/v2/https");

function requireAuthenticatedUser(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  return request.auth.uid;
}

function requireAdmin(request) {
  requireAuthenticatedUser(request);
  const token = request.auth.token;
  const isMaster = token.email === 'yashgadge11155@gmail.com' || token.email === 'yashgadge14@gmail.com';
  console.log("requireAdmin check:", { email: token.email, admin: token.admin, isMaster });
  if (!token.admin && !token.super_admin && !isMaster) {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
  return request.auth.uid;
}

function requireSuperAdmin(request) {
  requireAuthenticatedUser(request);
  const token = request.auth.token;
  const isMaster = token.email === 'yashgadge11155@gmail.com' || token.email === 'yashgadge14@gmail.com';
  console.log("requireSuperAdmin check:", { email: token.email, isMaster });
  if (!token.super_admin && !isMaster) {
    throw new HttpsError("permission-denied", "Super Admin privileges required.");
  }
  return request.auth.uid;
}

function requireVolunteer(request) {
  requireAuthenticatedUser(request);
  if (!request.auth.token.volunteer) {
    throw new HttpsError("permission-denied", "Volunteer privileges required.");
  }
  return request.auth.uid;
}

function requirePermission(request, requiredPermission) {
  requireAuthenticatedUser(request);
  const token = request.auth.token;
  const isMaster = token.email === 'yashgadge11155@gmail.com' || token.email === 'yashgadge14@gmail.com';
  
  if (token.admin || token.super_admin || isMaster) {
    return request.auth.uid; // Admins have all permissions
  }
  
  if (!token.volunteer) {
    throw new HttpsError("permission-denied", "Volunteer or Admin privileges required.");
  }
  
  const perms = token.permissions || [];
  if (!perms.includes(requiredPermission)) {
    throw new HttpsError("permission-denied", `Permission ${requiredPermission} is required.`);
  }
  return request.auth.uid;
}

function requireOwnership(request, targetUid) {
  requireAuthenticatedUser(request);
  if (request.auth.uid !== targetUid) {
    throw new HttpsError("permission-denied", "You do not have ownership of this resource.");
  }
  return request.auth.uid;
}

function requireAnyPermission(request, requiredPermissionsArray) {
  requireAuthenticatedUser(request);
  const token = request.auth.token;
  const isMaster = token.email === 'yashgadge11155@gmail.com' || token.email === 'yashgadge14@gmail.com';
  
  if (token.admin || token.super_admin || isMaster) {
    return request.auth.uid; // Admins have all permissions
  }
  
  if (!token.volunteer) {
    throw new HttpsError("permission-denied", "Volunteer or Admin privileges required.");
  }
  
  const perms = token.permissions || [];
  const hasPerm = requiredPermissionsArray.some(p => perms.includes(p));
  if (!hasPerm) {
    throw new HttpsError("permission-denied", `One of permissions ${requiredPermissionsArray.join(',')} is required.`);
  }
  return request.auth.uid;
}

module.exports = {
  requireAuthenticatedUser,
  requireAdmin,
  requireSuperAdmin,
  requireVolunteer,
  requirePermission,
  requireAnyPermission,
  requireOwnership
};
