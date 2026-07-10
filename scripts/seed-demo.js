'use strict';

// Inject fake participants into an existing session for testing group balancing
// and multi-device sync. Usage:  node scripts/seed-demo.js <SESSION_CODE> [count]

const { db } = require('../src/db');
const { uid } = require('../src/lib/ids');

const code = (process.argv[2] || '').toUpperCase();
const count = Number(process.argv[3] || 20);

if (!code) {
  console.error('Usage: node scripts/seed-demo.js <SESSION_CODE> [count]');
  process.exit(1);
}
const session = db.prepare('SELECT * FROM sessions WHERE code = ?').get(code);
if (!session) { console.error(`Session ${code} not found. Create it first from the landing page.`); process.exit(1); }

// Deliberately lumpy company distribution so same-company separation gets tested.
const companies = ['Buildwell', 'Buildwell', 'Buildwell', 'Apex Concrete', 'Apex Concrete',
  'RoboFrame', 'Northstar VC', 'Meridian Design', 'Owner Group', 'Solo LLC', 'TechStack Inc'];
const roles = ['General contractor', 'Specialty contractor', 'Startup founder', 'Robotics or product team',
  'Venture capital or investor', 'Architect or engineer', 'Owner or developer', 'Technology provider', 'Other'];
const first = ['Alex','Sam','Jordan','Taylor','Morgan','Casey','Riley','Jamie','Drew','Quinn','Avery','Parker','Reese','Rowan','Skyler','Devin','Hayden','Emerson','Finley','Kai','Logan','Micah','Noel','Sage'];
const pref = ['yes','yes','maybe','no','no'];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

const now = Date.now();
const ins = db.prepare(
  `INSERT INTO participants (id, session_code, name, company, role, present_pref, email, report_consent, created_at, last_seen_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const tx = db.transaction(() => {
  for (let i = 0; i < count; i++) {
    ins.run(uid('p'), code, `${rnd(first)} ${String.fromCharCode(65 + (i % 26))}.`,
      rnd(companies), rnd(roles), rnd(pref),
      Math.random() < 0.5 ? `demo${i}@example.com` : null,
      Math.random() < 0.5 ? 1 : 0, now + i, now + i);
  }
});
tx();
console.log(`Seeded ${count} participants into session ${code}.`);
process.exit(0);
