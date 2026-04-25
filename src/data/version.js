const VERSION = { num: '1.20.41', label: 'D12.3 COOP DIAGNOSTICS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






