function shouldExpireOutputBullet(bullet, ts) {
  return bullet?.state === 'output' && Boolean(bullet.expireAt) && ts >= bullet.expireAt;
}

function shouldRemoveBulletOutOfBounds(bullet, width, height, padding = 10) {
  return bullet.x < -padding || bullet.x > width + padding || bullet.y < -padding || bullet.y > height + padding;
}

function resolveDangerBounceState(bullet, ts) {
  if(bullet.eliteStage !== undefined && bullet.bounceStages !== undefined && bullet.bounceStages > 0) {
    return { kind: 'elite-stage', nextEliteStage: (bullet.eliteStage || 0) + 1 };
  }
  if(bullet.isTriangle) {
    bullet.wallBounces = (bullet.wallBounces || 0) + 1;
    if(bullet.wallBounces >= 1) return { kind: 'triangle-burst', removeBullet: true };
    return { kind: 'triangle-continue' };
  }
  if((bullet.dangerBounceBudget || 0) > 0) {
    bullet.dangerBounceBudget--;
    bullet.state = 'grey';
    bullet.decayStart = ts;
    return { kind: 'convert-grey' };
  }
  if(bullet.doubleBounce) {
    bullet.bounceCount = (bullet.bounceCount || 0) + 1;
    if(bullet.bounceCount >= 2) {
      bullet.state = 'grey';
      bullet.decayStart = ts;
      return { kind: 'convert-grey' };
    }
    return { kind: 'double-bounce-continue' };
  }
  bullet.state = 'grey';
  bullet.decayStart = ts;
  return { kind: 'convert-grey' };
}

function resolveOutputBounceState(bullet, { splitShot = false, splitShotEvolved = false } = {}) {
  if((bullet.bounceLeft || 0) > 0) {
    bullet.bounceLeft--;
    if(splitShot && !bullet.hasSplit) {
      bullet.hasSplit = true;
      return {
        kind: 'split',
        splitDeltas: splitShotEvolved ? [-0.42, 0, 0.42] : [-0.35, 0.35],
        splitDamageFactor: splitShotEvolved ? 0.85 : 0.8,
      };
    }
    return { kind: 'continue' };
  }
  return { kind: 'remove', removeBullet: true };
}

/**
 * Apply homing steering to a single output bullet. Pure helper — mutates
 * bullet.vx/vy in place. No RNG, no audio, no allocations beyond the
 * find-nearest-enemy reduce.
 *
 * Original lives in script.js update() bullet loop. Carved out as part of
 * R0.4 step 4a so the deterministic substep math can be unit-tested and
 * driven from hostSimStep without dragging the rest of the bullet loop.
 *
 * Skip conditions (no-op, returns false): bullet not in 'output' state,
 * bullet.homing falsy, enemies array empty, no enemy with finite distance.
 *
 * Tie-breaking: when two enemies are exactly equidistant, the first one
 * encountered wins (Array.prototype.reduce iteration order). This matches
 * the original behavior — do NOT change it without a determinism gate.
 *
 * @param {object} bullet              - bullet object (mutated)
 * @param {Array}  enemies             - enemies array (read-only)
 * @param {number} dt                  - timestep, seconds
 * @param {object} opts
 * @param {number} [opts.homingTier=1]
 * @param {number} [opts.shotSpd=1]
 * @param {number} [opts.snipePower=0]
 * @param {number} [opts.globalSpeedLift=1.55]
 * @returns {boolean} true if homing was applied, false if skipped
 */
function applyBulletHoming(bullet, enemies, dt, opts = {}) {
  if (!bullet || bullet.state !== 'output' || !bullet.homing) return false;
  if (!enemies || enemies.length === 0) return false;

  const homingTier = opts.homingTier != null ? opts.homingTier : 1;
  const shotSpd = opts.shotSpd != null ? opts.shotSpd : 1;
  const snipePower = opts.snipePower != null ? opts.snipePower : 0;
  const globalSpeedLift = opts.globalSpeedLift != null ? opts.globalSpeedLift : 1.55;

  // Find nearest enemy (reduce keeps first-encountered on ties).
  let best = null;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    const d = Math.hypot(e.x - bullet.x, e.y - bullet.y);
    if (!best || d < best.d) best = { e, d };
  }
  if (!best) return false;

  const dx = best.e.x - bullet.x;
  const dy = best.e.y - bullet.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0) return false;

  const homingSteer = 160 + 160 * (homingTier || 1);
  bullet.vx += (dx / d) * homingSteer * dt;
  bullet.vy += (dy / d) * homingSteer * dt;

  // Match the launch-speed basis so homing cannot silently nerf
  // Faster Bullets / Snipe scaling.
  const sp = Math.hypot(bullet.vx, bullet.vy);
  const homingSpeedMult = 1.2 + (homingTier || 1) * 0.05;
  const maxSp = 230 * globalSpeedLift * Math.min(2.0, shotSpd) * (1 + snipePower * 0.18) * homingSpeedMult;
  if (sp > maxSp) {
    bullet.vx = bullet.vx / sp * maxSp;
    bullet.vy = bullet.vy / sp * maxSp;
  }
  return true;
}

export {
  shouldExpireOutputBullet,
  shouldRemoveBulletOutOfBounds,
  resolveDangerBounceState,
  resolveOutputBounceState,
  applyBulletHoming,
};
