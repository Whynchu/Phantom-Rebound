// D19.5 — partner cosmetic sync (shields + orb spheres) wire schema tests.
import { encodeSnapshot, decodeSnapshot } from '../src/net/coopSnapshot.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (err) { console.error('  ✗ ' + name + ' — ' + err.message); failed++; }
}
function assertEq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }

console.log('D19.5 — snapshot shield/orb cosmetic sync');

const RID = 'run-d195';
function baseSlot(extra) {
  return Object.assign({
    id: 0, x: 100, y: 100, vx: 0, vy: 0,
    hp: 5, maxHp: 5, charge: 0, maxCharge: 1,
    aimAngle: 0, invulnT: 0, shieldT: 0, stillTimer: 0, alive: true,
  }, extra || {});
}
function snap(slot) {
  return { runId: RID, snapshotSeq: 1, snapshotSimTick: 1, slots: [slot], bullets: [], enemies: [] };
}

test('encode: shieldCount/masks/orbCount round-trip', () => {
  const enc = encodeSnapshot(snap(baseSlot({
    shieldCount: 3,
    shieldHardenedMask: 0b101,
    shieldCooldownMask: 0b010,
    orbCount: 2,
  })));
  const s = enc.slots[0];
  assertEq(s.shieldCount, 3, 'shieldCount');
  assertEq(s.shieldHardenedMask, 0b101, 'shieldHardenedMask');
  assertEq(s.shieldCooldownMask, 0b010, 'shieldCooldownMask');
  assertEq(s.orbCount, 2, 'orbCount');
});

test('encode: missing fields default to 0 (backward-compat)', () => {
  const enc = encodeSnapshot(snap(baseSlot()));
  const s = enc.slots[0];
  assertEq(s.shieldCount, 0);
  assertEq(s.shieldHardenedMask, 0);
  assertEq(s.shieldCooldownMask, 0);
  assertEq(s.orbCount, 0);
});

test('decode: round-trip preserves cosmetic fields', () => {
  const enc = encodeSnapshot(snap(baseSlot({
    shieldCount: 5, shieldHardenedMask: 0b11111, shieldCooldownMask: 0, orbCount: 4,
  })));
  const dec = decodeSnapshot(enc);
  const s = dec.slots[0];
  assertEq(s.shieldCount, 5);
  assertEq(s.shieldHardenedMask, 0b11111);
  assertEq(s.shieldCooldownMask, 0);
  assertEq(s.orbCount, 4);
});

test('encode: rejects negative shieldCount', () => {
  let threw = false;
  try { encodeSnapshot(snap(baseSlot({ shieldCount: -1 }))); } catch (_) { threw = true; }
  if (!threw) throw new Error('expected throw on negative shieldCount');
});

test('encode: zero counts with non-zero masks still pass through', () => {
  // Defensive: even if host packs a stale mask with count=0, decode shouldn't
  // throw; the renderer iterates [0..count) so extra mask bits are inert.
  const enc = encodeSnapshot(snap(baseSlot({
    shieldCount: 0, shieldHardenedMask: 0xff, shieldCooldownMask: 0xff, orbCount: 0,
  })));
  const s = enc.slots[0];
  assertEq(s.shieldCount, 0);
  assertEq(s.shieldHardenedMask, 0xff);
  assertEq(s.orbCount, 0);
});

test('multi-slot: each slot carries its own cosmetic state', () => {
  const enc = encodeSnapshot({
    runId: RID, snapshotSeq: 1, snapshotSimTick: 1,
    slots: [
      baseSlot({ id: 0, shieldCount: 2, orbCount: 0 }),
      baseSlot({ id: 1, shieldCount: 0, orbCount: 3 }),
    ],
    bullets: [], enemies: [],
  });
  assertEq(enc.slots[0].shieldCount, 2);
  assertEq(enc.slots[0].orbCount, 0);
  assertEq(enc.slots[1].shieldCount, 0);
  assertEq(enc.slots[1].orbCount, 3);
});

console.log('\n' + (failed === 0 ? '✅' : '❌') + ' ' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed === 0 ? 0 : 1);
