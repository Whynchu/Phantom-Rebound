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

export { registerBoonHook, runBoonHook, clearBoonHooks, getBoonHookCount };
