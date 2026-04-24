// Phase C2d-2 + D0b — guest-fire contract tests.
//
// Algorithm-level tests for updateGuestFire's charge-buildup + interval
// gating in script.js.
//
// NOTE (D0b, 2026-04-24): the standalone `fireGuestSlot` helper was removed.
// Guest slots now fire through the same slot-driven `firePlayer` path as the
// host, so actual bullet-spawn behavior is covered by the broader host-fire
// integration in script.js + tests/test-systems.mjs. These tests continue to
// cover the `updateGuestFire` tick loop (charge build while still, fire-rate
// gate, move-cancels-charge), which is distinct from the host mobile-charge
// path and therefore worth exercising on its own.

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

function makeSlot({ id = 1, charge = 1, maxCharge = 1, sps = 0.8, shotSpd = 1, shotSize = 1 } = {}) {
  const body = { x: 100, y: 100, r: 12, vx: 0, vy: 0, invincible: 0, distort: 0 };
  return {
    id,
    body,
    upg: { maxCharge, sps, shotSpd, shotSize },
    metrics: { hp: 50, maxHp: 50, charge, fireT: 0 },
    aim: { angle: 0, hasTarget: false },
  };
}

// Port of updateGuestFire charge+gate logic (enemy-picking handled by caller).
function tickGuestFireCore(slot, dt, isStill, hasEnemy) {
  const upg = slot.upg;
  if (isStill) slot.metrics.charge = Math.min(upg.maxCharge || 1, (slot.metrics.charge || 0) + dt);
  if (!hasEnemy) return { fired: false };
  if ((slot.metrics.charge || 0) < 1) return { fired: false };
  const interval = 1 / ((upg.sps || 0.8) * 2);
  slot.metrics.fireT = (slot.metrics.fireT || 0) + dt;
  if (!isStill) slot.metrics.fireT = Math.min(slot.metrics.fireT, interval);
  if (slot.metrics.fireT >= interval && isStill) {
    slot.metrics.fireT = slot.metrics.fireT % interval;
    return { fired: true };
  }
  return { fired: false };
}

// --- tick core tests ---
{
  const slot = makeSlot({ charge: 0.5, maxCharge: 1 });
  tickGuestFireCore(slot, 0.2, /* isStill */ true, /* hasEnemy */ false);
  assert('still+no-enemy builds charge', approx(slot.metrics.charge, 0.7));
}
{
  const slot = makeSlot({ charge: 0.5 });
  tickGuestFireCore(slot, 0.2, /* isStill */ false, false);
  assert('moving does not build charge', slot.metrics.charge === 0.5);
}
{
  const slot = makeSlot({ charge: 0.95, maxCharge: 1 });
  tickGuestFireCore(slot, 0.2, true, true);
  assert('charge capped at maxCharge', slot.metrics.charge === 1);
}
{
  const slot = makeSlot({ charge: 1, sps: 0.8 });
  // interval = 1/1.6 = 0.625. Three 0.3s ticks => fireT 0.3, 0.6, no fire; 4th tick crosses.
  let events = [];
  events.push(tickGuestFireCore(slot, 0.3, true, true).fired);
  events.push(tickGuestFireCore(slot, 0.3, true, true).fired);
  events.push(tickGuestFireCore(slot, 0.3, true, true).fired); // fireT 0.9 >= 0.625 => fires
  assert('fires after interval reached', events[0] === false && events[1] === false && events[2] === true);
}
{
  const slot = makeSlot({ charge: 1 });
  tickGuestFireCore(slot, 1.0, /* isStill */ false, true);
  assert('moving player does not fire even at full charge', slot.metrics.fireT <= 1 / (0.8 * 2));
}

console.log(`Guest-fire suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
