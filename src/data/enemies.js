// Enemy configs. Phase 2 has one: a stationary target dummy.
// Bots (shooter, rusher, bomber) arrive in Phase 5.
export const ENEMIES = {
  dummy: {
    name: 'Target Dummy',
    width: 32,
    height: 48,
    color: 0xe76f51,
    hp: 3,               // 1 damage per word until weapons arrive in Phase 3
    wordList: 'medium',
    respawnDelay: 3000,  // ms after death (used in Step 2)
  },
};