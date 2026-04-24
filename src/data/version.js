const VERSION = { num: '1.20.39', label: 'D12.1 SHARED WORLD SIZE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






