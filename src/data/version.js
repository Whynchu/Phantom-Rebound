const VERSION = { num: '1.4.17', label: 'CEILING TUNE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
