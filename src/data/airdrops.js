// Airdrops: crates that parachute down on a timer.
// Each crate holds a choice of guns (CRATE_CONTENTS): you take 2.
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
  pickupRadius: 80,      // px from you to a landed crate to open its panel

  // Look (placeholder art)
  crate: {
    width: 44,
    height: 36,
    color: 0x8d6e3f,
    strokeColor: 0x4a3720,
    highlightColor: 0xffd166, // outline of the crate your panel is showing
    iconScale: 0.7,      // gun icons cycle on the crate's side (icons are 50 x 26 px)
    iconCycleMs: 700,
  },
  chute: {
    radius: 34,          // canopy half-width
    height: 50,          // canopy top sits this far above the crate's center
    color: 0xe63946,
    stripeColor: 0xf1faee,
    lineColor: 0xf1faee,
  },
};

// What's in a crate: one random gun from each of these families (in this
// order, keys 1-6 on the pickup panel). Take any 2; then the crate is empty.
// Specials, launchers, pistols, throwables and utility fall loose instead
// (SUPPLY_DROPS). Melee weapons never drop.
export const CRATE_CONTENTS = {
  families: ['smg', 'assault', 'shotgun', 'lmg', 'rifle', 'marksman'],
  picks: 2,
};

// Death drops: when you die, your guns and throwables fall out as loose pickups
// (melee never drops). Anyone can grab them. Nothing drops in the void.
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

// Supply drops: loose items fall (no crate, no chute) on their own timer, at
// a random spot with ground below. Each drop is picked at random by weight:
// pistols often, specials and launchers rarely. Guns: keys 1/2; throwables,
// Jet Boost and Riot Shield: key 3. A gun entry with `category` falls as a
// random gun of that family.
export const SUPPLY_DROPS = {
  firstDropMs: 8000,     // first supply drop after the match starts
  intervalMs: 15000,     // then one every 15s
  maxOnMap: 4,           // no new one while this many are lying around
  lifetimeMs: 40000,     // vanishes after this long (blinks during the last 5s)
  fallSpeed: 260,        // px per second, max
  spin: 6,               // radians per second while falling
  pool: [
    { type: 'gun', category: 'pistol', weight: 3 },
    { type: 'throwable', key: 'grenade', count: 2, weight: 3 },
    { type: 'boost', key: 'jetBoost', weight: 2.5 },
    { type: 'shield', key: 'riotShield', weight: 1.5 },
    { type: 'gun', category: 'special', weight: 0.5 },
    { type: 'gun', category: 'launcher', weight: 0.5 },
  ],
};