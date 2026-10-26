// Gun stats. HP is in points (dummies and players have 100).
// wordList picks from words.js: short / medium / long.
// Starting values, tune in playtests (README open decision).
export const WEAPONS = {
  pistol: {
    key: 'pistol',
    name: 'Pistol',
    wordList: 'short',
    damage: 25,
    tracerColor: 0xfff3b0,
    tracerWidth: 2,
  },
  assaultRifle: {
    key: 'assaultRifle',
    name: 'Assault Rifle',
    wordList: 'medium',
    damage: 34,
    tracerColor: 0xffd166,
    tracerWidth: 3,
  },
  sniper: {
    key: 'sniper',
    name: 'Sniper',
    wordList: 'long',
    damage: 100,
    tracerColor: 0xffffff,
    tracerWidth: 5,
  },
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