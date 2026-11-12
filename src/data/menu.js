// Main menu, lobby and the mode intro (Phase 9). Text and tuning only;
// the screens are src/scenes/MenuScene.js, LobbyScene.js, IntroScene.js.

// Main menu entries, top to bottom. go: what it opens. off: shown greyed out,
// can't be picked (with its note).
export const MENU = {
  entries: [
    { key: 'play', label: 'PLAY', go: 'modes' },
    { key: 'training', label: 'TRAINING', go: 'training' },
    { key: 'story', label: 'STORY', go: 'story' },
    { key: 'online', label: 'ONLINE', off: 'COMING SOON' },
    { key: 'controls', label: 'CONTROLS', go: 'controls' },
  ],
  // The menu's backdrop: an in-game shot, darkened and drifting slowly.
  backdrop: 'assets/menu/backdrop.jpg',
  backdropDarken: 0.55,
};

// Play: the modes, in order, with a line each on the mode picker.
export const PLAY_MODES = [
  { key: 'free', line: 'The open sandbox: no clock, no score. Practise anything.' },
  { key: 'military', line: 'First to 25 kills in 10 minutes against Black Static.' },
  { key: 'zombies', line: 'Waves of the undead that keep growing. One life.' },
  { key: 'enemies', line: 'Waves of every enemy family. Three respawns, then game over.' },
];

// What each mode's intro pop-up says before the match: its goal, then
// the keys that matter most there.
export const MODE_INTRO = {
  free: { goal: 'No goal, no clock. Try the weapons, the maps and the jetpack.', keys: ['Arrows: move · Up: jetpack · Down: crouch', 'Type the word over an enemy to shoot it', 'Shift: switch gun · Space: throw · 1/2/3: pick up'] },
  military: { goal: 'First to 25 kills wins. You have 10 minutes. Black Static fly jetpacks and use cover.', keys: ['Type the word over an enemy to shoot it', 'Up: jetpack · Down: crouch behind cover', 'Crates drop from the sky: walk up and press 1-6'] },
  zombies: { goal: 'Survive the waves. One life. The undead come faster every wave.', keys: ['Type fast: they charge, strike and fall back', 'Up: jetpack over a pack · Space: throw a grenade', 'Health packs drop between waves'] },
  enemies: { goal: 'Every family, wave after wave. Three respawns, then it\'s over.', keys: ['Type the word over an enemy to shoot it', 'Shift: switch gun to suit the enemy', 'Space: throw · Tab: switch throwable'] },
};

export const INTRO = {
  countdownFrom: 11,         // the ring counts 11 ... 0, then the match starts
  stepMs: 1000,
  hideKey: 'keys-militia.intro.hide.', // + mode key: "don't show again" (Controls turns them back on)
};

export const LOBBY = {
  storageKey: 'keys-militia.lobby', // your last picks (characters, solo/duo, map per mode)
  cols: 4,                          // character cards per row
};
