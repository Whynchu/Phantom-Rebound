// Browser-only Supabase Realtime adapter for coopSession.
//
// Lazy-loads @supabase/supabase-js from a pinned CDN URL so the core
// game loads nothing extra for solo runs. Only when the user clicks
// "Co-op" do we pay the cost of fetching the client.
//
// Conforms to the transport contract expected by coopSession.js:
//   transportFactory() -> { subscribe(channelName, { onMessage, onError }) }
//     .subscribe(...) resolves to a channel object with:
//       - send(msg)  -> Promise (uses broadcast event 'msg')
//       - leave()    -> Promise
//
// No Postgres tables or RLS required — this is pure pub/sub broadcast.

import { LEADERBOARD_REMOTE_CONFIG, hasRemoteLeaderboardConfig } from '../data/leaderboardConfig.js';

// Pinned to a specific patch so a future supabase-js change can't
// silently break the co-op protocol in production.
const SUPABASE_CDN = 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';

let clientPromise = null;

function loadClient() {
  if (clientPromise) return clientPromise;
  if (!hasRemoteLeaderboardConfig()) {
    clientPromise = Promise.reject(new Error('Supabase config missing'));
    return clientPromise;
  }
  clientPromise = (async () => {
    const mod = await import(/* @vite-ignore */ SUPABASE_CDN);
    const { createClient } = mod;
    if (typeof createClient !== 'function') {
      throw new Error('supabase-js createClient not found');
    }
    return createClient(
      LEADERBOARD_REMOTE_CONFIG.url,
      LEADERBOARD_REMOTE_CONFIG.publishableKey,
      {
        realtime: { params: { eventsPerSecond: 20 } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  })();
  clientPromise = clientPromise.catch((err) => {
    clientPromise = null;
    throw err;
  });
  return clientPromise;
}

function createSupabaseTransport() {
  return {
    async subscribe(channelName, { onMessage, onError } = {}) {
      const client = await loadClient();
      const channel = client.channel(channelName, {
        config: { broadcast: { self: false, ack: true } },
      });

      channel.on('broadcast', { event: 'msg' }, (payload) => {
        try { onMessage?.(payload?.payload); }
        catch (err) { onError?.(err); }
      });

      await new Promise((resolve, reject) => {
        let settled = false;
        channel.subscribe((status, err) => {
          if (settled) {
            if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
              onError?.(err || new Error(`channel ${channelName} status ${status}`));
            }
            return;
          }
          if (status === 'SUBSCRIBED') {
            settled = true;
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            settled = true;
            reject(err || new Error(`subscribe ${channelName} failed: ${status}`));
          }
        });
      });

      return {
        async send(msg) {
          const result = await channel.send({ type: 'broadcast', event: 'msg', payload: msg });
          if (result !== 'ok') {
            throw new Error(`broadcast send returned ${result}`);
          }
        },
        async leave() {
          try { await channel.unsubscribe(); } catch { /* ignore */ }
          try { client.removeChannel(channel); } catch { /* ignore */ }
        },
      };
    },
  };
}

function supabaseTransportFactory() {
  return createSupabaseTransport();
}

export { supabaseTransportFactory, loadClient as _loadSupabaseClientForTest };
