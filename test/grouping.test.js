'use strict';

// Invariant tests for the balanced-grouping algorithm — the piece of the
// platform with the most rules and the least visibility when it goes wrong.
// Run with: npm test

const { test } = require('node:test');
const assert = require('node:assert');
const { assignGroups } = require('../src/lib/grouping');

let seq = 0;
function person({ name, company = '', role = '', present = 'no', locked = 0 } = {}) {
  seq++;
  return {
    id: 'p' + seq,
    name: name || 'Person ' + seq,
    company,
    role,
    present_pref: present,
    locked,
    is_presenter: 0,
    is_recorder: 0,
  };
}

function people(n, fn = () => ({})) {
  return Array.from({ length: n }, (_, i) => person(fn(i)));
}

test('every group gets a presenter when enough volunteers exist', () => {
  const parts = people(16, (i) => ({
    present: i < 6 ? 'yes' : 'no',
    company: 'Co' + (i % 8),
  }));
  const { groups, warnings } = assignGroups(parts, { targetSize: 4 });
  assert.ok(groups.length >= 2, 'should form multiple groups');
  for (const g of groups) {
    assert.ok(g.presenterId, `group ${g.name} must have a presenter`);
    assert.ok(g.memberIds.includes(g.presenterId), 'presenter must be a member');
  }
  assert.ok(!warnings.some((w) => w.includes('no volunteer presenter')));
});

test('group count is capped by available presenters', () => {
  const parts = people(20, (i) => ({ present: i < 2 ? 'yes' : 'no' }));
  const { groups } = assignGroups(parts, { targetSize: 4 });
  assert.ok(groups.length <= 2, `only 2 presenters -> at most 2 groups (got ${groups.length})`);
});

test('same-company people are separated when mathematically possible', () => {
  // 4 from Acme + 12 others across 4 groups: no group needs two Acme people.
  const parts = [
    ...people(4, () => ({ company: 'Acme', present: 'yes' })),
    ...people(12, (i) => ({ company: 'Other' + i, present: i % 3 === 0 ? 'yes' : 'no' })),
  ];
  const { groups } = assignGroups(parts, { targetSize: 4 });
  const byId = new Map(parts.map((p) => [p.id, p]));
  for (const g of groups) {
    const acme = g.memberIds.filter((id) => byId.get(id).company === 'Acme');
    assert.ok(acme.length <= 1, `group ${g.name} has ${acme.length} Acme members`);
  }
});

test('unavoidable company duplication is flagged, not hidden', () => {
  // 6 from one company but only enough presenters for 2 groups -> dup unavoidable.
  const parts = [
    ...people(6, () => ({ company: 'MegaCorp' })),
    person({ present: 'yes' }),
    person({ present: 'yes' }),
  ];
  const { groups, warnings } = assignGroups(parts, { targetSize: 4 });
  const byId = new Map(parts.map((p) => [p.id, p]));
  const hasDup = groups.some(
    (g) => g.memberIds.filter((id) => byId.get(id).company === 'MegaCorp').length > 1
  );
  assert.ok(hasDup, 'duplication is unavoidable here');
  assert.ok(warnings.some((w) => w.includes('unavoidable company duplication')), 'must warn about it');
});

test('group sizes stay balanced (max spread of 1)', () => {
  const parts = people(18, (i) => ({ present: i % 3 === 0 ? 'yes' : 'no', company: 'C' + i }));
  const { groups } = assignGroups(parts, { targetSize: 4 });
  const sizes = groups.map((g) => g.memberIds.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `unbalanced sizes: ${sizes}`);
});

test('locked members stay in their named group on reroll', () => {
  const parts = people(12, (i) => ({ present: i % 2 === 0 ? 'yes' : 'no' }));
  const lockedIds = [parts[0].id, parts[1].id];
  const { groups } = assignGroups(parts, {
    targetSize: 4,
    groupNamePool: ['Atlas', 'Crane', 'Rover'],
    lockedByGroupName: { Atlas: lockedIds },
  });
  const atlas = groups.find((g) => g.name === 'Atlas');
  assert.ok(atlas, 'locked group name must exist');
  for (const id of lockedIds) assert.ok(atlas.memberIds.includes(id), `${id} must stay in Atlas`);
});

test('everyone is assigned exactly once', () => {
  const parts = people(23, (i) => ({ present: i % 4 === 0 ? 'yes' : i % 4 === 1 ? 'maybe' : 'no', company: 'C' + (i % 5) }));
  const { groups } = assignGroups(parts, { targetSize: 4 });
  const all = groups.flatMap((g) => g.memberIds);
  assert.strictEqual(all.length, parts.length, 'no one dropped');
  assert.strictEqual(new Set(all).size, parts.length, 'no one duplicated');
});

test('recorder prefers a notes+laptop volunteer over a random member', () => {
  // 8 people, exactly 2 full volunteers (notes AND laptop) — wherever a
  // volunteer lands, they must get the recorder slot.
  const mk = (over) => {
    const p = person(over);
    p.notes_pref = over.notes_pref || 'no';
    p.has_laptop = over.has_laptop || 'no';
    return p;
  };
  const parts2 = [
    mk({ present: 'yes' }), mk({ present: 'yes' }),
    mk({ notes_pref: 'yes', has_laptop: 'yes' }), mk({ notes_pref: 'yes', has_laptop: 'yes' }),
    mk({ notes_pref: 'yes' }), mk({ has_laptop: 'yes' }), mk({}), mk({}),
  ];
  const volunteerIds = new Set([parts2[2].id, parts2[3].id]);
  const { groups } = assignGroups(parts2, { targetSize: 4 });
  for (const g of groups) {
    const hasVol = g.memberIds.some((id) => volunteerIds.has(id));
    if (hasVol) {
      assert.ok(volunteerIds.has(g.recorderId), `group ${g.name} has a volunteer but picked ${g.recorderId}`);
    }
    assert.ok(g.recorderId, `group ${g.name} must still get a recorder`);
  }
});

test('empty input returns no groups and a warning', () => {
  const { groups, warnings } = assignGroups([]);
  assert.strictEqual(groups.length, 0);
  assert.ok(warnings.length > 0);
});
