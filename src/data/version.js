const VERSION = { num: '1.20.137', label: 'Fix: remove duplicate hideCoopGuestWaitOverlay declaration' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };