const VERSION = { num: '1.20.27', label: 'D4 SNAPSHOT BROADCAST' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






