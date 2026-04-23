import { simRng } from '../systems/seededRng.js';

function createOutputBullet({
  x,
  y,
  vx,
  vy,
  radius,
  bounceLeft = 0,
  pierceLeft = 0,
  homing = false,
  crit = false,
  dmg = 1,
  expireAt,
  extras = {},
} = {}) {
  return {
    x,
    y,
    vx,
    vy,
    state: 'output',
    r: radius,
    decayStart: null,
    bounceLeft,
    pierceLeft,
    homing,
    crit,
    dmg,
    expireAt,
    hitIds: new Set(),
    ...extras,
  };
}

function pushOutputBullet({ bullets, ...bulletConfig }) {
  const bullet = createOutputBullet(bulletConfig);
  bullets.push(bullet);
  return bullet;
}

function pushGreyBullet({
  bullets,
  x,
  y,
  vx,
  vy,
  radius = 4.5,
  decayStart,
  extras = {},
} = {}) {
  const bullet = {
    x,
    y,
    vx,
    vy,
    state: 'grey',
    r: radius,
    decayStart,
    bounces: 0,
    ...extras,
  };
  bullets.push(bullet);
  return bullet;
}

function spawnGreyDrops({
  bullets,
  x,
  y,
  ts,
  count,
  maxBullets,
  random = () => simRng.next(),
} = {}) {
  const dropCount = Math.max(1, Math.floor(count));
  const room = Math.min(dropCount, maxBullets - bullets.length);
  for(let i = 0; i < room; i++) {
    const angle = random() * Math.PI * 2;
    const speed = 50 + random() * 55;
    pushGreyBullet({
      bullets,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      decayStart: ts,
    });
  }
}

function spawnSplitOutputBullets({
  bullets,
  sourceBullet,
  splitDeltas,
  damageFactor,
  expireAt,
  fallbackBloodPactHealCap = 0,
} = {}) {
  const speed = Math.hypot(sourceBullet.vx, sourceBullet.vy);
  const baseAngle = Math.atan2(sourceBullet.vy, sourceBullet.vx);
  splitDeltas.forEach((delta) => {
    const angle = baseAngle + delta;
    pushOutputBullet({
      bullets,
      x: sourceBullet.x,
      y: sourceBullet.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: sourceBullet.r * 0.8,
      bounceLeft: 0,
      pierceLeft: sourceBullet.pierceLeft,
      homing: sourceBullet.homing,
      crit: sourceBullet.crit,
      dmg: sourceBullet.dmg * damageFactor,
      expireAt,
      extras: {
        hasSplit: true,
        hasPayload: Boolean(sourceBullet.hasPayload),
        bloodPactHeals: sourceBullet.bloodPactHeals || 0,
        bloodPactHealCap: sourceBullet.bloodPactHealCap || fallbackBloodPactHealCap,
      },
    });
  });
}

function spawnRadialOutputBurst({
  bullets,
  x,
  y,
  count,
  speed,
  radius,
  bounceLeft = 0,
  pierceLeft = 0,
  homing = false,
  crit = false,
  dmg,
  expireAt,
  extras = {},
} = {}) {
  const total = Math.max(1, Math.floor(count || 1));
  for(let i = 0; i < total; i++) {
    const angle = (Math.PI * 2 / total) * i;
    pushOutputBullet({
      bullets,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      bounceLeft,
      pierceLeft,
      homing,
      crit,
      dmg,
      expireAt,
      extras,
    });
  }
}

export {
  createOutputBullet,
  pushOutputBullet,
  pushGreyBullet,
  spawnGreyDrops,
  spawnSplitOutputBullets,
  spawnRadialOutputBurst,
};
