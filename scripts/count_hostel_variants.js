#!/usr/bin/env node
const admin = require('./firebase/functions/node_modules/firebase-admin');

admin.initializeApp({
  projectId: 'rhythm-rebel'
});

const db = admin.firestore();

async function main() {
  console.log('Fetching all participants with ANY hostel-related isJspmHostel value...\n');

  const snap = await db.collection('participants').get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const counts = {};
  for (const p of all) {
    const val = p.isJspmHostel;
    const key = val === undefined ? '(not set)' : JSON.stringify(val);
    counts[key] = (counts[key] || 0) + 1;
  }

  console.log('=== isJspmHostel value distribution across ALL participants ===');
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  for (const [val, count] of sorted) {
    console.log(`  ${val.padEnd(20)} → ${count} participants`);
  }

  const hostelPositive = all.filter(p =>
    p.isJspmHostel === 'Yes' || p.isJspmHostel === 'true' || p.isJspmHostel === true
  );

  console.log(`\n=== Hostel-positive total (all variants) ===`);
  console.log(`  'Yes' count:     ${all.filter(p => p.isJspmHostel === 'Yes').length}`);
  console.log(`  'true' count:    ${all.filter(p => p.isJspmHostel === 'true').length}`);
  console.log(`  true (bool):     ${all.filter(p => p.isJspmHostel === true).length}`);
  console.log(`  TOTAL HOSTEL:    ${hostelPositive.length}`);
  console.log(`\nConclusion: Before fix only 'Yes' was queried. Missing count = ${hostelPositive.length - all.filter(p => p.isJspmHostel === 'Yes').length}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
