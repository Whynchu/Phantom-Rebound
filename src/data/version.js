const VERSION = { num: '1.3.5', label: 'LEADERBOARD COOP TOGGLE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
