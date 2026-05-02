const VERSION = { num: '1.4.11', label: 'RETRO POP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
