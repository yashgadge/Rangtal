const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser } = require("../shared/auth");
const { createAuditLog, createSecurityEvent } = require("../shared/audit");

const db = getFirestore();

// In a real implementation, Razorpay SDK would be initialized here using environment secrets
// const Razorpay = require('razorpay');
// const rzp = new Razorpay({ key_id: process.env.RZP_KEY, key_secret: process.env.RZP_SECRET });

exports.createPaymentOrder = onCall(async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId } = request.data;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "Missing registrationId");

  const regRef = db.collection("registrations").doc(registrationId);
  
  try {
    const orderData = await db.runTransaction(async (t) => {
      const regSnap = await t.get(regRef);
      if (!regSnap.exists) throw new HttpsError("not-found", "Registration not found");
      
      const regData = regSnap.data();
      if (regData.uid !== uid) {
        throw new HttpsError("permission-denied", "You do not own this registration");
      }

      // Valid state to pay: VERIFIED, or PAYMENT_PENDING, or SUBMITTED if no verification is required
      // According to STATE_MACHINES: DRAFT -> SUBMITTED -> VERIFICATION_PENDING -> VERIFIED -> PAYMENT_PENDING
      if (regData.status !== "PAYMENT_PENDING" && regData.status !== "VERIFIED") {
        throw new HttpsError("failed-precondition", `Cannot initiate payment from status: ${regData.status}`);
      }

      const packageRef = db.collection("packages").doc(regData.packageId);
      const pkgSnap = await t.get(packageRef);
      if (!pkgSnap.exists) throw new HttpsError("not-found", "Package not found");
      
      const pkg = pkgSnap.data();
      if (!pkg.active) throw new HttpsError("failed-precondition", "Package is no longer active");
      if (pkg.soldCount >= pkg.capacity) {
        throw new HttpsError("resource-exhausted", "Package is sold out");
      }

      // 1. Create order in Gateway (Razorpay integration DEFERRED)
      if (process.env.FUNCTIONS_EMULATOR !== "true") {
        throw new HttpsError("unimplemented", "Razorpay integration is DEFERRED for production.");
      }
      const orderId = `EMULATOR_PAYMENT_ORDER_${Date.now()}`;
      
      // 2. Create local Payment record
      const paymentRef = db.collection("payments").doc();
      const localPayment = {
        id: paymentRef.id,
        gatewayOrderId: orderId,
        registrationId,
        uid,
        amount: pkg.price,
        status: "CREATED",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      t.set(paymentRef, localPayment);

      // 3. Update registration status
      t.update(regRef, {
        status: "PAYMENT_PENDING",
        paymentId: paymentRef.id,
        updatedAt: FieldValue.serverTimestamp()
      });

      return { orderId, amount: pkg.price, paymentId: paymentRef.id };
    });

    await createAuditLog({
      actorId: uid,
      actorRole: "PARTICIPANT",
      action: "PAYMENT_ORDER_CREATED",
      targetType: "PAYMENT",
      targetId: orderData.paymentId,
      metadata: { orderId: orderData.orderId }
    });

    return orderData;
  } catch (error) {
    console.error("Error creating payment order", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to create payment order");
  }
});

exports.verifyPayment = onCall(async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { paymentId, gatewayPaymentId, gatewaySignature } = request.data;
  
  if (!paymentId || !gatewayPaymentId || !gatewaySignature) {
    throw new HttpsError("invalid-argument", "Missing payment verification parameters.");
  }

  const paymentRef = db.collection("payments").doc(paymentId);
  
  try {
    const result = await db.runTransaction(async (t) => {
      const paymentSnap = await t.get(paymentRef);
      if (!paymentSnap.exists) throw new HttpsError("not-found", "Payment not found.");
      
      const paymentData = paymentSnap.data();
      if (paymentData.uid !== uid) {
        await createSecurityEvent({
          actorId: uid, action: "CROSS_USER_PAYMENT_VERIFICATION", targetType: "PAYMENT", targetId: paymentId
        });
        throw new HttpsError("permission-denied", "Not your payment.");
      }
      
      if (paymentData.status === "SUCCESS") {
        return { alreadyProcessed: true }; // Idempotency
      }

      // Cryptographic verification would happen here.
      // Razorpay integration is DEFERRED.
      if (process.env.FUNCTIONS_EMULATOR !== "true") {
        throw new HttpsError("unimplemented", "Razorpay verification is DEFERRED for production.");
      }
      
      if (!gatewayPaymentId.startsWith("EMULATOR_PAYMENT_") && !gatewayPaymentId.startsWith("TEST_PAYMENT_")) {
        throw new HttpsError("invalid-argument", "Only explicit test fixtures are allowed. Real payments DEFERRED.");
      }
      const isValid = true; // Test fixture validated
      
      if (!isValid) {
        throw new HttpsError("invalid-argument", "Payment signature invalid.");
      }

      // Find registration
      const regRef = db.collection("registrations").doc(paymentData.registrationId);
      const regSnap = await t.get(regRef);
      const regData = regSnap.data();

      // Reserve capacity
      const pkgRef = db.collection("packages").doc(regData.packageId);
      const pkgSnap = await t.get(pkgRef);
      const pkgData = pkgSnap.data();
      
      if (pkgData.soldCount >= pkgData.capacity) {
        // Edge case: sold out during payment process. Need to refund manually or via webhook.
        t.update(paymentRef, { status: "REQUIRES_REFUND", updatedAt: FieldValue.serverTimestamp() });
        t.update(regRef, { status: "PAYMENT_FAILED", updatedAt: FieldValue.serverTimestamp() });
        return { success: false, reason: "Capacity exhausted during payment." };
      }

      // Success Path
      t.update(pkgRef, { soldCount: FieldValue.increment(1) });
      t.update(paymentRef, { 
        status: "SUCCESS", 
        gatewayPaymentId,
        updatedAt: FieldValue.serverTimestamp()
      });
      t.update(regRef, { 
        status: "PAYMENT_SUCCESS",
        updatedAt: FieldValue.serverTimestamp()
      });

      // Log Event
      const eventRef = db.collection("paymentEvents").doc();
      t.set(eventRef, {
        id: eventRef.id,
        paymentId: paymentId,
        type: "SUCCESS",
        metadata: { gatewayPaymentId },
        timestamp: FieldValue.serverTimestamp()
      });

      return { success: true, registrationId: paymentData.registrationId };
    });

    if (result.success) {
      await createAuditLog({
        actorId: uid, actorRole: "PARTICIPANT", action: "PAYMENT_VERIFIED", targetType: "PAYMENT", targetId: paymentId
      });
    }

    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Payment verification failed.");
  }
});
