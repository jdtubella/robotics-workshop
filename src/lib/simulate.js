'use strict';

// Synthetic test data. A pool of 50 "people", each carrying canned answers for
// every section, so simulated submissions look realistic. Testing aid only.

const FIRST = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Drew', 'Quinn',
  'Avery', 'Parker', 'Reese', 'Rowan', 'Skyler', 'Devin', 'Hayden', 'Emerson', 'Finley', 'Kai',
  'Logan', 'Micah', 'Noel', 'Sage', 'Blake',
];

// Deliberately lumpy so same-company separation gets exercised.
const COMPANIES = [
  'Buildwell', 'Buildwell', 'Buildwell', 'Apex Concrete', 'Apex Concrete', 'RoboFrame',
  'Northstar VC', 'Meridian Design', 'Owner Group', 'Solo LLC', 'TechStack Inc', 'DigSafe Co',
];

const ROLES = [
  'General contractor', 'Specialty contractor', 'Startup founder', 'Robotics or product team',
  'Venture capital or investor', 'Architect or engineer', 'Owner or developer', 'Technology provider', 'Other',
];

const BANK = {
  define_robot: {
    primary_user: [
      'Site utility coordinator', 'Excavation foreman', 'Damage-prevention manager', 'GC superintendent',
    ],
    capabilities: [
      'Precise potholing, utility ID, and geotagged documentation of each find',
      'Autonomous travel between marks, safe-zone setup, and hydro-excavation',
      'Locate, expose, photograph, and report utilities without a human at the nozzle',
    ],
    workflow: [
      'Receive mission → travel → confirm location → set safe zone → excavate → document → report → next',
      'Dispatch approved → self-navigate → verify marks → pothole → log find → close/protect → hand off',
      'Queue of locations → drive, confirm, excavate, capture, report, advance to next',
    ],
    hazards: [
      'Live utility strike, pressurized-water injection, vehicle–pedestrian collision',
      'Open excavation, moving boom, high-pressure water near workers',
      'Buried energized cable, vacuum entanglement, unstable truck',
    ],
    safety_controls: [
      'Exclusion zone, e-stop, boom force-limiting, right-of-way yielding',
      'Sensor-based worker detection, audible/visual alerts, geofenced dig area',
      'Redundant stop paths, pressure limits, slow-approach near marks',
    ],
    successful_failure: [
      'Detect uncertainty, stop in a safe state, alert, and await authorized recovery',
      'Halt predictably, protect the utility and workers, prevent uncontrolled restart',
      'Fail loud and safe: stop, report, and require a human to resume',
    ],
    summary: [
      'Foreman-supervised daylighting robot that never risks a live utility',
      'Autonomous potholing with a human in the loop for anomalies',
      'Verify-and-report loop that keeps downstream crews unblocked',
    ],
  },
};

function pick(arr, i, off) { return arr[(i + off) % arr.length]; }

function simPerson(i) {
  const p = i % 10;
  const presentPref = p < 4 ? 'yes' : p < 6 ? 'maybe' : 'no'; // ~40% yes / 20% maybe / 40% no
  const name = `${FIRST[i % FIRST.length]} ${String.fromCharCode(65 + Math.floor(i / FIRST.length))}.`;
  const answers = {};
  for (const [secKey, fields] of Object.entries(BANK)) {
    const a = {};
    let off = 0;
    for (const [fk, arr] of Object.entries(fields)) {
      a[fk] = pick(arr, i, off);
      off += 3;
    }
    answers[secKey] = a;
  }
  return {
    name,
    company: COMPANIES[i % COMPANIES.length],
    role: ROLES[i % ROLES.length],
    presentPref,
    answers, // { sectionKey: { field: value, ..., summary } }
  };
}

const POOL_SIZE = 50;

module.exports = { simPerson, POOL_SIZE };
