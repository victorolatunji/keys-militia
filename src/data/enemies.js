// Enemy configs. Phase 2 has one: a stationary target dummy.
// Bots (shooter, rusher, bomber) arrive in Phase 5.
// HP is in points; your gun decides damage and word length.
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