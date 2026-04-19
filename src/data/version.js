const VERSION = { num: '1.17.2', label: 'IMPACT FEEDBACK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






