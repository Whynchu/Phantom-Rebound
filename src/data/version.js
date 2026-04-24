const VERSION = { num: '1.20.35', label: 'D9 LOBBY -> RUN HANDSHAKE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






