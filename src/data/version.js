const VERSION = { num: '1.20.136', label: 'R0.4-H + DR-1/3: complete simStep wiring, retire bulletLocalAdvance + greyLagComp' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };