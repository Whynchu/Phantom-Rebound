// Small projectile factories for rollback resim.
//
// These mirror the live projectile helpers closely enough for deterministic
// hostSimStep replay, but take SimState explicitly so id allocation and RNG
// stay rollback-owned.

function nextSimBulletId(state) {
  if (!state || typeof state !== 'object') return 0;
  const id = state.nextBulletId >>> 0;
  let next = (id + 1) >>> 0;
  if (next === 0) next = 1;
  state.nextBulletId = next;
  return id || 1;
}

function pushSimOutputBullet(state, {
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
  ownerId = 0,
  extras = {},
} = {}) {
  if (!state || !Array.isArray(state.bullets)) return null;
  const bullet = {
    id: nextSimBulletId(state),
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
    ownerId,
    hitIds: new Set(),
    ...extras,
  };
  state.bullets.push(bullet);
  return bullet;
}

function pushSimGreyBullet(state, {
  x,
  y,
  vx,
  vy,
  radius = 4.5,
  decayStart,
  extras = {},
} = {}) {
  if (!state || !Array.isArray(state.bullets)) return null;
  const bullet = {
    id: nextSimBulletId(state),
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
  state.bullets.push(bullet);
  return bullet;
}

function pushSimDangerBullet(state, {
  x,
  y,
  angle,
  speed,
  radius = 4.5,
  extras = {},
} = {}) {
  if (!state || !Array.isArray(state.bullets)) return null;
  const bullet = {
    id: nextSimBulletId(state),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    state: 'danger',
    r: radius,
    decayStart: null,
    bounces: 0,
    ...extras,
  };
  state.bullets.push(bullet);
  return bullet;
}

function spawnSimRadialOutputBurst(state, {
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
  ownerId = 0,
  extras = {},
} = {}) {
  const total = Math.max(1, Math.floor(count || 1));
  for (let i = 0; i < total; i++) {
    const angle = (Math.PI * 2 / total) * i;
    pushSimOutputBullet(state, {
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
      ownerId,
      extras,
    });
  }
}

function nextSimRandom(state) {
  if (!state || typeof state.rngState !== 'number') return 0;
  const nextState = (state.rngState + 0x6D2B79F5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  state.rngState = nextState;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function spawnSimGreyDrops(state, {
  x,
  y,
  ts,
  count,
  maxBullets = 400,
} = {}) {
  if (!state || !Array.isArray(state.bullets)) return 0;
  const dropCount = Math.max(1, Math.floor(count || 1));
  const room = Math.min(dropCount, Math.max(0, maxBullets - state.bullets.length));
  for (let i = 0; i < room; i++) {
    const angle = nextSimRandom(state) * Math.PI * 2;
    const speed = 50 + nextSimRandom(state) * 55;
    pushSimGreyBullet(state, {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      decayStart: ts,
    });
  }
  return room;
}

export {
  nextSimBulletId,
  pushSimOutputBullet,
  pushSimGreyBullet,
  pushSimDangerBullet,
  spawnSimRadialOutputBurst,
  spawnSimGreyDrops,
  nextSimRandom,
};
