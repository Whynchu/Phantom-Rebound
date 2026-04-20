const SPS_LADDER = [0.8,1.2,2.2,3.8,6.0,8.8];
const MAX_SHIELD_TIER = 4;
const TITAN_HP_PCT = [1.00, 0.50, 0.25, 0.10, 0.05];
const TITAN_SLOW_PCT = 0.05;
const TITAN_MAX_SIZE_MULT = 2.0;
const MINI_MAX_TIER = 3;
const MINI_SIZE_MULT_PER_TIER = 0.80;
const MINI_HP_MULT_PER_TIER = 0.90;
const HEAL_PCT = [1.00, 0.66, 0.66];
const BERSERKER_HP = 50;
const EXTRA_LIFE_GAINS = [40, 34, 28, 22, 18, 14];
const ROOM_REGEN_PER_PICK = 18;
const ROOM_REGEN_MAX = 54;
const BASE_CHARGE_CAP = 5;
const CHARGE_CAP_PCT = 0.16;
const CHARGE_CAP_MIN_FLAT_PER_TIER = 2;
const MAX_CHARGE_CAP_MULT = 2.0;
const MAX_DEEP_RESERVE_BONUS = 120;
const DENSE_CORE_DAMAGE_MULTS = [1.45, 2.0, 2.5, 2.85];
const DENSE_CORE_CAP_SCALES = [0.75, 0.5, 0.25, 0.05];
const CHARGED_ORB_FIRE_INTERVAL_MS = 1400;
const ESCALATION_KILL_PCT = 0.03;
const ESCALATION_MAX_BONUS = 0.60;
const LATE_BLOOM_SPEED_PENALTY = 0.94;
const LATE_BLOOM_DAMAGE_TAKEN_PENALTY = 1.06;
const LATE_BLOOM_DAMAGE_PENALTY = 0.94;
const KINETIC_FAST_FILL_MAX_PCT = 0.50;
const KINETIC_FAST_FILL_MIN_PCT = 0.05;
const KINETIC_FAST_FILL_LOW_CAP = 12;
const KINETIC_FAST_FILL_HIGH_CAP = 120;
const KINETIC_FAST_FILL_MULT = 1.75;
const PAYLOAD_BASE_RADIUS = 288;
const PAYLOAD_RADIUS_PER_TIER = 84;
const PAYLOAD_RADIUS_MAX = 576;

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
    critChance:       0,
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
    playerSizeMult:   1,
    playerDamageMult: 1,
    titanSlowMult:    1,
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
    bloodMoon: false,
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
    sustainedFireShots: 0,
    sustainedFireBonus: 1,
    sustainedFireLastShotTime: 0,
    mobileChargeRate: 0.10,
    orbSizeMult: 1,
    orbitRadiusBonus: 0,
    phantomRebound: false,
    boonSelectionOrder: [],
  };
  syncChargeCapacity(upg);
  return upg;
}

const BOONS = [
  {name:'Rapid Fire', tag:'OFFENSE', icon:'⚡', desc:'Next fire-rate tier.', apply(upg){ if(upg.spsTier<SPS_LADDER.length-1){upg.spsTier++;upg.sps=SPS_LADDER[upg.spsTier];}}},
  {name:'Ring Blast',tag:'OFFENSE',icon:'◎',desc:'+1 radial shot. Max 8.',apply(upg){upg.ringShots=Math.min(8,upg.ringShots+1);syncChargeCapacity(upg);}},
  {name:'Backshot',tag:'OFFENSE',icon:'↕',desc:'Adds a rear shot.',apply(upg){upg.dualShot=1;syncChargeCapacity(upg);}},
  {name:'Snipe Shot',tag:'OFFENSE',icon:'🎯',desc:'+shot size, speed, and damage.',apply(upg){upg.snipePower=Math.min(3,upg.snipePower+1);}},
  {name:'Twin Lance',tag:'OFFENSE',icon:'≫',desc:'+1 forward lane.',apply(upg){upg.forwardShotTier++;syncChargeCapacity(upg);}},
  {name:'Bigger Bullets',tag:'OFFENSE',icon:'🔵',desc:'Larger shots. Diminishing returns.',apply(upg){upg.biggerBulletsTier++;upg.shotSize=getHyperbolicScale(upg.biggerBulletsTier);}},
  {name:'Faster Bullets',tag:'OFFENSE',icon:'💨',desc:'Faster shots. Diminishing returns.',apply(upg){upg.fasterBulletsTier++;upg.shotSpd=getHyperbolicScale(upg.fasterBulletsTier);}},
  {name:'Critical Hit',tag:'OFFENSE',icon:'💥',desc:'+25% crit chance. Max 3.',apply(upg){upg.critTier=Math.min(3,upg.critTier+1);upg.critChance=Math.min(0.75,0.25*upg.critTier);}},
  {name:'Ricochet',tag:'UTILITY',icon:'↯',desc:'Shots bounce off walls.',apply(upg){upg.bounceTier=Math.max(1,upg.bounceTier);}},
  {name:'Homing',tag:'UTILITY',icon:'🌀',desc:'Shots curve into enemies. Max 4.',apply(upg){upg.homingTier=Math.min(4,upg.homingTier+1);}},
  {name:'Pierce',tag:'UTILITY',icon:'→',desc:'+1 pierce per tier. Max 3.',apply(upg){upg.pierceTier=Math.min(3,upg.pierceTier+1);}},
  {name:'Quick Harvest',tag:'UTILITY',icon:'⬇',desc:'Grey absorbs grant more charge.',apply(upg){upg.absorbTier++;upg.absorbValue=1+0.40*getHyperbolicScale(upg.absorbTier);}},
  {name:'Decay Extension',tag:'UTILITY',icon:'⏳',desc:'+1s grey linger. Max +3s.',apply(upg){upg.decayBonus=Math.min(3000,upg.decayBonus+1000);}},
  {name:'Capacity Boost',tag:'UTILITY',icon:'◆',desc:'+16% base charge cap and at least +2 charge per pick. Max +100%.',apply(upg){if((upg.chargeCapMult||1) >= MAX_CHARGE_CAP_MULT)return; upg.chargeCapTier++;upg.chargeCapMult = Math.min(MAX_CHARGE_CAP_MULT, 1 + upg.chargeCapTier * CHARGE_CAP_PCT);syncChargeCapacity(upg);}},
  {name:'Deep Reserve',tag:'UTILITY',icon:'▣',desc:'+flat charge. Starts at +16, caps at +120.',apply(upg){if((upg.chargeCapFlatBonus||0) >= MAX_DEEP_RESERVE_BONUS)return; upg.chargeCapFlatTier++;upg.chargeCapFlatBonus = Math.min(MAX_DEEP_RESERVE_BONUS, (upg.chargeCapFlatBonus||0) + getFlatChargeGain(upg.chargeCapFlatTier));syncChargeCapacity(upg);}},
  {name:'Wider Absorb',tag:'UTILITY',icon:'🧲',desc:'More absorb range. Max +60.',apply(upg){upg.absorbRange=Math.min(60,upg.absorbRange+15);}},
  {name:'Long Reach',tag:'UTILITY',icon:'➶',desc:'Shots last longer.',apply(upg){upg.shotLifeTier++;upg.shotLifeMult=getHyperbolicScale(upg.shotLifeTier);}},
  {name:'Kinetic Harvest',tag:'UTILITY',icon:'🌀',desc:'Gain charge while moving. Low charge refills faster.',apply(upg){upg.kineticTier++;const baseMoveRate=getHyperbolicScale(upg.kineticTier)*0.45;const spsSynergy=1+(upg.spsTier||0)*0.15;upg.moveChargeRate=baseMoveRate*spsSynergy;}},
  {name:'Steady Aim',tag:'UTILITY',icon:'🎯+',desc:'+15% mobile charge rate. Max 3.',apply(upg){if((upg.mobileChargeRate||0.10)>=0.55)return; upg.mobileChargeRate=Math.min(0.55,(upg.mobileChargeRate||0.10)+0.15);}},
  {name:'Extra Life',tag:'SURVIVE',icon:'◉',desc:'+max HP and heal on pickup.',apply(upg, state){upg.extraLifeTier++;const idx=Math.min(EXTRA_LIFE_GAINS.length-1, upg.extraLifeTier-1);const heal=EXTRA_LIFE_GAINS[idx];state.maxHp+=heal;state.hp=Math.min(state.hp+heal,state.maxHp);}},
  {name:'Ghost Velocity',tag:'SURVIVE',icon:'👻',desc:'Move faster. Diminishing returns.',apply(upg){upg.speedTier++;upg.speedMult=getHyperbolicScale(upg.speedTier);}},
  {name:'Room Regen',tag:'SURVIVE',icon:'💚',desc:'+18 HP on room clear. Max 54.',apply(upg){upg.regenTick=Math.min(ROOM_REGEN_MAX,upg.regenTick+ROOM_REGEN_PER_PICK);}},
  {name:'Armor Weave',tag:'SURVIVE',icon:'🧱',desc:'Damage taken: -18% / -36% / -50%.',apply(upg){const multipliers=[1,0.82,0.64,0.5];upg.armorTier=Math.min(3,upg.armorTier+1);upg.damageTakenMult=multipliers[upg.armorTier];},evolvesWith:['Titan Heart'],evolvedVersion:{name:'Living Fortress',icon:'🧱+',desc:'Armor scales with missing HP.',apply(upg){const multipliers=[1,0.82,0.64,0.5];upg.armorTier=Math.min(3,upg.armorTier+1);upg.damageTakenMult=multipliers[upg.armorTier];upg.livingFortress=true;}}},
  {name:'Hit Battery',tag:'SURVIVE',icon:'⚕️',desc:'Getting hit grants charge. Max 3.',apply(upg){upg.capacitorTier=Math.min(3,upg.capacitorTier+1);upg.hitChargeGain=Math.min(6,upg.hitChargeGain+2);}},
  {name:'MINI',tag:'SURVIVE',icon:'·',desc:'Tiered shrink (max 3). Each tier: -20% size, -10% max HP. No Titan Heart.',apply(upg, state){const currentMiniTier = Math.max(upg.miniTier || 0, upg.miniTaken ? 1 : 0); if(currentMiniTier >= MINI_MAX_TIER || upg.titanTier > 0) return; const nextMiniTier = currentMiniTier + 1; upg.miniTier = nextMiniTier; upg.miniTaken = true; upg.playerSizeMult *= MINI_SIZE_MULT_PER_TIER; state.maxHp = Math.max(10, Math.round(state.maxHp * MINI_HP_MULT_PER_TIER)); state.hp = Math.min(state.maxHp, Math.max(1, Math.round(state.hp * MINI_HP_MULT_PER_TIER)));}},
  {name:'Titan Heart',tag:'SURVIVE',icon:'⬢',desc:'+HP, +5% dmg, -5% spd. No MINI.',apply(upg, state){const currentMiniTier = Math.max(upg.miniTier || 0, upg.miniTaken ? 1 : 0); if(currentMiniTier > 0 || upg.titanTier >= TITAN_HP_PCT.length) return; const hpPct = TITAN_HP_PCT[upg.titanTier]; upg.titanTier++; upg.playerSizeMult = Math.min(TITAN_MAX_SIZE_MULT, 1 + upg.titanTier * 0.25); upg.playerDamageMult = 1 + upg.titanTier * 0.05; upg.titanSlowMult = Math.max(0.7, 1 - upg.titanTier * TITAN_SLOW_PCT); const gain = Math.max(1, Math.round(state.maxHp * hpPct)); state.maxHp += gain; state.hp = Math.min(state.hp, state.maxHp);}},
  {name:'Shield Plate',tag:'SURVIVE',icon:'🛡️',desc:`+1 shield plate. Max ${MAX_SHIELD_TIER}.`,apply(upg){upg.shieldTier=Math.min(MAX_SHIELD_TIER,upg.shieldTier+1);}},
  {name:'Tempered Shield',tag:'SURVIVE',icon:'🛡️+',desc:'Shields gain a purple first layer.',apply(upg){if(upg.shieldTempered||upg.shieldTier===0)return; upg.shieldTempered=true;}},
  {name:'Mirror Shield',tag:'SURVIVE',icon:'🪞',desc:'Blocked shots fire 60% countershots.',isActive:upg=>upg.shieldMirror,apply(upg){if(upg.shieldMirror||upg.shieldTier===0)return; upg.shieldMirror=true;}},
  {name:'Shield Burst',tag:'SURVIVE',icon:'💠',desc:'Shield break fires a 4-way burst.',requires:upg=>upg.shieldTier>0,apply(upg){if(upg.shieldBurst)return; upg.shieldBurst=true;},evolvesWith:['Mirror Shield'],evolvedVersion:{name:'Aegis Nova',icon:'💠+',desc:'Mirror shots also trigger Shield Burst.',apply(upg){if(upg.shieldBurst)return; upg.shieldBurst=true; upg.aegisNova=true;}}},
  {name:'Barrier Pulse',tag:'SURVIVE',icon:'⬡',desc:'Shield break: +2 charge and magnet.',requires:upg=>upg.shieldTier>0,apply(upg){if(upg.barrierPulse)return; upg.barrierPulse=true;}},
  {name:'Swift Ward',tag:'SURVIVE',icon:'⚡🛡️',desc:'Shields recharge faster. Max 2.',requires:upg=>upg.shieldTier>0,apply(upg){if(upg.shieldRegenTier>=2)return; upg.shieldRegenTier++;}},
  {name:'Orbit Spheres',tag:'UTILITY',icon:'🔮',desc:'+1 orbiting sphere per pick. Max 5.',apply(upg){upg.orbitSphereTier=Math.min(5,upg.orbitSphereTier+1);}},
  {name:'Massive Orbs',tag:'UTILITY',icon:'🔮+',desc:'+30% orb size per tier. Max 3.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if((upg.orbSizeMult||1)>=1.30*1.30*1.30)return; upg.orbSizeMult=(upg.orbSizeMult||1)*1.30;}},
  {name:'Wide Orbit',tag:'UTILITY',icon:'🔮↔',desc:'+20px orbit distance. Max 3.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if((upg.orbitRadiusBonus||0)>=60)return; upg.orbitRadiusBonus=(upg.orbitRadiusBonus||0)+20;}},
  {name:'Volatile Orbs',tag:'OFFENSE',icon:'💥',desc:'Orbs explode on contact. Shared cooldown.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.volatileOrbs)return; upg.volatileOrbs=true;}},
  {name:'Charged Orbs',tag:'OFFENSE',icon:'⚡',desc:'Orbs spend charge to fire at nearby enemies.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.chargedOrbs)return; upg.chargedOrbs=true;}},
  {name:'Absorb Orbs',tag:'UTILITY',icon:'🌀',desc:'Orbs auto-absorb nearby grey bullets.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.absorbOrbs)return; upg.absorbOrbs=true;}},
  {name:'Orb Twin',tag:'OFFENSE',icon:'⚡≫',desc:'Charged Orbs fire a 2-shot fork.',requires:upg=>upg.chargedOrbs,apply(upg){if(upg.orbTwin)return; upg.orbTwin=true;}},
  {name:'Orb Pierce',tag:'OFFENSE',icon:'⚡→',desc:'Charged Orb shots pierce 1 extra enemy.',requires:upg=>upg.chargedOrbs,apply(upg){if(upg.orbPierce)return; upg.orbPierce=true;}},
  {name:'Orb Overcharge',tag:'OFFENSE',icon:'⚡⬆',desc:'Charged Orb shots scale much harder from current charge.',requires:upg=>upg.chargedOrbs,apply(upg){if(upg.orbOvercharge)return; upg.orbOvercharge=true;}},
  {name:'Orbital Focus',tag:'OFFENSE',icon:'🌐',desc:'Orbs hit harder and fire faster.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.orbitalFocus)return; upg.orbitalFocus=true;}},
  {name:'Orb Strike',tag:'OFFENSE',icon:'🔮⚔',desc:'+25% orb damage. Max 4.',requires:upg=>upg.orbitSphereTier>0&&(upg.orbDamageTier||0)<4,apply(upg){upg.orbDamageTier=Math.min(4,(upg.orbDamageTier||0)+1);}},
  {name:'Aegis Battery',tag:'OFFENSE',icon:'🔋',desc:'Ready shields boost returns; full set fires bolts.',requires:upg=>upg.shieldTier>0,apply(upg){if(upg.aegisBattery)return; upg.aegisBattery=true; upg.aegisBatteryTimer=0;}},
  {name:'Heavy Rounds',tag:'OFFENSE',icon:'🔨',desc:'-45% fire rate, +50% damage. Max 3.',apply(upg){if(upg.heavyRoundsTier>=3)return; upg.heavyRoundsTier++; upg.heavyRoundsFireMult*=0.55; upg.heavyRoundsDamageMult*=1.50;}},
  {name:'Dense Core',tag:'OFFENSE',icon:'◈',desc:'Less max charge, more damage. Max 4.',apply(upg){if(upg.denseTier>=4)return; upg.denseTier++; upg.denseDamageMult=DENSE_CORE_DAMAGE_MULTS[Math.min(DENSE_CORE_DAMAGE_MULTS.length - 1, upg.denseTier - 1)]; syncChargeCapacity(upg);}},
  {name:'Echo Fire',tag:'OFFENSE',icon:'↺',desc:'Every 5th shot fires a free echo.',apply(upg){if(upg.echoFire)return; upg.echoFire=true;}},
  {name:'Split Shot',tag:'OFFENSE',icon:'⋔',desc:'Shots split on first wall bounce.',apply(upg){if(upg.splitShot||upg.bounceTier===0)return; upg.splitShot=true;},evolvesWith:['Ricochet'],evolvedVersion:{name:'Fracture',icon:'⋔+',desc:'Bounce splits into 3 and gains damage.',apply(upg){if(upg.splitShot||upg.bounceTier===0)return; upg.splitShot=true; upg.splitShotEvolved=true; upg.denseDamageMult=(upg.denseDamageMult||1)*1.2;}}},
  {name:'Volatile Rounds',tag:'OFFENSE',icon:'💢',desc:'Pierce shots burst on the last hit.',apply(upg){if(upg.volatileRounds||upg.pierceTier===0)return; upg.volatileRounds=true;},evolvesWith:['Pierce'],evolvedVersion:{name:'Chain Reaction',icon:'💢+',desc:'Every pierced hit bursts.',apply(upg){if(upg.volatileRounds||upg.pierceTier===0)return; upg.volatileRounds=true; upg.volatileAllTargets=true;}}},
  {name:'Slipstream',tag:'UTILITY',icon:'〜',desc:'Near-misses grant charge. Max 3.',apply(upg){if(upg.slipTier>=3)return; upg.slipTier++; upg.slipChargeGain=getHyperbolicScale(upg.slipTier)*0.4;},evolvesWith:['Kinetic Harvest'],evolvedVersion:{name:'Flux State',icon:'〜+',desc:'Moving near-misses grant 2x charge.',apply(upg){if(upg.slipTier>=3)return; upg.slipTier++; upg.slipChargeGain=getHyperbolicScale(upg.slipTier)*0.4; upg.fluxState=true;}}},
  {name:'Resonant Absorb',tag:'UTILITY',icon:'≋',desc:'3 quick absorbs give bonus charge.',apply(upg){if(upg.resonantAbsorb)return; upg.resonantAbsorb=true;},evolvesWith:['Quick Harvest'],evolvedVersion:{name:'Surge Harvest',icon:'≋+',desc:'Longer combo window, bigger bonus.',apply(upg){if(upg.resonantAbsorb)return; upg.resonantAbsorb=true; upg.surgeHarvest=true;}}},
  {name:'Chain Magnet',tag:'UTILITY',icon:'⤥',desc:'Absorbs briefly double pull range.',apply(upg){if(upg.chainMagnetTier>=2)return; upg.chainMagnetTier++;}},
  {name:'Overcharge Vent',tag:'UTILITY',icon:'⬆',desc:'+60% damage at full charge.',apply(upg){if(upg.overchargeVent)return; upg.overchargeVent=true;}},
  {name:'Gravity Well',tag:'UTILITY',icon:'⊙',desc:'Nearby danger bullets slow down.',apply(upg){if(upg.gravityWell)return; upg.gravityWell=true;}},
  {name:'Sliver',tag:'SURVIVE',icon:'◌',desc:'Low HP: faster and smaller.',apply(upg){if(upg.sliver)return; upg.sliver=true;}},
  {name:'Vampiric Return',tag:'SURVIVE',icon:'🩸',desc:'Kills heal and grant charge. Room-capped.',apply(upg){if(upg.vampiric)return; upg.vampiric=true;}},
  {name:'Predator\'s Instinct',tag:'OFFENSE',icon:'🐺',desc:'Kill streak grants damage. Max +125%.',requires:upg=>upg.vampiric,apply(upg){if(upg.predatorInstinct)return; upg.predatorInstinct=true;}},
  {name:'Blood Pact',tag:'SURVIVE',icon:'🩸+',desc:'Pierce hits heal once per bullet.',requires:upg=>upg.vampiric&&upg.pierceTier>0,apply(upg){if(upg.bloodPact)return; upg.bloodPact=true;}},
  {name:'Lifeline',tag:'SURVIVE',icon:'♾',desc:'Once per run, lethal damage leaves 1 HP.',apply(upg){if(upg.lifeline)return; upg.lifeline=true;},evolvesWith:['Berserker'],evolvedVersion:{name:'Last Stand',icon:'♾+',desc:'Lifeline also fires a full burst.',apply(upg){if(upg.lifeline)return; upg.lifeline=true; upg.lastStand=true;}}},
  {name:'Berserker',tag:'SURVIVE',icon:'🔴',desc:`Max HP→${BERSERKER_HP}, +3 SPS tiers, +30% speed. Exclusive.`,isActive:upg=>upg.berserker,apply(upg,state){if(upg.berserker||upg.titanTier>0||upg.extraLifeTier>0||upg.regenTick>0)return; upg.berserker=true; state.maxHp=BERSERKER_HP; state.hp=Math.min(state.hp,BERSERKER_HP); upg.spsTier=Math.min(SPS_LADDER.length-1,upg.spsTier+3); upg.sps=SPS_LADDER[upg.spsTier]; upg.speedMult*=1.3;}},
  {name:"Dead Man's Trigger",tag:'SURVIVE',icon:'☠',desc:'At 15% HP: x2 damage and free pierce.',apply(upg){if(upg.deadManTrigger)return; upg.deadManTrigger=true;}},
  {name:'Blood Rush',tag:'SURVIVE',icon:'🩸→',desc:'Kills grant stacking speed.',requires:upg=>upg.vampiric,apply(upg){if(upg.bloodRush)return; upg.bloodRush=true;}},
  {name:'Crimson Harvest',tag:'SURVIVE',icon:'🩸+',desc:'Kills drop an extra grey bullet.',requires:upg=>upg.vampiric,apply(upg){if(upg.crimsonHarvest)return; upg.crimsonHarvest=true;}},
  {name:'Sanguine Burst',tag:'OFFENSE',icon:'💀',desc:'Every 8th kill fires a free 6-way burst.',requires:upg=>upg.vampiric,apply(upg){if(upg.sanguineBurst)return; upg.sanguineBurst=true;},evolvesWith:['Predator\'s Instinct'],evolvedVersion:{name:'Rampage',icon:'💀+',desc:'Every 4th kill fires a free 8-way burst.',apply(upg){if(upg.sanguineBurst)return; upg.sanguineBurst=true; upg.rampageEvolved=true;}}},
  {name:'Late Bloom',tag:'OFFENSE',icon:'🌱',desc:'Scales damage by room. -6% speed.',apply(upg){if(hasLateBloomVariant(upg))return; upg.lateBloomVariant='power';}},
  {name:'Swift Bloom',tag:'UTILITY',icon:'🍃',desc:'Scales speed by room. +6% damage taken.',apply(upg){if(hasLateBloomVariant(upg))return; upg.lateBloomVariant='speed';}},
  {name:'Guard Bloom',tag:'SURVIVE',icon:'🛡️',desc:'Scales defense by room. -6% damage.',apply(upg){if(hasLateBloomVariant(upg))return; upg.lateBloomVariant='defense';}},
  {name:'Escalation',tag:'OFFENSE',icon:'📈',desc:'+3% damage per kill this room. Max +60%.',apply(upg){if(upg.escalation)return; upg.escalation=true;}},
  {name:'Spread Shot',tag:'OFFENSE',icon:'⬄',desc:'3-shot cone. +1 charge cost, +35% spread pellet damage, +1 spread pierce.',apply(upg){if(upg.spreadShot)return; upg.spreadShot=true; upg.spreadShotDamageMult=1.35; upg.spreadShotPierceBonus=1; syncChargeCapacity(upg);}},
  {name:'Phase Walk',tag:'UTILITY',icon:'⬚',desc:'Briefly phase through wall cubes before being ejected.',requires:upg=>upg.phaseDash || upg.phaseDashTier > 0,apply(upg){if(upg.phaseWalk)return; upg.phaseWalk=true;}},
  {name:'Payload',tag:'OFFENSE',icon:'💣',desc:'Shots explode on impact. Larger blast by default.',requires:upg=>upg.biggerBulletsTier>0,apply(upg){if(upg.payload)return; upg.payload=true;}},
  {name:'Payload Bloom',tag:'OFFENSE',icon:'💣+',desc:'Expand payload blast radius. Max 3.',requires:upg=>upg.payload,apply(upg){upg.payloadRadiusTier=Math.min(3,(upg.payloadRadiusTier||0)+1);}},
  {name:'Shockwave',tag:'OFFENSE',icon:'⚡',desc:'Full charge releases a push wave.',apply(upg){if(upg.shockwave)return; upg.shockwave=true;}},
  // Null Zone removed — unfun invincibility loop
  {name:'Gravity Well',tag:'UTILITY',icon:'⊙',desc:'Picking this a 2nd time adds: enemies move 20% slower within 90px.',evolvesWith:['Gravity Well'],evolvedVersion:{name:'Gravity Well II',icon:'⊙+',desc:'Slows both danger bullets AND enemies 30%.'},apply(upg){if(!upg.gravityWell)return; if(upg.gravityWell2)return; upg.gravityWell2=true;}},
  
  // Phase 5: Bullet Alchemy
  {name:'Refraction',tag:'OFFENSE',icon:'💡',desc:'Absorbs fire weak homing shots.',requires:upg=>upg.absorbTier>0,apply(upg){if(upg.refraction)return; upg.refraction=true;}},
  {name:'Mirror Tide',tag:'OFFENSE',icon:'🪞',desc:'Reflect the next hit. More picks = more room uses.',requires:upg=>upg.armorTier>0,apply(upg){if(upg.mirrorTideTier>=3)return; upg.mirrorTide=true; upg.mirrorTideTier++; upg.mirrorTideRoomLimit=upg.mirrorTideTier;}},
  
  // Phase 6: Active Abilities
  {name:'Phase Dash',tag:'SURVIVE',icon:'💨',desc:'On hit, auto-dash and take 5% damage.',apply(upg){if(upg.phaseDashTier>=3)return; upg.phaseDash=true; upg.phaseDashTier++; upg.phaseDashRoomLimit=upg.phaseDashTier;}},
  {name:'Overload',tag:'OFFENSE',icon:'⚡',desc:'Full charge converts your whole bank into a giant scaled volley.',apply(upg){if(upg.overload)return; upg.overload=true;}},
  {name:'EMP Burst',tag:'SURVIVE',icon:'💥',desc:'Low-HP hit clears danger bullets.',requires:upg=>upg.capacitorTier>0,apply(upg){if(upg.empBurst)return; upg.empBurst=true;}},
];

function boonHasEffect(boon, upg, hp, maxHp) {
  if(boon.requires && !boon.requires(upg)) return false;
  const probe = JSON.parse(JSON.stringify(upg));
  const state = { hp, maxHp };
  const beforeState = JSON.stringify({ upg: probe, hp: state.hp, maxHp: state.maxHp });
  boon.apply(probe, state);
  const afterState = JSON.stringify({ upg: probe, hp: state.hp, maxHp: state.maxHp });
  return beforeState !== afterState;
}

function getBoonWeight(boon, upg) {
  if(boon.name === 'Twin Lance') return 1 / (1 + upg.forwardShotTier * 1.35);
  // Build-bias: boost modifier boons when the player already owns the base
  const SHIELD_MODS = new Set(['Tempered Shield','Mirror Shield','Shield Burst','Aegis Nova','Barrier Pulse','Swift Ward','Aegis Battery']);
  const ORB_MODS    = new Set(['Volatile Orbs','Charged Orbs','Absorb Orbs','Orb Twin','Orb Pierce','Orb Overcharge','Orbital Focus','Orb Strike','Massive Orbs','Wide Orbit']);
  const BOUNCE_MODS = new Set(['Split Shot','Fracture']);
  const PIERCE_MODS = new Set(['Volatile Rounds','Chain Reaction']);
  if(boon.name === 'Payload Bloom' && upg.payload) return 3;
  if(SHIELD_MODS.has(boon.name) && upg.shieldTier > 0) return 3;
  if(ORB_MODS.has(boon.name)    && upg.orbitSphereTier > 0) return 3;
  if(BOUNCE_MODS.has(boon.name) && upg.bounceTier > 0) return 3;
  if(PIERCE_MODS.has(boon.name) && upg.pierceTier > 0) return 3;
  return 1;
}

function getEvolvedBoon(boon, upg) {
  if(!boon.evolvesWith || boon.evolvesWith.length === 0) return boon;
  const hasPrereq = boon.evolvesWith.some(name => {
    const prereq = BOONS.find(b => b.name === name);
    if(!prereq) return false;
    // Use explicit isActive if provided — avoids false positives from guard conditions
    if(prereq.isActive) return prereq.isActive(upg);
    // Fallback: probe — if applying makes no change, it's already been applied
    const probe = JSON.parse(JSON.stringify(upg));
    const before = JSON.stringify(probe);
    prereq.apply(probe, {hp:100,maxHp:100});
    return before === JSON.stringify(probe);
  });
  if(!hasPrereq) return boon;
  return { ...boon, ...boon.evolvedVersion, apply: boon.evolvedVersion.apply || boon.apply };
}

const LEGENDARY_SEQUENCES = [
  {
    id: 'aegisTitan',
    check: (h) => ['Mirror Shield','Shield Burst','Tempered Shield'].every(n => h.includes(n)),
    boon: { name:'AEGIS TITAN', tag:'LEGENDARY', icon:'🏛️', desc:'Shield Burst fires 8-way. Mirror reflects deal ×2 damage. All shields share one cooldown.',
      apply(upg){ upg.aegisTitan=true; } }
  },
  {
    id: 'ghostFlow',
    check: (h) => ['Kinetic Harvest','Quick Harvest'].every(n => h.includes(n)) &&
                  (h.includes('Slipstream') || h.includes('Flux State')),
    boon: { name:'GHOST FLOW', tag:'LEGENDARY', icon:'🌊', desc:'Absorb value scales with speed: +60% at full speed, −50% still. Near-miss charge ×2.',
      apply(upg){ upg.ghostFlow=true; } }
  },
  {
    id: 'corona',
    check: (h) => h.filter(n => n==='Ring Blast').length >= 3,
    boon: { name:'CORONA', tag:'LEGENDARY', icon:'☀️', desc:'Ring shots pierce once. Kills by ring shots refund 1 charge. No extra ring cap.',
      apply(upg){ upg.corona=true; } }
  },
  {
    id: 'finalForm',
    check: (h) => ['Berserker',"Dead Man's Trigger"].every(n => h.includes(n)) &&
                  (h.includes('Lifeline') || h.includes('Last Stand')),
    boon: { name:'FINAL FORM', tag:'LEGENDARY', icon:'💀', desc:"Dead Man activates at ≤15% HP with ×2.5 damage. Kills grant +0.5 charge.",
      apply(upg){ upg.finalForm=true; } }
  },
  {
    id: 'colossus',
    check: (h) => h.filter(n => n==='Titan Heart').length >= 3,
    boon: { name:'COLOSSUS', tag:'LEGENDARY', icon:'⬡', desc:'Taking damage releases a shockwave (4s cd) converting nearby danger bullets to grey. Titan speed penalty halved.',
      apply(upg){ upg.colossus=true; } }
  },
  {
    id: 'bloodMoon',
    check: (h) => ['Vampiric Return','Crimson Harvest','Sanguine Burst'].every(n => h.includes(n)),
    boon: { name:'BLOOD MOON', tag:'LEGENDARY', icon:'🩸', desc:'Kills restore +8 HP and drop +3 grey bullets. Vampire synergy unlocked.',
      apply(upg){ upg.bloodMoon=true; } }
  },
  {
    id: 'voidWalker',
    check: (h) => ['Phase Dash','Slipstream','Gravity Well'].every(n => h.includes(n)),
    boon: { name:'VOID WALKER', tag:'LEGENDARY', icon:'🌊', desc:'Dashing leaves a 2s void zone. Combined evasion + defensive synergy.',
      apply(upg){ upg.voidWalker=true; } }
  },
  {
    id: 'phantomRebound',
    check: (h) => ['Pierce','Ricochet','Long Reach'].every(n => h.includes(n)),
    boon: { name:'PHANTOM REBOUND', tag:'LEGENDARY', icon:'👻', desc:'Last wall bounce converts shots into grey charge bullets. Long Reach doubled.',
      apply(upg){ upg.phantomRebound=true; } }
  },
];

function checkLegendarySequences(history, upg, rejectedIds = new Set(), roomsSinceReject = new Map(), currentRoom = 0) {
  const available = [];
  for(const seq of LEGENDARY_SEQUENCES){
    if(upg[seq.id]) continue; // already have it
    if(rejectedIds.has(seq.id)) {
      const rejectedAtRoom = roomsSinceReject.get(seq.id) || 0;
      if(currentRoom - rejectedAtRoom < 2) continue; // skip if within 2-room cooldown
    }
    if(seq.check(history)) available.push(seq.boon);
  }
  // Return random legendary from available pool, or null if none available
  return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
}

function weightedPickBoon(pool, upg) {
  const totalWeight = pool.reduce((sum, boon) => sum + getBoonWeight(boon, upg), 0);
  let roll = Math.random() * totalWeight;
  for(const boon of pool) {
    roll -= getBoonWeight(boon, upg);
    if(roll <= 0) return boon;
  }
  return pool[pool.length - 1];
}

function createHealBoon(upg) {
  const healSpent = upg.healTier >= HEAL_PCT.length;
  const healPct = healSpent ? 0 : HEAL_PCT[upg.healTier];
  return {
    name: 'Recover',
    tag: 'HEAL',
    icon: '◉', // Use sprite heart icon instead of emoji
    disabled: healSpent,
    desc: healSpent
      ? 'Recover is spent for this run.'
      : `Heal ${Math.round(healPct * 100)}% of max HP. Permanent fourth option.`,
    apply(_, state) {
      if(healSpent) return;
      const healAmount = Math.max(1, Math.round(state.maxHp * healPct));
      state.hp = Math.min(state.maxHp, state.hp + healAmount);
      upg.healTier++;
    },
  };
}

function getActiveBoonEntries(upg) {
  const entries = [];
  if(upg.spsTier > 0) entries.push({ icon:'⚡', name:'Rapid Fire', detail:`Tier ${upg.spsTier} - ${(upg.sps * (upg.heavyRoundsFireMult || 1)).toFixed(1)} SPS` });
  if(upg.ringShots > 0) entries.push({ icon:'◎', name:'Ring Blast', detail:`${upg.ringShots} radial shot${upg.ringShots === 1 ? '' : 's'}` });
  if(upg.dualShot > 0) entries.push({ icon:'↕', name:'Backshot', detail:'Rear shot enabled' });
  if(upg.snipePower > 0) entries.push({ icon:'🎯', name:'Snipe Shot', detail:`Tier ${upg.snipePower}` });
  if(upg.forwardShotTier > 0) entries.push({ icon:'≫', name:'Twin Lance', detail:`+${upg.forwardShotTier} forward lane${upg.forwardShotTier === 1 ? '' : 's'}` });
  if(upg.biggerBulletsTier > 0) entries.push({ icon:'🔵', name:'Bigger Bullets', detail:`Tier ${upg.biggerBulletsTier}` });
  if(upg.fasterBulletsTier > 0) entries.push({ icon:'💨', name:'Faster Bullets', detail:`Tier ${upg.fasterBulletsTier}` });
  if(upg.critTier > 0) entries.push({ icon:'💥', name:'Critical Hit', detail:`${Math.round(upg.critChance * 100)}% crit chance` });
  if(upg.bounceTier > 0) entries.push({ icon:'↯', name:'Ricochet', detail:'Bullets bounce on walls' });
  if(upg.homingTier > 0) entries.push({ icon:'🌀', name:'Homing', detail:`Tier ${upg.homingTier} – shots curve into targets` });
  if(upg.pierceTier > 0) entries.push({ icon:'→', name:'Pierce', detail:`Tier ${upg.pierceTier}` });
  if(upg.absorbTier > 0) entries.push({ icon:'⬇', name:'Quick Harvest', detail:`+${Math.round((upg.absorbValue - 1) * 100)}% absorb value` });
  if(upg.decayBonus > 0) entries.push({ icon:'⏳', name:'Decay Extension', detail:`+${Math.round(upg.decayBonus / 1000)}s linger` });
  if(upg.chargeCapTier > 0) entries.push({ icon:'◆', name:'Capacity Boost', detail:`+${Math.round((upg.chargeCapMult - 1) * 100)}% cap` });
  if(upg.chargeCapFlatTier > 0) entries.push({ icon:'▣', name:'Deep Reserve', detail:`+${upg.chargeCapFlatBonus} flat charge` });
  if(upg.absorbRange > 0) entries.push({ icon:'🧲', name:'Wider Absorb', detail:`+${upg.absorbRange} absorb range` });
  if(upg.kineticTier > 0) {
    const kineticMult = getKineticChargeMultiplier(upg, 0);
    const kineticFastFillPct = Math.round(getKineticFastFillPct(upg) * 100);
    const baseRate = (upg.moveChargeRate || 0);
    const kineticDetail = kineticMult > 1.01
      ? `${baseRate.toFixed(2)}-${getKineticChargeRate(upg, 0).toFixed(2)} charge/sec, fast-fill ${kineticFastFillPct}%`
      : `${baseRate.toFixed(2)} charge/sec while moving`;
    entries.push({
      icon:'🌀',
      name:'Kinetic Harvest',
      detail: kineticDetail,
    });
  }
  if(upg.shotLifeTier > 0) entries.push({ icon:'➶', name:'Long Reach', detail:`+${Math.round((upg.shotLifeMult - 1) * 100)}% shot lifespan` });
  if(upg.extraLifeTier > 0) entries.push({ icon:'◉', name:'Extra Life', detail:`Tier ${upg.extraLifeTier}` });
  if(upg.speedTier > 0) entries.push({ icon:'👻', name:'Ghost Velocity', detail:`+${Math.round((upg.speedMult - 1) * 100)}% move speed` });
  if(upg.regenTick > 0) entries.push({ icon:'💚', name:'Room Regen', detail:`${upg.regenTick} HP per room clear` });
  if(upg.armorTier > 0) entries.push({ icon: upg.livingFortress?'🧱+':'🧱', name: upg.livingFortress?'Living Fortress':'Armor Weave', detail:`${Math.round((1 - upg.damageTakenMult) * 100)}% damage reduction` });
  if(upg.capacitorTier > 0) entries.push({ icon:'⚕️', name:'Hit Battery', detail:`+${upg.hitChargeGain.toFixed(1)} charge on hit` });
  const miniTier = Math.max(upg.miniTier || 0, upg.miniTaken ? 1 : 0);
  if(miniTier > 0) entries.push({ icon:'·', name:'MINI', detail:`Tier ${miniTier} — -20% size, -10% max HP per tier` });
  if(upg.titanTier > 0) entries.push({ icon:'⬢', name:'Titan Heart', detail:`Tier ${upg.titanTier} - +${Math.round((upg.playerDamageMult - 1) * 100)}% dmg, -${Math.round((1 - upg.titanSlowMult) * 100)}% speed` });
  if(upg.shieldTier > 0) entries.push({ icon:'🛡️', name:'Shield Plate', detail:`${upg.shieldTier} plate${upg.shieldTier === 1 ? '' : 's'}` });
  if(upg.shieldTempered) entries.push({ icon:'🛡️+', name:'Tempered Shield', detail:'2-stage shields' });
  if(upg.shieldMirror) entries.push({ icon:'🪞', name:'Mirror Shield', detail:'60% countershots' });
  if(upg.shieldBurst) entries.push({ icon: upg.aegisNova?'💠+':'💠', name: upg.aegisNova?'Aegis Nova':'Shield Burst', detail:'Break fires 4-way 55% burst' });
  if(upg.barrierPulse) entries.push({ icon:'⬡', name:'Barrier Pulse', detail:'+2 charge + magnet on break' });
  if(upg.shieldRegenTier>0) entries.push({ icon:'⚡🛡️', name:'Swift Ward', detail:`Shields recharge in ${Math.max(1.5, 4.5-upg.shieldRegenTier*2).toFixed(1)}s` });
  if(upg.aegisBattery) entries.push({ icon:'🔋', name:'Aegis Battery', detail:'Ready shields boost returns; full set fires bolts' });
  if(upg.orbitSphereTier > 0) entries.push({ icon:'🔮', name:'Orbit Spheres', detail:`${upg.orbitSphereTier} sphere${upg.orbitSphereTier === 1 ? '' : 's'}` });
  if(upg.denseTier > 0) entries.push({ icon:'◈', name:'Dense Core', detail:`Tier ${upg.denseTier} — ×${upg.denseDamageMult.toFixed(2)} dmg, cap: ${upg.maxCharge}` });
  if(upg.heavyRoundsTier > 0) entries.push({ icon:'🔨', name:'Heavy Rounds', detail:`Tier ${upg.heavyRoundsTier} — ×${upg.heavyRoundsDamageMult.toFixed(2)} dmg, ${Math.round((1 - upg.heavyRoundsFireMult) * 100)}% slower` });
  if(upg.slipTier>0) entries.push({icon: upg.fluxState?'〜+':'〜', name: upg.fluxState?'Flux State':'Slipstream', detail:`+${upg.slipChargeGain.toFixed(2)} charge/near-miss`});
  if(upg.resonantAbsorb) entries.push({icon: upg.surgeHarvest?'≋+':'≋', name: upg.surgeHarvest?'Surge Harvest':'Resonant Absorb', detail:'Quick combos give bonus charge'});
  if(upg.chainMagnetTier>0) entries.push({icon:'⤥',name:'Chain Magnet',detail:`${(700+350*(upg.chainMagnetTier-1))}ms double pull`});
  if(upg.overchargeVent) entries.push({icon:'⬆',name:'Overcharge Vent',detail:'+60% dmg at full charge'});
  if(upg.sliver) entries.push({icon:'◌',name:'Sliver',detail:'Low HP speed+size boost'});
  if(upg.vampiric) entries.push({icon:'🩸',name:'Vampiric Return',detail:'+4 HP and +0.25 charge per kill'});
  if(upg.predatorInstinct) entries.push({icon:'🐺',name:'Predator\'s Instinct',detail:`Kill streak: +${Math.round((upg.predatorKillStreak||0)*25)}% damage (max +125%)`});
  if(upg.bloodPact) entries.push({icon:'🩸+',name:'Blood Pact',detail:`+1 HP per piercing bullet hit, within room cap${upg.bloodMoon ? ' (+1 bullet cap from Blood Moon)' : ''}`});
  if(upg.lifeline) entries.push({icon: upg.lastStand?'♾+':'♾', name: upg.lastStand?'Last Stand':'Lifeline', detail:upg.lifelineUsed?'SPENT':'1x death save'});
  if(upg.berserker) entries.push({icon:'🔴',name:'Berserker',detail:`HP:${BERSERKER_HP}, +3 SPS, +30% spd`});
  if(upg.deadManTrigger) entries.push({icon:'☠',name:"Dead Man's Trigger",detail:'At 15% HP: x2 dmg + pierce'});
  if(upg.echoFire) entries.push({icon:'↺',name:'Echo Fire',detail:'Every 5th shot fires free echo'});
  if(upg.splitShot) entries.push({icon: upg.splitShotEvolved?'⋔+':'⋔', name: upg.splitShotEvolved?'Fracture':'Split Shot', detail:'Bullets split on wall bounce'});
  if(upg.volatileRounds) entries.push({icon: upg.volatileAllTargets?'💢+':'💢', name: upg.volatileAllTargets?'Chain Reaction':'Volatile Rounds', detail:'Pierce shots burst on final hit'});
  if(upg.aegisTitan) entries.push({icon:'🏛️',name:'AEGIS TITAN',detail:'8-way burst, ×2 reflect, shared cd'});
  if(upg.ghostFlow) entries.push({icon:'🌊',name:'GHOST FLOW',detail:'Speed-scaled absorb, ×2 near-miss'});
  if(upg.corona) entries.push({icon:'☀️',name:'CORONA',detail:'Ring pierce +1, kills refund charge'});
  if(upg.finalForm) entries.push({icon:'💀',name:'FINAL FORM',detail:'Dead Man ≤15% HP ×2.5, kill→charge'});
  if(upg.colossus) entries.push({icon:'⬡',name:'COLOSSUS',detail:'Hit→shockwave, halved titan slow'});
  if(upg.bloodMoon) entries.push({icon:'🩸',name:'BLOOD MOON',detail:'Kills restore +8 HP and drop +3 grey bullets'});
  if(upg.volatileOrbs) entries.push({icon:'💥',name:'Volatile Orbs',detail:'Orb detonation has shared cooldown'});
  if(upg.bloodRush) entries.push({icon:'🩸→',name:'Blood Rush',detail:`+${upg.bloodRushStacks||0} stacks (${((upg.bloodRushStacks||0)*10)}% speed)`});
  if(upg.crimsonHarvest) entries.push({icon:'🩸+',name:'Crimson Harvest',detail:'Kills drop extra grey bullet'});
  if(upg.sanguineBurst) entries.push({icon: upg.rampageEvolved?'💀+':'💀', name: upg.rampageEvolved?'Rampage':'Sanguine Burst', detail:`Free ${upg.rampageEvolved?8:6}-way burst`});
  const lateBloomPct = Math.round(getLateBloomBonusPct(upg._roomIndex || 0));
  if(upg.lateBloomVariant === 'power') entries.push({icon:'🌱',name:'Late Bloom',detail:`+${lateBloomPct}% dmg, -6% speed`});
  if(upg.lateBloomVariant === 'speed') entries.push({icon:'🍃',name:'Swift Bloom',detail:`+${lateBloomPct}% speed, +6% dmg taken`});
  if(upg.lateBloomVariant === 'defense') entries.push({icon:'🛡️',name:'Guard Bloom',detail:`-${lateBloomPct}% dmg taken, -6% dmg`});
  if(upg.escalation) entries.push({icon:'📈',name:'Escalation',detail:`+${Math.round(Math.min(ESCALATION_MAX_BONUS, (upg.escalationKills||0) * ESCALATION_KILL_PCT) * 100)}% dmg`});
  if(upg.spreadShot) entries.push({icon:'⬄',name:'Spread Shot',detail:`3-bullet cone, +35% spread dmg, +${upg.spreadShotPierceBonus||0} spread pierce`});
  if(upg.phaseWalk) entries.push({icon:'⬚',name:'Phase Walk',detail:'Brief wall breach, then forced eject'});
  if(upg.payload) entries.push({icon:'💣',name:'Payload',detail:`Shots explode on impact${upg.payloadRadiusTier > 0 ? `, ${Math.round(getPayloadBlastRadius(upg))}px blast` : `, ${Math.round(getPayloadBlastRadius(upg))}px default blast`}`});
  if(upg.payloadRadiusTier > 0) entries.push({icon:'💣+',name:'Payload Bloom',detail:`Tier ${upg.payloadRadiusTier} — ${Math.round(getPayloadBlastRadius(upg))}px blast`});
  if(upg.shockwave) entries.push({icon:'⚡',name:'Shockwave',detail:'Full charge → push enemies'});

  if(upg.gravityWell2) entries.push({icon:'⊙+',name:'Gravity Well II',detail:'Field-slow bullets, also slows nearby enemies'});
  else if(upg.gravityWell) entries.push({icon:'⊙',name:'Gravity Well',detail:'Field-slows nearby danger bullets'});
  if(upg.refraction) entries.push({icon:'💡',name:'Refraction',detail:`Cooldown: ${Math.max(0, (upg.refractionCooldown||0)/1000).toFixed(1)}s`});
  if(upg.mirrorTide) entries.push({icon:'🪞',name:'Mirror Tide',detail:`${Math.max(0, (upg.mirrorTideRoomLimit||0) - (upg.mirrorTideRoomUses||0))}/${upg.mirrorTideRoomLimit||0} room uses, ${Math.max(0, (upg.mirrorTideCooldown||0)/1000).toFixed(1)}s cd`});
  if(upg.phaseDash) entries.push({icon:'💨',name:'Phase Dash',detail:`5% damage, ${Math.max(0, (upg.phaseDashRoomLimit||0) - (upg.phaseDashRoomUses||0))}/${upg.phaseDashRoomLimit||0} uses, ${Math.max(0, (upg.phaseDashCooldown||0)/1000).toFixed(1)}s cd`});
  if(upg.overload) entries.push({icon:'⚡',name:'Overload',detail:'Full charge converts the whole bank into a 2x-4x giant volley'});
  if(upg.empBurst) entries.push({icon:'💥',name:'EMP Burst',detail:upg.empBurstUsed?'SPENT':'Ready ≤30% HP'});
  if(upg.voidWalker) entries.push({icon:'🌊',name:'VOID WALKER',detail:'Dashing creates void zone'});
  if(upg.chargedOrbs) entries.push({icon:'⚡',name:'Charged Orbs',detail:`Orbs fire shot every ${(CHARGED_ORB_FIRE_INTERVAL_MS / 1000).toFixed(1)}s`});
  if(upg.absorbOrbs) entries.push({icon:'🌀',name:'Absorb Orbs',detail:'Orbs absorb nearby grey bullets'});
  if(upg.orbTwin) entries.push({icon:'⚡≫',name:'Orb Twin',detail:'Charged Orbs fire a 2-shot fork'});
  if(upg.orbPierce) entries.push({icon:'⚡→',name:'Orb Pierce',detail:'Orb shots pierce 1 enemy'});
  if(upg.orbOvercharge) entries.push({icon:'⚡⬆',name:'Orb Overcharge',detail:'Orb shots scale harder from charge'});
  if(upg.orbitalFocus) entries.push({icon:'🌐',name:'Orbital Focus',detail:'Orbs scale from charge, faster orb fire'});
  if((upg.orbDamageTier||0) > 0) entries.push({icon:'🔮⚔',name:'Orb Strike',detail:`+${25*upg.orbDamageTier}% orb damage`});
  if((upg.orbSizeMult||1) > 1) entries.push({icon:'🔮+',name:'Massive Orbs',detail:`×${(upg.orbSizeMult||1).toFixed(2)} orb size`});
  if((upg.orbitRadiusBonus||0) > 0) entries.push({icon:'🔮↔',name:'Wide Orbit',detail:`+${upg.orbitRadiusBonus}px orbit distance`});
  if((upg.mobileChargeRate||0.10) > 0.10) entries.push({icon:'🎯+',name:'Steady Aim',detail:`${Math.round((upg.mobileChargeRate||0.10)*100)}% mobile charge rate`});
  if(upg.phantomRebound) entries.push({icon:'👻',name:'PHANTOM REBOUND',detail:'Last bounce → grey bullet, 2× Long Reach'});
  return entries;
}

function pickBoonChoices(upg, hp, maxHp, choiceCount = 3) {
  const available = BOONS.filter((boon) => boonHasEffect(boon, upg, hp, maxHp));
  const byTag = {
    OFFENSE: available.filter((boon) => boon.tag === 'OFFENSE').sort(() => Math.random() - 0.5),
    UTILITY: available.filter((boon) => boon.tag === 'UTILITY').sort(() => Math.random() - 0.5),
    SURVIVE: available.filter((boon) => boon.tag === 'SURVIVE').sort(() => Math.random() - 0.5),
  };
  const picks = [];
  for(const tag of ['OFFENSE', 'UTILITY', 'SURVIVE']) {
    if(byTag[tag].length > 0 && picks.length < choiceCount) {
      const boon = weightedPickBoon(byTag[tag], upg);
      picks.push(boon);
      byTag[tag] = byTag[tag].filter((entry) => entry !== boon);
    }
  }
  if(picks.length < choiceCount) {
    const remaining = [...available]
      .filter((boon) => !picks.includes(boon))
      .sort(() => Math.random() - 0.5);
    while(picks.length < choiceCount && remaining.length > 0) picks.push(remaining.shift());
  }
  return picks;
}

export { BOONS, SPS_LADDER, CHARGED_ORB_FIRE_INTERVAL_MS, ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS, getHyperbolicScale, getDefaultUpgrades, getRequiredShotCount, getKineticFastFillPct, getKineticChargeMultiplier, getKineticChargeRate, getPayloadBlastRadius, syncChargeCapacity, pickBoonChoices, createHealBoon, getActiveBoonEntries, getEvolvedBoon, checkLegendarySequences, getLateBloomGrowth, getLateBloomBonusPct, LATE_BLOOM_SPEED_PENALTY, LATE_BLOOM_DAMAGE_TAKEN_PENALTY, LATE_BLOOM_DAMAGE_PENALTY };

