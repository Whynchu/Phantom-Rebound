const VERSION = { num: '1.20.59', label: 'D18.12 - guest charge lerp + rerolls + ring parity' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






