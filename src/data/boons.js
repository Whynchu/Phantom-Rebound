const SPS_LADDER = [0.5,1.0,1.8,3.0,5.0,8.0];
const MAX_SHIELD_TIER = 4;

// Returns a multiplier with diminishing returns approaching ~1.45x ceiling.
// tier 1: ~1.18x, tier 2: ~1.26x, tier 5: ~1.35x, tier 10: ~1.39x
function getHyperbolicScale(tier) {
  return 1 + (tier * 0.45) / (tier + 1.5);
}

function getDefaultUpgrades() {
  return {
    speedMult:        1,
    sps:              0.5,
    spsTier:          0,
    spreadTier:       0,
    spreadTierObtained: false,
    ringShots:        0,
    dualShot:         0,
    snipePower:       0,
    maxCharge:        10,
    decayBonus:       0,
    absorbValue:      1,
    pierceTier:       0,
    bounceTier:       0,
    homingTier:       0,
    shotSize:         1,
    shotSpd:          1,
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
  };
}

const BOONS = [
  {name:'Rapid Fire', tag:'OFFENSE', icon:'⚡', desc:'Unlock next fire rate tier. Shoot faster.', apply(upg){ if(upg.spsTier<SPS_LADDER.length-1){upg.spsTier++;upg.sps=SPS_LADDER[upg.spsTier];}}},
  {name:'Ring Blast',tag:'OFFENSE',icon:'◎',desc:'Add one radial bullet per cycle (max 8 total).',apply(upg){upg.ringShots=Math.min(8,upg.ringShots+1);}},
  {name:'Front+Back',tag:'OFFENSE',icon:'↕',desc:'Add a reverse shot behind you.',apply(upg){upg.dualShot=1;}},
  {name:'Snipe Shot',tag:'OFFENSE',icon:'🎯',desc:'All output bullets gain size, speed, and damage.',apply(upg){upg.snipePower=Math.min(3,upg.snipePower+1);}},
  {name:'Bigger Bullets',tag:'OFFENSE',icon:'🔵',desc:'Output bullets grow larger (diminishing returns).',apply(upg){upg.biggerBulletsTier++;upg.shotSize=getHyperbolicScale(upg.biggerBulletsTier);}},
  {name:'Faster Bullets',tag:'OFFENSE',icon:'💨',desc:'Output bullets travel faster (diminishing returns).',apply(upg){upg.fasterBulletsTier++;upg.shotSpd=getHyperbolicScale(upg.fasterBulletsTier);}},
  {name:'Critical Hit',tag:'OFFENSE',icon:'💥',desc:'+20% crit chance each shot deals double damage (max 2 picks).',apply(upg){upg.critTier=Math.min(2,upg.critTier+1);upg.critChance=Math.min(0.6,0.2*upg.critTier);}},
  {name:'Ricochet',tag:'UTILITY',icon:'↯',desc:'Your output bullets bounce off walls up to 2 times.',apply(upg){upg.bounceTier=Math.max(1,upg.bounceTier);}},
  {name:'Homing',tag:'UTILITY',icon:'🌀',desc:'Output bullets curve toward the nearest enemy.',apply(upg){upg.homingTier=1;}},
  {name:'Pierce',tag:'UTILITY',icon:'→',desc:'Bullets penetrate one extra enemy per tier.',apply(upg){upg.pierceTier=Math.min(3,upg.pierceTier+1);}},
  {name:'Quick Harvest',tag:'UTILITY',icon:'⬇',desc:'Absorbing grey bullets grants more charge (diminishing returns).',apply(upg){upg.absorbTier++;upg.absorbValue=1+0.4*getHyperbolicScale(upg.absorbTier);}},
  {name:'Decay Extension',tag:'UTILITY',icon:'⏳',desc:'Grey bullets linger 1s longer for easier harvest (max 3s bonus).',apply(upg){upg.decayBonus=Math.min(3000,upg.decayBonus+1000);}},
  {name:'Charge Cap Up',tag:'UTILITY',icon:'◆',desc:'Expand your charge capacity (diminishing returns).',apply(upg){upg.chargeCapTier++;const bonus=Math.round(8*getHyperbolicScale(upg.chargeCapTier));upg.maxCharge+=bonus;}},
  {name:'Wider Absorb',tag:'UTILITY',icon:'🧲',desc:'Pull grey bullets from farther away (max +50).',apply(upg){upg.absorbRange=Math.min(50,upg.absorbRange+12);}},
  {name:'Extra Life',tag:'SURVIVE',icon:'◉',desc:'Gain max HP and restore it (diminishing bonus per pick).',apply(upg, state){upg.extraLifeTier++;const heal=Math.max(3,15-(upg.extraLifeTier-1)*2);state.maxHp+=heal;state.hp=Math.min(state.hp+heal,state.maxHp);}},
  {name:'Ghost Velocity',tag:'SURVIVE',icon:'👻',desc:'Move faster through the arena (diminishing returns).',apply(upg){upg.speedTier++;upg.speedMult=getHyperbolicScale(upg.speedTier);}},
  {name:'Room Regen',tag:'SURVIVE',icon:'💚',desc:'Restore HP whenever you clear a room (max 30 HP/room).',apply(upg){upg.regenTick=Math.min(30,upg.regenTick+10);}},
  {name:'Protective Shield',tag:'SURVIVE',icon:'🛡️',desc:`Orbiting shield absorbs one danger bullet then regenerates. Each upgrade adds another shield (max ${MAX_SHIELD_TIER}).`,apply(upg){upg.shieldTier=Math.min(MAX_SHIELD_TIER,upg.shieldTier+1);}},
  {name:'Orbit Spheres',tag:'UTILITY',icon:'🔮',desc:'Add one orbiting sphere (up to 5). Each pick adds another.',apply(upg){upg.orbitSphereTier=Math.min(5,upg.orbitSphereTier+1);}},
];

function pickBoonChoices(upg, hp, maxHp, choiceCount = 3) {
  const source = [...BOONS].sort(() => Math.random() - 0.5);
  return source.slice(0, choiceCount);
}

export { BOONS, SPS_LADDER, getHyperbolicScale, getDefaultUpgrades, pickBoonChoices };
