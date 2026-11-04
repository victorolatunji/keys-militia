// Phase 6 sounds. No audio files: every sound is made in code with the
// browser's Web Audio (noise and tones shaped by filters and envelopes), so
// they're ours, free, and tiny. Real recorded sounds (e.g. Kenney CC0 packs)
// can replace any of them later under the same names.
//
// A sound is a list of layers played together:
//   noise: { noise: true, dur, gain, filter, freq, freqEnd?, q?, attack?, delay? }
//   tone:  { wave: 'sine'|'square'|'sawtooth'|'triangle', freq, freqEnd?, dur, gain, attack?, delay?, filter?, cutoff? }
// dur/attack/delay in seconds, freq in Hz, gain 0..1 (before the master volume).
// gapMs: the same sound won't start again within this many ms (keeps LMG
// bursts and big fights from turning into noise).

export const SOUND_SETTINGS = {
  master: 0.5,              // overall volume
  toggleKey: 'F4',          // sound on/off (F2 is gore)
  storageKey: 'keys-militia.sound',
  hearingPx: 1100,          // sounds this far from you are quietest...
  minDistanceVolume: 0.15,  // ...at this share of their volume
  enemyVolume: 0.6,         // enemy gunfire is a bit quieter than yours...
  enemyPitch: 0.85,         // ...and a bit lower, so you can tell them apart
  hurtGapMs: 140,           // per character: pain sounds at most this often
  // Room reverb on everything (sounds ring out instead of cutting off)...
  reverb: { seconds: 1.8, decay: 3, level: 0.6, send: 0.22 },
  // ...and a far echo for big sounds (sounds with an `echo` amount).
  echo: { delaySec: 0.32, feedback: 0.32, cutoff: 1400 },
};

// ---- Building blocks ----
const crack = (freq, dur, gain, delay = 0) => ({ noise: true, filter: 'bandpass', freq, q: 0.9, dur, gain, delay });
const snap = (gain, delay = 0) => ({ noise: true, filter: 'highpass', freq: 2500, dur: 0.025, gain, delay }); // sharp front edge
const thump = (freq, freqEnd, dur, gain, delay = 0) => ({ wave: 'sine', freq, freqEnd, dur, gain, delay });
const body = (freq, dur, gain, delay = 0) => ({ noise: true, filter: 'lowpass', freq, dur, gain, delay });
const tail = (dur, gain) => ({ noise: true, filter: 'lowpass', freq: 900, freqEnd: 200, dur, gain, delay: 0.02 });

// Crackle: lots of tiny random pops spread over `span` seconds (fire, sparks).
// Same pattern every time (seeded), so it's cheap and predictable.
function crackles(count, span, gain, freq = 3500, seed = 7) {
  let r = seed;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ noise: true, filter: 'bandpass', freq: freq * (0.6 + rand() * 0.9), q: 2, dur: 0.012 + rand() * 0.02, gain: gain * (0.4 + rand() * 0.6), delay: rand() * span });
  }
  return out;
}

// Glass breaking: a sharp crash plus high bright pings.
const glass = [
  { noise: true, filter: 'highpass', freq: 4000, dur: 0.12, gain: 0.5 },
  { wave: 'sine', freq: 3900, dur: 0.18, gain: 0.07, delay: 0.01 },
  { wave: 'sine', freq: 5200, dur: 0.14, gain: 0.06, delay: 0.04 },
  { wave: 'sine', freq: 3100, dur: 0.2, gain: 0.05, delay: 0.07 },
  { wave: 'sine', freq: 6100, dur: 0.1, gain: 0.05, delay: 0.1 },
  ...crackles(6, 0.25, 0.25, 6000, 3),
];


// A grown voice crying out (adult, not a wail): a low buzzy tone through
// two mouth filters ("aagh"), falling in pitch, with breath and rasp.
//   pitch: starting Hz (men ~120-220)  dur: seconds  drop: pitch at the end (share)
//   f1, f2: mouth shape (ah ~ 700/1150, oh ~ 500/900)  vib: [rate, depth share]
//   rasp: rough growl under it  breath: air noise  delay: start later
function voice({ pitch, dur, gain, drop = 0.6, f1 = 700, f2 = 1150, vib = [5, 0.03], rasp = 0.2, breath = 0.35, delay = 0 }) {
  const vibrato = { rate: vib[0], depth: pitch * vib[1] };
  const layers = [
    { wave: 'sawtooth', freq: pitch, freqEnd: pitch * drop, dur, gain, attack: 0.02, filter: 'bandpass', cutoff: f1, q: 4, vibrato, delay },
    { wave: 'sawtooth', freq: pitch, freqEnd: pitch * drop, dur, gain: gain * 0.6, attack: 0.02, filter: 'bandpass', cutoff: f2, q: 5, vibrato, delay },
    { noise: true, filter: 'bandpass', freq: f1 * 1.6, q: 1.2, dur: dur * 0.9, gain: gain * breath, attack: 0.02, delay },
    { noise: true, filter: 'highpass', freq: 2500, dur: 0.05, gain: gain * 0.25, delay }, // the sharp intake at the start
  ];
  if (rasp) layers.push({ wave: 'square', freq: pitch / 2, freqEnd: (pitch * drop) / 2, dur, gain: gain * rasp, filter: 'lowpass', cutoff: 500, delay });
  return layers;
}
const thud = (delay, gain = 0.45) => body(320, 0.25, gain, delay); // body hitting the ground
const clank = (delay, gain = 0.3) => ({ wave: 'square', freq: 700, freqEnd: 300, dur: 0.12, gain, filter: 'bandpass', cutoff: 1400, q: 3, delay });
const powerDown = (from, dur, gain, delay = 0) => ({ wave: 'sawtooth', freq: from, freqEnd: 50, dur, gain, filter: 'lowpass', cutoff: 2000, delay });

export const SOUNDS = {
  // ---- Guns (your shots; enemies use the same, quieter and lower) ----
  // Each is one shot; bursts play it per bullet.
  pistol: { gapMs: 40, layers: [snap(0.4), crack(1700, 0.12, 0.55), thump(170, 60, 0.08, 0.35)] },
  // SMG: a light, quick, high spray.
  smg: { gapMs: 30, layers: [snap(0.25), { noise: true, filter: 'highpass', freq: 1800, dur: 0.05, gain: 0.32 }, thump(260, 120, 0.035, 0.12)] },
  // Assault: thicker, with a doubled crack so each bullet sounds like a volley.
  assault: { gapMs: 45, layers: [snap(0.45), crack(1300, 0.12, 0.6), crack(1100, 0.1, 0.4, 0.03), thump(130, 45, 0.12, 0.5), body(1200, 0.12, 0.3), tail(0.22, 0.18)] },
  // LMG: heavy and punchy but short, so the fast stream stays tight.
  lmg: { gapMs: 28, layers: [snap(0.45), { noise: true, filter: 'lowpass', freq: 2200, dur: 0.09, gain: 0.7 }, thump(95, 38, 0.1, 0.65), body(500, 0.08, 0.35)] },
  shotgun: { gapMs: 80, echo: 0.25, layers: [snap(0.6), { noise: true, filter: 'lowpass', freq: 3200, freqEnd: 600, dur: 0.4, gain: 0.85 }, thump(90, 32, 0.28, 0.65), tail(0.4, 0.2)] },
  marksman: { gapMs: 80, echo: 0.3, layers: [snap(0.6), { noise: true, filter: 'highpass', freq: 2000, dur: 0.1, gain: 0.6 }, thump(150, 45, 0.12, 0.4), tail(0.5, 0.28)] },
  rifle: { gapMs: 100, echo: 0.4, layers: [snap(0.7), { noise: true, filter: 'highpass', freq: 1800, dur: 0.12, gain: 0.75 }, thump(120, 38, 0.16, 0.55), tail(0.8, 0.32)] },
  launcher: { gapMs: 80, echo: 0.2, layers: [snap(0.3), { noise: true, filter: 'bandpass', freq: 700, freqEnd: 200, q: 0.7, dur: 0.55, gain: 0.55, attack: 0.03 }, thump(80, 35, 0.22, 0.45)] },

  // ---- Specials ----
  sawGun: { gapMs: 80, layers: [{ wave: 'sawtooth', freq: 900, freqEnd: 1300, dur: 0.45, gain: 0.12 }, { noise: true, filter: 'highpass', freq: 3000, dur: 0.45, gain: 0.12 }] },
  nailGun: { gapMs: 40, layers: [{ wave: 'square', freq: 620, freqEnd: 200, dur: 0.05, gain: 0.22 }, { noise: true, filter: 'highpass', freq: 2500, dur: 0.04, gain: 0.3 }] },
  laser: { gapMs: 80, layers: [{ wave: 'sawtooth', freq: 1800, freqEnd: 300, dur: 0.25, gain: 0.2 }, { wave: 'sine', freq: 900, freqEnd: 150, dur: 0.28, gain: 0.2 }] },
  // Flamethrower: a roaring rush of fire with crackle in it.
  flamethrower: { gapMs: 120, layers: [{ noise: true, filter: 'lowpass', freq: 700, dur: 0.6, gain: 0.95, attack: 0.06 }, { noise: true, filter: 'bandpass', freq: 1400, q: 0.6, dur: 0.55, gain: 0.45, attack: 0.05 }, ...crackles(10, 0.5, 0.6, 3000, 11)] },

  // ---- Melee: a heavy punch/beating thud ----
  swing: { gapMs: 60, layers: [{ noise: true, filter: 'bandpass', freq: 700, freqEnd: 2200, q: 1.2, dur: 0.14, gain: 0.28, attack: 0.03 }] },
  meleeHit: { gapMs: 50, layers: [thump(95, 42, 0.16, 0.85), body(450, 0.09, 0.7), crack(1100, 0.04, 0.35), body(250, 0.14, 0.3, 0.02)] },

  // ---- Explosives and throwables ----
  // A real bang: sharp crack, then a deep boom and rumble.
  explosion: { gapMs: 60, wet: 0.45, echo: 0.55, layers: [snap(0.9), crack(1800, 0.08, 0.8), { noise: true, filter: 'lowpass', freq: 1600, freqEnd: 120, dur: 1.2, gain: 0.95 }, thump(70, 25, 0.8, 0.9), { noise: true, filter: 'lowpass', freq: 300, dur: 1.5, gain: 0.35, attack: 0.1, delay: 0.1 }] },
  throw: { gapMs: 80, layers: [{ noise: true, filter: 'bandpass', freq: 1600, freqEnd: 600, q: 1, dur: 0.18, gain: 0.18, attack: 0.03 }] },
  beep: { gapMs: 50, layers: [{ wave: 'square', freq: 1500, dur: 0.06, gain: 0.18 }] },
  stick: { gapMs: 50, layers: [{ wave: 'square', freq: 320, freqEnd: 140, dur: 0.06, gain: 0.2 }] },
  // Molotov: the bottle smashes, then the fire catches with a whoosh.
  molotov: { gapMs: 80, layers: [...glass, { noise: true, filter: 'lowpass', freq: 600, dur: 1.0, gain: 0.5, attack: 0.15, delay: 0.08 }, ...crackles(14, 1.0, 0.25, 3000, 5).map((l) => ({ ...l, delay: l.delay + 0.15 }))] },
  // A patch of fire burning (repeats while it lasts).
  burning: { gapMs: 0, layers: [{ noise: true, filter: 'lowpass', freq: 500, dur: 1.2, gain: 0.5, attack: 0.2 }, ...crackles(12, 1.1, 0.55, 2800, 17)] },
  // Pressurised air rushing out of a canister (smoke and gas).
  hiss: { gapMs: 200, layers: [{ noise: true, filter: 'bandpass', freq: 5500, freqEnd: 3500, q: 0.8, dur: 2.6, gain: 0.55, attack: 0.05 }, { noise: true, filter: 'highpass', freq: 7000, dur: 2.2, gain: 0.25, attack: 0.05 }] },
  flashbang: { gapMs: 100, wet: 0.4, echo: 0.45, layers: [snap(0.9), crack(2500, 0.1, 0.8), { noise: true, filter: 'lowpass', freq: 2500, freqEnd: 300, dur: 0.5, gain: 0.7 }, { wave: 'sine', freq: 3600, dur: 1.8, gain: 0.07, attack: 0.05 }] },
  concussion: { gapMs: 100, wet: 0.45, echo: 0.5, layers: [snap(0.6), thump(65, 26, 0.7, 0.95), { noise: true, filter: 'lowpass', freq: 450, dur: 0.4, gain: 0.6 }] },
  // EMP: an electric buzz full of crackling sparks.
  emp: { gapMs: 100, layers: [{ wave: 'sawtooth', freq: 120, dur: 0.6, gain: 0.3, vibrato: { rate: 40, depth: 60 } }, { wave: 'square', freq: 240, freqEnd: 1800, dur: 0.25, gain: 0.18 }, ...crackles(22, 0.7, 0.8, 5000, 23)] },
  cryo: { gapMs: 100, layers: [{ noise: true, filter: 'highpass', freq: 4200, dur: 0.45, gain: 0.35 }, { wave: 'sine', freq: 2600, freqEnd: 1200, dur: 0.35, gain: 0.1 }, ...crackles(8, 0.4, 0.2, 7000, 31)] },

  // ---- Bodies ----
  hurtFlesh: { gapMs: 0, layers: [{ wave: 'sawtooth', freq: 230, freqEnd: 120, dur: 0.14, gain: 0.22, filter: 'lowpass', cutoff: 900 }, body(500, 0.06, 0.3)] },
  hurtMachine: { gapMs: 0, layers: [{ wave: 'square', freq: 1800, freqEnd: 1200, dur: 0.06, gain: 0.12 }, { noise: true, filter: 'highpass', freq: 3000, dur: 0.05, gain: 0.2 }] },
  hurtBone: { gapMs: 0, layers: [{ wave: 'square', freq: 900, dur: 0.03, gain: 0.15 }, { wave: 'square', freq: 700, dur: 0.03, gain: 0.12, delay: 0.05 }] },
  hurtStraw: { gapMs: 0, layers: [{ noise: true, filter: 'bandpass', freq: 1200, q: 0.8, dur: 0.06, gain: 0.25 }] },
  youHurt: { gapMs: 120, layers: [{ wave: 'sawtooth', freq: 190, freqEnd: 90, dur: 0.2, gain: 0.3, filter: 'lowpass', cutoff: 700 }, body(400, 0.08, 0.35)] },
  cough: { gapMs: 350, layers: [{ noise: true, filter: 'bandpass', freq: 700, q: 1.5, dur: 0.12, gain: 0.25 }, { noise: true, filter: 'bandpass', freq: 600, q: 1.5, dur: 0.1, gain: 0.2, delay: 0.16 }] },
  // Dying: each enemy class has its own last cry (see DEATH_CRIES below),
  // then the body hitting the ground. Falling into the void plays the same
  // cry, thin and echoing away (SoundSystem.fallCry).
  dieYou: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 175, dur: 0.75, gain: 0.7, rasp: 0.25 }), thud(0.65)] },
  dieSoldier: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 190, dur: 0.55, gain: 0.7, rasp: 0.25, drop: 0.55 }), thud(0.5)] },
  dieMercenary: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 145, dur: 0.4, gain: 0.7, f1: 600, f2: 1000, drop: 0.75, rasp: 0.3 }), thud(0.35)] }, // a short grunt
  dieCommando: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 215, dur: 0.75, gain: 0.7, vib: [6, 0.05] }), thud(0.7)] },        // a long yell
  dieTrooper: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 115, dur: 0.85, gain: 0.75, rasp: 0.45, f1: 550, f2: 950 }), thud(0.75, 0.6), clank(0.78)] }, // heavy groan, armour clanks
  dieInfected: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 160, dur: 0.8, gain: 0.65, vib: [14, 0.08], breath: 0.6, rasp: 0.35 }), body(400, 0.4, 0.3, 0.2), thud(0.75)] }, // choking gurgle
  dieZombie: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 100, dur: 1.15, gain: 0.75, vib: [3, 0.06], rasp: 0.5, f1: 500, f2: 900, drop: 0.7 }), thud(1.0)] }, // a long rotten groan
  dieAlien: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 480, dur: 0.5, gain: 0.55, vib: [22, 0.1], f1: 1600, f2: 2600, rasp: 0 }), ...crackles(8, 0.45, 0.35, 4000, 71), thud(0.45, 0.35)] }, // chittering shriek
  dieMutant: { gapMs: 60, wet: 0.4, echo: 0.3, layers: [...voice({ pitch: 80, dur: 1.2, gain: 0.85, rasp: 0.7, f1: 450, f2: 800, drop: 0.7, vib: [4, 0.05] }), thud(1.05, 0.7)] }, // a deep roar
  dieK9: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 700, dur: 0.18, gain: 0.9, drop: 0.5, f1: 1200, f2: 2000, rasp: 0 }), ...voice({ pitch: 560, dur: 0.35, gain: 0.75, drop: 0.45, f1: 1100, f2: 1900, rasp: 0, vib: [8, 0.05], delay: 0.22 })] }, // yelp, then a whimper
  dieCyborg: { gapMs: 60, wet: 0.35, layers: [...voice({ pitch: 170, dur: 0.4, gain: 0.6, rasp: 0.3 }), ...crackles(10, 0.5, 0.4, 5000, 73), powerDown(800, 0.6, 0.12, 0.35), thud(0.8)] }, // cry cut off by a glitch
  dieAndroid: { gapMs: 60, wet: 0.35, layers: [{ wave: 'square', freq: 220, dur: 0.35, gain: 0.3, filter: 'bandpass', cutoff: 1200, q: 3, vibrato: { rate: 30, depth: 40 } }, ...crackles(12, 0.5, 0.45, 5000, 79), powerDown(700, 0.7, 0.25, 0.3), clank(0.9)] }, // garbled voice, powering down
  dieRobot: { gapMs: 60, wet: 0.4, layers: [powerDown(900, 1.0, 0.3), ...crackles(10, 0.6, 0.45, 4500, 83), clank(0.9, 0.4), thud(0.95, 0.6)] }, // winding down, crashing
  dieDrone: { gapMs: 60, wet: 0.35, layers: [{ wave: 'sawtooth', freq: 1200, freqEnd: 180, dur: 0.8, gain: 0.22 }, ...crackles(8, 0.4, 0.4, 5000, 89), body(1500, 0.3, 0.5, 0.65), clank(0.7)] }, // rotors dying, crash
  deathBone: { gapMs: 60, layers: crackles(10, 0.4, 0.4, 1200, 41) },  // bones clattering down
  deathStraw: { gapMs: 60, layers: [{ noise: true, filter: 'bandpass', freq: 1000, q: 0.7, dur: 0.3, gain: 0.35 }] },
  deathMachine: { gapMs: 60, layers: [snap(0.5), { noise: true, filter: 'lowpass', freq: 1800, freqEnd: 200, dur: 0.6, gain: 0.7 }, { wave: 'square', freq: 1400, freqEnd: 300, dur: 0.25, gain: 0.12 }, ...crackles(10, 0.5, 0.3, 5000, 43)] },

  // On fire: a strangled cry of pain over crackling (repeats while burning).
  burnPain: { gapMs: 250, wet: 0.3, layers: [...voice({ pitch: 230, dur: 0.45, gain: 0.5, vib: [11, 0.06], rasp: 0.3 }), ...crackles(8, 0.4, 0.4, 2800, 51)] },
  burnPainYou: { gapMs: 250, wet: 0.3, layers: [...voice({ pitch: 200, dur: 0.5, gain: 0.55, vib: [11, 0.06], rasp: 0.3 }), ...crackles(8, 0.45, 0.4, 2800, 53)] },
  // The saw chewing into a body: wet, gritty squelch (on top of its grinding loop).
  grindFlesh: { gapMs: 140, layers: [{ noise: true, filter: 'lowpass', freq: 600, dur: 0.12, gain: 0.5 }, { noise: true, filter: 'bandpass', freq: 380, q: 3, dur: 0.15, gain: 0.45 }, ...crackles(4, 0.12, 0.35, 1500, 61)] },

  // ---- You and the HUD ----
  key: { gapMs: 0, layers: [{ wave: 'sine', freq: 2300, dur: 0.015, gain: 0.05 }] },
  // Gun jam: the trigger clicks on nothing, the action rattles and sticks.
  jam: { gapMs: 100, layers: [
    { wave: 'square', freq: 2800, dur: 0.012, gain: 0.3 },
    { noise: true, filter: 'highpass', freq: 4000, dur: 0.02, gain: 0.4 },
    { noise: true, filter: 'bandpass', freq: 1800, q: 4, dur: 0.08, gain: 0.35, delay: 0.06 },
    { wave: 'square', freq: 1400, dur: 0.015, gain: 0.2, delay: 0.09 },
    thump(320, 200, 0.05, 0.25, 0.12),
    { noise: true, filter: 'bandpass', freq: 1200, q: 3, dur: 0.06, gain: 0.25, delay: 0.2 },
  ] },
  switch: { gapMs: 80, layers: [{ noise: true, filter: 'highpass', freq: 2500, dur: 0.03, gain: 0.3 }, { noise: true, filter: 'highpass', freq: 2000, dur: 0.03, gain: 0.25, delay: 0.07 }] },
  // Reload (LMG belt): latch opens, old box out, belt rattles in, cover
  // slams shut, bolt racked back and forward.
  reload: { gapMs: 1000, layers: [
    { noise: true, filter: 'highpass', freq: 3000, dur: 0.03, gain: 0.4 },                                  // latch click
    { noise: true, filter: 'bandpass', freq: 1300, freqEnd: 700, q: 2, dur: 0.22, gain: 0.35, delay: 0.12 }, // box slides out
    ...crackles(14, 0.6, 0.35, 2200, 97).map((l) => ({ ...l, delay: l.delay + 0.7 })),                     // belt links rattling
    thump(380, 220, 0.06, 0.4, 1.45), { noise: true, filter: 'highpass', freq: 3500, dur: 0.03, gain: 0.45, delay: 1.45 }, // cover slams
    { noise: true, filter: 'bandpass', freq: 2200, freqEnd: 900, q: 2, dur: 0.14, gain: 0.4, delay: 2.0 },  // bolt back
    { noise: true, filter: 'bandpass', freq: 900, freqEnd: 2200, q: 2, dur: 0.1, gain: 0.4, delay: 2.2 },   // bolt forward
    thump(450, 250, 0.05, 0.4, 2.3), { noise: true, filter: 'highpass', freq: 4000, dur: 0.025, gain: 0.5, delay: 2.3 },  // clack
  ] },
  empty: { gapMs: 150, layers: [{ wave: 'square', freq: 900, dur: 0.03, gain: 0.12 }, { wave: 'square', freq: 900, dur: 0.03, gain: 0.12, delay: 0.08 }] },
  // Picking something up: a quick whoosh.
  pickup: { gapMs: 80, layers: [{ noise: true, filter: 'bandpass', freq: 400, freqEnd: 2600, q: 1.1, dur: 0.22, gain: 0.9, attack: 0.06 }] },
  heal: { gapMs: 200, layers: [{ noise: true, filter: 'bandpass', freq: 400, freqEnd: 2600, q: 1.1, dur: 0.22, gain: 0.8, attack: 0.06 }, { wave: 'sine', freq: 520, freqEnd: 780, dur: 0.3, gain: 0.18, delay: 0.1 }] },
  armor: { gapMs: 200, layers: [{ noise: true, filter: 'bandpass', freq: 400, freqEnd: 2600, q: 1.1, dur: 0.22, gain: 0.8, attack: 0.06 }, { noise: true, filter: 'bandpass', freq: 1500, dur: 0.1, gain: 0.3, delay: 0.12 }] },
  block: { gapMs: 60, layers: [{ wave: 'square', freq: 2400, freqEnd: 1800, dur: 0.08, gain: 0.15 }] },
  land: { gapMs: 100, layers: [thump(90, 50, 0.15, 0.4), body(600, 0.08, 0.25)] },
};

// Which sound a weapon fires with: its own key if SOUNDS has one (specials),
// else its family (category).
export function shotSoundFor(weapon) {
  if (!weapon) return null;
  if (SOUNDS[weapon.key]) return weapon.key;
  if (weapon.category === 'melee') return 'swing';
  return SOUNDS[weapon.category] ? weapon.category : 'pistol';
}

// Last cry by enemy class (BOTS name). Not listed: by what it's made of
// (bones clatter, straw dummies thud, other machines crunch).
export const DEATH_CRIES = {
  Soldier: 'dieSoldier',
  Mercenary: 'dieMercenary',
  Commando: 'dieCommando',
  'Armoured Trooper': 'dieTrooper',
  Zombie: 'dieZombie',
  'Infected Soldier': 'dieInfected',
  Alien: 'dieAlien',
  Cyborg: 'dieCyborg',
  Mutant: 'dieMutant',
  'Zombie K9': 'dieK9',
  Android: 'dieAndroid',
  Robot: 'dieRobot',
  Drone: 'dieDrone',
};

// Falling into the void: the cry gets thin (no low end) and echoes away.
export const FALL_CRY = { volume: 0.6, wet: 0.9, echo: 0.85, highpassHz: 900 };

// Tactical throwables pop with these.
export const TACTICAL_SOUNDS = {
  smoke: 'hiss',
  gas: 'hiss',
  flash: 'flashbang',
  concussion: 'concussion',
  emp: 'emp',
  cryo: 'cryo',
};

// Loops: sounds that keep going while something lasts (SoundSystem.hold).
// layers play together forever; noise: 'crackle' uses a buffer of random pops.
// gain: the loop's overall volume. pulse: the loop swells and fades in a
// rhythm (rate per second, depth 0..1).
export const LOOPS = {
  jet: { gain: 0.14, layers: [{ noise: true, filter: 'bandpass', freq: 420, q: 0.7, gain: 1 }] },
  // Jet Boost: a thin, high hiss instead of the deep rush.
  jetBoost: { gain: 0.06, layers: [{ noise: true, filter: 'bandpass', freq: 3600, q: 7, gain: 1 }, { noise: true, filter: 'highpass', freq: 9000, gain: 0.35 }] },
  // Smoke and gas: pressurised air hissing out until the cloud is gone.
  cloudHiss: { gain: 0.22, layers: [{ noise: true, filter: 'bandpass', freq: 4800, q: 0.9, gain: 1 }, { noise: true, filter: 'highpass', freq: 7500, gain: 0.4 }] },
  // A patch of fire (molotov) crackling and roaring softly.
  fire: { gain: 0.45, layers: [{ noise: 'crackle', filter: 'bandpass', freq: 2500, q: 0.8, gain: 1 }, { noise: true, filter: 'lowpass', freq: 500, gain: 0.5 }] },
  // You on fire: crackling all over you.
  burning: { gain: 0.5, layers: [{ noise: 'crackle', filter: 'bandpass', freq: 2800, q: 0.9, gain: 1 }, { noise: true, filter: 'lowpass', freq: 600, gain: 0.4 }] },
  // You choking in gas: ragged gasps in and out.
  gasBreath: { gain: 0.5, pulse: { rate: 1.3, depth: 0.95 }, layers: [{ noise: true, filter: 'bandpass', freq: 900, q: 2, gain: 1 }, { noise: true, filter: 'bandpass', freq: 1800, q: 5, gain: 0.5 }] },
  // Saw Gun blade spinning in the air.
  sawWhine: { gain: 0.12, layers: [{ wave: 'sawtooth', freq: 1150, gain: 0.5, vibrato: { rate: 30, depth: 15 } }, { noise: true, filter: 'highpass', freq: 3500, gain: 0.6 }] },
  // Saw Gun grinding into a body: lower, rough, wet.
  sawGrind: { gain: 0.3, layers: [{ wave: 'sawtooth', freq: 520, gain: 0.35, vibrato: { rate: 18, depth: 50 } }, { noise: true, filter: 'bandpass', freq: 1200, q: 1.5, gain: 0.8 }, { noise: 'crackle', filter: 'bandpass', freq: 900, q: 1, gain: 1 }, { noise: true, filter: 'lowpass', freq: 300, gain: 0.5 }] },
  // Saw Gun grinding metal: high scream and sparks.
  sawGrindMetal: { gain: 0.25, layers: [{ wave: 'sawtooth', freq: 1700, gain: 0.4, vibrato: { rate: 25, depth: 60 } }, { noise: 'crackle', filter: 'highpass', freq: 4000, gain: 1 }, { noise: true, filter: 'highpass', freq: 5000, gain: 0.5 }] },
};