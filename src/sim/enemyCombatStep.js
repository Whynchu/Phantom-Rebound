// R3.3 — enemy combat resim for rollback.
//
// This replaces the earlier rollback-only "move toward nearest player" enemy
// kinematic approximation with the same deterministic runtime used by the
// live loop: ranged windup/fire timers, LOS gating, rusher/siphon movement,
// and disruptor cooldown state. Cosmetic effects stay out of this module.

import {
  stepEnemyCombatState,
  fireEnemyBurst,
} from '../entities/enemyRuntime.js';
import {
  nextSimRandom,
  pushSimDangerBullet,
} from './simProjectiles.js';

const GLOBAL_SPEED_LIFT = 1.55;
const DEFAULT_MARGIN = 16;
const DEFAULT_WINDUP_MS = 520;

function getWorld(state, opts = {}) {
  const world = state?.world || {};
  return {
    width: opts.worldW != null ? opts.worldW : (world.w || state.worldW || 800),
    height: opts.worldH != null ? opts.worldH : (world.h || state.worldH || 600),
    margin: opts.margin != null ? opts.margin : DEFAULT_MARGIN,
    obstacles: Array.isArray(opts.obstacles) ? opts.obstacles : (Array.isArray(world.obstacles) ? world.obstacles : []),
  };
}

function getBulletSpeedScale(state, opts = {}) {
  if (typeof opts.bulletSpeedScale === 'function') return opts.bulletSpeedScale();
  if (Number.isFinite(opts.bulletSpeedScale)) return opts.bulletSpeedScale;
  const roomIndex = state?.run && Number.isFinite(state.run.roomIndex) ? state.run.roomIndex : 0;
  return (0.68 + Math.min(roomIndex, 10) * 0.032) * GLOBAL_SPEED_LIFT;
}

function getTargetSlot(enemy, slots) {
  let bestSlot = null;
  let bestDist = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const body = slot && slot.body;
    if (!body || body.alive === false || (body.deadAt | 0) > 0) continue;
    const dx = body.x - enemy.x;
    const dy = body.y - enemy.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

function spawnAimedDanger(state, enemy, targetBody, speedScale, {
  angleOverride = null,
  spread = 0.22,
  speedBase = 145,
  speedRoll = 40,
  radius = 4.5,
  extras = {},
} = {}) {
  const baseAngle = angleOverride === null
    ? Math.atan2(targetBody.y - enemy.y, targetBody.x - enemy.x)
    : angleOverride;
  const angle = baseAngle + (nextSimRandom(state) - 0.5) * spread;
  const speed = (speedBase + nextSimRandom(state) * speedRoll) * speedScale;
  pushSimDangerBullet(state, {
    x: enemy.x,
    y: enemy.y,
    angle,
    speed,
    radius,
    extras,
  });
}

function spawnEliteDanger(state, enemy, angle, speed, stage = 0, extras = {}) {
  pushSimDangerBullet(state, {
    x: enemy.x,
    y: enemy.y,
    angle,
    speed,
    radius: extras.r ?? 5,
    extras: {
      eliteStage: Math.max(0, Math.min(stage | 0, 2)),
      bounceStages: stage < 2 ? 1 : 0,
      ...extras,
    },
  });
}

function tickEnemyCombat(state, dt, opts = {}) {
  const enemies = state?.enemies;
  const slots = state?.slots;
  if (!Array.isArray(enemies) || enemies.length === 0) return 0;
  if (!Array.isArray(slots) || slots.length === 0) return 0;

  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  const world = getWorld(state, opts);
  const speedScale = getBulletSpeedScale(state, opts);
  let fired = 0;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (!enemy || enemy.dead || enemy.alive === false) continue;
    const targetSlot = getTargetSlot(enemy, slots);
    const targetBody = targetSlot && targetSlot.body;
    if (!targetBody) continue;

    const combatStep = stepEnemyCombatState(enemy, {
      player: targetBody,
      ts,
      dt,
      width: world.width,
      height: world.height,
      margin: world.margin,
      gravityWell2: !!opts.gravityWell2,
      windupMs: opts.windupMs != null ? opts.windupMs : DEFAULT_WINDUP_MS,
      obstacles: world.obstacles,
    });

    if (combatStep.kind === 'siphon') {
      if (combatStep.shouldDrainCharge && targetSlot.metrics) {
        targetSlot.metrics.charge = Math.max(0, (targetSlot.metrics.charge || 0) - 2.8 * dt);
      }
      continue;
    }

    if (combatStep.kind === 'rusher') {
      // Contact damage remains owned by dangerHit/contact dispatch work; this
      // slice is enemy AI + projectile timing only.
      continue;
    }

    if (!combatStep.shouldFire) continue;
    const before = state.bullets.length;
    fireEnemyBurst(enemy, {
      player: targetBody,
      bulletSpeedScale: () => speedScale,
      obstacles: world.obstacles,
      random: () => nextSimRandom(state),
      canEnemyUsePurpleShots: (e) => !!(e && e.forcePurpleShots),
      spawnZoner: (idx, total) => {
        const angle = (Math.PI * 2 / total) * idx;
        pushSimDangerBullet(state, { x: enemy.x, y: enemy.y, angle, speed: 125 * speedScale });
      },
      spawnEliteZoner: (idx, total, stage) => {
        const angle = (Math.PI * 2 / total) * idx;
        spawnEliteDanger(state, enemy, angle, 125 * speedScale, stage);
      },
      spawnDoubleBounce: (angle = null) => spawnAimedDanger(state, enemy, targetBody, speedScale, {
        angleOverride: angle,
        extras: { doubleBounce: true, bounceCount: 0 },
      }),
      spawnTriangle: () => spawnAimedDanger(state, enemy, targetBody, speedScale, {
        spread: 0.18,
        radius: 7,
        extras: { isTriangle: true, wallBounces: 0 },
      }),
      spawnEliteTriangle: () => {
        const angle = Math.atan2(targetBody.y - enemy.y, targetBody.x - enemy.x) + (nextSimRandom(state) - 0.5) * 0.18;
        const speed = (145 + nextSimRandom(state) * 40) * speedScale;
        spawnEliteDanger(state, enemy, angle, speed, 1, { r: 7 });
      },
      spawnEliteBullet: (angle, speed, stage) => spawnEliteDanger(state, enemy, angle, speed, stage),
      spawnEnemyBullet: (angle) => spawnAimedDanger(state, enemy, targetBody, speedScale, { angleOverride: angle }),
    });
    fired += Math.max(0, state.bullets.length - before);
  }

  return fired;
}

export {
  tickEnemyCombat,
};

