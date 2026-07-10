'use strict';

// Weighted random group selection. Groups that have been "heard" fewer times are
// far more likely to be picked, supporting broad participation without ever making
// a repeat impossible. Returns the chosen group id plus an ordered "reel" of ids
// the client can use for the suspense animation.

function pickGroup(groups, opts = {}) {
  const { avoidRepeats = true, eligibleIds = null, rand = Math.random } = opts;
  let pool = groups.filter((g) => !eligibleIds || eligibleIds.includes(g.id));
  if (pool.length === 0) pool = groups.slice();
  if (pool.length === 0) return { groupId: null, reel: [] };

  // When avoiding repeats, restrict to the least-heard tier first.
  let candidates = pool;
  if (avoidRepeats) {
    const minHeard = Math.min(...pool.map((g) => Number(g.heard_count) || 0));
    const leastHeard = pool.filter((g) => (Number(g.heard_count) || 0) === minHeard);
    if (leastHeard.length) candidates = leastHeard;
  }

  // Inverse-heard weighting inside the candidate tier for a little extra fairness.
  const weights = candidates.map((g) => 1 / (1 + (Number(g.heard_count) || 0)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  let chosen = candidates[0];
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { chosen = candidates[i]; break; }
  }

  // Build a shuffled reel (for the cycling animation) that ends on the winner.
  const reelBase = pool.length >= 2 ? pool : groups;
  const reel = [];
  const target = Math.max(12, reelBase.length * 3);
  for (let i = 0; i < target; i++) {
    reel.push(reelBase[Math.floor(rand() * reelBase.length)].id);
  }
  reel.push(chosen.id);

  return { groupId: chosen.id, reel };
}

module.exports = { pickGroup };
