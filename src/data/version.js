const VERSION = { num: '1.20.12', label: 'COOP PHASE C2F: COOP GATING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






