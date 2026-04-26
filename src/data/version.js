const VERSION = { num: '1.20.101', label: 'R0.4 step 8 — slot-0 parity GAP 1 + GAP 2 closed (death visuals on body, getSlotShields adapter)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };