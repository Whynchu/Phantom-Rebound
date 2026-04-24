const VERSION = { num: '1.20.26', label: 'D3-fix transport contract + async send' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






