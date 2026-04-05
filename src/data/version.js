const VERSION = { num: '1.16.8', label: 'PATCH NOTES LAYOUT FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
