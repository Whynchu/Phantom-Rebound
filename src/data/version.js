const VERSION = { num: '1.20.110', label: 'COOP GUEST POSITION PRIORITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };