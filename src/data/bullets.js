// How bullets look and fly, per weapon family (category in weapons.js).
// Color and thickness come from each gun's tracerColor / tracerWidth.
// speed: px per second. length: px of the streak.
// trail: also leave a thin fading line from the muzzle (long-range guns).
// Starting values, tune in playtests.
export const BULLETS = {
  pistol: { speed: 1500, length: 10 },
  smg: { speed: 1700, length: 8 },
  shotgun: { speed: 1500, length: 11 },
  assault: { speed: 1900, length: 14 },
  lmg: { speed: 1800, length: 16 },
  marksman: { speed: 2600, length: 22, trail: true },
  rifle: { speed: 3200, length: 28, trail: true },
};

export const BULLET_DEFAULT = { speed: 1800, length: 12 };

export const MUZZLE_FLASH = {
  radius: 5,
  color: 0xfff3b0,
  durationMs: 60,
};

// Hits on the same target within this time add up into one damage number
// ("-60" counting up during a burst) instead of a pile of small ones.
export const DAMAGE_MERGE_MS = 350;