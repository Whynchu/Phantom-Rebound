const VERSION = { num: '1.20.73', label: 'R0.3 - SimState + effectQueue scaffolding' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






