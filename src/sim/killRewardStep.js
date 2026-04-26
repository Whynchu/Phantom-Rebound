// Rollback kill-reward application helpers.
//
// The live loop resolves kill rewards in two phases:
//   1. score / kills / overkill bookkeeping
//   2. reward side effects (heals, charge, burst spawns, extra grey drops)
//
// This module handles phase 2 for rollback resim. Callers still own the
// score/kills accounting because the output and orbit kill paths differ.

import { applyKillSustainHeal } from '../systems/sustain.js';
import { applyKillUpgradeState, buildKillRewardActions, resolveEnemyKillEffects } from '../systems/killRewards.js';
import { nextSimRandom, pushSimGreyBullet, spawnSimRadialOutputBurst } from './simProjectiles.js';

const DEFAULT_KILL_SUSTAIN_CAP_CONFIG = {
  baseHealCap: 14,
  perRoomHealCap: 0.22,
  maxHealCap: 34,
};

function applyEnemyKillRewards(state, slot, enemy, bullet, opts = {}) {
  if (!state || !slot || !enemy) return null;

  const upg = slot.upg || {};
  const metrics = slot.metrics || {};
  const timers = slot.timers || {};
  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;

  const killEffects = resolveEnemyKillEffects({
    enemy,
    bullet,
    upgrades: upg,
    hp: metrics.hp || 0,
    maxHp: metrics.maxHp || 1,
    ts,
    vampiricHealPerKill: opts.vampiricHealPerKill ?? 4,
    vampiricChargePerKill: opts.vampiricChargePerKill ?? 0.25,
  });

  applyKillUpgradeState(upg, killEffects.nextUpgradeState);

  const actions = buildKillRewardActions({
    killEffects,
    enemyX: enemy.x,
    enemyY: enemy.y,
    playerX: slot.body?.x ?? enemy.x,
    playerY: slot.body?.y ?? enemy.y,
    ts,
    upgrades: upg,
    globalSpeedLift: opts.globalSpeedLift ?? 1,
    bloodPactHealCap: opts.bloodPactHealCap ?? 0,
    random: () => nextSimRandom(state),
  });

  for (const action of actions) {
    applyAction(state, slot, action, opts);
  }

  return killEffects;
}

function applyAction(state, slot, action, opts) {
  switch (action.type) {
    case 'bossClear':
      if (state.run) {
        state.run.bossClears = (state.run.bossClears || 0) + 1;
      }
      healSlot(slot, action.healAmount || 0);
      break;
    case 'sustainHeal':
      applySustainHeal(state, slot, action, opts);
      break;
    case 'gainCharge':
      gainSlotCharge(slot, action.amount || 0);
      break;
    case 'spawnGreyBullet':
      pushSimGreyBullet(state, {
        x: action.x,
        y: action.y,
        vx: action.vx,
        vy: action.vy,
        radius: action.radius,
        decayStart: action.decayStart,
      });
      break;
    case 'spawnSanguineBurst':
      spawnSimRadialOutputBurst(state, {
        x: action.x,
        y: action.y,
        count: action.count,
        speed: action.speed,
        radius: action.radius,
        bounceLeft: action.bounceLeft,
        pierceLeft: action.pierceLeft,
        homing: action.homing,
        crit: action.crit,
        dmg: action.dmg,
        expireAt: action.expireAt,
        ownerId: slot.index ?? 0,
        extras: action.extras,
      });
      break;
  }
}

function applySustainHeal(state, slot, action, opts) {
  const timers = slot.timers || {};
  const result = applyKillSustainHeal({
    amount: action.amount || 0,
    roomIndex: state.run?.roomIndex || 0,
    healedThisRoom: timers.killSustainHealedThisRoom || 0,
    healPlayer: (amount) => healSlot(slot, amount),
    source: action.source,
    config: opts.killSustainCapConfig || DEFAULT_KILL_SUSTAIN_CAP_CONFIG,
  });
  timers.killSustainHealedThisRoom = result.healedThisRoom;
  return result.applied;
}

function healSlot(slot, amount) {
  if (!slot?.metrics) return 0;
  const before = slot.metrics.hp || 0;
  const maxHp = Math.max(1, slot.metrics.maxHp || before || 1);
  slot.metrics.hp = Math.min(maxHp, before + Math.max(0, amount || 0));
  return slot.metrics.hp - before;
}

function gainSlotCharge(slot, amount) {
  if (!slot?.metrics) return 0;
  const before = slot.metrics.charge || 0;
  const maxCharge = Math.max(1, slot.metrics.maxCharge || slot.upg?.maxCharge || 1);
  slot.metrics.charge = Math.min(maxCharge, before + Math.max(0, amount || 0));
  return slot.metrics.charge - before;
}

export {
  applyEnemyKillRewards,
  healSlot,
  gainSlotCharge,
};
