// D19.1 — bullet local-advance tests.
import {
  createBulletLocalAdvance,
  isPredictableBullet,
  PREDICTABLE_STATES,
  RECONCILE_HARD_SNAP_PX,
  RECONCILE_SOFT_THRESH_PX,
  RECONCILE_SOFT_FACTOR,
} from '../src/net/bulletLocalAdvance.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (err) { console.error('  ✗ ' + name + ' — ' + err.message); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function assertEq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function approx(a, b, eps, m) { if (!(Math.abs(a - b) <= (eps || 0.5))) throw new Error((m || 'approx') + ': expected ~' + b + ' got ' + a); }

const W = 800, H = 1200, M = 18;
const newPool = () => createBulletLocalAdvance({ wallMargin: M, getWorldSize: () => ({ w: W, h: H }) });

console.log('D19.1 — bullet local-advance');

test('predictable states gate', () => {
  assert(isPredictableBullet({ state: 'output' }));
  assert(isPredictableBullet({ state: 'danger' }));
  assert(!isPredictableBullet({ state: 'grey' }));
  assert(!isPredictableBullet({ state: 'charge' }));
  assert(!isPredictableBullet(null));
  assertEq(PREDICTABLE_STATES.size, 2);
});

test('threshold constants', () => {
  assertEq(RECONCILE_HARD_SNAP_PX, 24);
  assertEq(RECONCILE_SOFT_THRESH_PX, 6);
  approx(RECONCILE_SOFT_FACTOR, 0.30, 1e-6);
});

test('reconcile spawns first-sight bullet at aged-auth position', () => {
  const pool = newPool();
  // ticksElapsed = 0 → spawns at exact auth position
  pool.reconcile([{ id: 7, state: 'output', x: 100, y: 200, vx: 300, vy: 0, r: 6, ownerSlot: 0 }], 0);
  assertEq(pool.size(), 1);
  const b = pool.getBullets()[0];
  assertEq(b.id, 7);
  approx(b.x, 100); approx(b.y, 200);
  approx(b.vx, 300); approx(b.vy, 0);
  assertEq(b.state, 'output');
});

test('reconcile ages auth forward by ticksElapsed (no walls)', () => {
  const pool = newPool();
  // Center of map, moving right at 300 px/s. 6 ticks @ 1/60 = 0.1s = 30 px.
  pool.reconcile([{ id: 1, state: 'output', x: 400, y: 600, vx: 300, vy: 0, r: 6, ownerSlot: 0 }], 6);
  const b = pool.getBullets()[0];
  approx(b.x, 430, 0.5); approx(b.y, 600, 0.5);
});

test('linear advance produces expected position', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 400, y: 600, vx: 300, vy: 0, r: 6, ownerSlot: 0 }], 0);
  // Advance 0.1 s → 6 fixed ticks → 30 px
  pool.advance(0.1);
  const b = pool.getBullets()[0];
  approx(b.x, 430, 0.5); approx(b.y, 600, 0.5);
});

test('wall bounce at right wall', () => {
  const pool = newPool();
  // Place near right wall; advance enough to bounce once.
  pool.reconcile([{ id: 1, state: 'output', x: W - M - 10, y: 600, vx: 600, vy: 0, r: 6, ownerSlot: 0 }], 0);
  pool.advance(0.1); // 60 px of travel total
  const b = pool.getBullets()[0];
  assert(b.vx < 0, 'vx should be negative after bounce, got ' + b.vx);
  assert(b.x + b.r <= W - M + 1, 'x clamped inside right wall, got ' + b.x);
});

test('wall bounce at top, left, bottom walls', () => {
  // top
  let pool = newPool();
  pool.reconcile([{ id: 1, state: 'danger', x: 400, y: M + 10, vx: 0, vy: -600, r: 6, ownerSlot: 9 }], 0);
  pool.advance(0.1);
  let b = pool.getBullets()[0];
  assert(b.vy > 0 && b.y - b.r >= M - 0.5, 'top bounce failed');

  // left
  pool = newPool();
  pool.reconcile([{ id: 2, state: 'danger', x: M + 10, y: 600, vx: -600, vy: 0, r: 6, ownerSlot: 9 }], 0);
  pool.advance(0.1);
  b = pool.getBullets()[0];
  assert(b.vx > 0 && b.x - b.r >= M - 0.5, 'left bounce failed');

  // bottom
  pool = newPool();
  pool.reconcile([{ id: 3, state: 'danger', x: 400, y: H - M - 10, vx: 0, vy: 600, r: 6, ownerSlot: 9 }], 0);
  pool.advance(0.1);
  b = pool.getBullets()[0];
  assert(b.vy < 0 && b.y + b.r <= H - M + 0.5, 'bottom bounce failed');
});

test('hard snap when divergence > 24 px', () => {
  const pool = newPool();
  // Spawn locally at (100, 200)
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 200, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  // Now snapshot says it's at (200, 200) — 100 px divergence from local
  pool.reconcile([{ id: 1, state: 'output', x: 200, y: 200, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  const b = pool.getBullets()[0];
  approx(b.x, 200); approx(b.y, 200);
});

test('soft pull when divergence in [6, 24] px', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 200, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  // 10 px divergence → pull by 30% → 3 px
  pool.reconcile([{ id: 1, state: 'output', x: 110, y: 200, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  const b = pool.getBullets()[0];
  approx(b.x, 103, 0.5);
});

test('leave alone when divergence < 6 px', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 200, vx: 100, vy: 0, r: 6, ownerSlot: 0 }], 0);
  // 3 px divergence → leave x/y, refresh vx/vy
  pool.reconcile([{ id: 1, state: 'output', x: 103, y: 200, vx: 50, vy: 0, r: 6, ownerSlot: 0 }], 0);
  const b = pool.getBullets()[0];
  approx(b.x, 100); approx(b.y, 200);
  approx(b.vx, 50);
});

test('despawn when id missing from snapshot', () => {
  const pool = newPool();
  pool.reconcile([
    { id: 1, state: 'output', x: 100, y: 100, vx: 0, vy: 0, r: 6, ownerSlot: 0 },
    { id: 2, state: 'output', x: 200, y: 200, vx: 0, vy: 0, r: 6, ownerSlot: 0 },
  ], 0);
  assertEq(pool.size(), 2);
  // Next snapshot only has id 1
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 100, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  assertEq(pool.size(), 1);
  assert(pool.has(1));
  assert(!pool.has(2));
});

test('non-predictable states are not added to local pool', () => {
  const pool = newPool();
  pool.reconcile([
    { id: 1, state: 'grey', x: 100, y: 100, vx: 0, vy: 0, r: 6, ownerSlot: 0 },
    { id: 2, state: 'output', x: 200, y: 200, vx: 0, vy: 0, r: 6, ownerSlot: 0 },
  ], 0);
  assertEq(pool.size(), 1);
  assert(pool.has(2));
  assert(!pool.has(1));
});

test('clear empties the pool', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 100, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  assertEq(pool.size(), 1);
  pool.clear();
  assertEq(pool.size(), 0);
});

test('advance with dt=0 is a no-op', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 100, vx: 999, vy: 999, r: 6, ownerSlot: 0 }], 0);
  pool.advance(0);
  const b = pool.getBullets()[0];
  approx(b.x, 100); approx(b.y, 100);
});

test('advance accumulator handles small dts (sub-tick)', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 400, y: 600, vx: 600, vy: 0, r: 6, ownerSlot: 0 }], 0);
  // 30 frames of 1/120s each = 0.25s → 150 px
  for (let i = 0; i < 30; i++) pool.advance(1 / 120);
  const b = pool.getBullets()[0];
  approx(b.x, 550, 1.5);
});

test('advance caps catastrophic dt', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 400, y: 600, vx: 100, vy: 0, r: 6, ownerSlot: 0 }], 0);
  // 10s dt should cap at 0.25s = 25 px (not 1000 px)
  pool.advance(10);
  const b = pool.getBullets()[0];
  assert(b.x < 500, 'expected capped travel, got x=' + b.x);
});

test('getBullets returns fresh objects (caller mutation safe)', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 100, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  const out = pool.getBullets();
  out[0].x = 9999;
  const out2 = pool.getBullets();
  approx(out2[0].x, 100);
});

test('bullets carry __remote and __predicted flags for renderer', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'output', x: 100, y: 100, vx: 0, vy: 0, r: 6, ownerSlot: 0 }], 0);
  const b = pool.getBullets()[0];
  assertEq(b.__remote, true);
  assertEq(b.__predicted, true);
  assertEq(b.danger, false);
  assertEq(b.ownerId, 0);
});

test('danger bullet has danger=true', () => {
  const pool = newPool();
  pool.reconcile([{ id: 1, state: 'danger', x: 100, y: 100, vx: 0, vy: 0, r: 6, ownerSlot: 9 }], 0);
  const b = pool.getBullets()[0];
  assertEq(b.danger, true);
  assertEq(b.state, 'danger');
});

test('danger bullet render flags survive reconcile and getBullets', () => {
  const pool = newPool();
  pool.reconcile([{
    id: 1,
    state: 'danger',
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    r: 6,
    ownerSlot: 9,
    doubleBounce: true,
    bounceCount: 0,
    dangerBounceBudget: 1,
    eliteStage: 1,
    eliteColor: '#123456',
    eliteCore: '#abcdef',
    isTriangle: true,
  }], 0);
  const b = pool.getBullets()[0];
  assertEq(b.doubleBounce, true);
  assertEq(b.bounceCount, 0);
  assertEq(b.dangerBounceBudget, 1);
  assertEq(b.eliteStage, 1);
  assertEq(b.eliteColor, '#123456');
  assertEq(b.eliteCore, '#abcdef');
  assertEq(b.isTriangle, true);
});

test('throws without getWorldSize', () => {
  let threw = false;
  try { createBulletLocalAdvance({ wallMargin: 18 }); } catch (_) { threw = true; }
  assert(threw, 'should have thrown without getWorldSize');
});

console.log('\n  ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
