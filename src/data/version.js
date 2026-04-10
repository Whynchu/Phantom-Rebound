const VERSION = { num: '1.16.28', label: 'PHASE DASH GRAZE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
