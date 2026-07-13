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
  users_workflow: {
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
    ],
    setup_connectivity: [
      'Pre-marked utilities, clear access route, water refill + spoils plan; LTE with teleop fallback',
      'Locates provided, exclusion area staged; live link to a remote operator for approvals',
    ],
    limitation_failure: [
      'Debris tank fills mid-dig with no swap plan',
      'Loses connectivity at an unverified high-consequence utility',
      'Bounded by onboard water and vacuum-hose reach per setup',
    ],
    most_important: [
      'Never damage a live utility', 'Verified location accuracy over speed',
      'Reliable results handoff to downstream crews', 'Graceful behaviour on poor connectivity',
    ],
    summary: [
      'Foreman-supervised daylighting robot that never risks a live utility',
      'Autonomous potholing with a human in the loop for anomalies',
      'Verify-and-report loop that keeps downstream crews unblocked',
    ],
  },
  _unused_users_capabilities: {
    primary_user: [
      'Site utility coordinator', 'Excavation foreman', 'Damage-prevention manager',
      'Locator technician', 'GC superintendent', 'Underground utility crew lead', 'Field operations manager',
    ],
    capabilities: [
      'Precise potholing, utility ID, and geotagged documentation of each find',
      'Autonomous travel between marks, safe-zone setup, and hydro-excavation',
      'Depth/type detection with camera + sensor fusion and a full dig log',
      'Locate, expose, photograph, and report utilities without a human at the nozzle',
    ],
    limitation: [
      'Bounded by onboard water supply and debris-tank capacity',
      'Vacuum hose reach limits how far it can dig per setup',
      'Struggles in very congested utility corridors without human review',
      'Limited operating time before refuel/refill',
    ],
    most_important: [
      'Never damage a live utility', 'Verified location accuracy over speed',
      'Complete, trustworthy documentation of every exposure', 'Stop safely on any uncertainty',
    ],
    summary: [
      'Foreman-supervised daylighting robot that never risks a live utility',
      'Autonomous potholing with a human in the loop for anomalies',
      'Documentation-first utility verification for congested sites',
      'Locate-and-expose robot judged on accuracy, not speed',
    ],
  },
  workflow_deployment: {
    workflow: [
      'Receive mission → travel → confirm location → set safe zone → excavate → document → report → next',
      'Dispatch approved → self-navigate → verify marks → pothole → log find → close/protect → hand off',
      'Queue of locations → drive, confirm, excavate, capture, report, advance to next',
    ],
    jobsite_setup: [
      'Pre-marked utilities, clear access route, water-refill point, spoils-disposal plan',
      'Locates provided, exclusion area staged, refill and dump logistics confirmed',
      'Site map loaded, access lanes cleared, water and debris handling ready',
    ],
    comms_plan: [
      'LTE telematics with teleop fallback; supervisor sign-off for anomalies',
      'Live link to a remote operator; escalates unknowns for human approval',
      'Continuous reporting; caches locally and requests teleop on low connectivity',
    ],
    critical_failure: [
      'Debris tank fills mid-dig with no swap plan',
      'Loses connectivity at an unverified high-consequence utility',
      'Cannot find the utility at the expected depth and stalls the downstream crew',
    ],
    most_important: [
      'Reliable results handoff to downstream crews', 'Predictable mobilization and cycle time',
      'Graceful behaviour on poor connectivity', 'Clear ownership of water/spoils logistics',
    ],
    summary: [
      'Mission-driven workflow with teleop fallback and clean handoffs',
      'Self-mobilizing potholing with human approval gates',
      'Verify-and-report loop that keeps downstream crews unblocked',
    ],
  },
  safety_failure: {
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
    interaction_rules: [
      'Workers keep 3 m; robot yields and alerts before any motion',
      'Robot always yields right-of-way; supervisor can stop it instantly',
      'No motion while a person is in the zone; clear audible warnings',
    ],
    successful_failure: [
      'Detect uncertainty, stop in a safe state, alert, and await authorized recovery',
      'Halt predictably, protect the utility and workers, prevent uncontrolled restart',
      'Fail loud and safe: stop, report, and require a human to resume',
    ],
    never_autonomous: [
      'Never dig within tolerance of an unverified high-consequence utility unattended',
      'Never restart after a fault without human inspection',
      'Never proceed past an unknown/leaking utility on its own',
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
