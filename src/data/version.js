const VERSION = { num: '1.20.155', label: 'ENEMY ID FIX SNAPSHOT BROADCAST' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
