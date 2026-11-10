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
  5: 'plank',
  6: 'under', 17: 'under', 18: 'under', 19: 'under',
  7: 'rock', 11: 'rock', 12: 'rock', 13: 'rock',
  20: 'ice', 21: 'ice', 22: 'ice', 23: 'ice',
  24: 'thin',
};

// Tile families you slide on (see ICE in hazards.js).
export const SLIPPERY = new Set(['ice', 'thin']);

// Testing: F6 switches to the next map (remembered in this browser), or
// open the game with ?map=forest / hell / glacier / desert / catacombs / graveyard / test.
export const MAP_SELECT = {
  order: ['forest', 'hell', 'glacier', 'desert', 'catacombs', 'graveyard', 'test'],
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
      families: ['military', 'undead', 'scifi'],
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
      families: ['military', 'undead', 'scifi'],
    },
    // Backdrop (BackdropSystem): sky colors top to bottom, the sun, clouds,
    // two rows of hills (far, near) and birds.
    sky: {
      colors: [0x48a9e6, 0x8ecae6, 0xcaf0f8, 0x90c8e0, 0x3a6f8f],
      sun: { color: 0xfff3b0, x: 0.78, y: 0.12 },
      clouds: { count: 9, color: 0xffffff },
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
      families: ['undead', 'military', 'scifi'],
    },
    sky: {
      colors: [0x0b0203, 0x2b0a0a, 0x6a040f, 0x9d0208, 0xdc2f02],
      sun: null,
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
      families: ['scifi', 'military', 'undead'],
    },
    sky: {
      colors: [0x1d3557, 0x457b9d, 0xa8dadc, 0xe0fbfc, 0x8ecae6],
      sun: { color: 0xfffbe6, x: 0.2, y: 0.14 },
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
      families: ['military', 'scifi', 'undead'],
    },
    sky: {
      colors: [0x3a86ff, 0x8ecae6, 0xffe8d6, 0xf6bd60, 0xe76f51],
      sun: { color: 0xfff3b0, x: 0.75, y: 0.12, size: 1.4 },
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
      slots: { main: 2, machine: 1, animal: 1 },
      families: ['undead', 'military', 'scifi'],
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
      slots: { main: 2, machine: 1, animal: 1 },
      families: ['undead', 'scifi', 'military'],
    },
    sky: {
      colors: [0x03071e, 0x0b132b, 0x1c2541, 0x3a506b, 0x1c2541],
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
};
