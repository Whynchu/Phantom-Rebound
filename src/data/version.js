const VERSION = { num: '1.08', label: 'Phase 3: Shot Variety' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
