const VERSION = { num: '1.4.14', label: 'LEADERBOARD COHORT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
