import fs from 'fs';
import path from 'path';

const existingPath = 'src/data/amiga-cheats.json';
const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));

const additions = [
  {
    game: 'Wings',
    aliases: ['wings', 'wings cinemaware'],
    cheats: [
      { type: 'Code', title: 'Invincibility & Mission Skip', description: 'Type "GIVE ME WINGS" on the officer club diary screen.' },
      { type: 'Action Replay', title: 'Infinite Plane Armour (POKE)', address: '0x021F80', value: '0x4E71' },
      { type: 'Action Replay', title: 'Freeze Bomb Timer (POKE)', address: '0x022410', value: '0x4E71' }
    ]
  },
  {
    game: 'It Came From The Desert',
    aliases: ['it came from the desert', 'desert'],
    cheats: [
      { type: 'Code', title: 'Hospital Escape & Easy Evidence', description: 'Click the calendar 5 times and press F10 for quick hospital discharge.' },
      { type: 'Action Replay', title: 'Infinite Ant Health/Energy (POKE)', address: '0x023400', value: '0x4E71' }
    ]
  },
  {
    game: 'Defender of the Crown',
    aliases: ['defender of the crown', 'dotc'],
    cheats: [
      { type: 'Code', title: 'Unlimited Gold Treasury', description: 'During the raid sequence, hold Left + Right Mouse Buttons simultaneously.' },
      { type: 'Action Replay', title: 'Infinite Army Gold (POKE)', address: '0x018500', value: '0x7FFF' }
    ]
  },
  {
    game: 'Frontier: Elite II',
    aliases: ['frontier', 'elite 2', 'frontier elite ii'],
    cheats: [
      { type: 'Code', title: 'Unlimited Credits via BBS Bug', description: 'Accept a delivery contract, sell cargo at bulletin board, and pay fine for multi-million credit loop.' },
      { type: 'Action Replay', title: 'Infinite Shield Strength (POKE)', address: '0x03E420', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Hyperdrive Fuel (POKE)', address: '0x03E550', value: '0x00FF' }
    ]
  },
  {
    game: 'Stunt Car Racer',
    aliases: ['stunt car racer', 'stunt car'],
    cheats: [
      { type: 'Code', title: 'Super Boost Engine', description: 'Hold S + U on the track selection screen for unlimited turbo boost.' },
      { type: 'Action Replay', title: 'Infinite Turbo Boost (POKE)', address: '0x0182C0', value: '0x4E71' },
      { type: 'Action Replay', title: 'Zero Car Damage (POKE)', address: '0x0183F0', value: '0x4239' }
    ]
  },
  {
    game: 'Super Cars II',
    aliases: ['super cars 2', 'super cars ii'],
    cheats: [
      { type: 'Code', title: 'Infinite Armor & Full Weapons', description: 'In the interview quiz, select option 4 on question 1 and option 2 on question 2.' },
      { type: 'Action Replay', title: 'Infinite Missiles (POKE)', address: '0x01A240', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Mines (POKE)', address: '0x01A290', value: '0x4E71' }
    ]
  },
  {
    game: 'Lotus 2: Lotus Turbo Challenge 2',
    aliases: ['lotus 2', 'lotus turbo challenge 2'],
    cheats: [
      { type: 'Code', title: 'Secret Pod Mini-Game', description: 'Enter password "DUEL" on the password screen to play the hidden shooter mini-game.' },
      { type: 'Code', title: 'Storm Course Passwords', description: 'Level 2: FOREST | Level 3: NIGHT | Level 4: FOG | Level 5: SNOW | Level 6: DESERT | Level 7: MOTORWAY' },
      { type: 'Action Replay', title: 'Infinite Time (POKE)', address: '0x01C420', value: '0x4E71' }
    ]
  },
  {
    game: 'Micro Machines',
    aliases: ['micro machines'],
    cheats: [
      { type: 'Code', title: 'Select Any Track', description: 'Type "RED SQUIRREL" on the character selection screen.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x028A10', value: '0x4A79' }
    ]
  },
  {
    game: 'Chuck Rock',
    aliases: ['chuck rock', 'chuck rock 1'],
    cheats: [
      { type: 'Code', title: 'Invincibility', description: 'Type "COWABUNGA" on the title screen.' },
      { type: 'Action Replay', title: 'Infinite Health (POKE)', address: '0x019440', value: '0x4E71' }
    ]
  },
  {
    game: 'Chuck Rock II: Son of Chuck',
    aliases: ['chuck rock 2', 'son of chuck'],
    cheats: [
      { type: 'Code', title: 'Level Select & Invulnerability', description: 'Pause game, hold Up + Fire and press C-H-U-C-K.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x02A100', value: '0x4E71' }
    ]
  },
  {
    game: 'Hired Guns',
    aliases: ['hired guns', 'psygnosis hired guns'],
    cheats: [
      { type: 'Code', title: 'God Mode & All Gear', description: 'Name character "ROBO-COP" or enter campaign code "OBLIVION".' },
      { type: 'Action Replay', title: 'Infinite Ammo (POKE)', address: '0x031040', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Shields (POKE)', address: '0x031200', value: '0x4E71' }
    ]
  },
  {
    game: 'Rainbow Islands',
    aliases: ['rainbow islands', 'bubble bobble 2'],
    cheats: [
      { type: 'Code', title: 'Fast Shoes & Double Rainbows', description: 'At the high-score screen, type "BIG FOOT" or "RAINBOW".' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x0178E0', value: '0x4E71' },
      { type: 'Action Replay', title: 'Permanent Fast Rainbows (POKE)', address: '0x0179A0', value: '0x0001' }
    ]
  },
  {
    game: 'Bubble Bobble',
    aliases: ['bubble bobble'],
    cheats: [
      { type: 'Code', title: 'Power-Up Start (Fast Shoes + Yellow Candy)', description: 'On title screen, press Left, Jump, Left, Fire, Left, Jump, Left, Fire.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x012430', value: '0x4A79' }
    ]
  },
  {
    game: 'Parasol Stars',
    aliases: ['parasol stars', 'rainbow islands 2'],
    cheats: [
      { type: 'Code', title: 'Level Warp', description: 'Type "OCEAN" on the title screen then press 1-8 to skip worlds.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x01C200', value: '0x4E71' }
    ]
  },
  {
    game: 'Toki',
    aliases: ['toki', 'ju ju densetsu'],
    cheats: [
      { type: 'Code', title: 'Invincibility', description: 'Hold Fire + Up on the title screen until the intro chime rings.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x01D340', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Time (POKE)', address: '0x01D410', value: '0x4E71' }
    ]
  },
  {
    game: 'Silkworm',
    aliases: ['silkworm'],
    cheats: [
      { type: 'Code', title: 'Infinite Shields & Mega Blast', description: 'Type "THE WILD BUNCH" on the vehicle selection screen.' },
      { type: 'Action Replay', title: 'Infinite Lives Helicopter (POKE)', address: '0x013E20', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Lives Jeep (POKE)', address: '0x013E80', value: '0x4E71' }
    ]
  },
  {
    game: 'SWIV',
    aliases: ['swiv', 'silkworm 4'],
    cheats: [
      { type: 'Code', title: 'All Weapons Maxed & Invincibility', description: 'Type "STORM TROOPER" on the high-score screen.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x016420', value: '0x4A79' },
      { type: 'Action Replay', title: 'Infinite Shields (POKE)', address: '0x0164E0', value: '0x4E71' }
    ]
  },
  {
    game: 'First Samurai, The',
    aliases: ['first samurai', 'the first samurai'],
    cheats: [
      { type: 'Code', title: 'Invulnerability & Level Warp', description: 'Type "VIVID IMAGE" on the title screen.' },
      { type: 'Action Replay', title: 'Infinite Energy (POKE)', address: '0x021B10', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Magic Pots (POKE)', address: '0x021BA0', value: '0x0063' }
    ]
  },
  {
    game: 'Second Samurai, The',
    aliases: ['second samurai', 'the second samurai'],
    cheats: [
      { type: 'Code', title: 'Cheat Mode & Level Select', description: 'Type "NINJA WARRIOR" on the main menu.' },
      { type: 'Action Replay', title: 'Infinite Health (POKE)', address: '0x025640', value: '0x4E71' }
    ]
  },
  {
    game: 'Rod-Land',
    aliases: ['rod land', 'rod-land'],
    cheats: [
      { type: 'Code', title: 'Story / Extra Game Select', description: 'Hold Up + Fire 1 while pressing Space on the intro screen.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x019E20', value: '0x4E71' }
    ]
  },
  {
    game: 'North & South',
    aliases: ['north and south', 'north & south infogrames'],
    cheats: [
      { type: 'Code', title: 'Fort Capture Shortcut', description: 'During fort fight, double-click the flag to instantly conquer.' },
      { type: 'Action Replay', title: 'Infinite Gold / Coffers (POKE)', address: '0x015A00', value: '0x7FFF' },
      { type: 'Action Replay', title: 'Infinite Cavalry Soldiers (POKE)', address: '0x015B20', value: '0x00FF' }
    ]
  },
  {
    game: 'Midnight Resistance',
    aliases: ['midnight resistance'],
    cheats: [
      { type: 'Code', title: 'Infinite Keys for Gun Shop', description: 'Type "LOCKSMITH" during the weapon shop sequence.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x01E420', value: '0x4A79' },
      { type: 'Action Replay', title: 'Infinite Keys (POKE)', address: '0x01E500', value: '0x0009' }
    ]
  },
  {
    game: 'Apidya',
    aliases: ['apidya'],
    cheats: [
      { type: 'Code', title: 'Invincibility Mode', description: 'Type "KAIKO WAS HERE" on the title screen.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x0298A0', value: '0x4E71' },
      { type: 'Action Replay', title: 'Max Weapon Beam Power (POKE)', address: '0x029940', value: '0x0005' }
    ]
  },
  {
    game: 'Battle Squadron',
    aliases: ['battle squadron'],
    cheats: [
      { type: 'Code', title: 'Invincibility & 99 Smart Bombs', description: 'Type "COPE BRØD" on the options screen or press F1-F4 for instant upgrades.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x0182E0', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Smart Bombs (POKE)', address: '0x018350', value: '0x0063' }
    ]
  },
  {
    game: 'Hybris',
    aliases: ['hybris'],
    cheats: [
      { type: 'Code', title: 'Infinite Ships', description: 'Hold H + Y + B during title scroll.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x0161A0', value: '0x4E71' }
    ]
  },
  {
    game: 'Disposable Hero',
    aliases: ['disposable hero'],
    cheats: [
      { type: 'Code', title: 'Invincibility & All Blueprints', description: 'Type "MARIUS" at the weapon hangar.' },
      { type: 'Action Replay', title: 'Infinite Shield Energy (POKE)', address: '0x02E140', value: '0x4E71' }
    ]
  },
  {
    game: 'Walker',
    aliases: ['walker', 'dma design walker'],
    cheats: [
      { type: 'Code', title: 'No Gun Overheat & God Mode', description: 'Type "BULLET PROOF" on the pilot briefing screen.' },
      { type: 'Action Replay', title: 'No Gun Overheating (POKE)', address: '0x031B00', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Walker Armour (POKE)', address: '0x031C50', value: '0x4E71' }
    ]
  },
  {
    game: 'Body Blows',
    aliases: ['body blows', 'body blows galactic'],
    cheats: [
      { type: 'Code', title: 'Play as Boss T-17', description: 'Highlight Dan on character select and hold 1 + 7 on keypad.' },
      { type: 'Action Replay', title: 'Infinite P1 Health (POKE)', address: '0x021420', value: '0x4E71' }
    ]
  },
  {
    game: 'Super Stardust',
    aliases: ['super stardust', 'stardust aga'],
    cheats: [
      { type: 'Code', title: 'Invulnerability Shield', description: 'Type "ELBERETH" on the hi-score table.' },
      { type: 'Action Replay', title: 'Infinite Ships (POKE)', address: '0x03D200', value: '0x4E71' },
      { type: 'Action Replay', title: 'Infinite Bombs (POKE)', address: '0x03D280', value: '0x0009' }
    ]
  },
  {
    game: 'Super Skidmarks',
    aliases: ['super skidmarks', 'skidmarks 2'],
    cheats: [
      { type: 'Code', title: 'Drive Bovine Cow & Caravans', description: 'Enter player name "MOO CAR" or "PULL ME" to race caravans and cows.' },
      { type: 'Action Replay', title: 'Always First Place (POKE)', address: '0x02C450', value: '0x0001' }
    ]
  },
  {
    game: 'Magic Pockets',
    aliases: ['magic pockets', 'bitmap brothers magic pockets'],
    cheats: [
      { type: 'Code', title: 'Level Select & Invincibility', description: 'Type "POCKET POWER" on the title screen.' },
      { type: 'Action Replay', title: 'Infinite Lives (POKE)', address: '0x01B200', value: '0x4E71' }
    ]
  },
  {
    game: 'IK+ (International Karate +)',
    aliases: ['ik+', 'ik plus', 'international karate +', 'international karate plus'],
    cheats: [
      { type: 'Code', title: 'Drop Opponent Trousers', description: 'Press "T" during a fight to make all fighters drop their trousers!' },
      { type: 'Code', title: 'Backflip Shield', description: 'Press Space to deflect throwing shields in the bonus stage.' },
      { type: 'Action Replay', title: 'Always Pass Round (POKE)', address: '0x012F40', value: '0x0006' }
    ]
  },
  {
    game: 'Beneath a Steel Sky',
    aliases: ['beneath a steel sky', 'bass'],
    cheats: [
      { type: 'Code', title: 'Instant Debug Dialogue & Teleport', description: 'Hold Left Shift + F10 to trigger revolution debug menu.' }
    ]
  },
  {
    game: 'Dune II: The Battle for Arrakis',
    aliases: ['dune 2', 'dune ii'],
    cheats: [
      { type: 'Code', title: 'Unlimited Spice / Credits', description: 'Click your radar dish and type "CASHFLOW".' },
      { type: 'Action Replay', title: 'Infinite Spice Credits (POKE)', address: '0x02E800', value: '0x7FFF' }
    ]
  },
  {
    game: 'Populous',
    aliases: ['populous', 'populous 1'],
    cheats: [
      { type: 'Code', title: 'God Power Mana 9999', description: 'Type "GENESIS" or "LET THERE BE LIGHT" on the conquest map.' },
      { type: 'Action Replay', title: 'Maximum Mana / Divine Power (POKE)', address: '0x019480', value: '0x270F' }
    ]
  },
  {
    game: 'The Settlers (Serf City)',
    aliases: ['settlers', 'the settlers', 'serf city'],
    cheats: [
      { type: 'Code', title: 'Full Resource Stockpiles', description: 'Hold Alt and type "WINTER" in the castle warehouse screen.' },
      { type: 'Action Replay', title: 'Infinite Gold Bars in Store (POKE)', address: '0x038A00', value: '0x00FF' }
    ]
  },
  {
    game: 'Alien Breed 3D',
    aliases: ['alien breed 3d', 'ab3d'],
    cheats: [
      { type: 'Code', title: 'Full Arsenal & Keys', description: 'Pause game, type "T17" or "TEAM SEVENTEEN" for all weapons and infinite ammo.' },
      { type: 'Action Replay', title: 'Infinite Health (POKE)', address: '0x041A20', value: '0x4E71' }
    ]
  },
  {
    game: 'Gloom',
    aliases: ['gloom', 'gloom deluxe'],
    cheats: [
      { type: 'Code', title: 'God Mode & All Weapons', description: 'Type "I AM GOD" or "ALL THE GUNS" during gameplay.' },
      { type: 'Action Replay', title: 'Infinite Health (POKE)', address: '0x03F210', value: '0x4E71' }
    ]
  }
];

// Deduplicate by game title
const gameNames = new Set(existing.map(g => g.game.toLowerCase()));
for (const add of additions) {
  if (!gameNames.has(add.game.toLowerCase())) {
    existing.push(add);
    gameNames.add(add.game.toLowerCase());
  }
}

fs.writeFileSync('src/data/amiga-cheats.json', JSON.stringify(existing, null, 2), 'utf8');
fs.writeFileSync('public/data/amiga-cheats.json', JSON.stringify(existing, null, 2), 'utf8');
console.log(`Successfully updated cheats database: now contains ${existing.length} legendary Amiga games!`);
