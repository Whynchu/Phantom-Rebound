const VERSION = { num: '1.20.62', label: 'D18.14 - coop hat handshake' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






