#!/usr/bin/env node
// Phase C2b — Bullet ownership attribution contract.
// Verifies:
//  - createOutputBullet defaults ownerId to 0 and accepts explicit ownerId
//  - pushOutputBullet forwards ownerId onto the bullet pushed into the array
//  - buildPlayerVolleySpecs emits ownerId on every spec when provided
//  - spawnRadialOutputBurst stamps ownerId on every radial bullet
//  - spawnSplitOutputBullets inherits ownerId from its sourceBullet
//
// Attribution is used by C2d for damage-number coloring and (eventually)
// co-op kill-credit. It is NOT used for collision/friendly-fire today —
// player output bullets never collide with players, which is the reason
// the earlier rubber-duck critique flagged "ownerId is attribution only".

import assert from 'node:assert/strict';
import {
  createOutputBullet,
  pushOutputBullet,
  spawnRadialOutputBurst,
  spawnSplitOutputBullets,
} from '../src/entities/playerProjectiles.js';
import { buildPlayerVolleySpecs, buildPlayerShotPlan } from '../src/entities/playerFire.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); passed++; }
  catch (e) { console.error('FAIL', name, '\n  ', e.message); failed++; }
}

test('createOutputBullet defaults ownerId to 0', () => {
  const b = createOutputBullet({ x: 0, y: 0, vx: 1, vy: 0, radius: 4 });
  assert.equal(b.ownerId, 0);
});

test('createOutputBullet accepts explicit ownerId', () => {
  const b = createOutputBullet({ x: 0, y: 0, vx: 1, vy: 0, radius: 4, ownerId: 1 });
  assert.equal(b.ownerId, 1);
});

test('pushOutputBullet forwards ownerId onto bullets array', () => {
  const bullets = [];
  pushOutputBullet({ bullets, x: 0, y: 0, vx: 1, vy: 0, radius: 4, ownerId: 7 });
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].ownerId, 7);
});

test('buildPlayerVolleySpecs stamps ownerId on every spec', () => {
  const shots = buildPlayerShotPlan({
    tx: 100, ty: 0,
    player: { x: 0, y: 0 },
    upg: { forwardShotTier: 0, shotSize: 1 },
  });
  const specs = buildPlayerVolleySpecs({
    shots,
    availableShots: shots.length,
    player: { x: 0, y: 0 },
    upg: { critChance: 0 },
    bulletSpeed: 200,
    baseRadius: 4,
    baseDamage: 10,
    lifeMs: 800,
    now: 0,
    ownerId: 1,
    random: () => 0.5,
  });
  assert.ok(specs.length > 0);
  for(const s of specs) assert.equal(s.ownerId, 1, 'volley spec must carry ownerId');
});

test('buildPlayerVolleySpecs defaults ownerId to 0 when unspecified', () => {
  const shots = buildPlayerShotPlan({
    tx: 100, ty: 0,
    player: { x: 0, y: 0 },
    upg: { forwardShotTier: 0, shotSize: 1 },
  });
  const specs = buildPlayerVolleySpecs({
    shots, availableShots: 1,
    player: { x: 0, y: 0 },
    upg: { critChance: 0 },
    bulletSpeed: 200, baseRadius: 4, baseDamage: 10, lifeMs: 800, now: 0,
    random: () => 0.5,
  });
  assert.equal(specs[0].ownerId, 0);
});

test('spawnRadialOutputBurst stamps ownerId on every bullet', () => {
  const bullets = [];
  spawnRadialOutputBurst({
    bullets,
    x: 0, y: 0,
    count: 6,
    speed: 100,
    radius: 4,
    dmg: 10,
    expireAt: 1000,
    ownerId: 1,
  });
  assert.equal(bullets.length, 6);
  for(const b of bullets) assert.equal(b.ownerId, 1);
});

test('spawnSplitOutputBullets inherits ownerId from source', () => {
  const bullets = [];
  const source = {
    x: 0, y: 0, vx: 100, vy: 0, r: 4,
    pierceLeft: 0, homing: false, crit: false, dmg: 10,
    ownerId: 1,
  };
  spawnSplitOutputBullets({
    bullets,
    sourceBullet: source,
    splitDeltas: [-0.2, 0.2],
    damageFactor: 0.6,
    expireAt: 1000,
  });
  assert.equal(bullets.length, 2);
  for(const b of bullets) assert.equal(b.ownerId, 1);
});

test('split bullets default to owner 0 when source missing ownerId', () => {
  const bullets = [];
  const source = { x: 0, y: 0, vx: 100, vy: 0, r: 4, pierceLeft: 0, homing: false, crit: false, dmg: 10 };
  spawnSplitOutputBullets({
    bullets, sourceBullet: source, splitDeltas: [0], damageFactor: 1, expireAt: 1000,
  });
  assert.equal(bullets[0].ownerId, 0);
});

console.log(`\nOwnership suite: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
