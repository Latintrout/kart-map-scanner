// Run the scanner tests in Node:  node tests/run-node.js [path/to/index.html]
const fs = require('fs');
const path = require('path');
const { runScannerTests } = require('./scanner-tests.js');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const lib = loadScannerLib(html);
const results = runScannerTests(lib);
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? '   -> ' + r.detail : ''}`);
}
console.log(`\n${results.length - failed} passed, ${failed} failed (${path.basename(file)})`);
process.exit(failed ? 1 : 0);

// Pull the data functions out of index.html (between PURE-START and PURE-END).
function loadScannerLib(html) {
  const start = html.indexOf('// PURE-START'), end = html.indexOf('// PURE-END');
  if (start < 0 || end < 0) throw new Error('PURE-START / PURE-END markers not found');
  const code = html.slice(html.lastIndexOf('\n', start), end);
  const names = [...code.matchAll(/^(?:async )?function\s+([A-Za-z0-9_]+)/gm)].map(m => m[1]);
  return new Function(code + '\nreturn {' + names.join(',') + '};')();
}
