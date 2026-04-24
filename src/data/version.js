const VERSION = { num: '1.20.37', label: 'D11 SYNC START + TICK-TOLERANT INPUT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






