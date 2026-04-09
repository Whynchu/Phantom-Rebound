const VERSION = { num: '1.16.24', label: 'CRASH DIAGNOSTICS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
