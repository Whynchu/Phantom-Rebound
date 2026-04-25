// Phantom Rebound — Ghost sprite renderer
// Draws the player's ghost (body, eyes, hat, charge ring, HP bar).
// Pure rendering: all state passed in as options; no reads from the game
// module scope. Leaves canvas state as found (save/restore balanced).

import { C } from '../../data/gameData.js';
import { drawGhostHatLayer } from './hatRenderer.js';
import { getHatHeightMultiplier } from '../../data/hats.js';
import { BASE_PLAYER_HP, GAME_OVER_ANIM_MS } from '../../data/constants.js';

export function drawGhostSprite(ctx, ts, {
  playerState,
  chargeValue,
  maxChargeValue,
  fireProgress,
  gameState,
  hpValue,
  maxHpValue,
  hatKey,
  basePlayerHp = BASE_PLAYER_HP,
  idleStill = false,
  // D18.7 — optional per-instance color override. When present, all reads
  // that previously hit the global C palette (player/ghost colors) use
  // this scheme instead. Solo / local-player paths leave this undefined →
  // C.green/C.ghost behavior unchanged → byte-identical canary.
  // Shape: { hex, light, dark } from PLAYER_COLORS.
  colorScheme = null,
} = {}) {
  const p = playerState;
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  // Resolve effective player-color reads. For null colorScheme we point at
  // the live C getters so a runtime palette swap (player picked a new color
  // from the start menu) keeps animating. For an override we precompute
  // hex/rgb once per draw call.
  const _hex2rgb = (hex) => ({ r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) });
  const _mixHex = (baseHex, tintHex, amount) => {
    const a = _hex2rgb(baseHex), b = _hex2rgb(tintHex);
    const mix = (from, to) => Math.round(from + (to - from) * amount).toString(16).padStart(2, '0');
    return `#${mix(a.r,b.r)}${mix(a.g,b.g)}${mix(a.b,b.b)}`;
  };
  const greenHex = colorScheme ? colorScheme.hex : C.green;
  const ghostHex = colorScheme ? colorScheme.light : C.ghost;
  const greenRgb = colorScheme ? _hex2rgb(greenHex) : C.greenRgb;
  const ghostRgb = colorScheme ? _hex2rgb(ghostHex) : C.ghostRgb;
  // ghostBody is `_mixHex('#f7fbff', green, 0.18)` in C; mirror it here when overriding.
  const ghostBodyHex = colorScheme ? _mixHex('#f7fbff', greenHex, 0.18) : C.ghostBody;
  const ghostBodyRgb = colorScheme ? _hex2rgb(ghostBodyHex) : C.ghostBodyRgb;
  const greenRgba = (alpha) => `rgba(${greenRgb.r},${greenRgb.g},${greenRgb.b},${alpha})`;
  const t = ts / 1000;
  const chargeFrac = Math.min(1, chargeValue / Math.max(1, maxChargeValue || 10));
  const fireFrac = chargeValue >= 1 ? Math.max(0, Math.min(1, fireProgress || 0)) : 0;
  const overload = chargeFrac >= 0.95;
  const overloadPulse = overload ? Math.sin(t * 12) * 0.3 + 0.7 : 1;
  const lean = idleStill ? 0 : Math.max(-.3, Math.min(.3, p.vx / 300));
  const wobble = idleStill ? 0 : Math.sin(t * 3) * 2;
  const deathFrac = gameState === 'dying' ? Math.max(0, Math.min(1, (ts - p.deadAt) / GAME_OVER_ANIM_MS)) : 0;
  const popFrac = gameState === 'dying' ? Math.max(0, Math.min(1, (ts - p.popAt) / (GAME_OVER_ANIM_MS * 0.28))) : 0;
  const size = p.r * 1.18 + chargeFrac * 3.9 - deathFrac * 1.2;

  ctx.save();
  if ((p.distort || 0) > 0 || gameState === 'dying') {
    ctx.translate(p.x, p.y + wobble);
    const deathScale = gameState === 'dying' ? 1 + deathFrac * 0.22 - popFrac * 1.1 : 1;
    ctx.scale((1 + .12 * Math.sin(ts * .06)) * deathScale, (1 + .12 * Math.cos(ts * .07)) * deathScale);
    ctx.rotate(lean);
  } else {
    ctx.translate(p.x, p.y + wobble);
    ctx.rotate(lean);
  }

  const pulse = .55 + .45 * Math.sin(ts * .0025);
  const gRgb = ghostRgb;
  const ga = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
  ga.addColorStop(0, gameState === 'dying'
    ? `rgba(248,180,199,${0.14 + deathFrac * 0.16})`
    : overload
      ? `rgba(${gRgb.r},${gRgb.g},${gRgb.b},${0.20 + 0.08 * pulse})`
      : `rgba(${gRgb.r},${gRgb.g},${gRgb.b},${0.18 * pulse})`);
  ga.addColorStop(1, `rgba(${gRgb.r},${gRgb.g},${gRgb.b},0)`);
  ctx.fillStyle = ga;
  ctx.beginPath(); ctx.arc(0, 0, size * 3, 0, Math.PI * 2); ctx.fill();

  ctx.shadowBlur = 22 + chargeFrac * 14;
  ctx.shadowColor = gameState === 'dying' ? '#f8b4c7' : ghostHex;

  const inv = (p.invincible || 0) > 0 ? Math.min(1, (p.invincible || 0) / .4) : 0;
  const baseRgb = ghostBodyRgb;
  const accentRgb = greenRgb;
  let bodyR, bodyG, bodyB;
  if (gameState === 'dying') {
    bodyR = 208;
    bodyG = 244 - Math.round(deathFrac * 36);
    bodyB = 224 + Math.round(deathFrac * 12);
  } else if (overload) {
    const tintMix = Math.min(0.55, 0.34 + overloadPulse * 0.18);
    bodyR = Math.round(baseRgb.r + (accentRgb.r - baseRgb.r) * tintMix);
    bodyG = Math.round(baseRgb.g + (accentRgb.g - baseRgb.g) * tintMix);
    bodyB = Math.round(baseRgb.b + (accentRgb.b - baseRgb.b) * tintMix);
  } else {
    bodyR = Math.round(Math.min(255, baseRgb.r + inv * 26));
    bodyG = Math.round(Math.min(255, baseRgb.g + inv * 12));
    bodyB = Math.round(Math.min(255, baseRgb.b + inv * 22));
  }
  const bodyColor = `rgba(${bodyR},${bodyG},${bodyB},0.93)`;
  ctx.fillStyle = bodyColor;

  ctx.beginPath();
  ctx.arc(0, -size * .2, size, Math.PI, 0);
  const tailW = size;
  const segs = 4;
  for (let s = 0; s <= segs; s++) {
    const xOff = tailW - (s / segs) * tailW * 2;
    const yOff = size * .8 + Math.sin(t * 3 + s) * 2;
    if (s === 0) ctx.lineTo(tailW, yOff);
    else ctx.lineTo(xOff, yOff);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  drawGhostHatLayer(ctx, hatKey, size, bodyColor, ts);

  ctx.fillStyle = '#080f0a';
  ctx.beginPath(); ctx.arc(-5.5, -size * .25 - 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5.5, -size * .25 - 2, 3, 0, Math.PI * 2); ctx.fill();
  if (gameState === 'dying') {
    ctx.strokeStyle = 'rgba(12,20,16,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-5.5, -size * .25 - 2, 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(5.5, -size * .25 - 2, 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, size * .08, 4.6, Math.PI + .25, Math.PI * 2 - .25); ctx.stroke();
  } else {
    ctx.fillStyle = greenRgba(0.9);
    ctx.beginPath(); ctx.arc(-4.5, -size * .3 - 2, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4.5, -size * .3 - 2, 1.3, 0, Math.PI * 2); ctx.fill();
  }

  if (chargeFrac > 0.3 && gameState !== 'dying') {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -size * .15, 4.5, .65, Math.PI - .65); ctx.stroke();
  }

  const ringRadius = size + 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  if (chargeValue >= 1) {
    ctx.strokeStyle = greenHex;
    ctx.shadowColor = greenHex;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fireFrac);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const hpBarScale = Math.max(0.75, Math.min(2.4, Math.pow(Math.max(1, maxHpValue) / basePlayerHp, 0.35)));
  const barW = size * 2.8 * hpBarScale;
  const barH = 4;
  const barY = -size * (1.55 + getHatHeightMultiplier(hatKey));
  const barX = -barW / 2;
  const hpFrac = Math.max(0, hpValue / Math.max(1, maxHpValue));
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 2); ctx.fill();
  const hpCol = hpFrac > 0.5 ? greenHex : hpFrac > 0.25 ? '#fbbf24' : '#f87171';
  ctx.shadowBlur = 6; ctx.shadowColor = hpCol;
  ctx.fillStyle = hpCol;
  ctx.beginPath(); ctx.roundRect(barX, barY, barW * hpFrac, barH, 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}
