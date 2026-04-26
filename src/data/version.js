const VERSION = { num: '1.20.119', label: 'D20.3 RECOVER HEAL SYNC' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };