const VERSION = { num: '1.20.99', label: 'R0.4 step 6 — Region B (bullet bounce dispatch) carved into pure module' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






