// R0.4 step 6 — bulletBounceDispatch tests.
//
// Covers the 7 outcomes carved out from script.js:5970-6011:
//   danger:elite-stage, danger:triangle-burst, danger:convert-grey,
//   danger:triangle-continue, danger:double-bounce-continue,
//   output:split, output:continue, output:remove (payload-blast),
//   output:remove + phantom-rebound (convert-grey).
//
// Pinned invariants (from rubber-duck pre-implementation review):
//   - split does NOT remove the source bullet
//   - phantom-rebound mutates bullet.state='grey' + decayStart=ts
//     and emits ghost sparks; caller skips rest of frame
//   - 'eliteStageAdvanced' descriptor precedes its 'sparks' descriptor
//   - burstBlueDissipate fires for ALL danger bounces, including
//     triangle-continue and double-bounce-continue
//   - splitSpec carries lifetimeMs: 2000 (was inline in script.js as
//     simNowMs+2000)

import assert from 'assert';
import { dispatchBulletBounce } from '../src/sim/bulletBounceDispatch.js';

let pass = 0;
let fail = 0;
function ok(label, cond) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
  }
}

function makeDangerBullet(extra = {}) {
  return { state: 'danger', x: 100, y: 100, vx: 50, vy: 30, r: 4, ...extra };
}
function makeOutputBullet(extra = {}) {
  return { state: 'output', x: 200, y: 150, vx: 60, vy: -20, r: 4, dmg: 10, ...extra };
}

console.log('\n=== bulletBounceDispatch tests ===\n');

// --- DANGER: convert-grey (default branch, no special flags) ---
{
  const b = makeDangerBullet();
  const r = dispatchBulletBounce(b, 1234, {});
  ok('convert-grey: state mutated to grey', b.state === 'grey');
  ok('convert-grey: decayStart set to ts', b.decayStart === 1234);
  ok('convert-grey: bullet kept', r.removeSourceBullet === false);
  ok('convert-grey: no skip', r.skipRestOfFrame === false);
  ok('convert-grey: no followUp', r.followUp === null);
  ok('convert-grey: 2 effects (burstBlueDissipate + sparks)', r.effects.length === 2);
  ok('convert-grey: first effect is burstBlueDissipate', r.effects[0].kind === 'burstBlueDissipate');
  ok('convert-grey: second effect is sparks', r.effects[1].kind === 'sparks');
}

// --- DANGER: elite-stage ---
{
  const b = makeDangerBullet({ eliteStage: 0, bounceStages: 2 });
  const r = dispatchBulletBounce(b, 5000, {});
  ok('elite-stage: bullet kept', r.removeSourceBullet === false);
  ok('elite-stage: 3 effects (burst + stage + sparks)', r.effects.length === 3);
  ok('elite-stage: order = burst, stage, sparks',
    r.effects[0].kind === 'burstBlueDissipate' &&
    r.effects[1].kind === 'eliteStageAdvanced' &&
    r.effects[2].kind === 'sparks');
  ok('elite-stage: stage advance descriptor BEFORE sparks (color invariant)',
    r.effects.findIndex(e => e.kind === 'eliteStageAdvanced')
    < r.effects.findIndex(e => e.kind === 'sparks'));
  ok('elite-stage: nextEliteStage = 1', r.effects[1].stage === 1);
  ok('elite-stage: sparks colorSource=eliteColor (not resolved)',
    r.effects[2].colorSource === 'eliteColor' && r.effects[2].color === undefined);
}

// --- DANGER: triangle-burst (terminal) ---
{
  const b = makeDangerBullet({ isTriangle: true, wallBounces: 0, vx: 70, vy: -40 });
  const r = dispatchBulletBounce(b, 100, {});
  ok('triangle-burst: removeSourceBullet=true', r.removeSourceBullet === true);
  ok('triangle-burst: skipRestOfFrame=true', r.skipRestOfFrame === true);
  ok('triangle-burst: followUp kind', r.followUp && r.followUp.kind === 'triangle-burst');
  ok('triangle-burst: followUp carries vx/vy',
    r.followUp.vx === 70 && r.followUp.vy === -40);
  ok('triangle-burst: only burst effect (no sparks for terminal)',
    r.effects.length === 1 && r.effects[0].kind === 'burstBlueDissipate');
}

// --- DANGER: triangle-continue (1st bounce, wallBounces was -1 so → 0, < 1 so continue) ---
{
  // resolveDangerBounceState says: if isTriangle, increment wallBounces;
  // if >= 1 burst, else continue. We need wallBounces to be -1 going in
  // so post-increment is 0 → continue branch.
  const b = makeDangerBullet({ isTriangle: true, wallBounces: -1 });
  const r = dispatchBulletBounce(b, 100, {});
  ok('triangle-continue: bullet kept', r.removeSourceBullet === false);
  ok('triangle-continue: skip false', r.skipRestOfFrame === false);
  ok('triangle-continue: burstBlueDissipate STILL fires',
    r.effects.length === 1 && r.effects[0].kind === 'burstBlueDissipate');
  ok('triangle-continue: state stays danger', b.state === 'danger');
}

// --- DANGER: double-bounce-continue (1st bounce of doubleBounce) ---
{
  const b = makeDangerBullet({ doubleBounce: true, bounceCount: 0 });
  const r = dispatchBulletBounce(b, 100, {});
  ok('double-bounce-continue: bullet stays danger', b.state === 'danger');
  ok('double-bounce-continue: bounceCount=1', b.bounceCount === 1);
  ok('double-bounce-continue: burstBlueDissipate STILL fires',
    r.effects.length === 1 && r.effects[0].kind === 'burstBlueDissipate');
  ok('double-bounce-continue: no remove, no skip',
    !r.removeSourceBullet && !r.skipRestOfFrame);
}

// --- DANGER: dangerBounceBudget convert-grey ---
{
  const b = makeDangerBullet({ dangerBounceBudget: 1 });
  const r = dispatchBulletBounce(b, 999, {});
  ok('dangerBounceBudget: budget decremented', b.dangerBounceBudget === 0);
  ok('dangerBounceBudget: state=grey', b.state === 'grey');
  ok('dangerBounceBudget: decayStart=ts', b.decayStart === 999);
  ok('dangerBounceBudget: 2 effects (burst + grey sparks)',
    r.effects.length === 2 && r.effects[1].color === '#9ca3af');
}

// --- OUTPUT: continue (bounceLeft consumed, no split) ---
{
  const b = makeOutputBullet({ bounceLeft: 2 });
  const r = dispatchBulletBounce(b, 100, {});
  ok('output:continue: bounceLeft decremented', b.bounceLeft === 1);
  ok('output:continue: bullet kept', !r.removeSourceBullet);
  ok('output:continue: no skip', !r.skipRestOfFrame);
  ok('output:continue: no effects', r.effects.length === 0);
  ok('output:continue: no followUp', r.followUp === null);
}

// --- OUTPUT: split (splitShot enabled, first bounce) ---
{
  const b = makeOutputBullet({ bounceLeft: 1, hasSplit: false });
  const r = dispatchBulletBounce(b, 100, { splitShot: true });
  ok('split: bullet KEPT (not removed) — pinned invariant', !r.removeSourceBullet);
  ok('split: no skip', !r.skipRestOfFrame);
  ok('split: hasSplit flag set on source', b.hasSplit === true);
  ok('split: followUp kind', r.followUp && r.followUp.kind === 'split');
  ok('split: deltas for non-evolved',
    JSON.stringify(r.followUp.splitDeltas) === JSON.stringify([-0.35, 0.35]));
  ok('split: damageFactor 0.8 non-evolved', r.followUp.splitDamageFactor === 0.8);
  ok('split: lifetimeMs 2000 carried in spec — pinned invariant',
    r.followUp.lifetimeMs === 2000);
}

// --- OUTPUT: split evolved ---
{
  const b = makeOutputBullet({ bounceLeft: 1, hasSplit: false });
  const r = dispatchBulletBounce(b, 100, { splitShot: true, splitShotEvolved: true });
  ok('split-evolved: 3 deltas',
    r.followUp.splitDeltas.length === 3 &&
    r.followUp.splitDeltas[1] === 0);
  ok('split-evolved: damageFactor 0.85', r.followUp.splitDamageFactor === 0.85);
}

// --- OUTPUT: remove (no phantomRebound) → payload-blast ---
{
  const b = makeOutputBullet({ bounceLeft: 0, hasPayload: true });
  const r = dispatchBulletBounce(b, 100, {});
  ok('payload-blast: removeSourceBullet=true', r.removeSourceBullet === true);
  ok('payload-blast: skipRestOfFrame=true', r.skipRestOfFrame === true);
  ok('payload-blast: followUp kind', r.followUp && r.followUp.kind === 'payload-blast');
  ok('payload-blast: followUp.x/y captured', r.followUp.x === 200 && r.followUp.y === 150);
  ok('payload-blast: bullet ref carried in followUp', r.followUp.bullet === b);
  ok('payload-blast: no effects emitted (legacy did none beyond payload)',
    r.effects.length === 0);
}

// --- OUTPUT: remove + phantomRebound ---
{
  const b = makeOutputBullet({ bounceLeft: 0 });
  const r = dispatchBulletBounce(b, 7777, { phantomRebound: true, bounceTier: 1 });
  ok('phantom: bullet KEPT (not removed) — pinned invariant', !r.removeSourceBullet);
  ok('phantom: skipRestOfFrame=true', r.skipRestOfFrame === true);
  ok('phantom: state=grey — pinned invariant', b.state === 'grey');
  ok('phantom: decayStart=ts — pinned invariant', b.decayStart === 7777);
  ok('phantom: 1 effect (ghost sparks)',
    r.effects.length === 1 && r.effects[0].kind === 'sparks');
  ok('phantom: ghost color', r.effects[0].color === '#e0e7ff');
  ok('phantom: count=6, size=50', r.effects[0].count === 6 && r.effects[0].size === 50);
  ok('phantom: no followUp', r.followUp === null);
}

// --- OUTPUT: remove + phantomRebound but bounceTier=0 → fallback to payload-blast ---
{
  const b = makeOutputBullet({ bounceLeft: 0 });
  const r = dispatchBulletBounce(b, 100, { phantomRebound: true, bounceTier: 0 });
  ok('phantom-no-tier: falls back to payload-blast',
    r.removeSourceBullet === true && r.followUp.kind === 'payload-blast');
  ok('phantom-no-tier: bullet NOT mutated to grey', b.state === 'output');
}

// --- Custom palette colors round-trip ---
{
  const b = makeDangerBullet();
  const r = dispatchBulletBounce(b, 0, { colors: { grey: '#abcdef', ghost: '#fedcba' } });
  ok('custom colors: grey color used in convert-grey sparks',
    r.effects[1].color === '#abcdef');
}

// --- Determinism: same input → byte-identical result twice ---
{
  const b1 = makeDangerBullet({ isTriangle: true, wallBounces: -1 });
  const b2 = makeDangerBullet({ isTriangle: true, wallBounces: -1 });
  const r1 = dispatchBulletBounce(b1, 100, {});
  const r2 = dispatchBulletBounce(b2, 100, {});
  ok('determinism: identical inputs → identical results',
    JSON.stringify(r1) === JSON.stringify(r2));
}

console.log(`\nbulletBounceDispatch tests: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
