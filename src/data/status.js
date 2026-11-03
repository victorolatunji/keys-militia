// Status effects: one shared system for every character (you and bots).
// Phase 5.5 builds them as the weapons that cause them arrive.
//   burning: damage over time (Flamethrower now; Molotov later)
//   pinned:  nailed in place (Nail Gun): can't run, jump or fly. In the
//            air it drops straight down and stays put where it lands.
//   blinded: Flashbang. Bots can't see you (no shooting, they lose track).
//            You: a white screen that fades out (words hidden under it).
//   dazed:   Concussion. Slow running, weak jetpack, slower attacks.
//   shocked: EMP. Jetpack and Jet Boost dead (you fall), no gun switching.
//            Drones drop out of the sky. Machines also take EMP damage.
//   frozen:  Cryo. Very slow, jetpack frozen, slower attacks.
// Tacticals affect anyone in range they can reach, you included.
export const STATUS = {
  burning: {
    durationMs: 5000,   // a new hit restarts the timer
    dps: 6,             // damage per second while burning
    tickMs: 500,        // damage lands in small ticks
    flameColor: 0xe5383b,    // red flames...
    flameCoreColor: 0xff9f1c, // ...with an orange core
    textColor: '#e5383b',
  },
  pinned: {
    durationMs: 4000,
    textColor: '#c9c9c9',
    nailColor: 0xadb5bd,
    nails: 3,           // nails drawn sticking out of a pinned character
  },
  blinded: {
    durationMs: 3000,   // flashbang sets its own (longer up close)
    textColor: '#ffffff',
    fxColor: 0xffffff,
  },
  dazed: {
    durationMs: 4000,
    moveScale: 0.55,    // run, fly and float speed
    riseScale: 0.5,     // jetpack climbs at half speed
    attackScale: 1.6,   // bots take this much longer between attacks
    textColor: '#f4d35e',
    fxColor: 0xf4d35e,  // little stars over the head
  },
  shocked: {
    durationMs: 4000,
    attackScale: 1.3,
    textColor: '#4cc9f0',
    fxColor: 0x4cc9f0,  // sparks
  },
  frozen: {
    durationMs: 4000,
    moveScale: 0.35,
    attackScale: 1.8,
    textColor: '#a8dadc',
    fxColor: 0xa8dadc,  // ice over the body
  },
};