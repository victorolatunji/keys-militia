// Main menu, lobby and the mode intro (Phase 9). Text and tuning only;
// the screens are src/scenes/MenuScene.js, LobbyScene.js, IntroScene.js.

// Main menu entries, top to bottom. go: what it opens. off: shown greyed out,
// can't be picked (with its note).
export const MENU = {
  entries: [
    { key: 'play', label: 'PLAY', go: 'modes' },
    { key: 'training', label: 'TRAINING', go: 'training' },
    { key: 'comic', label: 'COMIC', go: 'comic' },               // Earth Respond #0, the comic
    { key: 'story', label: 'STORY MODE', off: 'COMING SOON' },
    { key: 'online', label: 'ONLINE', off: 'COMING SOON' },
    { key: 'controls', label: 'CONTROLS', go: 'controls' },
  ],
  // The menu's backdrop: an in-game shot, darkened and drifting slowly.
  backdrop: 'assets/menu/menu-backdrop.jpg', // the ChatGPT menu scene (an outpost at night)
  backdropDarken: 0.3,
};

// The title screen (BootScene, also the loader): an in-game action shot
// under the logo, a progress bar, then PRESS ENTER for the main menu.
// Colours come from the cast's palette (see the art pack); the font is the
// game's monospace until a title font is picked with the ChatGPT scene art.
export const TITLE = {
  // The title scenes (ChatGPT art): the in-game fight and the cast
  // assembled. They swap with a cross-fade every switchMs while the game
  // loads (2 to 4 times), then keep swapping slowly until you press Enter.
  scenes: ['assets/menu/title/action.jpg', 'assets/menu/title/assembly-glacier.jpg'],
  switchMs: 1300, slowSwitchMs: 4000, fadeMs: 500,
  logo: 'assets/menu/logo.png',
  darken: 0.18,
  font: 'monospace',
  gold: '#d2a35f', bone: '#dcd1bf', teal: '#a49d95',
  bar: { width: 560, height: 14, fill: 0xd2a35f },
  minLoadMs: 4200, // the bar takes at least this long: you can read it and see the scenes swap
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
  banners: ['free', 'military', 'zombies', 'enemies', 'training'], // the mode banners (assets/ui/banner-<mode>.webp)
  countdownFrom: 11,         // the ring counts 11 ... 0, then the match starts
  stepMs: 1000,
  hideKey: 'keys-militia.intro.hide.', // + mode key: "don't show again" (Controls turns them back on)
  // The ring timer: small, in the cast's colours (tech teal, amber for the last 3).
  ring: {
    radius: 44, width: 6, numberSize: 40,
    track: 0x35363d, arc: 0x93bcb2, lastArc: 0xe29c53,
    numberColor: '#e9dbc0', lastColor: '#e29c53', labelColor: '#93bcb2',
  },
};

export const LOBBY = {
  storageKey: 'keys-militia.lobby', // your last picks (characters, solo/duo, map per mode)
  // The stage: one big character at a time, < > (or Left / Right) to scroll.
  stageScale: 4.2,                  // how big a character's in-game rig is drawn there
  // Front-view lobby art (made in the ChatGPT art project, Chat "Lobby poses"):
  // cast keys that have public/assets/lobby/<key>.png. Until a key is listed,
  // its in-game rig stands on the stage instead.
  portraits: ['player', 'commando', 'android', 'soldier', 'mercenary', 'trooper', 'zombie', 'skeleton', 'infected', 'robot', 'alien', 'cyborg', 'mutant', 'drone', 'scrapbot', 'k9'],
  portraitFile: (key) => `assets/lobby/${key}.webp`,
  armoury: 'assets/menu/lobby-armoury.jpg', // the ChatGPT armoury wall behind it all
  // Rig poses on the stage until the front-view art comes: how each one holds
  // its gun (degrees: up is negative), by cast key.
  poses: { player: 0, commando: 30, android: -25, soldier: 12, mercenary: -12, trooper: 40, infected: 20, robot: 0, alien: -30, cyborg: 25, mutant: 0 },
  // A picture of each map on the map picker (public/assets/menu/maps/<key>.jpg).
  mapPreview: (key) => `assets/menu/maps/${key}.jpg`,
};
