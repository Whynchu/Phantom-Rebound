const VERSION = { num: '1.20.45', label: 'D13: Guest parity — respawn anchor, orb pickup, hurt anim, aim arrow' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






