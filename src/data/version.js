const VERSION = { num: '1.14.3', label: 'Phase 7: Color Customization - Picker UI' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
