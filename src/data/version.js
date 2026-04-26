const VERSION = { num: '1.20.127', label: 'R3 ORBIT CONTACT PARITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };