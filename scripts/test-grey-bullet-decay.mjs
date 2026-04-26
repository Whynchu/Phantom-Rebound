// Unit tests for tickGreyBulletDecay (R0.4 step 4e).
import { tickGreyBulletDecay } from '../src/systems/bulletRuntime.js';

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ok ', label); }
  else { fail++; console.log('  FAIL', label); }
}
function approx(a, b, eps = 1e-9) { return Math.abs(a - b) <= eps; }

const mkB = (overrides = {}) => ({ state: 'grey', vx: 100, vy: 200, decayStart: 1000, ...overrides });

// 1. null / wrong state -> skipped
ok('null bullet skipped', tickGreyBulletDecay(null, 2000, 0.016, { decayMS: 5000 }).skipped === true);
ok('non-grey bullet skipped', tickGreyBulletDecay(mkB({ state: 'output' }), 2000, 0.016, { decayMS: 5000 }).skipped === true);
ok('non-grey bullet velocity unchanged', (() => {
  const b = mkB({ state: 'danger' });
  tickGreyBulletDecay(b, 2000, 0.016, { decayMS: 5000 });
  return b.vx === 100 && b.vy === 200;
})());

// 2. expired
{
  const b = mkB({ decayStart: 1000 });
  const result = tickGreyBulletDecay(b, 7000, 0.016, { decayMS: 5000 });
  ok('expired returns true', result.expired === true && result.skipped === false);
  // Velocity should NOT be decayed when expired
  ok('expired does not decay velocity', b.vx === 100 && b.vy === 200);
}

// 3. exactly at expiry threshold (>, strict)
{
  const b = mkB({ decayStart: 1000 });
  const result = tickGreyBulletDecay(b, 6000, 0.016, { decayMS: 5000 });
  ok('exactly at decayMS not yet expired', result.expired === false);
}

// 4. just past expiry threshold
{
  const b = mkB({ decayStart: 1000 });
  const result = tickGreyBulletDecay(b, 6001, 0.016, { decayMS: 5000 });
  ok('just past decayMS is expired', result.expired === true);
}

// 5. velocity decay math: factor = 0.97^(dt*60) with dt=1/60 => 0.97
{
  const b = mkB({ vx: 100, vy: 200, decayStart: 1000 });
  tickGreyBulletDecay(b, 2000, 1 / 60, { decayMS: 5000 });
  ok('vx decayed by ~0.97', approx(b.vx, 100 * 0.97));
  ok('vy decayed by ~0.97', approx(b.vy, 200 * 0.97));
}

// 6. dt=0 leaves velocity unchanged (0.97^0 = 1)
{
  const b = mkB({ vx: 100, vy: 200 });
  tickGreyBulletDecay(b, 2000, 0, { decayMS: 5000 });
  ok('dt=0 no decay', b.vx === 100 && b.vy === 200);
}

// 7. larger dt produces stronger decay (0.97^(2*60*1/60) = 0.97^2)
{
  const b = mkB({ vx: 100 });
  tickGreyBulletDecay(b, 2000, 2 / 60, { decayMS: 5000 });
  ok('dt=2/60 decays by 0.97^2', approx(b.vx, 100 * 0.97 * 0.97));
}

// 8. decayMS missing defaults to 0 => everything expires immediately
{
  const b = mkB({ decayStart: 1000 });
  const result = tickGreyBulletDecay(b, 1001, 0.016, {});
  ok('default decayMS=0 expires immediately', result.expired === true);
}

// 9. null opts tolerated, default decayMS=0
{
  const b = mkB({ decayStart: 1000 });
  const result = tickGreyBulletDecay(b, 1001, 0.016, null);
  ok('null opts tolerated', result.expired === true);
}

// 10. determinism: same inputs => same output
{
  const b1 = mkB({ vx: 137.5, vy: -42.25 });
  const b2 = mkB({ vx: 137.5, vy: -42.25 });
  for (let i = 0; i < 60; i++) {
    tickGreyBulletDecay(b1, 2000, 1 / 60, { decayMS: 5000 });
    tickGreyBulletDecay(b2, 2000, 1 / 60, { decayMS: 5000 });
  }
  ok('60-tick determinism', b1.vx === b2.vx && b1.vy === b2.vy);
}

// 11. velocity asymptotes toward zero
{
  const b = mkB({ vx: 100, vy: 100 });
  for (let i = 0; i < 600; i++) tickGreyBulletDecay(b, 2000, 1 / 60, { decayMS: 60000 });
  // 0.97^600 is vanishingly small
  ok('velocity decays toward zero over many ticks', Math.abs(b.vx) < 0.001 && Math.abs(b.vy) < 0.001);
}

// 12. negative velocity decays toward zero (preserves sign)
{
  const b = mkB({ vx: -100, vy: -200, decayStart: 1000 });
  tickGreyBulletDecay(b, 2000, 1 / 60, { decayMS: 5000 });
  ok('negative vx scaled', b.vx < 0 && b.vx > -100);
  ok('negative vy scaled', b.vy < 0 && b.vy > -200);
}

// 13. zero velocity stays zero
{
  const b = mkB({ vx: 0, vy: 0 });
  tickGreyBulletDecay(b, 2000, 1 / 60, { decayMS: 5000 });
  ok('zero velocity remains zero', b.vx === 0 && b.vy === 0);
}

// 14. expired wins over decay (no decay applied when expired)
{
  const b = mkB({ vx: 100, vy: 200, decayStart: 1000 });
  const result = tickGreyBulletDecay(b, 9999, 1 / 60, { decayMS: 5000 });
  ok('expired result returned', result.expired === true);
  ok('expired path skips decay (vx unchanged)', b.vx === 100 && b.vy === 200);
}

// 15. result shape stable
{
  const r = tickGreyBulletDecay(mkB(), 2000, 1 / 60, { decayMS: 5000 });
  ok('result has expired and skipped booleans', typeof r.expired === 'boolean' && typeof r.skipped === 'boolean');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
