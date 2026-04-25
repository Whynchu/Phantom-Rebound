const VERSION = { num: '1.20.82', label: 'R0.6 extended canary + R1 serialize/deserialize' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






