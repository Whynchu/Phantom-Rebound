const VERSION = { num: '1.5.0', label: 'BOSS SIZE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
