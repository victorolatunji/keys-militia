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

// The flash at the gun's muzzle (art in public/assets/sprites/effects), by
// weapon family: art, and how long it's drawn along the barrel (px).
// Per-gun entries (by weapon key) win over the family. null: no flash.
export const MUZZLE_FLASH = {
  durationMs: 60,
  pistol: { art: 'muzzle-small', length: 14 },
  smg: { art: 'muzzle-small', length: 16 },
  assault: { art: 'muzzle-small', length: 22 },
  shotgun: { art: 'muzzle-big', length: 30 },
  lmg: { art: 'muzzle-big', length: 28 },
  marksman: { art: 'muzzle-big', length: 28 },
  rifle: { art: 'muzzle-big', length: 36 },
  launcher: { art: 'muzzle-big', length: 34 },
  special: { art: 'muzzle-small', length: 14 },
  laser: { art: 'laser-glow', length: 22, glow: true }, // a blue glow, not fire
  flamethrower: null,                                  // the fire itself is the flash
  fallback: { art: 'muzzle-small', length: 14 },       // bots' natural weapons etc.
};

// Shots drawn with their own art (public/assets/sprites/projectiles), size
// in px along their length. Launcher rounds go by projectile kind.
export const SHOT_ART = {
  rocket: { art: 'rocket', length: 30, origin: [0.7, 0.5] }, // origin: the hit point sits near the nose
  shell: { art: 'grenade-shell', length: 20 },
  bomb: { art: 'grenade-shell', length: 16, tumble: 12 },   // tumble: spins (radians per second)
  saw: { art: 'saw-blade', size: 2.8 },                     // size: times the blade's radius
  nail: { art: 'nail', length: 16 },
  laser: { beam: 'laser-beam', glow: 'laser-glow', thick: 2, glowSize: 22 }, // thick: times beam.width
  flame: { art: 'flame-puff', length: 22, grow: 2.2 },
};

// Thrown things in flight use their throwable art, this many px across.
export const THROWN_SIZE = 17;

// Hits on the same target within this time add up into one damage number
// ("-60" counting up during a burst) instead of a pile of small ones.
export const DAMAGE_MERGE_MS = 350;
