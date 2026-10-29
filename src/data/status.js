// Status effects: one shared system for every character (you and bots).
// Phase 5.5 builds them as the weapons that cause them arrive.
//   burning: damage over time (Flamethrower now; Molotov later)
//   pinned:  nailed in place (Nail Gun): can't run, jump or fly. In the
//            air it drops straight down and stays put where it lands.
// Later: shocked (EMP), dazed (concussion), blinded (flashbang),
// gassed, frozen (cryo).
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
};