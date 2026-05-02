const VERSION = { num: '1.4.15', label: 'LEADERBOARD FALLBACK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
