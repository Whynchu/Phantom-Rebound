#!/usr/bin/env node
// D19.3 — host grey lag-comp tests.
//
// Validates: per-tick recording, eviction of vanished bullet ids,
// historic distance check against ~K ticks ago, fallback when bullet
// is younger than the lag window, and the configurable lagTicks param.

import { createGreyLagComp, DEFAULT_LAG_TICKS } from '../src/net/greyLagComp.js';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond) {
  if (cond) { pass++; return; }
  fail++;
  failures.push(name);
  console.error('  FAIL:', name);
}

function eq(name, a, b) { ok(name + ` (got ${a}, want ${b})`, a === b); }

// 1. record + size + eviction.
{
  const c = createGreyLagComp({});
  c.record([
    { id: 'a', state: 'grey', x: 10, y: 10, r: 6 },
    { id: 'b', state: 'grey', x: 20, y: 20, r: 6 },
    { id: 'x', state: 'output', x: 99, y: 99, r: 4 },
  ], 100);
  eq('record: only greys tracked', c.size(), 2);
  c.record([{ id: 'a', state: 'grey', x: 11, y: 11, r: 6 }], 101);
  eq('record: missing ids evicted', c.size(), 1);
  c.clear();
  eq('clear empties tracker', c.size(), 0);
}

// 2. wasNearHistoric should match position ~K ticks ago, not now.
{
  const c = createGreyLagComp({ lagTicks: 6 });
  // Simulate grey moving from x=0 → x=100 over 7 ticks (linear sweep).
  for (let t = 0; t < 7; t++) {
    c.record([{ id: 'g1', state: 'grey', x: t * 16, y: 50, r: 6 }], t);
  }
  // Current tick = 6, position = 96. K=6 → historic position should be at tick 0 → x=0.
  // Test body at (5, 50) with absR 8: NOT near current (96,50), but IS near historic (0,50).
  const overlapHist = c.wasNearHistoric('g1', 6, 5, 50, 8);
  ok('historic overlap detected when current would miss', overlapHist === true);
  // Test body at (96, 50): would overlap current — but wasNearHistoric tests historic only.
  // Historic is (0,50); body at (96,50) doesn't overlap that.
  const overlapHist2 = c.wasNearHistoric('g1', 6, 96, 50, 8);
  ok('historic does not falsely overlap when only current is near', overlapHist2 === false);
}

// 3. Younger-than-lag bullet returns false (no panic, callers fall back to current-pos check).
{
  const c = createGreyLagComp({ lagTicks: 6 });
  c.record([{ id: 'fresh', state: 'grey', x: 50, y: 50, r: 6 }], 0);
  // Only 1 tick of history; want lookback at tick 0 - 6 = -6 → no entry close enough.
  const r = c.wasNearHistoric('fresh', 0, 50, 50, 8);
  ok('young bullet returns false (allows current-check fallback)', r === false);
}

// 4. Unknown id returns false.
{
  const c = createGreyLagComp({});
  ok('unknown id → false', c.wasNearHistoric('nope', 5, 0, 0, 99) === false);
}

// 5. Custom lagTicks honored.
{
  const c = createGreyLagComp({ lagTicks: 2 });
  for (let t = 0; t < 3; t++) {
    c.record([{ id: 'g', state: 'grey', x: t * 50, y: 0, r: 6 }], t);
  }
  // Current tick 2, position 100. K=2 → look at tick 0 → x=0.
  ok('lagTicks=2 looks back 2 ticks', c.wasNearHistoric('g', 2, 0, 0, 10) === true);
  ok('lagTicks=2 does not match current (100,0)', c.wasNearHistoric('g', 2, 100, 0, 10) === false);
}

// 6. Sanity: DEFAULT_LAG_TICKS is exported.
ok('DEFAULT_LAG_TICKS is a positive int', Number.isInteger(DEFAULT_LAG_TICKS) && DEFAULT_LAG_TICKS > 0);

// 7. Ring buffer wraps without losing the K-ticks-ago entry.
{
  const c = createGreyLagComp({ lagTicks: 4 });
  for (let t = 0; t < 50; t++) {
    c.record([{ id: 'wrap', state: 'grey', x: t, y: 0, r: 6 }], t);
  }
  // After 50 ticks, history at K=4 should give x≈45 (tick 45±slack).
  const e = c.getHistoric('wrap', 49);
  ok('ring wrap: historic still close to expected tick', e !== null && Math.abs(e.tick - 45) <= 4);
}

console.log(`\nGrey lag-comp tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error('Failures:', failures);
  process.exit(1);
}
process.exit(0);
