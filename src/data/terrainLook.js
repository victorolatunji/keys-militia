// How each map's ground is drawn by TerrainArt (src/systems/TerrainArt.js):
// organic shapes instead of square tiles, a rim of small stones along every
// edge, and a surface on the tops (grass, snow, sand...), Mini Militia style
// readability. Only the look: the tiles (collisions, spawns, hazards) are
// unchanged. Colours come from the map's palette unless set here.
//   surface: what grows or lies on the tops: 'grass', 'dead' (dry grass),
//            'snow', 'sand', 'crust' (volcanic, with embers), 'moss',
//            'rubble', 'dust'
//   stone:   the rim stones' colour; ink: their outline
//   caveDark: how much darker the back walls of caves are drawn
export const TERRAIN_LOOK = {
  defaults: { surface: 'grass', ink: 0x131112, caveDark: 0.55, speckle: 0.16 },
  forest: { surface: 'grass', stone: 0xa39a8c },
  hell: { surface: 'crust', stone: 0x4a3b3b, grass: 0xff7b39 },
  glacier: { surface: 'snow', stone: 0xb9c8d6, grass: 0xf8f9fa },
  desert: { surface: 'sand', stone: 0xc59a6a, grass: 0xf4d58d },
  catacombs: { surface: 'moss', stone: 0x8f877c, grass: 0x6b7f4a },
  graveyard: { surface: 'dead', stone: 0x8e939a, grass: 0x6f7f3e },
  monastery: { surface: 'moss', stone: 0xbcb2a5, grass: 0x6f8f4e },
  wastelands: { surface: 'rubble', stone: 0x8f8b82, grass: 0x6d6a63 },
  skyislands: { surface: 'grass', stone: 0xb9b4a8 },
  space: { surface: 'dust', stone: 0x9a96aa, grass: 0xd6d6e2 },
  camp: { surface: 'dead', stone: 0x9a9384, grass: 0x7d8a45 },
  test: false, // the test map keeps its plain tiles
};

// Tiles drawn as organic ground (the rest, planks, thin ice, crumbling rock
// and the invisible roof tiles, stay as tiles: they break or are structures).
export const EARTH_TILES = new Set([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
