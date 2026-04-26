const VERSION = { num: '1.20.120', label: 'D20.4 HOST RECOVER HANDSHAKE FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };