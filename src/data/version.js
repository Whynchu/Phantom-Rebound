const VERSION = { num: '1.20.111', label: 'R3.4 RUSHER CONTACT RESIM' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };