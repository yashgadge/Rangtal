const fft = require('firebase-functions-test')({ projectId: 'demo-functions-rhythm-rebel' });
const { expect } = require('chai');
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FUNCTIONS_EMULATOR = 'true';

const myFunctions = require('../index.js');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

describe('Cloud Functions Security & Business Logic (Phase F)', () => {
  
  beforeEach(async () => {
    // Clear firestore emulator
    await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-functions-rhythm-rebel/databases/(default)/documents', { method: 'DELETE' });
  });

  after(() => {
    fft.cleanup();
  });

  describe('1. Registrations (createRegistration)', () => {
    const wrapped = fft.wrap(myFunctions.createRegistration);
    
    it('should deny unauthenticated callers', async () => {
      try {
        await wrapped({ data: {} }); // no auth provided
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code).to.equal('unauthenticated');
      }
    });

    it('should reject missing required fields', async () => {
      try {
        await wrapped({ data: {}, auth: { uid: 'u1' } });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code).to.equal('invalid-argument');
      }
    });

    it('should calculate authoritative price from package, ignoring client price', async () => {
      await db.collection('packages').doc('pkg1').set({ active: true, price: 500, capacity: 100, soldCount: 0 });
      
      const res = await wrapped({
        data: { packageId: 'pkg1', collegeId: 'c1', type: 'SINGLE', participants: [{fullName: 'A', gender: 'M'}], clientPrice: 1 },
        auth: { uid: 'u1' }
      });
      
      expect(res.amount).to.equal(500); // Server authoritative price
      expect(res.registrationId).to.be.a('string');

      const doc = await db.collection('registrations').doc(res.registrationId).get();
      expect(doc.data().status).to.equal('DRAFT');
    });
  });

  describe('2. Payments (createPaymentOrder & verifyPayment)', () => {
    const wrapOrder = fft.wrap(myFunctions.createPaymentOrder);
    const wrapVerify = fft.wrap(myFunctions.verifyPayment);
    
    beforeEach(async () => {
      await db.collection('packages').doc('pkg1').set({ active: true, price: 500, capacity: 2, soldCount: 0 });
      await db.collection('registrations').doc('reg1').set({
        uid: 'u1', packageId: 'pkg1', status: 'VERIFIED'
      });
    });

    it('should prevent cross-user payment initiation', async () => {
      try {
        await wrapOrder({ data: { registrationId: 'reg1' }, auth: { uid: 'hacker' } });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code).to.equal('permission-denied');
      }
    });

    it('should prevent creating order for sold out package', async () => {
      await db.collection('packages').doc('pkg1').update({ soldCount: 2 });
      try {
        await wrapOrder({ data: { registrationId: 'reg1' }, auth: { uid: 'u1' } });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code).to.equal('resource-exhausted');
      }
    });

    it('should verify payment, reserve capacity, and ensure idempotency', async () => {
      // 1. Create order
      const order = await wrapOrder({ data: { registrationId: 'reg1' }, auth: { uid: 'u1' } });
      expect(order.paymentId).to.be.a('string');
      
      // 2. Verify payment
      const verifyRes = await wrapVerify({
        data: { paymentId: order.paymentId, gatewayPaymentId: 'EMULATOR_PAYMENT_123', gatewaySignature: 'sig_123' },
        auth: { uid: 'u1' }
      });
      expect(verifyRes.success).to.be.true;

      // 3. Verify capacity increased
      const pkg = await db.collection('packages').doc('pkg1').get();
      expect(pkg.data().soldCount).to.equal(1);
      
      // 4. Test idempotency (second webhook/call)
      const verifyRes2 = await wrapVerify({
        data: { paymentId: order.paymentId, gatewayPaymentId: 'EMULATOR_PAYMENT_123', gatewaySignature: 'sig_123' },
        auth: { uid: 'u1' }
      });
      expect(verifyRes2.alreadyProcessed).to.be.true;
      
      // Capacity should still be 1 (not double counted)
      const pkg2 = await db.collection('packages').doc('pkg1').get();
      expect(pkg2.data().soldCount).to.equal(1);
    });
  });

  describe('3. Check-ins (checkInParticipant)', () => {
    const wrapCheckin = fft.wrap(myFunctions.checkInParticipant);

    beforeEach(async () => {
      await db.collection('passes').doc('pass1').set({
        secureCode: 'SECRET_CODE', status: 'ACTIVE', participantId: 'p1', registrationId: 'reg1'
      });
      await db.collection('passes').doc('pass2').set({
        secureCode: 'REVOKED_CODE', status: 'REVOKED'
      });
    });

    it('should deny unauthorized user or missing permission', async () => {
      try {
        await wrapCheckin({ data: { secureCode: 'SECRET_CODE' }, auth: { uid: 'v1', token: { volunteer: true, permissions: [] } } });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code).to.equal('permission-denied');
      }
    });

    it('should successfully check in and prevent duplicate scans (race-safe)', async () => {
      const requestPayload = { data: { secureCode: 'SECRET_CODE' }, auth: { uid: 'v1', token: { volunteer: true, permissions: ['SCAN_PASS'] } } };
      
      const res = await wrapCheckin(requestPayload);
      expect(res.success).to.be.true;
      expect(res.status).to.equal('VALID_CHECKED_IN');
      
      // Duplicate scan
      const res2 = await wrapCheckin(requestPayload);
      expect(res2.success).to.be.false;
      expect(res2.status).to.equal('ALREADY_CHECKED_IN');
    });

    it('should deny checkin for revoked passes', async () => {
      const requestPayload = { data: { secureCode: 'REVOKED_CODE' }, auth: { uid: 'v1', token: { volunteer: true, permissions: ['SCAN_PASS'] } } };
      
      const res = await wrapCheckin(requestPayload);
      expect(res.success).to.be.false;
      expect(res.status).to.equal('REVOKED_PASS');
    });
  });

});
