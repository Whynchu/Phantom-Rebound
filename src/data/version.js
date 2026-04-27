const VERSION = { num: '1.20.157', label: 'COOP CHARGE RING FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
