// Airdrops: crates that parachute down on a timer.
// Each crate holds one item (picked from the pool by weight).
// Starting values, tune in playtests (README open decision).
export const AIRDROPS = {
  // Timing
  firstDropMs: 4000,     // first crate after the match starts
  intervalMs: 20000,     // then one every 20s
  maxCrates: 2,          // no new drop while this many are on the map
  lifetimeMs: 40000,     // a landed crate vanishes after this long
  blinkBeforeMs: 5000,   // blinks during its last 5s

  // Where crates appear
  spawnY: -40,           // just above the top of the map
  edgeMarginPx: 96,      // keep away from the left and right walls
  tries: 12,             // random spots to try before giving up on "above ground"

  // Parachute fall
  fallSpeed: 90,         // px per second while the chute is open
  swaySpeed: 18,         // px per second of side-to-side drift
  swayMs: 1600,          // time for one full sway left and right

  // Landing on an edge: if the crate's center isn't over something solid,
  // it tips toward the open side, slides off and tumbles down.
  tipSpeed: 70,          // px per second sliding off the edge
  tipAngle: 0.5,         // radians it leans while tipping
  tumbleSpin: 5,         // radians per second while tumbling down
  maxFallSpeed: 900,     // fall speed without a chute
  supportCheckMs: 150,   // how often a landed crate checks it still has ground

  // Pickups
  pickupRadius: 64,      // px from you to a landed crate to open its panel

  // Look (placeholder art)
  crate: {
    width: 28,
    height: 24,
    color: 0x8d6e3f,
    strokeColor: 0x4a3720,
    highlightColor: 0xffd166, // outline of the crate your panel is showing
    iconScale: 0.5,      // item icon painted on the crate (icons are 50 x 26 px)
  },
  chute: {
    radius: 24,          // canopy half-width
    height: 36,          // canopy top sits this far above the crate's center
    color: 0xe63946,
    stripeColor: 0xf1faee,
    lineColor: 0xf1faee,
  },
};

// What a crate can hold. weight = how often it shows up compared to the others.
// type 'gun' and 'melee' use WEAPONS keys. Throwables don't come in crates:
// they fall on their own timer (SUPPLY_DROPS below).
export const AIRDROP_POOL = [
  // Pistols and SMGs: common
  { type: 'gun', key: 'mw11', weight: 1.5 },
  { type: 'gun', key: 'desertEagle', weight: 1 },
  { type: 'gun', key: 'renetti', weight: 1 },
  { type: 'gun', key: 'rus79u', weight: 1 },
  { type: 'gun', key: 'switchblade', weight: 1 },
  { type: 'gun', key: 'qq9', weight: 0.8 },
  { type: 'gun', key: 'fennec', weight: 0.8 },
  { type: 'gun', key: 'mac10', weight: 0.8 },
  { type: 'gun', key: 'pp19Bizon', weight: 0.8 },
  // Shotguns
  { type: 'gun', key: 'by15', weight: 1 },
  { type: 'gun', key: 'krm262', weight: 0.7 },
  { type: 'gun', key: 'striker', weight: 0.7 },
  // Assault rifles
  { type: 'gun', key: 'ak47', weight: 1 },
  { type: 'gun', key: 'm4', weight: 1 },
  { type: 'gun', key: 'ak117', weight: 0.8 },
  { type: 'gun', key: 'type25', weight: 0.8 },
  { type: 'gun', key: 'm13', weight: 0.8 },
  { type: 'gun', key: 'kilo141', weight: 0.7 },
  { type: 'gun', key: 'oden', weight: 0.5 },
  { type: 'gun', key: 'asVal', weight: 0.7 },
  // LMGs: rarer
  { type: 'gun', key: 'rpd', weight: 0.5 },
  { type: 'gun', key: 'chopper', weight: 0.4 },
  { type: 'gun', key: 'm4lmg', weight: 0.4 },
  { type: 'gun', key: 'holger26', weight: 0.5 },
  { type: 'gun', key: 'pkm', weight: 0.3 },
  // Marksman and snipers: rarer
  { type: 'gun', key: 'kiloBoltAction', weight: 0.6 },
  { type: 'gun', key: 'mk2', weight: 0.5 },
  { type: 'gun', key: 'dlq33', weight: 0.5 },
  { type: 'gun', key: 'arctic50', weight: 0.5 },
  { type: 'gun', key: 'zrg20mm', weight: 0.2 },
  // Launchers: rare
  { type: 'gun', key: 'smrs', weight: 0.35 },
  { type: 'gun', key: 'thumper', weight: 0.4 },
  { type: 'gun', key: 'warMachine', weight: 0.25 },
  // Melee
  { type: 'melee', key: 'machete', weight: 0.6 },
  { type: 'melee', key: 'bat', weight: 0.6 },
  { type: 'melee', key: 'spade', weight: 0.6 },
  { type: 'melee', key: 'hammer', weight: 0.5 },
  { type: 'melee', key: 'sword', weight: 0.4 },
  { type: 'melee', key: 'axe', weight: 0.4 },
];

// Death drops: when you die, your guns and throwables fall out as loose pickups.
// Anyone can grab them (same 1/2/3/4 panel as crates). Nothing drops in the void.
export const DEATH_DROPS = {
  lifetimeMs: 60000,     // vanish after this long
  blinkBeforeMs: 5000,   // blink during the last 5s
  popSpeedX: 90,         // max sideways speed when they pop out
  popSpeedY: 220,        // upward speed when they pop out
  maxOnMap: 8,           // oldest drop disappears past this

  // Look: the item's icon on a small dark tag (also used by supply drops)
  look: {
    iconScale: 0.6,      // icons are 50 x 26 px; drops show them smaller
    width: 34,
    height: 20,
    color: 0x000000,
    alpha: 0.35,
    strokeColor: 0x6c757d,
  },
};

// Supply drops: throwables fall loose (no crate, no chute) on their own timer,
// at a random spot with ground below. Picked up with key 3, like any throwable.
export const SUPPLY_DROPS = {
  firstDropMs: 12000,    // first supply drop after the match starts
  intervalMs: 25000,     // then one every 25s
  maxOnMap: 2,           // no new one while this many are lying around
  lifetimeMs: 40000,     // vanishes after this long (blinks during the last 5s)
  fallSpeed: 260,        // px per second, max
  spin: 6,               // radians per second while falling
  // Dropped in this order, then back to the start. Only frags for now;
  // sticky, molotov, smoke, flashbang... join the rotation in Phase 5.5.
  rotation: [
    { type: 'throwable', key: 'grenade', count: 2 },
  ],
};