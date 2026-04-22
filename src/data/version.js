const VERSION = { num: '1.19.14', label: 'LEADERBOARD BUTTON FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






