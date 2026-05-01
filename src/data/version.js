const VERSION = { num: '1.14.0', label: 'REBOUND BUMP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
