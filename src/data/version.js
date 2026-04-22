const VERSION = { num: '1.19.10', label: 'PARTICLES & NUMBERS REFACTOR' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






