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

/**
 * Apply gravity-well steering to a single danger bullet. Pure helper —
 * mutates bullet.vx, bullet.vy, and bullet.gravityWellBaseSpeed in place.
 * No RNG, no audio.
 *
 * Original lives in script.js update() bullet loop. Carved out as part of
 * R0.4 step 4b. Behavior:
 *   - If bullet is within 96 units of the player AND UPG.gravityWell is on,
 *     bullet enters the field. baseSpeed is captured if not already set.
 *   - In-field, bullet decelerates exponentially toward 55% of baseSpeed
 *     (floor 40). Out-of-field with a captured baseSpeed, bullet recovers
 *     toward baseSpeed (floor 40). The exponential pull rate uses
 *     `1 - pow(0.16, dt)` in-field, `1 - pow(0.08, dt)` out-of-field.
 *   - Once recovery is within 2 units of target, baseSpeed is cleared.
 *
 * Skip: bullet not in 'danger' state. Returns false in that case.
 *
 * @param {object} bullet              - bullet object (mutated)
 * @param {{x:number,y:number}} target - reference body (player)
 * @param {number} dt                  - timestep, seconds
 * @param {object} opts
 * @param {boolean} [opts.gravityWell=false]
 * @param {number}  [opts.range=96]
 * @returns {boolean} true if processed, false if skipped
 */
function applyDangerGravityWell(bullet, target, dt, opts = {}) {
  if (!bullet || bullet.state !== 'danger') return false;
  if (!target) return false;

  const gravityWell = !!opts.gravityWell;
  const range = opts.range != null ? opts.range : 96;

  const gdist = Math.hypot(bullet.x - target.x, bullet.y - target.y);
  const inField = gravityWell && gdist < range;
  const currentSpeed = Math.hypot(bullet.vx, bullet.vy);

  if (inField && !bullet.gravityWellBaseSpeed) {
    bullet.gravityWellBaseSpeed = Math.max(40, currentSpeed);
  }

  if ((inField || bullet.gravityWellBaseSpeed) && currentSpeed > 0.0001) {
    const targetSpeed = inField
      ? Math.max(40, bullet.gravityWellBaseSpeed * 0.55)
      : Math.max(40, bullet.gravityWellBaseSpeed);
    const pull = 1 - Math.pow(inField ? 0.16 : 0.08, dt);
    const nextSpeed = currentSpeed + (targetSpeed - currentSpeed) * pull;
    bullet.vx = (bullet.vx / currentSpeed) * nextSpeed;
    bullet.vy = (bullet.vy / currentSpeed) * nextSpeed;
    if (!inField && Math.abs(nextSpeed - targetSpeed) < 2) {
      delete bullet.gravityWellBaseSpeed;
    }
  } else if (!inField && bullet.gravityWellBaseSpeed) {
    delete bullet.gravityWellBaseSpeed;
  }
  return true;
}

// R0.4 step 4c: sub-stepped bullet integration + wall bounce.
// Pure helper extracted from script.js update() bullet loop.
// Advances bullet position via sub-steps to prevent tunneling on long frames,
// reflects velocity off world walls, and invokes resolveObstacleCollision per substep.
// Returns true if the bullet bounced off any wall or obstacle this frame.
function advanceBulletWithSubsteps(bullet, dt, opts) {
  if (!bullet || !opts) return false;
  const { W, H, M, resolveObstacleCollision } = opts;
  if (typeof W !== 'number' || typeof H !== 'number' || typeof M !== 'number') return false;
  let bounced = false;
  const maxFrameTravel = Math.max(Math.abs(bullet.vx), Math.abs(bullet.vy)) * dt;
  const subSteps = Math.min(6, Math.max(1, Math.ceil(maxFrameTravel / 10)));
  const stepDt = dt / subSteps;
  for (let step = 0; step < subSteps; step++) {
    bullet.x += bullet.vx * stepDt;
    bullet.y += bullet.vy * stepDt;
    if (bullet.x - bullet.r < M) { bullet.x = M + bullet.r; bullet.vx = Math.abs(bullet.vx); bounced = true; }
    if (bullet.x + bullet.r > W - M) { bullet.x = W - M - bullet.r; bullet.vx = -Math.abs(bullet.vx); bounced = true; }
    if (bullet.y - bullet.r < M) { bullet.y = M + bullet.r; bullet.vy = Math.abs(bullet.vy); bounced = true; }
    if (bullet.y + bullet.r > H - M) { bullet.y = H - M - bullet.r; bullet.vy = -Math.abs(bullet.vy); bounced = true; }
    if (typeof resolveObstacleCollision === 'function' && resolveObstacleCollision(bullet)) bounced = true;
  }
  return bounced;
}

// R0.4 step 4d: near-miss telemetry detection.
// Detects when a danger bullet passes close to the player without colliding,
// and increments the room's nearMisses counter. Pure helper: caller resolves
// the current room and player invincibility state. Returns true if a new
// near-miss was registered this call (false otherwise).
function detectBulletNearMiss(bullet, player, room, opts) {
  if (!bullet || !player || !room) return false;
  if (bullet.state !== 'danger') return false;
  if (bullet.nearMissed) return false;
  const playerInvincible = opts?.playerInvincible ?? 0;
  if (playerInvincible > 0) return false;
  const outerScale = opts?.outerScale ?? 2.75;
  const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
  const outer = player.r * outerScale + bullet.r;
  const inner = player.r + bullet.r;
  if (dist < outer && dist > inner) {
    bullet.nearMissed = true;
    room.nearMisses = (room.nearMisses || 0) + 1;
    return true;
  }
  return false;
}

// R0.4 step 4e: grey bullet decay + expiry check.
// Pure helper. Returns { expired: boolean, skipped: boolean }.
// - skipped=true when the bullet is missing or not in grey state (caller should not act).
// - expired=true when the bullet has lived past its decay window (caller should remove it).
// - Otherwise applies frame-rate-independent velocity decay (0.97^(dt*60)) in place.
function tickGreyBulletDecay(bullet, ts, dt, opts) {
  if (!bullet || bullet.state !== 'grey') return { expired: false, skipped: true };
  const decayMS = opts?.decayMS ?? 0;
  if (ts - bullet.decayStart > decayMS) return { expired: true, skipped: false };
  const decayFactor = Math.pow(0.97, dt * 60);
  bullet.vx *= decayFactor;
  bullet.vy *= decayFactor;
  return { expired: false, skipped: false };
}

export {
  shouldExpireOutputBullet,
  shouldRemoveBulletOutOfBounds,
  resolveDangerBounceState,
  resolveOutputBounceState,
  applyBulletHoming,
  applyDangerGravityWell,
  advanceBulletWithSubsteps,
  detectBulletNearMiss,
  tickGreyBulletDecay,
};
