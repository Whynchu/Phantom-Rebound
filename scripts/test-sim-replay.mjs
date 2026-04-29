// R0.4 step 2 — Black-box replay harness.
//
// Rationale (rubber-duck pivot, R0.4): the determinism canary tests
// modules in isolation (rng, simState identity, JSON round-trip). It
// does NOT prove that running hostSimStep N times with the same inputs
// produces byte-identical state across runs. That is the property
// rollback actually needs: any divergence between prediction-resim and
// actual-input-resim is a desync.
//
// This harness drives hostSimStep with a deterministic input stream,
// hashes the full simState surface (via serialize) after each tick,
// and asserts the trace is byte-identical across two parallel runs.
// As more chunks land in hostSimStep (timer block, bullets, enemies),
// the harness automatically validates them — no test churn needed.

import { strict as assert } from 'node:assert';
import { createSimState } from '../src/sim/simState.js';
import { serialize } from '../src/sim/simStateSerialize.js';
import { hostSimStep } from '../src/sim/hostSimStep.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (err) { console.log(`FAIL ${name}\n  ${err.stack || err.message}`); failed++; }
}

// Deterministic LCG for synthetic inputs. Independent of simRng so the
// input stream stays stable even if simRng's algorithm changes.
function makeInputStream(seed, ticks) {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
  const rand = () => (next() & 0xffffff) / 0xffffff;
  const inputs = [];
  for (let i = 0; i < ticks; i++) {
    // joy shape matches script.js: { dx, dy } are unit-vector components,
    // mag is magnitude in joystick units (0..joyMax), active gates.
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

function makeFreshState(opts = {}) {
  const state = createSimState({
    seed: 42,
    worldW: 800,
    worldH: 600,
    slotCount: 2,
  });
  state.slots[0].body.x = 200;
  state.slots[0].body.y = 300;
  state.slots[0].body.r = 14;
  state.slots[1].body.x = 600;
  state.slots[1].body.y = 300;
  state.slots[1].body.r = 14;
  state.run.roomPhase = 'spawning';
  if (opts.exerciseTimers) {
    // Pre-load each slot with non-zero timer values + UPG flags so the
    // R0.4 step 3 helper (tickPostMovementTimers) actually exercises every
    // branch (decrements, clamps, shield-grow, absorbCombo expiry, etc.).
    for (const slot of state.slots) {
      slot.body.invincible = 0.5;
      slot.body.distort = 0.3;
      slot.timers.barrierPulseTimer = 250;
      slot.timers.slipCooldown = 180;
      slot.timers.absorbComboTimer = 90;
      slot.timers.absorbComboCount = 4;
      slot.timers.chainMagnetTimer = 120;
      slot.timers.colossusShockwaveCd = 0.6;
      slot.timers.volatileOrbGlobalCooldown = 0.4;
      slot.upg.shieldTier = 3;
      slot.upg.shieldTempered = true;
      slot.upg.colossus = true;
      slot.orbState.cooldowns.push(0.5, 0.3, 0.1);
    }
  }
  return state;
}

function runReplay(seed, ticks, opts, stateOpts) {
  const state = makeFreshState(stateOpts);
  const inputsA = makeInputStream(seed, ticks);
  const inputsB = makeInputStream(seed ^ 0xa5a5a5a5, ticks);
  const trace = [];
  const dt = 1 / 60;
  for (let i = 0; i < ticks; i++) {
    hostSimStep(state, inputsA[i], inputsB[i], dt, opts);
    trace.push(serialize(state));
  }
  return trace;
}

test('replay: identical inputs produce byte-identical trace across runs', () => {
  const ticks = 600; // 10 seconds at 60 fps
  const traceA = runReplay(12345, ticks);
  const traceB = runReplay(12345, ticks);
  assert.equal(traceA.length, ticks);
  assert.equal(traceB.length, ticks);
  for (let i = 0; i < ticks; i++) {
    if (traceA[i] !== traceB[i]) {
      throw new Error(`Divergence at tick ${i}\n  A: ${traceA[i].slice(0, 200)}...\n  B: ${traceB[i].slice(0, 200)}...`);
    }
  }
});

test('replay: different seeds produce different traces (sanity check)', () => {
  const ticks = 60;
  const traceA = runReplay(11111, ticks);
  const traceB = runReplay(99999, ticks);
  // The two traces must NOT be identical, otherwise the harness isn't
  // exercising state changes — meaning the test above would pass
  // trivially.
  let anyDifferent = false;
  for (let i = 0; i < ticks; i++) {
    if (traceA[i] !== traceB[i]) { anyDifferent = true; break; }
  }
  assert.ok(anyDifferent, 'different seeds produced identical traces — harness is not exercising sim');
});

test('replay: trace evolves (state actually changes per tick)', () => {
  // Confirms the sim is doing work. If every tick serialized the same,
  // the determinism check would pass trivially even if hostSimStep was
  // a no-op — we must reject that scenario explicitly.
  const ticks = 60;
  const trace = runReplay(7777, ticks);
  let distinctCount = 0;
  const seen = new Set();
  for (const t of trace) {
    if (!seen.has(t)) { seen.add(t); distinctCount++; }
  }
  assert.ok(distinctCount > 30, `expected >30 distinct states across ${ticks} ticks, got ${distinctCount}`);
});

test('replay: world-bound clamp produces identical positions for runaway joystick', () => {
  // Push hard south-east continuously; both runs should clamp to the
  // same world boundary at the same tick.
  const ticks = 200;
  const opts = { worldW: 400, worldH: 400, margin: 10 };
  const stuckInputs = Array.from({ length: ticks }, () => ({
    joy: { dx: 1 / Math.SQRT2, dy: 1 / Math.SQRT2, mag: 60, active: true },
  }));
  function runStuck() {
    const state = makeFreshState();
    state.slots[0].body.x = 200; state.slots[0].body.y = 200;
    state.slots[1].body.x = 200; state.slots[1].body.y = 200;
    const trace = [];
    for (let i = 0; i < ticks; i++) {
      hostSimStep(state, stuckInputs[i], stuckInputs[i], 1 / 60, opts);
      trace.push(serialize(state));
    }
    return trace;
  }
  const a = runStuck();
  const b = runStuck();
  for (let i = 0; i < ticks; i++) {
    assert.equal(a[i], b[i], `stuck-on-edge divergence at tick ${i}`);
  }
});

test('replay: longer run (1800 ticks ≈ 30s) stays byte-identical', () => {
  // Stress test — catches any slow-burn floating point drift from
  // accumulated substep math.
  const ticks = 1800;
  const a = runReplay(54321, ticks);
  const b = runReplay(54321, ticks);
  for (let i = 0; i < ticks; i++) {
    if (a[i] !== b[i]) throw new Error(`30s replay diverged at tick ${i}`);
  }
});

test('replay: timer/shield/orb branches stay byte-identical (R0.4 step 3)', () => {
  // Pre-loads per-slot timers + UPG flags so tickPostMovementTimers'
  // every branch (body transients, shield grow, ms timer block,
  // colossus s tick, absorbCombo expiry, volatile orb clamp, per-orb
  // loop) executes during replay. Two identical runs must remain
  // byte-identical end-to-end.
  const ticks = 600;
  const a = runReplay(31337, ticks, {}, { exerciseTimers: true });
  const b = runReplay(31337, ticks, {}, { exerciseTimers: true });
  for (let i = 0; i < ticks; i++) {
    if (a[i] !== b[i]) throw new Error(`step-3 replay diverged at tick ${i}`);
  }
  // Sanity: the trace evolves through the timer ramp (not stuck on a
  // single state).
  const distinct = new Set(a);
  if (distinct.size < 30) {
    throw new Error(`step-3 timers not exercised: only ${distinct.size} distinct states`);
  }
});

console.log('');
console.log(`Sim replay harness: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
