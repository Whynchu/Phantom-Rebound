const VERSION = { num: '1.20.80', label: 'R0.4 chunks 7-8 - bridge UPG and world.obstacles into SimState' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






