const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const passes = require("./passes");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireAuthenticatedUser, requireAdmin } = require("../shared/auth");
const { createAuditLog, createSecurityEvent } = require("../shared/audit");

let _db; const db = new Proxy({}, { get: (target, prop) => { if (!_db) _db = getFirestore(); const val = _db[prop]; return typeof val === 'function' ? val.bind(_db) : val; }});

// In a real implementation, Razorpay SDK would be initialized here using environment secrets
// const Razorpay = require('razorpay');
// const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

exports.createPaymentOrder = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId, ping } = request.data;
  
  if (ping) return { status: "awake" };

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

      const actualPrice = (pkg.earlyBirdEnabled && (pkg.earlyBirdSoldCount || 0) < (pkg.earlyBirdCapacity || 0)) ? pkg.earlyBirdPrice : pkg.price;

      // 1. Create order in Gateway
      let orderId;
      if (actualPrice === 0) {
        orderId = `FREE_ORDER_${Date.now()}`;
      } else if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const Razorpay = require('razorpay');
        const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
        const rzpOrder = await rzp.orders.create({
          amount: actualPrice * 100, // amount in paise
          currency: "INR",
          receipt: `receipt_${registrationId}`,
          notes: { registrationId }
        });
        orderId = rzpOrder.id;
      } else {
        // Fallback for emulator if keys are missing
        orderId = `EMULATOR_PAYMENT_ORDER_${Date.now()}`;
      }
      
      // 2. Create local Payment record
      const paymentRef = db.collection("payments").doc();
      const localPayment = {
        id: paymentRef.id,
        gatewayOrderId: orderId,
        registrationId,
        uid,
        amount: actualPrice,
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

      return { orderId, amount: actualPrice, paymentId: paymentRef.id };
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

exports.verifyPayment = onCall({ invoker: "public" }, async (request) => {
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
        return { success: true, alreadyProcessed: true, registrationId: paymentData.registrationId }; // Idempotency
      }

      // Cryptographic verification
      let isValid = false;
      if (paymentData.amount === 0 || gatewayPaymentId === "FREE_PASS") {
        isValid = true;
      } else if (process.env.RAZORPAY_KEY_SECRET) {
        const crypto = require('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(paymentData.gatewayOrderId + "|" + gatewayPaymentId)
          .digest('hex');
        isValid = expectedSignature === gatewaySignature;
      } else {
        // Emulator fallback
        if (gatewayPaymentId.startsWith("EMULATOR_PAYMENT_") || gatewayPaymentId.startsWith("TEST_PAYMENT_")) {
          isValid = true;
        }
      }
      
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
      t.update(pkgRef, { 
        soldCount: FieldValue.increment(pkgData.participantCount || 1),
        earlyBirdSoldCount: FieldValue.increment(1)
      });
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
      // Await pass generation securely in backend to prevent frontend race conditions
      try {
        await passes._generatePassInternal(result.registrationId, "SYSTEM", true);
      } catch (e) {
        console.error("Pass generation failed:", e);
      }
    }

    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Payment verification failed.");
  }
});

// Helper for marking a payment as successful
const _markPaymentSuccessful = async (paymentId, gatewayPaymentId, eventMetadata = {}) => {
  const paymentRef = db.collection("payments").doc(paymentId);
  return await db.runTransaction(async (t) => {
    const paymentSnap = await t.get(paymentRef);
    if (!paymentSnap.exists) return { success: false, reason: "Payment not found." };
    
    const paymentData = paymentSnap.data();
    if (paymentData.status === "SUCCESS") return { success: true, alreadyProcessed: true, registrationId: paymentData.registrationId };

    const regRef = db.collection("registrations").doc(paymentData.registrationId);
    const regSnap = await t.get(regRef);
    const regData = regSnap.data();

    const pkgRef = db.collection("packages").doc(regData.packageId);
    const pkgSnap = await t.get(pkgRef);
    const pkgData = pkgSnap.data();
    
    if (pkgData.soldCount >= pkgData.capacity) {
      t.update(paymentRef, { status: "REQUIRES_REFUND", updatedAt: FieldValue.serverTimestamp() });
      t.update(regRef, { status: "PAYMENT_FAILED", updatedAt: FieldValue.serverTimestamp() });
      return { success: false, reason: "Capacity exhausted during payment." };
    }

    t.update(pkgRef, { 
      soldCount: FieldValue.increment(pkgData.participantCount || 1),
      earlyBirdSoldCount: FieldValue.increment(1)
    });
    t.update(paymentRef, { 
      status: "SUCCESS", 
      gatewayPaymentId,
      updatedAt: FieldValue.serverTimestamp()
    });
    t.update(regRef, { 
      status: "PAYMENT_SUCCESS",
      updatedAt: FieldValue.serverTimestamp()
    });

    const eventRef = db.collection("paymentEvents").doc();
    t.set(eventRef, {
      id: eventRef.id,
      paymentId: paymentId,
      type: "SUCCESS",
      metadata: { gatewayPaymentId, ...eventMetadata },
      timestamp: FieldValue.serverTimestamp()
    });

    return { success: true, registrationId: paymentData.registrationId };
  });
};

// Option 1: Razorpay Webhook
exports.razorpayWebhook = onRequest(async (req, res) => {
  try {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (secret) {
      const signature = req.headers['x-razorpay-signature'];
      const expectedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
      if (expectedSignature !== signature) {
        res.status(400).send("Invalid signature");
        return;
      }
    }
    
    const event = req.body.event;
    if (event === "payment.captured" || event === "order.paid") {
      const gatewayPaymentId = req.body.payload.payment.entity.id;
      const gatewayOrderId = req.body.payload.payment.entity.order_id;
      
      const paymentQuery = await db.collection("payments").where("gatewayOrderId", "==", gatewayOrderId).limit(1).get();
      if (!paymentQuery.empty) {
        const paymentId = paymentQuery.docs[0].id;
        const res = await _markPaymentSuccessful(paymentId, gatewayPaymentId, { webhook: true });
        if (res.success) {
           try {
             await passes._generatePassInternal(res.registrationId, "SYSTEM", true);
           } catch (e) {
             console.error("Webhook Pass generation failed:", e);
           }
        }
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error", err);
    res.status(500).send("Internal Error");
  }
});

// Option 3: Self-Heal Verification
exports.syncPaymentStatus = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuthenticatedUser(request);
  const { registrationId } = request.data;
  
  if (!registrationId) throw new HttpsError("invalid-argument", "Missing registration ID.");
  
  const paymentsQuery = await db.collection("payments")
    .where("registrationId", "==", registrationId)
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
    
  if (paymentsQuery.empty) throw new HttpsError("not-found", "No payment attempts found.");
  
  const paymentSnap = paymentsQuery.docs[0];
  const paymentId = paymentSnap.id;
  const paymentData = paymentSnap.data();
  if (paymentData.uid !== uid) throw new HttpsError("permission-denied", "Not your payment.");
  if (paymentData.status === "SUCCESS") return { success: true, alreadyProcessed: true };
  if (!paymentData.gatewayOrderId) throw new HttpsError("failed-precondition", "No gateway order ID.");
  
  try {
    const Razorpay = require('razorpay');
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
       if (paymentData.gatewayOrderId.startsWith("TEST_")) {
          const result = await _markPaymentSuccessful(paymentId, "TEST_PAYMENT_SYNCED", { sync: true });
          return result;
       }
       throw new Error("Missing keys");
    }
    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    
    const payments = await rzp.orders.fetchPayments(paymentData.gatewayOrderId);
    const successfulPayment = payments.items.find(p => p.status === 'captured');
    
    if (successfulPayment) {
      const result = await _markPaymentSuccessful(paymentId, successfulPayment.id, { sync: true });
      if (result.success) {
        await createAuditLog({ actorId: uid, actorRole: "PARTICIPANT", action: "PAYMENT_SYNCED", targetType: "PAYMENT", targetId: paymentId });
      }
      return result;
    } else {
      return { success: false, reason: "Payment not captured on Razorpay." };
    }
  } catch (error) {
    console.error("Sync error:", error);
    throw new HttpsError("internal", "Could not sync payment with Razorpay.");
  }
});

// Option 4: Admin Manual Approve
exports.adminForceApprovePayment = onCall({ invoker: "public" }, async (request) => {
  const uid = await requireAdmin(request);
  const { paymentId, transactionNote } = request.data;
  
  if (!paymentId) throw new HttpsError("invalid-argument", "Missing payment ID.");
  
  const result = await _markPaymentSuccessful(paymentId, "FORCE_APPROVED_ADMIN", { forceApproved: true, adminId: uid, note: transactionNote });
  if (result.success) {
    await createAuditLog({ actorId: uid, actorRole: "ADMIN", action: "PAYMENT_FORCE_APPROVED", targetType: "PAYMENT", targetId: paymentId, metadata: { note: transactionNote } });
  } else {
    throw new HttpsError("internal", result.reason);
  }
  return result;
});


