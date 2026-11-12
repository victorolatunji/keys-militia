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
    art: { height: 62, y: 4 }, // the held shield art: this tall (px), this far below your center
    color: 0x34495e,
    rimColor: 0x48cae4,
    damagedColor: 0xe76f51,
  },
  // Health Pack: straight back up by `heal` HP (never above max). Quick to
  // grab under fire; can't be picked while your HP is full.
  healthPack: {
    key: 'healthPack',
    name: 'Health Pack',
    heal: 50,
    color: '#06d6a0',
  },
  // Armor Vest: worn over your body, works from every side. Like a real
  // soft-armor vest it soaks most of a bullet, less of a blast and only
  // some of a blade; burning goes straight through. The share it soaks
  // comes out of its points; the rest still hurts you (blunt force).
  // At 0 points it's spent. Lost when you die (it never drops).
  armorVest: {
    key: 'armorVest',
    name: 'Armor Vest',
    points: 100,          // ARMOR bar on the HUD
    absorb: {             // share of each hit the vest takes
      bullet: 0.7,        // guns and pellets
      melee: 0.5,
      blast: 0.35,        // grenades, rockets, your own sticky
      fire: 0,            // burning
    },
    barColor: 0x8d99ae,
  },
};
