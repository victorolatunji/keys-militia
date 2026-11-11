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
//   quicksand (rectangle) sinks you, slowly
//   icicle   (point, at the bottom of a ceiling) type its word to drop it
//   sea      (rectangle) Glacier's endless sea (water; the void's death line is deep in it)
//   dustdevil (rectangle) the stretch a dust devil wanders along
// And in the "decor" layer: tree, pine, palm, cactus (pricks), rock,
// mushroom, spire, bones (points),
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

// Ice (Glacier): you slide. Your speed only slowly follows what you press,
// so you skid to a stop and take a moment to get going.
export const ICE = {
  gripMs: 450,          // how slowly your speed catches up on ice (higher = slipperier)
};

// Thin ice: stand on it and it cracks, then breaks under you (into the
// freezing water below). It freezes over again after a while.
export const THIN_ICE = {
  crackMs: 500,         // standing this long: it cracks...
  breakMs: 1100,        // ...and this long: it breaks
  refreezeMs: 12000,
  freezingMs: 1200,     // freezing water: frozen this long, again and again while in it
};

// Icicles (Glacier's advantage): type the word on one (it takes a shot) and
// it drops on whoever is below. Grows back after a while.
export const ICICLE = {
  width: 16,
  length: 44,
  fallSpeed: 900,       // px/s
  damage: 45,           // to whoever it lands on (and frozen)
  hitWidth: 36,         // px wide it hits
  regrowMs: 15000,
  color: 0xcaf0f8,
};

// Quicksand (Desert): pulls you down slowly and you can barely move; fully
// under it you suffocate (slower than an enemy kills you). Jump or fly out.
export const QUICKSAND = {
  color: 0xd4a373,
  deepColor: 0x9c6644,
  surfaceColor: 0xe9c46a,
  alpha: 0.97,
  waveHeight: 1,
  moveScale: 0.35,
  pull: 30,             // px/s: always sinking at least this fast
  maxSinkSpeed: 45,
  maxRiseSpeed: 190,    // the jetpack pulls you out, slowly
  breathMs: 3000,
  drownDamage: 3,       // per tick...
  drownTickMs: 500,     // ...(6 HP/s)
};

// Cacti (Desert): touch one and it pricks you and pushes you off.
export const CACTUS = {
  damage: 3,
  everyMs: 700,
  push: 220,
  widthPx: 26,
  heightPx: 54,
};

// Sandstorms (Desert's advantage): every so often a storm rolls through.
// While it lasts nobody sees far: words only show and bots only see within
// visionPx, so you can sneak up (or get away).
export const SANDSTORM = {
  everyMs: [35000, 55000],
  lastMs: 14000,
  fadeMs: 2500,
  visionPx: 280,
  color: 0xd4a373,
  alpha: 0.5,
};

// Igloos (Glacier): step inside one and you're hidden (like a bush), and
// its warmth thaws you out (no frozen).
export const IGLOO = {
  color: 0xf8f9fa,
  shade: 0xcfd8e3,
};

// Dust devils (Desert): little whirlwinds wandering over the sand. Get
// caught in one and it lifts you and spins you about. No damage.
export const DUST_DEVIL = {
  widthPx: 60,
  heightPx: 170,
  speed: [30, 60],      // px/s along the sand
  lift: 1300,           // px/s² upward while inside
  maxLift: 320,
  swirl: 260,           // px/s sideways shove (changes direction)
};

// Boulders (Catacombs): a huge stone ball rolls down a ramp now and then,
// after a rumble and falling dust at the top. It hurts and throws you
// (realistic: it can kill a hurt character, but it doesn't one-shot a
// healthy one), then smashes against the wall at the bottom. A lever at the
// top shows a word: type it to send the boulder early (your hit: kills
// count as yours).
export const BOULDER = {
  radius: 30,
  speed: 340,           // px/s rolling
  everyMs: [14000, 22000],
  warnMs: 1600,         // rumbling and dust before it goes
  damage: 35,           // per hit (a healthy character survives one)...
  hitEveryMs: 60000,    // ...once per roll (it knocks you out of its way)
  knockback: 520,
  leverRearmMs: 4000,   // after a boulder goes, the lever is ready again this much later
  color: 0x7a7067,
};

// Grabbing hands (Graveyard): in the hand zones, a hand bursts out of the
// ground under whoever stands there (dirt crumbling first), holds them in
// place for a moment and squeezes a little. Bots too.
export const HANDS = {
  everyMs: [6000, 11000], // per zone: a hand comes up on this interval
  warnMs: 700,
  holdMs: 1400,
  damage: 5,
  color: 0x8a9a5b,
};

// The church bell (Graveyard): it rings when anyone moves near it. Everyone
// within radiusPx is dazed. Then it rests for everyMs.
export const BELL = {
  radiusPx: 520,
  dazedMs: 2500,
  senseRadiusPx: 360,      // it rings when anyone moves this close...
  everyMs: [15000, 25000], // ...then rests this long before it can again
  color: 0xc9a227,
};

// Crumbling stone (Monastery): old bridges and stairs break if you stand on
// them a moment (like thin ice), then get rebuilt a while later.
// (Uses THIN_ICE's timings.)

// Rockfalls (Monastery): in these zones under the cliffs, a rock breaks off
// now and then; pebbles trickle down first (move!), then it drops and hits
// whoever is under it.
export const ROCKFALL = {
  everyMs: [4000, 8000],  // per zone
  warnMs: 900,
  radius: 16,
  fallSpeed: 700,
  damage: 20,
  color: 0x8d8173,
};

// Bamboo groves (Monastery): step in and you're hidden (like a bush); it
// rustles (sound, sway) when someone moves through it.
export const BAMBOO = {
  colors: [0x588157, 0x3a5a40, 0x6a994e, 0xa3b18a],
};

// Toxic puddles (Wastelands): like water to move in, but they eat at you
// while you're in them (and slowly, nothing like an enemy).
export const TOXIC = {
  color: 0x6a994e,
  deepColor: 0x283618,
  surfaceColor: 0x9ef01a,
  alpha: 0.85,
  waveHeight: 2,
  moveScale: 0.6,
  maxSinkSpeed: 90,
  maxRiseSpeed: 240,
  damage: 1,              // per tick while in it...
  tickMs: 500,            // ...(6 HP/s)
  breathMs: 3000,         // fully under: hold your breath, then...
  drownDamage: 4,
  drownTickMs: 500,
};

// Radiation zones (Wastelands): a geiger counter ticks and a green haze
// hangs there. Standing in one drains you slowly.
export const RADIATION = {
  damage: 2,
  tickMs: 500,            // (4 HP/s)
  color: 0x9ef01a,
};

// Acid rain (Wastelands): every so often it pours for a while. Out in the
// open (nothing solid over your head) it burns a little; take cover.
export const ACID_RAIN = {
  everyMs: [40000, 60000],
  lastMs: 12000,
  fadeMs: 2000,
  damage: 2,
  tickMs: 600,            // (about 3 HP/s while exposed)
  color: 0xb5e48c,
};

// Fuel barrels (Wastelands): type the word on one and it explodes (your
// blast, it counts as your kills). A new barrel turns up later.
export const BARREL = {
  blastRadius: 150,
  directHitRadius: 40,
  damage: 70,
  knockback: 520,
  knockbackLift: 200,
  knockbackFullAt: 60,
  rearmMs: 30000,
  color: 0xc1121f,
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

// Cryo on water freezes it into an iceberg: rough cut edges, a jagged top
// just above the surface you can stand on, a deep chunk below that traps
// anyone under it until it cracks and breaks. Cryo does nothing to lava.
// EMP in water shocks everyone in that water.
export const FREEZE = {
  ms: 8000,             // how long the iceberg lasts (it cracks for the last 1.5s)
  aboveSurface: 8,      // px its flat (standing) top sits above the water
  peak: 12,             // px its jagged top pokes up further
  depth: 90,            // px it reaches down into the water (in the middle)
  bodyHeight: 40,       // px of it that's solid (top part)
  iceColor: 0xcaf0f8,
  deepIceColor: 0x90e0ef,
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
  snow: { perSecond: 18 },
  tumbleweeds: { max: 2, everyMs: [6000, 12000], speed: [90, 150], size: 14 },
  critters: { walk: 22, flee: 120, scarePx: 140, respawnMs: 40000 }, // penguins / scorpions (killed by blasts, back after respawnMs)
  camels: { count: 5, speed: 14, spacing: 80, color: 0x6b4f3a },
  whales: { everyMs: [5000, 11000] },
};

// Meteor showers (Space): a red ring flashes where one will hit, then it
// streaks down and bursts. Get under a roof.
export const METEOR = {
  everyMs: [20000, 32000], // per zone (3 zones: about one every 8-9s)
  warnMs: 1100,
  radius: 12,
  fallSpeed: 900,
  damage: 15,
  blastRadius: 70,
  color: 0xe85d04,
};

// Wind gusts (Sky Islands): they push everyone sideways, hard in the air.
export const WIND = {
  everyMs: [50000, 80000], // rare: a gust now and then, not all the time
  lastMs: 9000,
  fadeMs: 1500,
  speed: 260,       // px/s drift in the air at full strength
  groundFactor: 0.25, // on the ground you only get pushed a little
};

// Updrafts (Sky Islands): columns of rising air between islands.
export const UPDRAFT = {
  lift: 1800,       // px/s per second
  maxRise: 420,
};

// Coffins (Graveyard): solid wooden cover lying around and in open graves.
// Enemy bullets stop in them; bullets and blasts break them.
export const COFFIN = {
  width: 64,
  height: 22,
  hp: 60,
  bulletDamage: 10,
  healthChance: 0.3, // a broken one spills a health pack this often
  backMs: 45000,
  color: 0x5c3d2e,
  edge: 0x2b1d14,
};
