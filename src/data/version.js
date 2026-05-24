const VERSION = { num: '1.11.0', label: 'OVERFLOW PROTOCOL' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
