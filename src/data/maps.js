// Each map is a config. Platforms use top-left x/y plus width/height.
export const MAPS = {
  test: {
    key: 'test',
    name: 'Test Map',
    width: 2560,
    height: 1440,
    background: '#1a1a2e',
    groundColor: 0x6b5d4f,
    grassColor: 0x5a9e4b,

    // Players drop in from the sky.
    spawn: { x: 600, y: 100 },

    // The void under every map.
    void: {
      top: 1240,          // where the darkness starts
      deathY: 1380,       // cross this line and you die
      color: 0x05050f,    // darkness color
      glowColor: 0x9d4edd // rising mist color
    },

    platforms: [
      { x: 300,  y: 1100, w: 1000, h: 120 }, // main island
      { x: 1450, y: 1000, w: 700,  h: 120 }, // right island
      { x: 1150, y: 900,  w: 60,   h: 200 }, // wall on main island
      { x: 150,  y: 750,  w: 350,  h: 40 },  // high left ledge
      { x: 700,  y: 800,  w: 300,  h: 40 },  // middle float
      { x: 1700, y: 650,  w: 400,  h: 40 },  // high right
      { x: 1100, y: 450,  w: 300,  h: 40 },  // top center
    ],
  },
};