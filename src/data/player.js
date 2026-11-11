// Movement tuning for all characters (characters are cosmetic, same stats).
export const PLAYER = {
  width: 32,
  height: 48,
  color: 0x4cc9f0,      // placeholder team accent
  callsign: 'ROOKIE',   // the name over your head (the story names you later)
  eyeColor: 0xffffff,   // small marker showing which way you face
  flameColor: 0xff9f1c,

  // Health
  maxHp: 100,
  regenDelayMs: 4000,   // after this long without taking damage...
  regenPerSec: 8,       // ...HP comes back this fast (0 = no regen; bots: 0)

  // Running and air control
  runSpeed: 260,        // px per second on the ground
  airSpeed: 280,        // px per second in the air
  maxFallSpeed: 900,    // terminal velocity

  // Jetpack (world gravity is 800, so thrust must beat it)
  jetThrust: 1800,      // upward acceleration while holding Up
  maxRiseSpeed: 380,    // cap on upward speed
  descendBoost: 900,    // extra downward acceleration while holding Down in the air

  // Fuel
  fuelMax: 100,
  fuelDrain: 35,        // per second while thrusting (about 3s of flight)
  fuelRefill: 60,       // per second while standing on the ground

  // Typing state
  typingFallSpeed: 60,  // max fall speed while typing mid-air (slow drift)
  crouch: { height: 0.65, speed: 0.35 }, // Down on the ground: a smaller target (hitbox height share), shuffling slowly
  typoJamMs: 500,       // gun jam after a typo; letters are ignored

  // Blast knockback: no control for this long, so the push isn't cancelled
  knockbackStaggerMs: 350,

  // Death and respawn
  respawnDelay: 1500,   // ms between dying and dropping back in
  spawnAt: [0.2, 0.5, 0.8], // you drop in near one of these (shares of the map width), at random
  spawnDrop: { heightPx: 260, flatPx: 40, hazardPx: 140, edgePx: 96, gapPx: 160, everywhere: ['hands', 'meteor', 'rockfall'] }, // dropping in: from this high over the top level, ground flat this far either side, this far from hazards and the map's sides, not down a gap (hazards that strike all over the map, like the graveyard's hands, don't count), with ground far higher either side (that's a lower level), each spot within its own third of the map
};