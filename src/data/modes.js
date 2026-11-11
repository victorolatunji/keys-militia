// Game modes (offline, Phase 8). F8 cycles through them (testing, until the
// menus in Phase 9); ?mode=military in the address picks one.
//   free:     the open sandbox (no clock, no score): what the maps had so far
//   zombies:  waves of the undead, no respawns: survive as many waves as you can
//   enemies:  You vs Enemies: waves of every enemy type, 3 respawns, then game over
//   maps:     which maps fit the mode (F6 cycles only these). Zombies walk and
//             leap (no jetpacks), so only maps with ground to walk on.
//   military: You vs Military: first to killTarget on a countdown, you
//             respawn until the clock runs out. More kills when time is up wins.
export const MODE_SELECT = {
  order: ['free', 'military', 'zombies', 'enemies'],
  default: 'free',
  key: 'F8', // (F7 opens browser tools in some browsers)
  storageKey: 'keys-militia.mode',
};

// Difficulty ramp (flow): the match steps up every couple of minutes so it
// never drags and never overwhelms. Each stage, from `atMs` into the match:
//   bots: how many enemies are out at once
//   types: which enemy types can appear (BOTS keys)
//   hp, damage: their HP and the damage their shots do, compared to normal
//   reaction: their reaction delay (lower = faster); typing: their attack
//   speed (higher = faster); aim: their spread (lower = sharper)
//   turns: how many may shoot at you at the same time
//   drops: 0..1, how generous the airdrops get (more specials and helpful
//   gear, fewer weak guns; see AirdropSystem.supplyItem)
const MILITARY_RAMP = [
  { atMs: 0, bots: 3, types: ['soldier', 'mercenary', 'commando'], hp: 1, damage: 1, reaction: 1, typing: 1, aim: 1, turns: 2, drops: 0 },
  { atMs: 120000, bots: 4, types: ['soldier', 'mercenary', 'commando', 'armouredTrooper'], hp: 1.1, damage: 1.15, reaction: 0.9, typing: 1.1, aim: 0.9, turns: 2, drops: 0.25 },
  { atMs: 240000, bots: 4, types: ['soldier', 'mercenary', 'commando', 'armouredTrooper'], hp: 1.2, damage: 1.3, reaction: 0.8, typing: 1.2, aim: 0.8, turns: 3, drops: 0.5 },
  { atMs: 360000, bots: 5, types: ['soldier', 'mercenary', 'commando', 'armouredTrooper'], hp: 1.3, damage: 1.45, reaction: 0.7, typing: 1.3, aim: 0.7, turns: 3, drops: 0.75 },
  { atMs: 480000, bots: 6, types: ['soldier', 'mercenary', 'commando', 'armouredTrooper'], hp: 1.4, damage: 1.6, reaction: 0.6, typing: 1.4, aim: 0.6, turns: 4, drops: 1 },
];

// Zombies: waves, no respawns. Each wave: how many come in total, how many
// are out at once, which types, and how much tougher they are (hp, speed,
// damage grow every wave). Past the last entry, the last one repeats and
// keeps growing.
const ZOMBIE_WAVES = [
  { count: 6, atOnce: 4, types: ['zombie'] },
  { count: 8, atOnce: 4, types: ['zombie', 'zombieK9'] },
  { count: 10, atOnce: 5, types: ['zombie', 'zombieK9', 'skeleton'] },
  { count: 12, atOnce: 6, types: ['zombie', 'zombieK9', 'skeleton', 'infectedSoldier'] },
  { count: 14, atOnce: 7, types: ['zombie', 'zombieK9', 'skeleton', 'infectedSoldier'] },
];

// You vs Enemies: every family mixed in, a new kind joining almost every
// wave, so each wave plays differently. Past the last entry it repeats and
// keeps growing.
const ENEMY_WAVES = [
  { count: 6, atOnce: 3, types: ['soldier', 'zombie'] },
  { count: 8, atOnce: 4, types: ['soldier', 'zombie', 'robot', 'zombieK9'] },
  { count: 10, atOnce: 4, types: ['soldier', 'mercenary', 'zombie', 'skeleton', 'robot', 'drone', 'zombieK9'] },
  { count: 12, atOnce: 5, types: ['soldier', 'mercenary', 'commando', 'skeleton', 'android', 'drone', 'scrapBot', 'alien', 'zombieK9'] },
  { count: 14, atOnce: 5, types: ['mercenary', 'commando', 'infectedSoldier', 'android', 'robot', 'drone', 'alien', 'cyborg', 'zombieK9'] },
  { count: 16, atOnce: 6, types: ['commando', 'armouredTrooper', 'infectedSoldier', 'android', 'robot', 'scrapBot', 'alien', 'cyborg', 'mutant', 'zombieK9'] },
];

export const MODES = {
  free: {
    key: 'free',
    name: 'Free play',
    maps: null, // all
  },
  military: {
    key: 'military',
    name: 'You vs Military',
    killTarget: 25,          // first side to this many kills wins
    timeMs: 10 * 60 * 1000,  // the countdown
    family: 'military',
    maps: null,              // all: Military fly with jetpacks
    ramp: MILITARY_RAMP,
    calmMs: 4000,            // new enemies of a stage arrive this long after it starts
  },
  zombies: {
    key: 'zombies',
    name: 'Zombies',
    waves: ZOMBIE_WAVES,
    maps: ['graveyard', 'catacombs', 'wastelands'],
    respawns: 0,             // one life
    breakMs: 7000,           // a breather between waves
    grow: { hp: 0.1, speed: 0.04, damage: 0.08 }, // per wave past the first
  },
  enemies: {
    key: 'enemies',
    name: 'You vs Enemies',
    waves: ENEMY_WAVES,
    // Walkers, leapers, flyers and jetpacks all together: every map with
    // ground to fight on (not Sky Islands or Space).
    maps: ['forest', 'hell', 'glacier', 'desert', 'catacombs', 'graveyard', 'monastery', 'wastelands'],
    respawns: 3,             // 3 respawns, then game over
    breakMs: 8000,
    grow: { hp: 0.1, speed: 0.03, damage: 0.1 },
  },
};
