const VERSION = { num: '1.20.63', label: 'D18.15 - coop spectator-on-death' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






