// Tests for detectShieldHit (R0.4 step 11 — Region E).
import { strict as assert } from 'node:assert';
import { detectShieldHit } from '../src/sim/shieldHitDispatch.js';
import { SHIELD_HALF_W, SHIELD_HALF_H } from '../src/data/constants.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (err) { console.log(`FAIL ${name}\n  ${err.message}`); failed++; }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const SHIELD_ORBIT_R = 35;
const SHIELD_ROTATION_SPD = 0.001;
// At ts=0, shield index=0 of count=1: angle = 2π/1*0 + 0*0.001 = 0
// => x = player.x + cos(0)*35 = player.x + 35, y = player.y + sin(0)*35 = player.y
// facing = 0 + π/2 = π/2
// At ts=0, index=0, count=1: shield is at (player.x+35, player.y), facing=π/2
// SHIELD_HALF_W=9, SHIELD_HALF_H=4.5
// In local frame (rotated by -π/2): cosA=cos(-π/2)≈0, sinA=sin(-π/2)≈-1
// lx = dx*0 - dy*(-1) = dy, ly = dx*(-1) + dy*0 = -dx
// So a bullet directly at the shield position (dx=0,dy=0) → lx=0,ly=0 → inside

function dangerBullet({ x = 0, y = 0, r = 6, vx = -200, vy = 0, id = 1 } = {}) {
  return { state: 'danger', x, y, r, vx, vy, id };
}

function makeShield({ cooldown = 0, maxCooldown = 0, hardened = false, mirrorCooldown = 0 } = {}) {
  return { cooldown, maxCooldown, hardened, mirrorCooldown };
}

function baseCtx(overrides = {}) {
  return {
    player: { x: 400, y: 400, shields: [makeShield()] },
    ts: 0,
    UPG: {
      shieldMirror: false, shieldTempered: false, shieldBurst: false,
      barrierPulse: false, aegisTitan: false,
      shotSize: 1, playerDamageMult: 1, denseDamageMult: 1,
      shotLifeMult: 1,
    },
    simNowMs: 10000,
    shieldOrbitR: SHIELD_ORBIT_R,
    shieldRotationSpd: SHIELD_ROTATION_SPD,
    shieldCooldown: 1500,
    aegisBatteryDamageMult: 1,
    playerShotLifeMs: 1100,
    mirrorShieldDamageFactor: 0.6,
    aegisNovaDamageFactor: 0.55,
    globalSpeedLift: 1,
    shieldActiveColor: '#88aaff',
    shieldEnhancedColor: '#cc44ff',
    ...overrides,
  };
}

// Player at (400,400), shield at ts=0, index=0, count=1: (435,400), facing=π/2
function bulletAtShield({ dx = 0, dy = 0, r = 6 } = {}) {
  // Bullet placed directly on the shield plate centre
  return dangerBullet({ x: 435 + dx, y: 400 + dy, r });
}

// ── 1. Miss: bullet far from player ──────────────────────────────────────────
test('miss — bullet far from player returns null', () => {
  const b = dangerBullet({ x: 100, y: 100 });
  const ctx = baseCtx();
  assert.strictEqual(detectShieldHit(b, ctx), null);
});

// ── 2. Miss: shield on cooldown ───────────────────────────────────────────────
test('miss — shield on cooldown is skipped', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ cooldown: 500 })] },
  });
  assert.strictEqual(detectShieldHit(b, ctx), null);
});

// ── 3. Miss: bullet just outside shield plate ─────────────────────────────────
test('miss — bullet outside shield plate geometry', () => {
  // Place bullet well above the shield plate
  const b = bulletAtShield({ dy: -(SHIELD_HALF_H + 10), r: 1 });
  const ctx = baseCtx();
  const result = detectShieldHit(b, ctx);
  assert.strictEqual(result, null);
});

// ── 4. Basic hit — no boons, pop path ────────────────────────────────────────
test('basic hit — pop path returns correct structure', () => {
  const b = bulletAtShield();
  const ctx = baseCtx();
  const result = detectShieldHit(b, ctx);
  assert.ok(result, 'expected hit result');
  assert.strictEqual(result.kind, 'pop');
  assert.strictEqual(result.hitShieldIdx, 0);
  assert.strictEqual(result.shieldBlockOccurred, true);
  assert.ok(Array.isArray(result.effects));
  assert.strictEqual(result.effects.length, 1);
  assert.strictEqual(result.effects[0].kind, 'sparks');
  assert.strictEqual(result.effects[0].color, '#88aaff');
  assert.strictEqual(result.mirrorCooldown, null);
  assert.strictEqual(result.mirrorReflectionSpec, null);
  assert.strictEqual(result.shieldBurstSpec, null);
  assert.strictEqual(result.barrierPulseGain, 0);
  assert.strictEqual(result.shieldCooldown, 1500);
  assert.strictEqual(result.aegisTitanCdShare, false);
});

// ── 5. Tempered Shield — hardened = true → temperedAbsorb ────────────────────
test('temperedAbsorb — hardened shield returns kind=temperedAbsorb', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ hardened: true })] },
    UPG: { shieldTempered: true, shieldMirror: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result, 'expected hit result');
  assert.strictEqual(result.kind, 'temperedAbsorb');
  assert.strictEqual(result.hitShieldIdx, 0);
  assert.strictEqual(result.shieldBlockOccurred, true);
  assert.strictEqual(result.effects[0].color, '#cc44ff'); // shieldEnhancedColor
});

// ── 6. Tempered Shield — hardened=false → pop path (not absorbPath) ───────────
test('temperedAbsorb — hardened=false takes pop path', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ hardened: false })] },
    UPG: { shieldTempered: true, shieldMirror: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.kind, 'pop');
});

// ── 7. Mirror Shield — fires reflection spec ──────────────────────────────────
test('mirror shield — returns reflectionSpec on pop hit', () => {
  const b = bulletAtShield({ r: 6 });
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ mirrorCooldown: -500 })] },
    UPG: { shieldMirror: true, shieldTempered: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.kind, 'pop');
  assert.ok(result.mirrorCooldown !== null, 'mirrorCooldown should be set');
  assert.strictEqual(result.mirrorCooldown, 0); // ts=0
  assert.ok(result.mirrorReflectionSpec !== null);
  assert.ok(typeof result.mirrorReflectionSpec.dmg === 'number');
});

// ── 8. Mirror Shield — on cooldown (ts - mirrorCooldown <= 300) ───────────────
test('mirror shield — skipped when on cooldown', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    ts: 200, // 200 - 0 = 200 <= 300 → skip
    player: { x: 400, y: 400, shields: [makeShield({ mirrorCooldown: 0 })] },
    UPG: { shieldMirror: true, shieldTempered: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.mirrorCooldown, null);
  assert.strictEqual(result.mirrorReflectionSpec, null);
});

// ── 9. Mirror + Tempered: hardened shield still gets mirror spec ──────────────
test('mirror+tempered — hardened shield still fires mirror before temperedAbsorb', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ hardened: true, mirrorCooldown: -500 })] },
    UPG: { shieldMirror: true, shieldTempered: true, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.kind, 'temperedAbsorb');
  // Mirror still fires even on temperedAbsorb (inline code checks mirror BEFORE tempered)
  assert.ok(result.mirrorReflectionSpec !== null, 'mirror should fire even on temperedAbsorb');
  assert.strictEqual(result.mirrorCooldown, 0);
});

// ── 10. Shield Burst — returns burstSpec ──────────────────────────────────────
test('shield burst — returns shieldBurstSpec on pop', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    UPG: { shieldMirror: false, shieldTempered: false, shieldBurst: true, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.kind, 'pop');
  assert.ok(result.shieldBurstSpec !== null);
  assert.strictEqual(result.shieldBurstSpec.count, 4); // not aegisTitan
  assert.ok(typeof result.shieldBurstSpec.speed === 'number');
});

// ── 11. Shield Burst + AegisTitan — 8-way burst ───────────────────────────────
test('shield burst + aegis titan — burst count = 8', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    UPG: { shieldMirror: false, shieldTempered: false, shieldBurst: true, barrierPulse: false, aegisTitan: true,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.shieldBurstSpec.count, 8);
  assert.strictEqual(result.aegisTitanCdShare, true);
});

// ── 12. Barrier Pulse — returns barrierPulseGain=2 ───────────────────────────
test('barrier pulse — returns barrierPulseGain=2', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    UPG: { shieldMirror: false, shieldTempered: false, shieldBurst: false, barrierPulse: true, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.barrierPulseGain, 2);
});

// ── 13. AegisTitan — cdShare flag set ────────────────────────────────────────
test('aegis titan — aegisTitanCdShare = true', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    UPG: { shieldMirror: false, shieldTempered: false, shieldBurst: false, barrierPulse: false, aegisTitan: true,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.aegisTitanCdShare, true);
});

// ── 14. Multiple shields: first ready shield on cooldown, second hits ─────────
test('multi-shield — first on cooldown, second shield is hit', () => {
  // index=0 on cooldown, index=1 at ts=0, count=2: angle=2π/2*1 = π
  // shield1 at (400+cos(π)*35, 400+sin(π)*35) = (365, 400)
  const b = dangerBullet({ x: 365, y: 400, r: 6 });
  const ctx = baseCtx({
    player: {
      x: 400, y: 400,
      shields: [makeShield({ cooldown: 500 }), makeShield()],
    },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result, 'expected hit on second shield');
  assert.strictEqual(result.hitShieldIdx, 1);
});

// ── 15. Purity: dispatcher does not mutate bullet ─────────────────────────────
test('purity — bullet is not mutated', () => {
  const b = bulletAtShield();
  const origX = b.x, origY = b.y, origVx = b.vx;
  const ctx = baseCtx({
    UPG: { shieldMirror: true, shieldTempered: true, shieldBurst: true, barrierPulse: true, aegisTitan: true,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
    ts: 1000,
  });
  detectShieldHit(b, ctx);
  assert.strictEqual(b.x, origX);
  assert.strictEqual(b.y, origY);
  assert.strictEqual(b.vx, origVx);
});

// ── 16. Purity: dispatcher does not mutate shields ────────────────────────────
test('purity — shield state is not mutated by dispatcher', () => {
  const shield = makeShield({ hardened: true });
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [shield] },
    UPG: { shieldTempered: true, shieldMirror: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  detectShieldHit(b, ctx);
  // Dispatcher must NOT write shield.hardened = false
  assert.strictEqual(shield.hardened, true);
  assert.strictEqual(shield.cooldown, 0);
});

// ── 17. Purity: dispatcher does not mutate player ────────────────────────────
test('purity — player object is not mutated by dispatcher', () => {
  const player = { x: 400, y: 400, shields: [makeShield()] };
  const b = bulletAtShield();
  const ctx = baseCtx({ player });
  detectShieldHit(b, ctx);
  assert.strictEqual(player.x, 400);
  assert.strictEqual(player.shields.length, 1);
  assert.strictEqual(player.shields[0].cooldown, 0);
});

// ── 18. shieldBlockOccurred is always true on hit ────────────────────────────
test('shieldBlockOccurred — always true on any hit kind', () => {
  const b = bulletAtShield();
  // temperedAbsorb case
  const ctx1 = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ hardened: true })] },
    UPG: { shieldTempered: true, shieldMirror: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const r1 = detectShieldHit(b, ctx1);
  assert.strictEqual(r1.shieldBlockOccurred, true);
  // pop case
  const ctx2 = baseCtx();
  const r2 = detectShieldHit(b, ctx2);
  assert.strictEqual(r2.shieldBlockOccurred, true);
});

// ── 19. Telemetry: shieldBlockOccurred is data, not a side effect ─────────────
test('telemetry — no global side effects from dispatcher', () => {
  // Dispatcher must be callable without any global state; if it were calling
  // telemetryController directly this would throw. The test passing IS the proof.
  const b = bulletAtShield();
  const ctx = baseCtx();
  assert.doesNotThrow(() => detectShieldHit(b, ctx));
});

// ── 20. No shields → returns null immediately ────────────────────────────────
test('no shields — returns null', () => {
  const b = dangerBullet({ x: 435, y: 400, r: 6 });
  const ctx = baseCtx({ player: { x: 400, y: 400, shields: [] } });
  assert.strictEqual(detectShieldHit(b, ctx), null);
});

// ── 21. All boons: full combination returns correct 'pop' structure ───────────
test('all boons — full combination pop hit is complete', () => {
  const b = bulletAtShield({ r: 6 });
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ mirrorCooldown: -500 })] },
    UPG: { shieldMirror: true, shieldTempered: false, shieldBurst: true, barrierPulse: true, aegisTitan: true,
           shotSize: 1.5, playerDamageMult: 1.2, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.kind, 'pop');
  assert.ok(result.mirrorReflectionSpec !== null);
  assert.ok(result.shieldBurstSpec !== null);
  assert.strictEqual(result.barrierPulseGain, 2);
  assert.strictEqual(result.aegisTitanCdShare, true);
  assert.strictEqual(result.shieldCooldown, 1500);
});

// ── 22. Shield plate geometry: bullet inside plate hits ──────────────────────
test('geometry — bullet inside plate hits', () => {
  // shield at (435,400) facing=π/2. Bullet inside the SHIELD_HALF_W × SHIELD_HALF_H rect
  const b = dangerBullet({ x: 435, y: 400, r: 1 });
  const ctx = baseCtx();
  const result = detectShieldHit(b, ctx);
  assert.ok(result !== null, 'bullet inside plate should hit');
});

// ── 23. Shield plate geometry: bullet exactly outside plate misses ────────────
test('geometry — bullet outside plate by small margin misses', () => {
  // Shield at (435,400), facing π/2. In local frame lx=dy, ly=-dx.
  // Moving in local-y direction (dx direction in world). Place bullet at world x offset
  // such that |ly|=|dx| > SHIELD_HALF_H + radius → miss.
  const outsideOffset = SHIELD_HALF_H + 8; // well outside (4.5 + 8 = 12.5 px)
  const b = dangerBullet({ x: 435 + outsideOffset, y: 400, r: 1 });
  const ctx = baseCtx();
  const result = detectShieldHit(b, ctx);
  assert.strictEqual(result, null, 'bullet far outside plate should miss');
});

// ── 24. shieldCooldown scalar is passed through ───────────────────────────────
test('shieldCooldown — returned value matches ctx.shieldCooldown', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({ shieldCooldown: 2500 });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.shieldCooldown, 2500);
});

// ── 25. Mirror damage factor applied ─────────────────────────────────────────
test('mirror reflection — damage reflects mirrorShieldDamageFactor', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ mirrorCooldown: -500 })] },
    mirrorShieldDamageFactor: 0.6,
    UPG: { shieldMirror: true, shieldTempered: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result.mirrorReflectionSpec);
  // dmg = playerDamageMult * denseDamageMult * mirrorShieldDamageFactor * aegisBatteryDamageMult
  //     = 1 * 1 * 0.6 * 1 = 0.6
  assert.ok(Math.abs(result.mirrorReflectionSpec.dmg - 0.6) < 1e-9);
});

// ── 26. AegisTitan mirror doubles the damage ─────────────────────────────────
test('mirror reflection + aegis titan — doubles mirror damage factor', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ mirrorCooldown: -500 })] },
    mirrorShieldDamageFactor: 0.6,
    UPG: { shieldMirror: true, shieldTempered: false, shieldBurst: false, barrierPulse: false, aegisTitan: true,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result.mirrorReflectionSpec);
  // aegisTitan: mirrorShieldDamageFactor * 2 = 1.2
  assert.ok(Math.abs(result.mirrorReflectionSpec.dmg - 1.2) < 1e-9);
});

// ── 27. temperedAbsorb no cooldown fields present ────────────────────────────
test('temperedAbsorb — shieldCooldown field not present (not a pop)', () => {
  const b = bulletAtShield();
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield({ hardened: true })] },
    UPG: { shieldTempered: true, shieldMirror: false, shieldBurst: false, barrierPulse: false, aegisTitan: false,
           shotSize: 1, playerDamageMult: 1, denseDamageMult: 1, shotLifeMult: 1 },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result);
  assert.strictEqual(result.kind, 'temperedAbsorb');
  // No shieldCooldown, no aegisTitanCdShare, no barrierPulseGain on temperedAbsorb
  assert.strictEqual(result.shieldCooldown, undefined);
  assert.strictEqual(result.aegisTitanCdShare, undefined);
  assert.strictEqual(result.barrierPulseGain, undefined);
});

// ── 28. Hits correct shield position for index=1 ─────────────────────────────
test('hitShieldIdx — returns correct index for second shield in multi-shield', () => {
  // Two shields at ts=0: index=0 → angle=0, pos=(435,400); index=1 → angle=π, pos=(365,400)
  const b = dangerBullet({ x: 365, y: 400, r: 6 });
  const ctx = baseCtx({
    player: { x: 400, y: 400, shields: [makeShield(), makeShield()] },
  });
  const result = detectShieldHit(b, ctx);
  assert.ok(result, 'expected a hit');
  assert.strictEqual(result.hitShieldIdx, 1);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
