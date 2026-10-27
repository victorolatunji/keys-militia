// Gun stats. HP is in points (dummies and players have 100).
// wordList picks from words.js: short / medium / long.
// Starting values, tune in playtests (README open decision).
//
// category: the weapon family (see WEAPON_CATEGORIES). Each family can
//   have its own typing rules (melee: reach; later LMG bursts, launchers).
// ammo: shots in a full gun. Starting rule: round(600 / damage), kept
//   between 3 and 40, so stronger guns get fewer shots. No reload button:
//   an empty gun is thrown away and you switch to your next weapon.
//   null = never runs out (melee).
//
// Melee only: reach (px from you to the target: words only show on enemies
//   this close) and knockback (px/s push on a hit; bots move, dummies don't).
//
// falloff: damage drops with distance from you to the target.
//   Full damage up to startPx, then a straight line down to
//   minMultiplier at endPx (and beyond). null = full damage at any range.
//   A finished word always hits; only the damage changes.
export const WEAPONS = {
  pistol: {
    key: 'pistol',
    name: 'Pistol',
    category: 'pistol',
    wordList: 'short',
    damage: 25,
    ammo: 24,
    falloff: { startPx: 250, endPx: 600, minMultiplier: 0.5 },
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },
  assaultRifle: {
    key: 'assaultRifle',
    name: 'Assault Rifle',
    category: 'assault',
    wordList: 'medium',
    damage: 34,
    ammo: 18,
    falloff: { startPx: 350, endPx: 700, minMultiplier: 0.6 },
    tracerColor: 0xffd166,
    tracerWidth: 3,
  },
  sniper: {
    key: 'sniper',
    name: 'Sniper',
    category: 'rifle',
    wordList: 'long',
    damage: 100,
    ammo: 6,
    falloff: null,        // long words buy full damage at any range
    tracerColor: 0xffffff,
    tracerWidth: 5,
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

// Weapon families. More arrive in Phase 4.5 (melee, SMG, shotgun, LMG,
// launchers) and 5.5 (specials).
export const WEAPON_CATEGORIES = {
  melee: { name: 'Melee' },
  pistol: { name: 'Pistol' },
  assault: { name: 'Assault rifle' },
  rifle: { name: 'Rifle' },
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
  guns: ['assaultRifle', 'sniper'],
  melee: 'knife',
  throwable: { key: 'grenade', count: 3 },
};