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
  'hurt-male': voice('hurt-male'),       // short pain grunts: you, when you play someone other than Victor
  'hurt-female': voice('hurt-female'),
  'hurt-undead': voice('hurt-undead'),
  'hurt-creature': voice('hurt-creature'),
  'die-you-chai': voice('die-you-chai'),               // "Chai! Aaagh!": now and then (SAMPLE_RARE)
  'die-human-male-chai': voice('die-human-male-chai'), // "Argh! Chai!": now and then
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
  heartbeat: 'assets/audio/sfx/heartbeat.mp3',          // one beat ("lub-dub"): your HP is low
  drowning: 'assets/audio/sfx/drowning.mp3',            // you're under water / sand and out of breath
  // Menus and buttons
  'ui-move': 'assets/audio/ui/ui-move.mp3',     // the highlight moves (menus, hovering a button)
  'ui-scroll': 'assets/audio/ui/ui-scroll.mp3', // browsing: lobby characters, maps, comic pages
  'ui-select': 'assets/audio/ui/ui-select.mp3', // Enter or a click
  'ui-back': 'assets/audio/ui/ui-back.mp3',     // Esc, back, close
  'ui-pause': 'assets/audio/ui/ui-pause.mp3',   // pause and resume
};

// Music per screen (one path, or several: one picked at random each time).
// A screen with null stays silent (e.g. matches until a battle track is added).
const music = (name) => `assets/audio/music/${name}.mp3`;
export const MUSIC = {
  title: [music('title-1'), music('title-2')], // the loading / title screen
  menu: music('menu'),                         // main menu and mode picker
  pages: music('pages'),                       // menu pages: controls, about, credits
  lobby: music('lobby'),
  comic: music('comic'),
  settings: music('settings'),
  battle: null, // in a match (none yet)
  win: null,    // short sting at the ending beat
  lose: null,
  volume: { title: 0.75, menu: 0.6, pages: 0.55, lobby: 0.55, comic: 0.6, settings: 0.55, battle: 0.35, win: 0.7, lose: 0.7 }, // times the Music volume
  fadeMs: 900,
};
export const MUSIC_TRACKS = ['title', 'menu', 'pages', 'lobby', 'comic', 'settings', 'battle', 'win', 'lose'];
// The file keys of a track (music-<name>-<n>).
export const musicKeys = (name) => {
  const v = MUSIC[name];
  return v ? (Array.isArray(v) ? v : [v]).map((path, i) => ({ key: `music-${name}-${i}`, path })) : [];
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
  hurtMale: ['hurt-male'],
  hurtFemale: ['hurt-female'],
  hurtUndead: ['hurt-undead'],
  hurtCreature: ['hurt-creature'],
  burnHumanMale: ['burn-human-male'],
  burnHumanFemale: ['burn-human-female'],
  burnUndead: ['burn-undead'],
  burnCreature: ['burn-creature'],
};

// Now and then (chance per cry) a code sound plays one of these instead:
// the cries with "Chai!" in them, so you hear it sometimes, not every time.
const MALE_CHAI = { chance: 0.2, keys: ['die-human-male-chai'] };
export const SAMPLE_RARE = {
  dieYou: { chance: 0.25, keys: ['die-you-chai'] },
  dieSoldier: MALE_CHAI,
  dieCommando: MALE_CHAI,
  dieTrooper: MALE_CHAI,
};

// How loud each kind of recording plays (times the Voices or Effects volume).
export const SAMPLE_GAIN = { voice: 0.95, cry: 0.8, ui: 0.55, horde: 0.55, heartbeat: 0.8 };

// Who burns and dies with which family's voice (by enemy class name).
export const VOICE_FAMILY = {
  female: ['Mercenary', 'Infected Soldier'],
  undead: ['Zombie', 'Skeleton'],
  creature: ['Alien', 'Mutant', 'Zombie K9'],
};

// Low HP: under `below` of your HP your heart beats, slowly, and the screen
// gives a little shake on each beat (a bit quicker and stronger near the end).
export const HEARTBEAT = { below: 0.2, slowMs: 1300, fastMs: 1000, volume: [0.6, 1], shake: { ms: 120, from: 0.0018, to: 0.0035 } };
// Under water or quicksand: the struggle starts when your breath is this
// low, and plays fully once it's gone (you're drowning).
export const DROWNING = { struggleAt: 0.3, volume: 0.8 };
// Zombies: the horde rumbles under the ground as each wave comes in.
export const HORDE = { volume: 1, maxMs: 14000, fadeMs: 2500 };

// The volume settings (Settings screen), 0..1, remembered in this browser.
export const AUDIO_DEFAULTS = { master: 0.9, music: 0.7, sfx: 0.9, voice: 1, muted: false };
export const AUDIO_STORAGE_KEY = 'keysMilitia.audio';
