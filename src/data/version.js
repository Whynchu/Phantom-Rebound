const VERSION = { num: '1.4.8', label: 'GLOW DRIFT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
