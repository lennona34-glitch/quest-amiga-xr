import fs from 'fs';

const buf = fs.readFileSync('scripts/puae_libretro.wasm');

function printStrings(offset, len) {
  const slice = buf.subarray(offset, offset + len);
  const strs = [];
  let cur = '';
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
    if (b >= 32 && b <= 126) cur += String.fromCharCode(b);
    else {
      if (cur.length >= 2) strs.push(cur);
      cur = '';
    }
  }
  return strs;
}

console.log('--- At 0x1907200 (puae_model) ---');
console.log(printStrings(0x1907200, 400).join('\n'));

console.log('--- At 0x1911b00 (puae_model_cd) ---');
console.log(printStrings(0x1911b00, 400).join('\n'));
