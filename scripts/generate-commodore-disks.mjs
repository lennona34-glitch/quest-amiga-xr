import fs from 'fs';
import path from 'path';

// Format standard 1541 .D64 disk image (35 tracks, 683 sectors, 174,848 bytes)
// Track 18, Sector 0 is the BAM (Block Availability Map) and Disk Title.
function createFormattedD64(diskTitle, diskId = '2A') {
  const disk = Buffer.alloc(174848, 0x00);

  // Sector counts per track:
  // Tracks 1-17: 21 sectors
  // Tracks 18-24: 19 sectors (Track 18 is BAM & Directory)
  // Tracks 25-30: 18 sectors
  // Tracks 31-35: 17 sectors
  const trackSectors = [
    0, // 0 unused
    21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 1-17
    19, 19, 19, 19, 19, 19, 19, // 18-24
    18, 18, 18, 18, 18, 18, // 25-30
    17, 17, 17, 17, 17 // 31-35
  ];

  function getSectorOffset(track, sector) {
    let offset = 0;
    for (let t = 1; t < track; t++) {
      offset += trackSectors[t] * 256;
    }
    return offset + (sector * 256);
  }

  // Track 18, Sector 0: BAM block
  const bamOffset = getSectorOffset(18, 0);
  disk[bamOffset + 0] = 18; // Track of first directory block
  disk[bamOffset + 1] = 1;  // Sector of first directory block
  disk[bamOffset + 2] = 0x41; // DOS version ('A' for 1541)
  disk[bamOffset + 3] = 0x00;

  // Initialize BAM for tracks 1-35 (all free except track 18)
  for (let t = 1; t <= 35; t++) {
    const bPos = bamOffset + 4 + (t - 1) * 4;
    const numSec = trackSectors[t];
    if (t === 18) {
      // Track 18 used for BAM/directory
      disk[bPos + 0] = 0;
      disk[bPos + 1] = 0x00;
      disk[bPos + 2] = 0x00;
      disk[bPos + 3] = 0x00;
    } else {
      disk[bPos + 0] = numSec;
      disk[bPos + 1] = 0xFF;
      disk[bPos + 2] = 0xFF;
      disk[bPos + 3] = (numSec === 21) ? 0x1F : ((numSec === 19) ? 0x07 : ((numSec === 18) ? 0x03 : 0x01));
    }
  }

  // Disk Name (16 bytes padded with 0xA0 shifted space)
  const namePadded = Buffer.alloc(16, 0xA0);
  const titleBuf = Buffer.from(diskTitle.toUpperCase().substring(0, 16));
  titleBuf.copy(namePadded, 0);
  namePadded.copy(disk, bamOffset + 0x90);

  // 0xA0, 0xA0, ID (2 bytes), 0xA0, DOS Type ('2A')
  disk[bamOffset + 0xA0] = 0xA0;
  disk[bamOffset + 0xA1] = 0xA0;
  disk[bamOffset + 0xA2] = diskId.charCodeAt(0);
  disk[bamOffset + 0xA3] = diskId.charCodeAt(1);
  disk[bamOffset + 0xA4] = 0xA0;
  disk[bamOffset + 0xA5] = 0x32; // '2'
  disk[bamOffset + 0xA6] = 0x41; // 'A'

  // Track 18, Sector 1: First Directory Sector (points to 0, 0xFF = no more blocks)
  const dirOffset = getSectorOffset(18, 1);
  disk[dirOffset + 0] = 0x00;
  disk[dirOffset + 1] = 0xFF;

  return disk;
}

// Create a C64 PRG file (BASIC V2)
function createC64Prg(title) {
  const bytes = [];
  // 2-byte load address: $0801 (little endian: 0x01, 0x08)
  bytes.push(0x01, 0x08);

  function addLine(lineNum, textTokens) {
    const lineStart = bytes.length;
    bytes.push(0x00, 0x00); // placeholder for next line ptr
    bytes.push(lineNum & 0xff, (lineNum >> 8) & 0xff);
    bytes.push(...textTokens);
    bytes.push(0x00); // end of line marker
    const nextPtr = 0x0801 + bytes.length - 2;
    bytes[lineStart] = nextPtr & 0xff;
    bytes[lineStart + 1] = (nextPtr >> 8) & 0xff;
  }

  // Token 0x99 = PRINT, 0xc7 = CHR$, 0x97 = POKE
  addLine(10, [0x99, 0x20, 0xc7, 0x28, 0x31, 0x34, 0x37, 0x29, 0x3b, 0x22, ...Buffer.from(`*** ${title.toUpperCase()} ***`), 0x22]);
  addLine(20, [0x99, 0x20, 0x22, ...Buffer.from('COMMODORE GUARDIAN HARDWARE ENGINE'), 0x22]);
  addLine(30, [0x99, 0x20, 0x22, ...Buffer.from('MOS 6510 CPU - SID 6581 - VIC-II 6569'), 0x22]);
  addLine(40, [0x97, 0x20, 0x35, 0x33, 0x32, 0x38, 0x30, 0x2c, 0x30, 0x3a, 0x97, 0x20, 0x35, 0x33, 0x32, 0x38, 0x31, 0x2c, 0x30]);
  addLine(50, [0x99, 0x3a, 0x99, 0x20, 0x22, ...Buffer.from('READY. LOAD OR DRAG ANY D64 / PRG FILE.'), 0x22]);

  // End of BASIC marker (two 0x00 bytes)
  bytes.push(0x00, 0x00);
  return Buffer.from(bytes);
}

// Create a C128 PRG file (BASIC 7.0 load address $1C01)
function createC128Prg(title) {
  const bytes = [];
  // 2-byte load address: $1C01 (little endian: 0x01, 0x1C)
  bytes.push(0x01, 0x1c);

  function addLine(lineNum, textTokens) {
    const lineStart = bytes.length;
    bytes.push(0x00, 0x00);
    bytes.push(lineNum & 0xff, (lineNum >> 8) & 0xff);
    bytes.push(...textTokens);
    bytes.push(0x00);
    const nextPtr = 0x1c01 + bytes.length - 2;
    bytes[lineStart] = nextPtr & 0xff;
    bytes[lineStart + 1] = (nextPtr >> 8) & 0xff;
  }

  addLine(10, [0x99, 0x20, 0xc7, 0x28, 0x31, 0x34, 0x37, 0x29, 0x3b, 0x22, ...Buffer.from(`*** ${title.toUpperCase()} ***`), 0x22]);
  addLine(20, [0x99, 0x20, 0x22, ...Buffer.from('128K DUAL-CPU: MOS 8502 (2MHZ) & Z80'), 0x22]);
  addLine(30, [0x99, 0x20, 0x22, ...Buffer.from('VDC 8563 80-COL RGBI & VIC-IIE 40-COL'), 0x22]);
  addLine(40, [0x99, 0x3a, 0x99, 0x20, 0x22, ...Buffer.from('COMMODORE 128 GUARDIAN MODE READY.'), 0x22]);

  bytes.push(0x00, 0x00);
  return Buffer.from(bytes);
}

// Create a Plus/4 PRG file (BASIC 3.5 load address $1001)
function createPlus4Prg(title) {
  const bytes = [];
  // 2-byte load address: $1001 (little endian: 0x01, 0x10)
  bytes.push(0x01, 0x10);

  function addLine(lineNum, textTokens) {
    const lineStart = bytes.length;
    bytes.push(0x00, 0x00);
    bytes.push(lineNum & 0xff, (lineNum >> 8) & 0xff);
    bytes.push(...textTokens);
    bytes.push(0x00);
    const nextPtr = 0x1001 + bytes.length - 2;
    bytes[lineStart] = nextPtr & 0xff;
    bytes[lineStart + 1] = (nextPtr >> 8) & 0xff;
  }

  addLine(10, [0x99, 0x20, 0xc7, 0x28, 0x31, 0x34, 0x37, 0x29, 0x3b, 0x22, ...Buffer.from(`*** ${title.toUpperCase()} ***`), 0x22]);
  addLine(20, [0x99, 0x20, 0x22, ...Buffer.from('MOS 7501 CPU - TED 7360 (121 COLORS)'), 0x22]);
  addLine(30, [0x99, 0x20, 0x22, ...Buffer.from('BUILT-IN 3-PLUS-1 SOFTWARE READY'), 0x22]);
  addLine(40, [0x99, 0x3a, 0x99, 0x20, 0x22, ...Buffer.from('COMMODORE PLUS/4 GUARDIAN ONLINE.'), 0x22]);

  bytes.push(0x00, 0x00);
  return Buffer.from(bytes);
}

// Ensure public/disks exists
const disksDir = path.resolve('public/disks');
if (!fs.existsSync(disksDir)) {
  fs.mkdirSync(disksDir, { recursive: true });
}

// Write C64 Starter Disks & PRGs
fs.writeFileSync(path.join(disksDir, 'c64_blank.d64'), createFormattedD64('COMMODORE 64', '64'));
fs.writeFileSync(path.join(disksDir, 'c64_guardian.prg'), createC64Prg('Commodore 64 Guardian'));

// Write C128 Starter Disks & PRGs
fs.writeFileSync(path.join(disksDir, 'c128_blank.d64'), createFormattedD64('COMMODORE 128', '28'));
fs.writeFileSync(path.join(disksDir, 'c128_guardian.prg'), createC128Prg('Commodore 128 Guardian'));

// Write Plus/4 Starter Disks & PRGs
fs.writeFileSync(path.join(disksDir, 'plus4_blank.d64'), createFormattedD64('COMMODORE PLUS4', 'P4'));
fs.writeFileSync(path.join(disksDir, 'plus4_guardian.prg'), createPlus4Prg('Commodore Plus/4 Guardian'));

console.log('Successfully generated authentic starter disks and PRGs for C64, C128, and Plus/4 in public/disks/');
