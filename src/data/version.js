const VERSION = { num: '1.20.103', label: 'R0.4 step 10 — GAP 4 closed, Region C (grey absorb) carved into pure module' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };