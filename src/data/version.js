const VERSION = { num: '1.12.0', label: 'HUNTER SEAL' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
