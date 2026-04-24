const VERSION = { num: '1.20.24', label: 'D4A SNAPSHOT SCHEMA' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






