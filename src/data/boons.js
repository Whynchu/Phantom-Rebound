const SPS_LADDER = [0.5,1.0,1.8,3.0,5.0,8.0];
const MAX_SHIELD_TIER = 4;
const TITAN_HP_PCT = [1.00, 0.50, 0.25, 0.10, 0.05];
const TITAN_SLOW_PCT = 0.05;
const HEAL_PCT = [1.00, 0.50, 0.50];
const BASE_CHARGE_CAP = 5;
const CHARGE_CAP_PCT = 0.25;

function getHyperbolicScale(tier) {
  return 1 + (tier * 0.45) / (tier + 1.5);
}

function getRequiredShotCount(upg) {
  let count = 1 + (upg.forwardShotTier || 0) + (upg.ringShots || 0) + (upg.dualShot > 0 ? 1 : 0);
  if(upg.spreadTier >= 1) count += 2;
  if(upg.spreadTier >= 2) count += 4;
  return Math.max(1, count);
}

function syncChargeCapacity(upg) {
  const shotCount = getRequiredShotCount(upg);
  const baseCap = BASE_CHARGE_CAP + Math.max(0, shotCount - 1) + (upg.chargeCapFlatBonus || 0);
  const capMult = upg.chargeCapMult || 1;
  upg.maxCharge = Math.max(baseCap, Math.round(baseCap * capMult));
  return upg.maxCharge;
}

function getFlatChargeGain(tier) {
  return Math.max(8, Math.round(30 / getHyperbolicScale(Math.max(0, tier - 1))));
}

function getDefaultUpgrades() {
  const upg = {
    speedMult:        1,
    sps:              0.5,
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
    playerSizeMult:   1,
    playerDamageMult: 1,
    titanSlowMult:    1,
    healTier:         0,
    forwardShotTier:  0,
  };
  syncChargeCapacity(upg);
  return upg;
}

const BOONS = [
  {name:'Rapid Fire', tag:'OFFENSE', icon:'⚡', desc:'Unlock next fire rate tier. Shoot faster.', apply(upg){ if(upg.spsTier<SPS_LADDER.length-1){upg.spsTier++;upg.sps=SPS_LADDER[upg.spsTier];}}},
  {name:'Ring Blast',tag:'OFFENSE',icon:'◎',desc:'Add one radial bullet per cycle (max 8 total).',apply(upg){upg.ringShots=Math.min(8,upg.ringShots+1);syncChargeCapacity(upg);}},
  {name:'Front+Back',tag:'OFFENSE',icon:'↕',desc:'Add a reverse shot behind you.',apply(upg){upg.dualShot=1;syncChargeCapacity(upg);}},
  {name:'Snipe Shot',tag:'OFFENSE',icon:'🎯',desc:'All output bullets gain size, speed, and damage.',apply(upg){upg.snipePower=Math.min(3,upg.snipePower+1);}},
  {name:'Twin Lance',tag:'OFFENSE',icon:'≫',desc:'Add one extra forward-facing shot. Can repeat with reduced rarity each time.',apply(upg){upg.forwardShotTier++;syncChargeCapacity(upg);}},
  {name:'Bigger Bullets',tag:'OFFENSE',icon:'🔵',desc:'Output bullets grow larger (diminishing returns).',apply(upg){upg.biggerBulletsTier++;upg.shotSize=getHyperbolicScale(upg.biggerBulletsTier);}},
  {name:'Faster Bullets',tag:'OFFENSE',icon:'💨',desc:'Output bullets travel faster (diminishing returns).',apply(upg){upg.fasterBulletsTier++;upg.shotSpd=getHyperbolicScale(upg.fasterBulletsTier);}},
  {name:'Critical Hit',tag:'OFFENSE',icon:'💥',desc:'+20% crit chance each shot deals double damage (max 2 picks).',apply(upg){upg.critTier=Math.min(2,upg.critTier+1);upg.critChance=Math.min(0.6,0.2*upg.critTier);}},
  {name:'Ricochet',tag:'UTILITY',icon:'↯',desc:'Your output bullets bounce off walls up to 2 times.',apply(upg){upg.bounceTier=Math.max(1,upg.bounceTier);}},
  {name:'Homing',tag:'UTILITY',icon:'🌀',desc:'Output bullets curve toward the nearest enemy.',apply(upg){upg.homingTier=1;}},
  {name:'Pierce',tag:'UTILITY',icon:'→',desc:'Bullets penetrate one extra enemy per tier.',apply(upg){upg.pierceTier=Math.min(3,upg.pierceTier+1);}},
  {name:'Quick Harvest',tag:'UTILITY',icon:'⬇',desc:'Absorbing grey bullets grants more charge (diminishing returns).',apply(upg){upg.absorbTier++;upg.absorbValue=1+0.4*getHyperbolicScale(upg.absorbTier);}},
  {name:'Decay Extension',tag:'UTILITY',icon:'⏳',desc:'Grey bullets linger 1s longer for easier harvest (max 3s bonus).',apply(upg){upg.decayBonus=Math.min(3000,upg.decayBonus+1000);}},
  {name:'Charge Cap Up',tag:'UTILITY',icon:'◆',desc:'Increase your charge pool by 25% per pick.',apply(upg){upg.chargeCapTier++;upg.chargeCapMult = 1 + upg.chargeCapTier * CHARGE_CAP_PCT;syncChargeCapacity(upg);}},
  {name:'Deep Reserve',tag:'UTILITY',icon:'▣',desc:'Gain a flat charge increase with diminishing returns. Starts at +30.',apply(upg){upg.chargeCapFlatTier++;upg.chargeCapFlatBonus += getFlatChargeGain(upg.chargeCapFlatTier);syncChargeCapacity(upg);}},
  {name:'Wider Absorb',tag:'UTILITY',icon:'🧲',desc:'Pull grey bullets from farther away (max +50).',apply(upg){upg.absorbRange=Math.min(50,upg.absorbRange+12);}},
  {name:'Long Reach',tag:'UTILITY',icon:'➶',desc:'Your output shots last longer and travel farther.',apply(upg){upg.shotLifeTier++;upg.shotLifeMult=getHyperbolicScale(upg.shotLifeTier);}},
  {name:'Kinetic Harvest',tag:'UTILITY',icon:'🌀',desc:'Gain charge while moving (diminishing per pick).',apply(upg){upg.kineticTier++;upg.moveChargeRate=getHyperbolicScale(upg.kineticTier)*0.08;}},
  {name:'Extra Life',tag:'SURVIVE',icon:'◉',desc:'Gain max HP and restore it (diminishing bonus per pick).',apply(upg, state){upg.extraLifeTier++;const heal=Math.max(3,15-(upg.extraLifeTier-1)*2);state.maxHp+=heal;state.hp=Math.min(state.hp+heal,state.maxHp);}},
  {name:'Ghost Velocity',tag:'SURVIVE',icon:'👻',desc:'Move faster through the arena (diminishing returns).',apply(upg){upg.speedTier++;upg.speedMult=getHyperbolicScale(upg.speedTier);}},
  {name:'Room Regen',tag:'SURVIVE',icon:'💚',desc:'Restore HP whenever you clear a room (max 30 HP/room).',apply(upg){upg.regenTick=Math.min(30,upg.regenTick+10);}},
  {name:'Armor Weave',tag:'SURVIVE',icon:'🧱',desc:'Reduce incoming danger-bullet damage — 15% / 30% / 45% at tiers 1–3.',apply(upg){upg.armorTier=Math.min(3,upg.armorTier+1);upg.damageTakenMult=Math.max(0.55,1-upg.armorTier*0.15);}},
  {name:'Emergency Capacitor',tag:'SURVIVE',icon:'⚕️',desc:'Taking damage grants instant charge (max 3 picks).',apply(upg){upg.capacitorTier=Math.min(3,upg.capacitorTier+1);upg.hitChargeGain=Math.min(4.5,upg.hitChargeGain+1.5);}},
  {name:'MINI',tag:'SURVIVE',icon:'·',desc:'Become 50% smaller, but lose 25% max HP. Exclusive with Titan Heart.',apply(upg, state){if(upg.miniTaken || upg.titanTier > 0) return; upg.miniTaken = true; upg.playerSizeMult *= 0.5; state.maxHp = Math.max(10, Math.round(state.maxHp * 0.75)); state.hp = Math.min(state.maxHp, Math.max(1, Math.round(state.hp * 0.75)));}},
  {name:'Titan Heart',tag:'SURVIVE',icon:'⬢',desc:'Grow 25% larger each time, gain max HP at +100%, +50%, +25%, +10%, then +5%, add +5% damage, and lose a little speed per pick. Exclusive with MINI.',apply(upg, state){if(upg.miniTaken || upg.titanTier >= TITAN_HP_PCT.length) return; const hpPct = TITAN_HP_PCT[upg.titanTier]; upg.titanTier++; upg.playerSizeMult = 1 + upg.titanTier * 0.25; upg.playerDamageMult = 1 + upg.titanTier * 0.05; upg.titanSlowMult = Math.max(0.7, 1 - upg.titanTier * TITAN_SLOW_PCT); const gain = Math.max(1, Math.round(state.maxHp * hpPct)); state.maxHp += gain; state.hp = Math.min(state.hp, state.maxHp);}},
  {name:'Protective Shield',tag:'SURVIVE',icon:'🛡️',desc:`Orbiting shield absorbs one danger bullet then regenerates. Each upgrade adds another shield (max ${MAX_SHIELD_TIER}).`,apply(upg){upg.shieldTier=Math.min(MAX_SHIELD_TIER,upg.shieldTier+1);}},
  {name:'Orbit Spheres',tag:'UTILITY',icon:'🔮',desc:'Add one orbiting sphere (up to 5). Each pick adds another.',apply(upg){upg.orbitSphereTier=Math.min(5,upg.orbitSphereTier+1);}},
];

function boonHasEffect(boon, upg, hp, maxHp) {
  const probe = JSON.parse(JSON.stringify(upg));
  const state = { hp, maxHp };
  const beforeState = JSON.stringify({ upg: probe, hp: state.hp, maxHp: state.maxHp });
  boon.apply(probe, state);
  const afterState = JSON.stringify({ upg: probe, hp: state.hp, maxHp: state.maxHp });
  return beforeState !== afterState;
}

function getBoonWeight(boon, upg) {
  if(boon.name === 'Twin Lance') return 1 / (1 + upg.forwardShotTier * 1.35);
  return 1;
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
    icon: '♥',
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
  if(upg.spsTier > 0) entries.push({ icon:'⚡', name:'Rapid Fire', detail:`Tier ${upg.spsTier} - ${upg.sps.toFixed(1)} SPS` });
  if(upg.ringShots > 0) entries.push({ icon:'◎', name:'Ring Blast', detail:`${upg.ringShots} radial shot${upg.ringShots === 1 ? '' : 's'}` });
  if(upg.dualShot > 0) entries.push({ icon:'↕', name:'Front+Back', detail:'Rear shot enabled' });
  if(upg.snipePower > 0) entries.push({ icon:'🎯', name:'Snipe Shot', detail:`Tier ${upg.snipePower}` });
  if(upg.forwardShotTier > 0) entries.push({ icon:'≫', name:'Twin Lance', detail:`+${upg.forwardShotTier} forward lane${upg.forwardShotTier === 1 ? '' : 's'}` });
  if(upg.biggerBulletsTier > 0) entries.push({ icon:'🔵', name:'Bigger Bullets', detail:`Tier ${upg.biggerBulletsTier}` });
  if(upg.fasterBulletsTier > 0) entries.push({ icon:'💨', name:'Faster Bullets', detail:`Tier ${upg.fasterBulletsTier}` });
  if(upg.critTier > 0) entries.push({ icon:'💥', name:'Critical Hit', detail:`${Math.round(upg.critChance * 100)}% crit chance` });
  if(upg.bounceTier > 0) entries.push({ icon:'↯', name:'Ricochet', detail:'Bullets bounce on walls' });
  if(upg.homingTier > 0) entries.push({ icon:'🌀', name:'Homing', detail:'Shots curve into targets' });
  if(upg.pierceTier > 0) entries.push({ icon:'→', name:'Pierce', detail:`Tier ${upg.pierceTier}` });
  if(upg.absorbTier > 0) entries.push({ icon:'⬇', name:'Quick Harvest', detail:`+${Math.round((upg.absorbValue - 1) * 100)}% absorb value` });
  if(upg.decayBonus > 0) entries.push({ icon:'⏳', name:'Decay Extension', detail:`+${Math.round(upg.decayBonus / 1000)}s linger` });
  if(upg.chargeCapTier > 0) entries.push({ icon:'◆', name:'Charge Cap Up', detail:`+${Math.round((upg.chargeCapMult - 1) * 100)}% capacity` });
  if(upg.chargeCapFlatTier > 0) entries.push({ icon:'▣', name:'Deep Reserve', detail:`+${upg.chargeCapFlatBonus} flat charge` });
  if(upg.absorbRange > 0) entries.push({ icon:'🧲', name:'Wider Absorb', detail:`+${upg.absorbRange} absorb range` });
  if(upg.kineticTier > 0) entries.push({ icon:'🌀', name:'Kinetic Harvest', detail:`${upg.moveChargeRate.toFixed(2)} charge/sec while moving` });
  if(upg.shotLifeTier > 0) entries.push({ icon:'➶', name:'Long Reach', detail:`+${Math.round((upg.shotLifeMult - 1) * 100)}% shot lifespan` });
  if(upg.extraLifeTier > 0) entries.push({ icon:'◉', name:'Extra Life', detail:`Tier ${upg.extraLifeTier}` });
  if(upg.speedTier > 0) entries.push({ icon:'👻', name:'Ghost Velocity', detail:`+${Math.round((upg.speedMult - 1) * 100)}% move speed` });
  if(upg.regenTick > 0) entries.push({ icon:'💚', name:'Room Regen', detail:`${upg.regenTick} HP per room clear` });
  if(upg.armorTier > 0) entries.push({ icon:'🧱', name:'Armor Weave', detail:`${Math.round((1 - upg.damageTakenMult) * 100)}% damage reduction` });
  if(upg.capacitorTier > 0) entries.push({ icon:'⚕️', name:'Emergency Capacitor', detail:`+${upg.hitChargeGain.toFixed(1)} charge on hit` });
  if(upg.miniTaken) entries.push({ icon:'·', name:'MINI', detail:'50% smaller, 25% less max HP' });
  if(upg.titanTier > 0) entries.push({ icon:'⬢', name:'Titan Heart', detail:`Tier ${upg.titanTier} - +${Math.round((upg.playerDamageMult - 1) * 100)}% dmg, -${Math.round((1 - upg.titanSlowMult) * 100)}% speed` });
  if(upg.shieldTier > 0) entries.push({ icon:'🛡️', name:'Protective Shield', detail:`${upg.shieldTier} shield plate${upg.shieldTier === 1 ? '' : 's'}` });
  if(upg.orbitSphereTier > 0) entries.push({ icon:'🔮', name:'Orbit Spheres', detail:`${upg.orbitSphereTier} sphere${upg.orbitSphereTier === 1 ? '' : 's'}` });
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

export { BOONS, SPS_LADDER, getHyperbolicScale, getDefaultUpgrades, getRequiredShotCount, syncChargeCapacity, pickBoonChoices, createHealBoon, getActiveBoonEntries };

