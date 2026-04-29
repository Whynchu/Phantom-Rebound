// Co-op transport abstraction.
//
// Exposes the thin interface the session state machine depends on.
// No Supabase import here — the concrete adapter is injected via
// `transportFactory`. This keeps the state machine testable in Node
// with an in-memory fake and defers CDN/network dependencies to the
// browser-only adapter in `coopTransportSupabase.js`.
//
// A transport is any object exposing:
//   subscribe(channelName, { onMessage, onError })
//     → Promise<Channel>   (rejects on subscribe failure/timeout)
//
// A Channel is any object exposing:
//   send(message)   → Promise<void>   (broadcast to all subscribers)
//   leave()         → Promise<void>   (unsubscribe + release resources)
//
// Messages are plain JSON-serializable objects.

// Avoids ambiguous glyphs (0/O, 1/I/L) so players can read codes off
// a screen without confusion.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode(length = 6, randomBytes = defaultRandomBytes) {
  const bytes = randomBytes(length);
  const out = new Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return out.join('');
}

// 128-bit opaque identifier — used for per-client IDs and the session
// token baked into the shareable URL. Not for display.
function generateOpaqueId(randomBytes = defaultRandomBytes) {
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function defaultRandomBytes(count) {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(count);
    g.crypto.getRandomValues(buf);
    return buf;
  }
  throw new Error('coopTransport: no crypto.getRandomValues available');
}

// Derive a 32-bit simulation seed from crypto random bytes. Fed into
// simRng.reseed() on both clients so their sims walk identical paths.
function generateSimSeed(randomBytes = defaultRandomBytes) {
  const bytes = randomBytes(4);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return n || 1;
}

export {
  generateRoomCode,
  generateOpaqueId,
  generateSimSeed,
  defaultRandomBytes,
  ROOM_CODE_ALPHABET,
};
