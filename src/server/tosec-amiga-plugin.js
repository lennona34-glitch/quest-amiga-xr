/**
 * Vite Dev Server Plugin: Commodore Amiga TOSEC Archive Streamer & WebSocket Relay
 * Directly serves, searches, and streams the Amiga TOSEC archive over WiFi to Windows Chrome and Meta Quest 3.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { WebSocketServer } from 'ws';
import { fetchCsdbReleases, getPlus4WorldReleases, getC128Releases, getDemosceneReleases, downloadSceneDisk } from './scene-vault-service.js';

export function tosecAmigaServerPlugin() {
  const TOSEC_SEARCH_PATHS = [
    'C:/Users/adria/Desktop/Amiga Emulator/Commodore C128 [TOSEC]',
    'C:/Users/adria/Desktop/Amiga Emulator/Commodore C64 [TOSEC v2012-04-23]',
    'C:/Users/adria/Desktop/Amiga Emulator/Commodore Amiga [TOSEC]',
    'C:/Users/adria/Desktop/Amiga Emulator/Commodore Amiga CD32 [TOSEC]',
    'C:/Users/adria/Desktop/Amiga Emulator/Amiga_CD32_TOSEC_2009_04_18',
    'C:/Users/adria/Desktop/Amiga Emulator/CD32',
    'C:/Users/adria/Desktop/Amiga_CD32_TOSEC_2009_04_18',
    'C:/Users/adria/Desktop/CD32',
    'C:/Users/adria/Downloads/InternetArchive/Amiga_CD32_TOSEC_2009_04_18',
    'C:/Users/adria/Downloads/InternetArchive',
    'C:/Users/adria/Downloads/Amiga_CD32_TOSEC_2009_04_18',
    'C:/Users/adria/Downloads/Commodore Amiga CD32 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore Amiga [TOSEC]',
    'C:/Users/adria/Desktop/Commodore Amiga CD32 [TOSEC]',
    'E:/Commodore Amiga CD32 [TOSEC]',
    'E:/Amiga CD32 [TOSEC]',
    'E:/Amiga_CD32_TOSEC_2009_04_18',
    'E:/CD32',
    'E:/Commodore Amiga [TOSEC]',
    'E:/Commodore 64 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore 64 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore C64 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore 128 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore Plus4 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore Plus-4 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore 16 [TOSEC]',
    'C:/Users/adria/Desktop/Commodore VIC-20 [TOSEC]',
    'C:/Users/adria/Desktop/Amiga Emulator/Commodore 64',
    'C:/Users/adria/Desktop/Amiga Emulator/Commodore 128',
    'C:/Users/adria/Desktop/Amiga Emulator/Commodore Plus4',
    'C:/Users/adria/Desktop/Amiga Emulator/C64',
    'C:/Users/adria/Desktop/Amiga Emulator/C128',
    'C:/Users/adria/Desktop/Amiga Emulator/Plus4',
    'C:/Users/adria/Desktop/Amiga Emulator/quest-amiga-xr/public/disks'
  ];

  const ROMS_DIR = 'C:/Users/adria/Desktop/Amiga Emulator/ROMs';
  const CACHE_FILE = path.resolve('.tosec_index_cache.json');

  let tosecRoot = TOSEC_SEARCH_PATHS[0];
  let gameIndex = [];
  let indexBuilt = false;
  let activeRoots = [];

  function detectSystem(filename, fullPath = '', rootDir = '') {
    const normPath = `${rootDir} ${fullPath}`.toLowerCase();
    const normFile = filename.toLowerCase();
    const ext = filename.split('.').pop().toLowerCase();

    // 1. Authoritative repository-level match
    if (normPath.includes('commodore amiga cd32') || normPath.includes('cd32 [tosec]')) {
      return 'cd32';
    }
    if (normPath.includes('commodore amiga [tosec]') || normPath.includes('amiga [tosec]')) {
      return (normPath.includes('(aga)') || normPath.includes('[aga]') || normFile.includes('(aga)') || normFile.includes('[aga]') || /\baga\b/i.test(normFile)) ? 'aga' : 'amiga';
    }
    if (normPath.includes('commodore c64') || normPath.includes('commodore 64')) {
      return 'c64';
    }
    if (normPath.includes('commodore c128') || normPath.includes('commodore 128')) {
      return 'c128';
    }
    if (normPath.includes('commodore plus') || normPath.includes('commodore 16')) {
      return 'plus4';
    }
    if (normPath.includes('commodore vic')) {
      return 'vic20';
    }

    // 2. Specific file extension match
    if (ext === 'adf' || ext === 'dms') {
      return (normFile.includes('(aga)') || normFile.includes('[aga]') || /\baga\b/i.test(normFile)) ? 'aga' : 'amiga';
    }
    if (ext === 'd64' || ext === 'd81' || ext === 't64' || ext === 'tap' || ext === 'crt' || ext === 'g64' || ext === 'p00') {
      return 'c64';
    }
    if (ext === 'd71') {
      return 'c128';
    }
    if (ext === 'iso' || ext === 'cue' || ext === 'chd' || ext === 'nrg') {
      return 'cd32';
    }

    // 3. Fallback content/tag keywords
    if (normFile.includes('cd32')) return 'cd32';
    if (normFile.includes('(aga)') || normFile.includes('[aga]') || /\baga\b/i.test(normFile)) return 'aga';
    if (normFile.includes('c128')) return 'c128';
    if (normFile.includes('plus4') || normFile.includes('plus-4') || /\bc16\b/i.test(normFile)) return 'plus4';
    if (normFile.includes('vic20') || normFile.includes('vic-20')) return 'vic20';
    if (normFile.includes('c64') || normFile.includes('commodore 64')) return 'c64';
    if (ext === 'prg') return 'c64';

    // Default: Amiga OCS/ECS
    return 'amiga';
  }

  function detectCategory(relPath = '', filename = '') {
    const norm = `${relPath} ${filename}`.toLowerCase();
    if (norm.includes('/games/') || norm.includes('\\games\\') || norm.includes(' - games') || norm.includes('[games]')) return 'games';
    if (norm.includes('/applications/') || norm.includes('\\applications\\') || norm.includes(' - applications') || norm.includes('/utilities/') || norm.includes('\\utilities\\') || norm.includes(' - utilities')) return 'applications';
    if (norm.includes('/compilations/') || norm.includes('\\compilations\\') || norm.includes(' - compilations') || norm.includes('/collections/') || norm.includes('\\collections\\')) return 'compilations';
    if (norm.includes('/demos/') || norm.includes('\\demos\\') || norm.includes(' - demos') || norm.includes('/cractros/') || norm.includes('\\cractros\\')) return 'demos';
    if (norm.includes('/coverdiscs/') || norm.includes('\\coverdiscs\\') || norm.includes('/coverdisks/') || norm.includes('\\coverdisks\\') || norm.includes('/samplers/') || norm.includes('\\samplers\\')) return 'coverdiscs';
    if (norm.includes('/educational/') || norm.includes('\\educational\\') || norm.includes(' - educational')) return 'educational';
    if (norm.includes('/operating systems/') || norm.includes('\\operating systems\\') || norm.includes('/firmware/') || norm.includes('\\firmware\\') || norm.includes('/geos/') || norm.includes('\\geos\\')) return 'operating systems';
    if (norm.includes('/docs/') || norm.includes('\\docs\\') || norm.includes('/diskmags/') || norm.includes('\\diskmags\\') || norm.includes('/magazines/') || norm.includes('\\magazines\\')) return 'docs';
    return 'games';
  }

  function parseTosecTitle(filename) {
    const clean = filename.replace(/\.(zip|adf|dms|gz|iso|cue|bin|chd|nrg|d64|d71|d81|prg|p00|t64|tap|crt|g64)$/i, '');
    const diskMatch = clean.match(/\((?:Disk|Disc|Side|Tape)\s*([0-9A-Za-z]+)\s*(?:of\s*(\d+))?\)/i);
    let diskNum = 1;
    let diskTotal = 1;
    let baseTitle = clean;

    if (diskMatch) {
      const rawNum = parseInt(diskMatch[1], 10);
      if (!isNaN(rawNum)) {
        diskNum = rawNum;
      } else {
        const code = diskMatch[1].toUpperCase().charCodeAt(0);
        if (code >= 65 && code <= 90) diskNum = code - 64; // 'A' -> 1, 'B' -> 2
      }
      diskTotal = diskMatch[2] ? parseInt(diskMatch[2], 10) : diskNum;
      baseTitle = clean.replace(/\((?:Disk|Disc|Side|Tape)\s*[0-9A-Za-z]+\s*(?:of\s*\d+)?\)/i, '').trim();
    }

    return {
      baseTitle,
      diskNum,
      diskTotal,
      cleanName: clean
    };
  }

  function scanDirectoryRecursive(dir, relPrefix = '', rootDir = dir) {
    if (!fs.existsSync(dir)) return [];
    let items = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          const lowerName = ent.name.toLowerCase();
          if (lowerName === 'node_modules' || lowerName === '.git' || lowerName === 'dist' || lowerName === '.cache') {
            continue;
          }
          items = items.concat(scanDirectoryRecursive(full, rel, rootDir));
        } else if (ent.isFile()) {
          const lower = ent.name.toLowerCase();
          if (
            lower.endsWith('.adf') ||
            lower.endsWith('.zip') ||
            lower.endsWith('.dms') ||
            lower.endsWith('.gz') ||
            lower.endsWith('.iso') ||
            lower.endsWith('.cue') ||
            lower.endsWith('.bin') ||
            lower.endsWith('.chd') ||
            lower.endsWith('.nrg') ||
            lower.endsWith('.d64') ||
            lower.endsWith('.d71') ||
            lower.endsWith('.d81') ||
            lower.endsWith('.prg') ||
            lower.endsWith('.p00') ||
            lower.endsWith('.t64') ||
            lower.endsWith('.tap') ||
            lower.endsWith('.crt') ||
            lower.endsWith('.g64')
          ) {
            const parsed = parseTosecTitle(ent.name);
            const system = detectSystem(ent.name, full, rootDir);
            let size = 901120;
            try {
              size = fs.statSync(full).size;
            } catch (e) {}

            const category = detectCategory(rel, ent.name);
            items.push({
              name: parsed.cleanName,
              baseTitle: parsed.baseTitle,
              diskNum: parsed.diskNum,
              diskTotal: parsed.diskTotal,
              file: ent.name,
              relPath: rel,
              fullPath: full,
              rootPath: rootDir,
              system: system,
              category: category,
              size: size
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[Amiga TOSEC] Error reading ${dir}:`, err.message);
    }
    return items;
  }

  function buildIndex(forceRescan = false) {
    const start = Date.now();

    // 1. Instant load from disk cache if available and all roots still exist on disk
    if (!forceRescan && fs.existsSync(CACHE_FILE)) {
      try {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.gameIndex) && parsed.gameIndex.length > 0) {
          const rootsValid = parsed.activeRoots && parsed.activeRoots.length > 0 && parsed.activeRoots.every(r => fs.existsSync(r));
          if (rootsValid) {
            gameIndex = parsed.gameIndex;
            for (const item of gameIndex) {
              if (!item.category) {
                item.category = detectCategory(item.relPath, item.file);
              }
            }
            activeRoots = parsed.activeRoots || [];
            tosecRoot = parsed.tosecRoot || activeRoots[0] || TOSEC_SEARCH_PATHS[0];
            indexBuilt = true;
            console.log(`[Commodore Guardian] Instant Cache Loaded: ${gameIndex.length} items across ${activeRoots.length} roots in ${Date.now() - start}ms`);
            return;
          } else {
            console.log('[Commodore Guardian] Cached repositories moved or changed, rescanning full library...');
          }
        }
      } catch (err) {
        console.warn('[Commodore Guardian] Cache read failed, rescanning repositories:', err.message);
      }
    }

    console.log('[Commodore Guardian] Scanning all Amiga, CD32, C64, C128, and Plus/4 repositories...');
    gameIndex = [];
    activeRoots = [];

    const normSet = new Set();
    const candidateDirs = [];

    const addCandidate = (rawPath) => {
      if (!rawPath) return;
      try {
        if (fs.existsSync(rawPath)) {
          const normalized = path.normalize(path.resolve(rawPath)).toLowerCase();
          if (!normSet.has(normalized)) {
            normSet.add(normalized);
            candidateDirs.push(rawPath);
          }
        }
      } catch (e) {}
    };

    for (const p of TOSEC_SEARCH_PATHS) {
      addCandidate(p);
    }

    // Auto-detect any Commodore, CD32, and TOSEC folders inside Desktop, Downloads, and E:\
    const searchBases = [
      'C:/Users/adria/Desktop/Amiga Emulator',
      'C:/Users/adria/Desktop',
      'C:/Users/adria/Downloads',
      'E:/'
    ];
    for (const baseDir of searchBases) {
      if (fs.existsSync(baseDir)) {
        try {
          const subs = fs.readdirSync(baseDir, { withFileTypes: true });
          for (const s of subs) {
            if (s.isDirectory() && s.name !== 'quest-amiga-xr' && s.name !== 'ROMs') {
              const lower = s.name.toLowerCase();
              if (
                lower.includes('cd32') ||
                lower.includes('amiga') ||
                lower.includes('tosec') ||
                lower.includes('commodore') ||
                lower.includes('c64') ||
                lower.includes('c128') ||
                lower.includes('plus4') ||
                lower.includes('plus-4') ||
                lower.includes('c16')
              ) {
                addCandidate(path.join(baseDir, s.name));
              }
            }
          }
        } catch (e) {}
      }
    }

    // Remove any directory that is a subdirectory of another candidate
    const finalScanDirs = candidateDirs.filter(dir => {
      const norm = path.normalize(path.resolve(dir)).toLowerCase();
      return !candidateDirs.some(other => {
        if (other === dir) return false;
        const otherNorm = path.normalize(path.resolve(other)).toLowerCase();
        return norm.startsWith(otherNorm + path.sep);
      });
    });

    const seenFiles = new Set();
    for (const dir of finalScanDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          if (files.length > 0) {
            activeRoots.push(dir);
            const found = scanDirectoryRecursive(dir, '', dir);
            for (const item of found) {
              if (!seenFiles.has(item.file)) {
                seenFiles.add(item.file);
                gameIndex.push(item);
              }
            }
          }
        } catch (e) {}
      }
    }

    tosecRoot = activeRoots[0] || TOSEC_SEARCH_PATHS[0];
    indexBuilt = true;
    const elapsed = Date.now() - start;
    console.log(`[Commodore Guardian] Indexed ${gameIndex.length} items across ${activeRoots.length} roots in ${elapsed}ms`);

    // Asynchronously write cache to disk
    try {
      const payload = JSON.stringify({
        savedAt: new Date().toISOString(),
        total: gameIndex.length,
        tosecRoot,
        activeRoots,
        gameIndex
      });
      fs.writeFile(CACHE_FILE, payload, (err) => {
        if (err) console.warn('[Commodore Guardian] Failed to write index cache:', err.message);
        else console.log(`[Commodore Guardian] Index cache saved to ${CACHE_FILE} (${(payload.length / (1024 * 1024)).toFixed(1)} MB)`);
      });
    } catch (err) {
      console.warn('[Commodore Guardian] Error caching index:', err.message);
    }
  }

  function unzipFirstEntry(buf) {
    if (buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
      return null;
    }
    const method = buf.readUInt16LE(8);
    const compSize = buf.readUInt32LE(18);
    const fnLen = buf.readUInt16LE(26);
    const extraLen = buf.readUInt16LE(28);
    const innerName = buf.toString('utf8', 30, 30 + fnLen);
    const dataStart = 30 + fnLen + extraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);

    let uncompressed;
    if (method === 0) {
      uncompressed = compData;
    } else if (method === 8) {
      uncompressed = zlib.inflateRawSync(compData);
    } else {
      throw new Error(`Unsupported PKZIP compression method: ${method}`);
    }

    return {
      name: innerName,
      data: uncompressed
    };
  }

  const EXTRACT_CACHE_DIR = path.resolve('public/disks/.extracted_cache');
  if (!fs.existsSync(EXTRACT_CACHE_DIR)) {
    try { fs.mkdirSync(EXTRACT_CACHE_DIR, { recursive: true }); } catch (e) {}
  }
  const extractionLocks = new Map();

  function extractOrGetCachedEntry(zipPath, preferredExt = '') {
    if (!fs.existsSync(zipPath)) return null;
    const targetExt = (preferredExt || '').toLowerCase().trim();

    // Safe sanitized folder name per archive
    const zipBase = path.basename(zipPath, path.extname(zipPath)).replace(/[\\/:\*\?"<>\|]/g, '_');
    const targetDir = path.join(EXTRACT_CACHE_DIR, zipBase);

    const findMatchInDir = (dir) => {
      if (!fs.existsSync(dir)) return null;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        let cueFile = null;
        let cueContent = null;

        for (const ent of entries) {
          if (!ent.isDirectory() && ent.name.toLowerCase().endsWith('.cue')) {
            cueFile = ent.name;
            try {
              cueContent = fs.readFileSync(path.join(dir, ent.name), 'utf8');
            } catch(e) {}
            break;
          }
        }

        // If a CUE sheet exists, verify that all referenced audio/data tracks are present on disk.
        // If any track is missing (e.g. from an old extraction that skipped .wav tracks), trigger full re-extraction.
        if (cueContent) {
          const referenced = Array.from(cueContent.matchAll(/FILE\s+["']?([^"'\r\n]+)["']?/gi))
            .map(m => m[1].replace(/\\/g, '/').split('/').pop().trim());
          const missing = referenced.filter(f => !fs.existsSync(path.join(dir, f)));
          if (missing.length > 0) {
            console.log(`[Commodore Guardian] Incomplete cache in ${dir} (${missing.length} tracks missing, e.g. "${missing[0]}"). Triggering complete multi-track extraction...`);
            return null;
          }
        }

        const candidates = [];
        for (const ent of entries) {
          if (ent.isDirectory()) {
            const subMatch = findMatchInDir(path.join(dir, ent.name));
            if (subMatch) return subMatch;
            continue;
          }
          const f = ent.name;
          const lower = f.toLowerCase();
          if (lower.endsWith('.wav') || lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.flac')) {
            continue; // Skip bulky CD-DA audio tracks for primary boot entry selection
          }

          let score = 0;
          const isTrack01 = /\btrack[\s_0]*1\b/i.test(lower) || !lower.includes('track');
          const isOtherTrack = lower.includes('track') && !isTrack01;

          if (targetExt && lower.endsWith(targetExt)) {
            score = isTrack01 ? 100 : (isOtherTrack ? 40 : 80);
          } else if (lower.endsWith('.iso') || lower.endsWith('.bin') || lower.endsWith('.img') || lower.endsWith('.nrg') || lower.endsWith('.chd')) {
            score = isTrack01 ? 70 : (isOtherTrack ? 30 : 60);
          } else if (lower.endsWith('.adf') || lower.endsWith('.d64') || lower.endsWith('.d71') || lower.endsWith('.d81') || lower.endsWith('.prg') || lower.endsWith('.crt') || lower.endsWith('.tap')) {
            score = 50;
          } else if (lower.endsWith('.cue')) {
            score = 10;
          }

          if (score > 0) {
            candidates.push({ name: f, score });
          }
        }

        candidates.sort((a, b) => b.score - a.score);
        const chosen = candidates.length > 0 ? candidates[0].name : (entries.length > 0 && !entries[0].isDirectory() ? entries[0].name : null);
        if (chosen) {
          const chosenPath = path.join(dir, chosen);
          return {
            name: chosen,
            path: chosenPath,
            size: fs.statSync(chosenPath).size,
            ext: path.extname(chosen).replace('.', '').toLowerCase(),
            cueFile: cueFile,
            cueContent: cueContent
          };
        }
      } catch (e) {}
      return null;
    };

    // 1. Instant check: Already extracted into dedicated directory
    const existing = findMatchInDir(targetDir);
    if (existing) {
      return existing;
    }

    // 2. Fast native extraction using tar.exe (Windows built-in bsdtar, preserving all multi-track CD-DA audio and data tracks)
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (!extractionLocks.has(zipPath)) {
        extractionLocks.set(zipPath, true);
        try {
          const tarArgs = ['-xf', zipPath, '-C', targetDir];
          const proc = spawnSync('tar.exe', tarArgs, {
            windowsHide: true,
            timeout: 120000
          });
          if (proc.status !== 0) {
            throw new Error(`tar exited with status ${proc.status}`);
          }
        } finally {
          extractionLocks.delete(zipPath);
        }
      }

      const match = findMatchInDir(targetDir);
      if (match) return match;
    } catch (tarErr) {
      console.warn(`[Commodore Guardian] tar.exe extract failed (${tarErr.message}), falling back to internal inflate:`, zipPath);
    }

    // 4. Fallback: Synchronous zip buffer traversal
    try {
      const buf = fs.readFileSync(zipPath);
      let off = 0;
      let targetEntry = null;
      let cueEntry = null;

      while (off < buf.length - 4) {
        const sig = buf.readUInt32LE(off);
        if (sig === 0x04034b50) {
          const method = buf.readUInt16LE(off + 8);
          const csize = buf.readUInt32LE(off + 18);
          const fnlen = buf.readUInt16LE(off + 26);
          const extralen = buf.readUInt16LE(off + 28);
          const name = buf.toString('utf8', off + 30, off + 30 + fnlen);
          const dataStart = off + 30 + fnlen + extralen;
          const lower = name.toLowerCase();

          if (lower.endsWith('.cue')) {
            cueEntry = { name, method, csize, dataStart };
          }
          if (targetExt && lower.endsWith(targetExt)) {
            targetEntry = { name, method, csize, dataStart };
          } else if (targetExt === '.iso' && (lower.endsWith('.bin') || lower.endsWith('.img') || lower.endsWith('.chd') || lower.endsWith('.nrg'))) {
            if (!targetEntry) targetEntry = { name, method, csize, dataStart };
          } else if (!targetEntry && (lower.endsWith('.iso') || lower.endsWith('.bin') || lower.endsWith('.img') || lower.endsWith('.chd') || lower.endsWith('.nrg') || lower.endsWith('.cue') || lower.endsWith('.adf') || lower.endsWith('.d64') || lower.endsWith('.d71') || lower.endsWith('.d81') || lower.endsWith('.prg') || lower.endsWith('.crt') || lower.endsWith('.tap'))) {
            targetEntry = { name, method, csize, dataStart };
          }
          off = dataStart + csize;
        } else if (sig === 0x02014b50 || sig === 0x06054b50) {
          break;
        } else {
          off++;
        }
      }

      if (targetEntry) {
        const targetFile = path.join(targetDir, path.basename(targetEntry.name));
        if (!fs.existsSync(targetFile)) {
          const comp = buf.subarray(targetEntry.dataStart, targetEntry.dataStart + targetEntry.csize);
          const decomp = targetEntry.method === 0 ? comp : zlib.inflateRawSync(comp);
          fs.writeFileSync(targetFile, decomp);
        }
        if (cueEntry) {
          const cueFile = path.join(targetDir, path.basename(cueEntry.name));
          if (!fs.existsSync(cueFile)) {
            const comp = buf.subarray(cueEntry.dataStart, cueEntry.dataStart + cueEntry.csize);
            const decomp = cueEntry.method === 0 ? comp : zlib.inflateRawSync(comp);
            fs.writeFileSync(cueFile, decomp);
          }
        }
        return {
          name: targetEntry.name,
          path: targetFile,
          size: fs.statSync(targetFile).size,
          ext: targetEntry.name.split('.').pop().toLowerCase()
        };
      }
    } catch (err) {
      console.warn(`[Commodore Guardian] Extraction error on ${zipPath}:`, err.message);
    }
    return null;
  }

  function buildOrGetMultiDiskBundle(targetItem) {
    if (!targetItem || !targetItem.fullPath) return null;
    const core = (targetItem.name || '').replace(/\((?:Disk|Disc|Side|Tape)\s*[0-9A-Za-z]+\s*(?:of\s*\d+)?\)/i, '')
                                        .replace(/\[[^\]]*\]/g, '')
                                        .replace(/\s+/g, ' ')
                                        .trim()
                                        .toLowerCase();
    const targetDir = path.dirname(targetItem.relPath || '').toLowerCase();

    const matches = gameIndex.filter(g => {
      if (!g || g.system !== targetItem.system) return false;
      if (g.baseTitle && targetItem.baseTitle && g.baseTitle.toLowerCase() === targetItem.baseTitle.toLowerCase()) return true;
      const gCore = (g.name || '').replace(/\((?:Disk|Disc|Side|Tape)\s*[0-9A-Za-z]+\s*(?:of\s*\d+)?\)/i, '')
                                  .replace(/\[[^\]]*\]/g, '')
                                  .replace(/\s+/g, ' ')
                                  .trim()
                                  .toLowerCase();
      if (gCore === core) {
        const gDir = path.dirname(g.relPath || '').toLowerCase();
        return gDir === targetDir;
      }
      return false;
    });

    const diskMap = new Map();
    for (const m of matches) {
      if (!diskMap.has(m.diskNum)) {
        diskMap.set(m.diskNum, m);
      }
    }
    const companions = Array.from(diskMap.values()).sort((a, b) => a.diskNum - b.diskNum);
    if (companions.length <= 1) return null;

    const hash = crypto.createHash('md5').update(companions.map(d => d.file).join('|')).digest('hex').substring(0, 16);
    const bundleDir = path.join(EXTRACT_CACHE_DIR, `bundle_${hash}`);
    const bundleZip = path.join(EXTRACT_CACHE_DIR, `bundle_${hash}.zip`);

    if (fs.existsSync(bundleZip)) {
      return { path: bundleZip, count: companions.length, disks: companions };
    }

    try {
      fs.mkdirSync(bundleDir, { recursive: true });
      const m3uEntries = [];
      for (const d of companions) {
        const extEntry = extractOrGetCachedEntry(d.fullPath, '.adf');
        if (extEntry && fs.existsSync(extEntry.path)) {
          const diskFileName = `Disk${d.diskNum}.adf`;
          const destPath = path.join(bundleDir, diskFileName);
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(extEntry.path, destPath);
          }
          m3uEntries.push(diskFileName);
        }
      }
      if (m3uEntries.length > 0) {
        const cleanBase = (targetItem.baseTitle || 'Game').replace(/["'\\/:*?<>|]/g, '_').trim();
        const m3uName = `${cleanBase}.m3u`;
        fs.writeFileSync(path.join(bundleDir, m3uName), m3uEntries.join('\n'));
        const args = ['-a', '-cf', bundleZip, '-C', bundleDir, ...m3uEntries, m3uName];
        spawnSync('tar.exe', args, { windowsHide: true });
        if (fs.existsSync(bundleZip)) {
          return { path: bundleZip, count: companions.length, disks: companions };
        }
      }
    } catch (err) {
      console.warn('[Commodore Guardian] Multi-disk bundle creation error:', err.message);
    }
    return null;
  }

  return {
    name: 'tosec-amiga-server-plugin',
    configureServer(server) {
      setTimeout(buildIndex, 50);

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        // 1. Stats endpoint: /api/tosec/stats
        if (url.pathname === '/api/tosec/stats') {
          if (!indexBuilt) buildIndex();
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            total: gameIndex.length,
            rootPath: tosecRoot,
            activeRoots: activeRoots,
            available: fs.existsSync(tosecRoot)
          }));
        }

        // Rescan endpoint: /api/tosec/rescan
        if (url.pathname === '/api/tosec/rescan') {
          buildIndex(true);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            success: true,
            total: gameIndex.length,
            activeRoots: activeRoots
          }));
        }

        // 2. Search endpoint: /api/tosec/search?q=...&system=...&category=...&limit=...&offset=...
        if (url.pathname === '/api/tosec/search') {
          if (!indexBuilt) buildIndex();
          const query = (url.searchParams.get('q') || '').trim().toLowerCase();
          const systemFilter = (url.searchParams.get('system') || url.searchParams.get('filter') || 'all').toLowerCase();
          const categoryFilter = (url.searchParams.get('category') || 'games').toLowerCase();
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 300);
          const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

          let results = gameIndex;

          if (systemFilter && systemFilter !== 'all') {
            if (systemFilter === 'amiga') {
              results = results.filter(g => g.system === 'amiga' || g.system === 'aga');
            } else if (systemFilter === 'c64') {
              results = results.filter(g => g.system === 'c64');
            } else if (systemFilter === 'c128') {
              results = results.filter(g => g.system === 'c128');
            } else if (systemFilter === 'plus4' || systemFilter === 'c16') {
              results = results.filter(g => g.system === 'plus4');
            } else if (systemFilter === 'vic20') {
              results = results.filter(g => g.system === 'vic20');
            } else if (systemFilter === 'cd32') {
              results = results.filter(g => g.system === 'cd32');
            } else if (systemFilter === 'aga') {
              results = results.filter(g => {
                if (!g) return false;
                if (g.system === 'aga') return true;
                const n = g.name || '';
                const f = g.file || '';
                const r = g.relPath || '';
                return n.toLowerCase().includes('(aga)') || n.toLowerCase().includes('[aga]') || /\baga\b/i.test(n) ||
                       f.toLowerCase().includes('(aga)') || f.toLowerCase().includes('[aga]') || /\baga\b/i.test(f) ||
                       r.toLowerCase().includes('(aga)') || r.toLowerCase().includes('[aga]') || /\baga\b/i.test(r);
              });
            } else if (systemFilter === 'multidisk') {
              results = results.filter(g => g && g.diskTotal > 1);
            }
          }

          if (categoryFilter && categoryFilter !== 'all') {
            results = results.filter(g => (g.category || 'games') === categoryFilter);
          }

          if (query) {
            const terms = query.split(/\s+/).filter(Boolean);
            results = results.filter(g => {
              if (!g) return false;
              const n = g.name || '';
              const f = g.file || '';
              const r = g.relPath || '';
              const lower = `${n} ${f} ${g.system || ''}`.toLowerCase();
              return terms.every(t => {
                if (t === 'aga') {
                  return g.system === 'aga' ||
                         n.toLowerCase().includes('(aga)') || n.toLowerCase().includes('[aga]') || /\baga\b/i.test(n) ||
                         f.toLowerCase().includes('(aga)') || f.toLowerCase().includes('[aga]') || /\baga\b/i.test(f) ||
                         r.toLowerCase().includes('(aga)') || r.toLowerCase().includes('[aga]') || /\baga\b/i.test(r);
                }
                return lower.includes(t);
              });
            });
          }

          if (categoryFilter === 'all') {
            results = results.slice().sort((a, b) => {
              const aG = (a.category === 'games') ? 0 : 1;
              const bG = (b.category === 'games') ? 0 : 1;
              return aG - bG;
            });
          }

          const page = results.slice(offset, offset + limit);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            totalMatches: results.length,
            offset,
            limit,
            results: page
          }));
        }

        // 3. Multi-disk bundle endpoint: /api/tosec/multidisk?title=...
        if (url.pathname === '/api/tosec/multidisk') {
          if (!indexBuilt) buildIndex();
          const base = (url.searchParams.get('title') || '').trim().toLowerCase();
          const disks = gameIndex
            .filter(g => g.baseTitle.toLowerCase() === base)
            .sort((a, b) => a.diskNum - b.diskNum);

          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ disks }));
        }

        // 3.1. Multi-disk ZIP Package with M3U playlist: /api/tosec/bundle?file=... or /api/tosec/bundle/:filename
        if (url.pathname === '/api/tosec/bundle' || url.pathname.startsWith('/api/tosec/bundle/')) {
          if (!indexBuilt) buildIndex();
          const relFile = url.searchParams.get('file') || decodeURIComponent(url.pathname.replace('/api/tosec/bundle/', ''));
          const safeRel = path.normalize(relFile || '').replace(/^(\.\.[\/\\])+/, '');
          const normRel = safeRel.replace(/\\/g, '/').toLowerCase();
          const baseRel = path.basename(safeRel).toLowerCase();

          const target = gameIndex.find(g => {
            const gRel = (g.relPath || '').replace(/\\/g, '/').toLowerCase();
            const gFile = (g.file || '').toLowerCase();
            return gRel === normRel || gFile === baseRel || gRel.endsWith('/' + baseRel);
          });

          if (target) {
            const bundle = buildOrGetMultiDiskBundle(target);
            if (bundle && fs.existsSync(bundle.path)) {
              const stat = fs.statSync(bundle.path);
              res.setHeader('Content-Type', 'application/zip');
              res.setHeader('Content-Length', stat.size);
              res.setHeader('X-Disk-Count', bundle.count.toString());
              const stream = fs.createReadStream(bundle.path);
              return stream.pipe(res);
            }
          }
          // Fallback: If not multi-disk or failed bundling, redirect query to standard disk endpoint
          req.url = '/api/tosec/get?file=' + encodeURIComponent(relFile);
        }

        // 3.5. Random game endpoint: /api/tosec/random (Disk 1 only!)
        if (url.pathname === '/api/tosec/random') {
          if (!indexBuilt) buildIndex();
          const filter = (url.searchParams.get('filter') || url.searchParams.get('system') || 'all').toLowerCase();
          // Always stick to Disk 1 / single load items for direct booting!
          let pool = gameIndex.filter(g => g.diskNum === 1);
          if (filter === 'cd32') {
            pool = pool.filter(g => g.system === 'cd32');
          } else if (filter === 'aga') {
            pool = pool.filter(g => {
              if (!g) return false;
              if (g.system === 'aga') return true;
              const n = g.name || '';
              return n.toLowerCase().includes('(aga)') || n.toLowerCase().includes('[aga]') || /\baga\b/i.test(n);
            });
          } else if (filter === 'c64') {
            pool = pool.filter(g => g.system === 'c64');
          } else if (filter === 'c128') {
            pool = pool.filter(g => g.system === 'c128');
          } else if (filter === 'plus4' || filter === 'c16') {
            pool = pool.filter(g => g.system === 'plus4');
          } else if (filter === 'vic20') {
            pool = pool.filter(g => g.system === 'vic20');
          } else if (filter === 'amiga') {
            pool = pool.filter(g => g.system === 'amiga' || g.system === 'aga');
          }
          if (pool.length === 0) {
            pool = gameIndex.filter(g => g.diskNum === 1);
          }
          const randomIndex = Math.floor(Math.random() * pool.length);
          const randomGame = pool[randomIndex] || null;

          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            success: !!randomGame,
            totalPool: pool.length,
            game: randomGame
          }));
        }

        // 3.8. Cheats Database & TOSEC Cheat Disks endpoint: /api/tosec/cheats?q=...
        if (url.pathname === '/api/tosec/cheats') {
          if (!indexBuilt) buildIndex();
          const query = (url.searchParams.get('q') || '').trim().toLowerCase();

          let curatedCheats = [];
          const cheatsPath = path.resolve('src/data/amiga-cheats.json');
          const fallbackPath = 'C:/Users/adria/Desktop/Amiga Emulator/quest-amiga-xr/public/data/amiga-cheats.json';
          try {
            const targetFile = fs.existsSync(cheatsPath) ? cheatsPath : fallbackPath;
            if (fs.existsSync(targetFile)) {
              curatedCheats = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
            }
          } catch(e) {
            console.warn('[Amiga Cheats] Failed to load cheats json:', e.message);
          }

          let matchingCurated = curatedCheats;
          if (query) {
            const terms = query.split(/\s+/).filter(Boolean);
            matchingCurated = curatedCheats.filter(item => {
              const nameMatch = item.game.toLowerCase();
              const aliasMatch = (item.aliases || []).join(' ').toLowerCase();
              const cheatText = item.cheats.map(c => `${c.title} ${c.description || ''}`).join(' ').toLowerCase();
              const fullSearch = `${nameMatch} ${aliasMatch} ${cheatText}`;
              return terms.every(t => fullSearch.includes(t));
            });
          }

          // Search TOSEC gameIndex for authentic cheat & trainer compilation disks
          let matchingDisks = gameIndex.filter(g => {
            const lower = g.name.toLowerCase();
            const isCheatDisk = lower.includes('cheat') || lower.includes('trainer') || lower.includes('action replay') || lower.includes('hack');
            if (!isCheatDisk) return false;
            if (!query) return true;
            const terms = query.split(/\s+/).filter(Boolean);
            return terms.every(t => lower.includes(t));
          });

          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            success: true,
            totalCurated: matchingCurated.length,
            curated: matchingCurated,
            totalDisks: matchingDisks.length,
            disks: matchingDisks.slice(0, 40)
          }));
        }

        // 3.9. Scene Vault Endpoints (CSDb, Plus/4 World, Pouët & Demozoo)
        if (url.pathname === '/api/scene/csdb') {
          const q = url.searchParams.get('q') || '';
          const releases = await fetchCsdbReleases(q);
          if (q) {
            const qLower = q.toLowerCase().trim();
            const altQ = qLower.includes('kikstart') ? 'kickstart' : (qLower.includes('kickstart') ? 'kikstart' : null);
            const localMatches = gameIndex.filter(g => {
              const nameLower = (g.name || '').toLowerCase();
              return (nameLower.includes(qLower) || (altQ && nameLower.includes(altQ))) &&
                     (g.system === 'c64' || g.system === 'c128' || g.system === 'plus4' || g.system === 'amiga');
            }).slice(0, 15);

            for (const lm of localMatches) {
              if (!releases.some(r => r.title.toLowerCase() === lm.name.toLowerCase())) {
                releases.push({
                  title: lm.name,
                  group: 'TOSEC Archive (Local)',
                  type: `${lm.system.toUpperCase()} Game (1-Click Local)`,
                  link: '',
                  downloadUrl: '',
                  localRel: lm.relPath,
                  filename: lm.file,
                  system: lm.system
                });
              }
            }
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, count: releases.length, releases }));
        }

        if (url.pathname === '/api/scene/plus4world') {
          const q = url.searchParams.get('q') || '';
          const releases = await getPlus4WorldReleases(q);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, count: releases.length, releases }));
        }

        if (url.pathname === '/api/scene/c128') {
          const q = url.searchParams.get('q') || '';
          const releases = getC128Releases(q);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, count: releases.length, releases }));
        }

        if (url.pathname === '/api/scene/demos') {
          const platform = url.searchParams.get('platform') || 'all';
          const q = url.searchParams.get('q') || '';
          const releases = await getDemosceneReleases(platform, q);

          if (q) {
            const qLower = q.toLowerCase().trim();
            const localMatches = gameIndex.filter(g => {
              const nameLower = (g.name || '').toLowerCase();
              const relLower = (g.relPath || '').toLowerCase();
              const isDemo = relLower.includes('demos') || relLower.includes('magazines') || nameLower.includes('demo') || relLower.includes('intro');
              const matchesQuery = nameLower.includes(qLower) || relLower.includes(qLower);
              const matchesPlatform = (platform === 'all') ||
                                      (platform === 'amiga' && (g.system === 'amiga' || g.system === 'aga')) ||
                                      (platform === 'aga' && g.system === 'aga') ||
                                      (platform === g.system);
              return matchesQuery && isDemo && matchesPlatform;
            }).slice(0, 30);

            for (const lm of localMatches) {
              if (!releases.some(r => r.title.toLowerCase() === lm.name.toLowerCase())) {
                releases.push({
                  title: lm.name,
                  author: 'TOSEC Demoscene (Local 1-Click)',
                  platform: lm.system,
                  year: '',
                  party: `${lm.system.toUpperCase()} Demoscene Disk`,
                  pouetUrl: '',
                  demozooUrl: '',
                  downloadUrl: '',
                  localRel: lm.relPath,
                  filename: lm.file,
                  notes: 'Direct 1-Click Launch from Local TOSEC Demoscene Vault'
                });
              }
            }
          }

          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, count: releases.length, releases }));
        }

        if (url.pathname === '/api/scene/boot') {
          const targetUrl = url.searchParams.get('url');
          const title = url.searchParams.get('title') || 'Scene Release';
          const system = url.searchParams.get('system') || 'c64';
          const filename = url.searchParams.get('filename') || '';
          const localRel = url.searchParams.get('localRel') || '';
          try {
            const result = await downloadSceneDisk(targetUrl, title, system, filename, localRel);
            // Register into active gameIndex so subsequent fetches work immediately
            if (!gameIndex.some(g => g.file === result.file)) {
              gameIndex.unshift({
                name: title,
                baseTitle: title,
                diskNum: 1,
                diskTotal: 1,
                file: result.file,
                relPath: result.relPath,
                fullPath: result.fullPath,
                rootPath: path.resolve('public/disks'),
                system: system,
                size: fs.statSync(result.fullPath).size
              });
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(result));
          } catch (err) {
            console.error('[Scene Boot Error]:', err.message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        // 4. Stream / Download disk: /api/tosec/get?file=... or /api/tosec/disk/:filename
        if (url.pathname === '/api/tosec/get' || url.pathname.startsWith('/api/tosec/disk/')) {
          const relFile = url.searchParams.get('file') || decodeURIComponent(url.pathname.replace('/api/tosec/disk/', ''));
          if (!relFile) {
            res.statusCode = 400;
            return res.end('Missing file parameter');
          }

          const safeRel = path.normalize(relFile).replace(/^(\.\.[\/\\])+/, '');
          const normRel = safeRel.replace(/\\/g, '/').toLowerCase();
          const baseRel = path.basename(safeRel).toLowerCase();

          let fullPath = '';
          const match = gameIndex.find(g => {
            const gRel = (g.relPath || '').replace(/\\/g, '/').toLowerCase();
            const gFile = (g.file || '').toLowerCase();
            return gRel === normRel || gFile === baseRel || gRel.endsWith('/' + baseRel);
          });

          if (match && match.fullPath && fs.existsSync(match.fullPath)) {
            fullPath = match.fullPath;
          } else if (safeRel.startsWith('__public__')) {
            const pubRel = safeRel.replace('__public__/', '').replace('__public__\\', '');
            fullPath = path.join('C:/Users/adria/Desktop/Amiga Emulator/quest-amiga-xr/public/disks', pubRel);
          } else {
            // Search all active roots
            for (const root of activeRoots) {
              const candidate = path.join(root, safeRel);
              if (fs.existsSync(candidate)) {
                fullPath = candidate;
                break;
              }
            }
            if (!fullPath || !fs.existsSync(fullPath)) {
              fullPath = path.join(tosecRoot, safeRel);
            }
          }

          // Fallback: Check if the file is a companion track inside EXTRACT_CACHE_DIR
          if (!fs.existsSync(fullPath)) {
            const findInCache = (dir) => {
              if (!fs.existsSync(dir)) return null;
              try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const ent of entries) {
                  if (ent.isDirectory()) {
                    const found = findInCache(path.join(dir, ent.name));
                    if (found) return found;
                  } else if (ent.name.toLowerCase() === baseRel) {
                    return path.join(dir, ent.name);
                  }
                }
              } catch(e) {}
              return null;
            };
            const cachedFile = findInCache(EXTRACT_CACHE_DIR);
            if (cachedFile && fs.existsSync(cachedFile)) {
              fullPath = cachedFile;
            }
          }

          if (!fs.existsSync(fullPath)) {
            res.statusCode = 404;
            return res.end(`File not found: ${safeRel}`);
          }

          try {
            let filename = path.basename(fullPath);
            const lowerName = filename.toLowerCase();
            let servePath = fullPath;
            let ext = filename.split('.').pop().toLowerCase();
            let sendName = filename;

            // Automatic server-side extraction for ZIP archives:
            if (lowerName.endsWith('.zip')) {
              // Determine preferred extension from requested URL filename
              const reqExt = path.extname(url.pathname).replace('.', '').toLowerCase();
              const isCd32 = fullPath.toLowerCase().includes('cd32') || (safeRel && safeRel.toLowerCase().includes('cd32'));
              const preferredExt = reqExt && reqExt !== 'zip' ? `.${reqExt}` : (isCd32 ? '.iso' : '');
              const extracted = extractOrGetCachedEntry(fullPath, preferredExt);
              if (extracted) {
                servePath = extracted.path;
                sendName = extracted.name;
                ext = extracted.ext;
                if (extracted.cueContent) {
                  res.setHeader('X-Extracted-Cue', Buffer.from(extracted.cueContent).toString('base64'));
                  if (extracted.cueFile) {
                    res.setHeader('X-Extracted-Cue-Name', encodeURIComponent(extracted.cueFile));
                  }
                }
              }
            }

            const stat = fs.statSync(servePath);
            const cType = ext === 'iso' ? 'application/x-iso9660-image' : 
                          ext === 'zip' ? 'application/zip' :
                          ext === 'cue' ? 'application/x-cue' :
                          ext === 'adf' ? 'application/x-amiga-disk-format' :
                          ext === 'wav' ? 'audio/wav' :
                          ext === 'flac' ? 'audio/flac' :
                          ext === 'ogg' ? 'audio/ogg' :
                          ext === 'mp3' ? 'audio/mpeg' :
                          'application/octet-stream';

            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Type', cType);
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(sendName)}"`);
            res.setHeader('X-Extracted-Name', sendName);
            res.setHeader('X-Extracted-Format', ext);
            res.setHeader('Access-Control-Expose-Headers', 'X-Extracted-Name, X-Extracted-Format, X-Extracted-Cue, X-Extracted-Cue-Name, Content-Length, Content-Range, Accept-Ranges');

            // Crucial: Respond to HEAD requests without sending a body stream!
            // Sending body data on HEAD throws ERR_HTTP_HEAD_RESPONSE_HAS_BODY and terminates the TCP socket
            if (req.method === 'HEAD') {
              return res.end();
            }

            const range = req.headers.range;
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
              const chunksize = (end - start) + 1;
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': cType,
                'Content-Disposition': `inline; filename="${encodeURIComponent(sendName)}"`,
                'X-Extracted-Name': sendName,
                'X-Extracted-Format': ext,
                'Access-Control-Expose-Headers': 'X-Extracted-Name, X-Extracted-Format, X-Extracted-Cue, X-Extracted-Cue-Name, Content-Length, Content-Range, Accept-Ranges'
              });
              return fs.createReadStream(servePath, { start, end }).pipe(res);
            }

            const stream = fs.createReadStream(servePath);
            return stream.pipe(res);
          } catch (err) {
            console.error('[Amiga TOSEC] Error serving disk:', err);
            res.statusCode = 500;
            return res.end(`Error serving disk: ${err.message}`);
          }
        }

        // 5. ROMs & Machines list endpoint: /api/roms/list
        if (url.pathname === '/api/roms/list') {
          const romList = [
            { id: 'kick13', name: 'Commodore Amiga 500 (Kickstart 1.3 • OCS)', file: 'kick13.rom', system: 'amiga', default: true },
            { id: 'kick204', name: 'Commodore Amiga 500+ / 600 (Kickstart 2.04 • ECS)', file: 'kick204.rom', system: 'amiga' },
            { id: 'kick31', name: 'Commodore Amiga 1200 (Kickstart 3.1 • AGA 68020)', file: 'kick31.rom', system: 'amiga' },
            { id: 'puae_cd32', name: 'Commodore Amiga CD32 (Akiko • AGA Console)', file: 'kick40060.CD32', system: 'cd32' },
            { id: 'c64', name: 'Commodore 64 (MOS 6510 • SID 6581 • VIC-II)', file: 'c64_blank.d64', system: 'c64' },
            { id: 'plus4', name: 'Commodore Plus/4 (+4 TED 121-Color)', file: 'plus4_blank.d64', system: 'plus4' },
            { id: 'vic20', name: 'Commodore VIC-20 (MOS 6502 • VIC 6560)', file: 'c64_blank.d64', system: 'vic20' },
            { id: 'aros', name: 'Commodore Amiga AROS (Open Source ROM)', file: 'aros-rom-20260820.bin', system: 'amiga' }
          ];

          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ roms: romList }));
        }

        next();
      });

      // WebSocket Remote Relay on /ws-relay
      if (server.httpServer) {
        const wss = new WebSocketServer({ noServer: true });

        server.httpServer.on('upgrade', (req, socket, head) => {
          let pathname = '';
          try {
            pathname = new URL(req.url, 'http://localhost').pathname;
          } catch (e) {
            return;
          }

          if (pathname === '/ws-relay') {
            wss.handleUpgrade(req, socket, head, (ws) => {
              wss.emit('connection', ws, req);
            });
          }
        });

        const broadcast = (sender, msg) => {
          const raw = typeof msg === 'string' ? msg : JSON.stringify(msg);
          for (const client of wss.clients) {
            if (client !== sender && client.readyState === 1) {
              client.send(raw);
            }
          }
        };

        const broadcastStatus = () => {
          for (const client of wss.clients) {
            if (client.readyState === 1) {
              client.send(JSON.stringify({
                type: 'status',
                peerCount: wss.clients.size - 1
              }));
            }
          }
        };

        wss.on('connection', (ws) => {
          console.log(`[Amiga Relay] Client connected. Total active: ${wss.clients.size}`);
          broadcastStatus();

          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString());
              broadcast(ws, msg);
            } catch (err) {
              console.error('[Amiga Relay] Malformed WebSocket message:', err);
            }
          });

          ws.on('close', () => {
            console.log(`[Amiga Relay] Client disconnected. Total active: ${wss.clients.size}`);
            broadcastStatus();
          });
        });
      }
    }
  };
}
