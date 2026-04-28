// Older notes archived in patchNotesArchive.js. Only the 50 most recent entries are loaded in-client.

const PATCH_NOTES_RECENT = [
  {
      version: '1.3.1',
      label: 'PROJECTILE FIXES',
      summary: ['Fixed Volatile Rounds child bullets re-hitting the enemy that triggered the split.'],
      highlights: [
        'Kept triangle burst projectiles dangerous after wall-adjacent splits instead of immediately turning into grey pickups.',
      ]
    },
  {
      version: '1.3.0',
      label: 'CO-OP MODE',
      summary: ['MAJOR UPDATE: Full co-op multiplayer implementation. Play with a partner over the internet in real-time. Hosts create rooms via Supabase; guests join via code. All game features (boons, enemies, rooms, bosses, scoring) now support 2-player simultaneous gameplay with low-latency synchronization.'],
      highlights: [
        'Supabase real-time sessions: host creates runId via postCoopRun(); guests join via joinCoopRun(runId). Automatic cleanup and state tracking.',
        'H1+H2 hybrid authority: host runs full simulation and broadcasts snapshots at 10Hz. Guest runs local prediction for movement + cosmetics; receives authoritative state from host for collision/damage/room events.',
        'Smooth 60fps rendering on guest: per-frame interpolation sweeps between 10Hz snapshots; no jitter or frame freezing.',
        'Network-resilient architecture: guest auto-syncs on snapshot arrival; room phase advances independently of snapshot timing; automatic peer-to-peer input relay via Supabase.',
        'Full feature parity: all 50+ boons, all enemy types and room progressions, boss mechanics, shields, orbs, legendary sequences — all work seamlessly in co-op.',
        'Visual sync: partner colors override (guest sees host in correct color), cosmetic sync (shields, orbs, hats, damage numbers), charge ring animation, enemy windup rings, shockwave effects.',
        'Spectator mode: defeated players spectate their partner at 30% opacity with frown expression while the partner continues playing.',
        'Score tracking: per-player room scores, combo chains, boon selections, and run statistics synced across peers and persisted to Supabase.',
      ]
    },
];

const PATCH_NOTES = PATCH_NOTES_RECENT.slice(0, 50);

const PATCH_NOTES_ARCHIVE_MESSAGE = 'In-client notes show the 50 most recent updates. Older builds were not archived in this panel.';

export { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE };
