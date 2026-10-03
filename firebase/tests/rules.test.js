const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { setLogLevel } = require('firebase/firestore');
const fs = require('fs');

let testEnv;

before(async () => {
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-rhythm-rebel-harden',
    firestore: {
      rules: fs.readFileSync('./firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

function getUnauth() { return testEnv.unauthenticatedContext(); }
function getPart(uid) { return testEnv.authenticatedContext(uid, { role: 'PARTICIPANT' }); }
function getVol(uid, perms = []) { return testEnv.authenticatedContext(uid, { volunteer: true, permissions: perms }); }
function getAdmin(uid) { return testEnv.authenticatedContext(uid, { admin: true }); }
function getSuperAdmin(uid) { return testEnv.authenticatedContext(uid, { super_admin: true }); }

describe('Hardened Firestore Security Rules (Phase D.1)', () => {

  describe('1. Immutability & Backend-Only Constraints', () => {
    ['payments', 'paymentEvents', 'passes', 'passEvents', 'auditLogs', 'securityEvents', 'checkins'].forEach(coll => {
      it(`should deny participant create to ${coll}`, async () => {
        const db = getPart('u1').firestore();
        await assertFails(db.collection(coll).doc('123').set({ data: 'test' }));
      });
      it(`should deny admin create to ${coll} (Cloud Function strictly required)`, async () => {
        const db = getAdmin('a1').firestore();
        // checkins, passEvents, etc must be denied even for admins
        await assertFails(db.collection(coll).doc('123').set({ data: 'test' }));
      });
      it(`should deny super_admin update to ${coll}`, async () => {
        const db = getSuperAdmin('sa1').firestore();
        await assertFails(db.collection(coll).doc('123').update({ data: 'changed' }));
      });
    });
  });

  describe('2. Participant Isolation & Ownership', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('users').doc('u1').set({ uid: 'u1', role: 'PARTICIPANT' });
        await db.collection('users').doc('u2').set({ uid: 'u2', role: 'PARTICIPANT' });
        await db.collection('participants').doc('p1').set({ uid: 'u1', verificationStatus: 'PENDING' });
      });
    });

    it('participant reads own data', async () => {
      const db = getPart('u1').firestore();
      await assertSucceeds(db.collection('users').doc('u1').get());
      await assertSucceeds(db.collection('participants').doc('p1').get());
    });

    it('participant cannot read another participant', async () => {
      const db = getPart('u2').firestore();
      await assertFails(db.collection('users').doc('u1').get());
      await assertFails(db.collection('participants').doc('p1').get());
    });

    it('participant cannot modify protected fields (role, createdAt)', async () => {
      const db = getPart('u1').firestore();
      await assertFails(db.collection('users').doc('u1').update({ role: 'ADMIN' }));
      await assertFails(db.collection('participants').doc('p1').update({ verificationStatus: 'VERIFIED' }));
    });

    it('participant cannot transfer ownership (uid update)', async () => {
      const db = getPart('u1').firestore();
      await assertFails(db.collection('users').doc('u1').update({ uid: 'u2' }));
      await assertFails(db.collection('participants').doc('p1').update({ uid: 'u2' }));
    });
  });

  describe('3. Status Escalation Protection (Registrations)', () => {
    it('participant cannot jump to VERIFIED or PASS_ISSUED on creation', async () => {
      const db = getPart('u1').firestore();
      await assertFails(db.collection('registrations').doc('r1').set({ uid: 'u1', status: 'PASS_ISSUED' }));
      await assertFails(db.collection('registrations').doc('r1').set({ uid: 'u1', status: 'VERIFIED' }));
    });

    it('participant can create DRAFT registration with safe fields', async () => {
      const db = getPart('u1').firestore();
      await assertSucceeds(db.collection('registrations').doc('r1').set({
        uid: 'u1',
        status: 'DRAFT',
        verificationStatus: 'PENDING',
        passStatus: 'PENDING'
      }));
    });

    it('participant cannot update registration amount or paymentId', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('registrations').doc('r1').set({ uid: 'u1', status: 'DRAFT', amount: 500, paymentId: 'pay_123' });
      });
      const db = getPart('u1').firestore();
      await assertFails(db.collection('registrations').doc('r1').update({ amount: 100 }));
      await assertFails(db.collection('registrations').doc('r1').update({ paymentId: 'pay_999' }));
      await assertFails(db.collection('registrations').doc('r1').update({ status: 'PAYMENT_SUCCESS' }));
    });
  });

  describe('4. Volunteer Authorization', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('participants').doc('p1').set({ uid: 'u1' });
        await context.firestore().collection('passes').doc('pass1').set({ uid: 'u1' });
      });
    });

    it('volunteer WITHOUT VIEW_PARTICIPANT_BASIC cannot read participant', async () => {
      const db = getVol('v1', ['SCAN_PASS']).firestore();
      await assertFails(db.collection('participants').doc('p1').get());
    });

    it('volunteer WITH VIEW_PARTICIPANT_BASIC can read participant', async () => {
      const db = getVol('v1', ['VIEW_PARTICIPANT_BASIC']).firestore();
      await assertSucceeds(db.collection('participants').doc('p1').get());
    });

    it('volunteer cannot write checkin directly (Backend Only)', async () => {
      const db = getVol('v1', ['SCAN_PASS']).firestore();
      await assertFails(db.collection('checkins').doc('c1').set({ volunteerId: 'v1' }));
    });

    it('volunteer cannot escalate their own permissions', async () => {
      const db = getVol('v1').firestore();
      await assertFails(db.collection('volunteers').doc('v1').update({ permissions: ['SCAN_PASS', 'MANAGE_ADMINS'] }));
    });
  });

  describe('5. Admin & Super Admin', () => {
    it('normal admin cannot create another admin', async () => {
      const db = getAdmin('a1').firestore();
      await assertFails(db.collection('admins').doc('a2').set({ role: 'ADMIN' }));
    });

    it('super admin can create another admin', async () => {
      const db = getSuperAdmin('sa1').firestore();
      await assertSucceeds(db.collection('admins').doc('a2').set({ role: 'ADMIN' }));
    });
    
    it('super admin cannot modify immutable audit log', async () => {
      const db = getSuperAdmin('sa1').firestore();
      await assertFails(db.collection('auditLogs').doc('al1').set({ data: 'test' }));
    });
  });

  describe('6. Query Security', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('registrations').doc('r1').set({ uid: 'u1', status: 'DRAFT' });
        await db.collection('registrations').doc('r2').set({ uid: 'u2', status: 'DRAFT' });
      });
    });

    it('participant querying ALL registrations is denied', async () => {
      const db = getPart('u1').firestore();
      const query = db.collection('registrations');
      await assertFails(query.get());
    });

    it('participant querying their OWN registrations is permitted', async () => {
      const db = getPart('u1').firestore();
      const query = db.collection('registrations').where('uid', '==', 'u1');
      await assertSucceeds(query.get());
    });
    
    it('admin querying ALL registrations is permitted', async () => {
      const db = getAdmin('a1').firestore();
      const query = db.collection('registrations');
      await assertSucceeds(query.get());
    });
  });

});
