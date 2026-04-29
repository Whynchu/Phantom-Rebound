import {
  SPS_LADDER,
  MAX_SHIELD_TIER,
  TITAN_HP_PCT,
  TITAN_SLOW_PCT,
  TITAN_MAX_SIZE_MULT,
  MINI_MAX_TIER,
  MINI_SIZE_MULT_PER_TIER,
  MINI_HP_MULT_PER_TIER,
  MINI_SHOT_SPD_PER_TIER,
  MINI_CRIT_CHANCE_PER_TIER,
  MINI_T3_CRIT_DMG_BONUS,
  HEAL_PCT,
  BERSERKER_HP,
  EXTRA_LIFE_GAINS,
  EXTRA_LIFE_SLOW_PER_TIER,
  ROOM_REGEN_PER_PICK,
  ROOM_REGEN_MAX,
  BASE_CHARGE_CAP,
  CHARGE_CAP_PCT,
  MAX_CHARGE_CAP_MULT,
  MAX_DEEP_RESERVE_BONUS,
  DENSE_CORE_DAMAGE_MULTS,
  DENSE_CORE_CAP_SCALES,
} from './boonConstants.js';
import {
  getHyperbolicScale,
  syncChargeCapacity,
  getRequiredShotCount,
  hasLateBloomVariant,
  getFlatChargeGain,
} from '../systems/boonHelpers.js';

const BOONS = [
  {name:'Rapid Fire', tag:'OFFENSE', icon:'⚡', desc:'Next fire-rate tier.', apply(upg){ if(upg.spsTier<SPS_LADDER.length-1){upg.spsTier++;upg.sps=SPS_LADDER[upg.spsTier];}}},
  {name:'Ring Blast',tag:'OFFENSE',icon:'◎',desc:'+1 radial shot. Max 8.',apply(upg){upg.ringShots=Math.min(8,upg.ringShots+1);syncChargeCapacity(upg);}},
  {name:'Backshot',tag:'OFFENSE',icon:'↕',desc:'Adds a rear shot.',apply(upg){upg.dualShot=1;syncChargeCapacity(upg);}},
  {name:'Snipe Shot',tag:'OFFENSE',icon:'🎯',desc:'+shot size, speed, and damage.',apply(upg){upg.snipePower=Math.min(3,upg.snipePower+1);}},
  {name:'Twin Lance',tag:'OFFENSE',icon:'≫',desc:'+1 forward lane.',apply(upg){upg.forwardShotTier++;syncChargeCapacity(upg);}},
  {name:'Bigger Bullets',tag:'OFFENSE',icon:'🔵',desc:'Larger shots. Diminishing returns.',apply(upg){upg.biggerBulletsTier++;const scale=getHyperbolicScale(upg.biggerBulletsTier);upg.shotSize=scale*(upg.biggerBulletsTier===1?1.06:1);}},
  {name:'Faster Bullets',tag:'OFFENSE',icon:'💨',desc:'Faster shots. Diminishing returns.',apply(upg){upg.fasterBulletsTier++;const scale=getHyperbolicScale(upg.fasterBulletsTier);upg.shotSpd=scale*(upg.fasterBulletsTier===1?1.06:1);}},
  {name:'Critical Hit',tag:'OFFENSE',icon:'💥',desc:'+25% crit chance. Max 3.',apply(upg){upg.critTier=Math.min(3,upg.critTier+1);upg.critChance=Math.min(0.75,0.25*upg.critTier);}},
  {name:'Ricochet',tag:'UTILITY',icon:'↯',desc:'Shots bounce off walls.',apply(upg){upg.bounceTier=Math.max(1,upg.bounceTier);}},
  {name:'Homing',tag:'UTILITY',icon:'🌀',desc:'Shots curve into enemies. Max 4.',apply(upg){upg.homingTier=Math.min(4,upg.homingTier+1);}},
  {name:'Pierce',tag:'UTILITY',icon:'→',desc:'+1 pierce per tier. Max 3.',apply(upg){upg.pierceTier=Math.min(3,upg.pierceTier+1);}},
  {name:'Quick Harvest',tag:'UTILITY',icon:'⬇',desc:'Grey absorbs grant more charge.',apply(upg){upg.absorbTier++;upg.absorbValue=1+0.40*getHyperbolicScale(upg.absorbTier);}},
  {name:'Decay Extension',tag:'UTILITY',icon:'⏳',desc:'+1s grey linger. Max +3s.',apply(upg){upg.decayBonus=Math.min(3000,upg.decayBonus+1000);}},
  {name:'Capacity Boost',tag:'UTILITY',icon:'◆',desc:'+16% base charge cap and at least +2 charge per pick. Max +100%.',apply(upg){if((upg.chargeCapMult||1) >= MAX_CHARGE_CAP_MULT)return; upg.chargeCapTier++;upg.chargeCapMult = Math.min(MAX_CHARGE_CAP_MULT, 1 + upg.chargeCapTier * CHARGE_CAP_PCT);syncChargeCapacity(upg);}},
  {name:'Deep Reserve',tag:'UTILITY',icon:'▣',desc:'+flat charge. Starts at +16, caps at +120.',apply(upg){if((upg.chargeCapFlatBonus||0) >= MAX_DEEP_RESERVE_BONUS)return; upg.chargeCapFlatTier++;upg.chargeCapFlatBonus = Math.min(MAX_DEEP_RESERVE_BONUS, (upg.chargeCapFlatBonus||0) + Math.max(4, Math.round(16 / (1 + (upg.chargeCapFlatTier-1) * 0.28))));syncChargeCapacity(upg);}},
  {name:'Wider Absorb',tag:'UTILITY',icon:'🧲',desc:'More absorb range. Max +60.',apply(upg){upg.absorbRange=Math.min(60,upg.absorbRange+15);}},
  {name:'Long Reach',tag:'UTILITY',icon:'➶',desc:'Shots last longer.',apply(upg){upg.shotLifeTier++;upg.shotLifeMult=getHyperbolicScale(upg.shotLifeTier);}},
  {name:'Kinetic Harvest',tag:'UTILITY',icon:'🌀',desc:'Gain charge while moving. Low charge refills faster.',apply(upg){upg.kineticTier++;const baseMoveRate=getHyperbolicScale(upg.kineticTier)*0.45;const spsSynergy=1+(upg.spsTier||0)*0.15;upg.moveChargeRate=baseMoveRate*spsSynergy;}},
  {name:'Steady Aim',tag:'UTILITY',icon:'🎯+',desc:'+15% mobile charge rate. Max 3.',apply(upg){if((upg.mobileChargeRate||0.10)>=0.55)return; upg.mobileChargeRate=Math.min(0.55,(upg.mobileChargeRate||0.10)+0.15);}},
  {name:'Extra Life',tag:'SURVIVE',icon:'◉',desc:'+max HP and heal on pickup. Slightly slows movement.',apply(upg, state){upg.extraLifeTier++;const idx=Math.min(EXTRA_LIFE_GAINS.length-1, upg.extraLifeTier-1);const heal=EXTRA_LIFE_GAINS[idx];state.maxHp+=heal;state.hp=Math.min(state.hp+heal,state.maxHp);upg.extraLifeSlowMult=(upg.extraLifeSlowMult||1)*EXTRA_LIFE_SLOW_PER_TIER;}},
  {name:'Ghost Velocity',tag:'SURVIVE',icon:'👻',desc:'Move faster. Diminishing returns.',apply(upg){upg.speedTier++;upg.speedMult=getHyperbolicScale(upg.speedTier);}},
  {name:'Room Regen',tag:'SURVIVE',icon:'💚',desc:'+18 HP on room clear. Max 54.',apply(upg){upg.regenTick=Math.min(ROOM_REGEN_MAX,upg.regenTick+ROOM_REGEN_PER_PICK);}},
  {name:'Armor Weave',tag:'SURVIVE',icon:'🧱',desc:'Damage taken: -18% / -36% / -50%.',apply(upg){const multipliers=[1,0.82,0.64,0.5];upg.armorTier=Math.min(3,upg.armorTier+1);upg.damageTakenMult=multipliers[upg.armorTier];},evolvesWith:['Titan Heart'],evolvedVersion:{name:'Living Fortress',icon:'🧱+',desc:'Armor scales with missing HP.',apply(upg){const multipliers=[1,0.82,0.64,0.5];upg.armorTier=Math.min(3,upg.armorTier+1);upg.damageTakenMult=multipliers[upg.armorTier];upg.livingFortress=true;}}},
  {name:'Hit Battery',tag:'SURVIVE',icon:'⚕️',desc:'Getting hit grants charge. Max 3.',apply(upg){upg.capacitorTier=Math.min(3,upg.capacitorTier+1);upg.hitChargeGain=Math.min(6,upg.hitChargeGain+2);}},
  {name:'MINI',tag:'SURVIVE',icon:'·',desc:'Tiered shrink (max 3). Each tier: -20% size, -10% max HP, +10% shot speed, +5% crit. T3: +20% crit damage. No Titan Heart.',apply(upg, state){const currentMiniTier = Math.max(upg.miniTier || 0, upg.miniTaken ? 1 : 0); if(currentMiniTier >= MINI_MAX_TIER || upg.titanTier > 0) return; const nextMiniTier = currentMiniTier + 1; upg.miniTier = nextMiniTier; upg.miniTaken = true; upg.playerSizeMult *= MINI_SIZE_MULT_PER_TIER; upg.miniShotSpdMult = 1 + nextMiniTier * MINI_SHOT_SPD_PER_TIER; upg.critChance = Math.min(0.95, (upg.critChance || 0) + MINI_CRIT_CHANCE_PER_TIER); upg.critDamageBonus = nextMiniTier >= 3 ? MINI_T3_CRIT_DMG_BONUS : 0; state.maxHp = Math.max(10, Math.round(state.maxHp * MINI_HP_MULT_PER_TIER)); state.hp = Math.min(state.maxHp, Math.max(1, Math.round(state.hp * MINI_HP_MULT_PER_TIER)));}},
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
  {name:'Glass Cannon',tag:'OFFENSE',icon:'⚗',desc:'Big damage, shrinking HP pool. Max 5.',apply(upg,state){const damageMults=[1.10,1.15,1.25,1.35,1.50];if(upg.glassCannonTier>=damageMults.length)return; const tier=upg.glassCannonTier; upg.glassCannonTier++; upg.playerDamageMult*=damageMults[tier]; state.maxHp=Math.max(20,Math.round(state.maxHp*0.92)); state.hp=Math.min(state.hp,state.maxHp);}},
  {name:'Adrenal Surge',tag:'SURVIVE',icon:'🫀',desc:'Taking damage stacks temporary fire-rate tiers. Max 4.',apply(upg){if(upg.adrenalSurgeTier>=4)return; upg.adrenalSurgeTier++; if(!Array.isArray(upg.adrenalStackExpiries)) upg.adrenalStackExpiries=[];}},
  {name:'Tether Orbit',tag:'UTILITY',icon:'🪢',desc:'Orbit spheres slow danger bullets crossing their ring.',requires:upg=>upg.orbitSphereTier>0,apply(upg){if(upg.tetherOrbit)return; upg.tetherOrbit=true;}},
  
  // Phase 5: Bullet Alchemy
  {name:'Refraction',tag:'OFFENSE',icon:'💡',desc:'Absorbs fire weak homing shots.',requires:upg=>upg.absorbTier>0,apply(upg){if(upg.refraction)return; upg.refraction=true;}},
  {name:'Mirror Tide',tag:'OFFENSE',icon:'🪞',desc:'Reflect the next hit. More picks = more room uses.',requires:upg=>upg.armorTier>0,apply(upg){if(upg.mirrorTideTier>=3)return; upg.mirrorTide=true; upg.mirrorTideTier++; upg.mirrorTideRoomLimit=upg.mirrorTideTier;}},
  
  // Phase 6: Active Abilities
  {name:'Phase Dash',tag:'SURVIVE',icon:'💨',desc:'On hit, auto-dash and take 5% damage.',apply(upg){if(upg.phaseDashTier>=3)return; upg.phaseDash=true; upg.phaseDashTier++; upg.phaseDashRoomLimit=upg.phaseDashTier;}},
  {name:'Overload',tag:'OFFENSE',icon:'⚡',desc:'Full charge converts your whole bank into a giant scaled volley.',apply(upg){if(upg.overload)return; upg.overload=true;}},
  {name:'EMP Burst',tag:'SURVIVE',icon:'💥',desc:'Low-HP hit clears danger bullets.',requires:upg=>upg.capacitorTier>0,apply(upg){if(upg.empBurst)return; upg.empBurst=true;}},
];

const LEGENDARY_SEQUENCES = [
  {
    id: 'aegisTitan',
    check: (h) => ['Mirror Shield','Shield Burst','Tempered Shield'].every(n => h.includes(n)),
    boon: { name:'AEGIS TITAN', tag:'LEGENDARY', icon:'🏛️', desc:'Shield Burst fires 8-way. Mirror reflects deal ×2 damage. All shields share one cooldown.',
      apply(upg){ upg.aegisTitan=true; } }
  },
  {
    id: 'conduit',
    check: () => false,
    boon: { name:'CONDUIT', tag:'LEGENDARY', icon:'⚡', desc:'Lightning arcs between your orbs, shocking anything caught in the web. Stacks with all orb boons. Exclusive.', requires: upg => upg.orbitSphereTier >= 2 && !upg.berserker && upg.titanTier === 0, apply(upg){ if(upg.conduit || upg.berserker || upg.titanTier > 0 || upg.orbitSphereTier < 2) return; upg.conduit = true; upg.conduitArcDmg = 6; upg.conduitArcTickMs = 120; } },
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

export { BOONS, LEGENDARY_SEQUENCES };
