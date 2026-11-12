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
  lowShare: 0.35,        // this share of crates aim for the lower levels (through the gaps and holes)
  clearPx: 170,          // never land this close (sideways) to another crate or an item on the ground
  footPx: 30,            // the ground must be flat this far either side of the crate's middle (no tipping into the void)

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
    iconScale: 0.55,     // gun icons cycle on the crate's front (icons are 50 x 26 px)
    iconCycleMs: 700,
    art: { width: 60, chuteWidth: 92 }, // with art: drawn this wide (px)
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
  lifetimeMs: 30000,     // vanish after this long
  blinkBeforeMs: 5000,   // blink during the last 5s
  popSpeedX: 90,         // max sideways speed when they pop out
  popSpeedY: 220,        // upward speed when they pop out
  maxOnMap: 6,           // oldest drop disappears past this

  // Look: the item's icon on a small dark tag (also used by supply drops)
  // With art: the item itself (its sprite) this many px across, a soft glow
  // behind it (pulsing) and its name under it once it's landed.
  // Sizes (px across): guns by their length (a pistol smaller than an
  // assault rifle, all easy to see), melee likewise, throwables and gear small.
  art: {
    gun: { min: 30, max: 50 },   // pistol ... sniper
    melee: { min: 24, max: 44 }, // knife ... sword
    throwable: 14,
    gear: 22,
    glow: 46, glowAlpha: [0.35, 0.6], pulseMs: 700, tagSize: '10px',
    nameNearPx: 70,              // its name shows when you're this close
  },
  look: {
    iconScale: 0.6,      // icons are 50 x 26 px; drops show them smaller
    width: 34,
    height: 20,
    color: 0x000000,
    alpha: 0.35,
    strokeColor: 0x6c757d,
  },
};

// Supply drops: loose items fall (no crate, no chute) at a random spot with
// ground below. Two lanes, each with its own timer and its own cap, so
// throwables never crowd out health and armor (or the other way round):
//   throwables: frequent, small. Faster while you carry none at all.
//   items:      health, armor, Jet Boost, shield, pistols, and the rare
//               specials and launchers. More health packs while you're hurt.
// Rare guard: if no special or launcher has fallen for rare.guaranteeMs,
// the next items drop is one, so every match sees a few.
// Litter guard: no supply drop while maxLoose loose items (supply + death
// drops) are already lying around, and unpicked items vanish.
//
// The numbers, per minute of play (nothing picked up):
//   throwables lane: 60/12 = 5 drops x 2 = 10 throwables offered
//                    (8 drops/min while you have none)
//   items lane:      60/20 = 3 drops: ~0.7 health, ~0.6 pistol, ~0.45 Jet
//                    Boost, ~0.4 armor, ~0.3 shield, ~0.55 special or launcher
//   specials: about one every 3 min; a special or launcher about every
//   1.5-2 min, never more than 3 min apart
//   on the ground at once: lanes cap at 2 + 2, all loose items at 6, plus
//   up to 2 crates. Picked-up items free their spot right away.
// Guns: keys 1/2; throwables and items: key 3. A gun entry with `category`
// falls as a random gun of that family.
export const SUPPLY_DROPS = {
  fallSpeed: 260,        // px per second, max
  spin: 6,               // radians per second while falling
  maxLoose: 6,           // loose items on the ground (supply + death drops) before supply pauses

  lanes: {
    throwables: {
      firstDropMs: 6000,
      intervalMs: 12000,
      hungryIntervalMs: 7500, // while both your throwable slots are empty
      maxOnMap: 2,
      lifetimeMs: 22000,      // vanishes after this long (blinks during the last 5s); < 2 intervals, so the cap rarely blocks
      pool: [                 // weights add up to 100 (= % of this lane)
        { type: 'throwable', key: 'grenade', count: 2, weight: 26 },
        { type: 'throwable', key: 'sticky', count: 2, weight: 13 },
        { type: 'throwable', key: 'molotov', count: 2, weight: 13 },
        { type: 'throwable', key: 'combatAxe', count: 2, weight: 9 },
        { type: 'throwable', key: 'smoke', count: 2, weight: 7 },
        { type: 'throwable', key: 'gas', count: 2, weight: 6 },
        { type: 'throwable', key: 'flashbang', count: 2, weight: 7 },
        { type: 'throwable', key: 'concussion', count: 2, weight: 7 },
        { type: 'throwable', key: 'emp', count: 2, weight: 7 },
        { type: 'throwable', key: 'cryo', count: 2, weight: 5 },
      ],
    },
    items: {
      firstDropMs: 10000,
      intervalMs: 20000,
      maxOnMap: 2,
      lifetimeMs: 30000,
      pool: [                 // weights add up to 100
        { type: 'health', key: 'healthPack', weight: 24 },
        { type: 'gun', category: 'pistol', weight: 22 },
        { type: 'boost', key: 'jetBoost', weight: 16 },
        { type: 'armor', key: 'armorVest', weight: 14 },
        { type: 'shield', key: 'riotShield', weight: 10 },
        { type: 'gun', category: 'special', weight: 8 },
        { type: 'gun', category: 'launcher', weight: 6 },
      ],
      hurt: { below: 0.4, healthWeightScale: 3 }, // under 40% HP: health packs 3x as likely
    },
  },

  rare: {
    categories: ['special', 'launcher'],
    guaranteeMs: 180000, // none for 3 min: the next items drop is one of them
    specialShare: 0.6,   // a guaranteed one is a special 60% of the time, else a launcher
  },
};
