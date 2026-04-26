const VERSION = { num: '1.20.128', label: 'R3 GREY ABSORB PARITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };