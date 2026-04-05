const VERSION = { num: '1.14.0', label: 'Phase 7: Color Customization' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
