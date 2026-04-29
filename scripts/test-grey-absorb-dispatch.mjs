// Tests for detectGreyAbsorb (R0.4 step 10 — Region C).
import { strict as assert } from 'node:assert';
import { detectGreyAbsorb } from '../src/sim/greyAbsorbDispatch.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (err) { console.log(`FAIL ${name}\n  ${err.message}`); failed++; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function greyBullet({ x = 100, y = 100, r = 6, id = 42 } = {}) {
  return { state: 'grey', x, y, r, id };
}

function baseCtx(overrides = {}) {
  return {
    player: { x: 200, y: 200, r: 14, vx: 0, vy: 0 },
    absorbR: 30,                 // player.r(14) + 5 + absorbRange(11)
    slot0Timers: { absorbComboCount: 0, absorbComboTimer: 0, chainMagnetTimer: 0 },
    UPG: {
      absorbValue: 1, ghostFlow: false, resonantAbsorb: false, surgeHarvest: false,
      refraction: false, refractionCooldown: 0, refractionCount: 0,
      chainMagnetTier: 0, absorbOrbs: false, orbitSphereTier: 0,
      speedMult: 1, titanSlowMult: 1, colossus: false,
    },
    simNowMs: 5000,
    playerSlots: [],
    simTick: 100,
    lagComp: null,
    ts: 0,
    ORBIT_ROTATION_SPD: 0.7,
    getOrbitSlotPosition: ({ index, originX, originY }) => ({ x: originX + 60, y: originY, angle: 0 }),
    orbitRadius: 60,
    orbVisualRadius: 12,
    orbCooldowns: [],
    GLOBAL_SPEED_LIFT: 1,
    ghostColor: '#aabbcc',
    ...overrides,
  };
}

// ── 1. Miss: bullet far away, nothing triggered ───────────────────────────
test('miss — returns null when bullet is far from everything', () => {
  const b = greyBullet({ x: 600, y: 600 });
  const ctx = baseCtx();
  const result = detectGreyAbsorb(b, ctx);
  assert.strictEqual(result, null);
});

// ── 2. Slot-0 absorb: basic ───────────────────────────────────────────────
test('slot0 absorb — basic, no boons', () => {
  const b = greyBullet({ x: 210, y: 200 }); // within absorbR(30) + br(6) of player(200,200)
  const ctx = baseCtx({ UPG: { ...baseCtx().UPG, absorbValue: 2 } });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result, 'should return result');
  assert.equal(result.kind, 'slot0');
  assert.ok(result.slot0, 'slot0 payload present');
  assert.equal(result.slot0.absorbGain, 2);
  assert.equal(result.slot0.resonantIncrement, false);
  assert.equal(result.slot0.resonantBonusGain, 0);
  assert.equal(result.slot0.refractionSpec, null);
  assert.equal(result.slot0.chainMagnetDuration, 0);
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0].kind, 'sparks');
  assert.equal(result.effects[0].x, b.x);
  assert.equal(result.effects[0].y, b.y);
  assert.equal(result.effects[0].count, 5);
  assert.equal(result.effects[0].size, 45);
});

// ── 3. GhostFlow boosts gain based on speed ───────────────────────────────
test('slot0 absorb — ghostFlow at full speed gives > absorbValue', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    player: { x: 200, y: 200, r: 14, vx: 165, vy: 0 }, // at max speed
    UPG: { ...baseCtx().UPG, ghostFlow: true, absorbValue: 1 },
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.equal(result.kind, 'slot0');
  // At full speed frac=1, gain = 1 * (0.5 + 1*1.1) = 1.6
  assert.ok(result.slot0.absorbGain > 1, `gain ${result.slot0.absorbGain} should be > 1`);
  assert.ok(result.slot0.absorbGain < 2, `gain ${result.slot0.absorbGain} should be < 2`);
});

test('slot0 absorb — ghostFlow at zero speed gives half absorbValue', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    player: { x: 200, y: 200, r: 14, vx: 0, vy: 0 },
    UPG: { ...baseCtx().UPG, ghostFlow: true, absorbValue: 2 },
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  // At zero speed frac=0, gain = 2 * (0.5 + 0) = 1
  assert.equal(result.slot0.absorbGain, 1);
});

// ── 4. ResonantAbsorb ─────────────────────────────────────────────────────
test('slot0 absorb — resonantAbsorb increments combo, no bonus yet', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    slot0Timers: { absorbComboCount: 1, absorbComboTimer: 0 },
    UPG: { ...baseCtx().UPG, resonantAbsorb: true, absorbValue: 1 },
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.equal(result.slot0.resonantIncrement, true);
  // count was 1, bumped to 2 — not yet 3
  assert.equal(result.slot0.resonantBonusGain, 0);
});

test('slot0 absorb — resonantAbsorb at combo count 2 triggers bonus', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    slot0Timers: { absorbComboCount: 2, absorbComboTimer: 0 },
    UPG: { ...baseCtx().UPG, resonantAbsorb: true, surgeHarvest: false, absorbValue: 2 },
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.equal(result.slot0.resonantIncrement, true);
  assert.equal(result.slot0.resonantBonusGain, 1); // 2 * 0.5
});

test('slot0 absorb — resonantAbsorb with surgeHarvest gives full bonus', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    slot0Timers: { absorbComboCount: 2, absorbComboTimer: 0 },
    UPG: { ...baseCtx().UPG, resonantAbsorb: true, surgeHarvest: true, absorbValue: 2 },
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result.slot0.resonantBonusGain, 2); // 2 * 1.0
});

// ── 5. Refraction ─────────────────────────────────────────────────────────
test('slot0 absorb — refraction fires when enabled and cooldown=0', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    UPG: { ...baseCtx().UPG, refraction: true, refractionCooldown: 0, refractionCount: 0 },
    GLOBAL_SPEED_LIFT: 1,
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.ok(result.slot0.refractionSpec, 'should produce refraction spec');
  assert.equal(result.slot0.newRefractionCount, 1);
  assert.equal(result.slot0.refractionCooldownReset, false);
});

test('slot0 absorb — refraction at count 3 produces spec + triggers reset', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    UPG: { ...baseCtx().UPG, refraction: true, refractionCooldown: 0, refractionCount: 3 },
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result.slot0.refractionSpec, 'should produce spec for count 3→4');
  assert.equal(result.slot0.refractionCooldownReset, true);
  assert.equal(result.slot0.newRefractionCount, 0);
});

test('slot0 absorb — refraction suppressed when cooldown > 0', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    UPG: { ...baseCtx().UPG, refraction: true, refractionCooldown: 500, refractionCount: 0 },
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result.slot0.refractionSpec, null);
});

test('slot0 absorb — bad refractionCount clamped, does not deadlock', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    UPG: { ...baseCtx().UPG, refraction: true, refractionCooldown: 0, refractionCount: 99 },
  });
  const result = detectGreyAbsorb(b, ctx);
  // clamped to 3, bumped to 4 → reset
  assert.equal(result.slot0.refractionCooldownReset, true);
  assert.equal(result.slot0.newRefractionCount, 0);
});

// ── 6. ChainMagnet ────────────────────────────────────────────────────────
test('slot0 absorb — chainMagnet tier 1 sets duration 700', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({ UPG: { ...baseCtx().UPG, chainMagnetTier: 1 } });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result.slot0.chainMagnetDuration, 700);
});

test('slot0 absorb — chainMagnet tier 3 sets duration 1400', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({ UPG: { ...baseCtx().UPG, chainMagnetTier: 3 } });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result.slot0.chainMagnetDuration, 1400); // 700 + (3-1)*350
});

// ── 7. Slot-1+ guest absorb ───────────────────────────────────────────────
function makeGuestSlot(overrides = {}) {
  return {
    body: { x: 400, y: 400, r: 14, deadAt: 0, ...overrides.body },
    metrics: { hp: 1, charge: 0, ...overrides.metrics },
    upg: { absorbRange: 11, maxCharge: 3, absorbValue: 1, ...overrides.upg },
  };
}

test('guest absorb — overlapNow triggers absorption', () => {
  const b = greyBullet({ x: 415, y: 400 }); // within guest absorbR(14+5+11=30) + br(6)
  const slot0 = makeGuestSlot({ body: { x: 9000, y: 9000 } }); // slot0 far away (won't absorb)
  const guest = makeGuestSlot({ body: { x: 400, y: 400 }, metrics: { hp: 1, charge: 1 } });
  const ctx = baseCtx({
    player: { x: 9000, y: 9000, r: 14, vx: 0, vy: 0 }, // slot-0 far away
    absorbR: 1, // tiny, so slot-0 path doesn't fire
    playerSlots: [slot0, guest],
    lagComp: null,
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result, 'should absorb');
  assert.equal(result.kind, 'guest');
  assert.equal(result.guest.slotIdx, 1);
  assert.equal(result.guest.newCharge, 2); // 1 + 1
});

test('guest absorb — charge capped at maxCharge', () => {
  const b = greyBullet({ x: 415, y: 400 });
  const guest = makeGuestSlot({
    body: { x: 400, y: 400 },
    metrics: { hp: 1, charge: 3 }, // already at max
    upg: { absorbRange: 11, maxCharge: 3, absorbValue: 5 },
  });
  const ctx = baseCtx({
    player: { x: 9000, y: 9000, r: 14, vx: 0, vy: 0 },
    absorbR: 1,
    playerSlots: [{}, guest],
    lagComp: null,
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.equal(result.guest.newCharge, 3); // capped
});

test('guest absorb — skips dead slot (deadAt > 0)', () => {
  const b = greyBullet({ x: 415, y: 400 });
  const deadGuest = makeGuestSlot({ body: { x: 400, y: 400, deadAt: 9999 } });
  const ctx = baseCtx({
    player: { x: 9000, y: 9000, r: 14, vx: 0, vy: 0 },
    absorbR: 1,
    playerSlots: [{}, deadGuest],
    lagComp: null,
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result, null, 'should not absorb dead slot');
});

test('guest absorb — lagComp historic hit triggers absorption', () => {
  const b = greyBullet({ x: 5000, y: 5000, id: 77 }); // bullet far NOW, was near historically
  const guest = makeGuestSlot({ body: { x: 400, y: 400 } });
  const mockLagComp = {
    wasNearHistoric: (id, tick, bx, by, r) => true, // always says "yes"
  };
  const ctx = baseCtx({
    player: { x: 0, y: 0, r: 14, vx: 0, vy: 0 }, // slot-0 far from bullet
    absorbR: 1, // tiny, so slot-0 can't catch bullet at (5000,5000)
    playerSlots: [{}, guest],
    simTick: 100,
    lagComp: mockLagComp,
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result, 'should absorb via lag comp');
  assert.equal(result.kind, 'guest');
});

test('guest absorb — lagComp null means no historic hit', () => {
  const b = greyBullet({ x: 5000, y: 5000 }); // far from player AND guest
  const guest = makeGuestSlot({ body: { x: 400, y: 400 } });
  const ctx = baseCtx({
    player: { x: 0, y: 0, r: 14, vx: 0, vy: 0 },
    absorbR: 1,
    playerSlots: [{}, guest],
    lagComp: null, // no lag comp
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result, null, 'no historic hit without lagComp');
});

// ── 8. Orb absorb ─────────────────────────────────────────────────────────
test('orb absorb — grey near orb slot is absorbed', () => {
  // getOrbitSlotPosition returns player + (60,0). Player at (200,200) → orb at (260,200).
  const b = greyBullet({ x: 265, y: 200 }); // within orbVisualRadius(12)+7+br(6)=25 of (260,200)
  const ctx = baseCtx({
    player: { x: 200, y: 200, r: 14, vx: 0, vy: 0 },
    absorbR: 1, // slot-0 won't fire
    playerSlots: [],
    UPG: { ...baseCtx().UPG, absorbOrbs: true, orbitSphereTier: 1, absorbValue: 1.5 },
    orbCooldowns: [0],
    orbitRadius: 60,
    orbVisualRadius: 12,
    getOrbitSlotPosition: ({ index, originX, originY }) => ({ x: originX + 60, y: originY, angle: 0 }),
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result, 'should absorb');
  assert.equal(result.kind, 'orb');
  assert.equal(result.orb.slotIdx, 0);
  assert.equal(result.orb.absorbGain, 1.5);
  assert.equal(result.effects[0].x, 260); // orb position
  assert.equal(result.effects[0].count, 4);
  assert.equal(result.effects[0].size, 40);
});

test('orb absorb — skips slot with cooldown > 0', () => {
  const b = greyBullet({ x: 265, y: 200 }); // near orb position
  const ctx = baseCtx({
    player: { x: 200, y: 200, r: 14, vx: 0, vy: 0 },
    absorbR: 1,
    playerSlots: [],
    UPG: { ...baseCtx().UPG, absorbOrbs: true, orbitSphereTier: 1, absorbValue: 1 },
    orbCooldowns: [1.0], // slot 0 is on cooldown
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result, null, 'on-cooldown orb should not absorb');
});

// ── 9. Priority: slot0 > guest > orb ─────────────────────────────────────
test('priority: slot0 absorb fires before guest path', () => {
  const b = greyBullet({ x: 210, y: 200 }); // near both slot0 (200,200) and set up guest
  const guest = makeGuestSlot({ body: { x: 210, y: 200 } });
  const ctx = baseCtx({
    player: { x: 200, y: 200, r: 14, vx: 0, vy: 0 },
    absorbR: 30, // slot-0 will catch it
    playerSlots: [{}, guest],
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.equal(result.kind, 'slot0');
});

test('priority: guest absorb fires before orb path', () => {
  const b = greyBullet({ x: 415, y: 400 }); // near guest but not near orb (260,200)
  const guest = makeGuestSlot({ body: { x: 400, y: 400 } });
  const ctx = baseCtx({
    player: { x: 9000, y: 9000, r: 14, vx: 0, vy: 0 },
    absorbR: 1,
    playerSlots: [{}, guest],
    UPG: { ...baseCtx().UPG, absorbOrbs: true, orbitSphereTier: 1, absorbValue: 1 },
    orbCooldowns: [0],
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.equal(result.kind, 'guest');
});

// ── 10. Spark positions ───────────────────────────────────────────────────
test('slot0 sparks at bullet position', () => {
  const b = greyBullet({ x: 222, y: 233 });
  const ctx = baseCtx({ player: { x: 222, y: 233, r: 14, vx: 0, vy: 0 }, absorbR: 30 });
  const result = detectGreyAbsorb(b, ctx);
  assert.ok(result);
  assert.equal(result.effects[0].x, 222);
  assert.equal(result.effects[0].y, 233);
});

test('orb sparks at orb position, not bullet position', () => {
  const b = greyBullet({ x: 265, y: 200 });
  const ctx = baseCtx({
    player: { x: 200, y: 200, r: 14, vx: 0, vy: 0 }, absorbR: 1,
    playerSlots: [],
    UPG: { ...baseCtx().UPG, absorbOrbs: true, orbitSphereTier: 1, absorbValue: 1 },
    orbCooldowns: [0],
  });
  const result = detectGreyAbsorb(b, ctx);
  assert.equal(result.effects[0].x, 260); // orb x
  assert.equal(result.effects[0].y, 200); // orb y
});

// ── 11. Determinism: same inputs → same outputs ───────────────────────────
test('determinism: identical calls return same result', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({
    UPG: { ...baseCtx().UPG, resonantAbsorb: true, chainMagnetTier: 2 },
    slot0Timers: { absorbComboCount: 1 },
  });
  const r1 = detectGreyAbsorb(b, { ...ctx });
  const r2 = detectGreyAbsorb(b, { ...ctx });
  assert.deepStrictEqual(r1, r2);
});

// ── 12. Purity: no mutations to bullet or ctx ─────────────────────────────
test('purity: bullet not mutated', () => {
  const b = greyBullet({ x: 210, y: 200 });
  const frozen = JSON.stringify(b);
  const ctx = baseCtx({ UPG: { ...baseCtx().UPG, refraction: true, refractionCooldown: 0 } });
  detectGreyAbsorb(b, ctx);
  assert.equal(JSON.stringify(b), frozen);
});

test('purity: slot0Timers not mutated', () => {
  const timers = { absorbComboCount: 2, absorbComboTimer: 0 };
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({ slot0Timers: timers, UPG: { ...baseCtx().UPG, resonantAbsorb: true } });
  detectGreyAbsorb(b, ctx);
  assert.equal(timers.absorbComboCount, 2, 'absorbComboCount not mutated');
});

test('purity: UPG not mutated', () => {
  const upg = { ...baseCtx().UPG, refraction: true, refractionCooldown: 0, refractionCount: 3 };
  const b = greyBullet({ x: 210, y: 200 });
  const ctx = baseCtx({ UPG: upg });
  detectGreyAbsorb(b, ctx);
  assert.equal(upg.refractionCount, 3, 'UPG.refractionCount not mutated');
  assert.equal(upg.refractionCooldown, 0, 'UPG.refractionCooldown not mutated');
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\nGrey absorb dispatch tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
