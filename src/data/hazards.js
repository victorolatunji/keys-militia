// Phase 7: map hazards and advantages (HazardSystem). Where they are lives
// in each map's Tiled file (object layer "hazards"); how they behave lives
// here, shared by every map. A map config can override colors (maps.js).
//
// Tiled object names:
//   water    (rectangle) a pool, lake or spring
//   lava     (rectangle) a lava pool
//   geyser   (point, on the ground) a fire geyser that erupts now and then
//   vent     (point, on the ground) a heat vent: hover over it to refuel
//   waterfall / lavafall (rectangle) pours down: pushes you down (lava: burns)
// And in the "decor" layer: tree, rock, mushroom, spire, bones (points),
// bush, bigtree, chain, cave, fireflies (rectangles).
//
// Map hazards are slow on purpose: they wear you down, they don't kill you
// as fast as an enemy does.

// Hiding: fully under water, or inside a bush, you're hidden: no word shows
// on you and enemies lose sight of you (one that bumps into you still finds
// you). Attacking gives you away for a moment. The same goes for enemies.
export const HIDING = {
  revealMs: 1000,       // after you shoot, you're seen for this long
  closePx: 60,          // this close, a bot finds you anyway
  hiddenAlpha: 0.55,    // how see-through you are while hidden (only you see it)
  labelColor: '#90e0ef',
};

// Water: partly in it does nothing to you (no drowning, no damage). Only
// fully under (head and all) counts: you're hidden, but you're holding
// your breath. Run out and you start drowning until you come up.
// On Jet Boost you float: you can't go under until the boost runs out.
export const WATER = {
  color: 0x0077b6,      // the water itself (a map can override)
  alpha: 0.55,
  deepColor: 0x023e8a,  // darker toward the bottom
  surfaceColor: 0x90e0ef,
  waveHeight: 3,        // px, the surface ripples
  moveScale: 0.7,       // running and flying are slower in water
  maxSinkSpeed: 110,    // px/s: you sink slowly instead of falling
  maxRiseSpeed: 260,    // px/s: the jetpack still pushes you up, slower
  breathMs: 5000,       // fully under: this long before you start drowning
  drownDamage: 4,       // per tick once out of breath...
  drownTickMs: 500,     // ...every this many ms (8 HP/s)
  splashSpeed: 220,     // falling in faster than this makes a big splash
  putsOutFire: true,    // jumping in stops burning
  floatDepth: 16,       // Jet Boost: how deep your feet sit while floating
  bulletRangePx: 70,    // a bullet that hits the water only goes this far in
  // Blasts: water carries a blast to everyone in it (a shockwave) but
  // shields you from one outside it.
  blastInWater: 1.1,    // blast under water, you in that water
  blastOutOfWater: 0.35,// blast under water, you out of it (or the other way round)
  sinkSpeed: 70,        // px/s: grenades, items and body parts sink this slowly
};

// Waterfall / lavafall: standing in it pushes you down.
export const FALLS = {
  push: 900,            // px/s² downward
};

// Lava: touching it sets you on fire (burning). Fully in it works like
// drowning, only faster and on fire: a moment to get out, then you melt.
// Grenades in lava cook off; items and body parts burn up.
export const LAVA = {
  color: 0xe85d04,
  deepColor: 0x9d0208,
  surfaceColor: 0xffba08,
  glowColor: 0xff5400,
  holdMs: 2500,         // fully in: this long before you start melting...
  damage: 5,            // ...then this much...
  tickMs: 500,          // ...every this many ms (10 HP/s, plus burning)
  cookOffMs: 600,       // a grenade that falls in goes off this soon
  moveScale: 0.4,
  maxSinkSpeed: 60,
  maxRiseSpeed: 220,
};

// Cryo on water freezes it into a sheet of ice you can stand on (and that
// traps anyone under it until it breaks). On lava it cools a crust you can
// walk on. EMP in water shocks everyone in that water.
export const FREEZE = {
  ms: 8000,             // how long the ice lasts (it cracks for the last 1.5s)
  crustMs: 6000,        // cooled lava crust
  thickness: 18,        // px
  iceColor: 0xcaf0f8,
  crustColor: 0x2b2d42,
  empDamage: 10,        // EMP in water: everyone in it takes this and is shocked
};

// Fire geysers: rumble and smoke (the warning), then blast a column of fire
// straight up. Anyone in the column burns and gets thrown upward.
export const GEYSER = {
  everyMs: [6000, 10000], // random wait between eruptions
  warnMs: 1300,           // rumbling and smoking before it blows
  eruptMs: 1400,
  heightPx: 300,
  widthPx: 46,
  damage: 6,              // per hit while in the column...
  hitEveryMs: 600,        // ...this often (plus it sets you burning)
  launch: 520,            // upward push, px/s
  colors: [0xffd166, 0xff9f1c, 0xe85d04, 0xd00000],
};

// Heat vents (Hell's advantage): a column of hot air. Hover in it and your
// jetpack refuels fast; it also lifts you gently.
export const VENT = {
  widthPx: 70,
  heightPx: 260,
  refuelPerSec: 70,     // jetpack fuel (max 100)
  lift: 700,            // px/s² upward push while inside
  maxLiftSpeed: 220,    // it won't push you up faster than this
  color: 0xffb703,
};

// Decor drawn by the BackdropSystem (looks only).
export const DECOR = {
  birds: { flocks: 3, perFlock: [3, 6], speed: [40, 80], chirpPx: 700 },
  embers: { color: [0xff9f1c, 0xff5400, 0xffd166], perSecond: 30 },
  leaves: { colors: [0x95d5b2, 0x52b788, 0xe9c46a], perSecond: 4 },
  fireflies: { color: 0xfff3b0, count: 40 },
  fish: { everyMs: [3000, 7000], color: 0xf4a261 }, // a fish jumping in a lake now and then
};
