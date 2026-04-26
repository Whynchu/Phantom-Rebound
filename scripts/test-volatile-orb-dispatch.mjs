// R0.4 step 7 — volatileOrbDispatch tests.
import assert from 'assert';
import { detectVolatileOrbHit } from '../src/sim/volatileOrbDispatch.js';

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label}`); fail++; }
}

function ctx(over = {}) {
  return {
    orbCooldowns: [0, 0, 0],
    orbitSphereTier: 3,
    ts: 0,
    rotationSpeed: 0,
    radius: 50,
    originX: 200,
    originY: 200,
    orbHitRadius: 7,
    sparksColor: '#0f0',
    sparksCount: 10,
    sparksSize: 80,
    orbCooldownValue: 8,
    globalCooldownValue: 1,
    ...over,
  };
}

console.log('\n=== volatileOrbDispatch tests ===\n');

// With ts=0, rotationSpeed=0: orb 0 is at angle 0 → (originX+50, originY) = (250, 200)
// orb 1 at 120° → (200+50*cos(2π/3), 200+50*sin(2π/3)) ≈ (175, 243.3)
// orb 2 at 240° → (175, 156.7)

// Hit on orb 0
{
  const b = { x: 250, y: 200, r: 4 };
  const r = detectVolatileOrbHit(b, ctx());
  ok('hit: hitIndex=0', r.hitIndex === 0);
  ok('hit: removeSourceBullet=true', r.removeSourceBullet === true);
  ok('hit: skipRestOfFrame=true', r.skipRestOfFrame === true);
  ok('hit: 1 sparks effect', r.effects.length === 1 && r.effects[0].kind === 'sparks');
  ok('hit: sparks at orb pos', r.effects[0].x === 250 && r.effects[0].y === 200);
  ok('hit: cooldown values returned', r.orbCooldownValue === 8 && r.globalCooldownValue === 1);
  ok('hit: sx/sy match', r.sx === 250 && r.sy === 200);
}

// Miss (bullet far from any orb)
{
  const b = { x: 0, y: 0, r: 4 };
  const r = detectVolatileOrbHit(b, ctx());
  ok('miss: hitIndex=-1', r.hitIndex === -1);
  ok('miss: no remove', r.removeSourceBullet === false);
  ok('miss: no skip', r.skipRestOfFrame === false);
  ok('miss: empty effects', r.effects.length === 0);
}

// Skip cooldown'd orb, hit next one
{
  // Place bullet at orb 1 position. Mark orb 0 as on-cooldown (irrelevant
  // for orb 1 detection but verifies skipping doesn't break iteration).
  // Use ts/rotation to keep angles simple.
  const angle = (Math.PI * 2) / 3;
  const b = { x: 200 + Math.cos(angle) * 50, y: 200 + Math.sin(angle) * 50, r: 4 };
  const r = detectVolatileOrbHit(b, ctx({ orbCooldowns: [5, 0, 0] }));
  ok('cooldown: hits orb 1 not 0', r.hitIndex === 1);
}

// All orbs on cooldown → miss
{
  const b = { x: 250, y: 200, r: 4 };
  const r = detectVolatileOrbHit(b, ctx({ orbCooldowns: [5, 5, 5] }));
  ok('all-cooldown: hitIndex=-1', r.hitIndex === -1);
  ok('all-cooldown: no remove', r.removeSourceBullet === false);
}

// First-hit-wins: bullet at orb 0 with all orbs at cooldown 0 returns orb 0
{
  const b = { x: 250, y: 200, r: 4 };
  const r = detectVolatileOrbHit(b, ctx());
  ok('first-hit-wins: orb 0 matches before iterating further', r.hitIndex === 0);
}

// Tier=0 → no iteration → miss
{
  const b = { x: 250, y: 200, r: 4 };
  const r = detectVolatileOrbHit(b, ctx({ orbitSphereTier: 0 }));
  ok('tier=0: miss', r.hitIndex === -1);
}

// Bullet radius extends collision (bullet just outside orb at hit radius)
{
  const orbX = 250, orbY = 200;
  const orbHitR = 7, bulletR = 5;
  // Place bullet at distance just under (orbHitR + bulletR) = 12
  const b = { x: orbX + 11.9, y: orbY, r: bulletR };
  const r = detectVolatileOrbHit(b, ctx());
  ok('bullet-radius: hit at distance < orbHitR + bullet.r', r.hitIndex === 0);
}
{
  const orbX = 250, orbY = 200;
  const orbHitR = 7, bulletR = 5;
  // Place bullet at distance just over (orbHitR + bulletR)
  const b = { x: orbX + 12.1, y: orbY, r: bulletR };
  const r = detectVolatileOrbHit(b, ctx());
  ok('bullet-radius: miss at distance > orbHitR + bullet.r', r.hitIndex === -1);
}

// Determinism: same input → JSON-identical
{
  const b1 = { x: 250, y: 200, r: 4 };
  const b2 = { x: 250, y: 200, r: 4 };
  const r1 = detectVolatileOrbHit(b1, ctx());
  const r2 = detectVolatileOrbHit(b2, ctx());
  ok('determinism: identical results',
    JSON.stringify(r1) === JSON.stringify(r2));
}

// Rotation respected (ts*rotationSpeed shifts orb 0)
{
  // After ts=1000ms with rotationSpeed=0.003 rad/ms, angle = 3 rad
  const ts = 1000, rs = 0.003;
  const angle = ts * rs;
  const orb0x = 200 + Math.cos(angle) * 50;
  const orb0y = 200 + Math.sin(angle) * 50;
  const b = { x: orb0x, y: orb0y, r: 4 };
  const r = detectVolatileOrbHit(b, ctx({ ts, rotationSpeed: rs }));
  ok('rotation: orb position rotates with ts*rotationSpeed', r.hitIndex === 0);
}

// No mutation of orbCooldowns (pure)
{
  const cd = [0, 0, 0];
  const cdCopy = [...cd];
  const b = { x: 250, y: 200, r: 4 };
  detectVolatileOrbHit(b, ctx({ orbCooldowns: cd }));
  ok('purity: orbCooldowns NOT mutated by detector',
    cd[0] === cdCopy[0] && cd[1] === cdCopy[1] && cd[2] === cdCopy[2]);
}

console.log(`\nvolatileOrbDispatch: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
