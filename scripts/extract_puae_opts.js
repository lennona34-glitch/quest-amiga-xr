import fs from 'fs';

const wasmBuf = fs.readFileSync('scripts/puae_libretro.wasm');
const str = wasmBuf.toString('binary');
const matches = new Set();
const regex = /puae_[a-z0-9_]+/g;
let m;
while ((m = regex.exec(str)) !== null) {
  matches.add(m[0]);
}

const sorted = Array.from(matches).sort();
console.log('Found', sorted.length, 'puae options in WASM:');
console.log(sorted.join('\n'));
