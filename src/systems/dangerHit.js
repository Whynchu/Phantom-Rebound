function resolveLifelineRecovery({
  hpAfterDamage,
  lifeline,
  lifelineTriggerCount = 0,
  lifelineUses = 1,
} = {}) {
  if(hpAfterDamage > 0) {
    return {
      triggered: false,
      nextHp: hpAfterDamage,
      nextLifelineTriggerCount: lifelineTriggerCount,
      nextLifelineUsed: false,
    };
  }
  const canTrigger = Boolean(lifeline && lifelineTriggerCount < lifelineUses);
  if(!canTrigger) {
    return {
      triggered: false,
      nextHp: hpAfterDamage,
      nextLifelineTriggerCount: lifelineTriggerCount,
      nextLifelineUsed: false,
    };
  }
  return {
    triggered: true,
    nextHp: 1,
    nextLifelineTriggerCount: lifelineTriggerCount + 1,
    nextLifelineUsed: true,
  };
}

function resolveDangerPlayerHit({
  bullet,
  player,
  upgrades,
  ts,
  hp,
  maxHp,
  phaseDamage,
  directDamage,
  projectileInvulnSeconds,
} = {}) {
  const collides = Math.hypot(bullet.x - player.x, bullet.y - player.y) < player.r + bullet.r - 2;
  if(!collides) return { kind: 'none' };

  if(upgrades.voidWalker && upgrades.voidZoneActive && upgrades.voidZoneTimer > ts) {
    return { kind: 'void-block' };
  }

  if(
    upgrades.phaseDash &&
    upgrades.phaseDashCooldown <= 0 &&
    (upgrades.phaseDashRoomUses || 0) < (upgrades.phaseDashRoomLimit || 0)
  ) {
    const recovery = resolveLifelineRecovery({
      hpAfterDamage: hp - phaseDamage,
      lifeline: upgrades.lifeline,
      lifelineTriggerCount: upgrades.lifelineTriggerCount || 0,
      lifelineUses: upgrades.lifelineUses || 1,
    });
    return {
      kind: 'phase-dash',
      awayAngle: Math.atan2(player.y - bullet.y, player.x - bullet.x),
      dashDistance: 75,
      damage: phaseDamage,
      nextHp: recovery.nextHp,
      shouldGainHitCharge: upgrades.hitChargeGain > 0,
      invincibleSeconds: recovery.triggered ? 2.0 : 0.45,
      distortSeconds: 0.18,
      nextPhaseDashRoomUses: (upgrades.phaseDashRoomUses || 0) + 1,
      nextPhaseDashCooldown: 3500,
      nextVoidZoneActive: Boolean(upgrades.voidWalker),
      nextVoidZoneTimer: upgrades.voidWalker ? ts + 2000 : upgrades.voidZoneTimer || 0,
      lifelineTriggered: recovery.triggered,
      nextLifelineTriggerCount: recovery.nextLifelineTriggerCount,
      nextLifelineUsed: recovery.nextLifelineUsed,
      shouldGameOver: !recovery.triggered && recovery.nextHp <= 0,
    };
  }

  if(
    upgrades.mirrorTide &&
    upgrades.mirrorTideCooldown <= 0 &&
    (upgrades.mirrorTideRoomUses || 0) < (upgrades.mirrorTideRoomLimit || 0)
  ) {
    return {
      kind: 'mirror-tide',
      reflectAngle: Math.atan2(bullet.vy, bullet.vx) + Math.PI,
      nextMirrorTideRoomUses: (upgrades.mirrorTideRoomUses || 0) + 1,
      nextMirrorTideCooldown: 1500,
    };
  }

  const recovery = resolveLifelineRecovery({
    hpAfterDamage: hp - directDamage,
    lifeline: upgrades.lifeline,
    lifelineTriggerCount: upgrades.lifelineTriggerCount || 0,
    lifelineUses: upgrades.lifelineUses || 1,
  });
  const shouldEmpBurst = Boolean(
    upgrades.empBurst &&
    !upgrades.empBurstUsed &&
    recovery.nextHp <= maxHp * 0.3
  );
  return {
    kind: 'direct-hit',
    damage: directDamage,
    nextHp: recovery.nextHp,
    shouldGainHitCharge: upgrades.hitChargeGain > 0,
    invincibleSeconds: recovery.triggered ? 2.0 : projectileInvulnSeconds,
    distortSeconds: 0.45,
    shouldEmpBurst,
    nextEmpBurstUsed: upgrades.empBurstUsed || shouldEmpBurst,
    lifelineTriggered: recovery.triggered,
    nextLifelineTriggerCount: recovery.nextLifelineTriggerCount,
    nextLifelineUsed: recovery.nextLifelineUsed,
    shouldGameOver: !recovery.triggered && recovery.nextHp <= 0,
  };
}

function resolveSlipstreamNearMiss({
  bullet,
  player,
  upgrades,
  slipCooldown,
} = {}) {
  if(!(upgrades.slipTier > 0) || slipCooldown > 0) {
    return { shouldTrigger: false, chargeGain: 0, nextSlipCooldown: slipCooldown };
  }
  const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
  const nearMiss = dist < player.r + bullet.r + 10 && dist >= player.r + bullet.r - 2;
  if(!nearMiss) {
    return { shouldTrigger: false, chargeGain: 0, nextSlipCooldown: slipCooldown };
  }
  return {
    shouldTrigger: true,
    chargeGain: upgrades.slipChargeGain * (upgrades.ghostFlow ? 2 : 1),
    nextSlipCooldown: 150,
  };
}

function resolveRusherContactHit({
  hp,
  upgrades,
  contactDamage = 18,
  contactInvulnSeconds = 0.8,
} = {}) {
  const recovery = resolveLifelineRecovery({
    hpAfterDamage: hp - contactDamage,
    lifeline: upgrades.lifeline,
    lifelineTriggerCount: upgrades.lifelineTriggerCount || 0,
    lifelineUses: upgrades.lifelineUses || 1,
  });
  return {
    damage: contactDamage,
    nextHp: recovery.nextHp,
    invincibleSeconds: recovery.triggered ? 2.0 : contactInvulnSeconds,
    distortSeconds: 0.4,
    lifelineTriggered: recovery.triggered,
    nextLifelineTriggerCount: recovery.nextLifelineTriggerCount,
    nextLifelineUsed: recovery.nextLifelineUsed,
    shouldTriggerLastStand: Boolean(recovery.triggered && upgrades.lastStand),
    shouldGameOver: !recovery.triggered && recovery.nextHp <= 0,
  };
}

export {
  resolveLifelineRecovery,
  resolveDangerPlayerHit,
  resolveSlipstreamNearMiss,
  resolveRusherContactHit,
};
