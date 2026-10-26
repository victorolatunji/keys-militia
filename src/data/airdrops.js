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

  // Look (placeholder art)
  crate: {
    width: 28,
    height: 24,
    color: 0x8d6e3f,
    strokeColor: 0x4a3720,
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
// type 'gun' uses WEAPONS keys, 'throwable' uses THROWABLES keys.
export const AIRDROP_POOL = [
  { type: 'gun', key: 'pistol', weight: 3 },
  { type: 'gun', key: 'assaultRifle', weight: 3 },
  { type: 'gun', key: 'sniper', weight: 2 },
  { type: 'throwable', key: 'grenade', count: 3, weight: 2 },
];