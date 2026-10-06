/**
 * Commodore Scene Vault Service
 * Connects Commodore Guardian to CSDb, Plus/4 World, Pouët.net, and Demozoo.
 * Provides real-time feeds, curated hall-of-fame releases, and 1-click download & streaming.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const SCENE_CACHE_DIR = path.resolve('public/disks/scene');
if (!fs.existsSync(SCENE_CACHE_DIR)) {
  fs.mkdirSync(SCENE_CACHE_DIR, { recursive: true });
}

let csdbCache = {
  timestamp: 0,
  items: []
};

// Curated Plus/4 World Hall of Fame and Essential TED Software
const PLUS4_HALL_OF_FAME = [
  {
    title: 'Icicle Works',
    author: 'Colin Dooley (Commodore / U.S. Gold)',
    year: '1984',
    genre: 'Arcade / Platform',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/games/i/icicle_works.prg',
    infoUrl: 'http://plus4world.powweb.com/software/Icicle_Works',
    filename: 'icicle_works.prg',
    description: 'Classic TED platform puzzler. Avoid the deadly stalactites and collect the gifts across festive caverns!'
  },
  {
    title: 'Majesty of Sprites',
    author: 'Mad / Bauknecht',
    year: '2015',
    genre: 'Platformer / Showcase',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/games/m/majesty_of_sprites.prg',
    infoUrl: 'http://plus4world.powweb.com/software/Majesty_Of_Sprites',
    filename: 'majesty_of_sprites.prg',
    description: 'Masterpiece modern Plus/4 platformer featuring software multiplexed sprites, silky 50fps scrolling, and rich TED audio.'
  },
  {
    title: "Dork's Dilemma",
    author: 'Steve Bak (Imagine Software)',
    year: '1985',
    genre: 'Isometric Action / Puzzle',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/games/d/dorks_dilemma.prg',
    infoUrl: 'http://plus4world.powweb.com/software/Dorks_Dilemma',
    filename: 'dorks_dilemma.prg',
    description: 'Stunning 3D isometric maze runner on the TED 7360 chipset.'
  },
  {
    title: 'Petfall',
    author: 'Misfit',
    year: '2016',
    genre: 'Arcade / Reflex',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/games/p/petfall.prg',
    infoUrl: 'http://plus4world.powweb.com/software/Petfall',
    filename: 'petfall.prg',
    description: 'Fast-paced homebrew arcade action game engineered specifically for Commodore 16 and Plus/4.'
  },
  {
    title: 'Major Blink',
    author: 'Tony Kelly (Softek)',
    year: '1985',
    genre: 'Arcade / Paint',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/games/m/major_blink.prg',
    infoUrl: 'http://plus4world.powweb.com/software/Major_Blink',
    filename: 'major_blink.prg',
    description: 'Vibrant grid painting action game utilizing the full 121-color hardware palette of the TED chip.'
  },
  {
    title: 'Saboteur! (Plus/4)',
    author: 'Clive Townsend (Durell Software)',
    year: '1986',
    genre: 'Stealth / Action',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/games/s/saboteur.prg',
    infoUrl: 'http://plus4world.powweb.com/software/Saboteur',
    filename: 'saboteur.prg',
    description: 'Legendary ninja stealth-action classic faithfully converted to the Commodore Plus/4.'
  },
  {
    title: 'Slipstream (Plus/4 Demo)',
    author: 'Plush',
    year: '2014',
    genre: 'Demoscene / 1st Place',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/demos/s/slipstream.prg',
    infoUrl: 'http://plus4world.powweb.com/software/Slipstream',
    filename: 'slipstream.prg',
    description: 'Winner of Arok Party 2014! Jaw-dropping raster bars, 3D vectors, and music on stock Plus/4 hardware.'
  },
  {
    title: 'Siderals (TED MegaDemo)',
    author: 'The Siderals',
    year: '1993',
    genre: 'Demoscene / Multi-part',
    system: 'plus4',
    downloadUrl: 'http://plus4world.powweb.com/dl/demos/s/siderals.d64',
    infoUrl: 'http://plus4world.powweb.com/software/Siderals',
    filename: 'siderals.d64',
    description: 'Landmark Hungarian Plus/4 demoscene production that changed TED coding forever.'
  }
];

// Curated Commodore 128 Hall of Fame (2MHz 8502 CPU, 80-Col VDC & 128KB Native Modes)
const C128_HALL_OF_FAME = [
  {
    title: 'Elite 128 (Enhanced 2MHz)',
    author: 'Ian Bell & David Braben (Firebird)',
    year: '1985',
    genre: 'Space Combat / Trading',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Games%20-%20%5BD64%5D%20%28TOSEC-v2011-10-06_CM%29%2FElite%20128%20%281985%29%28Firebird%29%28en-de%29%5Bb%5D.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Games - [D64] (TOSEC-v2011-10-06_CM)/Elite 128 (1985)(Firebird)(en-de)[b].zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'elite_128.d64',
    description: 'Legendary 3D space trading combat utilizing the 2MHz 8502 CPU and expanded 128K memory.'
  },
  {
    title: 'Kickstart 128',
    author: 'Shaun Hollingworth (Mr. Chip / Mastertronic)',
    year: '1986',
    genre: 'Motorcycle Racing / Stunts',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Games%20-%20%5BD64%5D%20%28TOSEC-v2011-10-06_CM%29%2FKickstart%20128%20%2819xx%29%28Mr.%20Chip%29%5Bcr%20Golden%20Griffin%5D.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Games - [D64] (TOSEC-v2011-10-06_CM)/Kickstart 128 (19xx)(Mr. Chip)[cr Golden Griffin].zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'kickstart_128.d64',
    description: 'Native C128 trials motorbike racer with dual simultaneous split screens and built-in track construction kit.'
  },
  {
    title: 'The Rocky Horror Show 128',
    author: 'CRL Group',
    year: '1986',
    genre: 'Adventure / Platform',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Games%20-%20%5BD64%5D%20%28TOSEC-v2011-10-06_CM%29%2FRocky%20Horror%20Picture%20Show%20128%2C%20The%20%281986%29%28CRL%29.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Games - [D64] (TOSEC-v2011-10-06_CM)/Rocky Horror Picture Show 128, The (1986)(CRL).zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'rocky_horror_128.d64',
    description: 'Cult musical adventure featuring native 128 mode enhanced multi-voice SID audio tracks.'
  },
  {
    title: 'A Mind Forever Voyaging (80-Col)',
    author: 'Steve Meretzky (Infocom)',
    year: '1985',
    genre: 'Interactive Fiction / Sci-Fi',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Games%20-%20%5BD64%5D%20%28TOSEC-v2011-10-06_CM%29%2FMind%20Forever%20Voyaging%2C%20A%20%2819xx%29%28Infocom%29%28Side%20A%29.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Games - [D64] (TOSEC-v2011-10-06_CM)/Mind Forever Voyaging, A (19xx)(Infocom)(Side A).zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'amfv_128.d64',
    description: 'Seminal Infocom interactive fiction designed specifically for the C128 80-column VDC display.'
  },
  {
    title: 'Trinity (Infocom 80-Col)',
    author: 'Brian Moriarty (Infocom)',
    year: '1986',
    genre: 'Interactive Fiction / Masterpiece',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Games%20-%20%5BD64%5D%20%28TOSEC-v2011-10-06_CM%29%2FTrinity%20%2819xx%29%28Infocom%29%28Side%20A%29.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Games - [D64] (TOSEC-v2011-10-06_CM)/Trinity (19xx)(Infocom)(Side A).zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'trinity_128.d64',
    description: 'Acclaimed historical fantasy exploring the Dawn of the Atomic Age in crisp 80-column text mode.'
  },
  {
    title: 'Thai Boxing 128',
    author: 'Anco Software',
    year: '1986',
    genre: 'Martial Arts / Fighter',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Games%20-%20%5BD64%5D%20%28TOSEC-v2011-10-06_CM%29%2FThai%20Boxing%20128%20%281986%29%28Anco%29.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Games - [D64] (TOSEC-v2011-10-06_CM)/Thai Boxing 128 (1986)(Anco).zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'thai_boxing_128.d64',
    description: 'Fast-paced Muay Thai combat with expanded animations and 128 mode performance optimizations.'
  },
  {
    title: 'Beyond Zork (Infocom 80-Col)',
    author: 'Brian Moriarty (Infocom)',
    year: '1987',
    genre: 'RPG / Interactive Fiction',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Games%20-%20%5BD64%5D%20%28TOSEC-v2011-10-06_CM%29%2FBeyond%20Zork%20%2819xx%29%28Infocom%29%28Side%20A%29%5B80%20Columns%20Mode%5D.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Games - [D64] (TOSEC-v2011-10-06_CM)/Beyond Zork (19xx)(Infocom)(Side A)[80 Columns Mode].zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'beyond_zork_128.d64',
    description: 'Dynamic RPG mechanics, live automapping, and inventory tracking in high-resolution 80-column display.'
  },
  {
    title: 'Risen from Oblivion (C128 Demo)',
    author: 'Crest',
    year: '2001',
    genre: 'Demoscene / Hall of Fame',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Demos%20%28TOSEC-v2011-10-06_CM%29%2FRisen%20from%20Oblivion%20%282001%29%28Crest%29%28Side%20A%29.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Demos (TOSEC-v2011-10-06_CM)/Risen from Oblivion (2001)(Crest)(Side A).zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'risen_from_oblivion_128.d64',
    description: 'Legendary C128 demoparty production pushing both 8502 2MHz CPU and VIC-II/VDC hardware to the absolute edge.'
  },
  {
    title: 'Commodore 1571 Test & C128 DOS Shell',
    author: 'Commodore Business Machines',
    year: '1985',
    genre: 'System / Utility',
    system: 'c128',
    downloadUrl: 'https://archive.org/download/Commodore_C128_TOSEC_2012_04_23/Commodore_C128_TOSEC_2012_04_23.zip/Commodore%20C128%20%5BTOSEC%5D%2FCommodore%20C128%20-%20Applications%20%28TOSEC-v2011-10-06_CM%29%2FCommodore%201571%20Test%20%26%20Demos%20Diskette%20with%20C128%20DOS%20Shell%20%2819xx%29%28Commodore%29%5Bb%5D.zip',
    localRel: 'Commodore C128 [TOSEC]/Commodore C128 - Applications (TOSEC-v2011-10-06_CM)/Commodore 1571 Test & Demos Diskette with C128 DOS Shell (19xx)(Commodore)[b].zip',
    infoUrl: 'https://archive.org/details/Commodore_C128_TOSEC_2012_04_23',
    filename: 'c128_dos_shell.d64',
    description: 'Official Commodore 1571 double-sided fast disk diagnostics and complete graphic C128 DOS Shell.'
  }
];

// Curated Pouët.net & Demozoo All-Time Hall of Fame Demos
const DEMOSCENE_HALL_OF_FAME = [
  // --- AMIGA OCS / ECS ---
  {
    title: 'State of the Art',
    author: 'Spaceballs',
    platform: 'amiga',
    year: '1992',
    party: 'The Party 1992 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=99',
    demozooUrl: 'https://demozoo.org/productions/114/',
    downloadUrl: 'http://ftp.amigascne.org/pub/amiga/Groups/S/Spaceballs/Spaceballs-StateOfTheArt.dms',
    filename: 'spb-sota.dms',
    notes: 'The single most famous Amiga demo in history. Revolutionary silhouette dancing and acid house soundtrack on stock Amiga 500!'
  },
  {
    title: 'Desert Dream',
    author: 'Kefrens',
    platform: 'amiga',
    year: '1992',
    party: 'The Party 1992 (2nd Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=1483',
    demozooUrl: 'https://demozoo.org/productions/115/',
    downloadUrl: 'http://ftp.amigascne.org/pub/amiga/Groups/K/Kefrens/Kefrens-DesertDreamA.adf',
    filename: 'desert_dream.adf',
    notes: 'Epic atmospheric soundtrack by Laxity and gorgeous desert vistas pushing Amiga copper color gradients to their zenith.'
  },
  {
    title: 'Batman Rises',
    author: 'Batman Group',
    platform: 'amiga',
    year: '2022',
    party: 'Revision 2022 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=93011',
    demozooUrl: 'https://demozoo.org/productions/307409/',
    downloadUrl: 'https://www.joycogames.com/download/Batman_Rises_v2.zip',
    filename: 'batman_rises.zip',
    notes: 'Modern Amiga OCS triumph that stunned the demoscene: full 3D shading, raymarching, and cinematic art on a 7MHz 68000.'
  },
  {
    title: 'Hardwired',
    author: 'The Silents & Crionics',
    platform: 'amiga',
    year: '1991',
    party: 'Anarchy Easter Party 1991 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=110',
    demozooUrl: 'https://demozoo.org/productions/110/',
    downloadUrl: 'http://ftp.amigascne.org/pub/amiga/Groups/S/Silents/Silents_Crionics-Hardwired.adf',
    filename: 'hardwired.adf',
    notes: 'Pioneering 3D vectors and voxel landscape tech, created by future founders of DICE (Battlefield).'
  },

  // --- AMIGA AGA ---
  {
    title: 'Tint',
    author: 'The Black Lotus',
    platform: 'aga',
    year: '1996',
    party: 'The Gathering 1996 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=710',
    demozooUrl: 'https://demozoo.org/productions/710/',
    downloadUrl: 'http://ftp.amigascne.org/pub/amiga/Groups/T/TheBlackLotus/TBL-Tint.dms',
    filename: 'tbl-tint.dms',
    notes: 'Legendary Amiga 1200/4000 AGA demo showcasing the full 24-bit palette and silky smooth gouraud shading.'
  },
  {
    title: 'Starstruck',
    author: 'The Black Lotus',
    platform: 'aga',
    year: '2006',
    party: 'Assembly 2006 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=25778',
    demozooUrl: 'https://demozoo.org/productions/25816/',
    downloadUrl: 'https://files.scene.org/get/parties/2006/assembly06/demo/tbl-starstruck-finalversion.zip',
    filename: 'tbl_starstruck.zip',
    notes: 'Widely considered the greatest AGA production ever released. Blended high-end design with impossible 68060 routines.'
  },

  // --- COMMODORE 64 ---
  {
    title: 'Edge of Disgrace',
    author: 'Booze Design',
    platform: 'c64',
    year: '2008',
    party: 'Breakpoint 2008 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=51983',
    demozooUrl: 'https://demozoo.org/productions/50294/',
    downloadUrl: 'https://files.scene.org/get/parties/2008/x08/c64/demo/edge_of_disgrace.zip',
    filename: 'edge_of_disgrace.zip',
    notes: 'Revolutionary C64 demo with mind-bending SID soundtrack by Dane and impossible VIC-II fluid rotation tricks.'
  },
  {
    title: 'Coma Light 13',
    author: 'Oxyron',
    platform: 'c64',
    year: '2013',
    party: 'Revision 2013 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=60631',
    demozooUrl: 'https://demozoo.org/productions/61250/',
    downloadUrl: 'http://csdb.dk/getinternalfile.php/109865/coma-light-13-by-oxyron.zip',
    filename: 'coma_light_13.zip',
    notes: 'Award-winning masterclass in MOS 6510 cycle-exact raster manipulation.'
  },
  {
    title: 'Second Reality 64',
    author: 'Smash Designs',
    platform: 'c64',
    year: '1997',
    party: 'Bizarre 1997',
    pouetUrl: 'https://www.pouet.net/prod.php?which=1216',
    demozooUrl: 'https://demozoo.org/productions/18/',
    downloadUrl: 'https://www.fzool.org/smash/c64/2nd_reality.zip',
    filename: '2nd_reality.zip',
    notes: 'Incredible full demake of Future Crew\'s PC masterpiece running entirely within 64KB on the MOS 6510!'
  },
  {
    title: 'We Are All Connected',
    author: 'Fairlight, Offence, Prosonix',
    platform: 'c64',
    year: '2012',
    party: 'Revision 2012 (1st Place)',
    pouetUrl: 'https://www.pouet.net/prod.php?which=59068',
    demozooUrl: 'https://demozoo.org/productions/59068/',
    downloadUrl: 'https://files.scene.org/get/parties/2008/x08/c64/demo/edge_of_disgrace.zip',
    filename: 'we_are_all_connected.zip',
    notes: 'Breathtaking visual design and SID synthesis from demoscene legends Fairlight.'
  }
];

const C64_CURATED_SCENE = [
  {
    title: 'Edge of Disgrace',
    group: 'Booze Design',
    type: 'C64 Demo / 1st Place',
    link: 'https://csdb.dk/release/?id=66708',
    downloadUrl: 'https://files.scene.org/get/parties/2008/x08/c64/demo/edge_of_disgrace.zip',
    filename: 'edge_of_disgrace.zip',
    system: 'c64'
  },
  {
    title: 'Coma Light 13',
    group: 'Oxyron',
    type: 'C64 Demo / 1st Place',
    link: 'https://csdb.dk/release/?id=117392',
    downloadUrl: 'http://csdb.dk/getinternalfile.php/109865/coma-light-13-by-oxyron.zip',
    filename: 'coma_light_13.zip',
    system: 'c64'
  },
  {
    title: 'Second Reality 64',
    group: 'Smash Designs',
    type: 'C64 Demo Demake',
    link: 'https://csdb.dk/release/?id=1172',
    downloadUrl: 'https://files.scene.org/get/parties/1997/bizarre97/c64/sr64.zip',
    filename: 'sr64.zip',
    system: 'c64'
  },
  {
    title: 'We Are All Connected',
    group: 'Fairlight, Offence, Prosonix',
    type: 'C64 Demo / 1st Place',
    link: 'https://csdb.dk/release/?id=107384',
    downloadUrl: 'https://files.scene.org/get/parties/2012/revision12/c64_demo/we_are_all_connected.d64',
    filename: 'we_are_all_connected.d64',
    system: 'c64'
  },
  {
    title: 'Wonderland XIII',
    group: 'Censor Design',
    type: 'C64 Demo / 1st Place',
    link: 'https://csdb.dk/release/?id=88319',
    downloadUrl: 'https://files.scene.org/get/parties/2010/breakpoint10/c64/demo/wonderland_xiii_by_censor_design.d64',
    filename: 'wonderland_xiii.d64',
    system: 'c64'
  }
];

export async function fetchCsdbReleases(query = '') {
  if (query && query.trim()) {
    const q = query.trim();
    try {
      console.log(`[CSDb Service] Performing live search on CSDb for: "${q}"...`);
      const searchUrl = `https://csdb.dk/search/?seinsel=all&search=${encodeURIComponent(q)}`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CommodoreGuardian/1.0' },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const html = await res.text();
        const results = [];
        const regex = /<li>(?:<a href=["'](\/release\/download\.php\?id=\d+)["'][^>]*>.*?<\/a>)?<a href=["']\/?release\/\?id=(\d+)["']>([^<]+)<\/a>(?:\s*\(([^)]+)\))?(?:.*?by\s*(?:<[^>]+>)*([^<]+))?/gi;
        let m;
        while ((m = regex.exec(html)) !== null) {
          const rawDl = m[1];
          const relId = m[2];
          const title = m[3] ? m[3].replace(/&amp;/g, '&').trim() : '';
          const type = m[4] ? m[4].replace(/&amp;/g, '&').trim() : 'C64 Release';
          const group = m[5] ? m[5].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : 'Independent';

          if (title && relId) {
            const is128 = title.toLowerCase().includes('128') || type.toLowerCase().includes('128');
            results.push({
              title: title,
              group: group,
              type: type,
              link: `https://csdb.dk/release/?id=${relId}`,
              downloadUrl: rawDl ? `https://csdb.dk${rawDl}` : `https://csdb.dk/release/download.php?id=${relId}`,
              filename: `${title.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.prg`,
              system: is128 ? 'c128' : 'c64'
            });
          }
        }

        // Also check curated scene list for any matches
        const qLower = q.toLowerCase();
        const altQ = qLower.includes('kikstart') ? 'kickstart' : (qLower.includes('kickstart') ? 'kikstart' : null);
        const curatedMatches = C64_CURATED_SCENE.filter(item =>
          item.title.toLowerCase().includes(qLower) ||
          item.group.toLowerCase().includes(qLower) ||
          (altQ && item.title.toLowerCase().includes(altQ))
        );
        for (const cm of curatedMatches) {
          if (!results.some(r => r.title.toLowerCase() === cm.title.toLowerCase())) {
            results.unshift(cm);
          }
        }

        if (results.length > 0) {
          console.log(`[CSDb Service] Found ${results.length} releases for "${q}"`);
          return results;
        }
      }
    } catch (e) {
      console.warn(`[CSDb Service] Live search failed for "${q}" (falling back to cache):`, e.message);
    }
  }

  // Fallback / Default feed: Latest releases from RSS or Curated List
  const now = Date.now();
  if (now - csdbCache.timestamp > 5 * 60 * 1000 || csdbCache.items.length === 0) {
    try {
      const res = await fetch('https://csdb.dk/rss/latestreleases.php', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CommodoreGuardian/1.0' },
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const xml = await res.text();
        const items = [];
        const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
        for (const item of itemMatches) {
          const title = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
          const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
          const desc = (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';

          const groupMatch = desc.match(/Released by:\s*<a[^>]*>([^<]+)<\/a>/i);
          const typeMatch = desc.match(/Type:\s*<a[^>]*>([^<]+)<\/a>/i);
          const dlMatch = desc.match(/href=[\x22'](https?:\/\/[^\x22']+\/download\.php\?[^\x22']+)[\x22']/i);
          const filenameMatch = desc.match(/title=[\x22'](https?:\/\/[^\x22']+)[\x22']/i);

          const rawDl = dlMatch ? dlMatch[1].replace(/&amp;/g, '&') : null;
          const cleanTitle = title.replace(/&amp;/g, '&').trim();
          const cleanGroup = groupMatch ? groupMatch[1].replace(/&amp;/g, '&').trim() : 'Independent';
          const cleanType = typeMatch ? typeMatch[1].replace(/&amp;/g, '&').trim() : 'C64 Release';
          const filename = filenameMatch ? decodeURIComponent(filenameMatch[1].split('/').pop()) : `${cleanTitle}.prg`;

          if (rawDl) {
            items.push({
              title: cleanTitle,
              group: cleanGroup,
              type: cleanType,
              link: link.replace(/&amp;/g, '&'),
              downloadUrl: rawDl,
              filename: filename,
              system: 'c64'
            });
          }
        }
        if (items.length > 0) {
          csdbCache = {
            timestamp: now,
            items: items
          };
        }
      }
    } catch (e) {
      console.warn('[CSDb Service] Error fetching RSS (using curated fallback):', e.message);
      if (csdbCache.items.length === 0) {
        csdbCache = {
          timestamp: now,
          items: C64_CURATED_SCENE
        };
      }
    }
  }

  let results = csdbCache.items.length > 0 ? csdbCache.items : C64_CURATED_SCENE;
  if (query) {
    const q = query.toLowerCase().trim();
    const altQ = q.includes('kikstart') ? 'kickstart' : (q.includes('kickstart') ? 'kikstart' : null);
    results = results.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.group.toLowerCase().includes(q) || 
      item.type.toLowerCase().includes(q) ||
      (altQ && item.title.toLowerCase().includes(altQ))
    );
  }
  return results;
}

const PLUS4_WORLD_BASE = 'http://plus4world.powweb.com';
const PLUS4_INDEX_FILE = path.join(SCENE_CACHE_DIR, '.plus4world_index.json');
const PLUS4_INDEX_TTL_MS = 7 * 24 * 3600 * 1000;
const SCENE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
let plus4Index = null; // [{ title, slug, meta }]
let plus4IndexPromise = null;
const plus4DownloadCache = new Map(); // slug -> { downloadUrl, filename } | null

function decodeHtml(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

async function fetchPlus4Text(urlPath) {
  const res = await fetch(PLUS4_WORLD_BASE + urlPath, { headers: { 'User-Agent': SCENE_UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${urlPath}`);
  return res.text();
}

// Builds (and caches for a week) the full A-Z title index of Plus/4 World's game list
async function loadPlus4Index() {
  if (plus4Index) return plus4Index;
  try {
    if (fs.existsSync(PLUS4_INDEX_FILE)) {
      const cached = JSON.parse(fs.readFileSync(PLUS4_INDEX_FILE, 'utf8'));
      if (cached && Array.isArray(cached.items) && cached.items.length > 0 && Date.now() - cached.timestamp < PLUS4_INDEX_TTL_MS) {
        plus4Index = cached.items;
        return plus4Index;
      }
    }
  } catch (e) {}
  if (!plus4IndexPromise) {
    plus4IndexPromise = (async () => {
      const seen = new Map();
      const letters = ['0', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
      await Promise.all(letters.map(async (letter) => {
        try {
          const html = await fetchPlus4Text(`/games/${letter}`);
          const re = /<a href="\/software\/([^"]+)" title="Details of ([^"]*)">[^<]*<\/a><br>([^<]*)</g;
          let m;
          while ((m = re.exec(html)) !== null) {
            if (!seen.has(m[1])) seen.set(m[1], { title: decodeHtml(m[2]), slug: m[1], meta: decodeHtml(m[3]).trim() });
          }
        } catch (e) {
          console.warn(`[Scene Vault] Plus/4 World index letter ${letter} failed: ${e.message}`);
        }
      }));
      const items = Array.from(seen.values());
      if (items.length > 0) {
        plus4Index = items;
        try { fs.writeFileSync(PLUS4_INDEX_FILE, JSON.stringify({ timestamp: Date.now(), items })); } catch (e) {}
      }
      return items;
    })().finally(() => { plus4IndexPromise = null; });
  }
  return plus4IndexPromise;
}

// Finds the .prg/.d64 link on a software detail page
async function resolvePlus4Download(slug) {
  if (plus4DownloadCache.has(slug)) return plus4DownloadCache.get(slug);
  let result = null;
  try {
    const html = await fetchPlus4Text(`/software/${slug}`);
    const links = Array.from(html.matchAll(/href="(\/dl\/(?:games|demos|applications|apps|utilities|tools)\/[^"]+\.(?:prg|d64|tap))"/gi)).map(m => m[1]);
    const pick = links.find(l => /\.prg$/i.test(l)) || links[0];
    if (pick) result = { downloadUrl: PLUS4_WORLD_BASE + pick, filename: pick.split('/').pop() };
  } catch (e) {
    console.warn(`[Scene Vault] Plus/4 World detail ${slug} failed: ${e.message}`);
  }
  plus4DownloadCache.set(slug, result);
  return result;
}

export async function getPlus4WorldReleases(query = '') {
  const q = (query || '').toLowerCase().trim();
  let curated = PLUS4_HALL_OF_FAME;
  if (q) {
    curated = curated.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q) ||
      item.genre.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }
  if (!q) return curated;

  // Live search across the full Plus/4 World games catalogue
  let live = [];
  try {
    const index = await loadPlus4Index();
    const terms = q.split(/\s+/).filter(Boolean);
    const curatedSlugs = new Set(curated.map(c => (c.infoUrl || '').split('/').pop()));
    const matches = index
      .filter(it => !curatedSlugs.has(it.slug) && terms.every(t => it.title.toLowerCase().includes(t)))
      .slice(0, 25);
    const resolved = await Promise.all(matches.map(async (it) => {
      const dl = await resolvePlus4Download(it.slug);
      if (!dl) return null;
      return {
        title: it.title,
        author: it.meta || 'Plus/4 World',
        year: (it.meta.match(/(19|20)\d\d/) || [''])[0],
        genre: 'Plus/4 World',
        system: 'plus4',
        downloadUrl: dl.downloadUrl,
        infoUrl: `${PLUS4_WORLD_BASE}/software/${it.slug}`,
        filename: dl.filename,
        description: ''
      };
    }));
    live = resolved.filter(Boolean);
  } catch (e) {
    console.warn('[Scene Vault] Plus/4 World live search failed:', e.message);
  }
  return curated.concat(live);
}

export async function getDemosceneReleases(platform = 'all', query = '') {
  let list = DEMOSCENE_HALL_OF_FAME;
  if (!query) {
    if (platform && platform !== 'all') {
      list = list.filter(item => item.platform === platform);
    }
    return list;
  }

  const q = query.toLowerCase().trim();
  const curatedMatches = list.filter(item => 
    item.title.toLowerCase().includes(q) || 
    item.author.toLowerCase().includes(q) || 
    (item.party && item.party.toLowerCase().includes(q)) ||
    (item.notes && item.notes.toLowerCase().includes(q))
  );

  const seenKeys = new Set(curatedMatches.map(c => `${c.title}::${c.author}`.toLowerCase()));
  const liveResults = [];

  // Parallel live queries to Pouët and Demozoo
  await Promise.allSettled([
    // 1. Live Pouët API query
    (async () => {
      try {
        const pRes = await fetch(`https://api.pouet.net/v1/search/prod/?q=${encodeURIComponent(query.trim())}`, {
          headers: { 'User-Agent': 'AmigaEmulatorXR/1.0 (Commodore Demoscene Browser)' },
          signal: AbortSignal.timeout(8000)
        });
        if (pRes.ok) {
          const pJson = await pRes.json();
          if (pJson && pJson.success && pJson.results) {
            for (const [id, item] of Object.entries(pJson.results)) {
              const plats = Object.values(item.platforms || {});
              const platNames = plats.map(p => p.name).join(', ');
              const lowerPlats = platNames.toLowerCase();

              let sys = null;
              if (lowerPlats.includes('c64') || lowerPlats.includes('commodore 64')) sys = 'c64';
              else if (lowerPlats.includes('c128') || lowerPlats.includes('128')) sys = 'c128';
              else if (lowerPlats.includes('plus/4') || lowerPlats.includes('c16')) sys = 'plus4';
              else if (lowerPlats.includes('vic') || lowerPlats.includes('vic-20')) sys = 'vic20';
              else if (lowerPlats.includes('aga')) sys = 'aga';
              else if (lowerPlats.includes('amiga') || lowerPlats.includes('ocs') || lowerPlats.includes('ecs')) sys = 'amiga';

              // Filter out platforms that are not Commodore (e.g. MS-DOS, Atari ST, PC, Spectrum)
              if (!sys) continue;

              const title = item.name || '';
              const author = item.groups && item.groups.length ? item.groups.map(g => g.name).join(', ') : 'Scene Group';
              const key = `${title}::${author}`.toLowerCase();
              if (seenKeys.has(key)) continue;
              seenKeys.add(key);

              let dlUrl = item.download || '';
              if (dlUrl.includes('files.scene.org/view/')) {
                dlUrl = dlUrl.replace('/view/', '/get/');
              }

              let filename = '';
              if (dlUrl) {
                try {
                  const u = new URL(dlUrl);
                  filename = u.pathname.split('/').pop();
                } catch(e) {}
              }
              if (!filename) {
                const ext = sys === 'plus4' ? '.prg' : (sys === 'c64' || sys === 'c128' ? '.d64' : '.adf');
                filename = `${title.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}${ext}`;
              }

              liveResults.push({
                title: title,
                author: author,
                platform: sys,
                year: item.releaseDate ? item.releaseDate.slice(0, 4) : (item.party_year || ''),
                party: item.party ? `${item.party.name || ''} ${item.party_year || ''}`.trim() : (item.type || 'Demo'),
                pouetUrl: `https://www.pouet.net/prod.php?which=${id}`,
                demozooUrl: item.demozoo ? `https://demozoo.org/productions/${item.demozoo}/` : '',
                downloadUrl: dlUrl,
                filename: filename,
                notes: `${(item.type ? item.type.toUpperCase() : 'DEMO')} • ${platNames || 'Commodore'}`
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Pouet Search] Live search failed:', err.message);
      }
    })(),

    // 2. Live Demozoo API query
    (async () => {
      try {
        const dRes = await fetch(`https://demozoo.org/api/v1/productions/?title=${encodeURIComponent(query.trim())}`, {
          headers: { 'User-Agent': 'AmigaEmulatorXR/1.0 (Commodore Demoscene Browser)' },
          signal: AbortSignal.timeout(8000)
        });
        if (dRes.ok) {
          const dJson = await dRes.json();
          if (dJson && dJson.results && Array.isArray(dJson.results)) {
            for (const item of dJson.results) {
              const plats = (item.platforms || []).map(p => p.name);
              const platNames = plats.join(', ');
              const lowerPlats = platNames.toLowerCase();

              let sys = null;
              if (lowerPlats.includes('c64') || lowerPlats.includes('commodore 64')) sys = 'c64';
              else if (lowerPlats.includes('c128') || lowerPlats.includes('128')) sys = 'c128';
              else if (lowerPlats.includes('plus/4') || lowerPlats.includes('c16')) sys = 'plus4';
              else if (lowerPlats.includes('vic') || lowerPlats.includes('vic-20')) sys = 'vic20';
              else if (lowerPlats.includes('aga')) sys = 'aga';
              else if (lowerPlats.includes('amiga') || lowerPlats.includes('ocs') || lowerPlats.includes('ecs')) sys = 'amiga';

              // Filter out platforms that are not Commodore
              if (!sys) continue;

              const title = item.title || '';
              const author = item.author_nicks && item.author_nicks.length ? item.author_nicks.map(a => a.name).join(', ') : 'Scene Group';
              const key = `${title}::${author}`.toLowerCase();
              if (seenKeys.has(key)) continue;
              seenKeys.add(key);

              const ext = sys === 'plus4' ? '.prg' : (sys === 'c64' || sys === 'c128' ? '.d64' : '.adf');
              const filename = `${title.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}${ext}`;

              liveResults.push({
                title: title,
                author: author,
                platform: sys,
                year: item.release_date ? item.release_date.slice(0, 4) : '',
                party: (item.types && item.types.length ? item.types[0].name : 'Demo'),
                pouetUrl: '',
                demozooUrl: item.demozoo_url || `https://demozoo.org/productions/${item.id}/`,
                downloadUrl: '',
                demozooId: item.id,
                filename: filename,
                notes: `${(item.types ? item.types.map(t => t.name).join(', ') : 'Demo')} • ${platNames || 'Commodore'}`
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Demozoo Search] Live search failed:', err.message);
      }
    })()
  ]);

  let combined = curatedMatches.concat(liveResults);
  if (platform && platform !== 'all') {
    combined = combined.filter(item => {
      if (platform === 'amiga') return item.platform === 'amiga' || item.platform === 'aga';
      return item.platform === platform;
    });
  }
  return combined;
}

export function getC128Releases(query = '') {
  let list = C128_HALL_OF_FAME;
  if (query) {
    const q = query.toLowerCase().trim();
    const altQ = q.includes('kikstart') ? 'kickstart' : (q.includes('kickstart') ? 'kikstart' : null);
    list = list.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.author.toLowerCase().includes(q) || 
      item.genre.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (altQ && (item.title.toLowerCase().includes(altQ) || (item.description && item.description.toLowerCase().includes(altQ))))
    );
  }
  return list;
}

export async function downloadSceneDisk(url, title, system = 'c64', preferredName = '', localRel = '') {
  if (localRel) {
    const candidatePath = path.join('C:/Users/adria/Desktop/Amiga Emulator', localRel);
    if (fs.existsSync(candidatePath)) {
      return {
        success: true,
        file: path.basename(candidatePath),
        relPath: localRel,
        fullPath: candidatePath,
        system: system,
        title: title
      };
    }
  }

  // Auto-convert scene.org view pages to direct file downloads
  let downloadUrl = url || '';
  if (downloadUrl.includes('files.scene.org/view/')) {
    downloadUrl = downloadUrl.replace('/view/', '/get/');
  }

  if (!downloadUrl && preferredName && preferredName.startsWith('demozoo:')) {
    const dzId = preferredName.split(':')[1];
    try {
      const dzRes = await fetch(`https://demozoo.org/api/v1/productions/${dzId}/`, {
        headers: { 'User-Agent': 'AmigaEmulatorXR/1.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (dzRes.ok) {
        const dzJson = await dzRes.json();
        const dls = dzJson.download_links || [];
        const pick = dls.find(d => /\.(zip|adf|dms|d64|prg)$/i.test(d.url)) || dls[0];
        if (pick && pick.url) {
          downloadUrl = pick.url.replace('files.scene.org/view/', 'files.scene.org/get/');
        }
      }
    } catch(e) {
      console.warn('[Scene Vault] Demozoo detail fetch error:', e.message);
    }
  }

  if (!downloadUrl) throw new Error('Missing download URL for scene item');

  let filename = preferredName && !preferredName.startsWith('demozoo:') ? preferredName : title.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  if (!filename.includes('.')) {
    let urlExt = '';
    try {
      const uPath = new URL(downloadUrl).pathname;
      const m = uPath.match(/\.(zip|adf|dms|d64|prg|lha)$/i);
      if (m) urlExt = m[0].toLowerCase();
    } catch(e) {}
    filename += urlExt || (system === 'plus4' ? '.prg' : (system === 'c128' || system === 'c64' ? '.d64' : '.adf'));
  }

  const localPath = path.join(SCENE_CACHE_DIR, filename);
  const relPath = `scene/${filename}`;

  // If already cached locally, return immediately
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 100) {
    return {
      success: true,
      file: filename,
      relPath: `__public__/scene/${filename}`,
      fullPath: localPath,
      system: system,
      title: title
    };
  }

  console.log(`[Scene Vault] Downloading ${title} from ${downloadUrl}...`);
  const res = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    redirect: 'follow'
  });

  if (!res.ok) {
    throw new Error(`Failed to download: HTTP ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  let buffer = Buffer.from(arrayBuf);

  // If server provided filename in content-disposition, check format
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const fnMatch = disposition.match(/filename\*?=(?:UTF-8'')?[\x22']?([^;\x22']+)[\x22']?/i);
    if (fnMatch && fnMatch[1]) {
      const serverFn = decodeURIComponent(fnMatch[1].trim());
      if (serverFn) {
        filename = serverFn.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      }
    }
  }

  const finalPath = path.join(SCENE_CACHE_DIR, filename);
  fs.writeFileSync(finalPath, buffer);
  console.log(`[Scene Vault] Successfully cached: ${finalPath} (${buffer.length} bytes)`);

  return {
    success: true,
    file: filename,
    relPath: `__public__/scene/${filename}`,
    fullPath: finalPath,
    system: system,
    title: title
  };
}
