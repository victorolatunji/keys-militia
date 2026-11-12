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
//   bleeding: Combat Axe. The axe stays stuck in the body for a while and
//            the wound bleeds (damage over time, blood dripping). No pin:
//            they can still move. More axes = more axes stuck in them.
//   gassed:  Gas Grenade. Shown while you breathe it (the cloud does the damage).
// Tacticals affect anyone in range they can reach, you included.
export const STATUS = {
  burning: {
    noLabel: true,      // no "burning" text: the flames on the body say it
    flameArt: 'flame-puff', flameSize: [18, 28], flameEveryMs: 50, flameAlpha: 0.9, // flames licking up the body (projectiles art), a little see-through
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
    nails: 3,           // nails stuck in a pinned character (the Nail Gun's nail art)
    nailSize: 24,       // px long
  },
  bleeding: {
    durationMs: 5000,   // the axe falls out after this (a new axe restarts it)
    dps: 4,             // blood loss per second while it's stuck (20 over 5s)
    tickMs: 500,
    dripMs: 160,        // a drop of blood this often
    maxAxes: 3,         // axes drawn stuck in one body at once
    axeScale: 0.85,     // size of the stuck axe (its icon)
    textColor: '#e01e37',
  },
  grabbed: {
    durationMs: 1400,   // Graveyard hands: held in place (like pinned, no nails)
    textColor: '#8a9a5b',
  },
  gassed: {
    durationMs: 1200,   // coughing a moment after you get out (damage is from the cloud)
    textColor: '#9ef01a',
    fxColor: 0x9ef01a,
  },
  blinded: {
    durationMs: 3000,   // flashbang sets its own (longer up close)
    textColor: '#ffffff',
    fxColor: 0xffffff,
  },
  dazed: {
    durationMs: 4000,
    moveScale: 0.35,    // run, fly and float speed: a dazed stagger
    riseScale: 0.35,    // jetpack barely climbs
    attackScale: 1.6,   // bots take this much longer between attacks
    textColor: '#f4d35e',
    fxColor: 0xf4d35e,  // little stars over the head
  },
  shocked: {
    durationMs: 4000,
    attackScale: 1.3,
    textColor: '#4cc9f0',
    fxColor: 0x4cc9f0,  // sparks
    arcArt: ['arc-1', 'arc-2'], arcSize: [34, 54], // lightning crackling over the body (effects art)
  },
  frozen: {
    durationMs: 4000,
    moveScale: 0.35,
    attackScale: 1.8,
    textColor: '#a8dadc',
    fxColor: 0xa8dadc,  // ice over the body
    ice: { alpha: 0.55, edge: 0xffffff, edgeAlpha: 0.85, facets: 0xffffff, sides: 9, rough: 0.16 }, // a rough block of ice around the body (drawn: jagged sides, cracks)
  },
};
