// Phase C2e — per-player boon queue contract tests.
//
// Tests the algorithm behind pendingBoonSlotQueue + advanceCoopBoonQueue.
// The real functions close over module-scope COOP_DEBUG/playerSlots/gstate/
// cancelAnimationFrame — so we port the pure logic to a testable shape.

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

// --- ported algorithms ---
function enqueueGuestSlots(playerSlots, coopDebug) {
  if (!coopDebug) return [];
  return playerSlots.filter((s) => s && s.id !== 0 && (s.metrics.hp || 0) > 0);
}

// Returns { opened: boolean, slotId: number | null, remaining: number }.
function advanceQueue(queue, coopDebug, openPickerFn) {
  if (!coopDebug) return { opened: false, slotId: null, remaining: queue.length };
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || (next.metrics.hp || 0) <= 0) continue;
    openPickerFn(next);
    return { opened: true, slotId: next.id, remaining: queue.length };
  }
  return { opened: false, slotId: null, remaining: 0 };
}

function makeSlot(id, hp = 50) {
  return { id, metrics: { hp, maxHp: 50 }, upg: {} };
}

// --- tests ---
{
  const slots = [makeSlot(0), makeSlot(1)];
  const q = enqueueGuestSlots(slots, /* coopDebug */ false);
  assert('solo mode enqueues nothing', q.length === 0);
}
{
  const slots = [makeSlot(0), makeSlot(1)];
  const q = enqueueGuestSlots(slots, true);
  assert('coop mode enqueues guests only', q.length === 1 && q[0].id === 1);
}
{
  const slots = [makeSlot(0), makeSlot(1), makeSlot(2)];
  const q = enqueueGuestSlots(slots, true);
  assert('coop with 2 guests enqueues both', q.length === 2 && q[0].id === 1 && q[1].id === 2);
}
{
  const slots = [makeSlot(0), makeSlot(1, /* hp */ 0)];
  const q = enqueueGuestSlots(slots, true);
  assert('dead guest slot is excluded from queue', q.length === 0);
}
{
  const slots = [makeSlot(0), null, makeSlot(1)];
  const q = enqueueGuestSlots(slots, true);
  assert('null slot entries are skipped', q.length === 1 && q[0].id === 1);
}

// Queue advancement tests
{
  const queue = [];
  let opened = 0;
  const r = advanceQueue(queue, true, () => { opened++; });
  assert('empty queue returns opened=false', r.opened === false && opened === 0);
}
{
  const s1 = makeSlot(1);
  const queue = [s1];
  let openedId = null;
  const r = advanceQueue(queue, true, (slot) => { openedId = slot.id; });
  assert('non-empty queue opens next slot picker', r.opened === true && openedId === 1 && r.remaining === 0);
}
{
  const s1 = makeSlot(1);
  const s2 = makeSlot(2);
  const queue = [s1, s2];
  let opens = [];
  let r1 = advanceQueue(queue, true, (slot) => opens.push(slot.id));
  let r2 = advanceQueue(queue, true, (slot) => opens.push(slot.id));
  let r3 = advanceQueue(queue, true, (slot) => opens.push(slot.id));
  assert('queue drains in FIFO order',
    opens.length === 2 && opens[0] === 1 && opens[1] === 2 && r3.opened === false);
}
{
  const sDead = makeSlot(1, 0);
  const sAlive = makeSlot(2, 30);
  const queue = [sDead, sAlive];
  let openedId = null;
  const r = advanceQueue(queue, true, (slot) => { openedId = slot.id; });
  assert('dead slot at queue head is skipped', r.opened === true && openedId === 2 && r.remaining === 0);
}
{
  const s1 = makeSlot(1);
  const queue = [s1];
  let opens = 0;
  const r = advanceQueue(queue, /* coopDebug */ false, () => { opens++; });
  assert('coopDebug=false never opens picker', r.opened === false && opens === 0);
}

console.log(`Coop-boon-queue suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
