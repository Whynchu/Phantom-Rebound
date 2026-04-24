const VERSION = { num: '1.20.11', label: 'COOP PHASE C2E: PER-SLOT BOONS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






