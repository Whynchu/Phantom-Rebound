const ENEMY_TYPES = {
  chaser:    {col:'#3b82f6', glowCol:'rgba(59,130,246,0.7)',  r:12,hp:3, spd:55, fRate:1800,burst:1,spread:.22,pts:50,  flee:true,  fleeRange:110, strafeSpd:0.6, doubleBounce:true},
  zoner:     {col:'#2563eb', glowCol:'rgba(37,99,235,0.7)',   r:15,hp:5, spd:24, fRate:2200,burst:8,spread:6.28,pts:80, flee:true,  fleeRange:130, strafeSpd:0.5},
  sniper:    {col:'#93c5fd', glowCol:'rgba(147,197,253,0.7)', r:9, hp:2, spd:30, fRate:2800,burst:1,spread:0,  pts:100, flee:true,  fleeRange:150, strafeSpd:0.8},
  disruptor: {col:'#1d4ed8', glowCol:'rgba(29,78,216,0.7)',   r:11,hp:4, spd:46, fRate:750, burst:1,spread:.9, pts:60,  flee:true,  fleeRange:100, strafeSpd:0.7, doubleBounce:true},
  siphon:    {col:'#a78bfa', glowCol:'rgba(167,139,250,0.7)', r:13,hp:3, spd:28, fRate:9999,burst:0,spread:0,  pts:120, isSiphon:true},
  rusher:    {col:'#f472b6', glowCol:'rgba(244,114,182,0.8)', r:13,hp:4, spd:72, fRate:9999,burst:0,spread:0,  pts:70,  isRusher:true},
};

const PURPLE_BULLET_ROOM_THRESHOLD = 9;

function createEnemy(type, { width, height, margin, roomIndex, nextEnemyId }) {
  const def = ENEMY_TYPES[type];
  const edge = Math.floor(Math.random() * 4);
  let x;
  let y;

  if(edge === 0){x = margin + Math.random() * (width - 2 * margin); y = margin + def.r;}
  else if(edge === 1){x = width - margin - def.r; y = margin + Math.random() * (height - 2 * margin);}
  else if(edge === 2){x = margin + Math.random() * (width - 2 * margin); y = height - margin - def.r;}
  else {x = margin + def.r; y = margin + Math.random() * (height - 2 * margin);}

  // Early rooms start much lighter, then ramp back toward the old curve.
  const roomRamp = Math.min(1, roomIndex / 6);
  const hpScale = (0.52 + roomRamp * 0.48) * (1 + Math.log(roomIndex + 1) * 0.35);

  return {
    ...def,
    eid: nextEnemyId,
    x,
    y,
    type,
    hp: Math.max(1, Math.round(def.hp * hpScale)),
    maxHp: Math.max(1, Math.round(def.hp * hpScale)),
    fT: Math.random() * def.fRate,
  };
}

function canEnemyUsePurpleShots(enemy, roomIndex) {
  return enemy.doubleBounce && roomIndex >= PURPLE_BULLET_ROOM_THRESHOLD;
}

export { ENEMY_TYPES, PURPLE_BULLET_ROOM_THRESHOLD, createEnemy, canEnemyUsePurpleShots };
