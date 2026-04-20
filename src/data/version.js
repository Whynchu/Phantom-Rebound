const VERSION = { num: '1.19.7', label: 'PATCH NOTES & MENU FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






