const VERSION = { num: '1.19.5', label: 'CAT EARS HEIGHT FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






