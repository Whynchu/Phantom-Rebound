import {
  SPS_LADDER,
  BASE_CHARGE_CAP,
  CHARGE_CAP_PCT,
  CHARGE_CAP_MIN_FLAT_PER_TIER,
  MAX_CHARGE_CAP_MULT,
  MAX_DEEP_RESERVE_BONUS,
  DENSE_CORE_CAP_SCALES,
  DAMAGE_VARIANCE_BASE_MIN,
  DAMAGE_VARIANCE_BASE_MAX,
  DAMAGE_CEIL_STEP,
  DAMAGE_FLOOR_STEP,
  CRIT_CHANCE_TIER_BONUS,
  CRIT_DAMAGE_BASE_BONUS,
  CRIT_DAMAGE_TIER_BONUS,
  CRIT_DAMAGE_MAX_BONUS,
  ESCALATION_KILL_PCT,
  ESCALATION_MAX_BONUS,
  LATE_BLOOM_DAMAGE_PENALTY,
  KINETIC_FAST_FILL_MAX_PCT,
  KINETIC_FAST_FILL_MIN_PCT,
  KINETIC_FAST_FILL_LOW_CAP,
  KINETIC_FAST_FILL_HIGH_CAP,
  KINETIC_FAST_FILL_MULT,
  PLAYER_BASE_CRIT_CHANCE,
  PAYLOAD_BASE_RADIUS,
  PAYLOAD_RADIUS_PER_TIER,
  PAYLOAD_RADIUS_MAX,
} from '../data/boonConstants.js';

function getLateBloomGrowth(roomIndex = 0) {
  const room = roomIndex || 0;
  if(room <= 15) return 1;
  if(room <= 45) return 1 + (room - 15) * 0.015;
  if(room <= 75) return 1.45 + (room - 45) * 0.0075;
  return 1.675 + (room - 75) * 0.00125;
}

function getLateBloomBonusPct(roomIndex = 0) {
  return Math.max(0, (getLateBloomGrowth(roomIndex) - 1) * 100);
}

function hasLateBloomVariant(upg) {
  return Boolean(upg.lateBloomVariant);
}

function getHyperbolicScale(tier) {
  return 1 + (tier * 0.45) / (tier + 1.5);
}

function getRequiredShotCount(upg) {
  let count = 1 + (upg.forwardShotTier || 0) + (upg.ringShots || 0) + (upg.dualShot > 0 ? 1 : 0);
  if(upg.spreadShot) count += 1;
  return Math.max(1, count);
}

function getKineticFastFillPct(upg) {
  const maxCharge = Math.max(1, upg?.maxCharge || BASE_CHARGE_CAP);
  const span = KINETIC_FAST_FILL_HIGH_CAP - KINETIC_FAST_FILL_LOW_CAP;
  const capProgress = Math.max(0, Math.min(1, (maxCharge - KINETIC_FAST_FILL_LOW_CAP) / span));
  return KINETIC_FAST_FILL_MAX_PCT + (KINETIC_FAST_FILL_MIN_PCT - KINETIC_FAST_FILL_MAX_PCT) * capProgress;
}

function getKineticChargeMultiplier(upg, currentCharge = 0) {
  if(!upg || (upg.moveChargeRate || 0) <= 0) return 1;
  const maxCharge = Math.max(1, upg.maxCharge || BASE_CHARGE_CAP);
  const chargeRatio = Math.max(0, Math.min(1, currentCharge / maxCharge));
  return chargeRatio < getKineticFastFillPct(upg) ? KINETIC_FAST_FILL_MULT : 1;
}

function getKineticChargeRate(upg, currentCharge = 0) {
  return (upg.moveChargeRate || 0) * getKineticChargeMultiplier(upg, currentCharge);
}

function getPayloadBlastRadius(upg, bulletRadius = 4.5) {
  const payloadTier = Math.max(0, upg?.payloadRadiusTier || 0);
  const bulletBonus = Math.max(0, bulletRadius - 4.5) * 2.75;
  return Math.min(PAYLOAD_RADIUS_MAX, PAYLOAD_BASE_RADIUS + bulletBonus + payloadTier * PAYLOAD_RADIUS_PER_TIER);
}

function getConduitArcDamage(upg) {
  const orbCount = Math.max(0, Number(upg?.orbitSphereTier) || 0);
  return 6 + Math.max(0, orbCount - 2) * 2;
}

function getBloodMoonChargeBonus(bloodMoonStacks = 0) {
  const stacks = Math.max(0, Math.min(5, Number(bloodMoonStacks) || 0));
  return 0.16 + stacks * 0.04;
}

function getCoronaBurstCount(ringShots = 0) {
  return Math.min(8, 4 + Math.max(0, Number(ringShots) || 0));
}

function getDamageVarianceBounds(upg) {
  const ceilTier = Math.max(0, upg?.damageCeilTier || 0);
  const floorTier = Math.max(0, upg?.damageFloorTier || 0);
  const min = Math.min(
    DAMAGE_VARIANCE_BASE_MAX,
    DAMAGE_VARIANCE_BASE_MIN + floorTier * DAMAGE_FLOOR_STEP + Math.max(0, Number(upg?.damageFloorBonus) || 0) / 10,
  );
  const max = Math.max(
    min,
    DAMAGE_VARIANCE_BASE_MAX + ceilTier * DAMAGE_CEIL_STEP + Math.max(0, Number(upg?.damageCeilBonus) || 0) / 10,
  );
  return { min, max };
}

function getCritDamageFactor(upg) {
  const bonus = Math.min(CRIT_DAMAGE_MAX_BONUS, Math.max(0, upg?.critDamageBonus ?? CRIT_DAMAGE_BASE_BONUS));
  return 1 + bonus;
}

function getCritChanceFromTier(tier = 0, miniBonus = 0) {
  const safeTier = Math.max(0, Number(tier) || 0);
  let chance = PLAYER_BASE_CRIT_CHANCE;
  for(let i = 0; i < safeTier && i < CRIT_CHANCE_TIER_BONUS.length; i++) {
    chance += CRIT_CHANCE_TIER_BONUS[i];
  }
  chance += Math.max(0, Number(miniBonus) || 0);
  return Math.min(0.95, chance);
}

function getCritDamageBonusFromTier(tier = 0) {
  const safeTier = Math.max(0, Number(tier) || 0);
  let bonus = CRIT_DAMAGE_BASE_BONUS;
  for(let i = 0; i < safeTier && i < CRIT_DAMAGE_TIER_BONUS.length; i++) {
    bonus += CRIT_DAMAGE_TIER_BONUS[i];
  }
  return Math.min(CRIT_DAMAGE_MAX_BONUS, bonus);
}

function getPlayerShotDamageBase(upg, nowMs = 0, roomIndex = 0) {
  const snipePower = Math.max(0, Number(upg?.snipePower) || 0);
  const predatorKillStreak = Math.max(0, Number(upg?.predatorKillStreak) || 0);
  const denseTier = Math.max(0, Number(upg?.denseTier) || 0);
  const maxCharge = Math.max(0, Number(upg?.maxCharge) || 0);
  const playerDamageMult = Number.isFinite(upg?.playerDamageMult) ? upg.playerDamageMult : 1;
  const denseDamageMult = Number.isFinite(upg?.denseDamageMult) ? upg.denseDamageMult : 1;
  const heavyRoundsDamageMult = Number.isFinite(upg?.heavyRoundsDamageMult) ? upg.heavyRoundsDamageMult : 1;
  const spsTier = Math.max(0, Number(upg?.spsTier) || 0);
  const sustainedFireShots = Math.max(0, Number(upg?.sustainedFireShots) || 0);
  const escalationKills = Math.max(0, Number(upg?.escalationKills) || 0);
  const snipeScale = 1 + snipePower * 0.35;
  const predatorBonus = upg?.predatorInstinct && predatorKillStreak >= 2
    ? 1 + Math.min(predatorKillStreak * 0.25, 1.25)
    : 1;
  const denseDesperationBonus = (denseTier > 0 && maxCharge === 1) ? 2.0 : 1;
  const lateBloomDamage = upg?.lateBloomVariant === 'power'
    ? getLateBloomGrowth(roomIndex)
    : (upg?.lateBloomVariant === 'defense' ? LATE_BLOOM_DAMAGE_PENALTY : 1);
  const escalationBonus = upg?.escalation
    ? 1 + Math.min(escalationKills * ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS)
    : 1;
  const sustainedFireBonus = Math.min(1.45, 1 + Math.min(sustainedFireShots, 15) * 0.03);
  const spsFireRateScaling = Math.max(0.5, 1 - spsTier * 0.04);
  const total = 10
    * snipeScale
    * playerDamageMult
    * getAdrenalSurgeDamageMult(upg, nowMs)
    * denseDamageMult
    * heavyRoundsDamageMult
    * predatorBonus
    * denseDesperationBonus
    * lateBloomDamage
    * escalationBonus
    * sustainedFireBonus
    * spsFireRateScaling;
  return Number.isFinite(total) && total > 0 ? total : 10;
}

function syncChargeCapacity(upg) {
  const shotCount = getRequiredShotCount(upg);
  upg.chargeCapFlatBonus = Math.min(MAX_DEEP_RESERVE_BONUS, upg.chargeCapFlatBonus || 0);
  upg.chargeCapMult = Math.min(MAX_CHARGE_CAP_MULT, upg.chargeCapMult || 1);
  const baseCap = BASE_CHARGE_CAP + Math.max(0, shotCount - 1);
  const capMult = upg.chargeCapMult;
  const scaledBaseCap = Math.max(baseCap, Math.round(baseCap * capMult));
  const chargeCapFloor = baseCap + Math.max(0, upg.chargeCapTier || 0) * CHARGE_CAP_MIN_FLAT_PER_TIER;
  upg.maxCharge = Math.max(scaledBaseCap, chargeCapFloor) + upg.chargeCapFlatBonus;
  // Dense Core applies explicit total-cap scales per tier so the tradeoff is exact.
  if(upg.denseTier > 0) {
    const denseScale = DENSE_CORE_CAP_SCALES[Math.min(DENSE_CORE_CAP_SCALES.length - 1, upg.denseTier - 1)];
    upg.maxCharge = Math.max(1, Math.floor(upg.maxCharge * denseScale));
  }
  return upg.maxCharge;
}

function getFlatChargeGain(tier) {
  const scaledTier = Math.max(0, tier - 1);
  return Math.max(4, Math.round(16 / (1 + scaledTier * 0.28)));
}

function getAdrenalSurgeActiveStacks(upg, nowMs = 0) {
  if (!upg || (upg.adrenalSurgeTier || 0) <= 0) return 0;
  const expiries = Array.isArray(upg.adrenalStackExpiries)
    ? upg.adrenalStackExpiries.filter((expiry) => expiry > nowMs)
    : [];
  return Math.min(upg.adrenalSurgeTier || 0, expiries.length);
}

function getAdrenalSurgeEffectiveSps(upg, nowMs = 0) {
  const stacks = getAdrenalSurgeActiveStacks(upg, nowMs);
  const effectiveSpsTier = Math.min(SPS_LADDER.length - 1, (upg?.spsTier || 0) + stacks);
  return SPS_LADDER[effectiveSpsTier] || upg?.sps || 0;
}

function getAdrenalSurgeDamageMult(upg, nowMs = 0) {
  return 1 + getAdrenalSurgeActiveStacks(upg, nowMs) * 0.05;
}

function getDefaultUpgrades() {
  const upg = {
    speedMult:        1,
    sps:              0.8,
    spsTier:          0,
    spreadTier:       0,
    spreadTierObtained: false,
    ringShots:        0,
    dualShot:         0,
    snipePower:       0,
    maxCharge:        BASE_CHARGE_CAP,
    chargeCapMult:    1,
    chargeCapFlatBonus: 0,
    chargeCapFlatTier: 0,
    decayBonus:       0,
    absorbValue:      1,
    pierceTier:       0,
    bounceTier:       0,
    homingTier:       0,
    shotSize:         1,
    shotSpd:          1,
    shotLifeTier:     0,
    shotLifeMult:     1,
    critChance:       PLAYER_BASE_CRIT_CHANCE,
    absorbRange:      0,
    regenTick:        0,
    shieldTier:       0,
    orbitSphereTier:  0,
    orbDamageTier:    0,
    biggerBulletsTier: 0,
    fasterBulletsTier: 0,
    speedTier:        0,
    critTier:         0,
    absorbTier:       0,
    chargeCapTier:    0,
    extraLifeTier:    0,
    moveChargeRate:   0,
    hitChargeGain:    0,
    damageTakenMult:  1,
    armorTier:        0,
    capacitorTier:    0,
    kineticTier:      0,
    titanTier:        0,
    miniTaken:        false,
    miniTier:         0,
    miniShotSpdMult:  1,
    critDamageBonus:  0.5,
    critDamageTier:   0,
    damageFloorTier:  0,
    damageCeilTier:   0,
    damageFloorBonus: 0,
    damageCeilBonus:  0,
    playerSizeMult:   1,
    playerDamageMult: 1,
    titanSlowMult:    1,
    extraLifeSlowMult: 1,
    healTier:         0,
    forwardShotTier:  0,
    denseTier: 0,
    denseDamageMult: 1,
    shieldTempered: false,
    shieldMirror: false,
    shieldBurst: false,
    barrierPulse: false,
    shieldRegenTier: 0,
    slipTier: 0, slipChargeGain: 0,
    resonantAbsorb: false,
    chainMagnetTier: 0,
    overchargeVent: false,
    gravityWell: false,
    sliver: false,
    vampiric: false,
    predatorInstinct: false, predatorKillStreak: 0, predatorKillStreakTime: 0,
    bloodPact: false,
    lifeline: false, lifelineUsed: false,
    berserker: false,
    deadManTrigger: false,
    echoFire: false,
    splitShot: false,
    volatileRounds: false,
    volatileAllTargets: false,
    fluxState: false,
    surgeHarvest: false,
    aegisNova: false,
    livingFortress: false,
    lastStand: false,
    splitShotEvolved: false,
    aegisTitan: false, ghostFlow: false, corona: false, finalForm: false,
    colossus: false, lifelineUses: 1, lifelineTriggerCount: 0,
    volatileOrbs: false, chargedOrbs: false, absorbOrbs: false,
    orbTwin: false, orbPierce: false, orbOvercharge: false,
    orbitalFocus: false,
    aegisBattery: false, aegisBatteryTimer: 0,
    bloodRush: false, bloodRushStacks: 0, bloodRushTimer: 0,
    crimsonHarvest: false,
    sanguineBurst: false, sanguineKillCount: 0, rampageEvolved: false,
    bloodMoon: false, bloodMoonStacks: 0, bloodMoonTimer: 0,
    coronaStacks: 0, coronaTimer: 0,
    lateBloomVariant: '',
    escalation: false, escalationKills: 0,
    spreadShot: false,
    spreadShotDamageMult: 1,
    spreadShotPierceBonus: 0,
    payload: false,
    payloadRadiusTier: 0,
    phaseWalk: false,
    shockwave: false, shockwaveCooldown: 0,
    nullZone: false,
    gravityWell2: false,
    refraction: false, refractionCooldown: 0, refractionCount: 0,
    mirrorTide: false, mirrorTideTier: 0, mirrorTideCooldown: 0, mirrorTideRoomLimit: 0, mirrorTideRoomUses: 0,
    phaseDash: false, phaseDashTier: 0, phaseDashCooldown: 0, phaseDashRoomLimit: 0, phaseDashRoomUses: 0, dashDirection: 0, isDashing: false,
    overload: false, overloadActive: false, overloadCooldown: 0,
    empBurst: false, empBurstUsed: false,
    voidWalker: false, voidZoneActive: false, voidZoneTimer: 0,
    heavyRoundsTier: 0,
    heavyRoundsDamageMult: 1,
    heavyRoundsFireMult: 1,
    critDamageTier: 0,
    sustainedFireShots: 0,
    sustainedFireBonus: 1,
    sustainedFireLastShotTime: 0,
    mobileChargeRate: 0.10,
    orbSizeMult: 1,
    orbitRadiusBonus: 0,
    phantomRebound: false,
    conduit: false,
    conduitArcDmg: 0,
    conduitArcTickMs: 0,
    glassCannonTier: 0,
    adrenalSurgeTier: 0,
    adrenalStackExpiries: [],
    tetherOrbit: false,
    boonSelectionOrder: [],
  };
  syncChargeCapacity(upg);
  return upg;
}

export {
  getLateBloomGrowth,
  getLateBloomBonusPct,
  hasLateBloomVariant,
  getHyperbolicScale,
  getRequiredShotCount,
  getKineticFastFillPct,
  getKineticChargeMultiplier,
  getKineticChargeRate,
  getPayloadBlastRadius,
  getConduitArcDamage,
  getBloodMoonChargeBonus,
  getCoronaBurstCount,
  getDamageVarianceBounds,
  getCritDamageFactor,
  getCritChanceFromTier,
  getCritDamageBonusFromTier,
  getPlayerShotDamageBase,
  syncChargeCapacity,
  getFlatChargeGain,
  getAdrenalSurgeActiveStacks,
  getAdrenalSurgeEffectiveSps,
  getAdrenalSurgeDamageMult,
  getDefaultUpgrades,
};
