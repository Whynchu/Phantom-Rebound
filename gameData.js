/**
 * Static game data definitions separated for easier iteration and content updates.
 */

const VERSION = { num: '0.42', label: 'Difficulty Tuning' };

const C = {
  bg:'#161616', grid:'rgba(255,255,255,0.025)', border:'rgba(255,255,255,0.1)',
  danger:'#60a5fa', dangerCore:'rgba(200,230,255,0.9)',
  grey:'#888', green:'#4ade80', ghost:'#b8ffcc', siphon:'#a78bfa',
};

const ROOM_SCRIPTS = [
  { name:'ARRIVAL',   chaos:0,    waves:[ [{t:'chaser',   n:1, d:0}] ] },
  { name:'PATROL',    chaos:0,    waves:[ [{t:'chaser',   n:2, d:0}] ] },
  { name:'RUSH',      chaos:0,    waves:[ [{t:'chaser',   n:1, d:0},{t:'rusher', n:1, d:0}] ] },
  { name:'MARKSMAN',  chaos:0.05, waves:[ [{t:'chaser',   n:2, d:0},{t:'sniper', n:1, d:0}] ] },
  { name:'ZONE',      chaos:0.1,  waves:[ [{t:'chaser',   n:2, d:0},{t:'zoner',  n:1, d:0}] ] },
  { name:'PINCER',    chaos:0.1,  waves:[ [{t:'sniper',   n:2, d:0},{t:'rusher', n:2, d:0}] ] },
  { name:'DRAIN',     chaos:0.15, waves:[ [{t:'chaser',   n:2, d:0},{t:'siphon', n:1, d:0}] ] },
  { name:'STATIC',    chaos:0.15, waves:[ [{t:'chaser',   n:2, d:0},{t:'disruptor',n:1,d:0}] ] },
  { name:'CROSSFIRE', chaos:0.2,  waves:[ [{t:'sniper',   n:1, d:0},{t:'zoner',  n:1, d:0},{t:'rusher',n:1,d:0}] ] },
  { name:'BARRAGE',   chaos:0.25, waves:[ [{t:'disruptor',n:2, d:0},{t:'rusher', n:1, d:0},{t:'siphon',n:1,d:0}] ] },
  { name:'SIEGE',     chaos:0.3,  waves:[ [{t:'chaser',   n:2, d:0},{t:'zoner',  n:1, d:0},{t:'sniper',n:1,d:0},{t:'rusher',n:2,d:0}] ] },
  { name:'VORTEX',    chaos:0.35, waves:[ [{t:'disruptor',n:2, d:0},{t:'sniper', n:1, d:0},{t:'rusher',n:2,d:0},{t:'siphon',n:1,d:0}] ] },
];

const EDEFS = {
  chaser:    {col:'#3b82f6', glowCol:'rgba(59,130,246,0.7)',  r:12,hp:3, spd:55, fRate:1800,burst:1,spread:.22,pts:50,  flee:true,  fleeRange:110, strafeSpd:0.6, doubleBounce:true},
  zoner:     {col:'#2563eb', glowCol:'rgba(37,99,235,0.7)',   r:15,hp:5, spd:24, fRate:2200,burst:8,spread:6.28,pts:80, flee:true,  fleeRange:130, strafeSpd:0.5},
  sniper:    {col:'#93c5fd', glowCol:'rgba(147,197,253,0.7)', r:9, hp:2, spd:30, fRate:2800,burst:1,spread:0,  pts:100, flee:true,  fleeRange:150, strafeSpd:0.8},
  disruptor: {col:'#1d4ed8', glowCol:'rgba(29,78,216,0.7)',   r:11,hp:4, spd:46, fRate:750, burst:1,spread:.9, pts:60,  flee:true,  fleeRange:100, strafeSpd:0.7, doubleBounce:true},
  siphon:    {col:'#a78bfa', glowCol:'rgba(167,139,250,0.7)', r:13,hp:3, spd:28, fRate:9999,burst:0,spread:0,  pts:120, isSiphon:true},
  rusher:    {col:'#f472b6', glowCol:'rgba(244,114,182,0.8)', r:13,hp:4, spd:90, fRate:9999,burst:0,spread:0,  pts:70,  isRusher:true},
};

const SPS_LADDER = [0.5,1.0,1.8,3.0,5.0,8.0];
const DECAY_BASE = 3500;
const M = 18;

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

const UPGRADES = [
  {name:'Rapid Fire', tag:'OFFENSE', icon:'⚡', desc:'Unlock next fire rate tier. Shoot faster.', apply(upg){ if(upg.spsTier<SPS_LADDER.length-1){upg.spsTier++;upg.sps=SPS_LADDER[upg.spsTier];}}},
  {name:'Triple Shot',tag:'OFFENSE',icon:'🔱',desc:'Add two side bullets to each shot.',apply(upg){upg.spreadTier=Math.max(upg.spreadTier,1);upg.spreadTierObtained=true;}},
  {name:'Penta Shot', tag:'OFFENSE',icon:'✦',desc:'Add two wider side bullets on top of spread.', apply(upg){upg.spreadTier=Math.max(upg.spreadTier,2);upg.spreadTierObtained=true;}},
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

export { C, ROOM_SCRIPTS, EDEFS, SPS_LADDER, DECAY_BASE, M, UPGRADES, getDefaultUpgrades, MAX_SHIELD_TIER, getHyperbolicScale, VERSION };
