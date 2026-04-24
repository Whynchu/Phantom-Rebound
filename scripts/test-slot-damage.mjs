// Phase C2d-1b — per-slot damage plumbing contract tests.
//
// These tests exercise the ALGORITHMS that `applyContactDamageToGuestSlot`,
// `applyDangerDamageToGuestSlot`, `respawnGuestSlot`, and
// `processGuestDangerBulletHits` implement — not the live script.js closures
// (which rely on module-scope state: `bullets`, `playerSlots`, `C`, etc.).
//
// Shape mirrors what script.js mutates so regressions show up as behavior
// divergence rather than copy-paste drift.

let pass = 0;
let fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

function makeSlot({ hp = 50, maxHp = 50, x = 300, y = 300, invincible = 0 } = {}) {
  const body = { x, y, r: 12, vx: 0, vy: 0, invincible, distort: 0, spawnX: x, spawnY: y };
  const slot = {
    id: 1,
    body,
    upg: {},
    metrics: { hp, maxHp, charge: 0 },
  };
  return slot;
}

// --- algorithm ports (bit-identical to script.js helpers) ---
function applyContactDamageToGuestSlot(slot, damage, postHitInvuln = 0.6) {
  const body = slot.body;
  const nextHp = Math.max(0, (slot.metrics.hp || 0) - damage);
  slot.metrics.hp = nextHp;
  body.invincible = postHitInvuln;
  body.distort = 0.35;
  if (nextHp <= 0) respawnGuestSlot(slot);
}
function applyDangerDamageToGuestSlot(slot, damage, postHitInvuln = 0.5) {
  const body = slot.body;
  const nextHp = Math.max(0, (slot.metrics.hp || 0) - damage);
  slot.metrics.hp = nextHp;
  body.invincible = postHitInvuln;
  body.distort = 0.3;
  if (nextHp <= 0) respawnGuestSlot(slot);
}
function respawnGuestSlot(slot) {
  const body = slot.body;
  body.x = body.spawnX;
  body.y = body.spawnY;
  body.vx = 0; body.vy = 0;
  body.invincible = 2.0;
  body.distort = 0;
  slot.metrics.hp = slot.metrics.maxHp;
}
function processGuestDangerBulletHits(bullets, slots) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b || b.state !== 'danger') continue;
    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];
      if (!slot) continue;
      const body = slot.body;
      if (!body || (slot.metrics.hp || 0) <= 0) continue;
      if (body.invincible > 0) continue;
      const dx = b.x - body.x;
      const dy = b.y - body.y;
      const rr = b.r + body.r;
      if (dx * dx + dy * dy <= rr * rr) {
        applyDangerDamageToGuestSlot(slot, 10);
        bullets.splice(i, 1);
        break;
      }
    }
  }
}

// --- tests ---
{
  const slot = makeSlot({ hp: 50 });
  applyContactDamageToGuestSlot(slot, 18);
  assert('contact damage decrements hp', slot.metrics.hp === 32);
  assert('contact damage sets invuln', slot.body.invincible > 0);
  assert('contact damage sets distort', slot.body.distort > 0);
}
{
  const slot = makeSlot({ hp: 10 });
  applyContactDamageToGuestSlot(slot, 18);
  assert('contact lethal triggers respawn at spawn point',
    slot.metrics.hp === slot.metrics.maxHp && slot.body.x === slot.body.spawnX && slot.body.y === slot.body.spawnY);
  assert('respawn grants longer invuln', slot.body.invincible === 2.0);
}
{
  const slot = makeSlot({ hp: 50 });
  applyDangerDamageToGuestSlot(slot, 10);
  assert('danger damage decrements hp', slot.metrics.hp === 40);
}
{
  const slot = makeSlot({ hp: 50, invincible: 0.3 });
  const bullets = [{ state: 'danger', x: 300, y: 300, r: 8 }];
  processGuestDangerBulletHits(bullets, [slot]);
  assert('invincible guest is not hit', slot.metrics.hp === 50 && bullets.length === 1);
}
{
  const slot = makeSlot({ hp: 50 });
  const bullets = [{ state: 'danger', x: 300, y: 300, r: 8 }];
  processGuestDangerBulletHits(bullets, [slot]);
  assert('overlapping danger bullet hits guest and is spliced',
    slot.metrics.hp === 40 && bullets.length === 0);
}
{
  const slot = makeSlot({ hp: 50 });
  const bullets = [{ state: 'danger', x: 500, y: 500, r: 8 }];
  processGuestDangerBulletHits(bullets, [slot]);
  assert('distant danger bullet is not hit', slot.metrics.hp === 50 && bullets.length === 1);
}
{
  const slot = makeSlot({ hp: 50 });
  const bullets = [{ state: 'output', x: 300, y: 300, r: 8 }];
  processGuestDangerBulletHits(bullets, [slot]);
  assert('output bullets ignored by guest collision', slot.metrics.hp === 50 && bullets.length === 1);
}
{
  const slotA = makeSlot({ hp: 50, x: 300, y: 300 });
  const slotB = makeSlot({ hp: 50, x: 500, y: 500 });
  const bullets = [{ state: 'danger', x: 300, y: 300, r: 8 }];
  processGuestDangerBulletHits(bullets, [slotA, slotB]);
  assert('danger bullet hits nearest/first overlapping slot only',
    slotA.metrics.hp === 40 && slotB.metrics.hp === 50 && bullets.length === 0);
}

console.log(`Slot-damage suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
