const VERSION = { num: '1.20.123', label: 'COOP FEEDBACK EVENTS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };