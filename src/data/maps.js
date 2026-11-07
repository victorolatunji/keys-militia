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
};

// Testing: F6 switches to the next map (remembered in this browser), or
// open the game with ?map=forest / ?map=hell / ?map=test.
export const MAP_SELECT = {
  order: ['forest', 'hell', 'test'],
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
      clouds: { count: 6, color: 0x3d0c0c }, // smoke drifting
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
};
