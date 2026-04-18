const VERSION = { num: '1.16.98', label: 'HEAVY ROUNDS & TEMPO' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






