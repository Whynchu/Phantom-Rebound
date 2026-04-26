// R3.2 — output projectile vs enemy combat during rollback resim.
//
// Mutates SimState deterministically: enemy HP/death, bullet pierce/removal,
// score/kills, simple Blood Pact healing, volatile burst follow-up, and grey
// drops on kill. Visual/audio side effects are descriptors only.

import { MAX_BULLETS } from '../data/constants.js';
import { getRequiredShotCount } from '../systems/boonHelpers.js';
import { resolveOutputEnemyHit } from '../systems/outputHit.js';
import { computeKillScore } from '../systems/scoring.js';
import { emit } from './effectQueue.js';
import {
  spawnSimGreyDrops,
  spawnSimRadialOutputBurst,
} from './simProjectiles.js';
import { applyEnemyKillRewards } from './killRewardStep.js';

const CRIT_DAMAGE_FACTOR = 2.4;
const BLOOD_PACT_BASE_HEAL_CAP_PER_BULLET = 1;
const GLOBAL_SPEED_LIFT = 1.55;

function resolveOutputHits(state, opts = {}) {
  const bullets = state?.bullets;
  const enemies = state?.enemies;
  if (!Array.isArray(bullets) || !Array.isArray(enemies) || bullets.length === 0 || enemies.length === 0) return 0;

  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  let hits = 0;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet || bullet.state !== 'output') continue;

    let removeBullet = false;
    const ownerSlot = getBulletOwnerSlot(state, bullet);
    const ownerUpg = ownerSlot?.upg || {};
    const ownerMetrics = ownerSlot?.metrics || {};

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (!canEnemyBeHit(enemy)) continue;
      const enemyId = enemy.eid ?? enemy.id ?? j;
      if (hasHitId(bullet, enemyId)) continue;
      if (!circleOverlap(bullet, enemy)) continue;

      addHitId(bullet, enemyId);
      const hit = resolveOutputEnemyHit({
        bullet,
        enemyHp: enemy.hp,
        hp: ownerMetrics.hp || 0,
        maxHp: ownerMetrics.maxHp || 1,
        upgrades: ownerUpg,
        critDamageFactor: opts.critDamageFactor ?? CRIT_DAMAGE_FACTOR,
        bloodPactBaseHealCap: opts.bloodPactBaseHealCap ?? BLOOD_PACT_BASE_HEAL_CAP_PER_BULLET,
      });

      enemy.hp = hit.enemyHpAfterHit;
      hits++;
      emitEffect(state, opts, 'output.enemyHit', {
        slotIndex: ownerSlot?.index ?? (Number.isInteger(bullet.ownerId) ? bullet.ownerId : 0),
        bulletId: bullet.id,
        enemyId,
        damage: hit.damage,
        enemyHp: enemy.hp,
        x: bullet.x,
        y: bullet.y,
      });

      if (hit.shouldBloodPactHeal) {
        healOwnerSlot(ownerSlot, 1);
        bullet.bloodPactHeals = hit.nextBloodPactHeals;
      }

      if (hit.enemyKilled) {
        awardEnemyKill(state, enemy, ownerSlot, bullet, opts);
        spawnKillGreyDrops(state, enemy, ownerUpg, ts, opts);
        enemies.splice(j, 1);
      }

      if (hit.piercesAfterHit) {
        bullet.pierceLeft = hit.nextPierceLeft;
        if (hit.shouldTriggerVolatile) {
          spawnSimRadialOutputBurst(state, {
            x: bullet.x,
            y: bullet.y,
            count: 4,
            speed: 180 * (opts.globalSpeedLift ?? GLOBAL_SPEED_LIFT),
            radius: (bullet.r || 4.5) * 0.75,
            bounceLeft: 0,
            pierceLeft: 0,
            homing: false,
            crit: false,
            dmg: (bullet.dmg || 1) * 0.65,
            expireAt: ts + 1600,
            ownerId: bullet.ownerId || 0,
          });
          emitEffect(state, opts, 'output.volatileBurst', {
            slotIndex: ownerSlot?.index ?? (Number.isInteger(bullet.ownerId) ? bullet.ownerId : 0),
            bulletId: bullet.id,
            x: bullet.x,
            y: bullet.y,
          });
        }
      } else {
        removeBullet = true;
        break;
      }
    }

    if (removeBullet) {
      bullets.splice(i, 1);
    }
  }

  return hits;
}

function canEnemyBeHit(enemy) {
  if (!enemy) return false;
  if (enemy.dead || enemy.alive === false) return false;
  return Number.isFinite(enemy.x) && Number.isFinite(enemy.y);
}

function circleOverlap(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0)) < (a.r || 0) + (b.r || 0);
}

function getBulletOwnerSlot(state, bullet) {
  const ownerId = Number.isInteger(bullet.ownerId) ? bullet.ownerId : 0;
  return state.slots?.[ownerId] || state.slots?.[0] || null;
}

function hasHitId(bullet, id) {
  const hitIds = bullet.hitIds;
  if (hitIds instanceof Set) return hitIds.has(id);
  if (Array.isArray(hitIds)) return hitIds.includes(id);
  return false;
}

function addHitId(bullet, id) {
  if (bullet.hitIds instanceof Set) {
    bullet.hitIds.add(id);
    return;
  }
  if (Array.isArray(bullet.hitIds)) {
    if (!bullet.hitIds.includes(id)) bullet.hitIds.push(id);
    return;
  }
  bullet.hitIds = new Set([id]);
}

function healOwnerSlot(slot, amount) {
  if (!slot?.metrics) return 0;
  const before = slot.metrics.hp || 0;
  const maxHp = Math.max(1, slot.metrics.maxHp || before || 1);
  slot.metrics.hp = Math.min(maxHp, before + Math.max(0, amount || 0));
  return slot.metrics.hp - before;
}

function awardEnemyKill(state, enemy, ownerSlot, bullet, opts) {
  const points = computeKillScore(enemy.pts, false);
  if (state.run) {
    state.run.score = (state.run.score || 0) + points;
    state.run.kills = (state.run.kills || 0) + 1;
    if (state.run.scoreBreakdown) {
      state.run.scoreBreakdown.kills = (state.run.scoreBreakdown.kills || 0) + points;
    }
    const overkill = computeOverkillScore(enemy);
    if (overkill > 0) {
      state.run.score += overkill;
      if (state.run.scoreBreakdown) {
      state.run.scoreBreakdown.overkill = (state.run.scoreBreakdown.overkill || 0) + overkill;
      }
    }
  }
  applyEnemyKillRewards(state, ownerSlot, enemy, bullet, opts);
  emitEffect(state, opts, 'output.enemyKilled', {
    slotIndex: ownerSlot?.index ?? (Number.isInteger(bullet.ownerId) ? bullet.ownerId : 0),
    enemyId: enemy.eid ?? enemy.id ?? null,
    scoreGain: points,
    x: enemy.x,
    y: enemy.y,
  });
}

function computeOverkillScore(enemy) {
  const overkillHp = Math.max(0, -(Number(enemy.hp) || 0));
  if (overkillHp <= 0) return 0;
  const cap = Math.max(1, (Number(enemy.maxHp) || 1) * 0.5);
  return Math.round(Math.min(overkillHp, cap) * 0.25);
}

function spawnKillGreyDrops(state, enemy, upg, ts, opts) {
  if (opts.spawnGreyDropsOnKill === false) return 0;
  const requiredShots = getRequiredShotCount(upg || {});
  const count = Math.max(1, Math.min(5, Math.round(1 + (requiredShots - 1) * 0.55)));
  return spawnSimGreyDrops(state, {
    x: enemy.x,
    y: enemy.y,
    ts,
    count,
    maxBullets: opts.maxBullets ?? MAX_BULLETS,
  });
}

function emitEffect(state, opts, kind, payload) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue)) return;
  emit(state, kind, payload);
}

export {
  resolveOutputHits,
  hasHitId,
  addHitId,
  computeOverkillScore,
};
