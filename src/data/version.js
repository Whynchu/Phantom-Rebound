const VERSION = { num: '1.20.65', label: 'D18.15b - spectator HP bar empty + frown lowered + no blink' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






