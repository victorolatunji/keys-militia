// Weapon stats. HP is in points (dummies and players have 100).
// wordList picks from words.js: short / medium / long / extraLong.
// Starting values, tune in playtests (README open decision).
//
// category: the weapon family (see WEAPON_CATEGORIES).
// damage: total damage of one attack (one finished word).
// hits: bullets per attack; the damage is split between them (default 1).
//   hitDelayMs > 0: a burst, bullets leave one after another (SMGs: fast
//     and light, assault rifles: steady bursts, LMGs: a long stream).
//   hitDelayMs 0:   pellets, all at once in a spread (shotguns).
//   Bullets fly at the speed of their family (bullets.js) and do their
//   damage when they reach the target. A finished word always hits.
// belt / reloadMs (LMGs): after `belt` bursts the gun spins down to reload
//   for reloadMs. You can't fire it meanwhile: wait, switch, or run.
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
// Every melee weapon does the same damage (they differ in reach and push).
const MELEE_DAMAGE = 40;

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
    hits: 4,
    hitDelayMs: 55,
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
    hits: 5,
    hitDelayMs: 45,
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
    hits: 4,
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
    hits: 7,
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
    hits: 6,
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
    hits: 5,
    hitDelayMs: 50,
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
    hits: 3,
    hitDelayMs: 90,
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
    hits: 3,
    hitDelayMs: 80,
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
    hits: 3,
    hitDelayMs: 75,
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
    hits: 4,
    hitDelayMs: 65,
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
    hits: 3,
    hitDelayMs: 70,
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
    hits: 2,
    hitDelayMs: 110,
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
    hits: 2,
    hitDelayMs: 140,
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
    hits: 4,
    hitDelayMs: 40,
    ammo: 20,
    falloff: { startPx: 200, endPx: 500, minMultiplier: 0.45 },
    tracerColor: 0xcdeac0,
    tracerWidth: 2,
  },

  // ---- LMGs: every word sprays a burst; after a belt of bursts, a reload ----
  rpd: {
    key: 'rpd',
    name: 'RPD',
    category: 'lmg',
    wordList: 'short',
    damage: 50,
    hits: 6,
    hitDelayMs: 55,
    ammo: 10,
    belt: 5,
    reloadMs: 4000,
    falloff: { startPx: 350, endPx: 750, minMultiplier: 0.6 },
    tracerColor: 0xff9f1c,
    tracerWidth: 3,
  },
  chopper: {
    key: 'chopper',
    name: 'Chopper',
    category: 'lmg',
    wordList: 'short',
    damage: 80,
    hits: 8,
    hitDelayMs: 35,
    ammo: 8,
    belt: 3,
    reloadMs: 5000,
    falloff: { startPx: 250, endPx: 600, minMultiplier: 0.45 },
    tracerColor: 0xff9f1c,
    tracerWidth: 2,
  },
  m4lmg: {
    key: 'm4lmg',
    name: 'M4LMG',
    category: 'lmg',
    wordList: 'medium',
    damage: 50,
    hits: 5,
    hitDelayMs: 70,
    ammo: 12,
    belt: 5,
    reloadMs: 4000,
    falloff: { startPx: 400, endPx: 800, minMultiplier: 0.7 },
    tracerColor: 0xff9f1c,
    tracerWidth: 4,
  },
  holger26: {
    key: 'holger26',
    name: 'Holger 26',
    category: 'lmg',
    wordList: 'short',
    damage: 50,
    hits: 6,
    hitDelayMs: 50,
    ammo: 12,
    belt: 5,
    reloadMs: 4000,
    falloff: { startPx: 380, endPx: 780, minMultiplier: 0.65 },
    tracerColor: 0xff9f1c,
    tracerWidth: 3,
  },
  pkm: {
    key: 'pkm',
    name: 'PKM',
    category: 'lmg',
    wordList: 'medium',
    damage: 85,
    hits: 6,
    hitDelayMs: 70,
    ammo: 7,
    belt: 3,
    reloadMs: 5000,
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

  // ---- Specials: player-only, rare crate finds ----
  // Saw Gun: a medium word fires a spinning saw blade that homes in on your
  // target, weaving as it goes (zigzag, wave or diagonal swerves, random per
  // shot). It bounces off walls and keeps homing, cuts any enemy it passes
  // through, then sticks into the target and grinds until its fuse runs out
  // and explodes. If the target dies first it goes after the nearest enemy
  // it can see. damage: rough total of one saw (for the HUD and ammo).
  sawGun: {
    key: 'sawGun',
    name: 'Saw Gun',
    category: 'special',
    wordList: 'medium',
    damage: 110,
    ammo: 5,
    falloff: null,
    saw: {
      speed: 480,           // px per second
      radius: 11,
      color: 0xc0c8d0,
      weavePx: 70,          // how far it swerves off the straight line
      weaveMs: 380,         // time for one swerve
      bounceMs: 160,        // after hitting a wall it flies the bounce for this long, then homes again
      cutDamage: 12,        // enemies it passes through on the way
      grindDps: 40,         // damage per second while stuck in the target
      fuseMinMs: 1200,      // once stuck in, it explodes after 1.2-2s
      fuseMaxMs: 2000,
      maxFlightMs: 3000,    // never reaches anything: explodes after this long
    },
    blast: {
      damage: 50,
      directHitRadius: 26,
      blastRadius: 95,
      selfDamage: 0.5,      // half damage to you if you're caught in it
      knockback: 420,
      knockbackLift: 200,
      knockbackFullAt: 40,
    },
  },

  // Nail Gun: short words, a fast spray of nails. Every nail that lands pins
  // the target (can't run or fly) for a moment.
  nailGun: {
    key: 'nailGun',
    name: 'Nail Gun',
    category: 'special',
    wordList: 'short',
    damage: 30,
    hits: 5,
    hitDelayMs: 45,
    ammo: 18,
    falloff: { startPx: 250, endPx: 550, minMultiplier: 0.5 },
    bullet: { speed: 1300, length: 8, art: 'nail' }, // drawn as a nail (SHOT_ART in bullets.js)
    pins: true,
    tracerColor: 0xadb5bd,
    tracerWidth: 2,
  },
  // Laser Gun: a long word fires a beam that goes through your target and
  // every enemy behind it in a straight line, until a wall stops it.
  laser: {
    key: 'laser',
    name: 'Laser Gun',
    category: 'special',
    wordList: 'long',
    damage: 70,
    ammo: 7,
    falloff: null,
    beam: {
      rangePx: 1400,
      pierceShare: 0.8,     // each enemy after the first takes 80% of the one before
      width: 6,
      color: 0x48cae4,
      glowColor: 0xcaf0f8,
      fadeMs: 280,
    },
  },
  // Flamethrower: short range (words only on close enemies, like melee).
  // Each short word sprays a cone of fire that hits everyone in front of you
  // and sets them burning (STATUS.burning).
  flamethrower: {
    key: 'flamethrower',
    name: 'Flamethrower',
    category: 'special',
    wordList: 'short',
    damage: 18,
    ammo: 30,
    falloff: null,
    reach: 200,
    flame: {
      coneDeg: 50,          // total width of the cone
      color: 0xe5383b,      // red fire...
      coreColor: 0xff9f1c,  // ...with orange in it
    },
  },

  // ---- Melee: always in your melee slot, never runs out ----
  knife: {
    key: 'knife',
    name: 'Knife',
    category: 'melee',
    wordList: 'short',
    damage: MELEE_DAMAGE,
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
    damage: MELEE_DAMAGE,
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
    damage: MELEE_DAMAGE,
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
    damage: MELEE_DAMAGE,
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
    damage: MELEE_DAMAGE,
    ammo: null,
    reach: 68,
    knockback: 280,
    swingColor: 0x9aa5b1,
  },
  sword: {
    key: 'sword',
    name: 'Sword',
    category: 'melee',
    wordList: 'short',
    damage: MELEE_DAMAGE,
    ammo: null,
    reach: 86,
    knockback: 0,
    swingColor: 0xf1faee,
  },
  axe: {
    key: 'axe',
    name: 'Axe',
    category: 'melee',
    wordList: 'short',
    damage: MELEE_DAMAGE,
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
  special: { name: 'Special' },
};

// Throwables: thrown with Space, no word needed.
// All share the blast logic in WeaponSystem; each sets its own numbers.
// Special effects (fire, EMP, sticky) will be added per throwable later.
// Shared by every tactical throwable: thrown like a frag (arc, bounces).
const TACTICAL = {
  kind: 'tactical',
  flight: 'arc',
  radius: 6,
  bounce: 0.4,
  groundFriction: 0.9,
  minSpeed: 250,
  maxSpeed: 750,
  chargeMs: 900,
  fuseMs: 1500,
  mass: 0.2,
  ownerIgnoreMs: 300,
  maxCarry: 3,
};

export const THROWABLES = {
  // kind: what happens when it goes off
  //   'frag'    bounces, rolls, explodes on its fuse
  //   'sticky'  blows up on an enemy; on a wall or floor it sticks and becomes a trip mine
  //   'molotov' breaks on impact and leaves a patch of fire (burning)
  //   'axe'     no blast: hits the first enemy it reaches, hard
  //   'tactical' bounces like a frag, goes off on its fuse; config.effect says
  //             what it does: 'smoke', 'flash', 'concussion', 'emp', 'cryo'.
  //             Tacticals reach anyone in radiusPx that it has a clear line
  //             to: enemies AND you. Player-only (enemies never carry them).
    // flight: 'arc' (lobbed, gravity pulls it down) or 'straight' (flies flat
  //   like a throw, no drop until it has gone rangePx, then it falls).
  //   Straight throws: holding Space longer throws farther, from minRangePx
  //   to maxRangePx. Arc throws: from minSpeed to maxSpeed.
  grenade: {
    key: 'grenade',
    name: 'Frag Grenade',
    kind: 'frag',
    flight: 'arc',
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
    maxCarry: 6,          // most you can hold (supply drops can top you up)
  },
  // Sticky Grenade (also your trip mine): thrown flat. Hits an enemy: blows
  // up on impact. Hits a wall or the floor: sticks there, arms, and blows up
  // when anyone walks or flies past: enemies, or you (suicide). A blast going
  // off near it (grenade, rocket, EMP...) sets it off too. Damage falls off
  // with distance: the closer you are when it blows, the harder it hits.
  sticky: {
    key: 'sticky',
    name: 'Sticky Grenade',
    kind: 'sticky',
    flight: 'straight',
    speed: 620,
    minRangePx: 120,
    maxRangePx: 320,
    chargeMs: 700,
    radius: 6,
    color: 0x6a994e,
    armMs: 1000,          // after it sticks, then it's live (blinks red): time to step away
    triggerPx: 90,        // anyone this close (from their middle) sets it off
    tripDelayMs: 250,     // fast beeping between the trip and the blast
    fuseMs: 30000,        // stuck and nobody came: it fizzles after this long
    maxActive: 3,         // your oldest stuck sticky disappears past this
    bounce: 0,
    groundFriction: 0.8,
    damage: 110,          // within directHitRadius; falls to 0 at blastRadius
    directHitRadius: 28,
    blastRadius: 130,
    selfDamage: 1,
    knockback: 540,
    knockbackLift: 230,
    knockbackFullAt: 40,
    mass: 0.2,
    ownerIgnoreMs: 300,
    maxCarry: 4,
  },
  molotov: {
    key: 'molotov',
    name: 'Molotov',
    kind: 'molotov',
    flight: 'arc',
    radius: 6,
    color: 0xbc6c25,
    minSpeed: 250,
    maxSpeed: 650,
    chargeMs: 800,
    bounce: 0,
    groundFriction: 0.8,
    fuseMs: 4000,         // safety: breaks after this long even if it hits nothing
    fire: {
      widthPx: 150,       // patch of fire on the ground where it breaks
      heightPx: 60,
      durationMs: 5000,
      tickMs: 300,        // how often it sets people inside on fire
    },
    selfDamage: 1,        // the fire burns you too if you stand in it
    mass: 0.2,
    ownerIgnoreMs: 300,
    maxCarry: 3,
  },
  combatAxe: {
    key: 'combatAxe',
    name: 'Combat Axe',
    kind: 'axe',
    flight: 'straight',
    speed: 700,
    minRangePx: 120,
    maxRangePx: 300,
    chargeMs: 600,
    radius: 7,
    color: 0xc0c8d0,
    damage: 60,           // to the first enemy it hits; no blast
    knockback: 220,
    bounce: 0,
    groundFriction: 0.7,
    fuseMs: 3000,         // stuck in a wall: gone after this long
    mass: 0.2,
    ownerIgnoreMs: 300,
    maxCarry: 3,
  },

  // ---- Tacticals (no frag damage; they mess with whoever is caught) ----
  // Smoke: a drifting cloud. Enemies inside it are blind until they get
  // out, and nobody sees through it, except you (it's your smoke): you see
  // it thinner, so you can still pick out words on enemies inside it.
  smoke: {
    ...TACTICAL,
    key: 'smoke',
    name: 'Smoke Grenade',
    effect: 'smoke',
    color: 0x8d99ae,
    fuseMs: 1200,
    cloud: {
      radiusPx: 130,
      durationMs: 9000,
      growMs: 1200,       // billows out (no bang)
      fadeMs: 2000,       // thins away at the end
      puffs: 26,
      color: 0xc9ced6,
      alpha: 0.85,        // how thick it looks to everyone else
      ownerAlpha: 0.4,    // how thick it looks to whoever threw it
    },
  },
  // Gas: a green cloud that hurts anyone breathing inside it, you included.
  // Armor doesn't help. Machines and cyborgs don't breathe, so it can't
  // hurt them (immuneMaterials, see effects.js). Enemies try to get out.
  gas: {
    ...TACTICAL,
    key: 'gas',
    name: 'Gas Grenade',
    effect: 'gas',
    color: 0x80b918,
    fuseMs: 1200,
    cloud: {
      radiusPx: 115,
      durationMs: 8000,
      growMs: 1200,
      fadeMs: 1800,
      puffs: 22,
      color: 0x8ac926,
      alpha: 0.32,
    },
    dps: 20,              // ~5s in the middle kills you from full HP (armor or not)
    tickMs: 500,
    immuneMaterials: ['machine', 'cyborg'],
  },
  // Flashbang: blinds everyone with a clear line to it. Up close and looking
  // at it lasts longest. Blinded bots can't see you. You: a white burst,
  // the last thing you saw burned in as an afterimage, then blurry vision.
  flashbang: {
    ...TACTICAL,
    key: 'flashbang',
    name: 'Flashbang',
    effect: 'flash',
    color: 0xe9ecef,
    radiusPx: 230,
    maxMs: 3500,          // blinded this long at the bang...
    minMs: 1200,          // ...down to this at the edge
    lookAwayScale: 0.4,   // facing away from it: this share of the time and strength
  },
  // Concussion: a small shove and dazed (slow, weak jetpack, slow attacks).
  concussion: {
    ...TACTICAL,
    key: 'concussion',
    name: 'Concussion',
    effect: 'concussion',
    color: 0x6c757d,
    radiusPx: 170,
    statusMs: 4000,
    // a light blast for the shove (same rules as a frag, much weaker)
    damage: 15,
    directHitRadius: 28,
    blastRadius: 170,
    selfDamage: 1,
    knockback: 380,
    knockbackLift: 160,
    knockbackFullAt: 10,
  },
  // EMP: shocked (no jetpack or Jet Boost, no gun switching). Machines take
  // heavy damage and drones drop. Sets off stickies in range.
  emp: {
    ...TACTICAL,
    key: 'emp',
    name: 'EMP Grenade',
    effect: 'emp',
    color: 0x4361ee,
    radiusPx: 180,
    statusMs: 4000,
    machineDamage: 80,    // Machines family only (drones die, Scrap Bots hurt)
  },
  // Cryo: frozen (very slow, jetpack frozen, slow attacks).
  cryo: {
    ...TACTICAL,
    key: 'cryo',
    name: 'Cryo Bomb',
    effect: 'cryo',
    color: 0x90e0ef,
    radiusPx: 150,
    statusMs: 4000,
  },

};

// Aiming while holding Space. Angles in degrees: 0 = straight ahead, negative = up.
export const AIM = {
  startAngle: -30,
  minAngle: -80,
  maxAngle: 45,
  turnSpeed: 120,  // degrees per second while holding Up/Down
  mouseLobDeg: 30, // cursor aiming: lobs this many degrees above the line to the cursor
};

// Time to swap guns. Letters are ignored meanwhile.
export const GUN_SWITCH_MS = 300;

// What you spawn with. Final default (README): one basic gun + melee;
// two guns for now so there's plenty to test.
export const DEFAULT_LOADOUT = {
  // Every spawn, one gun per slot, reshuffled each time (never the same gun
  // twice in a row): slot 1 any assault rifle, slot 2 any sniper OR marksman
  // rifle. An entry is a family, a list of families, or a weapon key
  // (e.g. 'sawGun', handy for testing one gun).
  guns: ['assault', ['rifle', 'marksman']],
  // A random melee weapon from this list, new every time you spawn.
  // Melee weapons never drop and can't be picked up.
  melee: ['knife', 'machete', 'bat', 'spade', 'hammer', 'sword', 'axe'],
  throwable: { key: 'grenade', count: 3 },
};