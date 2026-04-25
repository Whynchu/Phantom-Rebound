const VERSION = { num: '1.20.72', label: 'R0.1/R0.2 complete - audit + finish seeded RNG migration in script.js' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






