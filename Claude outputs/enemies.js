// Enemy configs. HP is in points; your gun decides damage and word length.

// Stationary practice target (placed by Tiled "dummy" points).
export const ENEMIES = {
  dummy: {
    name: 'Target Dummy',
    width: 32,
    height: 48,
    color: 0xe76f51,
    hp: 100,
    respawnDelay: 3000,  // ms after death
  },
};

// Bots move with the same rules as you (speed, gravity, jetpack, fuel:
// src/data/player.js). Their type sets looks, HP and how they like to fight.
//   jetpack: false = walks and jumps only (zombies, later)
//   range: shooters try to stay between min and max px from you
export const BOTS = {
  shooter: {
    name: 'Shooter',
    color: 0xd62828,
    hp: 100,
    jetpack: true,
    range: { min: 200, max: 480 },
    respawnDelay: 3000,
  },
};

// How every bot thinks. Starting values, tune in playtests.
export const BOT_AI = {
  thinkMs: 150,           // reaction time: how often a bot rethinks (±20%)
  memoryMs: 4000,         // keeps hunting where it last saw you for this long
  arrivePx: 16,           // close enough to its goal to stop walking
  strafeChance: 0.3,      // at a good range: chance per think to side-step
  strafePx: 80,

  // Jetpack
  climbMarginPx: 48,      // flies up when its goal is this much higher
  hoverFallSpeed: 30,     // over a gap or the void: thrusts when falling faster
  crossFuel: 40,          // won't start crossing a gap with less fuel
  reserveFuel: 25,        // under this, it lands to refuel...
  refuelTo: 90,           // ...and stays down until it has this much
  landSearchPx: 800,      // over the void: how far it looks for ground
  fuelSafety: 1.4,        // flights are planned with this much extra fuel
  returnMarginFuel: 15,   // and this much left over on arrival
  landInsetPx: 24,        // lands this far in from an edge, not right on it
  stuckMs: 600,           // not moving while trying to: hop up to get unstuck

  // Fall credit: a bot that falls into the void counts as your kill if you
  // did at least this share of its HP in the last windowMs.
  fallCredit: { windowMs: 10000, share: 0.5 },
};
