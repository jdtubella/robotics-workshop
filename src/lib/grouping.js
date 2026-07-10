'use strict';

// Balanced randomization: groups are random but constrained by the PRD rules:
//  1. Every group has >=1 presenter (Yes preferred, Maybe used only if needed).
//  2. Same-company people spread across groups where mathematically possible.
//  3. Group sizes stay balanced.
//  4. Roles distributed as a secondary criterion.
//  5. Groups stay as small as practical, capped by the number of presenters.
//
// Pure function: takes participants + options, returns a proposed assignment.
// Persistence and facilitator overrides live in the API layer.

function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignGroups(participants, opts = {}) {
  const {
    groupNamePool = ['Atlas', 'Crane', 'Rover', 'Dozer', 'Survey', 'Lift'],
    targetSize = 4,
    minGroups = 1,
    maxGroups = groupNamePool.length,
    lockedByGroupName = {}, // { groupName: [participantId, ...] } to preserve on reroll
    rand = Math.random,
  } = opts;

  const warnings = [];
  const all = participants.filter(Boolean);
  const P = all.length;

  if (P === 0) {
    return { groups: [], warnings: ['No participants to assign.'], groupCount: 0 };
  }

  const byId = new Map(all.map((p) => [p.id, p]));
  const norm = (v) => (v == null ? '' : String(v).trim().toLowerCase());

  // --- Presenter pools -------------------------------------------------------
  const yes = shuffle(all.filter((p) => norm(p.present_pref) === 'yes'), rand);
  const maybe = shuffle(all.filter((p) => norm(p.present_pref) === 'maybe'), rand);
  const availablePresenters = yes.length + maybe.length;

  // --- Desired group count ---------------------------------------------------
  let desired = Math.max(1, Math.round(P / targetSize));
  let groupCount = Math.min(desired, Math.max(1, availablePresenters), maxGroups);
  groupCount = Math.max(groupCount, minGroups > 0 ? Math.min(minGroups, groupCount || 1) : 1);
  // Respect the number of distinct locked groups.
  const lockedGroupNames = Object.keys(lockedByGroupName).filter(
    (n) => (lockedByGroupName[n] || []).some((id) => byId.has(id))
  );
  if (lockedGroupNames.length > groupCount) groupCount = lockedGroupNames.length;
  groupCount = Math.min(groupCount, Math.max(groupNamePool.length, lockedGroupNames.length));
  if (groupCount < 1) groupCount = 1;

  if (availablePresenters < desired) {
    warnings.push(
      `Only ${availablePresenters} participant(s) willing to present, so groups were capped at ${groupCount}. Recruit more presenters for smaller groups.`
    );
  }
  if (yes.length < groupCount) {
    warnings.push(
      `Not enough "Yes" presenters (${yes.length}) for ${groupCount} groups; "Maybe" volunteers were used to fill presenter slots.`
    );
  }

  // --- Build empty groups ----------------------------------------------------
  const names = [];
  const usedNames = new Set();
  for (const n of lockedGroupNames) { names.push(n); usedNames.add(n); }
  const poolShuffled = shuffle(groupNamePool, rand);
  for (const n of poolShuffled) {
    if (names.length >= groupCount) break;
    if (!usedNames.has(n)) { names.push(n); usedNames.add(n); }
  }
  let extra = 1;
  while (names.length < groupCount) names.push(`Group ${extra++}`);

  const groups = names.slice(0, groupCount).map((name) => ({
    name,
    memberIds: [],
    presenterId: null,
    recorderId: null,
    companies: new Set(),
    roles: new Set(),
  }));
  const groupByName = new Map(groups.map((g) => [g.name, g]));
  const assigned = new Set();

  function place(p, g) {
    g.memberIds.push(p.id);
    g.companies.add(norm(p.company));
    g.roles.add(norm(p.role));
    assigned.add(p.id);
  }

  // --- Pre-place locked participants ----------------------------------------
  for (const gname of lockedGroupNames) {
    const g = groupByName.get(gname);
    if (!g) continue;
    for (const pid of lockedByGroupName[gname] || []) {
      const p = byId.get(pid);
      if (p && !assigned.has(pid)) place(p, g);
    }
  }
  // Honour existing presenter/recorder among locked members.
  for (const g of groups) {
    for (const pid of g.memberIds) {
      const p = byId.get(pid);
      if (p && Number(p.is_presenter) === 1 && !g.presenterId) g.presenterId = pid;
      if (p && Number(p.is_recorder) === 1 && !g.recorderId) g.recorderId = pid;
    }
  }

  // --- One presenter per group ----------------------------------------------
  const presenterQueue = [...yes, ...maybe].filter((p) => !assigned.has(p.id));
  for (const g of groups) {
    if (g.presenterId) continue;
    const idx = presenterQueue.findIndex((p) => p && !assigned.has(p.id));
    if (idx === -1) {
      warnings.push(`Group ${g.name} has no volunteer presenter; assign one manually.`);
      continue;
    }
    const p = presenterQueue.splice(idx, 1)[0];
    place(p, g);
    g.presenterId = p.id;
  }

  // --- Remaining participants, sorted by company concentration --------------
  const remaining = all.filter((p) => !assigned.has(p.id));
  const companyFreq = new Map();
  for (const p of remaining) {
    const c = norm(p.company);
    companyFreq.set(c, (companyFreq.get(c) || 0) + 1);
  }
  remaining.sort((a, b) => {
    const fa = companyFreq.get(norm(a.company)) || 0;
    const fb = companyFreq.get(norm(b.company)) || 0;
    if (fb !== fa) return fb - fa; // most concentrated first
    return rand() - 0.5;
  });

  for (const p of remaining) {
    const c = norm(p.company);
    const r = norm(p.role);
    // Prefer groups with no company conflict; among those, no role conflict; then smallest.
    const noCompany = groups.filter((g) => !(c && g.companies.has(c)));
    let pool = noCompany.length ? noCompany : groups;
    const dup = noCompany.length === 0 && c;

    const noRole = pool.filter((g) => !(r && g.roles.has(r)));
    if (noRole.length) pool = noRole;

    pool = pool.slice().sort((a, b) => a.memberIds.length - b.memberIds.length || rand() - 0.5);
    const g = pool[0];
    place(p, g);
    if (dup) {
      warnings.push(
        `${p.name || 'A participant'} from "${p.company}" had to share a group (unavoidable company duplication).`
      );
    }
  }

  // --- Recorder per group (default: a non-presenter member) -----------------
  for (const g of groups) {
    if (g.recorderId && g.memberIds.includes(g.recorderId)) continue;
    const nonPresenter = g.memberIds.find((id) => id !== g.presenterId);
    g.recorderId = nonPresenter || g.presenterId || g.memberIds[0] || null;
  }

  return {
    groupCount,
    warnings,
    groups: groups.map((g, i) => ({
      name: g.name,
      sort_order: i,
      memberIds: g.memberIds,
      presenterId: g.presenterId,
      recorderId: g.recorderId,
    })),
  };
}

module.exports = { assignGroups, shuffle };
