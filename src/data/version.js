const VERSION = { num: '1.20.135', label: 'R0.4-A/C/D: room state + player fire in hostSimStep' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };