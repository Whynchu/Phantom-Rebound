const VERSION = { num: '1.20.10', label: 'COOP PHASE C2D-2: GUEST FIRE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






