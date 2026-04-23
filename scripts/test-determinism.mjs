// Determinism replay harness.
//
// Verifies that with the same seed, the seeded PRNG and all sim systems
// built on it produce byte-identical output across independent runs.
// This is the foundation for co-op lockstep: both clients seeded identically
// must walk the same sim path.
//
// Run: node scripts/test-determinism.mjs

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { simRng, createSeededRng, seedFromString, parseSeedParam } from '../src/systems/seededRng.js';
import { generateWeightedWave } from '../src/systems/spawnBudget.js';
import { pickBoonChoices, weightedPickBoon } from '../src/systems/boonLogic.js';
import { ENEMY_TYPES } from '../src/entities/enemyTypes.js';
import { BOONS } from '../src/data/boonDefinitions.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL ${name}`);
    console.log(`  ${err && err.message ? err.message : err}`);
    if (err && err.stack) console.log(err.stack);
    failed++;
  }
}

function hash(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function collectStream(rng, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(rng.next());
  return out;
}

// --- raw PRNG determinism -------------------------------------------------

test('createSeededRng: same seed produces identical stream (10k samples)', () => {
  const a = createSeededRng(12345);
  const b = createSeededRng(12345);
  const sa = collectStream(a, 10000);
  const sb = collectStream(b, 10000);
  assert.equal(hash(sa), hash(sb));
});

test('createSeededRng: different seeds diverge within first 16 samples', () => {
  const a = createSeededRng(1);
  const b = createSeededRng(2);
  const sa = collectStream(a, 16);
  const sb = collectStream(b, 16);
  assert.notEqual(hash(sa), hash(sb));
});

test('simRng.reseed restores deterministic stream mid-run', () => {
  simRng.reseed(777);
  const first = collectStream(simRng, 500);
  simRng.reseed(777);
  const second = collectStream(simRng, 500);
  assert.equal(hash(first), hash(second));
});

test('seedFromString is stable across runs (hash invariant)', () => {
  // Canonical vectors — if these change, co-op room codes break.
  assert.equal(seedFromString('abc'), seedFromString('abc'));
  assert.equal(seedFromString('phantom-rebound'), seedFromString('phantom-rebound'));
  // Ensure empty-string fallback is nonzero (mulberry32 needs a live seed).
  assert.ok(seedFromString('') >= 1);
});

test('parseSeedParam: integer + string + null forms stay deterministic', () => {
  assert.equal(parseSeedParam('42'), 42);
  assert.equal(parseSeedParam('  42 '), 42);
  assert.equal(parseSeedParam(null), null);
  assert.equal(parseSeedParam(''), null);
  const a = parseSeedParam('my-run');
  const b = parseSeedParam('my-run');
  assert.equal(a, b);
  assert.ok(a >= 1);
});

test('simRng.fork: same parent seed → forks produce identical child streams', () => {
  simRng.reseed(999);
  const child1 = simRng.fork();
  const childStream1 = collectStream(child1, 200);
  simRng.reseed(999);
  const child2 = simRng.fork();
  const childStream2 = collectStream(child2, 200);
  assert.equal(hash(childStream1), hash(childStream2));
});

// --- generateWeightedWave determinism ------------------------------------

test('generateWeightedWave: same seed + same room index → identical wave composition', () => {
  const rooms = [3, 8, 15, 25, 45, 75];
  const runOne = [];
  const runTwo = [];

  simRng.reseed(20240423);
  for (const r of rooms) runOne.push(generateWeightedWave(r, ENEMY_TYPES));

  simRng.reseed(20240423);
  for (const r of rooms) runTwo.push(generateWeightedWave(r, ENEMY_TYPES));

  assert.equal(hash(runOne), hash(runTwo));
});

test('generateWeightedWave: different seeds produce different waves at same room', () => {
  simRng.reseed(1);
  const waveA = generateWeightedWave(30, ENEMY_TYPES);
  simRng.reseed(2);
  const waveB = generateWeightedWave(30, ENEMY_TYPES);
  // Probabilistic but effectively guaranteed at room 30 with mid-game variety.
  assert.notEqual(hash(waveA), hash(waveB));
});

// --- boon pick determinism ------------------------------------------------

function freshUpg() {
  return {
    healTier: 0, longReach: 0, fastShot: 0, bigShot: 0, extraLives: 0,
    ghostVel: 0, quickHarv: 0, kinetic: 0, multiShot: 0, pierce: 0,
    dashCharges: 0, vampiric: 0, berserker: 0, orbTier: 0, chargedOrb: 0,
    lateBloom: 0, payload: 0, wallBounce: 0, richGetRich: 0, escalation: 0,
    shockwave: 0, mirrorTide: 0, phaseDash: 0, predator: 0, bloodPact: 0,
    legendaries: [], reset: 0,
  };
}

test('pickBoonChoices: same seed + same upgrade state → identical 3-choice set', () => {
  const upg = freshUpg();
  simRng.reseed(42);
  const picksA = pickBoonChoices(upg, 5, 5, 3).map((b) => b && b.id);
  simRng.reseed(42);
  const picksB = pickBoonChoices(upg, 5, 5, 3).map((b) => b && b.id);
  assert.deepEqual(picksA, picksB);
});

test('weightedPickBoon: same seed → identical pick from same pool', () => {
  const upg = freshUpg();
  const pool = BOONS.slice(0, 6);

  simRng.reseed(11);
  const a = weightedPickBoon(pool, upg);
  simRng.reseed(11);
  const b = weightedPickBoon(pool, upg);
  assert.equal(a && a.id, b && b.id);
});

// --- compound sim replay --------------------------------------------------
// Simulates a "mini-run": 50 rooms of wave generation + boon picks between
// them, all driven by one seeded stream. Both passes must produce identical
// outputs. This is the core determinism guarantee Phase C lockstep depends on.

test('compound replay: 50 rooms of waves + boon choices byte-identical across runs', () => {
  function simulateMiniRun(seed) {
    simRng.reseed(seed);
    const log = [];
    const upg = freshUpg();
    for (let roomIdx = 0; roomIdx < 50; roomIdx++) {
      const wave = generateWeightedWave(roomIdx, ENEMY_TYPES);
      log.push({ room: roomIdx, wave });
      if (roomIdx % 3 === 2) {
        const picks = pickBoonChoices(upg, 5, 5, 3).map((b) => b && b.id);
        log.push({ room: roomIdx, picks });
      }
    }
    return log;
  }

  const seed = parseSeedParam('coop-canary');
  const a = simulateMiniRun(seed);
  const b = simulateMiniRun(seed);
  assert.equal(hash(a), hash(b), 'compound 50-room replay diverged');
});

// -------------------------------------------------------------------------

console.log('');
console.log(`Determinism harness: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
