const VERSION = { num: '1.20.100', label: 'R0.4 step 7 — Region D (volatile orbs) carved into pure module' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };