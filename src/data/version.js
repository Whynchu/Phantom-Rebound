const VERSION = { num: '1.19.27', label: 'AGENT FRIENDLINESS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






