#!/usr/bin/env node
// D19.4 — bullet spawn detector tests.

import { createBulletSpawnDetector } from '../src/net/bulletSpawnDetector.js';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond) {
  if (cond) { pass++; return; }
  fail++; failures.push(name); console.error('  FAIL:', name);
}

// 1. First sighting returns the bullet; second call doesn't re-fire.
{
  const d = createBulletSpawnDetector({ ttlTicks: 60 });
  const b = { id: 100, x: 1, y: 1, ownerSlot: 0, state: 'output' };
  const fresh1 = d.detectNewSpawns([b], 0);
  ok('first sighting → fresh array length 1', fresh1.length === 1 && fresh1[0].id === 100);
  const fresh2 = d.detectNewSpawns([b], 1);
  ok('second sighting → fresh array empty', fresh2.length === 0);
}

// 2. Multiple new bullets in same snapshot all returned.
{
  const d = createBulletSpawnDetector({});
  const arr = [
    { id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }, { id: 3, x: 0, y: 0 },
  ];
  const fresh = d.detectNewSpawns(arr, 5);
  ok('three new ids → all three returned', fresh.length === 3);
  ok('size tracks all 3', d.size() === 3);
}

// 3. Mixed old + new returns only new.
{
  const d = createBulletSpawnDetector({});
  d.detectNewSpawns([{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }], 0);
  const fresh = d.detectNewSpawns([
    { id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }, { id: 3, x: 0, y: 0 },
  ], 1);
  ok('mixed → only id 3 returned', fresh.length === 1 && fresh[0].id === 3);
}

// 4. Bullets with null/missing id are skipped.
{
  const d = createBulletSpawnDetector({});
  const fresh = d.detectNewSpawns([
    { id: 1 }, { id: null }, null, { /* no id */ }, { id: 2 },
  ], 0);
  ok('null/missing ids skipped', fresh.length === 2);
}

// 5. ttlTicks eviction allows id to re-fire after gap.
{
  const d = createBulletSpawnDetector({ ttlTicks: 10 });
  d.detectNewSpawns([{ id: 99, x: 0, y: 0 }], 0);
  ok('size 1 after first see', d.size() === 1);
  // Advance 11 ticks without seeing id 99 → eviction.
  d.detectNewSpawns([], 11);
  ok('size 0 after ttl eviction', d.size() === 0);
  const fresh = d.detectNewSpawns([{ id: 99, x: 0, y: 0 }], 12);
  ok('post-eviction reappearance fires again', fresh.length === 1);
}

// 6. Refresh prevents eviction while bullet is alive.
{
  const d = createBulletSpawnDetector({ ttlTicks: 5 });
  d.detectNewSpawns([{ id: 7 }], 0);
  for (let t = 1; t < 20; t++) d.detectNewSpawns([{ id: 7 }], t);
  ok('long-lived id still tracked at t=19', d.size() === 1);
}

// 7. clear() empties tracker.
{
  const d = createBulletSpawnDetector({});
  d.detectNewSpawns([{ id: 1 }, { id: 2 }], 0);
  d.clear();
  ok('clear → size 0', d.size() === 0);
}

// 8. Non-array input safe.
{
  const d = createBulletSpawnDetector({});
  ok('null input returns []', d.detectNewSpawns(null, 0).length === 0);
  ok('undefined input returns []', d.detectNewSpawns(undefined, 0).length === 0);
}

// 9. markSeen suppresses without emitting.
{
  const d = createBulletSpawnDetector({});
  d.markSeen(42, 0);
  const fresh = d.detectNewSpawns([{ id: 42 }], 1);
  ok('markSeen suppresses subsequent fresh detection', fresh.length === 0);
}

console.log(`\nBullet spawn detector tests: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.error('Failures:', failures); process.exit(1); }
process.exit(0);
