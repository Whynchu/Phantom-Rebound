const VERSION = { num: '1.20.151', label: 'HYBRID COOP PLAN' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };