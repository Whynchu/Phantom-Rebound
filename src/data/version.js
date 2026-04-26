const VERSION = { num: '1.20.113', label: 'GHOST TRANSPARENCY FIX + QUEUEEFFECTS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };