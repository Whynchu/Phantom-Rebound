// Phantom Rebound — Particle system
// Owns the particles buffer. Spawn functions cap at MAX_PARTICLES to prevent
// runaway memory on burst-heavy frames. Tick/draw are handled elsewhere for
// now; this module just owns the spawn surface area.

import { MAX_PARTICLES } from '../data/constants.js';

export const particles = [];

export function clearParticles() {
  particles.length = 0;
}

export function getParticles() {
  return particles;
}

export function spawnSparks(x, y, col, n = 6, spd = 80) {
  const room = Math.min(n, MAX_PARTICLES - particles.length);
  for (let i = 0; i < room; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spd * (0.4 + Math.random() * 0.6);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      col,
      life: 1,
      decay: 1.6 + Math.random(),
    });
  }
}

export function spawnBlueDissipateBurst(x, y, colorFn) {
  const room = Math.min(12, MAX_PARTICLES - particles.length);
  for (let i = 0; i < room; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 45 + Math.random() * 70;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      col: colorFn(0.35 + Math.random() * 0.4),
      life: 0.9 + Math.random() * 0.35,
      decay: 2.2 + Math.random() * 0.9,
      grow: 0.8 + Math.random() * 1.2,
    });
  }
}

export function spawnPayloadExplosion(x, y, radius) {
  const outerBurstCount = Math.min(28, Math.max(12, Math.round(radius / 8)));
  const outerBurstRoom = Math.min(outerBurstCount, MAX_PARTICLES - particles.length);
  for (let i = 0; i < outerBurstRoom; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = radius * (0.55 + Math.random() * 0.4);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      col: Math.random() < 0.35 ? 'rgba(255,246,220,0.82)' : 'rgba(255,122,56,0.78)',
      life: 0.7 + Math.random() * 0.28,
      decay: 2.0 + Math.random() * 0.7,
      grow: Math.max(2.4, radius / 18) + Math.random() * Math.max(1.5, radius / 22),
    });
  }

  const coreBurstCount = Math.min(16, Math.max(8, Math.round(radius / 16)));
  const coreBurstRoom = Math.min(coreBurstCount, MAX_PARTICLES - particles.length);
  for (let i = 0; i < coreBurstRoom; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = radius * (0.14 + Math.random() * 0.16);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      col: Math.random() < 0.5 ? 'rgba(255,230,170,0.88)' : 'rgba(255,160,84,0.84)',
      life: 0.5 + Math.random() * 0.2,
      decay: 2.6 + Math.random() * 0.8,
      grow: Math.max(3.2, radius / 14) + Math.random() * Math.max(2, radius / 18),
    });
  }
}
