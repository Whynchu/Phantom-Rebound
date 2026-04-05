const VERSION = { num: '1.16.3', label: 'HAPPY EASTER' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
