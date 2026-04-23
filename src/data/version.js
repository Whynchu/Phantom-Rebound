const VERSION = { num: '1.20.6', label: 'COOP PHASE C2B: OWNERID + SLOT FIRE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






