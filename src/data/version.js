const VERSION = { num: '1.20.102', label: 'R0.4 step 9 — GAP 3 closed (run-scope counters on state.run)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };