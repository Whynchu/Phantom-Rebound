// R0.4 step 6 — Region B (bullet bounce dispatch) carve-out.
//
// Pure dispatcher that decides what happens when an output or danger bullet
// hits a wall. Replaces the inline switch at script.js:5970-6011. Returns
// a structured result describing:
//   - effects[]:           ordered side-effect descriptors (sparks, burst,
//                          elite-stage-advance) that the caller translates
//                          back into legacy fns today and will route through
//                          state.effectQueue once Region B is fully in-sim
//   - removeSourceBullet:  caller should bullets.splice() this index
//   - skipRestOfFrame:     caller should `continue` the bullet loop after
//                          handling effects + followUp (matches the legacy
//                          `continue` statements in script.js)
//   - followUp:            null | {kind:'split'|'triangle-burst'|'payload-blast', ...}
//                          payload the caller hands to spawnSplitOutputBullets,
//                          spawnTriangleBurst, or triggerPayloadBlast
//
// Effect-ordering invariant: 'eliteStageAdvanced' MUST come before its
// associated 'sparks' so caller mutates bullet.eliteColor before reading it.
// Tests pin this. The dispatcher itself does NOT call applyEliteStage —
// caller does, via ctx.applyEliteStage if provided OR via the legacy fn.
//
// resolveDangerBounceState / resolveOutputBounceState (in bulletRuntime.js)
// retain their existing bullet mutations (state, decayStart, bounceLeft,
// hasSplit, wallBounces, dangerBounceBudget, dangerContinueBounces, bounceCount). The dispatcher
// adds ONE new mutation it owns: phantom-rebound conversion of an output
// bullet to grey (state='grey', decayStart=ts) when the source bullet would
// otherwise be removed.

import {
  resolveDangerBounceState,
  resolveOutputBounceState,
} from '../systems/bulletRuntime.js';

/**
 * Dispatch a bullet wall-bounce.
 *
 * @param {object} bullet - bullet object (mutated by helpers + phantom path)
 * @param {number} ts - current sim time (ms); used for grey decayStart
 * @param {object} ctx
 * @param {boolean} [ctx.splitShot=false]
 * @param {boolean} [ctx.splitShotEvolved=false]
 * @param {boolean} [ctx.phantomRebound=false]
 * @param {number}  [ctx.bounceTier=0]
 * @param {object}  [ctx.colors] - optional palette overrides
 *                  { grey: string, ghost: string }
 *                  Default: { grey: '#9ca3af', ghost: '#e0e7ff' } — caller
 *                  should pass the live game palette so descriptors hold
 *                  the actual rendered color.
 * @returns {{
 *   effects: Array<object>,
 *   removeSourceBullet: boolean,
 *   skipRestOfFrame: boolean,
 *   followUp: null | object,
 * }}
 */
export function dispatchBulletBounce(bullet, ts, ctx = {}) {
  const colors = ctx.colors || {};
  const greyColor = colors.grey != null ? colors.grey : '#9ca3af';
  const ghostColor = colors.ghost != null ? colors.ghost : '#e0e7ff';

  const result = {
    effects: [],
    removeSourceBullet: false,
    skipRestOfFrame: false,
    followUp: null,
  };

  if (bullet.state === 'danger') {
    // Burst dissipate fires for ALL danger bounces (including
    // continue cases) — matches legacy ordering where it runs
    // before the kind switch.
    result.effects.push({ kind: 'burstBlueDissipate', x: bullet.x, y: bullet.y });

    const dangerBounce = resolveDangerBounceState(bullet, ts);

    if (dangerBounce.kind === 'elite-stage') {
      // Stage-advance descriptor MUST come before its sparks so caller
      // mutates eliteColor before sparks descriptor is consumed.
      result.effects.push({
        kind: 'eliteStageAdvanced',
        stage: dangerBounce.nextEliteStage,
      });
      // Color is read from bullet AFTER caller applies the stage advance —
      // we encode that by leaving color undefined and tagging source so
      // the effect translator pulls bullet.eliteColor at apply time.
      result.effects.push({
        kind: 'sparks',
        x: bullet.x,
        y: bullet.y,
        colorSource: 'eliteColor',
        count: 4,
        size: 40,
      });
    } else if (dangerBounce.kind === 'triangle-burst') {
      result.removeSourceBullet = true;
      result.skipRestOfFrame = true;
      result.followUp = {
        kind: 'triangle-burst',
        x: bullet.x,
        y: bullet.y,
        vx: bullet.vx,
        vy: bullet.vy,
      };
    } else if (dangerBounce.kind === 'convert-grey') {
      result.effects.push({
        kind: 'sparks',
        x: bullet.x,
        y: bullet.y,
        color: greyColor,
        count: 4,
        size: 35,
      });
    }
    // 'triangle-continue' / 'danger-bounce-continue' / 'double-bounce-continue': no extra effects
    // beyond the burstBlueDissipate already pushed. Keep bullet alive.
    return result;
  }

  if (bullet.state === 'output') {
    const outputBounce = resolveOutputBounceState(bullet, {
      splitShot: !!ctx.splitShot,
      splitShotEvolved: !!ctx.splitShotEvolved,
    });

    if (outputBounce.kind === 'split') {
      // Source bullet stays alive; spawn extra siblings via followUp.
      result.followUp = {
        kind: 'split',
        splitDeltas: outputBounce.splitDeltas,
        splitDamageFactor: outputBounce.splitDamageFactor,
        lifetimeMs: 2000,
      };
      return result;
    }

    if (outputBounce.kind === 'continue') {
      // Bounce budget consumed but no split — keep going, no extra effects.
      return result;
    }

    if (outputBounce.kind === 'remove') {
      if (ctx.phantomRebound && (ctx.bounceTier | 0) > 0) {
        // Convert output bullet to grey charge bullet instead of removing.
        // Dispatcher owns this mutation (the helpers don't know about
        // phantomRebound).
        bullet.state = 'grey';
        bullet.decayStart = ts;
        result.skipRestOfFrame = true;
        result.effects.push({
          kind: 'sparks',
          x: bullet.x,
          y: bullet.y,
          color: ghostColor,
          count: 6,
          size: 50,
        });
        return result;
      }
      result.removeSourceBullet = true;
      result.skipRestOfFrame = true;
      result.followUp = {
        kind: 'payload-blast',
        x: bullet.x,
        y: bullet.y,
        bullet, // caller still has the ref; carrying it explicitly so a
                // future commit-phase resolver doesn't need to look it up
      };
      return result;
    }
  }

  return result;
}

export default dispatchBulletBounce;
