// Unit tests for detectBulletNearMiss (R0.4 step 4d).
import { detectBulletNearMiss } from '../src/systems/bulletRuntime.js';

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ok ', label); }
  else { fail++; console.log('  FAIL', label); }
}

const mkP = (x = 100, y = 100, r = 10, invincible = 0) => ({ x, y, r, invincible });
const mkRoom = () => ({ nearMisses: 0 });
const mkB = (overrides = {}) => ({ state: 'danger', x: 100, y: 100, r: 4, nearMissed: false, ...overrides });

// 1. null safety
ok('null bullet', detectBulletNearMiss(null, mkP(), mkRoom(), {}) === false);
ok('null player', detectBulletNearMiss(mkB(), null, mkRoom(), {}) === false);
ok('null room', detectBulletNearMiss(mkB(), mkP(), null, {}) === false);
ok('null opts tolerated', typeof detectBulletNearMiss(mkB({ x: 125 }), mkP(), mkRoom(), null) === 'boolean');

// 2. non-danger bullet skipped
{
  const room = mkRoom();
  const result = detectBulletNearMiss(mkB({ state: 'output', x: 125 }), mkP(), room, {});
  ok('output bullet skipped', !result && room.nearMisses === 0);
}

// 3. already nearMissed skipped
{
  const room = mkRoom();
  const result = detectBulletNearMiss(mkB({ nearMissed: true, x: 125 }), mkP(), room, {});
  ok('already-flagged bullet skipped', !result && room.nearMisses === 0);
}

// 4. player invincible skipped
{
  const room = mkRoom();
  const result = detectBulletNearMiss(mkB({ x: 125 }), mkP(100, 100, 10, 0.5), room, { playerInvincible: 0.5 });
  ok('invincible player skipped', !result && room.nearMisses === 0);
}

// 5. detection in band: outer = r*2.75 + b.r = 10*2.75 + 4 = 31.5; inner = r + b.r = 14
//    dist = 25 (between 14 and 31.5) => near-miss
{
  const room = mkRoom();
  const b = mkB({ x: 125 }); // dist = 25
  const result = detectBulletNearMiss(b, mkP(), room, {});
  ok('in-band: registers near-miss', result === true);
  ok('in-band: bullet flagged', b.nearMissed === true);
  ok('in-band: room counter incremented', room.nearMisses === 1);
}

// 6. inside inner band (collision range, not a near-miss)
{
  const room = mkRoom();
  const b = mkB({ x: 110 }); // dist = 10 < 14
  const result = detectBulletNearMiss(b, mkP(), room, {});
  ok('inside collision: not registered', !result && room.nearMisses === 0 && !b.nearMissed);
}

// 7. outside outer band
{
  const room = mkRoom();
  const b = mkB({ x: 200 }); // dist = 100 > 31.5
  const result = detectBulletNearMiss(b, mkP(), room, {});
  ok('outside outer: not registered', !result && room.nearMisses === 0);
}

// 8. exactly at inner boundary -> not registered (strict >)
{
  const room = mkRoom();
  const b = mkB({ x: 114 }); // dist = 14 = inner
  const result = detectBulletNearMiss(b, mkP(), room, {});
  ok('boundary at inner not registered (strict >)', !result);
}

// 9. exactly at outer boundary -> not registered (strict <)
{
  const room = mkRoom();
  const b = mkB({ x: 100 + 31.5 }); // dist = 31.5 = outer
  const result = detectBulletNearMiss(b, mkP(), room, {});
  ok('boundary at outer not registered (strict <)', !result);
}

// 10. existing room.nearMisses preserved and incremented
{
  const room = { nearMisses: 7 };
  detectBulletNearMiss(mkB({ x: 125 }), mkP(), room, {});
  ok('room counter increments existing value', room.nearMisses === 8);
}

// 11. missing nearMisses initializes correctly
{
  const room = {};
  detectBulletNearMiss(mkB({ x: 125 }), mkP(), room, {});
  ok('missing nearMisses initialized to 1', room.nearMisses === 1);
}

// 12. second call on same bullet does not double-count
{
  const room = mkRoom();
  const b = mkB({ x: 125 });
  detectBulletNearMiss(b, mkP(), room, {});
  detectBulletNearMiss(b, mkP(), room, {});
  ok('second call no double-count', room.nearMisses === 1);
}

// 13. custom outerScale honored
{
  const room = mkRoom();
  const b = mkB({ x: 100 + 50 }); // dist = 50, default outer = 31.5 (would not register)
  // outer with scale 6.0 = 10*6 + 4 = 64; dist=50 in band
  const result = detectBulletNearMiss(b, mkP(), room, { outerScale: 6.0 });
  ok('custom outerScale extends detection', result === true);
}

// 14. determinism: same inputs => same outcome
{
  const r1 = mkRoom(), r2 = mkRoom();
  const b1 = mkB({ x: 125 }), b2 = mkB({ x: 125 });
  detectBulletNearMiss(b1, mkP(), r1, {});
  detectBulletNearMiss(b2, mkP(), r2, {});
  ok('deterministic outcomes', b1.nearMissed === b2.nearMissed && r1.nearMisses === r2.nearMisses);
}

// 15. diagonal distance respected
{
  const room = mkRoom();
  // Player at (100,100), bullet at (118, 118) => dist = sqrt(648) ≈ 25.46, in band
  const b = mkB({ x: 118, y: 118 });
  const result = detectBulletNearMiss(b, mkP(), room, {});
  ok('diagonal in-band registers', result === true && room.nearMisses === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
