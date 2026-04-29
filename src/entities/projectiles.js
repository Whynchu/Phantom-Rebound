import { simRng } from '../systems/seededRng.js';
import { nextHostBulletId } from './bulletIds.js';

function getEliteBulletStagePalette({ getThreatPalette, getRgba }) {
  const threat = getThreatPalette();
  return [
    { fill: threat.elite.hex, core: getRgba(threat.elite.light, 0.9) },
    { fill: threat.advanced.hex, core: getRgba(threat.advanced.light, 0.9) },
    { fill: threat.danger.hex, core: getRgba(threat.danger.light, 0.9) },
  ];
}

function applyEliteBulletStage({
  bullet,
  stage,
  getThreatPalette,
  getRgba,
}) {
  const palette = getEliteBulletStagePalette({ getThreatPalette, getRgba });
  const nextStage = Math.max(0, Math.min(stage, palette.length - 1));
  bullet.eliteStage = nextStage;
  bullet.eliteColor = palette[nextStage].fill;
  bullet.eliteCore = palette[nextStage].core;
  bullet.bounceStages = nextStage < palette.length - 1 ? 1 : 0;
  return bullet;
}

function getDoubleBounceBulletPalette({ getThreatPalette, getRgba }) {
  const threat = getThreatPalette();
  return {
    fill: threat.advanced.hex,
    core: getRgba(threat.advanced.light, 0.9),
  };
}

function spawnEnemyBullet({
  bullets,
  x,
  y,
  angle,
  speed,
  radius = 4.5,
  extras = {},
  onSpawn = () => {},
}) {
  bullets.push({
    id: nextHostBulletId(),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    state: 'danger',
    r: radius,
    decayStart: null,
    bounces: 0,
    ...extras,
  });
  onSpawn(1);
}

function spawnAimedEnemyBullet({
  bullets,
  player,
  x,
  y,
  angleOverride = null,
  spread = 0.22,
  speedBase = 145,
  speedRoll = 40,
  bulletSpeedScale,
  radius = 4.5,
  extras = {},
  onSpawn = () => {},
  random = () => simRng.next(),
}) {
  const baseAngle = angleOverride === null ? Math.atan2(player.y - y, player.x - x) : angleOverride;
  const angle = baseAngle + (random() - 0.5) * spread;
  const speed = (speedBase + random() * speedRoll) * bulletSpeedScale();
  spawnEnemyBullet({
    bullets,
    x,
    y,
    angle,
    speed,
    radius,
    extras,
    onSpawn,
  });
}

function spawnRadialEnemyBullet({
  bullets,
  x,
  y,
  idx,
  total,
  speed = 125,
  bulletSpeedScale,
  radius = 4.5,
  extras = {},
  onSpawn = () => {},
}) {
  const angle = (Math.PI * 2 / total) * idx;
  spawnEnemyBullet({
    bullets,
    x,
    y,
    angle,
    speed: speed * bulletSpeedScale(),
    radius,
    extras,
    onSpawn,
  });
}

function spawnTriangleBurst({
  bullets,
  x,
  y,
  origVx,
  origVy,
  bulletSpeedScale,
  onSpawn = () => {},
  sparks = () => {},
  sparkColor,
}) {
  const baseAngle = Math.atan2(origVy, origVx);
  const burstSpd = 140 * bulletSpeedScale();
  for(let i = 0; i < 3; i++) {
    const angle = baseAngle + (i - 1) * (Math.PI * 2 / 3);
    spawnEnemyBullet({
      bullets,
      x,
      y,
      angle,
      speed: burstSpd,
      radius: 5,
      extras: { dangerContinueBounces: 1 },
      onSpawn,
    });
  }
  sparks(x, y, sparkColor, 6, 50);
}

function spawnEliteBullet({
  bullets,
  x,
  y,
  angle,
  speed,
  stage = 0,
  extras = {},
  onSpawn = () => {},
  getThreatPalette,
  getRgba,
}) {
  const bullet = {
    id: nextHostBulletId(),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    state: 'danger',
    r: extras.r ?? 5,
    decayStart: null,
    bounces: 0,
    ...extras,
  };
  applyEliteBulletStage({ bullet, stage, getThreatPalette, getRgba });
  bullets.push(bullet);
  onSpawn(1);
}

function spawnEliteTriangleBurst({
  bullets,
  x,
  y,
  origVx,
  origVy,
  bulletSpeedScale,
  onSpawn = () => {},
  sparks = () => {},
  sparkColor,
  getThreatPalette,
  getRgba,
}) {
  const baseAngle = Math.atan2(origVy, origVx);
  const burstSpd = 140 * bulletSpeedScale();
  for(let i = 0; i < 3; i++) {
    const angle = baseAngle + (i - 1) * (Math.PI * 2 / 3);
    spawnEliteBullet({
      bullets,
      x,
      y,
      angle,
      speed: burstSpd,
      stage: 2,
      extras: { dangerContinueBounces: 1 },
      onSpawn,
      getThreatPalette,
      getRgba,
    });
  }
  sparks(x, y, sparkColor, 6, 60);
}

export {
  getEliteBulletStagePalette,
  applyEliteBulletStage,
  getDoubleBounceBulletPalette,
  spawnEnemyBullet,
  spawnAimedEnemyBullet,
  spawnRadialEnemyBullet,
  spawnTriangleBurst,
  spawnEliteBullet,
  spawnEliteTriangleBurst,
};
