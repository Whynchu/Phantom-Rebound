import { getThreatPalette } from '../data/colorScheme.js';

const GLOBAL_SPEED_LIFT = 1.07;

const ENEMY_TYPES = {
  chaser:         {colorRole:'danger',       r:12,hp:3, spd:55, fRate:1800,burst:1,spread:.22,pts:50,  flee:true,  fleeRange:110, strafeSpd:0.6, doubleBounce:false, spawnValue:2, unlockRoom:0, ammoPressure:1},
  sniper:         {colorRole:'dangerLight',  r:9, hp:2, spd:30, fRate:2800,burst:1,spread:0,  pts:100, flee:true,  fleeRange:150, strafeSpd:0.8, doubleBounce:false, spawnValue:3, unlockRoom:3, ammoPressure:1},
  rusher:         {colorRole:'aggressive',   r:13,hp:4, spd:66, fRate:9999,burst:0,spread:0,  pts:70,  isRusher:true, spawnValue:3, unlockRoom:2, ammoPressure:0},
  siphon:         {colorRole:'siphon',       r:13,hp:3, spd:28, fRate:9999,burst:0,spread:0,  pts:120, isSiphon:true, spawnValue:4, unlockRoom:6, ammoPressure:0},
  disruptor:      {colorRole:'dangerDark',   r:11,hp:4, spd:46, fRate:750, burst:1,spread:.9, pts:60,  flee:true,  fleeRange:100, strafeSpd:0.7, doubleBounce:false, spawnValue:5, unlockRoom:7, ammoPressure:1},
  zoner:          {colorRole:'dangerDark',   r:15,hp:5, spd:24, fRate:2200,burst:8,spread:6.28,pts:80, flee:true,  fleeRange:130, strafeSpd:0.5, doubleBounce:false, spawnValue:8, unlockRoom:4, ammoPressure:8},
  purple_chaser:  {colorRole:'advanced',     r:12,hp:4, spd:55, fRate:1800,burst:1,spread:.22,pts:75,  flee:true, fleeRange:110, strafeSpd:0.6, doubleBounce:true, forcePurpleShots:true, spawnValue:6, unlockRoom:9, ammoPressure:2},
  purple_disruptor:{colorRole:'advancedDark',r:11,hp:5, spd:46, fRate:780, burst:1,spread:.9, pts:95,  flee:true, fleeRange:100, strafeSpd:0.7, doubleBounce:true, forcePurpleShots:true, spawnValue:9, unlockRoom:11, ammoPressure:2},
  purple_zoner:   {colorRole:'advancedDark', r:15,hp:6, spd:24, fRate:2200,burst:8,spread:6.28,pts:120, flee:true, fleeRange:130, strafeSpd:0.5, doubleBounce:true, forcePurpleShots:true, spawnValue:10, unlockRoom:21, ammoPressure:4},
  orange_zoner:   {colorRole:'elite',        r:15,hp:7, spd:24, fRate:2200,burst:8,spread:6.28,pts:130, flee:true, fleeRange:130, strafeSpd:0.5, isElite:true, doubleBounce:false, spawnValue:12, unlockRoom:40, ammoPressure:4},
  triangle:       {colorRole:'danger',       r:17,hp:6, spd:52, fRate:2000,burst:1,spread:.18,pts:110, flee:true, fleeRange:100, strafeSpd:0.7, doubleBounce:false, spawnValue:6, unlockRoom:20, ammoPressure:1, isTriangle:true},
};

const PURPLE_BULLET_ROOM_THRESHOLD = 9;

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveEnemyColor(role, palette) {
  switch(role) {
    case 'dangerLight': return palette.danger.light;
    case 'dangerDark': return palette.danger.dark;
    case 'aggressive': return palette.aggressive.hex;
    case 'advanced': return palette.advanced.hex;
    case 'advancedDark': return palette.advanced.dark;
    case 'siphon': return palette.siphon.hex;
    case 'elite': return palette.elite.hex;
    case 'danger':
    default:
      return palette.danger.hex;
  }
}

function getEnemyDefinition(type) {
  const def = ENEMY_TYPES[type];
  if(!def) return def;
  const palette = getThreatPalette();
  const col = resolveEnemyColor(def.colorRole, palette);
  return {
    ...def,
    col,
    glowCol: hexToRgba(col, type === 'triangle' ? 0.8 : (def.colorRole === 'elite' ? 0.82 : 0.74)),
  };
}

function createEnemy(type, { width, height, margin, roomIndex, nextEnemyId, isBoss = false }) {
  const def = getEnemyDefinition(type);
  const palette = getThreatPalette();
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
  // Stronger late-game scaling: 10% per room above 30
  const lateTierMult = tierOver > 0 ? 1.18 + tierOver * 0.10 : 1;
  const lateRoomHpMult = roomIndex >= 120 ? 1.2 : (roomIndex >= 80 ? 1.1 : 1);
  const hpMult = hpScale * room20Mult * lateTierMult * lateRoomHpMult;
  // Speed and fire pressure step up again in deep late game.
  const lateRoomSpdMult = roomIndex >= 120 ? 1.16 : (roomIndex >= 80 ? 1.08 : 1);
  const spdMult = (roomIndex >= 20 ? 1.12 : 1) * (tierOver > 0 ? 1.06 + Math.min(0.35, tierOver * 0.015) : 1) * lateRoomSpdMult;
  const eliteChance = roomIndex >= 120 ? 0.55 : (roomIndex >= 80 ? 0.45 : (roomIndex >= 40 ? 0.30 : 0));
  // Bosses skip elite roll; normal enemies become increasingly elite-heavy after room 80.
  const isElite = !isBoss && eliteChance > 0 && Math.random() < eliteChance;
  const eliteCol = palette.elite.hex;
  const eliteGlowCol = hexToRgba(eliteCol, 0.82);
  const fireRateMult = roomIndex >= 120 ? 0.78 : (roomIndex >= 80 ? 0.88 : 1);
  const effectiveFireRate = def.fRate >= 9000 ? def.fRate : Math.max(480, def.fRate * fireRateMult * (isElite ? 0.92 : 1));

  const hpVal = isBoss
    ? Math.max(1, Math.round(def.hp * hpMult * 5))
    : Math.max(1, Math.round(def.hp * hpMult * (isElite ? 1.3 : 1)));

  return {
    ...def,
    eid: nextEnemyId,
    x,
    y,
    r: effectiveR,
    col: isElite ? eliteCol : def.col,
    glowCol: isElite ? eliteGlowCol : def.glowCol,
    type,
    hp: hpVal,
    maxHp: hpVal,
    spd: def.spd * GLOBAL_SPEED_LIFT * spdMult * (isBoss ? 0.6 : (isElite ? 1.15 : 1)),
    pts: isBoss ? def.pts * 5 : def.pts,
    fRate: effectiveFireRate,
    fT: Math.random() * effectiveFireRate,
    forcePurpleShots: Boolean(def.forcePurpleShots),
    isBoss,
    isElite,
    eliteStage: 0, // 0=elite hue, 1=advanced hue, 2=danger hue for the current player-color rotation
    // Disruptor cooldown: tracks bullet count for cooldown after 5 shots
    disruptorBulletCount: 0,
    disruptorCooldown: 0,
  };
}

function canEnemyUsePurpleShots(enemy) {
  return Boolean(enemy.forcePurpleShots);
}

export { ENEMY_TYPES, PURPLE_BULLET_ROOM_THRESHOLD, createEnemy, canEnemyUsePurpleShots };

