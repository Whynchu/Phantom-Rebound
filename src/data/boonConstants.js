// Centralized tunables for boons. Pure data — no logic or DOM deps.
// See src/data/boons.js for the BOONS array and apply() callbacks.

export const SPS_LADDER = [0.8, 1.2, 2.2, 3.8, 6.0, 8.8];
export const MAX_SHIELD_TIER = 4;

export const TITAN_HP_PCT = [0.50, 0.30, 0.18, 0.10, 0.05];
export const TITAN_SLOW_PCT = 0.05;
export const TITAN_MAX_SIZE_MULT = 2.0;

export const MINI_MAX_TIER = 3;
export const MINI_SIZE_MULT_PER_TIER = 0.80;
export const MINI_HP_MULT_PER_TIER = 0.90;
export const MINI_SHOT_SPD_PER_TIER = 0.10;
export const MINI_CRIT_CHANCE_PER_TIER = 0.05;
export const MINI_T3_CRIT_DMG_BONUS = 0.20;

export const HEAL_PCT = [1.00, 0.66, 0.66];
export const BERSERKER_HP = 50;

export const EXTRA_LIFE_GAINS = [100, 60, 45, 36, 28, 22];
export const EXTRA_LIFE_SLOW_PER_TIER = 0.98;
export const ROOM_REGEN_PER_PICK = 18;
export const ROOM_REGEN_MAX = 54;

export const BASE_CHARGE_CAP = 5;
export const CHARGE_CAP_PCT = 0.16;
export const CHARGE_CAP_MIN_FLAT_PER_TIER = 2;
export const MAX_CHARGE_CAP_MULT = 2.0;
export const MAX_DEEP_RESERVE_BONUS = 120;

export const DENSE_CORE_DAMAGE_MULTS = [1.45, 2.0, 2.5, 2.85];
export const DENSE_CORE_CAP_SCALES = [0.75, 0.5, 0.25, 0.05];

export const CHARGED_ORB_FIRE_INTERVAL_MS = 1400;

export const ESCALATION_KILL_PCT = 0.03;
export const ESCALATION_MAX_BONUS = 0.60;

export const LATE_BLOOM_SPEED_PENALTY = 0.94;
export const LATE_BLOOM_DAMAGE_TAKEN_PENALTY = 1.06;
export const LATE_BLOOM_DAMAGE_PENALTY = 0.94;

export const KINETIC_FAST_FILL_MAX_PCT = 0.50;
export const KINETIC_FAST_FILL_MIN_PCT = 0.05;
export const KINETIC_FAST_FILL_LOW_CAP = 12;
export const KINETIC_FAST_FILL_HIGH_CAP = 120;
export const KINETIC_FAST_FILL_MULT = 1.75;

export const PAYLOAD_BASE_RADIUS = 288;
export const PAYLOAD_RADIUS_PER_TIER = 84;
export const PAYLOAD_RADIUS_MAX = 576;
