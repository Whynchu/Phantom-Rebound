const VERSION = { num: '1.17.0', label: 'BALANCE OVERHAUL' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






