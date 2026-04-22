// Phantom Rebound — Hat definitions (source of truth)
// Rendering lives in src/ui/drawing/hatRenderer.js and is keyed off `key`.
// HP bar anchor depends on `heightMult`; keep values byte-identical unless
// visually tuning the cosmetic.

export const HAT_OPTIONS = [
  { key: 'none',   name: 'No Hat',      tag: 'Default',  description: '', heightMult: 0.9 },
  { key: 'bunny',  name: 'Bunny Ears',  tag: 'Spring',   description: '', heightMult: 1.5 },
  { key: 'cat',    name: 'Cat Ears',    tag: 'Spring',   description: '', heightMult: 0.85 },
  { key: 'viking', name: 'Viking Helm', tag: 'Founders', description: '', heightMult: 0.9 },
];

const HAT_BY_KEY = new Map(HAT_OPTIONS.map((h) => [h.key, h]));

export function getHatOption(key) {
  return HAT_BY_KEY.get(key) || HAT_OPTIONS[0];
}

export function hasHatKey(key) {
  return HAT_BY_KEY.has(key);
}

export function getHatHeightMultiplier(key) {
  const hat = HAT_BY_KEY.get(key);
  return hat ? hat.heightMult : 0.9;
}
