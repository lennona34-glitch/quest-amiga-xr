import fs from 'fs';

const buf = fs.readFileSync('scripts/puae_libretro.wasm');

function findValuesFor(opt) {
  const optIdx = buf.indexOf(Buffer.from(opt + '\0'));
  if (optIdx === -1) return null;
  // Look in the surrounding 500 bytes for pipe-separated strings or values
  const slice = buf.subarray(optIdx, optIdx + 800);
  // find null-terminated strings
  const strings = [];
  let cur = [];
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
    if (b >= 32 && b <= 126) {
      cur.push(String.fromCharCode(b));
    } else {
      if (cur.length > 0) {
        strings.push(cur.join(''));
        cur = [];
      }
    }
  }
  return strings.slice(0, 15);
}

const interesting = [
  'puae_model',
  'puae_model_cd',
  'puae_kickstart',
  'puae_cpu_model',
  'puae_cpu_multiplier',
  'puae_cpu_throttle',
  'puae_cpu_compatibility',
  'puae_chipmem_size',
  'puae_fastmem_size',
  'puae_bogomem_size',
  'puae_z3mem_size',
  'puae_cd_speed',
  'puae_cd_startup_delayed_insert',
  'puae_autoloadfastforward',
  'puae_immediate_blits',
  'puae_gfx_framerate',
  'puae_video_standard',
  'puae_cd32pad_options'
];

for (const k of interesting) {
  console.log('===', k, '===');
  console.log(findValuesFor(k));
}
