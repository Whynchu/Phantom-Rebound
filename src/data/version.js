const VERSION = { num: '1.20.52', label: 'D18.6 — guest cosmetic ticking + AFK 30s random + watchdog gating' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






