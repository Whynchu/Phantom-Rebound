const VERSION = { num: '1.20.98', label: 'R0.4 step 5 — sim clock seam (state.tick + state.timeMs advance in hostSimStep)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






