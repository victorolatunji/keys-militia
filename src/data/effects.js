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
  gas: { ash: true, color: 0x9ef01a }, // no blood: green cough puffs
  bleed: { drip: true },               // blood loss (axe wound): a few drops, no spray
  drown: { bubbles: true },            // out of breath underwater: bubbles, no blood
};

// Characters inside a cloud change color until they're out.
//   smoke: a hot orange-red, so whoever threw it can pick them out
//   gas:   a choking blue-purple that pulses, and they bleed (blood loss,
//          not shown with gore off)
export const CLOUD_TINTS = {
  smoke: { color: 0xff6d2e, strength: 0.65 },
  gas: {
    colors: [0x7b2cbf, 0x4361ee], // pulses between these
    pulseMs: 700,
    strength: 0.6,
    bleedEveryMs: 300,            // a drop or two of blood this often
  },
};

// Seen through a cloud: a character keeps its exact shape but shows as a
// see-through, glowing silhouette (night-vision style), drawn over the cloud.
//   smoke: night-vision green, and ONLY on enemies of whoever threw it
//          (the thrower and teammates aren't marked: it's their smoke)
//   gas:   hot orange, on anyone choking in it (gas hurts its thrower too)
// fill: inside of the shape (fillAlpha: how see-through), edge: the outline,
// flicker: how much it shimmers, scanlines: night-vision lines across it.
export const CLOUD_VISION = {
  smoke: { fill: 0x1b5e20, fillAlpha: 0.45, edge: 0x9dff8a, edgeWidth: 2, flicker: 0.15, scanlines: true },
  gas: { fill: 0x7a2e00, fillAlpha: 0.4, edge: 0xffb703, edgeWidth: 2, flicker: 0.2, scanlines: false },
};

// How each explosion looks (BlastFx): no circles, just fire, smoke, sparks,
// debris and a scorch mark. size scales everything (radius 120 = 1).
export const BLAST_FX = {
  frag: {
    size: 1, fireballs: 9, smoke: 7, sparks: 16, debris: 8,
    fireColors: [0xff9f1c, 0xff6b00, 0xffd166, 0xe85d04],
    smokeColors: [0x343a40, 0x495057, 0x212529],
    debrisColors: [0x6c584c, 0x495057, 0x3d3d3d],
    scorchMs: 9000, shake: 0.008, shakeMs: 220,
  },
  sticky: {
    size: 0.9, fireballs: 7, smoke: 5, sparks: 14, debris: 6,
    fireColors: [0xff9f1c, 0xffd166, 0xe85d04],
    smokeColors: [0x343a40, 0x495057],
    debrisColors: [0x6a994e, 0x495057, 0x3d3d3d],
    scorchMs: 8000, shake: 0.007, shakeMs: 200,
  },
  rocket: {
    size: 1.25, fireballs: 12, smoke: 10, sparks: 22, debris: 10,
    fireColors: [0xff9f1c, 0xff6b00, 0xffd166, 0xd00000],
    smokeColors: [0x212529, 0x343a40, 0x495057],
    debrisColors: [0x6c584c, 0x495057, 0x3d3d3d],
    scorchMs: 12000, shake: 0.011, shakeMs: 280,
  },
  bomb: {
    size: 1.1, fireballs: 10, smoke: 9, sparks: 20, debris: 10,
    fireColors: [0xff9f1c, 0xffd166, 0xe85d04],
    smokeColors: [0x161a1d, 0x343a40],
    debrisColors: [0x495057, 0xadb5bd, 0xb08968],
    scorchMs: 10000, shake: 0.01, shakeMs: 260,
  },
};

// Blasts reach round corners and through thin walls, weaker: damage and push
// behind a wall are this share (a weapon's blast can set its own wallFactor).
export const BLAST_THROUGH_WALL = 0.55;

// Finishing touches ("juice"): how the game reacts to your actions.
export const JUICE = {
  hitStopMs: 70,                 // the game freezes this long when you land a kill
  killShake: { ms: 110, power: 0.004 },
  // Screen kick on each of your attacks, by weapon family (0 = none).
  shotShake: { ms: 70, pistol: 0.0015, smg: 0.001, assault: 0.002, lmg: 0.0025, shotgun: 0.006, marksman: 0.004, rifle: 0.006, launcher: 0.007, special: 0.002, melee: 0.002 },
  muzzleSmoke: { puffs: 2, color: 0xadb5bd, alpha: 0.45, size: [10, 18], lifeMs: [500, 900], rise: [12, 28] },
  shells: { color: 0xd4a373, size: [2, 4], chance: { smg: 0.5, lmg: 0.5 } }, // brass casings; chance < 1 thins out fast guns
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
