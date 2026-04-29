// Tests for src/sim/postMovementTick.js (R0.4 step 3).
// Covers each branch + unit asymmetry (ms vs s) + clamp asymmetry.

import { tickPostMovementTimers } from '../src/sim/postMovementTick.js';

let passed = 0;
let failed = 0;

function ok(name, cond, info) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}

function approx(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }

function makeBody(over = {}) {
  return Object.assign({
    invincible: 0, distort: 0, coopSpectating: false,
  }, over);
}
function makeTimers(over = {}) {
  return Object.assign({
    barrierPulseTimer: 0, slipCooldown: 0,
    absorbComboCount: 0, absorbComboTimer: 0,
    chainMagnetTimer: 0, echoCounter: 0,
    vampiricRestoresThisRoom: 0, killSustainHealedThisRoom: 0,
    colossusShockwaveCd: 0, volatileOrbGlobalCooldown: 0,
  }, over);
}

// 1. Body transients
{
  const body = makeBody({ invincible: 1.0, distort: 0.5 });
  tickPostMovementTimers(body, [], makeTimers(), [], 1/60);
  ok('invincible decrements by dt', approx(body.invincible, 1.0 - 1/60));
  ok('distort decrements by dt', approx(body.distort, 0.5 - 1/60));
}
{
  const body = makeBody({ invincible: 1.0, coopSpectating: true });
  tickPostMovementTimers(body, [], makeTimers(), [], 1/60);
  ok('invincible NOT decremented when coopSpectating', approx(body.invincible, 1.0));
}
{
  const body = makeBody({ invincible: 0, distort: 0 });
  tickPostMovementTimers(body, [], makeTimers(), [], 1/60);
  ok('invincible/distort do not go negative when at 0', body.invincible === 0 && body.distort === 0);
}

// 2. Shield array sync
{
  const shields = [];
  tickPostMovementTimers(makeBody(), shields, makeTimers(), [], 1/60, { shieldTier: 3, shieldTempered: false });
  ok('shield sync grows array to tier', shields.length === 3);
  ok('shield record shape', shields[0].cooldown === 0 && shields[0].hardened === false && shields[0].mirrorCooldown === -9999);
}
{
  const shields = [];
  tickPostMovementTimers(makeBody(), shields, makeTimers(), [], 1/60, { shieldTier: 2, shieldTempered: true });
  ok('shieldTempered flag passes through', shields[0].hardened === true && shields[1].hardened === true);
}
{
  const shields = [{ cooldown: 0, hardened: false, mirrorCooldown: -9999 }, { cooldown: 0, hardened: false, mirrorCooldown: -9999 }, { cooldown: 0, hardened: false, mirrorCooldown: -9999 }];
  tickPostMovementTimers(makeBody(), shields, makeTimers(), [], 1/60, { shieldTier: 1 });
  ok('shield sync does NOT shrink', shields.length === 3);
}

// 3. Timer decrements (ms units)
{
  const t = makeTimers({ barrierPulseTimer: 100, chainMagnetTimer: 50, slipCooldown: 25 });
  tickPostMovementTimers(makeBody(), [], t, [], 1/60);
  ok('barrierPulseTimer ticks ms', approx(t.barrierPulseTimer, 100 - (1/60) * 1000));
  ok('chainMagnetTimer ticks ms', approx(t.chainMagnetTimer, 50 - (1/60) * 1000));
  ok('slipCooldown ticks ms', approx(t.slipCooldown, 25 - (1/60) * 1000));
}

// 3b. absorbCombo edge case
{
  const t = makeTimers({ absorbComboTimer: 100, absorbComboCount: 5 });
  tickPostMovementTimers(makeBody(), [], t, [], 1/60);
  ok('absorbComboTimer ticks ms (no expire)', t.absorbComboTimer > 0 && t.absorbComboCount === 5);
}
{
  const t = makeTimers({ absorbComboTimer: 5, absorbComboCount: 7 });
  // dt*1000 = 16.67ms > 5ms, so expires
  tickPostMovementTimers(makeBody(), [], t, [], 1/60);
  ok('absorbComboTimer expiry resets count to 0', t.absorbComboTimer <= 0 && t.absorbComboCount === 0);
}

// 3c. colossus gating
{
  const t = makeTimers({ colossusShockwaveCd: 1.0 });
  tickPostMovementTimers(makeBody(), [], t, [], 1/60, { colossusActive: false });
  ok('colossusShockwaveCd does NOT tick when colossus inactive', approx(t.colossusShockwaveCd, 1.0));
}
{
  const t = makeTimers({ colossusShockwaveCd: 1.0 });
  tickPostMovementTimers(makeBody(), [], t, [], 1/60, { colossusActive: true });
  ok('colossusShockwaveCd ticks s when colossus active', approx(t.colossusShockwaveCd, 1.0 - 1/60));
}

// 4. Volatile orb global cooldown clamp
{
  const t = makeTimers({ volatileOrbGlobalCooldown: 1.0 });
  tickPostMovementTimers(makeBody(), [], t, [], 1/60);
  ok('volatileOrbGlobalCooldown ticks s', approx(t.volatileOrbGlobalCooldown, 1.0 - 1/60));
}
{
  const t = makeTimers({ volatileOrbGlobalCooldown: 0.005 });
  tickPostMovementTimers(makeBody(), [], t, [], 1/60); // dt > value
  ok('volatileOrbGlobalCooldown clamps to 0', t.volatileOrbGlobalCooldown === 0);
}

// 5. Per-orb cooldown loop
{
  const orb = [0.5, 0.005, 0];
  tickPostMovementTimers(makeBody(), [], makeTimers(), orb, 1/60);
  ok('orb cooldown >0 ticks', approx(orb[0], 0.5 - 1/60));
  ok('orb cooldown clamps to 0 when dt would overshoot', orb[1] === 0);
  ok('orb cooldown stays 0 when already 0', orb[2] === 0);
}
{
  const orb = [];
  tickPostMovementTimers(makeBody(), [], makeTimers(), orb, 1/60);
  ok('empty orb array is a no-op', orb.length === 0);
}

// 6. No-arg robustness
{
  // None of these should throw.
  let threw = false;
  try { tickPostMovementTimers(null, null, null, null, 1/60); } catch (e) { threw = true; }
  ok('handles null inputs without throwing', !threw);
}

// 7. Determinism: two runs from same initial state produce identical output
{
  function runN(n) {
    const body = makeBody({ invincible: 0.5, distort: 0.5 });
    const shields = [];
    const t = makeTimers({
      barrierPulseTimer: 200, slipCooldown: 150,
      absorbComboTimer: 80, absorbComboCount: 3,
      chainMagnetTimer: 120, colossusShockwaveCd: 0.7,
      volatileOrbGlobalCooldown: 0.4,
    });
    const orb = [0.3, 0.2, 0.1];
    for (let i = 0; i < n; i++) {
      tickPostMovementTimers(body, shields, t, orb, 1/60, {
        shieldTier: 2, shieldTempered: true, colossusActive: true,
      });
    }
    return JSON.stringify({ body, shields, t, orb });
  }
  ok('deterministic across runs (60 ticks)', runN(60) === runN(60));
  ok('deterministic across runs (600 ticks)', runN(600) === runN(600));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
