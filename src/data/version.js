const VERSION = { num: '1.20.75', label: 'R0.4 chunk 2 - host bullet IDs migrated to SimState' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






