// Enemy configs. HP is in points; your gun decides damage and word length.

// Stationary practice target (placed by Tiled "dummy" points).
export const ENEMIES = {
  dummy: {
    name: 'Target Dummy',
    width: 32,
    height: 48,
    color: 0xe76f51,
    hp: 100,
    respawnDelay: 3000,  // ms after death
  },
};

// Bots move with the same rules as you (gravity, jetpack, fuel:
// src/data/player.js). Their type sets looks, HP, speed and how they fight.
//   speedScale: run and air speed compared to yours (1 = same)
//   jetScale: jetpack climb speed and thrust compared to yours
//   jetpack: false = walks and jumps only (zombies, later)
//   loadout: what it spawns with, like yours: two gun slots (WEAPONS keys,
//     null = empty), a melee weapon and throwables. Bots use the same
//     arsenal as you: ammo runs out, empty guns get thrown away, they
//     switch to the gun that suits the distance, throw grenades, grab
//     crates and drops, and drop their gear when they die.
//   Bots "type" too: the time between attacks is the time to type that
//     weapon's words at typingSpeed letters per second.
//   reactionMs: after spotting you, extra time before the first shot.
//   damageScale: bot bullets do this share of the gun's damage. You stop
//     to type and can't dodge much, so bots hit softer than you do.
//   aim: how far off its shots go, in degrees (random, either way):
//     spreadDeg always, + movingTargetDeg when you move at full run speed,
//     + selfMovingDeg while the bot itself is moving or flying.
//     lead: 0 = aims where you are, 1 = aims exactly where you'll be.
export const BOTS = {
  shooter: {
    name: 'Shooter',
    color: 0xd62828,
    hp: 100,
    speedScale: 0.45,
    jetScale: 1,
    jetpack: true,
    loadout: {
      guns: ['ak47', 'mw11'],
      melee: 'knife',
      throwable: { key: 'grenade', count: 2 },
    },
    typingSpeed: 1.5,
    reactionMs: 600,
    damageScale: 0.5,
    aim: { spreadDeg: 10, movingTargetDeg: 10, selfMovingDeg: 5, lead: 0.3 },
    respawnDelay: 3000,
  },
};

// Bot bullets: real shots that fly straight and can miss. Walls stop them.
// Speed comes from the gun family (bullets.js); damage and range falloff
// from the gun (weapons.js). A different color from yours, so you can
// see what's coming at you.
export const BOT_BULLETS = {
  color: 0xff4d6d,
  width: 3,
  maxRangePx: 1400,
};

// Distance (px) a bot likes to keep from you with each kind of weapon.
// It picks the gun in its hands whose range fits best, and moves to stay
// inside that range: close with a shotgun, far with a sniper.
export const BOT_RANGES = {
  melee: { min: 0, max: 40 },
  pistol: { min: 150, max: 380 },
  smg: { min: 100, max: 320 },
  shotgun: { min: 60, max: 200 },
  assault: { min: 200, max: 480 },
  lmg: { min: 250, max: 520 },
  marksman: { min: 350, max: 650 },
  rifle: { min: 400, max: 750 },
  launcher: { min: 250, max: 550 },
};

// Average letters per word in each list, for bot "typing" time.
export const WORD_LETTERS = { short: 3.5, medium: 5.5, long: 7.5, extraLong: 9.7 };

// How every bot thinks. Starting values, tune in playtests.
export const BOT_AI = {
  thinkMs: 150,           // reaction time: how often a bot rethinks (±20%)
  memoryMs: 4000,         // keeps hunting where it last saw you for this long
  arrivePx: 16,           // close enough to its goal to stop walking
  strafeChance: 0.3,      // at a good range: chance per think to side-step
  strafePx: 80,
  spacingPx: 90,          // steps away from another bot closer than this

  // Jetpack
  climbMarginPx: 48,      // flies up when its goal is this much higher
  hoverFallSpeed: 30,     // over a gap or the void: thrusts when falling faster
  crossFuel: 40,          // won't start crossing a gap with less fuel
  reserveFuel: 25,        // under this, it lands to refuel...
  refuelTo: 90,           // ...and stays down until it has this much
  landSearchPx: 800,      // over the void: how far it looks for ground
  fuelSafety: 1.4,        // flights are planned with this much extra fuel
  returnMarginFuel: 15,   // and this much left over on arrival
  landInsetPx: 24,        // lands this far in from an edge, not right on it
  stuckMs: 600,           // not moving while trying to: hop up to get unstuck

  // Weapons
  switchEveryMs: 2000,    // at most one gun switch this often (switching takes GUN_SWITCH_MS)
  switchMargin: 0.25,     // only switches when the other gun fits clearly better

  // Grenades: lobbed at you when you're in range, most often when you hide.
  grenade: {
    minRangePx: 140,      // never this close (it would hurt itself)
    maxRangePx: 520,
    checkMs: 1000,        // how often it considers a throw
    chanceSeen: 0.08,     // per check while it can see you
    chanceHidden: 0.35,   // per check while you hide near where it last saw you
    hiddenMemoryMs: 3000, // "you were just there" counts this long
    cooldownMs: 5000,     // between its own throws
    errorShare: 0.12,     // throw strength is off by up to this share
  },

  // Loot: crates and drops it will walk or fly to.
  loot: {
    searchPx: 500,        // how far it looks
    lowAmmoShare: 0.3,    // a gun this low on ammo is worth replacing
    giveUpMs: 5000,       // no closer for this long: gives up on that item...
    ignoreMs: 15000,      // ...for this long
  },

  // Fall credit: a bot that falls into the void counts as your kill if you
  // did at least this share of its HP in the last windowMs.
  fallCredit: { windowMs: 10000, share: 0.5 },
};