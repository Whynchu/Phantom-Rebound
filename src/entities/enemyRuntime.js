function clampEnemyToArena(enemy, width, height, margin) {
  enemy.x = Math.max(margin + enemy.r, Math.min(width - margin - enemy.r, enemy.x));
  enemy.y = Math.max(margin + enemy.r, Math.min(height - margin - enemy.r, enemy.y));
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
} = {}) {
  enemy.x += Math.sin(ts * 0.0009 + enemy.y) * 22 * dt;
  enemy.y += Math.cos(ts * 0.0011 + enemy.x) * 22 * dt;
  clampEnemyToArena(enemy, width, height, margin);
  return {
    shouldDrainCharge: Math.hypot(enemy.x - player.x, enemy.y - player.y) < 72,
  };
}

function stepRusherEnemy(enemy, {
  player,
  dt,
  width,
  height,
  margin,
} = {}) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if(distance > enemy.r && distance > 0) {
    enemy.x += dx / distance * enemy.spd * dt;
    enemy.y += dy / distance * enemy.spd * dt;
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
} = {}) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  const fleeRange = enemy.fleeRange || 110;
  let speed = enemy.spd;
  if(gravityWell2) speed *= 0.8;

  enemy.fT += dt * 1000;
  const inWindup = enemy.fT >= enemy.fRate - windupMs;

  if(!inWindup && distance > 0) {
    if(distance < fleeRange) {
      const nx = dx / distance;
      const ny = dy / distance;
      const strafeDir = (Math.sin(ts * 0.0008 + enemy.eid * 1.3) > 0) ? 1 : -1;
      enemy.x -= nx * speed * dt + (-ny) * speed * (enemy.strafeSpd || 0.6) * strafeDir * dt;
      enemy.y -= ny * speed * dt + nx * speed * (enemy.strafeSpd || 0.6) * strafeDir * dt;
    } else if(distance > fleeRange * 1.6) {
      enemy.x += dx / distance * speed * 0.25 * dt;
      enemy.y += dy / distance * speed * 0.25 * dt;
    } else {
      const strafeDir = (Math.sin(ts * 0.0007 + enemy.eid * 2.1) > 0) ? 1 : -1;
      enemy.x += (-dy / distance) * speed * (enemy.strafeSpd || 0.6) * strafeDir * dt;
      enemy.y += (dx / distance) * speed * (enemy.strafeSpd || 0.6) * strafeDir * dt;
    }
    clampEnemyToArena(enemy, width, height, margin);
  }

  if(enemy.disruptorCooldown > 0) {
    enemy.disruptorCooldown -= dt * 1000;
  }

  const shouldFire = enemy.fT >= enemy.fRate && enemy.disruptorCooldown <= 0;
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
} = {}) {
  if(enemy.isSiphon) {
    const siphonStep = stepSiphonEnemy(enemy, {
      ts,
      dt,
      width,
      height,
      margin,
      player,
    });
    return {
      kind: 'siphon',
      shouldDrainCharge: siphonStep.shouldDrainCharge,
    };
  }

  if(enemy.isRusher) {
    const rusherStep = stepRusherEnemy(enemy, {
      player,
      dt,
      width,
      height,
      margin,
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
  random = Math.random,
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
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + (random() - 0.5) * 0.6;
      const speed = (130 + random() * 40) * bulletSpeedScale();
      spawnEliteBullet(angle, speed, 0);
    } else if(canShootPurple) {
      spawnDoubleBounce();
    } else {
      spawnEnemyBullet();
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
  baseDamage = 2,
  focusDamageBonus = 1.5,
  focusChargeScale = 1.5,
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
    if(Math.hypot(enemy.x - orbitSlot.x, enemy.y - orbitSlot.y) >= enemy.r + 6) continue;

    enemy.orbitHitAt[si] = ts;
    const damage = baseDamage + (orbitalFocus ? focusDamageBonus + chargeRatio * focusChargeScale : 0);
    enemy.hp -= damage;
    return {
      hit: true,
      killed: enemy.hp <= 0,
      slotX: orbitSlot.x,
      slotY: orbitSlot.y,
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
