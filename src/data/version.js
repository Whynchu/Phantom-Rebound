const VERSION = { num: '1.20.142', label: 'DR-2: fix legendaryRoomsSinceReject getter typo crashing coordinator init' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };