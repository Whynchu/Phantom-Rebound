const ENEMY_TYPES = {
  chaser:         {col:'#3b82f6', glowCol:'rgba(59,130,246,0.7)',  r:12,hp:3, spd:55, fRate:1800,burst:1,spread:.22,pts:50,  flee:true,  fleeRange:110, strafeSpd:0.6, doubleBounce:false, spawnValue:2, unlockRoom:0, ammoPressure:1},
  sniper:         {col:'#93c5fd', glowCol:'rgba(147,197,253,0.7)', r:9, hp:2, spd:30, fRate:2800,burst:1,spread:0,  pts:100, flee:true,  fleeRange:150, strafeSpd:0.8, doubleBounce:false, spawnValue:3, unlockRoom:3, ammoPressure:1},
  rusher:         {col:'#f472b6', glowCol:'rgba(244,114,182,0.8)', r:13,hp:4, spd:66, fRate:9999,burst:0,spread:0,  pts:70,  isRusher:true, spawnValue:3, unlockRoom:2, ammoPressure:0},
  siphon:         {col:'#a78bfa', glowCol:'rgba(167,139,250,0.7)', r:13,hp:3, spd:28, fRate:9999,burst:0,spread:0,  pts:120, isSiphon:true, spawnValue:4, unlockRoom:6, ammoPressure:0},
  disruptor:      {col:'#1d4ed8', glowCol:'rgba(29,78,216,0.7)',   r:11,hp:4, spd:46, fRate:750, burst:1,spread:.9, pts:60,  flee:true,  fleeRange:100, strafeSpd:0.7, doubleBounce:false, spawnValue:5, unlockRoom:7, ammoPressure:1},
  zoner:          {col:'#2563eb', glowCol:'rgba(37,99,235,0.7)',   r:15,hp:5, spd:24, fRate:2200,burst:8,spread:6.28,pts:80, flee:true,  fleeRange:130, strafeSpd:0.5, doubleBounce:false, spawnValue:8, unlockRoom:4, ammoPressure:8},
  purple_chaser:  {col:'#a855f7', glowCol:'rgba(168,85,247,0.78)', r:12,hp:4, spd:55, fRate:1800,burst:1,spread:.22,pts:75,  flee:true, fleeRange:110, strafeSpd:0.6, doubleBounce:true, forcePurpleShots:true, spawnValue:6, unlockRoom:9, ammoPressure:2},
  purple_disruptor:{col:'#9333ea', glowCol:'rgba(147,51,234,0.82)',r:11,hp:5, spd:46, fRate:780, burst:1,spread:.9, pts:95,  flee:true, fleeRange:100, strafeSpd:0.7, doubleBounce:true, forcePurpleShots:true, spawnValue:9, unlockRoom:11, ammoPressure:2},
  purple_zoner:   {col:'#9333ea', glowCol:'rgba(147,51,234,0.82)',   r:15,hp:6, spd:24, fRate:2200,burst:8,spread:6.28,pts:120, flee:true, fleeRange:130, strafeSpd:0.5, doubleBounce:true, forcePurpleShots:true, spawnValue:10, unlockRoom:21, ammoPressure:4},
  orange_zoner:   {col:'#ff9500', glowCol:'rgba(255,149,0,0.85)',   r:15,hp:7, spd:24, fRate:2200,burst:8,spread:6.28,pts:130, flee:true, fleeRange:130, strafeSpd:0.5, doubleBounce:false, isElite:true, spawnValue:12, unlockRoom:40, ammoPressure:4},
   triangle:       {col:'#60a5fa', glowCol:'rgba(96,165,250,0.8)',   r:14,hp:6, spd:52, fRate:2000,burst:1,spread:.18,pts:110, flee:true, fleeRange:100, strafeSpd:0.7, doubleBounce:false, spawnValue:6, unlockRoom:20, ammoPressure:1, isTriangle:true},
};

const PURPLE_BULLET_ROOM_THRESHOLD = 9;

function createEnemy(type, { width, height, margin, roomIndex, nextEnemyId, isBoss = false }) {
  const def = ENEMY_TYPES[type];
  const effectiveR = isBoss ? def.r * 3 : def.r;
  const edge = Math.floor(Math.random() * 4);
  let x;
  let y;

  if(edge === 0){x = margin + Math.random() * (width - 2 * margin); y = margin + effectiveR;}
  else if(edge === 1){x = width - margin - effectiveR; y = margin + Math.random() * (height - 2 * margin);}
  else if(edge === 2){x = margin + Math.random() * (width - 2 * margin); y = height - margin - effectiveR;}
  else {x = margin + effectiveR; y = margin + Math.random() * (height - 2 * margin);}

  const roomRamp = Math.min(1, roomIndex / 10);
  const hpScale = (0.28 + roomRamp * 0.72) * (1 + Math.log(roomIndex + 1) * 0.17);
  const tierOver = Math.max(0, roomIndex - 29);
  const room20Mult = roomIndex >= 20 ? 1.25 : 1;
  // Substantially stronger scaling 30+: 8% per room (was 6%)
  const lateTierMult = tierOver > 0 ? 1.18 + tierOver * 0.08 : 1;
  const hpMult = hpScale * room20Mult * lateTierMult;
  // Speed also ramps harder in late game
  const spdMult = (roomIndex >= 20 ? 1.12 : 1) * (tierOver > 0 ? 1.06 + Math.min(0.35, tierOver * 0.015) : 1);
  // Bosses skip elite roll; normal enemies: elite at room 40+, 30% spawn rate
  const isElite = !isBoss && roomIndex >= 40 && Math.random() < 0.30;

  const hpVal = isBoss
    ? Math.max(1, Math.round(def.hp * hpMult * 5))
    : Math.max(1, Math.round(def.hp * hpMult * (isElite ? 1.3 : 1)));

  return {
    ...def,
    eid: nextEnemyId,
    x,
    y,
    r: effectiveR,
    type,
    hp: hpVal,
    maxHp: hpVal,
    spd: def.spd * spdMult * (isBoss ? 0.6 : (isElite ? 1.15 : 1)),
    pts: isBoss ? def.pts * 5 : def.pts,
    fT: Math.random() * def.fRate,
    forcePurpleShots: Boolean(def.forcePurpleShots),
    isBoss,
    isElite,
    eliteStage: 0, // 0=orange, 1=purple, 2=blue for elite enemies
    // Disruptor cooldown: tracks bullet count for cooldown after 5 shots
    disruptorBulletCount: 0,
    disruptorCooldown: 0,
  };
}

function canEnemyUsePurpleShots(enemy) {
  return Boolean(enemy.forcePurpleShots);
}

export { ENEMY_TYPES, PURPLE_BULLET_ROOM_THRESHOLD, createEnemy, canEnemyUsePurpleShots };

