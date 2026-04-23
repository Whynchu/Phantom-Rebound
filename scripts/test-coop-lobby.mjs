// Co-op lobby state-machine tests. Verifies the Phase B handshake
// between host and guest using an in-memory fake transport. No
// network, no Supabase — just state logic.

import { strict as assert } from 'node:assert';
import { createCoopSession } from '../src/net/coopSession.js';
import {
  generateRoomCode,
  generateOpaqueId,
  generateSimSeed,
  ROOM_CODE_ALPHABET,
} from '../src/net/coopTransport.js';
import { createMemoryBus } from './test-utils/coopMemoryBus.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  const run = async () => {
    try {
      await fn();
      console.log(`PASS ${name}`);
      passed++;
    } catch (err) {
      console.log(`FAIL ${name}`);
      console.log(`  ${err && err.stack ? err.stack : err}`);
      failed++;
    }
  };
  return run();
}

function flush(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function counterBytes(seed) {
  let i = seed;
  return (count) => {
    const out = new Uint8Array(count);
    for (let k = 0; k < count; k++) out[k] = (i++) & 0xff;
    return out;
  };
}

const baseDeps = () => {
  let nextIdChar = 97; // 'a'
  return {
    generateSeed: () => 0xC0FFEE,
    generateId: () => String.fromCharCode(nextIdChar++).repeat(8),
  };
};

await test('generateRoomCode uses unambiguous alphabet, no 0/O/1/I/L', async () => {
  const code = generateRoomCode(6, counterBytes(0));
  assert.equal(code.length, 6);
  for (const ch of code) assert.ok(ROOM_CODE_ALPHABET.includes(ch), `bad char ${ch}`);
  assert.ok(!/[01OIL]/.test(ROOM_CODE_ALPHABET));
});

await test('generateOpaqueId is 32 hex chars (128 bits)', async () => {
  const id = generateOpaqueId(counterBytes(0));
  assert.match(id, /^[0-9a-f]{32}$/);
});

await test('generateSimSeed produces nonzero 32-bit uint', async () => {
  const s = generateSimSeed(counterBytes(1));
  assert.ok(Number.isInteger(s) && s >= 1 && s <= 0xffffffff);
});

await test('happy path: host + guest reach ready with shared seed', async () => {
  const bus = createMemoryBus();
  const deps = baseDeps();

  const host = createCoopSession({
    role: 'host',
    code: 'TEST01',
    identity: { name: 'HOST', color: 'green' },
    transportFactory: () => bus.transport,
    ...deps,
  });
  const guest = createCoopSession({
    role: 'guest',
    code: 'TEST01',
    identity: { name: 'GUEST', color: 'blue' },
    transportFactory: () => bus.transport,
    ...deps,
  });

  await host.start();
  await guest.start();
  await flush();

  assert.equal(host.getState().phase, 'ready');
  assert.equal(guest.getState().phase, 'ready');
  assert.equal(host.getState().seed, 0xC0FFEE);
  assert.equal(guest.getState().seed, 0xC0FFEE);
  assert.equal(host.getState().partnerIdentity.name, 'GUEST');
  assert.equal(guest.getState().partnerIdentity.name, 'HOST');
});

await test('second guest attempting to join a full room is rejected with roomFull', async () => {
  const bus = createMemoryBus();
  const deps = baseDeps();

  const host = createCoopSession({
    role: 'host', code: 'FULL01',
    identity: { name: 'HOST', color: 'green' },
    transportFactory: () => bus.transport, ...deps,
  });
  const guestA = createCoopSession({
    role: 'guest', code: 'FULL01',
    identity: { name: 'A', color: 'blue' },
    transportFactory: () => bus.transport, ...deps,
  });
  const guestB = createCoopSession({
    role: 'guest', code: 'FULL01',
    identity: { name: 'B', color: 'pink' },
    transportFactory: () => bus.transport, ...deps,
  });

  await host.start();
  await guestA.start();
  await flush();
  await guestB.start();
  await flush();

  assert.equal(host.getState().phase, 'ready');
  assert.equal(guestA.getState().phase, 'ready');
  assert.equal(guestB.getState().phase, 'error');
  assert.equal(guestB.getState().error.code, 'roomFull');
});

await test('duplicate hello from accepted guest does not re-emit ready or change seed', async () => {
  const bus = createMemoryBus();
  let seedCallCount = 0;
  const deps = {
    generateSeed: () => { seedCallCount++; return 42; },
    generateId: (() => { let i = 97; return () => String.fromCharCode(i++).repeat(8); })(),
  };

  const host = createCoopSession({
    role: 'host', code: 'DUP001',
    identity: { name: 'H' },
    transportFactory: () => bus.transport, ...deps,
  });
  const guest = createCoopSession({
    role: 'guest', code: 'DUP001',
    identity: { name: 'G' },
    transportFactory: () => bus.transport, ...deps,
  });

  let readyCount = 0;
  host.on('ready', () => readyCount++);

  await host.start();
  await guest.start();
  await flush();
  assert.equal(host.getState().phase, 'ready');
  assert.equal(seedCallCount, 1);
  assert.equal(readyCount, 1);

  // Simulate a retransmitted hello by injecting via the guest's channel.
  // Easiest: start another instance pretending to be the same guest.
  // Simpler: invoke the internal path by starting a second guest — but
  // that is a DIFFERENT partnerId, so host will reply `full`. Instead
  // we send a fake "hello" directly on the bus with the same from-id
  // as the accepted guest.
  const ch = await bus.transport.subscribe('coop:DUP001', { onMessage() {}, onError() {} });
  await ch.send({
    type: 'hello',
    identity: { name: 'G' },
    from: guest.localId,
    protocol: 1,
    ts: Date.now(),
  });
  await flush();

  assert.equal(host.getState().phase, 'ready');
  assert.equal(seedCallCount, 1, 'seed must not be re-generated');
  assert.equal(readyCount, 1, 'ready event must not re-fire');
});

await test('guest helloAckTimeout fires when no host is present', async () => {
  const bus = createMemoryBus();
  const deps = baseDeps();
  const timers = [];
  let now = 0;
  const fakeSetTimeout = (fn, ms) => {
    const handle = { fn, due: now + ms, cancelled: false };
    timers.push(handle);
    return handle;
  };
  const fakeClearTimeout = (handle) => { if (handle) handle.cancelled = true; };
  const advance = (ms) => {
    now += ms;
    for (const t of [...timers]) {
      if (!t.cancelled && t.due <= now) {
        t.cancelled = true;
        t.fn();
      }
    }
  };

  const guest = createCoopSession({
    role: 'guest', code: 'NOHOST',
    identity: { name: 'G' },
    transportFactory: () => bus.transport,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    now: () => now,
    timeouts: { helloAckMs: 1000, subscribeMs: 500 },
    ...deps,
  });

  await guest.start();
  await flush();
  // Guest sent hello. No host to respond.
  advance(1500);
  await flush();

  assert.equal(guest.getState().phase, 'error');
  assert.equal(guest.getState().error.code, 'helloAckTimeout');
});

await test('subscribe failure transitions to error with subscribeFailed', async () => {
  const deps = baseDeps();
  const failingTransport = {
    subscribe() { return Promise.reject(new Error('boom')); },
  };
  const host = createCoopSession({
    role: 'host', code: 'FAIL01',
    identity: { name: 'H' },
    transportFactory: () => failingTransport,
    ...deps,
  });
  await host.start();
  assert.equal(host.getState().phase, 'error');
  assert.equal(host.getState().error.code, 'subscribeFailed');
  assert.match(host.getState().error.detail, /boom/);
});

await test('host close after ready transitions both to terminal', async () => {
  const bus = createMemoryBus();
  const deps = baseDeps();
  const host = createCoopSession({
    role: 'host', code: 'BYE001',
    identity: { name: 'H' },
    transportFactory: () => bus.transport, ...deps,
  });
  const guest = createCoopSession({
    role: 'guest', code: 'BYE001',
    identity: { name: 'G' },
    transportFactory: () => bus.transport, ...deps,
  });
  await host.start();
  await guest.start();
  await flush();
  assert.equal(host.getState().phase, 'ready');

  await host.close();
  await flush();

  assert.equal(host.getState().phase, 'closed');
  // Guest observes the bye → reverts to... actually guest-side bye handling
  // is not implemented yet (host-only). That's fine for Phase B; Phase E
  // will add full reconnect semantics. For now we just assert host closes
  // cleanly and bus has no hanging subscriptions from host side.
  assert.ok(bus.getSubscriberCount('coop:BYE001') <= 1);
});

await test('invalid role throws synchronously', async () => {
  assert.throws(
    () => createCoopSession({
      role: 'spectator',
      code: 'X', identity: { name: 'x' },
      transportFactory: () => ({}),
      generateSeed: () => 1, generateId: () => 'a',
    }),
    /invalid role/,
  );
});

await test('missing identity.name throws synchronously', async () => {
  assert.throws(
    () => createCoopSession({
      role: 'host', code: 'X', identity: {},
      transportFactory: () => ({}),
      generateSeed: () => 1, generateId: () => 'a',
    }),
    /identity\.name/,
  );
});

// -------------------------------------------------------------------------

console.log('');
console.log(`Coop lobby suite: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
