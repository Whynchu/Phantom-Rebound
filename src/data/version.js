const VERSION = { num: '1.9.0', label: 'MAX DAMAGE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
