const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-storage-rhythm-rebel',
    storage: {
      rules: fs.readFileSync('./storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199
    },
  });
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

after(async () => {
  await testEnv.cleanup();
});

function getUnauth() { return testEnv.unauthenticatedContext(); }
function getPart(uid) { return testEnv.authenticatedContext(uid, { role: 'PARTICIPANT' }); }
function getVol(uid, perms = []) { return testEnv.authenticatedContext(uid, { volunteer: true, permissions: perms }); }
function getAdmin(uid) { return testEnv.authenticatedContext(uid, { admin: true }); }
function getSuperAdmin(uid) { return testEnv.authenticatedContext(uid, { super_admin: true }); }

describe('Firebase Storage Security Rules (Phase E)', () => {

  const goodImageMeta = { contentType: 'image/jpeg' };
  const goodPdfMeta = { contentType: 'application/pdf' };
  const badExeMeta = { contentType: 'application/x-msdownload' };
  const badHtmlMeta = { contentType: 'text/html' };
  
  const smallBuffer = Buffer.from('test');
  const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a'); // 6MB buffer
  
  describe('1. Unauthenticated Restrictions', () => {
    it('unauthenticated read denied for private files', async () => {
      const storage = getUnauth().storage();
      await assertFails(storage.ref('participants/user1/verification/id.jpg').getDownloadURL());
    });
    it('unauthenticated upload denied', async () => {
      const storage = getUnauth().storage();
      await assertFails(storage.ref('participants/user1/verification/id.jpg').put(smallBuffer, goodImageMeta));
    });
  });

  describe('2. Participant Ownership & Isolation', () => {
    it('participant uploads own file successfully', async () => {
      const storage = getPart('u1').storage();
      await assertSucceeds(storage.ref('participants/u1/verification/id.jpg').put(smallBuffer, goodImageMeta));
    });
    
    it('participant reads own file', async () => {
      const storage = getPart('u1').storage();
      // Ensure file exists first
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.storage().ref('participants/u1/verification/id.jpg').put(smallBuffer, goodImageMeta);
      });
      await assertSucceeds(storage.ref('participants/u1/verification/id.jpg').getDownloadURL());
    });

    it('participant cannot read another participant', async () => {
      const storage = getPart('u2').storage();
      await assertFails(storage.ref('participants/u1/verification/id.jpg').getDownloadURL());
    });

    it('participant cannot upload to another UID', async () => {
      const storage = getPart('u2').storage();
      await assertFails(storage.ref('participants/u1/verification/id.jpg').put(smallBuffer, goodImageMeta));
    });
    
    it('participant cannot access exports', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('exports/exp1/data.csv').getDownloadURL());
    });
    
    it('participant cannot access event admin files', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('registrations/reg1/documents/doc.pdf').getDownloadURL());
    });
    
    it('participant cannot delete own file (only overwrite allowed)', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('participants/u1/verification/id.jpg').delete());
    });
  });

  describe('3. Volunteer Access Restrictions', () => {
    it('volunteer without permission denied', async () => {
      const storage = getVol('v1', ['SCAN_PASS']).storage();
      await assertFails(storage.ref('participants/u1/verification/id.jpg').getDownloadURL());
    });

    it('volunteer with VIEW_PARTICIPANT_DETAILS allowed', async () => {
      const storage = getVol('v1', ['VIEW_PARTICIPANT_DETAILS']).storage();
      await assertSucceeds(storage.ref('participants/u1/verification/id.jpg').getDownloadURL());
    });
  });

  describe('4. Admin Permissions', () => {
    it('admin permitted access to participant files', async () => {
      const storage = getAdmin('a1').storage();
      await assertSucceeds(storage.ref('participants/u1/verification/id.jpg').getDownloadURL());
    });
    
    it('admin denied access to exports (Super Admin only)', async () => {
      const storage = getAdmin('a1').storage();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.storage().ref('exports/exp1/data.csv').put(smallBuffer, { contentType: 'text/csv' });
      });
      await assertFails(storage.ref('exports/exp1/data.csv').getDownloadURL());
    });
    
    it('super admin permitted access to exports', async () => {
      const storage = getSuperAdmin('sa1').storage();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.storage().ref('exports/exp1/data.csv').put(smallBuffer, { contentType: 'text/csv' });
      });
      await assertSucceeds(storage.ref('exports/exp1/data.csv').getDownloadURL());
    });
  });

  describe('5. File Type & Size Restrictions', () => {
    it('oversized file denied (participant)', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('participants/u1/verification/big.jpg').put(largeBuffer, goodImageMeta));
    });

    it('invalid MIME denied (.exe)', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('participants/u1/verification/malware.exe').put(smallBuffer, badExeMeta));
    });
    
    it('invalid MIME denied (.html)', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('participants/u1/verification/xss.html').put(smallBuffer, badHtmlMeta));
    });
    
    it('valid PDF allowed in verification folder', async () => {
      const storage = getPart('u1').storage();
      await assertSucceeds(storage.ref('participants/u1/verification/doc.pdf').put(smallBuffer, goodPdfMeta));
    });
    
    it('PDF denied in profile folder (images only)', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('participants/u1/profile/doc.pdf').put(smallBuffer, goodPdfMeta));
    });
  });

  describe('6. Public Event Assets', () => {
    it('unauthenticated can read public event assets', async () => {
      const storage = getUnauth().storage();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.storage().ref('event-assets/public/logo.png').put(smallBuffer, goodImageMeta);
      });
      await assertSucceeds(storage.ref('event-assets/public/logo.png').getDownloadURL());
    });
    
    it('participant cannot write public event assets', async () => {
      const storage = getPart('u1').storage();
      await assertFails(storage.ref('event-assets/public/logo.png').put(smallBuffer, goodImageMeta));
    });
    
    it('admin can write public event assets', async () => {
      const storage = getAdmin('a1').storage();
      await assertSucceeds(storage.ref('event-assets/public/logo.png').put(smallBuffer, goodImageMeta));
    });
  });
});
