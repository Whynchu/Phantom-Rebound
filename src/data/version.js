const VERSION = { num: '1.16.14', label: 'MENU FIT FOLLOW-UP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
