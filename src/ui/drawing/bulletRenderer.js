// Phantom Rebound — Bullet/projectile renderer
// Pure rendering helpers for bullet sprites. Takes ctx explicitly and all
// external deps via options — no reads from the game module scope. Leaves
// canvas state as found (save/restore balanced).

import { C, DECAY_BASE } from '../../data/gameData.js';

// ── Bounce ring math (pure) ──────────────────────────────────────────────────
export function getDangerBounceRingCount(bullet) {
  if (!bullet || bullet.state !== 'danger') return 0;
  if (bullet.eliteStage !== undefined) {
    return Math.max(0, 2 - (bullet.eliteStage || 0));
  }
  if (bullet.doubleBounce) {
    return Math.max(0, 1 - (bullet.bounceCount || 0));
  }
  if ((bullet.dangerBounceBudget || 0) > 0) {
    return bullet.dangerBounceBudget;
  }
  return 0;
}

export function getEnemyBounceRingCount(enemy) {
  if (!enemy) return 0;
  if (enemy.isElite || enemy.type === 'orange_zoner') return 2;
  if (enemy.forcePurpleShots || enemy.doubleBounce) return 1;
  if (enemy.dangerBounceBudget > 0) return enemy.dangerBounceBudget;
  return 0;
}

export function getBounceRingMetrics(totalRadius, count) {
  const lineWidth = Math.max(1.2, totalRadius * 0.16);
  const gap = Math.max(1.15, totalRadius * 0.13);
  const outerRadius = Math.max(0, totalRadius - lineWidth * 0.5);
  if (count <= 0) {
    return { lineWidth, gap, outerRadius, bodyRadius: totalRadius };
  }
  const ringDepth = count * lineWidth + count * gap;
  const bodyRadius = Math.max(totalRadius * 0.24, outerRadius - ringDepth);
  return { lineWidth, gap, outerRadius, bodyRadius };
}

// ── Rendering ────────────────────────────────────────────────────────────────
export function drawBounceRings(ctx, x, y, totalRadius, count, color, alpha = 0.92) {
  const metrics = getBounceRingMetrics(totalRadius, count);
  if (count <= 0) return metrics.bodyRadius;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = metrics.lineWidth;
  ctx.shadowBlur = 0;
  let ringRadius = metrics.outerRadius;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ringRadius -= metrics.lineWidth + metrics.gap;
  }
  ctx.restore();
  return metrics.bodyRadius;
}

export function drawGooBall(ctx, x, y, radius, fillColor, coreColor, wobbleSeed, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i;
    const wobble = 0.86 + 0.22 * Math.sin(wobbleSeed + i * 1.37);
    const px = x + Math.cos(angle) * radius * wobble;
    const py = y + Math.sin(angle) * radius * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(
    x + Math.sin(wobbleSeed) * radius * 0.08,
    y + Math.cos(wobbleSeed * 1.2) * radius * 0.08,
    radius * 0.42,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

// Draws a single bullet sprite based on state (danger / grey / output).
// `deps` carries engine state that would otherwise reach back into the game
// module: decay progress and the current double-bounce palette.
export function drawBulletSprite(ctx, b, ts, deps) {
  const { decayBonus, doubleBouncePalette } = deps;

  if (b.state === 'danger') {
    const pulse = .75 + .25 * Math.sin(ts * .014);
    let bCol, bCore;
    if (b.eliteColor) {
      bCol = b.eliteColor;
      bCore = b.eliteCore || C.dangerCore;
    } else if (b.isTriangle) {
      bCol = C.danger;
      bCore = C.dangerCore;
    } else {
      bCol = b.doubleBounce && b.bounceCount === 0 ? doubleBouncePalette.fill : C.danger;
      bCore = b.doubleBounce && b.bounceCount === 0 ? doubleBouncePalette.core : C.dangerCore;
    }
    ctx.globalAlpha = 0.88;
    ctx.shadowColor = bCol;
    ctx.shadowBlur = 20 * pulse;
    ctx.fillStyle = bCol;
    if (b.isTriangle) {
      const angle = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(b.r, 0);
      ctx.lineTo(-b.r * .6, b.r * .6);
      ctx.lineTo(-b.r * .6, -b.r * .6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const ringCount = getDangerBounceRingCount(b);
      const bodyRadius = drawBounceRings(ctx, b.x, b.y, b.r, ringCount, bCol, 0.94);
      ctx.beginPath(); ctx.arc(b.x, b.y, bodyRadius, 0, Math.PI * 2); ctx.fill();
      drawBounceRings(ctx, b.x, b.y, b.r, ringCount, bCol, 0.98);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = bCore;
    if (!b.isTriangle) {
      const coreRadius = Math.max(1.5, b.r * (getDangerBounceRingCount(b) > 0 ? 0.2 : 0.42));
      ctx.beginPath(); ctx.arc(b.x, b.y, coreRadius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

  } else if (b.state === 'grey') {
    const age = (ts - b.decayStart) / (DECAY_BASE + decayBonus);
    ctx.globalAlpha = Math.max(.12, 0.86 - age * .7);
    ctx.shadowColor = C.grey;
    ctx.shadowBlur = 3;
    ctx.strokeStyle = C.grey;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

  } else if (b.state === 'output') {
    // D18.10b — coop bullet color attribution. Default to local C.green
    // palette (byte-identical solo/host path). When deps.getOwnerColorScheme
    // returns a non-null { hex, light } for this bullet's ownerId, use it
    // so the partner's bullets render in the partner's chosen color
    // instead of the local player's color.
    const ownerScheme = (typeof deps.getOwnerColorScheme === 'function')
      ? deps.getOwnerColorScheme(b)
      : null;
    const greenHex = ownerScheme ? ownerScheme.hex : C.green;
    const ghostHex = ownerScheme ? ownerScheme.light : C.ghost;
    const col = b.crit ? ghostHex : greenHex;
    ctx.shadowColor = col;
    ctx.shadowBlur = b.crit ? 28 : 18;
    drawGooBall(
      ctx,
      b.x,
      b.y,
      b.r,
      b.crit ? C.getRgba(ghostHex, 0.82) : C.getRgba(greenHex, 0.72),
      b.crit ? 'rgba(255,255,255,0.94)' : C.getRgba(ghostHex, 0.84),
      ts * 0.013 + b.x * 0.09 + b.y * 0.07,
      0.92,
    );
    ctx.shadowBlur = 0;
  }
  ctx.shadowBlur = 0;
}
