const VERSION = { num: '1.5.5', label: 'RELEASE NOTES' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
