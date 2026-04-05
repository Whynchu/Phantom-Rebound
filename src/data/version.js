const VERSION = { num: '1.16.1', label: 'HP COLOR' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
