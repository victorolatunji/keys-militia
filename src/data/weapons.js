// Gun stats. HP is in points (dummies and players have 100).
// wordList picks from words.js: short / medium / long.
// Starting values, tune in playtests (README open decision).
//
// category: the weapon family (see WEAPON_CATEGORIES). Later steps give each
//   category its own typing rules (melee reach, LMG bursts, launchers).
// ammo: shots in a full gun. Starting rule: round(600 / damage), kept
//   between 3 and 40, so stronger guns get fewer shots. No reload button:
//   an empty gun is thrown away and you switch to your other slot.
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
};

// Weapon families. More arrive in Phase 4.5 (melee, SMG, shotgun, LMG,
// launchers) and 5.5 (specials).
export const WEAPON_CATEGORIES = {
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

// Test loadout until airdrops arrive (Phase 4).
// Final default: one basic gun (SMG or assault rifle) + melee.
export const DEFAULT_LOADOUT = {
  guns: ['assaultRifle', 'sniper'],
  throwable: { key: 'grenade', count: 3 },
};