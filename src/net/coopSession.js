// Co-op session state machine.
//
// Owns the lobby handshake between host and guest: subscribe → hello
// exchange → admission → seed negotiation → ready. Does NOT own any
// gameplay state or simulation — that's Phase C. The goal of this
// module is solely to get two browsers into a "ready" state over a
// pluggable transport with identical seeds and identified partners.
//
// Key design decisions (see rubber-duck critique in checkpoints 015+):
//   - Transport is injected, not imported. Lets Node tests use an
//     in-memory fake.
//   - Seed is generated AFTER the host accepts the guest, not at
//     create time. If host refreshes before guest joins, no seed is
//     lost.
//   - Exactly-2-peer enforcement: once host accepts one guest, any
//     subsequent hello is answered with `full`.
//   - All state transitions are idempotent — duplicate hello/accept/
//     ready messages don't double-transition.
//   - Timeouts are injected so tests can advance them synchronously.
//
// State graph (both roles):
//     idle → connecting → waiting_for_partner → ready
//                       ↘ joining            ↗
//     (any)  → error (terminal)
//     (any)  → closed (terminal, user-initiated)

const DEFAULT_TIMEOUTS = {
  subscribeMs: 10000,
  helloAckMs: 15000,
};

const PROTOCOL_VERSION = 1;

function createCoopSession({
  role,
  code,
  identity,
  transportFactory,
  generateSeed,
  generateId,
  now = () => Date.now(),
  setTimeout: setTimeoutFn = setTimeout,
  clearTimeout: clearTimeoutFn = clearTimeout,
  timeouts = {},
  logger = null,
}) {
  if (role !== 'host' && role !== 'guest') {
    throw new Error(`createCoopSession: invalid role '${role}'`);
  }
  if (typeof code !== 'string' || !code) {
    throw new Error('createCoopSession: code required');
  }
  if (!identity || typeof identity.name !== 'string') {
    throw new Error('createCoopSession: identity.name required');
  }
  if (typeof transportFactory !== 'function') {
    throw new Error('createCoopSession: transportFactory required');
  }

  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  const localId = generateId();
  const channelName = `coop:${code}`;

  const handlers = new Map();
  function on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => handlers.get(event).delete(fn);
  }
  function emit(event, payload) {
    const set = handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (err) { logger?.('coopSession handler error', event, err); }
    }
  }

  const gameplayListeners = new Set();
  let legacyWarnedOnce = false;

  const state = {
    phase: 'idle',
    role,
    code,
    localId,
    localIdentity: { ...identity },
    partnerId: null,
    partnerIdentity: null,
    seed: null,
    error: null,
    closed: false,
  };

  let channel = null;
  const pendingTimers = new Set();
  function schedule(ms, fn) {
    const handle = setTimeoutFn(() => {
      pendingTimers.delete(handle);
      fn();
    }, ms);
    pendingTimers.add(handle);
    return handle;
  }
  function cancel(handle) {
    if (!handle) return;
    pendingTimers.delete(handle);
    clearTimeoutFn(handle);
  }
  function cancelAll() {
    for (const h of pendingTimers) clearTimeoutFn(h);
    pendingTimers.clear();
  }

  function setPhase(nextPhase) {
    if (state.phase === nextPhase) return;
    if (state.phase === 'error' || state.phase === 'closed') return;
    state.phase = nextPhase;
    emit('stateChange', { phase: nextPhase });
  }

  function fail(errorCode, detail) {
    if (state.phase === 'error' || state.phase === 'closed') return;
    state.error = { code: errorCode, detail: detail || null, at: now() };
    state.phase = 'error';
    cancelAll();
    emit('error', state.error);
    emit('stateChange', { phase: 'error' });
    channel?.leave?.().catch(() => {});
  }

  async function send(message) {
    if (!channel) throw new Error('coopSession: not subscribed');
    await channel.send({
      ...message,
      from: localId,
      protocol: PROTOCOL_VERSION,
      ts: now(),
    });
  }

  async function sendHandshake(payload) {
    return send({ kind: 'handshake', payload });
  }

  async function sendGameplay(payload) {
    if (state.phase !== 'ready') {
      throw new Error('coopSession: sendGameplay requires ready phase');
    }
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      throw new Error('coopSession: sendGameplay payload must be a non-null object');
    }
    return send({ kind: 'gameplay', payload });
  }

  function onGameplay(fn) {
    if (typeof fn !== 'function') throw new Error('coopSession: onGameplay requires a function');
    gameplayListeners.add(fn);
    return () => gameplayListeners.delete(fn);
  }

  function handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.from === localId) return; // ignore our own echoed broadcasts
    if (msg.protocol !== PROTOCOL_VERSION) {
      logger?.('coopSession: protocol mismatch', msg.protocol);
      return;
    }

    let kind, payload;
    if (msg.kind === 'handshake' || msg.kind === 'gameplay') {
      kind = msg.kind;
      payload = msg.payload;
    } else {
      // Legacy unwrapped form: msg.type at top level (no kind field)
      if (!legacyWarnedOnce) {
        legacyWarnedOnce = true;
        logger?.('coopSession: legacy unwrapped message received; treating as handshake');
      }
      kind = 'handshake';
      payload = msg;
    }

    if (kind === 'gameplay') {
      if (state.phase !== 'ready') {
        logger?.('coopSession: gameplay message dropped (phase=' + state.phase + ')');
        return;
      }
      for (const fn of gameplayListeners) {
        try { fn({ payload, from: msg.from, ts: msg.ts }); } catch (err) { logger?.('coopSession gameplay listener error', err); }
      }
      return;
    }

    // kind === 'handshake': merge from into payload so handlers see msg.from
    const handshakeMsg = { ...payload, from: msg.from };
    if (role === 'host') return handleMessageAsHost(handshakeMsg);
    return handleMessageAsGuest(handshakeMsg);
  }

  function handleMessageAsHost(msg) {
    if (msg.type === 'hello') {
      if (state.partnerId && state.partnerId !== msg.from) {
        sendHandshake({ type: 'full', toId: msg.from }).catch(() => {});
        return;
      }
      if (state.partnerId === msg.from && state.phase === 'ready') {
        sendHandshake({ type: 'accept', toId: msg.from, seed: state.seed, hostIdentity: state.localIdentity }).catch(() => {});
        return;
      }
      state.partnerId = msg.from;
      state.partnerIdentity = msg.identity || { name: 'PARTNER' };
      state.seed = generateSeed();
      cancelAll();
      sendHandshake({
        type: 'accept',
        toId: msg.from,
        seed: state.seed,
        hostIdentity: state.localIdentity,
      }).catch((err) => fail('sendFailed', String(err)));
      emit('partnerJoined', { partnerId: state.partnerId, partnerIdentity: state.partnerIdentity });
      setPhase('ready');
      emit('ready', { seed: state.seed, partnerId: state.partnerId, partnerIdentity: state.partnerIdentity });
      return;
    }
    if (msg.type === 'bye' && msg.from === state.partnerId) {
      state.partnerId = null;
      state.partnerIdentity = null;
      state.seed = null;
      setPhase('waiting_for_partner');
      emit('partnerLeft', {});
      return;
    }
  }

  function handleMessageAsGuest(msg) {
    if (msg.type === 'full' && msg.toId === localId) {
      fail('roomFull', `room ${code} already has a guest`);
      return;
    }
    if (msg.type === 'accept' && msg.toId === localId) {
      if (state.phase === 'ready') return; // idempotent
      state.partnerId = msg.from;
      state.partnerIdentity = msg.hostIdentity || { name: 'HOST' };
      state.seed = (msg.seed >>> 0) || null;
      if (!state.seed) {
        fail('badSeed', 'host sent non-numeric seed');
        return;
      }
      cancelAll();
      emit('partnerJoined', { partnerId: state.partnerId, partnerIdentity: state.partnerIdentity });
      setPhase('ready');
      emit('ready', { seed: state.seed, partnerId: state.partnerId, partnerIdentity: state.partnerIdentity });
      return;
    }
    if (msg.type === 'reject' && msg.toId === localId) {
      fail('rejected', msg.reason || 'host rejected join');
      return;
    }
  }

  async function start() {
    if (state.phase !== 'idle') {
      throw new Error(`coopSession.start: already ${state.phase}`);
    }
    setPhase('connecting');

    const subscribeTimer = schedule(limits.subscribeMs, () => {
      fail('subscribeTimeout', `subscribe to ${channelName} timed out`);
    });

    try {
      channel = await transportFactory().subscribe(channelName, {
        onMessage: handleMessage,
        onError: (err) => fail('transportError', String(err?.message || err)),
      });
    } catch (err) {
      cancel(subscribeTimer);
      fail('subscribeFailed', String(err?.message || err));
      return;
    }
    cancel(subscribeTimer);
    if (state.phase === 'error' || state.phase === 'closed') return;

    if (role === 'host') {
      setPhase('waiting_for_partner');
      // No outbound message: host just listens for guest hello.
      return;
    }

    setPhase('joining');
    const helloAckTimer = schedule(limits.helloAckMs, () => {
      fail('helloAckTimeout', `no response from host for ${channelName}`);
    });

    try {
      await sendHandshake({ type: 'hello', identity: state.localIdentity });
    } catch (err) {
      cancel(helloAckTimer);
      fail('sendFailed', String(err?.message || err));
      return;
    }
    // helloAckTimer gets cancelled by handleMessageAsGuest on accept/full/reject.
    on('stateChange', ({ phase }) => {
      if (phase === 'ready' || phase === 'error' || phase === 'closed') {
        cancel(helloAckTimer);
      }
    });
  }

  async function close() {
    if (state.phase === 'closed') return;
    if (channel) {
      try { await sendHandshake({ type: 'bye' }); } catch { /* ignore */ }
      try { await channel.leave(); } catch { /* ignore */ }
    }
    cancelAll();
    const wasReady = state.phase === 'ready';
    state.phase = 'closed';
    state.closed = true;
    emit('stateChange', { phase: 'closed', wasReady });
  }

  return {
    on,
    start,
    close,
    sendGameplay,
    onGameplay,
    getState: () => ({ ...state }),
    get channelName() { return channelName; },
    get localId() { return localId; },
  };
}

export { createCoopSession, PROTOCOL_VERSION, DEFAULT_TIMEOUTS };
