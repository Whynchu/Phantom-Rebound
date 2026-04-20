function syncOrbRuntimeArrays(orbFireTimers, orbCooldown, orbitSphereTier) {
  while(orbFireTimers.length < orbitSphereTier) orbFireTimers.push(0);
  while(orbCooldown.length < orbitSphereTier) orbCooldown.push(0);
}

function getOrbitSlotPosition({
  index,
  orbitSphereTier,
  ts,
  rotationSpeed,
  radius,
  originX,
  originY,
} = {}) {
  const angle = Math.PI * 2 / orbitSphereTier * index + ts * rotationSpeed;
  return {
    angle,
    x: originX + Math.cos(angle) * radius,
    y: originY + Math.sin(angle) * radius,
  };
}

function getShieldSlotPosition({
  index,
  shieldCount,
  ts,
  rotationSpeed,
  radius,
  originX,
  originY,
} = {}) {
  const angle = Math.PI * 2 / shieldCount * index + ts * rotationSpeed;
  return {
    angle,
    x: originX + Math.cos(angle) * radius,
    y: originY + Math.sin(angle) * radius,
    facing: angle + Math.PI * 0.5,
  };
}

function tickShieldCooldowns(shields, dt, shieldTempered) {
  for(const shield of shields) {
    if(shield.cooldown > 0) {
      const prev = shield.cooldown;
      shield.cooldown = Math.max(0, shield.cooldown - dt);
      if(prev > 0 && shield.cooldown <= 0 && shieldTempered) shield.hardened = true;
    }
  }
}

function countReadyShields(shields) {
  if(!shields || shields.length === 0) return 0;
  let ready = 0;
  for(const shield of shields) {
    if((shield.cooldown || 0) <= 0) ready++;
  }
  return ready;
}

function advanceAegisBatteryTimer({
  aegisBattery,
  shieldTier,
  enemiesCount,
  readyShieldCount,
  timer,
  dtMs,
  intervalMs,
} = {}) {
  if(!aegisBattery || shieldTier <= 0 || enemiesCount <= 0 || readyShieldCount < shieldTier) {
    return { timer: 0, shouldFire: false };
  }
  const nextTimer = (timer || 0) + dtMs;
  if(nextTimer >= intervalMs) {
    return { timer: 0, shouldFire: true };
  }
  return { timer: nextTimer, shouldFire: false };
}

function buildAegisBatteryBoltSpec({
  shouldFire,
  enemies,
  originX,
  originY,
  damageMult = 1,
  denseDamageMult = 1,
  readyShieldCount = 0,
  shotSpeed = 210,
  now = 0,
  expireMs = 1700,
} = {}) {
  if(!shouldFire || !enemies || enemies.length <= 0) return null;
  const target = enemies.reduce((best, enemy) => {
    const dist = Math.hypot(enemy.x - originX, enemy.y - originY);
    return (!best || dist < best.dist) ? { enemy, dist } : best;
  }, null);
  if(!target) return null;

  const aim = Math.atan2(target.enemy.y - originY, target.enemy.x - originX);
  const batteryDamage = damageMult * denseDamageMult * (1.1 + readyShieldCount * 0.2);
  return {
    x: originX,
    y: originY,
    vx: Math.cos(aim) * shotSpeed,
    vy: Math.sin(aim) * shotSpeed,
    radius: 4.2,
    bounceLeft: 0,
    pierceLeft: 0,
    homing: true,
    crit: false,
    dmg: batteryDamage,
    expireAt: now + expireMs,
  };
}

function buildMirrorShieldReflectionSpec({
  x,
  y,
  vx,
  vy,
  shotSize = 1,
  playerDamageMult = 1,
  denseDamageMult = 1,
  aegisTitan = false,
  mirrorShieldDamageFactor = 1,
  aegisBatteryDamageMult = 1,
  now = 0,
  playerShotLifeMs = 2000,
  shotLifeMult = 1,
} = {}) {
  return {
    x,
    y,
    vx,
    vy,
    radius: 4.5 * Math.min(2.5, shotSize),
    bounceLeft: 0,
    pierceLeft: 0,
    homing: false,
    crit: false,
    dmg: playerDamageMult * denseDamageMult * (aegisTitan ? mirrorShieldDamageFactor * 2 : mirrorShieldDamageFactor) * aegisBatteryDamageMult,
    expireAt: now + playerShotLifeMs * shotLifeMult,
  };
}

function buildShieldBurstSpec({
  x,
  y,
  aegisTitan = false,
  globalSpeedLift = 1,
  shotSize = 1,
  playerDamageMult = 1,
  denseDamageMult = 1,
  aegisNovaDamageFactor = 1,
  aegisBatteryDamageMult = 1,
  now = 0,
  playerShotLifeMs = 2000,
  shotLifeMult = 1,
} = {}) {
  return {
    x,
    y,
    count: aegisTitan ? 8 : 4,
    speed: 230 * globalSpeedLift,
    radius: 4.5 * Math.min(2.5, shotSize),
    bounceLeft: 0,
    pierceLeft: 0,
    homing: false,
    crit: false,
    dmg: playerDamageMult * denseDamageMult * aegisNovaDamageFactor * aegisBatteryDamageMult,
    expireAt: now + playerShotLifeMs * shotLifeMult,
  };
}

function buildChargedOrbVolleyForSlot({
  slotIndex,
  timerMs = 0,
  dtMs,
  fireIntervalMs,
  orbCooldown,
  orbitSphereTier,
  ts,
  rotationSpeed,
  radius,
  originX,
  originY,
  enemies,
  getOrbitSlotPosition,
  orbTwin = false,
  orbitalFocus = false,
  orbOvercharge = false,
  orbPierce = false,
  charge = 0,
  reservedForPlayer = 0,
  chargeRatio = 0,
  twinDamageMult = 1,
  focusDamageMult = 1,
  focusChargeScale = 0.8,
  overchargeDamageMult = 1,
  shotSpeed = 220,
  now,
  bloodPactHealCap = 0,
  orbDamageBonus = 1,
} = {}) {
  if((orbCooldown?.[slotIndex] || 0) > 0) {
    return { nextTimerMs: timerMs, fired: false, chargeSpent: 0, shotSpecs: [] };
  }

  const nextTimer = (timerMs || 0) + dtMs;
  if(nextTimer < fireIntervalMs) {
    return { nextTimerMs: nextTimer, fired: false, chargeSpent: 0, shotSpecs: [] };
  }

  const orbitSlot = getOrbitSlotPosition({
    index: slotIndex,
    orbitSphereTier,
    ts,
    rotationSpeed,
    radius,
    originX,
    originY,
  });
  const target = enemies.reduce((best, enemy) => {
    const dist = Math.hypot(enemy.x - orbitSlot.x, enemy.y - orbitSlot.y);
    return (!best || dist < best.dist) ? { enemy, dist } : best;
  }, null);
  if(!target) {
    return { nextTimerMs: 0, fired: false, chargeSpent: 0, shotSpecs: [] };
  }

  const aim = Math.atan2(target.enemy.y - orbitSlot.y, target.enemy.x - orbitSlot.x);
  const shotAngles = orbTwin ? [aim - 0.14, aim + 0.14] : [aim];
  const orbChargeAvailable = Math.max(0, Math.floor(charge) - reservedForPlayer);
  const shotsAvailable = Math.min(orbChargeAvailable, shotAngles.length);
  if(shotsAvailable <= 0) {
    return { nextTimerMs: 0, fired: false, chargeSpent: 0, shotSpecs: [] };
  }

  let totalDamage = 14;
  if(orbitalFocus) totalDamage *= focusDamageMult * (1 + chargeRatio * focusChargeScale);
  if(orbOvercharge) totalDamage *= 1 + chargeRatio * overchargeDamageMult;
  if(orbTwin) totalDamage *= twinDamageMult;
  totalDamage *= orbDamageBonus;
  const perShotDamage = totalDamage / shotsAvailable;

  const shotSpecs = shotAngles.slice(0, shotsAvailable).map((angle) => ({
    x: orbitSlot.x,
    y: orbitSlot.y,
    vx: Math.cos(angle) * shotSpeed,
    vy: Math.sin(angle) * shotSpeed,
    radius: orbOvercharge ? 4.1 : 3.8,
    bounceLeft: 0,
    pierceLeft: orbPierce ? 1 : 0,
    homing: orbitalFocus,
    crit: false,
    dmg: perShotDamage,
    expireAt: now + 1300,
    extras: {
      bloodPactHeals: 0,
      bloodPactHealCap,
    },
  }));

  return {
    nextTimerMs: 0,
    fired: true,
    chargeSpent: shotsAvailable,
    shotSpecs,
  };
}

export {
  syncOrbRuntimeArrays,
  getOrbitSlotPosition,
  getShieldSlotPosition,
  tickShieldCooldowns,
  countReadyShields,
  advanceAegisBatteryTimer,
  buildAegisBatteryBoltSpec,
  buildMirrorShieldReflectionSpec,
  buildShieldBurstSpec,
  buildChargedOrbVolleyForSlot,
};
