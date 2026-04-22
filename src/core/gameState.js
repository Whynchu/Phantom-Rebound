// Live game-state container. Holds the runtime entity arrays and score
// breakdown that are mutated heavily by the main game loop. Keeping
// stable references (never reassigned) lets modules import them by
// reference.
//
// To clear: use the provided helpers, or `.length = 0` on arrays / key
// reset on scoreBreakdown. Never reassign these exports.

const SCORE_BREAKDOWN_KEYS = [
  'kills', 'roomClear', 'pace', 'efficiency', 'flawless', 'boss',
  'streak', 'density', 'clutch', 'accuracy', 'dodge', 'overkill',
];

function makeEmptyScoreBreakdown() {
  const out = {};
  for (const k of SCORE_BREAKDOWN_KEYS) out[k] = 0;
  return out;
}

const gameEntities = {
  bullets: [],
  enemies: [],
  shockwaves: [],
  spawnQueue: [],
  scoreBreakdown: makeEmptyScoreBreakdown(),
};

function resetEntities() {
  gameEntities.bullets.length = 0;
  gameEntities.enemies.length = 0;
  gameEntities.shockwaves.length = 0;
  gameEntities.spawnQueue.length = 0;
}

function resetBullets() {
  gameEntities.bullets.length = 0;
}

function resetScoreBreakdown() {
  for (const k of SCORE_BREAKDOWN_KEYS) gameEntities.scoreBreakdown[k] = 0;
}

const { bullets, enemies, shockwaves, spawnQueue, scoreBreakdown } = gameEntities;

export {
  gameEntities,
  bullets, enemies, shockwaves, spawnQueue, scoreBreakdown,
  resetEntities, resetBullets, resetScoreBreakdown,
  SCORE_BREAKDOWN_KEYS,
};
