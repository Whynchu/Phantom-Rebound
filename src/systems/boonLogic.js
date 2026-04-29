import {
  HEAL_PCT,
  BERSERKER_HP,
  EXTRA_LIFE_GAINS,
  CHARGED_ORB_FIRE_INTERVAL_MS,
  ESCALATION_KILL_PCT,
  ESCALATION_MAX_BONUS,
} from '../data/boonConstants.js';
import { simRng } from './seededRng.js';
import { BOONS, LEGENDARY_SEQUENCES } from '../data/boonDefinitions.js';
import {
  getKineticChargeMultiplier,
  getKineticFastFillPct,
  getKineticChargeRate,
  getPayloadBlastRadius,
  getLateBloomBonusPct,
} from './boonHelpers.js';

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

function checkLegendarySequences(history, upg, rejectedIds = [], roomsSinceReject = {}, currentRoom = 0) {
  const available = [];
  for(const seq of LEGENDARY_SEQUENCES){
    if(upg[seq.id]) continue; // already have it
    if(rejectedIds.includes(seq.id)) {
      const rejectedAtRoom = roomsSinceReject[seq.id] || 0;
      if(currentRoom - rejectedAtRoom < 2) continue; // skip if within 2-room cooldown
    }
    if(seq.check(history)) available.push(seq.boon);
  }
  // Return random legendary from available pool, or null if none available
  return available.length > 0 ? available[Math.floor(simRng.next() * available.length)] : null;
}

function weightedPickBoon(pool, upg) {
  const totalWeight = pool.reduce((sum, boon) => sum + getBoonWeight(boon, upg), 0);
  let roll = simRng.next() * totalWeight;
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
  if(upg.extraLifeTier > 0) entries.push({ icon:'◉', name:'Extra Life', detail:`Tier ${upg.extraLifeTier} — +HP, ${Math.round((1 - (upg.extraLifeSlowMult || 1)) * 100)}% slow` });
  if(upg.speedTier > 0) entries.push({ icon:'👻', name:'Ghost Velocity', detail:`+${Math.round((upg.speedMult - 1) * 100)}% move speed` });
  if(upg.regenTick > 0) entries.push({ icon:'💚', name:'Room Regen', detail:`${upg.regenTick} HP per room clear` });
  if(upg.armorTier > 0) entries.push({ icon: upg.livingFortress?'🧱+':'🧱', name: upg.livingFortress?'Living Fortress':'Armor Weave', detail:`${Math.round((1 - upg.damageTakenMult) * 100)}% damage reduction` });
  if(upg.capacitorTier > 0) entries.push({ icon:'⚕️', name:'Hit Battery', detail:`+${upg.hitChargeGain.toFixed(1)} charge on hit` });
  const miniTier = Math.max(upg.miniTier || 0, upg.miniTaken ? 1 : 0);
  if(miniTier > 0) entries.push({ icon:'·', name:'MINI', detail:`Tier ${miniTier} — -20% size, -10% HP, +${Math.round(((upg.miniShotSpdMult || 1) - 1) * 100)}% shot speed, ${Math.round((upg.critChance || 0) * 100)}% crit` });
  if(upg.titanTier > 0) entries.push({ icon:'⬢', name:'Titan Heart', detail:`Tier ${upg.titanTier} - +${Math.round((upg.playerDamageMult - 1) * 100)}% dmg, -${Math.round((1 - upg.titanSlowMult) * 100)}% speed` });
  if(upg.shieldTier > 0) entries.push({ icon:'🛡️', name:'Shield Plate', detail:`${upg.shieldTier} plate${upg.shieldTier === 1 ? '' : 's'}` });
  if(upg.shieldTempered) entries.push({ icon:'🛡️+', name:'Tempered Shield', detail:'2-stage shields' });
  if(upg.shieldMirror) entries.push({ icon:'🪞', name:'Mirror Shield', detail:'60% countershots' });
  if(upg.shieldBurst) entries.push({ icon: upg.aegisNova?'💠+':'💠', name: upg.aegisNova?'Aegis Nova':'Shield Burst', detail:'Break fires 4-way 55% burst' });
  if(upg.barrierPulse) entries.push({ icon:'⬡', name:'Barrier Pulse', detail:'+2 charge + magnet on break' });
  if(upg.shieldRegenTier>0) entries.push({ icon:'⚡🛡️', name:'Swift Ward', detail:`Shields recharge in ${Math.max(1.5, 4.5-upg.shieldRegenTier*2).toFixed(1)}s` });
  if(upg.aegisBattery) entries.push({ icon:'🔋', name:'Aegis Battery', detail:'Ready shields boost returns; full set fires bolts' });
  if(upg.orbitSphereTier > 0) entries.push({ icon:'🔮', name:'Orbit Spheres', detail:`${upg.orbitSphereTier} sphere${upg.orbitSphereTier === 1 ? '' : 's'}` });
  if(upg.conduit) entries.push({ icon:'⚡', name:'CONDUIT', detail:`${upg.conduitArcDmg || 0} arc damage every ${(upg.conduitArcTickMs || 0)}ms` });
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
  if(upg.glassCannonTier > 0) entries.push({icon:'⚗',name:'Glass Cannon',detail:`Tier ${upg.glassCannonTier} — ×${(upg.playerDamageMult || 1).toFixed(2)} total damage`});
  if(upg.adrenalSurgeTier > 0) entries.push({icon:'🫀',name:'Adrenal Surge',detail:`${Math.min(upg.adrenalSurgeTier, Array.isArray(upg.adrenalStackExpiries) ? upg.adrenalStackExpiries.length : 0)}/${upg.adrenalSurgeTier} active stacks`});
  if(upg.tetherOrbit) entries.push({icon:'🪢',name:'Tether Orbit',detail:'Orbit ring slows danger bullets'});

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

// Fisher–Yates shuffle using simRng. Replaces `.sort(() => simRng.next() - 0.5)`
// which is NOT deterministic across engines — V8's TimSort calls the comparator a
// variable number of times depending on input order, so two peers running the
// same seed but different engine versions could produce different orderings.
// Fisher–Yates touches each slot exactly once and consumes a fixed number of RNG
// values, so it is byte-deterministic across any engine that runs the same JS.
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(simRng.next() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function pickBoonChoices(upg, hp, maxHp, choiceCount = 3) {
  const available = BOONS.filter((boon) => boonHasEffect(boon, upg, hp, maxHp));
  const byTag = {
    OFFENSE: shuffleInPlace(available.filter((boon) => boon.tag === 'OFFENSE')),
    UTILITY: shuffleInPlace(available.filter((boon) => boon.tag === 'UTILITY')),
    SURVIVE: shuffleInPlace(available.filter((boon) => boon.tag === 'SURVIVE')),
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
    const remaining = shuffleInPlace(
      [...available].filter((boon) => !picks.includes(boon)),
    );
    while(picks.length < choiceCount && remaining.length > 0) picks.push(remaining.shift());
  }
  return picks;
}

export {
  boonHasEffect,
  getBoonWeight,
  getEvolvedBoon,
  checkLegendarySequences,
  weightedPickBoon,
  createHealBoon,
  getActiveBoonEntries,
  pickBoonChoices,
};
