const VERSION = { num: '1.20.40', label: 'D12.2 GUEST UX FIXES' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






