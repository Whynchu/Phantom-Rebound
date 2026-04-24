const VERSION = { num: '1.20.9', label: 'COOP PHASE C2D-1B: PER-SLOT DAMAGE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






