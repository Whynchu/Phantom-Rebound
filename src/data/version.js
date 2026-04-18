const VERSION = { num: '1.16.80', label: 'WEB APP ICONS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






