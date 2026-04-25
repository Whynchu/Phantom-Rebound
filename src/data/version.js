const VERSION = { num: '1.20.56', label: 'D18.10 - Coop end-screen breakdown parity' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






