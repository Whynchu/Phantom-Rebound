const VERSION = { num: '1.20.32', label: 'D5c INTERPOLATION BUFFER + UPSERT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






