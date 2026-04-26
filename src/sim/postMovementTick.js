/**
 * R0.4 step 3 — post-movement deterministic tick block.
 *
 * Carved out of script.js update() (the block that lived between
 * tickBodyPosition and the room state machine). Handles:
 *
 *   1. Body transient decrements (invincible, distort). invincible is gated
 *      by body.coopSpectating to match the original `if(!coopSpectating)`.
 *   2. Shield array sync — grow shields[] up to UPG.shieldTier with the
 *      original {cooldown:0, hardened, mirrorCooldown:-9999} literal.
 *      Does NOT shrink: matches original behavior.
 *   3. Slot timer decrements (barrier pulse / absorb combo / chain magnet /
 *      slip / colossus shockwave). Units mixed (ms vs s) — preserved
 *      exactly. absorbComboTimer expiry resets absorbComboCount.
 *   4. Volatile orb global cooldown (s, clamped at 0).
 *   5. Per-orb cooldown loop (s, clamped at 0).
 *
 * Intentionally NOT included (kept inline at call site):
 *   - tickShieldCooldowns(): already its own helper module.
 *   - runBoonHook('onTick', …): touches UPG.* fields only, not slot timers
 *     or orb cooldowns, so its order vs this helper is behavior-irrelevant
 *     (verified in src/systems/boonHooks.js — 8 onTick hooks read/write
 *     only UPG.shockwaveCooldown / refractionCooldown / mirrorTideCooldown
 *     / overloadCooldown / phaseDashCooldown / voidZoneTimer /
 *     predatorKillStreakTime / bloodRushTimer).
 *   - updateGuestSlotMovement / tickGuestSlotTimers: separate concern.
 *
 * Pure function — mutates the passed-in body / shields / timers / orbCooldown.
 * No globals, no DOM, no RNG. Safe for rollback resim.
 *
 * @param {object} body                - slot body (has invincible, distort,
 *                                       coopSpectating). Mutated.
 * @param {Array}  shields             - array of shield records. Mutated
 *                                       (grown by shield-tier sync).
 * @param {object} timers              - slot timers struct (shape from
 *                                       createSlot in simState.js). Mutated.
 * @param {Array<number>} orbCooldown  - per-orb cooldown array (seconds).
 *                                       Mutated. Empty array is a valid no-op.
 * @param {number} dt                  - timestep, seconds.
 * @param {object} [opts]
 * @param {number} [opts.shieldTier=0]
 * @param {boolean} [opts.shieldTempered=false]
 * @param {boolean} [opts.colossusActive=false]
 */
export function tickPostMovementTimers(body, shields, timers, orbCooldown, dt, opts = {}) {
  const shieldTier = opts.shieldTier | 0;
  const shieldTempered = !!opts.shieldTempered;
  const colossusActive = !!opts.colossusActive;

  // 1. Body transients
  if (body) {
    if (body.invincible > 0 && !body.coopSpectating) body.invincible -= dt;
    if (body.distort > 0) body.distort -= dt;
  }

  // 2. Shield array sync (grow only)
  if (Array.isArray(shields)) {
    while (shields.length < shieldTier) {
      shields.push({ cooldown: 0, hardened: shieldTempered, mirrorCooldown: -9999 });
    }
  }

  // 3. Timer decrements
  if (timers) {
    if (timers.barrierPulseTimer > 0) timers.barrierPulseTimer -= dt * 1000;
    if (timers.absorbComboTimer > 0) {
      timers.absorbComboTimer -= dt * 1000;
      if (timers.absorbComboTimer <= 0) timers.absorbComboCount = 0;
    }
    if (timers.chainMagnetTimer > 0) timers.chainMagnetTimer -= dt * 1000;
    if (timers.slipCooldown > 0) timers.slipCooldown -= dt * 1000;
    if (colossusActive && timers.colossusShockwaveCd > 0) timers.colossusShockwaveCd -= dt;

    // 4. Volatile orb global cooldown (clamped)
    if (timers.volatileOrbGlobalCooldown > 0) {
      timers.volatileOrbGlobalCooldown = Math.max(0, timers.volatileOrbGlobalCooldown - dt);
    }
  }

  // 5. Per-orb cooldown loop (clamped)
  if (Array.isArray(orbCooldown)) {
    for (let si = 0; si < orbCooldown.length; si++) {
      if (orbCooldown[si] > 0) orbCooldown[si] = Math.max(0, orbCooldown[si] - dt);
    }
  }
}

export default tickPostMovementTimers;
