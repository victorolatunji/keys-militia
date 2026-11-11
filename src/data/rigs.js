// Character rigs (art pass): how the cut body parts in public/assets/sprites
// fit together, how big a character is drawn, and how it poses.
// The parts' sizes and joint points come from spriteManifest.js (made by
// tools/pack-sprites.py); everything you'd tune by hand lives here.
//
// A rig is a Phaser Container (a group that moves, turns and flips as one)
// holding the parts, with smaller containers at the joints: shoulder ->
// elbow -> hand, hip -> knee. Turning a joint turns everything below it.
// Angles are in degrees, clockwise; 0 = a limb hanging straight down.

// Which sprite folder each character uses (Bot configs go by their name).
export const RIG_FOLDERS = {
  player: 'player',
  Soldier: 'soldier', Mercenary: 'mercenary', Commando: 'commando', 'Armoured Trooper': 'trooper',
  Zombie: 'zombie', Skeleton: 'skeleton', 'Infected Soldier': 'infected',
  Android: 'android', Robot: 'robot', 'Scrap Bot': 'scrapbot', Drone: 'drone',
  Alien: 'alien', Cyborg: 'cyborg', Mutant: 'mutant', 'Zombie K9': 'k9',
};

export const RIG = {
  heightScale: 1.55,     // drawn this many times the hitbox's height (head and hair stick out)
  backTint: 0xb4b4b4,    // back arm and leg: a bit darker, so they read as further away
  flashMs: 80,           // hit flash (white)
  depth: 12,             // above the map, below word labels

  // Where things sit on the torso, as fractions of its width and height
  // (x from its back, y from its top). Per-character fixes go in OVERRIDES.
  torso: {
    hip: [0.5, 0.93],
    neck: [0.52, 0.06],
    shoulderFront: [0.5, 0.2],
    shoulderBack: [0.4, 0.18],
    hipFront: [0.55, 0.93],
    hipBack: [0.42, 0.91],
    back: [0.12, 0.32],   // where the jetpack straps on
  },
  head: { neck: [0.45, 0.96], scale: 1 },   // the bottom of the neck; scale >1 for a bigger, cartoonier head
  jetpack: { strap: [0.78, 0.35], nozzle: [0.3, 0.97] },

  // Poses (degrees)
  stand: { thighF: -3, shinF: 2, thighB: 4, shinB: 2, lean: 0 },
  run: { swing: 34, knee: 38, lean: 6, bob: 3, stride: 0.055 }, // stride: run cycle per px moved
  fly: { thighF: 22, shinF: 38, thighB: 8, shinB: 48, lean: 8 },
  fall: { thighF: -8, shinF: 30, thighB: 14, shinB: 26, lean: -2 },
  aim: {
    restDeg: 12,          // where the gun points when there's no target (a little down)
    clamp: [-80, 80],     // how far up / down it can point
    upperF: 28, foreF: -42, // front arm: upper arm a bit lower than the gun, forearm bent up
    upperB: 12, foreB: -58, // back arm reaches forward to steady the gun
    headFollow: 0.3,
  },
  melee: { holdDeg: -55 },  // a melee weapon is held up, ready to swing
};

// Per-character fixes (same keys as RIG.torso / RIG.head / RIG.jetpack).
export const OVERRIDES = {
  player: {},
  soldier: {},
};

// Held weapons. Lengths are fractions of the character's drawn height (the
// art came in different sizes, so each gun is scaled to its family's length).
export const WEAPON_LENGTH = {
  pistol: 0.3, smg: 0.38, assault: 0.5, shotgun: 0.55, lmg: 0.62, marksman: 0.6, rifle: 0.66,
  launcher: 0.62, special: 0.5,
};
export const MELEE_LENGTH = { knife: 0.26, machete: 0.42, bat: 0.5, hammer: 0.48, axe: 0.52, spade: 0.56, sword: 0.66 };

// Where the hand holds each gun: the top of its pistol grip, as fractions
// of the gun's width and height (the art points right). Measured by eye.
export const GRIPS = {
  ak117: [0.27, 0.6], ak47: [0.28, 0.62], arctic50: [0.21, 0.72], asVal: [0.27, 0.65], by15: [0.33, 0.55],
  chopper: [0.17, 0.65], desertEagle: [0.3, 0.55], dlq33: [0.33, 0.65], fennec: [0.3, 0.6],
  flamethrower: [0.09, 0.65], holger26: [0.26, 0.62], kilo141: [0.27, 0.62], kiloBoltAction: [0.26, 0.55],
  krm262: [0.3, 0.62], laser: [0.18, 0.7], m13: [0.29, 0.62], m4: [0.26, 0.62], m4lmg: [0.23, 0.62],
  mac10: [0.43, 0.55], mk2: [0.29, 0.55], mw11: [0.3, 0.55], nailGun: [0.25, 0.62], oden: [0.2, 0.62],
  pkm: [0.21, 0.62], pp19Bizon: [0.29, 0.62], qq9: [0.28, 0.55], renetti: [0.32, 0.55], rpd: [0.24, 0.62],
  rus79u: [0.16, 0.55], sawGun: [0.18, 0.72], smrs: [0.6, 0.6], striker: [0.33, 0.62], switchblade: [0.32, 0.55],
  thumper: [0.4, 0.68], type25: [0.3, 0.62], warMachine: [0.28, 0.65], zrg20mm: [0.19, 0.62],
};
export const MELEE_GRIP = [0.12, 0.5];   // the handle end
export const THROWABLE_SIZE = 0.15;      // a throwable in the hand, as a fraction of the drawn height
// Throwable art whose file name differs from its THROWABLES key.
export const THROWABLE_ART = { grenade: 'frag' };
