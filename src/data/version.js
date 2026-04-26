const VERSION = { num: '1.20.94', label: 'R0.6 + R1: 10k determinism canary + state round-trip parity tests' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






