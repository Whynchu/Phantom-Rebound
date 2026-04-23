import { simRng } from '../systems/seededRng.js';

function clampEnemyToArena(enemy, width, height, margin) {
  enemy.x = Math.max(margin + enemy.r, Math.min(width - margin - enemy.r, enemy.x));
  enemy.y = Math.max(margin + enemy.r, Math.min(height - margin - enemy.r, enemy.y));
}

function segmentIntersectsExpandedRect(x1, y1, x2, y2, rect, expand = 0) {
  const minX = rect.x - expand;
  const maxX = rect.x + rect.w + expand;
  const minY = rect.y - expand;
  const maxY = rect.y + rect.h + expand;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  const clip = (p, q) => {
    if(Math.abs(p) < 1e-6) return q >= 0;
    const r = q / p;
    if(p < 0) {
      if(r > t1) return false;
      if(r > t0) t0 = r;
      return true;
    }
    if(r < t0) return false;
    if(r < t1) t1 = r;
    return true;
  };

  return clip(-dx, x1 - minX)
    && clip(dx, maxX - x1)
    && clip(-dy, y1 - minY)
    && clip(dy, maxY - y1);
}

function hasLineOfSightToPlayer(enemy, player, obstacles = []) {
  if(!obstacles?.length) return true;
  for(const obstacle of obstacles) {
    if(segmentIntersectsExpandedRect(enemy.x, enemy.y, player.x, player.y, obstacle, Math.min(4, enemy.r * 0.35))) {
      return false;
    }
  }
  return true;
}

function hasLineOfSightBetweenPoints(ax, ay, bx, by, obstacles = [], expand = 4) {
  if(!obstacles?.length) return true;
  for(const obstacle of obstacles) {
    if(segmentIntersectsExpandedRect(ax, ay, bx, by, obstacle, expand)) return false;
  }
  return true;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getObstacleSteeringVector(enemy, {
  obstacles = [],
  influenceRadius = 56,
} = {}) {
  if(!obstacles.length) return { x: 0, y: 0 };
  let pushX = 0;
  let pushY = 0;
  for(const obstacle of obstacles) {
    const nearestX = Math.max(obstacle.x, Math.min(enemy.x, obstacle.x + obstacle.w));
    const nearestY = Math.max(obstacle.y, Math.min(enemy.y, obstacle.y + obstacle.h));
    const dx = enemy.x - nearestX;
    const dy = enemy.y - nearestY;
    const dist = Math.hypot(dx, dy);
    if(dist <= 0.0001 || dist >= influenceRadius) continue;
    const weight = (influenceRadius - dist) / influenceRadius;
    pushX += (dx / dist) * weight;
    pushY += (dy / dist) * weight;
  }
  const pushLen = Math.hypot(pushX, pushY);
  if(pushLen <= 0.0001) return { x: 0, y: 0 };
  return { x: pushX / pushLen, y: pushY / pushLen };
}

function moveEnemyWithIntent(enemy, intentX, intentY, speed, dt, speedScale = 1) {
  const intentLen = Math.hypot(intentX, intentY);
  if(intentLen <= 0.0001 || speed <= 0 || dt <= 0) return;
  const moveSpeed = speed * Math.max(0, speedScale) * dt;
  enemy.x += (intentX / intentLen) * moveSpeed;
  enemy.y += (intentY / intentLen) * moveSpeed;
}

function getStableMovementSide(enemy, key, ts, preferredSide, holdMs = 720) {
  const sideKey = `${key}Side`;
  const untilKey = `${key}SideUntil`;
  if(enemy[untilKey] > ts && enemy[sideKey]) return enemy[sideKey];
  enemy[sideKey] = preferredSide || 1;
  enemy[untilKey] = ts + holdMs;
  return enemy[sideKey];
}

function pickFlankSide(enemy, player, obstacles, ts, key = 'path') {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / distance;
  const ny = dy / distance;
  const probeDistance = Math.min(52, Math.max(26, distance * 0.32));
  let bestSide = null;
  let bestScore = -Infinity;

  for(const side of [1, -1]) {
    const tx = -ny * side;
    const ty = nx * side;
    const probeX = enemy.x + (nx * 0.42 + tx * 1.05) * probeDistance;
    const probeY = enemy.y + (ny * 0.42 + ty * 1.05) * probeDistance;
    const hasProbeLos = hasLineOfSightBetweenPoints(probeX, probeY, player.x, player.y, obstacles, Math.min(4, enemy.r * 0.35));
    const obstacleSteer = getObstacleSteeringVector({ x: probeX, y: probeY, r: enemy.r }, {
      obstacles,
      influenceRadius: 64,
    });
    const steerAlign = obstacleSteer.x * tx + obstacleSteer.y * ty;
    const score = (hasProbeLos ? 1000 : 0) + steerAlign * 20;
    if(score > bestScore) {
      bestScore = score;
      bestSide = side;
    }
  }

  const fallbackSide = Math.sin(enemy.eid * 1.91) >= 0 ? 1 : -1;
  return getStableMovementSide(enemy, key, ts, bestSide || fallbackSide, 850);
}

function hasClearShotLane(enemy, player, angle, obstacles = [], shotRadius = 5) {
  if(!obstacles.length) return true;
  const distance = Math.max(24, Math.hypot(player.x - enemy.x, player.y - enemy.y));
  const endX = enemy.x + Math.cos(angle) * distance;
  const endY = enemy.y + Math.sin(angle) * distance;
  for(const obstacle of obstacles) {
    if(segmentIntersectsExpandedRect(enemy.x, enemy.y, endX, endY, obstacle, shotRadius + 2)) {
      return false;
    }
  }
  return true;
}

function chooseClearShotAngle(enemy, player, {
  obstacles = [],
  baseSpread = 0.22,
  shotRadius = 5,
} = {}) {
  const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const offsets = [
    0,
    -baseSpread * 0.6, baseSpread * 0.6,
    -baseSpread * 1.2, baseSpread * 1.2,
    -baseSpread * 2.0, baseSpread * 2.0,
    -baseSpread * 3.0, baseSpread * 3.0,
  ];
  for(const offset of offsets) {
    const candidate = base + offset;
    if(hasClearShotLane(enemy, player, candidate, obstacles, shotRadius)) {
      return candidate;
    }
  }
  return base;
}

function resolveEnemySeparation(enemies, {
  width,
  height,
  margin,
  separationPadding = 2,
  maxIterations = 2,
} = {}) {
  if(!Array.isArray(enemies) || enemies.length <= 1) return 0;

  let resolvedPairs = 0;
  const iterations = Math.max(1, maxIterations | 0);
  for(let step = 0; step < iterations; step++) {
    let hadOverlap = false;
    for(let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      for(let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = (a.r || 0) + (b.r || 0) + separationPadding;
        const distSq = dx * dx + dy * dy;
        if(distSq >= minDist * minDist) continue;

        hadOverlap = true;
        resolvedPairs++;
        let distance = Math.sqrt(distSq);
        let nx;
        let ny;
        if(distance > 0.0001) {
          nx = dx / distance;
          ny = dy / distance;
        } else {
          // Deterministic fallback vector when two enemies are on the same point.
          const seed = ((a.eid || i) * 1.97 + (b.eid || j) * 3.11);
          nx = Math.cos(seed);
          ny = Math.sin(seed);
          distance = 0;
        }

        const overlap = minDist - distance;
        const push = overlap * 0.5;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;

        clampEnemyToArena(a, width, height, margin);
        clampEnemyToArena(b, width, height, margin);
      }
    }
    if(!hadOverlap) break;
  }

  return resolvedPairs;
}

function stepSiphonEnemy(enemy, {
  ts,
  dt,
  width,
  height,
  margin,
  player,
  obstacles = [],
} = {}) {
  const driftX = Math.sin(ts * 0.0009 + enemy.y);
  const driftY = Math.cos(ts * 0.0011 + enemy.x);
  const steer = getObstacleSteeringVector(enemy, {
    obstacles,
    influenceRadius: 62,
  });
  moveEnemyWithIntent(enemy, driftX + steer.x * 1.1, driftY + steer.y * 1.1, 52, dt);
  clampEnemyToArena(enemy, width, height, margin);
  return {
    shouldDrainCharge: Math.hypot(enemy.x - player.x, enemy.y - player.y) < 72,
  };
}

function stepRusherEnemy(enemy, {
  player,
  ts,
  dt,
  width,
  height,
  margin,
  obstacles = [],
} = {}) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if(distance > enemy.r && distance > 0) {
    const nx = dx / distance;
    const ny = dy / distance;
    const hasLos = hasLineOfSightToPlayer(enemy, player, obstacles);
    const steer = getObstacleSteeringVector(enemy, {
      obstacles,
      influenceRadius: 64,
    });
    if(hasLos) {
      enemy.losBlockedMs = 0;
      moveEnemyWithIntent(enemy, nx + steer.x * 0.45, ny + steer.y * 0.45, enemy.spd, dt);
    } else {
      enemy.losBlockedMs = (enemy.losBlockedMs || 0) + dt * 1000;
      const pathFrac = clamp01((enemy.losBlockedMs || 0) / 900);
      const strafeDir = pickFlankSide(enemy, player, obstacles, ts, 'rusherPath');
      const tx = -ny * strafeDir;
      const ty = nx * strafeDir;
      moveEnemyWithIntent(
        enemy,
        nx * (0.95 + pathFrac * 0.35) + tx * (0.7 + pathFrac * 0.65) + steer.x * 0.6,
        ny * (0.95 + pathFrac * 0.35) + ty * (0.7 + pathFrac * 0.65) + steer.y * 0.6,
        enemy.spd,
        dt
      );
    }
  }
  clampEnemyToArena(enemy, width, height, margin);
  return { distanceToPlayer: distance };
}

function advanceRangedEnemyCombatState(enemy, {
  player,
  ts,
  dt,
  width,
  height,
  margin,
  gravityWell2 = false,
  windupMs = 520,
  obstacles = [],
} = {}) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  const fleeRange = enemy.fleeRange || 110;
  const fearRange = Math.max(138, fleeRange + 20);
  const inFearRange = distance < fearRange;
  let speed = enemy.spd;
  if(gravityWell2) speed *= 0.8;

  enemy.fT += dt * 1000;
  const canShootWithoutLos = enemy.type === 'zoner' || enemy.type === 'purple_zoner' || enemy.type === 'orange_zoner';
  const hasLos = hasLineOfSightToPlayer(enemy, player, obstacles);
  const isFiringLaneReady = canShootWithoutLos || hasLos;
  const inWindup = enemy.fT >= enemy.fRate - windupMs && isFiringLaneReady;

  // Prevent LOS-blocked ranged enemies from entering permanent windup lock.
  if(!isFiringLaneReady && enemy.fT > enemy.fRate - windupMs * 0.4) {
    enemy.fT = enemy.fRate - windupMs * 0.4;
  }

  if(!inWindup && distance > 0) {
    const nx = dx / distance;
    const ny = dy / distance;
    const steer = getObstacleSteeringVector(enemy, {
      obstacles,
      influenceRadius: 62,
    });
    if(inFearRange) {
      const panicStrafeDir = getStableMovementSide(enemy, 'panic', ts, Math.sin(enemy.eid * 2.6) >= 0 ? 1 : -1, 520);
      moveEnemyWithIntent(
        enemy,
        -nx * 1.05 + (-ny) * (enemy.strafeSpd || 0.6) * 0.9 * panicStrafeDir + steer.x * 0.7,
        -ny * 1.05 + nx * (enemy.strafeSpd || 0.6) * 0.9 * panicStrafeDir + steer.y * 0.7,
        speed,
        dt
      );
    } else if(!hasLos) {
      enemy.losBlockedMs = (enemy.losBlockedMs || 0) + dt * 1000;
      const pathFrac = clamp01((enemy.losBlockedMs || 0) / 950);
      const strafeDir = pickFlankSide(enemy, player, obstacles, ts, 'rangedPath');
      moveEnemyWithIntent(
        enemy,
        (-ny) * (0.7 + pathFrac * 0.85) * (enemy.strafeSpd || 0.6) * strafeDir + nx * (0.45 + pathFrac * 0.35) + steer.x * 0.7,
        nx * (0.7 + pathFrac * 0.85) * (enemy.strafeSpd || 0.6) * strafeDir + ny * (0.45 + pathFrac * 0.35) + steer.y * 0.7,
        speed,
        dt
      );
    } else if(distance < fleeRange) {
      enemy.losBlockedMs = 0;
      const strafeDir = getStableMovementSide(enemy, 'kite', ts, Math.sin(enemy.eid * 1.3) >= 0 ? 1 : -1, 650);
      moveEnemyWithIntent(
        enemy,
        -nx + (-ny) * (enemy.strafeSpd || 0.6) * strafeDir + steer.x * 0.55,
        -ny + nx * (enemy.strafeSpd || 0.6) * strafeDir + steer.y * 0.55,
        speed,
        dt
      );
    } else if(distance > fleeRange * 1.6) {
      enemy.losBlockedMs = 0;
      moveEnemyWithIntent(enemy, nx + steer.x * 0.35, ny + steer.y * 0.35, speed * 0.25, dt);
    } else {
      enemy.losBlockedMs = 0;
      const strafeDir = getStableMovementSide(enemy, 'orbit', ts, Math.sin(enemy.eid * 2.1) >= 0 ? 1 : -1, 700);
      moveEnemyWithIntent(
        enemy,
        (-ny) * (enemy.strafeSpd || 0.6) * strafeDir + steer.x * 0.5,
        nx * (enemy.strafeSpd || 0.6) * strafeDir + steer.y * 0.5,
        speed,
        dt
      );
    }
    clampEnemyToArena(enemy, width, height, margin);
  }

  if(enemy.disruptorCooldown > 0) {
    enemy.disruptorCooldown -= dt * 1000;
  }

  const shouldFireBase = enemy.fT >= enemy.fRate && enemy.disruptorCooldown <= 0;
  const shouldFire = shouldFireBase
    && isFiringLaneReady;
  if(shouldFire) enemy.fT = 0;

  return {
    distanceToPlayer: distance,
    inWindup,
    shouldFire,
  };
}

function stepEnemyCombatState(enemy, {
  player,
  ts,
  dt,
  width,
  height,
  margin,
  gravityWell2 = false,
  windupMs = 520,
  obstacles = [],
} = {}) {
  if(enemy.isSiphon) {
    const siphonStep = stepSiphonEnemy(enemy, {
      ts,
      dt,
      width,
      height,
      margin,
      player,
      obstacles,
    });
    return {
      kind: 'siphon',
      shouldDrainCharge: siphonStep.shouldDrainCharge,
    };
  }

  if(enemy.isRusher) {
    const rusherStep = stepRusherEnemy(enemy, {
      player,
      ts,
      dt,
      width,
      height,
      margin,
      obstacles,
    });
    return {
      kind: 'rusher',
      distanceToPlayer: rusherStep.distanceToPlayer,
    };
  }

  const rangedStep = advanceRangedEnemyCombatState(enemy, {
    player,
    ts,
    dt,
    width,
    height,
    margin,
    gravityWell2,
    windupMs,
    obstacles,
  });
  return {
    kind: 'ranged',
    distanceToPlayer: rangedStep.distanceToPlayer,
    inWindup: rangedStep.inWindup,
    shouldFire: rangedStep.shouldFire,
  };
}

function applyDisruptorPostFire(enemy) {
  if(enemy.type !== 'disruptor') return false;
  enemy.disruptorBulletCount += enemy.burst;
  if(enemy.disruptorBulletCount >= 5) {
    enemy.disruptorBulletCount = 0;
    enemy.disruptorCooldown = 800;
    return true;
  }
  return false;
}

function fireEnemyBurst(enemy, {
  player,
  bulletSpeedScale,
  obstacles = [],
  random = () => simRng.next(),
  canEnemyUsePurpleShots = () => false,
  spawnZoner,
  spawnEliteZoner,
  spawnDoubleBounce,
  spawnTriangle,
  spawnEliteTriangle,
  spawnEliteBullet,
  spawnEnemyBullet,
} = {}) {
  if(enemy.type === 'zoner' || enemy.type === 'purple_zoner' || enemy.type === 'orange_zoner') {
    if(enemy.type === 'orange_zoner') {
      for(let i = 0; i < enemy.burst; i++) spawnEliteZoner(i, enemy.burst, 0);
    } else if(enemy.type === 'purple_zoner') {
      for(let i = 0; i < enemy.burst; i++) spawnDoubleBounce();
    } else if(enemy.isElite) {
      for(let i = 0; i < enemy.burst; i++) spawnEliteZoner(i, enemy.burst, 0);
    } else {
      for(let i = 0; i < enemy.burst; i++) spawnZoner(i, enemy.burst);
    }
    return;
  }

  if(enemy.type === 'triangle') {
    if(enemy.isElite) {
      for(let i = 0; i < enemy.burst; i++) spawnEliteTriangle();
    } else {
      for(let i = 0; i < enemy.burst; i++) spawnTriangle();
    }
    return;
  }

  const canShootPurple = canEnemyUsePurpleShots(enemy);
  for(let i = 0; i < enemy.burst; i++) {
    if(enemy.isElite) {
      const angleBase = chooseClearShotAngle(enemy, player, {
        obstacles,
        baseSpread: 0.6,
        shotRadius: 5,
      });
      const angle = angleBase + (random() - 0.5) * 0.6;
      const speed = (130 + random() * 40) * bulletSpeedScale();
      spawnEliteBullet(angle, speed, 0);
    } else if(canShootPurple) {
      const angle = chooseClearShotAngle(enemy, player, {
        obstacles,
        baseSpread: 0.22,
        shotRadius: 4.5,
      });
      spawnDoubleBounce(angle);
    } else {
      const angle = chooseClearShotAngle(enemy, player, {
        obstacles,
        baseSpread: 0.22,
        shotRadius: 4.5,
      });
      spawnEnemyBullet(angle);
    }
  }
  applyDisruptorPostFire(enemy);
}

function applyOrbitSphereContact(enemy, {
  orbCooldown,
  orbitSphereTier,
  ts,
  getOrbitSlotPosition,
  rotationSpeed,
  radius,
  originX,
  originY,
  orbitalFocus = false,
  chargeRatio = 0,
  orbSphereRadius = 5,
  baseDamage = 20,
  focusDamageBonus = 15,
  focusChargeScale = 1.5,
  orbDamageBonus = 1,
} = {}) {
  if(orbitSphereTier <= 0) return { hit: false, killed: false };
  if(!enemy.orbitHitAt) enemy.orbitHitAt = {};

  for(let si = 0; si < orbitSphereTier; si++) {
    if(orbCooldown[si] > 0) continue;
    const orbitSlot = getOrbitSlotPosition({
      index: si,
      orbitSphereTier,
      ts,
      rotationSpeed,
      radius,
      originX,
      originY,
    });
    const lastHitAt = enemy.orbitHitAt[si] || -99999;
    if(ts - lastHitAt < 220) continue;
    if(Math.hypot(enemy.x - orbitSlot.x, enemy.y - orbitSlot.y) >= enemy.r + orbSphereRadius + 1) continue;

    enemy.orbitHitAt[si] = ts;
    const damage = (baseDamage + (orbitalFocus ? focusDamageBonus + chargeRatio * focusChargeScale : 0)) * orbDamageBonus;
    enemy.hp -= damage;
    return {
      hit: true,
      killed: enemy.hp <= 0,
      slotX: orbitSlot.x,
      slotY: orbitSlot.y,
      damage,
    };
  }

  return { hit: false, killed: false };
}

export {
  clampEnemyToArena,
  resolveEnemySeparation,
  stepSiphonEnemy,
  stepRusherEnemy,
  advanceRangedEnemyCombatState,
  stepEnemyCombatState,
  applyDisruptorPostFire,
  fireEnemyBurst,
  applyOrbitSphereContact,
};
