// Recorded sounds (0.34): voices, cries, UI sounds, music. Files live in
// public/assets/audio/ (cleaned, trimmed and levelled from the sources in
// assets-src/audio/; who made each one is in CREDITS.md). Everything else in
// the game is still made in code (src/data/sounds.js): guns, blasts, hazards,
// the jetpack. A sound with no file here keeps its code-made version, so a
// missing file never breaks anything.

const voice = (name) => `assets/audio/voice/${name}.mp3`;

// Every file the title screen loads: key -> path.
export const AUDIO_FILES = {
  // Training (the speech bubbles play these: train-<lesson>-<line>)
  ...Object.fromEntries(
    [
      ['move', 2], ['fly', 3], ['type', 3], ['typos', 3], ['melee', 3], ['throw', 3], ['airdrop', 3], ['fight', 2],
    ].flatMap(([lesson, n]) => [
      ...Array.from({ length: n }, (_, i) => `train-${lesson}-${i + 1}`),
      `train-${lesson}-good`,
    ]).map((k) => [k, voice(k)]),
  ),
  'train-graduate': voice('train-graduate'),
  // You
  'hurt-you-1': voice('hurt-you-1'),
  'hurt-you-2': voice('hurt-you-2'),
  'die-you': voice('die-you'),
  'burn-you': voice('burn-you'),
  // Death cries and burning screams by family
  'die-human-male-1': voice('die-human-male-1'),
  'die-human-male-2': voice('die-human-male-2'),
  'die-human-female-1': voice('die-human-female-1'),
  'die-human-female-2': voice('die-human-female-2'),
  'die-undead-1': voice('die-undead-1'),
  'die-undead-2': voice('die-undead-2'),
  'die-creature': voice('die-creature'),
  'burn-human-male': voice('burn-human-male'),
  'burn-human-female': voice('burn-human-female'),
  'burn-undead': voice('burn-undead'),
  'burn-creature': voice('burn-creature'),
  // Ambience
  'zombie-horde': 'assets/audio/sfx/zombie-horde.mp3', // Zombies mode: low, under the ground, as a wave comes in
  heartbeat: 'assets/audio/sfx/heartbeat.mp3',          // your HP is low
  // Menus and buttons
  'ui-move': 'assets/audio/ui/ui-move.mp3',     // the highlight moves (menus, hovering a button)
  'ui-scroll': 'assets/audio/ui/ui-scroll.mp3', // browsing: lobby characters, maps, comic pages
  'ui-select': 'assets/audio/ui/ui-select.mp3', // Enter or a click
  'ui-back': 'assets/audio/ui/ui-back.mp3',     // Esc, back, close
  'ui-pause': 'assets/audio/ui/ui-pause.mp3',   // pause and resume
};

// Music per screen. Empty until the tracks are added: put the file in
// public/assets/audio/music/ and its path here (e.g. 'assets/audio/music/menu.mp3').
export const MUSIC = {
  title: null,
  menu: null,
  lobby: null,  // (null: the lobby keeps the menu's track)
  battle: null,
  win: null,    // short stinger at the ending beat
  lose: null,
  volume: { title: 0.7, menu: 0.6, lobby: 0.55, battle: 0.35, win: 0.7, lose: 0.7 }, // times the Music volume
  fadeMs: 900,
};

// Which files a code sound (src/data/sounds.js key) plays instead, picked at
// random when there are two. Not listed: stays made in code.
const HUMAN_MALE = ['die-human-male-1', 'die-human-male-2'];
const HUMAN_FEMALE = ['die-human-female-1', 'die-human-female-2'];
const UNDEAD = ['die-undead-1', 'die-undead-2'];
export const SAMPLE_FOR = {
  dieYou: ['die-you'],
  youHurt: ['hurt-you-1', 'hurt-you-2'],
  burnPainYou: ['burn-you'],
  dieSoldier: HUMAN_MALE,
  dieCommando: HUMAN_MALE,
  dieTrooper: HUMAN_MALE,
  dieMercenary: HUMAN_FEMALE,
  dieInfected: HUMAN_FEMALE,
  dieZombie: UNDEAD,
  dieAlien: ['die-creature'],
  dieMutant: ['die-creature'],
  dieK9: ['die-creature'],
  burnHumanMale: ['burn-human-male'],
  burnHumanFemale: ['burn-human-female'],
  burnUndead: ['burn-undead'],
  burnCreature: ['burn-creature'],
};

// How loud each kind of recording plays (times the Voices or Effects volume).
export const SAMPLE_GAIN = { voice: 0.95, cry: 0.8, ui: 0.55, horde: 0.55, heartbeat: 0.7 };

// Who burns and dies with which family's voice (by enemy class name).
export const VOICE_FAMILY = {
  female: ['Mercenary', 'Infected Soldier'],
  undead: ['Zombie', 'Skeleton'],
  creature: ['Alien', 'Mutant', 'Zombie K9'],
};

// Low HP: the heartbeat fades in under this share of your HP.
export const HEARTBEAT = { below: 0.3, full: 0.12 }; // starts at 30%, loudest at 12%
// Zombies: the horde rumbles under the ground as each wave comes in.
export const HORDE = { volume: 1, maxMs: 14000, fadeMs: 2500 };

// The volume settings (Settings screen), 0..1, remembered in this browser.
export const AUDIO_DEFAULTS = { master: 0.9, music: 0.7, sfx: 0.9, voice: 1, muted: false };
export const AUDIO_STORAGE_KEY = 'keysMilitia.audio';
