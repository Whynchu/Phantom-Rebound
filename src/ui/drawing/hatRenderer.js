// Phantom Rebound — Hat rendering (canvas layer above the ghost body)
// Pure presentation: each renderer takes (ctx, size, bodyColor, ts) and must
// leave the canvas state as it found it. Registered by hat key.

function drawBunny(ctxRef, size, bodyColor /* , ts */) {
  const earH = size * 1.6;
  const earW = size * 0.35;
  const earBase = -size * 1.1;
  ctxRef.save();

  ctxRef.save();
  ctxRef.translate(-size * 0.3, earBase);
  ctxRef.rotate(-0.15);
  ctxRef.fillStyle = bodyColor;
  ctxRef.beginPath();
  ctxRef.ellipse(0, -earH * 0.5, earW, earH * 0.5, 0, 0, Math.PI * 2);
  ctxRef.fill();
  ctxRef.strokeStyle = 'rgba(56,48,56,0.55)';
  ctxRef.lineWidth = Math.max(1.2, size * 0.08);
  ctxRef.stroke();
  ctxRef.fillStyle = 'rgba(255,180,200,0.55)';
  ctxRef.beginPath();
  ctxRef.ellipse(0, -earH * 0.5, earW * 0.5, earH * 0.38, 0, 0, Math.PI * 2);
  ctxRef.fill();
  ctxRef.restore();

  ctxRef.save();
  ctxRef.translate(size * 0.3, earBase);
  ctxRef.rotate(0.9);
  ctxRef.fillStyle = bodyColor;
  ctxRef.beginPath();
  ctxRef.ellipse(0, -earH * 0.4, earW * 0.9, earH * 0.42, 0, 0, Math.PI * 2);
  ctxRef.fill();
  ctxRef.strokeStyle = 'rgba(56,48,56,0.55)';
  ctxRef.lineWidth = Math.max(1.2, size * 0.08);
  ctxRef.stroke();
  ctxRef.fillStyle = 'rgba(255,180,200,0.55)';
  ctxRef.beginPath();
  ctxRef.ellipse(0, -earH * 0.4, earW * 0.45, earH * 0.3, 0, 0, Math.PI * 2);
  ctxRef.fill();
  ctxRef.restore();

  ctxRef.restore();
}

function drawCat(ctxRef, size, bodyColor /* , ts */) {
  const earH  = size * 0.60;
  const yBase = -size * 1.17;

  const drawCatEar = (dir) => {
    const innerX = dir * size * 0.08;
    const innerY = yBase;
    const outerX = dir * size * 0.82;
    const outerY = yBase + size * 0.06;
    const tipX   = dir * size * 0.88;
    const tipY   = yBase - earH;

    ctxRef.save();

    ctxRef.beginPath();
    ctxRef.moveTo(innerX, innerY);
    ctxRef.lineTo(tipX, tipY);
    ctxRef.quadraticCurveTo(
      outerX + dir * size * 0.10, outerY - earH * 0.48,
      outerX, outerY
    );
    ctxRef.closePath();
    ctxRef.fillStyle = bodyColor;
    ctxRef.fill();
    ctxRef.strokeStyle = 'rgba(40,34,40,0.55)';
    ctxRef.lineWidth = Math.max(1.2, size * 0.07);
    ctxRef.stroke();

    const iInnerX = innerX + dir * size * 0.10;
    const iInnerY = innerY - earH * 0.12;
    const iOuterX = outerX - dir * size * 0.12;
    const iOuterY = outerY - earH * 0.12;
    const iTipX   = tipX - dir * size * 0.08;
    const iTipY   = tipY + earH * 0.26;
    ctxRef.beginPath();
    ctxRef.moveTo(iInnerX, iInnerY);
    ctxRef.lineTo(iTipX, iTipY);
    ctxRef.lineTo(iOuterX, iOuterY);
    ctxRef.closePath();
    ctxRef.fillStyle = 'rgba(255,170,195,0.65)';
    ctxRef.fill();

    ctxRef.restore();
  };

  ctxRef.save();
  drawCatEar(-1);
  drawCatEar(1);
  ctxRef.restore();
}

function drawViking(ctxRef, size, _bodyColor, ts) {
  const bob = Math.sin(ts * 0.0028) * size * 0.04;
  ctxRef.save();
  ctxRef.translate(0, -size * 0.92 + bob);
  const helmW = size * 1.52;
  const helmH = size * 0.8;
  const lw = Math.max(1, size * 0.04);

  const drawHorn = (dir) => {
    ctxRef.save();
    const bx1 = dir * helmW * 0.34;
    const by1 = helmH * 0.15;
    const bx2 = dir * helmW * 0.58;
    const by2 = -helmH * 0.15;

    const tx = dir * helmW * 0.72;
    const ty = -helmH * 1.45;

    const ic1x = dir * helmW * 0.15;
    const ic1y = -helmH * 0.15;
    const ic2x = dir * helmW * 0.85;
    const ic2y = -helmH * 0.7;

    const oc1x = dir * helmW * 0.9;
    const oc1y = -helmH * 0.55;
    const oc2x = dir * helmW * 0.7;
    const oc2y = -helmH * 0.0;

    ctxRef.fillStyle = 'rgba(216,200,160,0.97)';
    ctxRef.beginPath();
    ctxRef.moveTo(bx1, by1);
    ctxRef.bezierCurveTo(ic1x, ic1y, ic2x, ic2y, tx, ty);
    ctxRef.bezierCurveTo(oc1x, oc1y, oc2x, oc2y, bx2, by2);
    ctxRef.closePath();
    ctxRef.fill();

    ctxRef.strokeStyle = 'rgba(90,70,30,0.6)';
    ctxRef.lineWidth = lw * 0.7;
    ctxRef.stroke();

    ctxRef.strokeStyle = 'rgba(255,248,220,0.45)';
    ctxRef.lineWidth = lw * 0.5;
    ctxRef.beginPath();
    ctxRef.moveTo(bx1 + dir * helmW * 0.04, by1 - helmH * 0.06);
    ctxRef.bezierCurveTo(
      ic1x + dir * helmW * 0.04, ic1y + helmH * 0.03,
      ic2x + dir * helmW * 0.02, ic2y + helmH * 0.04,
      tx, ty
    );
    ctxRef.stroke();

    ctxRef.restore();
  };
  drawHorn(-1);
  drawHorn(1);

  ctxRef.fillStyle = 'rgba(194,201,210,0.98)';
  ctxRef.strokeStyle = 'rgba(50,55,65,0.7)';
  ctxRef.lineWidth = lw;
  ctxRef.beginPath();
  ctxRef.moveTo(-helmW * 0.52, helmH * 0.16);
  ctxRef.quadraticCurveTo(-helmW * 0.44, -helmH * 0.66, 0, -helmH * 0.84);
  ctxRef.quadraticCurveTo(helmW * 0.44, -helmH * 0.66, helmW * 0.52, helmH * 0.16);
  ctxRef.lineTo(helmW * 0.36, helmH * 0.42);
  ctxRef.quadraticCurveTo(0, helmH * 0.62, -helmW * 0.36, helmH * 0.42);
  ctxRef.closePath();
  ctxRef.fill();
  ctxRef.stroke();

  ctxRef.fillStyle = 'rgba(80,90,105,0.45)';
  ctxRef.beginPath();
  ctxRef.rect(-helmW * 0.06, -helmH * 0.76, helmW * 0.12, helmH * 1.3);
  ctxRef.fill();

  ctxRef.fillStyle = 'rgba(220,225,230,0.85)';
  ctxRef.beginPath();
  ctxRef.moveTo(-helmW * 0.52, helmH * 0.1);
  ctxRef.lineTo(helmW * 0.52, helmH * 0.1);
  ctxRef.lineTo(helmW * 0.42, helmH * 0.32);
  ctxRef.quadraticCurveTo(0, helmH * 0.48, -helmW * 0.42, helmH * 0.32);
  ctxRef.closePath();
  ctxRef.fill();
  ctxRef.strokeStyle = 'rgba(50,55,65,0.5)';
  ctxRef.lineWidth = lw * 0.6;
  ctxRef.stroke();

  const drawPlate = (dir) => {
    const px = dir * helmW * 0.38;
    const pw = helmW * 0.13;
    const ph = helmH * 0.52;
    const py = -helmH * 0.26;
    ctxRef.fillStyle = 'rgba(180,185,195,0.9)';
    ctxRef.strokeStyle = 'rgba(50,55,65,0.5)';
    ctxRef.lineWidth = lw * 0.5;
    ctxRef.fillRect(px - pw * 0.5, py, pw, ph);
    ctxRef.strokeRect(px - pw * 0.5, py, pw, ph);
    const rivetR = Math.max(1, size * 0.025);
    ctxRef.fillStyle = 'rgba(90,95,105,0.7)';
    for (let i = 0; i < 4; i++) {
      const ry = py + ph * 0.15 + (ph * 0.7) * (i / 3);
      ctxRef.beginPath();
      ctxRef.arc(px, ry, rivetR, 0, Math.PI * 2);
      ctxRef.fill();
    }
  };
  drawPlate(-1);
  drawPlate(1);

  ctxRef.fillStyle = 'rgba(190,195,205,0.9)';
  ctxRef.strokeStyle = 'rgba(50,55,65,0.5)';
  ctxRef.lineWidth = lw * 0.6;
  ctxRef.beginPath();
  ctxRef.moveTo(-helmW * 0.06, helmH * 0.38);
  ctxRef.lineTo(helmW * 0.06, helmH * 0.38);
  ctxRef.lineTo(helmW * 0.03, helmH * 0.72);
  ctxRef.lineTo(0, helmH * 0.8);
  ctxRef.lineTo(-helmW * 0.03, helmH * 0.72);
  ctxRef.closePath();
  ctxRef.fill();
  ctxRef.stroke();

  ctxRef.strokeStyle = 'rgba(255,255,255,0.25)';
  ctxRef.lineWidth = lw * 0.8;
  ctxRef.beginPath();
  ctxRef.moveTo(-helmW * 0.3, -helmH * 0.38);
  ctxRef.quadraticCurveTo(0, -helmH * 0.62, helmW * 0.3, -helmH * 0.38);
  ctxRef.stroke();

  ctxRef.restore();
}

const HAT_RENDERERS = {
  bunny: drawBunny,
  cat: drawCat,
  viking: drawViking,
};

export function drawGhostHatLayer(ctxRef, hatKey, size, bodyColor, ts) {
  if (!hatKey || hatKey === 'none') return;
  const render = HAT_RENDERERS[hatKey];
  if (!render) return;
  render(ctxRef, size, bodyColor, ts);
}
