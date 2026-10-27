// Weapon stats. HP is in points (dummies and players have 100).
// wordList picks from words.js: short / medium / long / extraLong.
// Starting values, tune in playtests (README open decision).
//
// category: the weapon family (see WEAPON_CATEGORIES).
// damage: total damage of one attack (one finished word, or one LMG burst).
// hits: how that damage is delivered (default 1).
//   hitDelayMs > 0: a burst, hits land one after another (SMGs, LMGs).
//   hitDelayMs 0:   pellets, all at once in a spread (shotguns).
// wordsPerShot: words you must finish to fire once (LMGs: 2 = spin up, then
//   a long burst). The words can be on different enemies; the burst goes to
//   the last one. Spin is lost after spinWindowMs without a finished word.
// ammo: attacks in a full weapon. Starting rule: round(600 / damage), kept
//   between 3 and 40, so stronger weapons get fewer. No reload button:
//   an empty gun is thrown away and you switch to your next weapon.
//   null = never runs out (melee).
// falloff: damage drops with distance from you to the target.
//   Full damage up to startPx, then a straight line down to
//   minMultiplier at endPx (and beyond). null = full damage at any range.
//   A finished word always hits; only the damage changes.
//
// Melee only: reach (px from you to the target: words only show on enemies
//   this close) and knockback (px/s push on a hit; bots move, dummies don't).
//
// Launchers only: finishing a word fires a round at the target instead of
// hitting it directly. damage is the total of one attack (for the HUD and
// the ammo rule); the real damage is the blast of each round.
//   projectile.kind: 'rocket' (straight), 'shell' (lobbed, explodes on impact),
//     'bomb' (lobbed, bounces, explodes on its fuse)
//   projectile.count / delayMs / spread: several rounds per word (War Machine)
//   projectile.flightMs: time a lobbed round takes to reach the target
//   blast: same settings as a grenade's blast (falloff, walls block it,
//     knockback). selfDamage 0.5: it hurts you at half strength if you're too close.
export const WEAPONS = {
  // ---- Pistols: short words, light damage ----
  mw11: {
    key: 'mw11',
    name: 'MW11',
    category: 'pistol',
    wordList: 'short',
    damage: 25,
    ammo: 24,
    falloff: { startPx: 250, endPx: 600, minMultiplier: 0.5 },
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },
  desertEagle: {
    key: 'desertEagle',
    name: 'Desert Eagle',
    category: 'pistol',
    wordList: 'short',
    damage: 40,
    ammo: 15,
    falloff: { startPx: 300, endPx: 650, minMultiplier: 0.6 },
    tracerColor: 0xffe066,
    tracerWidth: 3,
  },
  renetti: {
    key: 'renetti',
    name: 'Renetti',
    category: 'pistol',
    wordList: 'short',
    damage: 27,
    hits: 3,
    hitDelayMs: 50,
    ammo: 22,
    falloff: { startPx: 230, endPx: 560, minMultiplier: 0.5 },
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },

  // ---- SMGs: short words, each word is a quick burst ----
  rus79u: {
    key: 'rus79u',
    name: 'RUS-79U',
    category: 'smg',
    wordList: 'short',
    damage: 24,
    hits: 2,
    hitDelayMs: 70,
    ammo: 25,
    falloff: { startPx: 220, endPx: 550, minMultiplier: 0.45 },
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },
  switchblade: {
    key: 'switchblade',
    name: 'Switchblade',
    category: 'smg',
    wordList: 'short',
    damage: 21,
    hits: 3,
    hitDelayMs: 50,
    ammo: 29,
    falloff: { startPx: 180, endPx: 450, minMultiplier: 0.4 },
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },
  qq9: {
    key: 'qq9',
    name: 'QQ9',
    category: 'smg',
    wordList: 'short',
    damage: 30,
    hits: 3,
    hitDelayMs: 60,
    ammo: 20,
    falloff: { startPx: 250, endPx: 600, minMultiplier: 0.5 },
    tracerColor: 0xffd166,
    tracerWidth: 2,
  },
  fennec: {
    key: 'fennec',
    name: 'Fennec',
    category: 'smg',
    wordList: 'short',
    damage: 25,
    hits: 5,
    hitDelayMs: 30,
    ammo: 24,
    falloff: { startPx: 150, endPx: 400, minMultiplier: 0.35 },
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },
  mac10: {
    key: 'mac10',
    name: 'MAC10',
    category: 'smg',
    wordList: 'short',
    damage: 22,
    hits: 4,
    hitDelayMs: 35,
    ammo: 27,
    falloff: { startPx: 160, endPx: 420, minMultiplier: 0.35 },
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },
  pp19Bizon: {
    key: 'pp19Bizon',
    name: 'PP19 Bizon',
    category: 'smg',
    wordList: 'short',
    damage: 18,
    hits: 2,
    hitDelayMs: 60,
    ammo: 33,
    falloff: { startPx: 240, endPx: 560, minMultiplier: 0.5 },
    tracerColor: 0xffd166,
    tracerWidth: 2,
  },

  // ---- Shotguns: short words, pellets, brutal up close, weak far away ----
  by15: {
    key: 'by15',
    name: 'BY15',
    category: 'shotgun',
    wordList: 'short',
    damage: 60,
    hits: 6,
    hitDelayMs: 0,
    ammo: 10,
    falloff: { startPx: 120, endPx: 320, minMultiplier: 0.2 },
    tracerColor: 0xffb703,
    tracerWidth: 2,
  },
  krm262: {
    key: 'krm262',
    name: 'KRM-262',
    category: 'shotgun',
    wordList: 'short',
    damage: 75,
    hits: 8,
    hitDelayMs: 0,
    ammo: 8,
    falloff: { startPx: 100, endPx: 280, minMultiplier: 0.15 },
    tracerColor: 0xffb703,
    tracerWidth: 2,
  },
  striker: {
    key: 'striker',
    name: 'Striker',
    category: 'shotgun',
    wordList: 'short',
    damage: 45,
    hits: 5,
    hitDelayMs: 0,
    ammo: 13,
    falloff: { startPx: 140, endPx: 340, minMultiplier: 0.25 },
    tracerColor: 0xffb703,
    tracerWidth: 2,
  },

  // ---- Assault rifles: medium words, all-rounders (AS VAL: short words, short range) ----
  ak47: {
    key: 'ak47',
    name: 'AK-47',
    category: 'assault',
    wordList: 'medium',
    damage: 34,
    ammo: 18,
    falloff: { startPx: 350, endPx: 700, minMultiplier: 0.6 },
    tracerColor: 0xffd166,
    tracerWidth: 3,
  },
  m4: {
    key: 'm4',
    name: 'M4',
    category: 'assault',
    wordList: 'medium',
    damage: 30,
    ammo: 20,
    falloff: { startPx: 300, endPx: 650, minMultiplier: 0.55 },
    tracerColor: 0xffd166,
    tracerWidth: 3,
  },
  ak117: {
    key: 'ak117',
    name: 'AK117',
    category: 'assault',
    wordList: 'medium',
    damage: 32,
    hits: 2,
    hitDelayMs: 55,
    ammo: 19,
    falloff: { startPx: 330, endPx: 680, minMultiplier: 0.6 },
    tracerColor: 0xffd166,
    tracerWidth: 3,
  },
  type25: {
    key: 'type25',
    name: 'Type 25',
    category: 'assault',
    wordList: 'medium',
    damage: 28,
    hits: 3,
    hitDelayMs: 45,
    ammo: 21,
    falloff: { startPx: 280, endPx: 620, minMultiplier: 0.5 },
    tracerColor: 0xffd166,
    tracerWidth: 3,
  },
  m13: {
    key: 'm13',
    name: 'M13',
    category: 'assault',
    wordList: 'medium',
    damage: 30,
    hits: 2,
    hitDelayMs: 50,
    ammo: 20,
    falloff: { startPx: 320, endPx: 680, minMultiplier: 0.6 },
    tracerColor: 0xffd166,
    tracerWidth: 3,
  },
  kilo141: {
    key: 'kilo141',
    name: 'Kilo 141',
    category: 'assault',
    wordList: 'medium',
    damage: 45,
    ammo: 13,
    falloff: { startPx: 400, endPx: 750, minMultiplier: 0.7 },
    tracerColor: 0xffc300,
    tracerWidth: 4,
  },
  oden: {
    key: 'oden',
    name: 'Oden',
    category: 'assault',
    wordList: 'medium',
    damage: 50,
    ammo: 12,
    falloff: { startPx: 450, endPx: 800, minMultiplier: 0.75 },
    tracerColor: 0xffc300,
    tracerWidth: 4,
  },
  asVal: {
    key: 'asVal',
    name: 'AS VAL',
    category: 'assault',
    wordList: 'short',
    damage: 30,
    hits: 3,
    hitDelayMs: 40,
    ammo: 20,
    falloff: { startPx: 200, endPx: 500, minMultiplier: 0.45 },
    tracerColor: 0xcdeac0,
    tracerWidth: 2,
  },

  // ---- LMGs: finish 2 words to unleash one long burst ----
  rpd: {
    key: 'rpd',
    name: 'RPD',
    category: 'lmg',
    wordList: 'short',
    wordsPerShot: 2,
    spinWindowMs: 3000,
    damage: 72,
    hits: 4,
    hitDelayMs: 70,
    ammo: 8,
    falloff: { startPx: 350, endPx: 750, minMultiplier: 0.6 },
    tracerColor: 0xff9f1c,
    tracerWidth: 3,
  },
  chopper: {
    key: 'chopper',
    name: 'Chopper',
    category: 'lmg',
    wordList: 'short',
    wordsPerShot: 2,
    spinWindowMs: 2000,
    damage: 84,
    hits: 7,
    hitDelayMs: 40,
    ammo: 7,
    falloff: { startPx: 250, endPx: 600, minMultiplier: 0.45 },
    tracerColor: 0xff9f1c,
    tracerWidth: 2,
  },
  m4lmg: {
    key: 'm4lmg',
    name: 'M4LMG',
    category: 'lmg',
    wordList: 'medium',
    wordsPerShot: 2,
    spinWindowMs: 3500,
    damage: 66,
    hits: 3,
    hitDelayMs: 90,
    ammo: 9,
    falloff: { startPx: 400, endPx: 800, minMultiplier: 0.7 },
    tracerColor: 0xff9f1c,
    tracerWidth: 4,
  },
  holger26: {
    key: 'holger26',
    name: 'Holger 26',
    category: 'lmg',
    wordList: 'short',
    wordsPerShot: 2,
    spinWindowMs: 3500,
    damage: 60,
    hits: 3,
    hitDelayMs: 60,
    ammo: 10,
    falloff: { startPx: 380, endPx: 780, minMultiplier: 0.65 },
    tracerColor: 0xff9f1c,
    tracerWidth: 3,
  },
  pkm: {
    key: 'pkm',
    name: 'PKM',
    category: 'lmg',
    wordList: 'medium',
    wordsPerShot: 2,
    spinWindowMs: 3000,
    damage: 96,
    hits: 4,
    hitDelayMs: 80,
    ammo: 6,
    falloff: { startPx: 400, endPx: 800, minMultiplier: 0.7 },
    tracerColor: 0xff9f1c,
    tracerWidth: 4,
  },

  // ---- Marksman rifles: long words, full damage at any range ----
  kiloBoltAction: {
    key: 'kiloBoltAction',
    name: 'Kilo Bolt-Action',
    category: 'marksman',
    wordList: 'long',
    damage: 60,
    ammo: 10,
    falloff: null,
    tracerColor: 0xe0fbfc,
    tracerWidth: 4,
  },
  mk2: {
    key: 'mk2',
    name: 'MK2',
    category: 'marksman',
    wordList: 'long',
    damage: 70,
    hits: 2,
    hitDelayMs: 90,
    ammo: 9,
    falloff: null,
    tracerColor: 0xe0fbfc,
    tracerWidth: 4,
  },

  // ---- Snipers: long and extra-long words, one heavy hit ----
  dlq33: {
    key: 'dlq33',
    name: 'DL Q33',
    category: 'rifle',
    wordList: 'extraLong',
    damage: 100,
    ammo: 6,
    falloff: null,        // long words buy full damage at any range
    tracerColor: 0xffffff,
    tracerWidth: 5,
  },
  arctic50: {
    key: 'arctic50',
    name: 'Arctic .50',
    category: 'rifle',
    wordList: 'long',     // quicker words, a bit less damage
    damage: 85,
    ammo: 7,
    falloff: null,
    tracerColor: 0xffffff,
    tracerWidth: 4,
  },
  zrg20mm: {
    key: 'zrg20mm',
    name: 'ZRG 20mm',
    category: 'rifle',
    wordList: 'extraLong',
    damage: 140,          // heavy hitter, very little ammo
    ammo: 4,
    falloff: null,
    tracerColor: 0xffffff,
    tracerWidth: 7,
  },

  // ---- Launchers: medium words, the round flies to the target and explodes ----
  smrs: {
    key: 'smrs',
    name: 'SMRS',
    category: 'launcher',
    wordList: 'medium',
    damage: 130,
    ammo: 5,
    falloff: null,
    projectile: {
      kind: 'rocket',
      speed: 750,           // px per second, straight line
      radius: 5,
      color: 0xe9ecef,
      trailColor: 0xff9f1c,
      gravity: false,
      explodeOnImpact: true,
      maxLifeMs: 2500,
    },
    blast: {
      damage: 130,
      directHitRadius: 30,
      blastRadius: 110,
      selfDamage: 0.5,      // half damage to you if you're caught in it
      knockback: 560,
      knockbackLift: 240,
      knockbackFullAt: 40,
    },
  },
  thumper: {
    key: 'thumper',
    name: 'Thumper',
    category: 'launcher',
    wordList: 'medium',
    damage: 100,
    ammo: 6,
    falloff: null,
    projectile: {
      kind: 'shell',
      flightMs: 650,        // lobbed arc that lands on the target
      radius: 5,
      color: 0x3d5a40,
      trailColor: 0x9a9a9a,
      gravity: true,
      explodeOnImpact: true,
      maxLifeMs: 3000,
    },
    blast: {
      damage: 100,
      directHitRadius: 28,
      blastRadius: 100,
      selfDamage: 0.5,      // half damage to you if you're caught in it
      knockback: 500,
      knockbackLift: 220,
      knockbackFullAt: 40,
    },
  },
  warMachine: {
    key: 'warMachine',
    name: 'War Machine',
    category: 'launcher',
    wordList: 'medium',
    damage: 165,            // 3 bombs x 55
    ammo: 4,
    falloff: null,
    projectile: {
      kind: 'bomb',
      count: 3,             // bombs per word
      delayMs: 120,         // between bombs
      spread: 0.15,         // +-15% random range per bomb
      flightMs: 600,
      fuseExtraMs: 350,     // explode this long after landing time
      radius: 5,
      color: 0x2b2d42,
      trailColor: null,
      gravity: true,
      bounce: 0.4,
      explodeOnImpact: false,
      maxLifeMs: 3000,
    },
    blast: {
      damage: 55,
      directHitRadius: 24,
      blastRadius: 90,
      selfDamage: 0.5,      // half damage to you if you're caught in it
      knockback: 420,
      knockbackLift: 200,
      knockbackFullAt: 40,
    },
  },

  // ---- Melee: always in your melee slot, never runs out ----
  knife: {
    key: 'knife',
    name: 'Knife',
    category: 'melee',
    wordList: 'short',
    damage: 35,
    ammo: null,
    reach: 64,
    knockback: 0,
    swingColor: 0xdfe7ef,
  },
  machete: {
    key: 'machete',
    name: 'Machete',
    category: 'melee',
    wordList: 'short',
    damage: 45,
    ammo: null,
    reach: 72,
    knockback: 0,
    swingColor: 0xdfe7ef,
  },
  bat: {
    key: 'bat',
    name: 'Bat',
    category: 'melee',
    wordList: 'short',
    damage: 35,
    ammo: null,
    reach: 76,
    knockback: 340,
    swingColor: 0xc8a165,
  },
  spade: {
    key: 'spade',
    name: 'Spade',
    category: 'melee',
    wordList: 'short',
    damage: 40,
    ammo: null,
    reach: 78,
    knockback: 240,
    swingColor: 0x9aa5b1,
  },
  hammer: {
    key: 'hammer',
    name: 'Hammer',
    category: 'melee',
    wordList: 'short',
    damage: 55,
    ammo: null,
    reach: 68,
    knockback: 280,
    swingColor: 0x9aa5b1,
  },
  sword: {
    key: 'sword',
    name: 'Sword',
    category: 'melee',
    wordList: 'medium',
    damage: 60,
    ammo: null,
    reach: 86,
    knockback: 0,
    swingColor: 0xf1faee,
  },
  axe: {
    key: 'axe',
    name: 'Axe',
    category: 'melee',
    wordList: 'medium',
    damage: 70,
    ammo: null,
    reach: 74,
    knockback: 120,
    swingColor: 0xdfe7ef,
  },
};

// Weapon families. Specials arrive in Phase 5.5.
export const WEAPON_CATEGORIES = {
  melee: { name: 'Melee' },
  pistol: { name: 'Pistol' },
  smg: { name: 'SMG' },
  shotgun: { name: 'Shotgun' },
  assault: { name: 'Assault rifle' },
  lmg: { name: 'LMG' },
  marksman: { name: 'Marksman' },
  rifle: { name: 'Sniper' },
  launcher: { name: 'Launcher' },
};

// Throwables: thrown with Space, no word needed.
// All share the blast logic in WeaponSystem; each sets its own numbers.
// Special effects (fire, EMP, sticky) will be added per throwable later.
export const THROWABLES = {
  grenade: {
    key: 'grenade',
    name: 'Grenade',
    radius: 6,
    color: 0x3d5a40,
    fuseMs: 1800,         // time from throw to explosion
    bounce: 0.45,         // 0 = no bounce, 1 = bounces forever
    groundFriction: 0.92, // horizontal speed kept per frame while rolling
    minSpeed: 250,        // tap Space
    maxSpeed: 750,        // full charge
    chargeMs: 900,        // time to reach full power
    damage: 100,          // full damage (direct hit)
    directHitRadius: 28,  // within this distance: full damage
    blastRadius: 120,     // damage falls to 0 at this distance
    selfDamage: 1,        // 1 = hurts you fully, 0 = safe for you
    knockback: 520,       // px/s push away from the blast at full strength
    knockbackLift: 220,   // extra upward px/s so you pop off the ground
    knockbackFullAt: 40,  // damage at or above this gives the full push
    mass: 0.2,            // vs 1 for characters: bounces off them, barely moves them
    ownerIgnoreMs: 300,   // passes through the thrower right after the throw
    maxCarry: 6,          // most you can hold (airdrops can top you up)
  },
};

// Aiming while holding Space. Angles in degrees: 0 = straight ahead, negative = up.
export const AIM = {
  startAngle: -30,
  minAngle: -80,
  maxAngle: 45,
  turnSpeed: 120,  // degrees per second while holding Up/Down
};

// Time to swap guns. Letters are ignored meanwhile.
export const GUN_SWITCH_MS = 300;

// What you spawn with. Final default (README): one basic gun + melee;
// two guns for now so there's plenty to test.
export const DEFAULT_LOADOUT = {
  guns: ['ak47', 'dlq33'],
  melee: 'knife',
  throwable: { key: 'grenade', count: 3 },
};