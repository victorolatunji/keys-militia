// Gun stats. HP is in points (dummies have 100).
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

// Time to swap guns. Letters are ignored meanwhile.
export const GUN_SWITCH_MS = 300;

// Test loadout until airdrops arrive (Phase 4).
// Final default: one basic gun (SMG or assault rifle) + melee.
export const DEFAULT_LOADOUT = {
  guns: ['assaultRifle', 'sniper'],
};