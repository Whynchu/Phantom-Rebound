// Lightweight boon hook registry.
//
// Each hook is a named pub-sub channel that script.js fires at specific
// gameplay moments (room clear, kill, damage, fire, etc.). Boon effects
// can register a callback on the appropriate hook instead of having the
// main loop check UPG.* flags inline for every boon.
//
// Context objects are shape-stable per hook:
//   onRoomClear(ctx): { UPG, healPlayer }
//   onKill(ctx):      { UPG, enemy, points }        (future)
//   onDamage(ctx):    { UPG, amount, source }       (future)
//   onFire(ctx):      { UPG, bullet }               (future)
//   onTick(ctx):      { UPG, dt }                   (future)
//
// Callbacks must be idempotent-guard-free (they run every time the hook
// fires; each callback is responsible for its own UPG.* gate).

const hooks = Object.create(null);

function registerBoonHook(name, fn) {
  if (typeof fn !== 'function') return;
  if (!hooks[name]) hooks[name] = [];
  hooks[name].push(fn);
}

function runBoonHook(name, ctx) {
  const list = hooks[name];
  if (!list || list.length === 0) return;
  for (let i = 0; i < list.length; i += 1) {
    try {
      list[i](ctx);
    } catch (err) {
      console.error(`[boonHook:${name}]`, err);
    }
  }
}

function clearBoonHooks() {
  for (const k of Object.keys(hooks)) delete hooks[k];
}

function getBoonHookCount(name) {
  const list = hooks[name];
  return list ? list.length : 0;
}

// Built-in room-clear effects. These were previously inline in script.js
// (duplicated across two room-clear branches). Each callback checks its
// own UPG.* gate so the caller only needs to fire the hook.

registerBoonHook('onRoomClear', (ctx) => {
  const { UPG, healPlayer } = ctx;
  if (UPG && UPG.regenTick > 0 && typeof healPlayer === 'function') {
    healPlayer(UPG.regenTick, 'roomRegen');
  }
});

registerBoonHook('onRoomClear', (ctx) => {
  const { UPG } = ctx;
  if (UPG && UPG.escalation) UPG.escalationKills = 0;
});

registerBoonHook('onRoomClear', (ctx) => {
  const { UPG } = ctx;
  if (UPG && UPG.empBurst) UPG.empBurstUsed = false;
});

// ── Per-frame cooldown ticks. Context: { UPG, dt, ts }.
// Each hook decrements its own UPG.*Cooldown timer when the boon is active.

registerBoonHook('onTick', (ctx) => {
  const { UPG, dt } = ctx;
  if (UPG && UPG.shockwave && UPG.shockwaveCooldown > 0) UPG.shockwaveCooldown -= dt * 1000;
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, dt } = ctx;
  if (UPG && UPG.refraction && UPG.refractionCooldown > 0) UPG.refractionCooldown -= dt * 1000;
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, dt } = ctx;
  if (UPG && UPG.mirrorTide && UPG.mirrorTideCooldown > 0) UPG.mirrorTideCooldown -= dt * 1000;
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, dt } = ctx;
  if (UPG && UPG.overload && UPG.overloadCooldown > 0) UPG.overloadCooldown -= dt * 1000;
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, dt } = ctx;
  if (UPG && UPG.phaseDash && UPG.phaseDashCooldown > 0) UPG.phaseDashCooldown -= dt * 1000;
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, ts } = ctx;
  if (UPG && UPG.voidWalker && UPG.voidZoneTimer && ts > UPG.voidZoneTimer) {
    UPG.voidZoneActive = false;
  }
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, ts } = ctx;
  if (UPG && UPG.bloodMoon && UPG.bloodMoonTimer && ts > UPG.bloodMoonTimer) {
    UPG.bloodMoonStacks = 0;
    UPG.bloodMoonTimer = 0;
  }
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, ts } = ctx;
  if (UPG && UPG.corona && UPG.coronaTimer && ts > UPG.coronaTimer) {
    UPG.coronaStacks = 0;
    UPG.coronaTimer = 0;
  }
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, ts } = ctx;
  if (UPG && UPG.predatorInstinct && UPG.predatorKillStreakTime > 0 && ts > UPG.predatorKillStreakTime) {
    UPG.predatorKillStreak = 0;
  }
});

registerBoonHook('onTick', (ctx) => {
  const { UPG, ts } = ctx;
  if (UPG && UPG.bloodRush && UPG.bloodRushTimer > 0 && ts > UPG.bloodRushTimer) {
    UPG.bloodRushStacks = 0;
  }
});

// ── Pause-time timer adjustments. Context: { UPG, pauseDuration }.
// Shift absolute-timestamp-based boon timers forward so they don't expire during pause.

registerBoonHook('onPauseAdjust', (ctx) => {
  const { UPG, pauseDuration } = ctx;
  if (!UPG) return;
  if (UPG.predatorKillStreakTime) UPG.predatorKillStreakTime += pauseDuration;
  if (UPG.bloodRushTimer) UPG.bloodRushTimer += pauseDuration;
  if (UPG.bloodMoonTimer) UPG.bloodMoonTimer += pauseDuration;
  if (UPG.coronaTimer) UPG.coronaTimer += pauseDuration;
  if (UPG.voidZoneTimer) UPG.voidZoneTimer += pauseDuration;
  if (UPG.sustainedFireLastShotTime) UPG.sustainedFireLastShotTime += pauseDuration;
  if (UPG.aegisBatteryTimer) UPG.aegisBatteryTimer += pauseDuration;
});

// ── Room-start inits. Context: { UPG }.
// Seed/reset boon state that should begin fresh each room.

registerBoonHook('onRoomStart', (ctx) => {
  const { UPG } = ctx;
  if (!UPG) return;
  UPG.predatorKillStreak = 0;
  UPG.predatorKillStreakTime = 0;
  UPG.bloodMoonStacks = 0;
  UPG.bloodMoonTimer = 0;
  UPG.coronaStacks = 0;
  UPG.coronaTimer = 0;
});

registerBoonHook('onRoomStart', (ctx) => {
  const { UPG } = ctx;
  if (UPG && UPG.mirrorTide) {
    UPG.mirrorTideRoomUses = 0;
    UPG.mirrorTideCooldown = 0;
  }
});

registerBoonHook('onRoomStart', (ctx) => {
  const { UPG } = ctx;
  if (UPG && UPG.phaseDash) {
    UPG.phaseDashRoomUses = 0;
    UPG.phaseDashCooldown = 0;
    UPG.isDashing = false;
  }
});

// ── 1.11.0 OVERFLOW PROTOCOL — overflow consumption flavors.
// ctx: { UPG, claim }. First hook to set `claim` wins (priority via
// registration order: Snipe > Rapid > Orb > baseline). Claim shape:
//   { kind: 'damage', mult, flavor }      — multiply volley baseDmg by `mult`
//   { kind: 'extraShot', count, flavor }  — append `count` extra projectiles
// If no hook claims, firePlayer applies a baseline damage 1.25 multiplier.
// Sim mirror in src/sim/playerFireStep.js encodes the same priority inline
// (sim runs deterministic — no hook indirection there).

registerBoonHook('onOverflowConsume', (ctx) => {
  if (!ctx || ctx.claim) return;
  const { UPG } = ctx;
  if (UPG && (UPG.snipePower || 0) > 0) {
    ctx.claim = { kind: 'damage', mult: 1.5, flavor: 'snipe' };
  }
});

registerBoonHook('onOverflowConsume', (ctx) => {
  if (!ctx || ctx.claim) return;
  const { UPG } = ctx;
  if (UPG && (UPG.spsTier || 0) >= 1) {
    ctx.claim = { kind: 'extraShot', count: 1, flavor: 'rapid' };
  }
});

registerBoonHook('onOverflowConsume', (ctx) => {
  if (!ctx || ctx.claim) return;
  const { UPG } = ctx;
  // Orb flavor requires Charged Orbs to be meaningful — without it we'd
  // just be tickling enemies with collision pulses. Fall through to baseline
  // otherwise.
  if (UPG && (UPG.orbitSphereTier || 0) > 0 && UPG.chargedOrbs) {
    ctx.claim = { kind: 'orbPulse', flavor: 'orb' };
    UPG.overflowOrbPulse = true;
  }
});

export { registerBoonHook, runBoonHook, clearBoonHooks, getBoonHookCount };
