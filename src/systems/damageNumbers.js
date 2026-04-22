// Phantom Rebound — Damage number system
// Owns the dmgNumbers buffer. Spawn handles horizontal fan-out so multiple
// hits at the same spot don't stack on top of each other.

import { MAX_DMG_NUMBERS } from '../data/constants.js';

// Damage numbers render as `bold 10px "IBM Plex Mono"`; each character is
// roughly CHAR_W pixels wide. We place with `textAlign = 'center'`, so the
// minimum horizontal gap between two numbers' centers is half of each one's
// width plus a small padding of ~1 character.
const CHAR_W = 6;
const CHAR_GAP = CHAR_W;
const VERTICAL_PROX = 14;

function halfWidth(text) {
  return (String(text).length * CHAR_W) / 2;
}

export const dmgNumbers = [];

export function clearDmgNumbers() {
  dmgNumbers.length = 0;
}

export function getDmgNumbers() {
  return dmgNumbers;
}

export function spawnDmgNumber(x, y, value, color = '#fff') {
  if (dmgNumbers.length >= MAX_DMG_NUMBERS) dmgNumbers.shift();
  const display = value >= 1 ? Math.round(value) : value.toFixed(1);
  const text = String(display);
  const newHalf = halfWidth(text);
  let nx = x + (Math.random() - 0.5) * 6;
  let ny = y;
  // Nudge horizontally to leave ~one character between adjacent numbers,
  // accounting for each number's own rendered width.
  let bumped = true;
  let dir = 1;
  let step = 0;
  while (bumped) {
    bumped = false;
    for (const d of dmgNumbers) {
      const minDx = newHalf + halfWidth(d.text) + CHAR_GAP;
      if (Math.abs(d.x - nx) < minDx && Math.abs(d.y - ny) < VERTICAL_PROX) {
        step++;
        nx = x + dir * minDx * step;
        dir *= -1;
        bumped = true;
        break;
      }
    }
  }
  dmgNumbers.push({ x: nx, y: ny, text, color, life: 1 });
}
