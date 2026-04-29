import { getOrbitSlotPosition } from '../entities/defenseRuntime.js';
import { emit } from './effectQueue.js';

const ORBIT_ROTATION_SPD = 0.003;

export function resolveConduitArcs(state, opts = {}) {
  const slot = state?.slots?.[0];
  const upg = slot?.upg || {};
  const body = slot?.body;
  const bullets = state?.bullets;
  const enemies = state?.enemies;
  if (!upg.conduit || !body || !Array.isArray(bullets) || !Array.isArray(enemies)) return 0;
  const orbCount = upg.orbitSphereTier | 0;
  if (orbCount < 2) return 0;

  const cooldowns = slot?.orbState?.cooldowns || [];
  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  const radius = (opts.baseOrbitRadius ?? 22) + (upg.orbitRadiusBonus || 0);
  const points = [];
  for (let i = 0; i < orbCount; i++) {
    if ((cooldowns[i] || 0) > 0) continue;
    points.push(getOrbitSlotPosition({
      index: i,
      orbitSphereTier: orbCount,
      ts,
      rotationSpeed: opts.orbitRotationSpeed ?? ORBIT_ROTATION_SPD,
      radius,
      originX: body.x,
      originY: body.y,
    }));
  }
  if (points.length < 2) return 0;

  let hits = 0;
  for (let i = 0; i < points.length - 1; i++) {
    hits += applyConduitSegment(state, points[i], points[i + 1], upg, ts, opts);
  }
  if (points.length >= 3) {
    hits += applyConduitSegment(state, points[points.length - 1], points[0], upg, ts, opts);
  }
  if (hits > 0) {
    emitEffect(state, opts, 'conduit.arcPulse', {
      points: points.map((p) => ({ x: p.x, y: p.y })),
    });
  }
  return hits;
}

function applyConduitSegment(state, a, b, upg, ts, opts) {
  let hits = 0;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    if (!enemy || enemy.hp <= 0) continue;
    if (pointToSegmentDistance(enemy.x, enemy.y, a.x, a.y, b.x, b.y) > (enemy.r || 0) + 6) continue;
    const lastHit = enemy.lastConduitHit ?? -Infinity;
    if (ts - lastHit < (upg.conduitArcTickMs || 120)) continue;
    enemy.lastConduitHit = ts;
    enemy.hp -= upg.conduitArcDmg || 0;
    hits++;
    if (enemy.hp <= 0) {
      state.enemies.splice(i, 1);
    }
  }
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    if (!bullet || bullet.state !== 'danger') continue;
    if (pointToSegmentDistance(bullet.x, bullet.y, a.x, a.y, b.x, b.y) > (bullet.r || 0) + 6) continue;
    const lastHit = bullet.lastConduitHit ?? -Infinity;
    if (ts - lastHit < (upg.conduitArcTickMs || 120)) continue;
    bullet.lastConduitHit = ts;
    state.bullets.splice(i, 1);
    hits++;
  }
  return hits;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function emitEffect(state, opts, kind, payload) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue)) return;
  emit(state, kind, payload);
}
