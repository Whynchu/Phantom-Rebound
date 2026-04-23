const VERSION = { num: '1.20.3', label: 'COOP PHASE C1A: SIM CLOCK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






