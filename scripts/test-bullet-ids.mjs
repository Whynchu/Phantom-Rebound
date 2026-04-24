// Phase D4b — bullet IDs tests.
import {
  nextHostBulletId,
  nextGuestBulletId,
  resetBulletIds,
  isPredictedBulletId,
  isAuthoritativeBulletId,
  peekBulletIdCounters,
} from '../src/entities/bulletIds.js';
import { spawnEnemyBullet, spawnEliteBullet } from '../src/entities/projectiles.js';
import { pushOutputBullet, pushGreyBullet } from '../src/entities/playerProjectiles.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { resetBulletIds(); fn(); console.log('  ✓ ' + name); passed++; }
  catch (err) { console.error('  ✗ ' + name + ' — ' + err.message); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function assertEq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }

console.log('D4b — bullet IDs');

test('host IDs are monotonic starting at 1', () => {
  assertEq(nextHostBulletId(), 1);
  assertEq(nextHostBulletId(), 2);
  assertEq(nextHostBulletId(), 3);
});

test('guest IDs are monotonic negative starting at -1', () => {
  assertEq(nextGuestBulletId(), -1);
  assertEq(nextGuestBulletId(), -2);
  assertEq(nextGuestBulletId(), -3);
});

test('host and guest counters are independent', () => {
  assertEq(nextHostBulletId(), 1);
  assertEq(nextGuestBulletId(), -1);
  assertEq(nextHostBulletId(), 2);
  assertEq(nextGuestBulletId(), -2);
});

test('resetBulletIds clears both counters', () => {
  nextHostBulletId(); nextHostBulletId();
  nextGuestBulletId(); nextGuestBulletId();
  resetBulletIds();
  assertEq(peekBulletIdCounters().host, 0);
  assertEq(peekBulletIdCounters().guest, 0);
  assertEq(nextHostBulletId(), 1, 'reset → next starts at 1');
  assertEq(nextGuestBulletId(), -1, 'reset → guest next starts at -1');
});

test('isPredictedBulletId / isAuthoritativeBulletId classify correctly', () => {
  assert(isAuthoritativeBulletId(1));
  assert(isAuthoritativeBulletId(0xffffffff));
  assert(!isAuthoritativeBulletId(0));
  assert(!isAuthoritativeBulletId(-1));
  assert(isPredictedBulletId(-1));
  assert(isPredictedBulletId(-999));
  assert(!isPredictedBulletId(0));
  assert(!isPredictedBulletId(5));
  // Non-number inputs
  assert(!isPredictedBulletId(null));
  assert(!isAuthoritativeBulletId('1'));
});

// ── Integration with spawn helpers ────────────────────────────────────────────

test('spawnEnemyBullet assigns a positive host id', () => {
  const bullets = [];
  spawnEnemyBullet({ bullets, x: 10, y: 20, angle: 0, speed: 100 });
  assertEq(bullets.length, 1);
  assert(isAuthoritativeBulletId(bullets[0].id), 'enemy bullet gets host id');
});

test('spawnEliteBullet assigns a positive host id', () => {
  const bullets = [];
  const palette = () => ({ elite: { hex: '#e00', light: [255, 0, 0] }, advanced: { hex: '#a00', light: [200, 0, 0] }, danger: { hex: '#900', light: [150, 0, 0] } });
  const getRgba = (rgb, a) => 'rgba(' + rgb.join(',') + ',' + a + ')';
  spawnEliteBullet({ bullets, x: 0, y: 0, angle: 0, speed: 100, getThreatPalette: palette, getRgba });
  assertEq(bullets.length, 1);
  assert(isAuthoritativeBulletId(bullets[0].id));
});

test('pushOutputBullet assigns a positive host id', () => {
  const bullets = [];
  pushOutputBullet({ bullets, x: 0, y: 0, vx: 1, vy: 0, radius: 4 });
  assertEq(bullets.length, 1);
  assert(isAuthoritativeBulletId(bullets[0].id));
});

test('pushGreyBullet assigns a positive host id', () => {
  const bullets = [];
  pushGreyBullet({ bullets, x: 0, y: 0, vx: 0, vy: 0, decayStart: 0 });
  assertEq(bullets.length, 1);
  assert(isAuthoritativeBulletId(bullets[0].id));
});

test('IDs are unique across mixed enemy + player spawns', () => {
  const bullets = [];
  const palette = () => ({ elite: { hex: '#e00', light: [255, 0, 0] }, advanced: { hex: '#a00', light: [200, 0, 0] }, danger: { hex: '#900', light: [150, 0, 0] } });
  const getRgba = (rgb, a) => 'rgba(' + rgb.join(',') + ',' + a + ')';
  spawnEnemyBullet({ bullets, x: 0, y: 0, angle: 0, speed: 100 });
  pushOutputBullet({ bullets, x: 0, y: 0, vx: 1, vy: 0, radius: 4 });
  spawnEliteBullet({ bullets, x: 0, y: 0, angle: 0, speed: 100, getThreatPalette: palette, getRgba });
  pushGreyBullet({ bullets, x: 0, y: 0, vx: 0, vy: 0, decayStart: 0 });

  const ids = new Set(bullets.map((b) => b.id));
  assertEq(ids.size, 4, 'all IDs distinct');
  for (const b of bullets) assert(isAuthoritativeBulletId(b.id));
});

test('IDs preserve spawn order (monotonic)', () => {
  const bullets = [];
  for (let i = 0; i < 5; i++) {
    pushOutputBullet({ bullets, x: i, y: 0, vx: 1, vy: 0, radius: 4 });
  }
  for (let i = 0; i < bullets.length - 1; i++) {
    assert(bullets[i].id < bullets[i + 1].id, 'id[' + i + '] < id[' + (i + 1) + ']');
  }
});

test('post-reset IDs restart from 1 (determinism canary contract)', () => {
  const bulletsA = [];
  for (let i = 0; i < 3; i++) pushOutputBullet({ bullets: bulletsA, x: 0, y: 0, vx: 1, vy: 0, radius: 4 });
  const firstRun = bulletsA.map((b) => b.id);

  resetBulletIds();

  const bulletsB = [];
  for (let i = 0; i < 3; i++) pushOutputBullet({ bullets: bulletsB, x: 0, y: 0, vx: 1, vy: 0, radius: 4 });
  const secondRun = bulletsB.map((b) => b.id);

  assertEq(JSON.stringify(firstRun), JSON.stringify(secondRun), 'two fresh runs produce identical ID sequence');
});

console.log();
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
