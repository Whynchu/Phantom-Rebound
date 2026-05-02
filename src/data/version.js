const VERSION = { num: '1.5.1', label: 'PHASE SHOTBUSTER' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
