// R0.6 — Long determinism canary.
//
// Rationale: the per-module tests (rng, simState, helpers) and the existing
// 1800-tick replay test verify that two parallel runs match each other.
// They do NOT verify that the output matches a known-good baseline. A
// silent algorithmic drift could pass every other test (because both runs
// drift identically) and only show up as a desync between two clients
// running different builds.
//
// This canary fixes a hardcoded SHA-256 hash of the full-state trace after
// 10000 deterministic ticks. Any change to sim math, RNG seeding, helper
// extraction, or serialization that alters byte-level output will fail
// this test. To intentionally bump the hash:
//   1. Run this test, copy the printed actual hash.
//   2. Replace EXPECTED_HASH below.
//   3. Document the bump in the commit message AND in patch notes.
//
// The hash covers: 100-tick checkpoint (early), 5000-tick checkpoint
// (mid-run), and 10000-tick final state. Three checkpoints rather than one
// so that a regression localizes to a window rather than just "somewhere".

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createSimState } from '../src/sim/simState.js';
import { serialize } from '../src/sim/simStateSerialize.js';
import { hostSimStep } from '../src/sim/hostSimStep.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (err) { console.log(`FAIL ${name}\n  ${err.stack || err.message}`); failed++; }
}

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

// LCG-driven deterministic input stream (matches test-sim-replay).
function makeInputStream(seed, ticks) {
  let s = seed >>> 0;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; };
  const rand = () => (next() & 0xffffff) / 0xffffff;
  const inputs = [];
  for (let i = 0; i < ticks; i++) {
    const active = rand() > 0.15;
    const angle = rand() * Math.PI * 2;
    const mag = rand() * 60;
    inputs.push({
      joy: {
        dx: active ? Math.cos(angle) : 0,
        dy: active ? Math.sin(angle) : 0,
        mag: active ? mag : 0,
        active,
      },
    });
  }
  return inputs;
}

function makeFreshCanaryState() {
  const s = createSimState({ seed: 0xC0FFEE, worldW: 800, worldH: 600, slotCount: 2 });
  s.slots[0].body.x = 200; s.slots[0].body.y = 300; s.slots[0].body.r = 14;
  s.slots[1].body.x = 600; s.slots[1].body.y = 300; s.slots[1].body.r = 14;
  // Pre-load a few timer + UPG fields so the post-movement helper exercises real branches.
  for (const slot of s.slots) {
    slot.body.invincible = 0.5;
    slot.body.distort = 0.3;
    slot.timers.barrierPulseTimer = 250;
    slot.timers.absorbComboTimer = 90;
    slot.timers.absorbComboCount = 4;
    slot.timers.colossusShockwaveCd = 0.6;
    slot.timers.volatileOrbGlobalCooldown = 0.4;
    slot.upg.shieldTier = 3;
    slot.upg.shieldTempered = true;
    slot.upg.colossus = true;
    slot.orbState.cooldowns.push(0.5, 0.3, 0.1);
  }
  return s;
}

// Run N ticks deterministically and capture three checkpoint hashes.
function runCanary(ticks) {
  const state = makeFreshCanaryState();
  const inputs0 = makeInputStream(0xCA1A1A1, ticks);
  const inputs1 = makeInputStream(0xCA1A1A2, ticks);
  const dt = 1 / 60;
  const checkpoints = {};
  for (let i = 0; i < ticks; i++) {
    hostSimStep(state, inputs0[i], inputs1[i], dt);
    if (i + 1 === 100)   checkpoints.tick100   = sha256(serialize(state));
    if (i + 1 === 5000)  checkpoints.tick5000  = sha256(serialize(state));
    if (i + 1 === 10000) checkpoints.tick10000 = sha256(serialize(state));
  }
  return checkpoints;
}

// Hardcoded baselines. If a code change intentionally alters sim output,
// run this test, copy the printed values, and update these constants in the
// SAME commit. Any unexpected drift will fail the test.
const EXPECTED = {
  // Re-pinned in v1.20.98 when hostSimStep started advancing state.tick and
  // state.timeMs (R0.4 step 5 — clock seam). Prior baselines (v1.20.94) were
  // computed when the sim clock was frozen at 0; bumping the seam shifts the
  // hashes by exactly the per-tick clock advancement (sim math itself is
  // unchanged). Parallel run-A == run-B continues to pass.
  tick100:   'b07f81ecf28309e260d104f94334e2387831a3b055d290e6be9073d4dc0fbad4',
  tick5000:  'a4fe5a1d3c94f1a5d2a5026b2b4877336ee05e7e80fd3b127541057e96235fbc',
  tick10000: 'ba27cc13e13fbe96eb1c4527f2fc31ba9e3c8ba1182ac018dc8254eaaeb49f4f',
};

test('R0.6: 10000-tick canary state hash matches baseline', () => {
  const actual = runCanary(10000);

  // Always print so a regression report includes the new values.
  console.log(`  tick100   actual: ${actual.tick100}`);
  console.log(`  tick5000  actual: ${actual.tick5000}`);
  console.log(`  tick10000 actual: ${actual.tick10000}`);

  // Baseline-set mode: if the constants are still placeholders, compute them
  // from a SECOND independent run and assert internal consistency only. This
  // makes the test self-bootstrapping: it always verifies determinism (run A
  // == run B), and once baselines are pinned it also verifies non-drift.
  if (EXPECTED.tick100 === '__SET_ON_FIRST_RUN__') {
    const second = runCanary(10000);
    assert.equal(actual.tick100,   second.tick100,   'tick100 not deterministic across runs');
    assert.equal(actual.tick5000,  second.tick5000,  'tick5000 not deterministic across runs');
    assert.equal(actual.tick10000, second.tick10000, 'tick10000 not deterministic across runs');
    console.log('  (baseline placeholders detected — pin EXPECTED in test file to enable drift detection)');
    return;
  }

  assert.equal(actual.tick100,   EXPECTED.tick100,   'tick100 hash drifted from baseline');
  assert.equal(actual.tick5000,  EXPECTED.tick5000,  'tick5000 hash drifted from baseline');
  assert.equal(actual.tick10000, EXPECTED.tick10000, 'tick10000 hash drifted from baseline');
});

test('R0.6: parallel 10000-tick runs are byte-identical', () => {
  const a = runCanary(10000);
  const b = runCanary(10000);
  assert.equal(a.tick100,   b.tick100);
  assert.equal(a.tick5000,  b.tick5000);
  assert.equal(a.tick10000, b.tick10000);
});

console.log('');
console.log(`R0.6 long canary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
