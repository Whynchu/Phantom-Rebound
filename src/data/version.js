const VERSION = { num: '1.20.133', label: 'R3.3-SAFE: ROLLBACK ALWAYS-ON + RECONCILER RETIRED' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };