// Utility pickups that fall from the sky (see SUPPLY_DROPS in airdrops.js).
// Picked up with key 3, like throwables.
export const ITEMS = {
  // Jet Boost: you float. Gravity barely pulls, so you sink slowly (like
  // typing in mid-air). Arrows glide you in any direction, smoothly and
  // quickly enough to dodge; let go and you drift, then sink slowly.
  jetBoost: {
    key: 'jetBoost',
    name: 'Jet Boost',
    durationMs: 20000,
    riseScale: 1.25,      // climb speed while boosted (jetpack)
    glideSpeed: 230,      // px/s sideways while floating
    riseSpeed: 180,       // px/s up (Up)
    diveSpeed: 240,       // px/s down (Down)
    sinkSpeed: 60,        // px/s slow sink with no Up pressed
    easeMs: 220,          // time to reach a new speed (lower = snappier)
    fuelColor: 0xffd166,  // HUD fuel bar color while boosted
    flameColor: 0x48cae4, // jet flame turns blue and long while boosted
  },
  // Riot Shield: held on the side you face; blocks gun bullets and pellets
  // from the front until it breaks (not melee, specials or throwables).
  // Any explosion that reaches you (grenade, rocket, War Machine...)
  // knocks it out of your hands. It takes your second hand, so only
  // one-handed weapons work with it (allowedWith). Picking it up switches
  // you to one of them. Lost when it breaks or you die (it never drops).
  riotShield: {
    key: 'riotShield',
    name: 'Riot Shield',
    hp: 200,              // damage it soaks before breaking
    allowedWith: ['pistol', 'smg', 'melee'],
    width: 8,
    height: 54,
    offsetX: 20,          // px in front of your center
    color: 0x34495e,
    rimColor: 0x48cae4,
    damagedColor: 0xe76f51,
  },
};