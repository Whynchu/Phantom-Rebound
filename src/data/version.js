const VERSION = { num: '1.20.2', label: 'COOP LOBBY: MOBILE SHARE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






