// Each map is a config. Layout and spawn points live in the Tiled file;
// everything else (void, background, later hazards) lives here.
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
};