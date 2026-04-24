// Gameplay channel tests for coopSession — C3a-pre-2.
// Verifies sendGameplay/onGameplay multiplexed with the handshake envelope.

import { strict as assert } from 'node:assert';
import { createCoopSession } from '../src/net/coopSession.js';
import { createMemoryBus } from './test-utils/coopMemoryBus.mjs';

let pass = 0;
let fail = 0;

function test(name, fn) {
  return (async () => {
    try {
      await fn();
      console.log(`PASS ${name}`);
      pass++;
    } catch (err) {
      console.log(`FAIL ${name} — ${err && err.stack ? err.stack : err}`);
      fail++;
    }
  })();
}

function flush(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let nextId = 65; // 'A'
const baseDeps = () => ({
  generateSeed: () => 0xBEEF,
  generateId: () => String.fromCharCode(nextId++).repeat(8),
});

async function makeReadyPair(code) {
  const bus = createMemoryBus();
  const deps = baseDeps();
  const host = createCoopSession({
    role: 'host', code,
    identity: { name: 'HOST' },
    transportFactory: () => bus.transport,
    ...deps,
  });
  const guest = createCoopSession({
    role: 'guest', code,
    identity: { name: 'GUEST' },
    transportFactory: () => bus.transport,
    ...deps,
  });
  await host.start();
  await guest.start();
  await flush();
  return { host, guest, bus };
}

// 1. sendGameplay before ready throws
await test('sendGameplay before ready throws', async () => {
  const bus = createMemoryBus();
  const host = createCoopSession({
    role: 'host', code: 'GP001',
    identity: { name: 'H' },
    transportFactory: () => bus.transport,
    ...baseDeps(),
  });
  await host.start(); // waiting_for_partner, not ready
  await assert.rejects(() => host.sendGameplay({ x: 1 }), /ready phase/);
});

// 2. host sendGameplay fires onGameplay on guest
await test('host sendGameplay({a:1}) fires onGameplay on guest with correct payload and from', async () => {
  const { host, guest } = await makeReadyPair('GP002');
  const received = [];
  guest.onGameplay((ev) => received.push(ev));
  await host.sendGameplay({ a: 1 });
  await flush();
  assert.equal(received.length, 1);
  assert.equal(received[0].payload.a, 1);
  assert.equal(received[0].from, host.localId);
});

// 3. guest sendGameplay fires onGameplay on host (symmetric)
await test('guest sendGameplay fires onGameplay on host (symmetric)', async () => {
  const { host, guest } = await makeReadyPair('GP003');
  const received = [];
  host.onGameplay((ev) => received.push(ev));
  await guest.sendGameplay({ b: 2 });
  await flush();
  assert.equal(received.length, 1);
  assert.equal(received[0].payload.b, 2);
  assert.equal(received[0].from, guest.localId);
});

// 4. Handshake listeners never fire from a gameplay message
await test('handshake listeners never fire from a gameplay message', async () => {
  const { host, guest } = await makeReadyPair('GP004');
  let handshakeFired = false;
  host.on('partnerJoined', () => { handshakeFired = true; });
  host.on('ready', () => { handshakeFired = true; });
  await guest.sendGameplay({ ping: true });
  await flush();
  assert.equal(handshakeFired, false, 'handshake events must not fire from gameplay messages');
});

// 5. onGameplay listener added AFTER ready still receives subsequent messages
await test('onGameplay listener added after ready still receives messages', async () => {
  const { host, guest } = await makeReadyPair('GP005');
  // Add listener after reaching ready
  const received = [];
  guest.onGameplay((ev) => received.push(ev));
  await host.sendGameplay({ late: true });
  await flush();
  assert.equal(received.length, 1);
  assert.equal(received[0].payload.late, true);
});

// 6. Multiple onGameplay listeners all fire; unsubscribe stops one without affecting the others
await test('multiple onGameplay listeners; unsubscribe stops one, not others', async () => {
  const { host, guest } = await makeReadyPair('GP006');
  const log1 = [];
  const log2 = [];
  const unsub1 = guest.onGameplay((ev) => log1.push(ev));
  guest.onGameplay((ev) => log2.push(ev));

  await host.sendGameplay({ n: 1 });
  await flush();
  assert.equal(log1.length, 1);
  assert.equal(log2.length, 1);

  unsub1();

  await host.sendGameplay({ n: 2 });
  await flush();
  assert.equal(log1.length, 1, 'unsubscribed listener must not fire again');
  assert.equal(log2.length, 2, 'other listener must still fire');
});

// 7. Legacy unwrapped handshake still triggers handshake flow (back-compat)
await test('legacy unwrapped hello (no kind field) triggers handshake flow', async () => {
  const bus = createMemoryBus();
  const host = createCoopSession({
    role: 'host', code: 'GP007',
    identity: { name: 'H' },
    transportFactory: () => bus.transport,
    ...baseDeps(),
  });
  await host.start(); // waiting_for_partner

  let partnerJoinedFired = false;
  host.on('partnerJoined', () => { partnerJoinedFired = true; });

  const legacyId = 'legacy-peer-id';
  const spy = await bus.transport.subscribe('coop:GP007', { onMessage() {}, onError() {} });
  await spy.send({
    type: 'hello',
    identity: { name: 'LEGACY' },
    from: legacyId,
    protocol: 1,
    ts: Date.now(),
  });
  await flush();

  assert.equal(host.getState().phase, 'ready', 'host should reach ready');
  assert.equal(host.getState().partnerId, legacyId, 'partnerId should match legacy sender');
  assert.equal(partnerJoinedFired, true, 'partnerJoined should fire');
});

// 8. Wrapped handshake envelope {kind:'handshake', payload:{type:'hello',...}} triggers handshake flow
await test('wrapped handshake envelope triggers handshake flow identically', async () => {
  const bus = createMemoryBus();
  const host = createCoopSession({
    role: 'host', code: 'GP008',
    identity: { name: 'H' },
    transportFactory: () => bus.transport,
    ...baseDeps(),
  });
  await host.start();

  let partnerJoinedFired = false;
  host.on('partnerJoined', () => { partnerJoinedFired = true; });

  const wrappedId = 'wrapped-peer-id';
  const spy = await bus.transport.subscribe('coop:GP008', { onMessage() {}, onError() {} });
  await spy.send({
    kind: 'handshake',
    payload: { type: 'hello', identity: { name: 'WRAPPED' } },
    from: wrappedId,
    protocol: 1,
    ts: Date.now(),
  });
  await flush();

  assert.equal(host.getState().phase, 'ready', 'host should reach ready');
  assert.equal(host.getState().partnerId, wrappedId);
  assert.equal(partnerJoinedFired, true);
});

// 9. sendGameplay(null) / sendGameplay(undefined) / sendGameplay('string') throw
await test('sendGameplay(null/undefined/string) throws', async () => {
  const { host } = await makeReadyPair('GP009');
  await assert.rejects(() => host.sendGameplay(null), /non-null object/);
  await assert.rejects(() => host.sendGameplay(undefined), /non-null object/);
  await assert.rejects(() => host.sendGameplay('string'), /non-null object/);
});

// 10. onGameplay with non-function argument throws
await test('onGameplay with non-function throws', async () => {
  const { host } = await makeReadyPair('GP010');
  assert.throws(() => host.onGameplay(42), /requires a function/);
  assert.throws(() => host.onGameplay('fn'), /requires a function/);
  assert.throws(() => host.onGameplay(null), /requires a function/);
});

// 11. Gameplay message received before host finishes handshake is dropped
await test('gameplay message dropped before ready (no listener call, no error)', async () => {
  const bus = createMemoryBus();
  const host = createCoopSession({
    role: 'host', code: 'GP011',
    identity: { name: 'H' },
    transportFactory: () => bus.transport,
    ...baseDeps(),
  });
  await host.start(); // waiting_for_partner

  let gpFired = false;
  host.onGameplay(() => { gpFired = true; });

  const spy = await bus.transport.subscribe('coop:GP011', { onMessage() {}, onError() {} });
  await spy.send({
    kind: 'gameplay',
    payload: { early: true },
    from: 'some-other-peer',
    protocol: 1,
    ts: Date.now(),
  });
  await flush();

  assert.equal(gpFired, false, 'gameplay listener must not fire before ready');
  assert.equal(host.getState().phase, 'waiting_for_partner', 'phase unchanged');
});

// 12. Message from self (echoed by transport) is NOT delivered to onGameplay
await test('message from self is not delivered to onGameplay', async () => {
  const { host, bus } = await makeReadyPair('GP012');

  let selfFired = false;
  host.onGameplay(() => { selfFired = true; });

  // A 3rd-party spy injects a message claiming to be from the host itself
  const spy = await bus.transport.subscribe('coop:GP012', { onMessage() {}, onError() {} });
  await spy.send({
    kind: 'gameplay',
    payload: { self: true },
    from: host.localId, // <-- claimed to be from host
    protocol: 1,
    ts: Date.now(),
  });
  await flush();

  assert.equal(selfFired, false, 'message with from===localId must be ignored');
});

// -------------------------------------------------------------------------

console.log('');
console.log(`Coop-gameplay-channel suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
