const VERSION = { num: '1.20.21', label: 'COOP PHASE D0B: PER-SLOT FIRE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






