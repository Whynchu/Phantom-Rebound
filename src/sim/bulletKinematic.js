/**
 * R2 — Bullet kinematic resim.
 *
 * tickBulletsKinematic(state, dt) is a pure function called from hostSimStep
 * during rollback resim ticks. It advances bullet positions, handles wall
 * bounce dispatch (grey conversion, split, triangle burst), and expiry.
 * No hit detection, no audio, no sparks.
 *
 * Reads: state.bullets, state.timeMs, state.world, state.worldW, state.worldH,
 *        state.slots[].upg (for phantomRebound/bounceTier/splitShot flags),
 *        state.run.roomIndex (for triangle burst speed scale)
 * Writes: bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.state, bullet.decayStart,
 *         bullet.bounceLeft, bullet.wallBounces; splices expired/removed entries;
 *         pushes new bullets (split siblings, triangle burst) via simProjectiles
 */
import { advanceBulletWithSubsteps } from '../systems/bulletRuntime.js';
import { dispatchBulletBounce } from './bulletBounceDispatch.js';
import { pushSimOutputBullet, pushSimDangerBullet } from './simProjectiles.js';

// Mirrors enemyCombatStep.js constant — must stay in sync with GLOBAL_SPEED_LIFT.
const GLOBAL_SPEED_LIFT = 1.55;

/**
 * Advance all bullets by dt seconds.
 * - Removes null/non-object entries
 * - Removes bullets whose expireAt has passed (relative to state.timeMs)
 * - Advances position via advanceBulletWithSubsteps (wall bounce, substeps)
 * - Dispatches bounce results: grey conversion, split shot, triangle burst
 * No hit detection, no effects, no audio.
 *
 * @param {object} state  - SimState (mutated in-place)
 * @param {number} dt     - timestep in seconds
 */
export function tickBulletsKinematic(state, dt) {
  const bullets = state.bullets;
  if (!Array.isArray(bullets) || bullets.length === 0) return;

  const stateWorld = state.world || {};
  const W = (stateWorld.w) || state.worldW || 800;
  const H = (stateWorld.h) || state.worldH || 600;
  const M = 16;
  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // Remove null / non-object entries
    if (b === null || typeof b !== 'object') {
      bullets.splice(i, 1);
      continue;
    }

    // Expire: remove silently — no blast, no audio
    if (b.expireAt != null && state.timeMs >= b.expireAt) {
      bullets.splice(i, 1);
      continue;
    }

    // Advance position (wall bounce handled inside advanceBulletWithSubsteps)
    const bounced = advanceBulletWithSubsteps(b, dt, { W, H, M, resolveObstacleCollision: null });

    if (bounced) {
      const ownerUpg = state.slots?.[b.ownerId ?? 0]?.upg || state.slots?.[0]?.upg || {};
      const bounceResult = dispatchBulletBounce(b, ts, {
        phantomRebound: !!ownerUpg.phantomRebound,
        bounceTier: ownerUpg.bounceTier | 0,
        splitShot: !!ownerUpg.splitShot,
        splitShotEvolved: !!ownerUpg.splitShotEvolved,
      });

      const fu = bounceResult.followUp;
      if (fu) {
        if (fu.kind === 'split') {
          _spawnSplitBulletsSim(state, b, fu, ts);
        } else if (fu.kind === 'triangle-burst') {
          _spawnTriangleBurstSim(state, fu);
        }
        // payload-blast: requires enemy HP manipulation, skip in kinematic resim
      }

      if (bounceResult.removeSourceBullet) {
        bullets.splice(i, 1);
        continue;
      }

      if (bounceResult.skipRestOfFrame) {
        continue;
      }
    }
  }
}

function _spawnSplitBulletsSim(state, src, fu, ts) {
  if (!Array.isArray(fu.splitDeltas)) return;
  const speed = Math.hypot(src.vx, src.vy);
  const baseAngle = Math.atan2(src.vy, src.vx);
  const expireAt = ts + (fu.lifetimeMs || 2000);
  for (const delta of fu.splitDeltas) {
    const angle = baseAngle + delta;
    pushSimOutputBullet(state, {
      x: src.x,
      y: src.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: (src.r || 4.5) * 0.8,
      bounceLeft: 0,
      pierceLeft: src.pierceLeft || 0,
      homing: src.homing || false,
      crit: src.crit || false,
      dmg: (src.dmg || 1) * (fu.splitDamageFactor || 0.8),
      expireAt,
      ownerId: src.ownerId || 0,
      extras: {
        hasSplit: true,
        hasPayload: Boolean(src.hasPayload),
      },
    });
  }
}

function _spawnTriangleBurstSim(state, fu) {
  const roomIndex = state?.run && Number.isFinite(state.run.roomIndex) ? state.run.roomIndex : 0;
  const speedScale = (0.68 + Math.min(roomIndex, 10) * 0.032) * GLOBAL_SPEED_LIFT;
  const baseAngle = Math.atan2(fu.vy, fu.vx);
  const burstSpd = 140 * speedScale;
  for (let i = 0; i < 3; i++) {
    const angle = baseAngle + (i - 1) * (Math.PI * 2 / 3);
    pushSimDangerBullet(state, {
      x: fu.x,
      y: fu.y,
      angle,
      speed: burstSpd,
      radius: 5,
      extras: { dangerContinueBounces: 1 },
    });
  }
}
