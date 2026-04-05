const VERSION = { num: '1.15.0', label: 'Phase 7: Player Color Customization' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
