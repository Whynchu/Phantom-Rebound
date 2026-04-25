const VERSION = { num: '1.20.67', label: 'D18.16a - both-dead gameover + iPhone fade' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






