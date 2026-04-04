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
  // Dense Core reduces cap
  if(upg.denseTier > 0) upg.maxCharge = Math.max(3, upg.maxCharge - upg.denseTier * 2);
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
    denseTier: 0,
    denseDamageMult: 1,
    shieldTempered: false,
    shieldMirror: false,
    shieldBurst: false,
    barrierPulse: false,
    slipTier: 0, slipChargeGain: 0,
    resonantAbsorb: false,
    chainMagnetTier: 0,
    overchargeVent: false,
    gravityWell: false,
    sliver: false,
    vampiric: false,
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
  };
  syncChargeCapacity(upg);
  return upg;
}

const BOONS = [
  {name:'Rapid Fire', tag:'OFFENSE', icon:'⚡', desc:'Advance to the next fire rate tier.', apply(upg){ if(upg.spsTier<SPS_LADDER.length-1){upg.spsTier++;upg.sps=SPS_LADDER[upg.spsTier];}}},
  {name:'Ring Blast',tag:'OFFENSE',icon:'◎',desc:'+1 radial bullet per fire cycle. Max 8.',apply(upg){upg.ringShots=Math.min(8,upg.ringShots+1);syncChargeCapacity(upg);}},
  {name:'Front+Back',tag:'OFFENSE',icon:'↕',desc:'Fire an extra shot directly behind you.',apply(upg){upg.dualShot=1;syncChargeCapacity(upg);}},
  {name:'Snipe Shot',tag:'OFFENSE',icon:'🎯',desc:'+size, +speed & +damage on all output bullets.',apply(upg){upg.snipePower=Math.min(3,upg.snipePower+1);}},
  {name:'Twin Lance',tag:'OFFENSE',icon:'≫',desc:'+1 forward shot. Rarity drops each repeat.',apply(upg){upg.forwardShotTier++;syncChargeCapacity(upg);}},
  {name:'Bigger Bullets',tag:'OFFENSE',icon:'🔵',desc:'Output bullets grow larger. Diminishes per pick.',apply(upg){upg.biggerBulletsTier++;upg.shotSize=getHyperbolicScale(upg.biggerBulletsTier);}},
  {name:'Faster Bullets',tag:'OFFENSE',icon:'💨',desc:'Output bullets travel faster. Diminishes per pick.',apply(upg){upg.fasterBulletsTier++;upg.shotSpd=getHyperbolicScale(upg.fasterBulletsTier);}},
  {name:'Critical Hit',tag:'OFFENSE',icon:'💥',desc:'+20% crit chance. Crits deal double damage. Max 2.',apply(upg){upg.critTier=Math.min(2,upg.critTier+1);upg.critChance=Math.min(0.6,0.2*upg.critTier);}},
  {name:'Ricochet',tag:'UTILITY',icon:'↯',desc:'Output bullets bounce off walls twice.',apply(upg){upg.bounceTier=Math.max(1,upg.bounceTier);}},
  {name:'Homing',tag:'UTILITY',icon:'🌀',desc:'Output bullets curve toward the nearest enemy.',apply(upg){upg.homingTier=1;}},
  {name:'Pierce',tag:'UTILITY',icon:'→',desc:'Bullets pierce one extra enemy per tier. Max 3.',apply(upg){upg.pierceTier=Math.min(3,upg.pierceTier+1);}},
  {name:'Quick Harvest',tag:'UTILITY',icon:'⬇',desc:'Grey bullet absorbs grant more charge. Diminishes.',apply(upg){upg.absorbTier++;upg.absorbValue=1+0.4*getHyperbolicScale(upg.absorbTier);}},
  {name:'Decay Extension',tag:'UTILITY',icon:'⏳',desc:'Grey bullets linger +1s longer. Max +3s.',apply(upg){upg.decayBonus=Math.min(3000,upg.decayBonus+1000);}},
  {name:'Charge Cap Up',tag:'UTILITY',icon:'◆',desc:'+25% max charge capacity per pick.',apply(upg){upg.chargeCapTier++;upg.chargeCapMult = 1 + upg.chargeCapTier * CHARGE_CAP_PCT;syncChargeCapacity(upg);}},
  {name:'Deep Reserve',tag:'UTILITY',icon:'▣',desc:'+flat charge pool. Starts at +30, diminishes.',apply(upg){upg.chargeCapFlatTier++;upg.chargeCapFlatBonus += getFlatChargeGain(upg.chargeCapFlatTier);syncChargeCapacity(upg);}},
  {name:'Wider Absorb',tag:'UTILITY',icon:'🧲',desc:'Extends grey bullet pull range. Max +50.',apply(upg){upg.absorbRange=Math.min(50,upg.absorbRange+12);}},
  {name:'Long Reach',tag:'UTILITY',icon:'➶',desc:'Output shots travel farther and last longer.',apply(upg){upg.shotLifeTier++;upg.shotLifeMult=getHyperbolicScale(upg.shotLifeTier);}},
  {name:'Kinetic Harvest',tag:'UTILITY',icon:'🌀',desc:'Gain charge while moving. Diminishes per pick.',apply(upg){upg.kineticTier++;upg.moveChargeRate=getHyperbolicScale(upg.kineticTier)*0.08;}},
  {name:'Extra Life',tag:'SURVIVE',icon:'◉',desc:'+max HP, restored on pickup. Diminishes per pick.',apply(upg, state){upg.extraLifeTier++;const heal=Math.max(3,15-(upg.extraLifeTier-1)*2);state.maxHp+=heal;state.hp=Math.min(state.hp+heal,state.maxHp);}},
  {name:'Ghost Velocity',tag:'SURVIVE',icon:'👻',desc:'Move faster through the arena. Diminishes per pick.',apply(upg){upg.speedTier++;upg.speedMult=getHyperbolicScale(upg.speedTier);}},
  {name:'Room Regen',tag:'SURVIVE',icon:'💚',desc:'+10 HP on room clear per pick. Max 30/room.',apply(upg){upg.regenTick=Math.min(30,upg.regenTick+10);}},
  {name:'Armor Weave',tag:'SURVIVE',icon:'🧱',desc:'Reduces damage taken: 15% / 30% / 45% per tier.',apply(upg){upg.armorTier=Math.min(3,upg.armorTier+1);upg.damageTakenMult=Math.max(0.55,1-upg.armorTier*0.15);},evolvesWith:['Titan Heart'],evolvedVersion:{name:'Living Fortress',icon:'🧱+',desc:'Armor scales with HP% — full HP = double reduction.',apply(upg){upg.armorTier=Math.min(3,upg.armorTier+1);upg.damageTakenMult=Math.max(0.55,1-upg.armorTier*0.15);upg.livingFortress=true;}}},
  {name:'Emergency Capacitor',tag:'SURVIVE',icon:'⚕️',desc:'Taking damage grants instant charge. Max 3 picks.',apply(upg){upg.capacitorTier=Math.min(3,upg.capacitorTier+1);upg.hitChargeGain=Math.min(4.5,upg.hitChargeGain+1.5);}},
  {name:'MINI',tag:'SURVIVE',icon:'·',desc:'−50% size, −25% max HP. Exclusive with Titan Heart.',apply(upg, state){if(upg.miniTaken || upg.titanTier > 0) return; upg.miniTaken = true; upg.playerSizeMult *= 0.5; state.maxHp = Math.max(10, Math.round(state.maxHp * 0.75)); state.hp = Math.min(state.maxHp, Math.max(1, Math.round(state.hp * 0.75)));}},
  {name:'Titan Heart',tag:'SURVIVE',icon:'⬢',desc:'+25% size & +max HP per pick. +5% dmg, −5% spd. Excl. MINI.',apply(upg, state){if(upg.miniTaken || upg.titanTier >= TITAN_HP_PCT.length) return; const hpPct = TITAN_HP_PCT[upg.titanTier]; upg.titanTier++; upg.playerSizeMult = 1 + upg.titanTier * 0.25; upg.playerDamageMult = 1 + upg.titanTier * 0.05; upg.titanSlowMult = Math.max(0.7, 1 - upg.titanTier * TITAN_SLOW_PCT); const gain = Math.max(1, Math.round(state.maxHp * hpPct)); state.maxHp += gain; state.hp = Math.min(state.hp, state.maxHp);}},
  {name:'Protective Shield',tag:'SURVIVE',icon:'🛡️',desc:`Blocks one danger bullet then recharges. +1 per pick. Max ${MAX_SHIELD_TIER}.`,apply(upg){upg.shieldTier=Math.min(MAX_SHIELD_TIER,upg.shieldTier+1);}},
  {name:'Tempered Shield',tag:'SURVIVE',icon:'🛡️+',desc:'Shields become 2-stage: purple absorbs first hit.',apply(upg){if(upg.shieldTempered||upg.shieldTier===0)return; upg.shieldTempered=true;}},
  {name:'Mirror Shield',tag:'SURVIVE',icon:'🪞',desc:'Shields reflect absorbed bullets as output.',isActive:upg=>upg.shieldMirror,apply(upg){if(upg.shieldMirror||upg.shieldTier===0)return; upg.shieldMirror=true;}},
  {name:'Shield Burst',tag:'SURVIVE',icon:'💠',desc:'When a shield breaks, fire a 4-way output burst.',requires:upg=>upg.shieldTier>0,apply(upg){if(upg.shieldBurst)return; upg.shieldBurst=true;},evolvesWith:['Mirror Shield'],evolvedVersion:{name:'Aegis Nova',icon:'💠+',desc:'Reflected bullets also trigger the 4-way burst.',apply(upg){if(upg.shieldBurst)return; upg.shieldBurst=true; upg.aegisNova=true;}}},
  {name:'Barrier Pulse',tag:'SURVIVE',icon:'⬡',desc:'Shield break grants 1.5 charge + magnet pulse.',requires:upg=>upg.shieldTier>0,apply(upg){if(upg.barrierPulse)return; upg.barrierPulse=true;}},
  {name:'Orbit Spheres',tag:'UTILITY',icon:'🔮',desc:'+1 orbiting sphere per pick. Max 5.',apply(upg){upg.orbitSphereTier=Math.min(5,upg.orbitSphereTier+1);}},
  {name:'Volatile Orbs',tag:'OFFENSE',icon:'💥',desc:'Orbit spheres explode on contact with a danger bullet, destroying it.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.volatileOrbs)return; upg.volatileOrbs=true;}},
  {name:'Charged Orbs',tag:'OFFENSE',icon:'⚡',desc:'Each orbit sphere fires a small shot at the nearest enemy every 1.2s.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.chargedOrbs)return; upg.chargedOrbs=true;}},
  {name:'Absorb Orbs',tag:'UTILITY',icon:'🌀',desc:'Grey bullets near an orbit sphere are absorbed automatically.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.absorbOrbs)return; upg.absorbOrbs=true;}},
  {name:'Dense Core',tag:'OFFENSE',icon:'◈',desc:'−2 charge cap, output bullets hit harder. Max 3.',apply(upg){if(upg.denseTier>=3)return; upg.denseTier++; upg.denseDamageMult=1+upg.denseTier*0.2; syncChargeCapacity(upg);}},
  {name:'Echo Fire',tag:'OFFENSE',icon:'↺',desc:'Every 5th shot fires a free echo burst.',apply(upg){if(upg.echoFire)return; upg.echoFire=true;}},
  {name:'Split Shot',tag:'OFFENSE',icon:'⋔',desc:'Output bullets split in two on first wall bounce.',apply(upg){if(upg.splitShot||upg.bounceTier===0)return; upg.splitShot=true;},evolvesWith:['Ricochet'],evolvedVersion:{name:'Fracture',icon:'⋔+',desc:'Bullets split into 3 on bounce, +20% damage.',apply(upg){if(upg.splitShot||upg.bounceTier===0)return; upg.splitShot=true; upg.splitShotEvolved=true; upg.denseDamageMult=(upg.denseDamageMult||1)*1.2;}}},
  {name:'Volatile Rounds',tag:'OFFENSE',icon:'💢',desc:'Piercing shots burst on their final target.',apply(upg){if(upg.volatileRounds||upg.pierceTier===0)return; upg.volatileRounds=true;},evolvesWith:['Pierce'],evolvedVersion:{name:'Chain Reaction',icon:'💢+',desc:'Pierce bursts fire from each enemy hit, not just last.',apply(upg){if(upg.volatileRounds||upg.pierceTier===0)return; upg.volatileRounds=true; upg.volatileAllTargets=true;}}},
  {name:'Slipstream',tag:'UTILITY',icon:'〜',desc:'Near-miss a danger bullet to gain charge. Max 3.',apply(upg){if(upg.slipTier>=3)return; upg.slipTier++; upg.slipChargeGain=getHyperbolicScale(upg.slipTier)*0.3;},evolvesWith:['Kinetic Harvest'],evolvedVersion:{name:'Flux State',icon:'〜+',desc:'Near-miss AND moving gives 2× charge tick.',apply(upg){if(upg.slipTier>=3)return; upg.slipTier++; upg.slipChargeGain=getHyperbolicScale(upg.slipTier)*0.3; upg.fluxState=true;}}},
  {name:'Resonant Absorb',tag:'UTILITY',icon:'≋',desc:'Absorb 3 bullets in 1.5s — last gives 1.5× charge.',apply(upg){if(upg.resonantAbsorb)return; upg.resonantAbsorb=true;},evolvesWith:['Quick Harvest'],evolvedVersion:{name:'Surge Harvest',icon:'≋+',desc:'Combo window 2.5s, multiplier ×2.',apply(upg){if(upg.resonantAbsorb)return; upg.resonantAbsorb=true; upg.surgeHarvest=true;}}},
  {name:'Chain Magnet',tag:'UTILITY',icon:'⤥',desc:'Absorbing a bullet doubles pull range for 0.5s.',apply(upg){if(upg.chainMagnetTier>=2)return; upg.chainMagnetTier++;}},
  {name:'Overcharge Vent',tag:'UTILITY',icon:'⬆',desc:'Firing at full charge gives +40% bullet damage.',apply(upg){if(upg.overchargeVent)return; upg.overchargeVent=true;}},
  {name:'Gravity Well',tag:'UTILITY',icon:'⊙',desc:'Danger bullets within 80px move 30% slower.',apply(upg){if(upg.gravityWell)return; upg.gravityWell=true;}},
  {name:'Sliver',tag:'SURVIVE',icon:'◌',desc:'At ≤25% HP: +30% speed, −25% size.',apply(upg){if(upg.sliver)return; upg.sliver=true;}},
  {name:'Vampiric Return',tag:'SURVIVE',icon:'🩸',desc:'Killing blows restore 2 HP. Up to 3×/room.',apply(upg){if(upg.vampiric)return; upg.vampiric=true;}},
  {name:'Lifeline',tag:'SURVIVE',icon:'♾',desc:'Once per run: a killing blow leaves you at 1 HP.',apply(upg){if(upg.lifeline)return; upg.lifeline=true;},evolvesWith:['Berserker'],evolvedVersion:{name:'Last Stand',icon:'♾+',desc:'Lifeline triggers AND fires a full charge burst.',apply(upg){if(upg.lifeline)return; upg.lifeline=true; upg.lastStand=true;}}},
  {name:'Berserker',tag:'SURVIVE',icon:'🔴',desc:'Max HP→10, +3 SPS tiers, +30% speed. Exclusive.',isActive:upg=>upg.berserker,apply(upg,state){if(upg.berserker||upg.titanTier>0||upg.extraLifeTier>0||upg.regenTick>0)return; upg.berserker=true; state.maxHp=10; state.hp=Math.min(state.hp,10); upg.spsTier=Math.min(SPS_LADDER.length-1,upg.spsTier+3); upg.sps=SPS_LADDER[upg.spsTier]; upg.speedMult*=1.3;}},
  {name:"Dead Man's Trigger",tag:'SURVIVE',icon:'☠',desc:'At 1 HP: ×3 damage and free pierce.',apply(upg){if(upg.deadManTrigger)return; upg.deadManTrigger=true;}},
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
  const SHIELD_MODS = new Set(['Tempered Shield','Mirror Shield','Shield Burst','Aegis Nova','Barrier Pulse']);
  const ORB_MODS    = new Set(['Volatile Orbs','Charged Orbs','Absorb Orbs']);
  const BOUNCE_MODS = new Set(['Split Shot','Fracture']);
  const PIERCE_MODS = new Set(['Volatile Rounds','Chain Reaction']);
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
    boon: { name:'AEGIS TITAN', tag:'LEGENDARY', icon:'🏛️', desc:"Shields never truly break — they recharge in 6s instead.",
      apply(upg){ upg.aegisTitan=true; } }
  },
  {
    id: 'ghostFlow',
    check: (h) => ['Kinetic Harvest','Quick Harvest'].every(n => h.includes(n)) &&
                  (h.includes('Slipstream') || h.includes('Flux State')),
    boon: { name:'GHOST FLOW', tag:'LEGENDARY', icon:'🌊', desc:'Moving through grey bullets auto-absorbs them.',
      apply(upg){ upg.ghostFlow=true; } }
  },
  {
    id: 'corona',
    check: (h) => h.filter(n => n==='Ring Blast').length >= 3,
    boon: { name:'CORONA', tag:'LEGENDARY', icon:'☀️', desc:'All ring shots become homing. Ring cap +4.',
      apply(upg){ upg.corona=true; upg.ringShots=Math.min(12,upg.ringShots+4); syncChargeCapacity(upg); } }
  },
  {
    id: 'finalForm',
    check: (h) => ['Berserker',"Dead Man's Trigger"].every(n => h.includes(n)) &&
                  (h.includes('Lifeline') || h.includes('Last Stand')),
    boon: { name:'FINAL FORM', tag:'LEGENDARY', icon:'💀', desc:'Lifeline gains 2 uses. Dead Man activates at ≤2 HP. +50% speed.',
      apply(upg){ upg.finalForm=true; upg.lifelineUses=(upg.lifelineUses||1)+1; upg.speedMult*=1.5; } }
  },
  {
    id: 'colossus',
    check: (h) => h.filter(n => n==='Titan Heart').length >= 3,
    boon: { name:'COLOSSUS', tag:'LEGENDARY', icon:'⬡', desc:'Danger bullets that hit you are nullified. Regen 1 HP/s.',
      apply(upg){ upg.colossus=true; } }
  },
];

function checkLegendarySequences(history, upg) {
  for(const seq of LEGENDARY_SEQUENCES){
    if(upg[seq.id]) continue; // already have it
    if(seq.check(history)) return seq.boon;
  }
  return null;
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
  if(upg.armorTier > 0) entries.push({ icon: upg.livingFortress?'🧱+':'🧱', name: upg.livingFortress?'Living Fortress':'Armor Weave', detail:`${Math.round((1 - upg.damageTakenMult) * 100)}% damage reduction` });
  if(upg.capacitorTier > 0) entries.push({ icon:'⚕️', name:'Emergency Capacitor', detail:`+${upg.hitChargeGain.toFixed(1)} charge on hit` });
  if(upg.miniTaken) entries.push({ icon:'·', name:'MINI', detail:'50% smaller, 25% less max HP' });
  if(upg.titanTier > 0) entries.push({ icon:'⬢', name:'Titan Heart', detail:`Tier ${upg.titanTier} - +${Math.round((upg.playerDamageMult - 1) * 100)}% dmg, -${Math.round((1 - upg.titanSlowMult) * 100)}% speed` });
  if(upg.shieldTier > 0) entries.push({ icon:'🛡️', name:'Protective Shield', detail:`${upg.shieldTier} shield plate${upg.shieldTier === 1 ? '' : 's'}` });
  if(upg.shieldTempered) entries.push({ icon:'🛡️+', name:'Tempered Shield', detail:'2-stage shields' });
  if(upg.shieldMirror) entries.push({ icon:'🪞', name:'Mirror Shield', detail:'Reflects bullets as output' });
  if(upg.shieldBurst) entries.push({ icon: upg.aegisNova?'💠+':'💠', name: upg.aegisNova?'Aegis Nova':'Shield Burst', detail:'Break fires 4-way burst' });
  if(upg.barrierPulse) entries.push({ icon:'⬡', name:'Barrier Pulse', detail:'+1.5 charge + magnet on break' });
  if(upg.orbitSphereTier > 0) entries.push({ icon:'🔮', name:'Orbit Spheres', detail:`${upg.orbitSphereTier} sphere${upg.orbitSphereTier === 1 ? '' : 's'}` });
  if(upg.denseTier > 0) entries.push({ icon:'◈', name:'Dense Core', detail:`Tier ${upg.denseTier} — ×${upg.denseDamageMult.toFixed(1)} dmg, −${upg.denseTier*2} cap` });
  if(upg.slipTier>0) entries.push({icon: upg.fluxState?'〜+':'〜', name: upg.fluxState?'Flux State':'Slipstream', detail:`+${upg.slipChargeGain.toFixed(2)} charge/near-miss`});
  if(upg.resonantAbsorb) entries.push({icon: upg.surgeHarvest?'≋+':'≋', name: upg.surgeHarvest?'Surge Harvest':'Resonant Absorb', detail:'Combo absorbs give 1.5× charge'});
  if(upg.chainMagnetTier>0) entries.push({icon:'⤥',name:'Chain Magnet',detail:`${(500+250*(upg.chainMagnetTier-1))}ms double pull`});
  if(upg.overchargeVent) entries.push({icon:'⬆',name:'Overcharge Vent',detail:'+40% dmg at full charge'});
  if(upg.gravityWell) entries.push({icon:'⊙',name:'Gravity Well',detail:'Slows nearby danger bullets 30%'});
  if(upg.sliver) entries.push({icon:'◌',name:'Sliver',detail:'Low HP speed+size boost'});
  if(upg.vampiric) entries.push({icon:'🩸',name:'Vampiric Return',detail:'+2 HP per kill, max 3/room'});
  if(upg.lifeline) entries.push({icon: upg.lastStand?'♾+':'♾', name: upg.lastStand?'Last Stand':'Lifeline', detail:upg.lifelineUsed?'SPENT':'1× death save'});
  if(upg.berserker) entries.push({icon:'🔴',name:'Berserker',detail:'HP:10, +3 SPS, +30% spd'});
  if(upg.deadManTrigger) entries.push({icon:'☠',name:"Dead Man's Trigger",detail:'At 1 HP: ×3 dmg + free pierce'});
  if(upg.echoFire) entries.push({icon:'↺',name:'Echo Fire',detail:'Every 5th shot fires free echo'});
  if(upg.splitShot) entries.push({icon: upg.splitShotEvolved?'⋔+':'⋔', name: upg.splitShotEvolved?'Fracture':'Split Shot', detail:'Bullets split on wall bounce'});
  if(upg.volatileRounds) entries.push({icon: upg.volatileAllTargets?'💢+':'💢', name: upg.volatileAllTargets?'Chain Reaction':'Volatile Rounds', detail:'Pierce shots burst on final hit'});
  if(upg.aegisTitan) entries.push({icon:'🏛️',name:'AEGIS TITAN',detail:'Shields use cooldown, never break'});
  if(upg.ghostFlow) entries.push({icon:'🌊',name:'GHOST FLOW',detail:'Move through grey = absorb'});
  if(upg.corona) entries.push({icon:'☀️',name:'CORONA',detail:'Ring shots are homing'});
  if(upg.finalForm) entries.push({icon:'💀',name:'FINAL FORM',detail:'2× lifeline, Dead Man at ≤2 HP'});
  if(upg.colossus) entries.push({icon:'⬡',name:'COLOSSUS',detail:'Bullets nullified on hit, regen 1/s'});
  if(upg.volatileOrbs) entries.push({icon:'💥',name:'Volatile Orbs',detail:'Orbs explode danger bullets'});
  if(upg.chargedOrbs) entries.push({icon:'⚡',name:'Charged Orbs',detail:'Orbs fire shot every 1.2s'});
  if(upg.absorbOrbs) entries.push({icon:'🌀',name:'Absorb Orbs',detail:'Orbs absorb nearby grey bullets'});
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

export { BOONS, SPS_LADDER, getHyperbolicScale, getDefaultUpgrades, getRequiredShotCount, syncChargeCapacity, pickBoonChoices, createHealBoon, getActiveBoonEntries, getEvolvedBoon, checkLegendarySequences };

