// Phase 6 effects: blood, sparks, splats and gibs (death pieces).
// Everything is placeholder shapes for now (circles and rectangles), like
// the rest of the game; the art pass can swap in sprites later.

// Gore setting (F2 cycles it in game; the Settings menu comes in Phase 9).
//   off:     no blood or gibs: white impact flakes, deaths go up in a puff
//   cartoon: bright round drops, small splats, chunky body pieces (default)
//   full:    more and darker blood, bigger splats that stay longer, red bits
export const GORE = {
  levels: ['off', 'cartoon', 'full'],
  default: 'cartoon',
  toggleKey: 'F2',
  storageKey: 'keys-militia.gore', // remembered in this browser
};

// What a character is made of decides what comes out when it's hit.
// Each family has a default; a BOTS entry can set `material` to override.
export const FAMILY_MATERIAL = {
  military: 'flesh',
  undead: 'undead',
  machines: 'machine',
  scifi: 'alien',
  animals: 'flesh',
};

// colors: blood or bits (first = bright, used in cartoon; all are used in full)
// sparks: hits also throw sparks (machines)
// splat:  leaves splats on the ground (not for gore 'off')
// gibs:   what the body breaks into on death ('flesh' = body-colored chunks,
//         'metal' = grey plates and bolts, 'bone' = white sticks, 'straw')
export const MATERIALS = {
  flesh: { colors: [0xe01e37, 0xa4161a, 0x6a040f], splat: true, gibs: 'flesh' },
  undead: { colors: [0x6b8f3a, 0x4a5d23, 0x3a2e1f], splat: true, gibs: 'flesh' },
  alien: { colors: [0x70e000, 0x38b000, 0x007200], splat: true, gibs: 'flesh' },
  mutant: { colors: [0x9d4edd, 0x7b2cbf, 0x5a189a], splat: true, gibs: 'flesh' },
  cyborg: { colors: [0xe01e37, 0xa4161a], sparks: true, splat: true, gibs: 'metal' },
  bone: { colors: [0xf8f9fa, 0xdee2e6, 0xadb5bd], splat: false, gibs: 'bone' },
  machine: { colors: [0x343a40, 0x212529], sparks: true, splat: true, gibs: 'metal' }, // oil
  straw: { colors: [0xe9c46a, 0xd4a373], splat: false, gibs: 'straw' },              // dummies
};

// How each gore level looks. Numbers are per hit unless said otherwise.
export const GORE_LEVELS = {
  off: {
    blood: false,
    flakes: 3,            // white impact flakes instead of blood
    splats: false,
    gibs: false,
  },
  cartoon: {
    blood: true,
    dropsPerDamage: 1 / 6, // 30 damage -> 5 drops
    minDrops: 3,
    maxDrops: 8,
    dropSize: [2.5, 4.5],
    dropLifeMs: 500,
    colorCount: 1,         // only the bright color
    splats: true,
    splatSize: [5, 9],
    splatLifeMs: 4000,
    maxSplats: 20,
    gibs: true,
    gibPieces: 5,
    gibRedBits: 0,
    gibLifeMs: 2500,
    gibTrail: false,
  },
  full: {
    blood: true,
    dropsPerDamage: 1 / 3,
    minDrops: 4,
    maxDrops: 16,
    dropSize: [2, 5],
    dropLifeMs: 700,
    colorCount: 3,
    splats: true,
    splatSize: [7, 15],
    splatLifeMs: 12000,
    maxSplats: 40,
    gibs: true,
    gibPieces: 7,
    gibRedBits: 5,
    gibLifeMs: 5000,
    gibTrail: true,        // pieces drip as they fly
  },
};

// How the hit kind shapes the spray (see takeDamage kinds).
//   spreadDeg: cone around the hit direction (360 = every way)
//   speed:     [min, max] px/s
//   countScale: more or fewer drops than a bullet
export const HIT_SPRAY = {
  bullet: { spreadDeg: 50, speed: [120, 280], countScale: 1 },
  melee: { spreadDeg: 100, speed: [100, 240], countScale: 1.5 },
  blast: { spreadDeg: 360, speed: [150, 360], countScale: 2 },
  fire: { ash: true }, // no blood: a few grey ash puffs
};

export const GIBS = {
  maxActive: 60,         // oldest pieces go first past this
  speed: [140, 340],     // px/s outward
  lift: [180, 380],      // px/s upward
  spin: 12,              // radians/s max
  bounce: 0.35,
  poofColor: 0xdee2e6,   // smoke puff when a body vanishes (gore off) or a machine blows apart
};

export const SPARKS = {
  colors: [0xffd166, 0xff9f1c, 0xffffff],
  count: 6,
  speed: [180, 420],
  lifeMs: 250,
};