const VERSION = { num: '1.20.57', label: 'D18.10b - coop fixes: bullet color, fire ring cycle, PC end screen' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






