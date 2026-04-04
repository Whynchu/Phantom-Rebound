const VERSION = { num: '0.97', label: 'Boss Health Balance' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
