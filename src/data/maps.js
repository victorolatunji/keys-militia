// Each map is a config. Layout, spawn points and where the hazards are live
// in the Tiled file; everything else (void, sky, colors) lives here. How
// hazards behave is shared by every map (src/data/hazards.js).
//
// Tiled layers: "ground" (tiles, every painted tile is solid), "spawns"
// (points: player, dummy, bot), and optional "hazards" and "decor".
// Bots drop in at "bot" points (and the player / dummy points).
// Each map has its own layout, rules, hazards and advantages; the Forest and
// Hell files are made by tools/make-maps.mjs (then editable in Tiled).

// Tile ids in the Forest/Hell tilesets -> which part of the palette they
// are (for debris chips knocked off walls). Rounded corner tiles share
// their family's color.
export const TILE_FAMILY = {
  1: 'top', 8: 'top', 9: 'top', 10: 'top',
  2: 'soil', 3: 'deep',
  4: 'sand', 14: 'sand', 15: 'sand', 16: 'sand',
  5: 'plank', 26: 'plank', // 26: invisible solid (under a drawn roof)
  6: 'under', 17: 'under', 18: 'under', 19: 'under',
  7: 'rock', 11: 'rock', 12: 'rock', 13: 'rock',
  20: 'ice', 21: 'ice', 22: 'ice', 23: 'ice',
  24: 'thin',
  25: 'crumble',
};

// Tile families you slide on (see ICE in hazards.js).
export const SLIPPERY = new Set(['ice', 'thin']);

// Testing: F6 switches to the next map (remembered in this browser), or
// open the game with ?map= and a map's key (forest, hell, glacier, desert,
// catacombs, graveyard, monastery, wastelands, test).
export const MAP_SELECT = {
  order: ['forest', 'hell', 'glacier', 'desert', 'catacombs', 'graveyard', 'monastery', 'wastelands', 'skyislands', 'space', 'test'],
  default: 'forest',
  key: 'F6',
  storageKey: 'keys-militia.map',
};

export const MAPS = {
  test: {
    key: 'test',
    name: 'Test Map',
    background: '#1a1a2e',

    // Tiled files (in public/assets)
    tilemapKey: 'map-test',
    tilemapFile: 'assets/maps/test.json',
    tilesetName: 'placeholder',         // tileset name inside Tiled
    tilesetKey: 'tiles-placeholder',
    tilesetFile: 'assets/tilesets/placeholder-tiles.png',

    // Enemies in this map: how many of each spawn slot (see SPAWNER in
    // enemies.js) and which families the main slots rotate through.
    // They drop in from the sky above a spawn point far from you.
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { military: 2, undead: 1, scifi: 1 }, // how often each family comes (weights)
    },

    // The void under every map.
    void: {
      top: 1240,          // where the darkness starts
      deathY: 1380,       // cross this line and you die
      color: 0x05050f,    // darkness color
      glowColor: 0x9d4edd // rising mist color
    },
  },
  // Forest ("Riverbend"): a cliff with a cave tunnel, a waterfall into a
  // lake, a meadow with boulders and a treehouse, a chasm, a rocky highland
  // with a pond, root caverns and islands underneath.
  // Rules: water slows you; fully under it you're hidden but drown slowly.
  // The waterfall pushes you down. Advantage: hide under water or in bushes.
  forest: {
    key: 'forest',
    name: 'Forest',
    background: '#8ecae6',
    tilemapKey: 'map-forest',
    tilemapFile: 'assets/maps/forest.json',
    tilesetName: 'forest-tiles',
    tilesetKey: 'tiles-forest',
    tilesetFile: 'assets/tilesets/forest-tiles.png',
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { military: 5, scifi: 1, undead: 1 }, // how often each family comes (weights)
    },
    // Backdrop (BackdropSystem): sky colors top to bottom, the sun, clouds,
    // two rows of hills (far, near) and birds.
    sky: {
      colors: [0x2f3e46, 0x52616b, 0x84898f, 0x9a9e94, 0x4a5a52], // overcast, smoke in the air
      sun: { color: 0xe9d8a6, x: 0.78, y: 0.12, size: 0.8 },
      clouds: { count: 10, color: 0xa0a4a8 },
      war: { smoke: 3 },
      mist: { color: 0xdfe6e9, alpha: 0.1 },
      ridges: [
        { color: 0x95d5b2, factor: 0.1, height: 220, rough: 0.5 },
        { color: 0x52b788, factor: 0.22, height: 170, rough: 0.8, trees: true },
      ],
      birds: true,
      leaves: true,          // leaves drifting down
      horizonY: 1152,        // the main level (where the hills line up)
    },
    water: { color: 0x0096c7, deepColor: 0x023e8a, surfaceColor: 0xade8f4, fish: true },
    // Colors chipped off walls when they're hit (see TILE_FAMILY).
    palette: { top: 0x52b788, soil: 0x7f5539, deep: 0x6c757d, sand: 0xe9c46a, plank: 0xa47148, under: 0x6f4518, rock: 0x8d99ae },
    void: {
      top: 2240,
      deathY: 2400,
      color: 0x03045e,
      glowColor: 0x90e0ef,
    },
  },

  // Hell ("Inferno"): a spiked basalt plateau with a lava pit, a volcano with
  // a lava crater and a tunnel through it, floating rock steps with a hot
  // spring and a lava fall, broken islands over a lava sea.
  // Rules: lava burns (fully in it you melt, a bit faster than drowning),
  // geysers erupt. Advantage: heat vents refill your jetpack; hide in the spring.
  hell: {
    key: 'hell',
    name: 'Hell',
    background: '#2b0a0a',
    tilemapKey: 'map-hell',
    tilemapFile: 'assets/maps/hell.json',
    tilesetName: 'hell-tiles',
    tilesetKey: 'tiles-hell',
    tilesetFile: 'assets/tilesets/hell-tiles.png',
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { undead: 3, military: 2, scifi: 2 }, // how often each family comes (weights)
    },
    sky: {
      colors: [0x0b0203, 0x2b0a0a, 0x6a040f, 0x9d0208, 0xdc2f02],
      sun: null,
      war: { smoke: 2, smokeColor: 0x1b1b1b },
      clouds: { count: 7, color: 0x7d7d7d }, // smoke drifting (darkened white)
      ridges: [
        { color: 0x370617, factor: 0.1, height: 260, rough: 1, spiky: true },
        { color: 0x1a0505, factor: 0.22, height: 200, rough: 1.2, spiky: true },
      ],
      embers: true,
      horizonY: 1344,
    },
    water: { color: 0x7b2cbf, deepColor: 0x240046, surfaceColor: 0xe0aaff, alpha: 0.6 }, // hot spring
    palette: { top: 0xff6b35, soil: 0x3d2b2b, deep: 0x1b1423, sand: 0x6b5b55, plank: 0x5c5c66, under: 0x2b1d1d, rock: 0x4a2c2a },
    void: {
      top: 2480,
      deathY: 2640,
      color: 0x370000,
      glowColor: 0xff5400,
      lava: true,                    // a lava sea instead of darkness
      deathMessage: 'Fell into the lava',
    },
  },
  // Glacier ("Frostbite"): no void. The whole glacier floats on an endless
  // icy sea. A snowy peak with an icicle cave and a sea cave, a frozen lake
  // with thin spots, a chasm with floes, a slippery glacier with crevasses
  // down to the sea, a grotto, an icicle overhang, igloos, penguins.
  // Rules: ice is slippery; thin spots break under anyone (and blasts smash
  // them) into freezing water. The sea: swim, but sink too deep and you die.
  // Advantage: icicles (type the word to drop one); hide in an igloo.
  glacier: {
    key: 'glacier',
    name: 'Glacier',
    background: '#bde0fe',
    tilemapKey: 'map-glacier',
    tilemapFile: 'assets/maps/glacier.json',
    tilesetName: 'glacier-tiles',
    tilesetKey: 'tiles-glacier',
    tilesetFile: 'assets/tilesets/glacier-tiles.png',
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { military: 4, scifi: 2, undead: 1 }, // how often each family comes (weights)
    },
    sky: {
      colors: [0x1b263b, 0x415a77, 0x8fa9bf, 0xc5d3df, 0x778da9], // colder, greyer
      sun: { color: 0xfffbe6, x: 0.2, y: 0.14, size: 0.8 },
      war: { smoke: 2 },
      clouds: { count: 8, color: 0xf8f9fa },
      ridges: [
        { color: 0xc8d6e5, factor: 0.1, height: 280, rough: 1, spiky: true, snowCaps: true },
        { color: 0x8da9c4, factor: 0.22, height: 210, rough: 1.1, spiky: true, snowCaps: true },
      ],
      aurora: true,       // green lights waving high up
      snow: true,         // snow falling
      bergs: true,        // icebergs on the far sea, whales spouting
      horizonY: 1152,
    },
    water: { color: 0x48cae4, deepColor: 0x0077b6, surfaceColor: 0xe0fbfc, freezing: true },
    critters: 'penguin',   // penguins waddling about (they flee from you and from blasts)
    palette: { top: 0xf8f9fa, soil: 0x5c677d, deep: 0x33415c, sand: 0xdee2e6, plank: 0x7f5539, under: 0x3a506b, rock: 0x7d8597, ice: 0xa8dadc, thin: 0xcaf0f8, cave: 0x1b263b },
    // The icy sea instead of the void: it starts at the sea level (1728,
    // a "sea" rectangle in the Tiled file); the deep goes dark below it and
    // past deathY you're gone.
    void: {
      top: 1800,
      deathY: 2110,
      color: 0x03045e,
      glowColor: 0x90e0ef,
      sea: true,
      deathMessage: 'Sank into the icy deep',
    },
  },

  // Desert ("Dune Sea"): dunes with quicksand, a mesa with an arch through
  // it, an oasis, a buried temple with a pillared chamber, islands below.
  // Rules: quicksand pulls you down (fully under it you suffocate, slowly;
  // jetpack or jump out); cacti prick; dust devils wander and toss you about.
  // Advantage: sandstorms roll through and hide you from far
  // away (words only show close up, for everyone). Hide in the oasis.
  desert: {
    key: 'desert',
    name: 'Desert',
    background: '#f6bd60',
    tilemapKey: 'map-desert',
    tilemapFile: 'assets/maps/desert.json',
    tilesetName: 'desert-tiles',
    tilesetKey: 'tiles-desert',
    tilesetFile: 'assets/tilesets/desert-tiles.png',
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { military: 4, scifi: 2, undead: 1 }, // how often each family comes (weights)
    },
    sky: {
      colors: [0x7f5539, 0xb08968, 0xddb892, 0xe6ccb2, 0x9c6644], // dusty haze
      sun: { color: 0xffe8a3, x: 0.75, y: 0.12, size: 1.2 },
      war: { smoke: 3 },
      clouds: { count: 4, color: 0xfffaf0 },
      ridges: [
        { color: 0xe9c46a, factor: 0.1, height: 200, rough: 0.4 },
        { color: 0xd08c60, factor: 0.22, height: 230, rough: 0.3, mesa: true },
      ],
      camels: true,          // a camel caravan walking along the far dunes
      haze: true,            // heat shimmer over the sand
      tumbleweeds: true,
      horizonY: 1120,
    },
    water: { color: 0x2a9d8f, deepColor: 0x1d3557, surfaceColor: 0xa8dadc },
    palette: { top: 0xf4d58d, soil: 0xd08c60, deep: 0x9c6644, sand: 0xedc988, plank: 0x8d5a2b, under: 0xb5703f, rock: 0xc9743a, cave: 0x3d2314 },
    sandstorm: true,
    critters: 'scorpion',  // scorpions skittering about (harmless)
    void: {
      top: 2304,
      deathY: 2450,
      color: 0x2b1a10,
      glowColor: 0xf6bd60,
    },
  },
  // Catacombs: enclosed. Rock pieces everywhere (roof, walls, floors), no
  // void, a black background. Three levels of tunnels joined by shafts and
  // two long ramps, burial niches with coffins, ossuaries, a flooded crypt.
  // Hazard: boulders roll down the ramps now and then (warning rumble
  // first): they hurt and knock you flying, and can kill, but not outright.
  // Advantage: a lever at the top of each ramp shows a word: type it to send
  // the boulder down early, onto the enemies in its path. Tight tunnels for
  // ambushes; hide in the flooded crypt.
  catacombs: {
    key: 'catacombs',
    name: 'Catacombs',
    background: '#000000',
    enclosed: true,
    tilemapKey: 'map-catacombs',
    tilemapFile: 'assets/maps/catacombs.json',
    tilesetName: 'catacombs-tiles',
    tilesetKey: 'tiles-catacombs',
    tilesetFile: 'assets/tilesets/catacombs-tiles.png',
    enemies: {
      slots: { main: 3, machine: 1, animal: 1 }, // one more: one jetpack shooter is always among the mains,
      families: { undead: 3, military: 2, scifi: 1 }, // how often each family comes (weights)
      groundFighters: true, // walkers and leapers (zombies, skeletons, mutants, K9s, Scrap Bots) fight here...
      walkerBoost: 4,       // ...and come more often than the jetpack shooters (who still come plenty)
    },
    sky: { colors: [0x000000, 0x000000], horizonY: 400, dust: true }, // just black, with dust drifting
    water: { color: 0x2a4d4f, deepColor: 0x0b1d1e, surfaceColor: 0x84a59d, alpha: 0.7 },
    palette: { top: 0x7d746a, soil: 0x6b6259, deep: 0x564f48, sand: 0x777069, plank: 0x5c4033, under: 0x5e5650, rock: 0x8a8278, cave: 0x0d0c0b },
    void: null,          // no void: the floor is solid
  },

  // Graveyard: night under a big moon. Solid ground (no void). A hill of
  // tombstones, a chapel with a bell tower, iron fences, dead trees, open
  // graves down into a crypt, fog along the ground, bats.
  // Hazard: hands burst out of the ground where you stand and grab you
  // (held in place a moment, a little damage); they grab bots too.
  // Advantage: tombstones block bullets; ring the bell (type its word) to
  // daze every enemy near the chapel.
  graveyard: {
    key: 'graveyard',
    name: 'Graveyard',
    background: '#0b132b',
    tilemapKey: 'map-graveyard',
    tilemapFile: 'assets/maps/graveyard.json',
    tilesetName: 'graveyard-tiles',
    tilesetKey: 'tiles-graveyard',
    tilesetFile: 'assets/tilesets/graveyard-tiles.png',
    enemies: {
      slots: { main: 3, machine: 1, animal: 1 }, // one more: one jetpack shooter is always among the mains,
      families: { undead: 3, military: 2, scifi: 1 }, // how often each family comes (weights)
      groundFighters: true, // walkers and leapers (zombies, skeletons, mutants, K9s, Scrap Bots) fight here...
      walkerBoost: 4,       // ...and come more often than the jetpack shooters (who still come plenty)
    },
    sky: {
      colors: [0x03071e, 0x0b132b, 0x1c2541, 0x3a506b, 0x1c2541],
      war: { smoke: 2, smokeColor: 0x2b2d42 },
      moon: { color: 0xf1faee, x: 0.7, y: 0.16 },
      clouds: { count: 6, color: 0x5c677d },
      ridges: [
        { color: 0x1c2541, factor: 0.1, height: 200, rough: 0.6 },
        { color: 0x0b132b, factor: 0.22, height: 160, rough: 0.9, trees: true },
      ],
      bats: true,
      horizonY: 1280,
    },
    palette: { top: 0x3a5a40, soil: 0x4a3b2c, deep: 0x3b3a3f, sand: 0x8a8580, plank: 0x5c4033, under: 0x3b2f24, rock: 0x9aa0a6, cave: 0x0d0b10 },
    void: null,
  },
  // Monastery: built into a mountain over a sea of cloud. Three levels with
  // air to fight in (the halls' upper floors and a pagoda roof, the
  // courtyard, the lower terraces), slim floors, crumbling bridges and
  // stairs, bamboo groves, cherry blossom, prayer flags, stone lanterns.
  // Hazard: crumbling stone (it breaks under you, then is rebuilt) and
  // rockfalls off the cliffs (a trickle of pebbles warns you).
  // Advantage: hide in the bamboo groves (it rustles when someone moves in it).
  monastery: {
    key: 'monastery',
    name: 'Monastery',
    background: '#f4a261',
    tilemapKey: 'map-monastery',
    tilemapFile: 'assets/maps/monastery.json',
    tilesetName: 'monastery-tiles',
    tilesetKey: 'tiles-monastery',
    tilesetFile: 'assets/tilesets/monastery-tiles.png',
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { military: 4, undead: 1, scifi: 1 }, // how often each family comes (weights)
    },
    sky: {
      colors: [0x355070, 0x6d597a, 0xb56576, 0xeaac8b, 0xffe5d9],
      war: { smoke: 2 },
      sun: { color: 0xffd6a5, x: 0.25, y: 0.3, size: 1.3 },
      clouds: { count: 9, color: 0xffe5d9 },
      ridges: [
        { color: 0x8d7aa0, factor: 0.1, height: 300, rough: 1, spiky: true, snowCaps: true },
        { color: 0x5e548e, factor: 0.22, height: 240, rough: 1.1, spiky: true, snowCaps: true },
      ],
      petals: true,          // cherry blossom petals drifting
      horizonY: 1024,
    },
    palette: { top: 0xb7a99a, soil: 0x8d8173, deep: 0x6f655b, sand: 0xc2b6a3, plank: 0x8c2f1e, under: 0x7a6f63, rock: 0x9c9287, crumble: 0xa9a094, cave: 0x2b2220 },
    void: {
      top: 1700,
      deathY: 1980,
      color: 0xf1e9e4,       // a sea of cloud far below
      glowColor: 0xffffff,
      deathMessage: 'Fell off the mountain',
    },
  },

  // Wastelands: a ruined city. Three levels: the
  // broken highway overpass, the street (wrecked cars, a tank, craters), the
  // sewer under it. Dead trees, lampposts, tyres, a smoggy sky.
  // No void: the sewer floor is solid ground.
  // Hazard: toxic puddles and radiation zones drain you slowly.
  // Advantage: wrecks for cover.
  wastelands: {
    key: 'wastelands',
    name: 'Wastelands',
    background: '#6b705c',
    tilemapKey: 'map-wastelands',
    tilemapFile: 'assets/maps/wastelands.json',
    tilesetName: 'wastelands-tiles',
    tilesetKey: 'tiles-wastelands',
    tilesetFile: 'assets/tilesets/wastelands-tiles.png',
    enemies: {
      slots: { main: 3, machine: 1, animal: 1 }, // one more: one jetpack shooter is always among the mains,
      families: { scifi: 3, undead: 2, military: 2 }, // how often each family comes (weights)
      groundFighters: true, // walkers and leapers (zombies, skeletons, mutants, K9s, Scrap Bots) fight here...
      walkerBoost: 4,       // ...and come more often than the jetpack shooters (who still come plenty)
    },
    sky: {
      colors: [0x3d405b, 0x6b705c, 0xa5a58d, 0xb7b7a4, 0x6b705c],
      war: { smoke: 4, smokeColor: 0x2b2b2b },
      sun: { color: 0xe9edc9, x: 0.7, y: 0.18, size: 0.8 },
      clouds: { count: 8, color: 0x8a8d7a },
      ridges: [
        { color: 0x5c5f52, factor: 0.1, height: 260, skyline: true },
        { color: 0x3f4238, factor: 0.22, height: 200, skyline: true },
      ],
      ash: true,             // ash drifting down
      horizonY: 1024,
    },
    palette: { top: 0x4a4a4f, soil: 0x7d7a73, deep: 0x5e5b55, sand: 0x8c7b5e, plank: 0x6b4f2e, under: 0x5e5b55, rock: 0x8a4b2a, crumble: 0x8f8b82, cave: 0x15140f },
    void: null,              // no void: the sewer floor is solid ground
  },

  // Sky Islands: grassy islands floating high in the sky over a sea of
  // cloud. Three levels of islands, a rope bridge.
  // Hazard: gusts of wind push everyone sideways (hard in the air).
  // Low gravity (a bit heavier than Space). Advantage: ride the wind.
  skyislands: {
    key: 'skyislands',
    name: 'Sky Islands',
    background: '#8ecae6',
    tilemapKey: 'map-skyislands',
    tilemapFile: 'assets/maps/skyislands.json',
    tilesetName: 'skyislands-tiles',
    tilesetKey: 'tiles-skyislands',
    tilesetFile: 'assets/tilesets/skyislands-tiles.png',
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { military: 3, scifi: 3, undead: 1 }, // how often each family comes (weights)
    },
    sky: {
      colors: [0x1d2d44, 0x3e5c76, 0x748cab, 0xa9b4c2, 0xd9dde3], // a stormy sky
      sun: { color: 0xe9ecef, x: 0.75, y: 0.2, size: 0.8 },
      clouds: { count: 14, color: 0xc9ced6 },
      war: { smoke: 2 },
      mist: { color: 0xe9ecef, alpha: 0.12 },
      birds: true,
      horizonY: 1600,
    },
    palette: { top: 0x70c26a, soil: 0x9c6b3f, deep: 0x7a5230, sand: 0xe0c98a, plank: 0x8a5a2b, under: 0x6e4a2a, rock: 0xa7a9ac, cave: 0x2b2220 },
    wind: true,
    gravity: 200,            // low: floaty, a bit heavier than Space
    void: {
      top: 1800,
      deathY: 2050,
      color: 0xffffff,       // a sea of cloud far below
      glowColor: 0xffffff,
      deathMessage: 'Fell from the sky',
    },
  },

  // Militia Camp: Training only (never in the F6 list). A daytime army
  // camp, one flat parade ground with a thick floor, no void, no hazards.
  // Stations left to right behind gates that open as you finish lessons
  // (src/data/training.js, src/systems/TrainingSystem.js).
  camp: {
    key: 'camp',
    name: 'Militia Camp',
    trainingOnly: true,
    background: '#9fb3c8',
    tilemapKey: 'map-camp',
    tilemapFile: 'assets/maps/camp.json',
    tilesetName: 'camp-tiles',
    tilesetKey: 'tiles-camp',
    tilesetFile: 'assets/tilesets/camp-tiles.png',
    enemies: { slots: {}, families: ['military'] }, // Training brings its own
    sky: {
      colors: [0x5c6b7a, 0x7d8c99, 0x9fb3c8, 0xc2ccd4, 0xd8d2c0], // overcast, a dusty horizon
      sun: { color: 0xf1ede0, x: 0.8, y: 0.2, size: 0.7 },
      clouds: { count: 10, color: 0xdde3e8 },
      war: { smoke: 3 },
      ridges: [
        { color: 0x7a8577, factor: 0.1, height: 180, rough: 0.5 },
        { color: 0x5e6b52, factor: 0.22, height: 130, rough: 0.8, trees: true },
      ],
      birds: true,
      horizonY: 700,
    },
    palette: { top: 0x6a7f3a, soil: 0x6b5236, deep: 0x564330, sand: 0xc2a878, plank: 0x8a6a42, under: 0x5a4430, rock: 0x8a8578, cave: 0x2b2420 },
    void: null,
  },

  // Space: asteroids drifting in open space, a moon base on the middle one.
  // Very low gravity: big floaty jumps, the jetpack goes a long way.
  // Hazard: meteor showers (a red ring shows where one will hit).
  // Advantage: low gravity; the base's roof and walls are cover.
  space: {
    key: 'space',
    name: 'Space',
    background: '#03001c',
    tilemapKey: 'map-space',
    tilemapFile: 'assets/maps/space.json',
    tilesetName: 'space-tiles',
    tilesetKey: 'tiles-space',
    tilesetFile: 'assets/tilesets/space-tiles.png',
    enemies: {
      slots: { main: 2, machine: 1, animal: 1 },
      families: { scifi: 6, military: 1 }, // how often each family comes (weights)
    },
    sky: {
      colors: [0x03001c, 0x0b0530, 0x1b1045, 0x0b0530, 0x03001c],
      signalTower: { x: 0.35 },   // the source of the signal, far off
      stars: 220,
      planet: { color: 0x4361ee, x: 0.78, y: 0.28, size: 1.6, ring: 0xbde0fe },
      moon: { color: 0xe0e1dd, x: 0.15, y: 0.18 },
      horizonY: 1600,
    },
    palette: { top: 0xc9c9d6, soil: 0x8e8ea3, deep: 0x5f5f75, sand: 0xb8b8c8, plank: 0x6c7a89, under: 0x55556a, rock: 0x6d5a7a, cave: 0x10142a },
    gravity: 110,            // very low (normal is 800)
    void: {
      top: 1800,
      deathY: 2050,
      color: 0x03001c,
      glowColor: 0x7209b7,
      deathMessage: 'Lost in space',
    },
  },
};
