const VERSION = { num: '1.20.55', label: 'D18.9 — partner aim reticle uses partner color' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






