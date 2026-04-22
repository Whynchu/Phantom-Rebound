// Phantom Rebound — Shared constants (source of truth for scattered magic numbers).
// Add values here when they appear in more than one file, or when they represent
// tunable knobs worth centralizing.

// ── localStorage keys ────────────────────────────────────────────────────────
// Use STORAGE_KEYS.playerColor rather than string literals so a rename only
// touches one place.
export const STORAGE_KEYS = Object.freeze({
  playerColor: 'phantom-player-color',
  colorAssist: 'phantom-color-assist',
  playerHat: 'phantom-player-hat',
  leaderboard: 'phantom-rebound-leaderboard-v1',
  runnerName: 'phantom-rebound-runner-name',
  legacyRunRecovery: 'phantom-rebound-run-recovery-v1',
  updateAvailable: 'phantom-rebound-update-available',
  savedRun: 'phantom-saved-run',
});

// ── Runtime entity caps ──────────────────────────────────────────────────────
// Controls memory/CPU ceiling during bursty frames. Bumping these impacts
// frame rate on low-end Android; tread carefully.
export const MAX_PARTICLES = 600;
export const MAX_BULLETS = 400;
export const MAX_DMG_NUMBERS = 30;

// ── Player shield hitbox (rectangular, centered on player) ───────────────────
export const SHIELD_HALF_W = 9;
export const SHIELD_HALF_H = 4.5;

// ── Enemy tell timing ────────────────────────────────────────────────────────
// How long (ms) before an enemy's shot is telegraphed visually.
export const WINDUP_MS_DRAW = 520;
