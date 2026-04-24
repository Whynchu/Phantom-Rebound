// Phase C2d-2 — guest-fire contract tests.
//
// Algorithm-level tests for the helpers installed in script.js:
// - fireGuestSlot(slot, tx, ty): consumes charge, spawns one output bullet,
//   stamps ownerId=slot.id, updates aim.
// - updateGuestFire(dt) charge-buildup logic and interval fire gating.

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

// Port of fireGuestSlot (no module deps).
function fireGuestSlot(slot, tx, ty, bullets, globalSpeedLift = 1.55, shotLifeMs = 1100, now = 0) {
  if ((slot.metrics.charge || 0) < 1) return null;
  const body = slot.body;
  const upg = slot.upg;
  const angle = Math.atan2(ty - body.y, tx - body.x);
  slot.aim.angle = angle;
  slot.aim.hasTarget = true;
  const speed = 230 * globalSpeedLift * (upg.shotSpd || 1);
  const radius = 4.5 * (upg.shotSize || 1);
  const damage = 10;
  slot.metrics.charge = Math.max(0, slot.metrics.charge - 1);
  const b = {
    x: body.x, y: body.y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    state: 'output', r: radius,
    dmg: damage, ownerId: slot.id,
    expireAt: now + shotLifeMs,
  };
  bullets.push(b);
  return b;
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

// --- fireGuestSlot tests ---
{
  const slot = makeSlot({ charge: 1 });
  const bullets = [];
  const b = fireGuestSlot(slot, 200, 100, bullets);
  assert('fires one bullet at charge=1', bullets.length === 1);
  assert('stamps ownerId=slot.id', b.ownerId === 1);
  assert('consumes exactly 1 charge', slot.metrics.charge === 0);
  assert('spawns at body position', b.x === 100 && b.y === 100);
  assert('aim angle points at target', approx(slot.aim.angle, 0));
  assert('aim.hasTarget true after fire', slot.aim.hasTarget === true);
  assert('bullet velocity positive x (target to right)', b.vx > 0 && approx(b.vy, 0, 1e-9));
  assert('bullet damage = 10', b.dmg === 10);
}
{
  const slot = makeSlot({ charge: 0.4 });
  const bullets = [];
  const b = fireGuestSlot(slot, 200, 100, bullets);
  assert('does not fire at charge<1', b === null && bullets.length === 0 && slot.metrics.charge === 0.4);
}
{
  const slot = makeSlot({ id: 2, charge: 1 });
  const bullets = [];
  const b = fireGuestSlot(slot, 100, 200, bullets);
  assert('ownerId stamps whichever slot fired (2)', b.ownerId === 2);
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
