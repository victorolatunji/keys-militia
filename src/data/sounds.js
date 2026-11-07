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
  reverb: { seconds: 1.4, decay: 3.5, level: 0.4, send: 0.14 },
  // ...and a far echo for big sounds (sounds with an `echo` amount).
  echo: { delaySec: 0.3, feedback: 0.2, cutoff: 1600 },
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


// ---- Voices ----
// A human (or creature) cry built like a real voice: a buzzing vocal source
// shaped by three mouth resonances (formants F1, F2, F3), with breath, a
// sharp intake at the start, a pitch that rises then falls, and the mouth
// closing from "AAH" to "uh" as the cry dies.
// Voice types: formants for "ah" and "uh", and a natural pitch.
export const VOICE_TYPES = {
  man: { pitch: 120, ah: [730, 1090, 2440], uh: [520, 1190, 2390] },
  woman: { pitch: 210, ah: [850, 1220, 2810], uh: [600, 1300, 2700] },
  child: { pitch: 300, ah: [1030, 1370, 3170], uh: [800, 1500, 3000] },
  brute: { pitch: 88, ah: [600, 1000, 2300], uh: [450, 900, 2200] },   // mutant-sized chest
  creature: { pitch: 360, ah: [1200, 2000, 3400], uh: [1000, 1800, 3200] }, // alien
};

// Your character's voice (character select can change it later: 'man',
// 'woman' or 'child').
export const PLAYER_VOICE = 'man';

//   type: VOICE_TYPES key   pitch: override Hz   dur: seconds   gain
//   rise: how far the cry climbs before it falls   drop: pitch at the end
//   vib: [rate, depth share]   rasp: rough growl   breath: air in it
//   hold: share of the cry at full strength   vowel: 'ah' or 'uh' to start with
function voice({ type = 'man', pitch, dur, gain, rise = 1.3, drop = 0.7, vib = [5.5, 0.025], rasp = 0.05, breath = 0.3, hold = 0.35, vowel = 'ah', delay = 0 }) {
  const t = VOICE_TYPES[type];
  const p = pitch ?? t.pitch;
  const from = t[vowel];
  const to = t.uh;
  const vibrato = { rate: vib[0], depth: p * vib[1] };
  const tone = (i, g, q) => ({
    wave: 'sawtooth', freq: p, freqMid: p * rise, midAt: 0.2, freqEnd: p * drop, dur, gain: g, attack: 0.03, hold,
    filter: 'bandpass', cutoff: from[i], cutoffEnd: to[i], q, vibrato, delay,
  });
  const layers = [
    tone(0, gain, 6),          // F1: the body of the vowel
    tone(1, gain * 0.55, 9),   // F2: which vowel it is
    tone(2, gain * 0.25, 12),  // F3: brightness / "human" edge
    { noise: true, filter: 'bandpass', freq: from[1], freqEnd: to[1], q: 2, dur: dur * 0.9, gain: gain * breath, attack: 0.03, hold, delay }, // breath in the cry
    { noise: true, filter: 'bandpass', freq: 1800, q: 1, dur: 0.07, gain: gain * 0.45, delay },                                             // the gasp before it
  ];
  if (rasp) layers.push({ wave: 'square', freq: p / 2, freqMid: (p * rise) / 2, midAt: 0.2, freqEnd: (p * drop) / 2, dur, gain: gain * rasp, hold, filter: 'lowpass', cutoff: 450, delay });
  return layers;
}
const thud = (delay, gain = 0.3) => body(450, 0.18, gain, delay); // body hitting the ground (light, not boomy)
const clank = (delay, gain = 0.3) => ({ wave: 'square', freq: 700, freqEnd: 300, dur: 0.12, gain, filter: 'bandpass', cutoff: 1400, q: 3, delay });
// Metal scrap falling apart: bright, uneven metallic pings and clanks
// (several overtones that don't line up, like real sheet metal), with a
// scrape, spread over `span` seconds and dying away. Seeded, so it's stable.
function metalScrap(count, span, gain, seed = 101) {
  let r = seed;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const out = [{ noise: true, filter: 'bandpass', freq: 3200, freqEnd: 1800, q: 3, dur: span * 0.6, gain: gain * 0.35 }]; // scrape
  for (let i = 0; i < count; i++) {
    const at = Math.pow(rand(), 1.4) * span;           // more pieces early, fewer later
    const g = gain * (1 - (at / span) * 0.6) * (0.5 + rand() * 0.5);
    const base = 1400 + rand() * 2600;
    const ring = 0.06 + rand() * 0.22;
    out.push({ noise: true, filter: 'highpass', freq: 3500, dur: 0.015, gain: g * 0.8, delay: at }); // the hit
    out.push({ wave: 'sine', freq: base, dur: ring, gain: g * 0.5, delay: at });                    // ring
    out.push({ wave: 'sine', freq: base * 1.47, dur: ring * 0.7, gain: g * 0.3, delay: at });
    out.push({ wave: 'sine', freq: base * 2.09, dur: ring * 0.5, gain: g * 0.2, delay: at });
  }
  return out;
}
const fizz = (dur, gain, delay = 0) => ({ noise: true, filter: 'highpass', freq: 5000, dur, gain, delay }); // electric fizz
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
  // Combat Axe biting in: a heavy chop, a wet crunch and a short steel ring.
  axeHit: { gapMs: 50, layers: [thump(110, 45, 0.18, 0.9), crack(900, 0.05, 0.5), body(700, 0.12, 0.55, 0.01), { wave: 'triangle', freq: 2300, freqEnd: 2150, dur: 0.25, gain: 0.07, delay: 0.01 }, ...crackles(4, 0.08, 0.2, 1800, 17)] },

  // ---- Maps (Phase 7) ----
  splash: { gapMs: 90, layers: [{ noise: true, filter: 'lowpass', freq: 1800, freqEnd: 500, dur: 0.35, gain: 0.9 }, thump(90, 50, 0.2, 0.3), { noise: true, filter: 'bandpass', freq: 3000, q: 1, dur: 0.2, gain: 0.45, delay: 0.03 }, ...crackles(8, 0.4, 0.3, 2500, 23)] }, // falling in water
  splashSmall: { gapMs: 90, layers: [{ noise: true, filter: 'bandpass', freq: 1600, q: 1.2, dur: 0.15, gain: 0.6 }, ...crackles(4, 0.18, 0.25, 2800, 29)] }, // climbing out, a throwable landing in water
  gurgle: { gapMs: 300, layers: [{ wave: 'sine', freq: 260, freqEnd: 520, dur: 0.08, gain: 0.25 }, { wave: 'sine', freq: 300, freqEnd: 600, dur: 0.07, gain: 0.2, delay: 0.12 }, { wave: 'sine', freq: 220, freqEnd: 480, dur: 0.09, gain: 0.2, delay: 0.22 }, body(400, 0.3, 0.15)] }, // out of breath underwater
  gasp: { gapMs: 300, layers: [{ noise: true, filter: 'bandpass', freq: 1400, freqEnd: 900, q: 2, dur: 0.35, gain: 0.8, attack: 0.05 }] }, // coming up for air
  lavaSizzle: { gapMs: 150, layers: [{ noise: true, filter: 'highpass', freq: 3000, dur: 0.5, gain: 0.4, attack: 0.02 }, ...crackles(10, 0.5, 0.2, 3200, 31)] }, // touching lava
  geyserWarn: { gapMs: 200, layers: [{ noise: true, filter: 'lowpass', freq: 300, dur: 0.9, gain: 0.9, attack: 0.5 }, thump(55, 40, 0.9, 0.25), ...crackles(6, 0.9, 0.25, 1200, 37)] }, // rumbling before it blows
  geyser: { gapMs: 200, echo: 0.3, layers: [{ noise: true, filter: 'lowpass', freq: 900, freqEnd: 400, dur: 1.2, gain: 0.6, attack: 0.04 }, { noise: true, filter: 'bandpass', freq: 2200, q: 0.8, dur: 0.9, gain: 0.3 }, thump(70, 35, 0.4, 0.6), ...crackles(16, 1.1, 0.2, 2600, 41)] }, // a fire geyser erupting
  waterBlast: { gapMs: 80, echo: 0.2, layers: [thump(70, 30, 0.5, 0.9), body(300, 0.5, 0.6), { noise: true, filter: 'lowpass', freq: 1500, freqEnd: 400, dur: 0.7, gain: 0.7, delay: 0.08 }, ...crackles(14, 0.8, 0.25, 2200, 43).map((l) => ({ ...l, delay: l.delay + 0.1 }))] }, // a muffled boom, then the water column crashing down
  iceForm: { gapMs: 150, layers: [{ noise: true, filter: 'highpass', freq: 3000, freqEnd: 6000, dur: 0.5, gain: 0.35, attack: 0.05 }, ...crackles(12, 0.5, 0.25, 4500, 47), { wave: 'sine', freq: 2600, freqEnd: 1800, dur: 0.3, gain: 0.06, delay: 0.1 }] }, // water freezing over
  iceCrack: { gapMs: 200, layers: [snap(0.5), ...crackles(8, 0.25, 0.35, 3800, 53)] },
  iceBreak: { gapMs: 200, layers: [...glass, body(500, 0.2, 0.3)] },
  steam: { gapMs: 150, layers: [{ noise: true, filter: 'highpass', freq: 2500, dur: 0.8, gain: 0.45, attack: 0.03 }] }, // fire hitting water
  chirp: { gapMs: 250, vary: 0.15, layers: [{ wave: 'sine', freq: 3200, freqEnd: 4200, dur: 0.06, gain: 0.14 }, { wave: 'sine', freq: 3600, freqEnd: 4600, dur: 0.05, gain: 0.11, delay: 0.09 }] }, // a bird overhead

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
  hurtMachine: { gapMs: 0, vary: 0.15, layers: metalScrap(1, 0.01, 0.5, 131) }, // a bullet pinging off metal
  hurtBone: { gapMs: 0, layers: [{ wave: 'square', freq: 900, dur: 0.03, gain: 0.15 }, { wave: 'square', freq: 700, dur: 0.03, gain: 0.12, delay: 0.05 }] },
  hurtStraw: { gapMs: 0, layers: [{ noise: true, filter: 'bandpass', freq: 1200, q: 0.8, dur: 0.06, gain: 0.25 }] },
  youHurt: { gapMs: 120, layers: [{ wave: 'sawtooth', freq: 190, freqEnd: 90, dur: 0.2, gain: 0.3, filter: 'lowpass', cutoff: 700 }, body(400, 0.08, 0.35)] },
  cough: { gapMs: 350, layers: [{ noise: true, filter: 'bandpass', freq: 700, q: 1.5, dur: 0.12, gain: 0.25 }, { noise: true, filter: 'bandpass', freq: 600, q: 1.5, dur: 0.1, gain: 0.2, delay: 0.16 }] },
  // Dying: each enemy class has its own last cry (see DEATH_CRIES below),
  // then the body hitting the ground. Falling into the void plays the same
  // cry, thin and echoing away (SoundSystem.fallCry).
  dieYou: { gapMs: 60, wet: 0.18, vary: 0.05, layers: [...voice({ type: PLAYER_VOICE, dur: 0.85, gain: 0.8 }), thud(0.75)] },
  dieSoldier: { gapMs: 60, wet: 0.18, vary: 0.08, layers: [...voice({ pitch: 125, dur: 0.7, gain: 0.8 }), thud(0.6)] },
  dieMercenary: { gapMs: 60, wet: 0.18, vary: 0.08, layers: [...voice({ pitch: 118, dur: 0.4, gain: 0.8, rise: 1.1, drop: 0.8, vowel: 'uh', rasp: 0.12 }), thud(0.35)] }, // short grunt
  dieCommando: { gapMs: 60, wet: 0.18, vary: 0.08, layers: [...voice({ pitch: 140, dur: 1.0, gain: 0.8, rise: 1.5, hold: 0.45 }), thud(0.9)] },                            // long yell
  dieTrooper: { gapMs: 60, wet: 0.18, vary: 0.06, layers: [...voice({ pitch: 108, dur: 0.9, gain: 0.85, rise: 1.15, rasp: 0.15, vowel: 'uh' }), thud(0.9, 0.4), clank(0.92)] }, // heavy groan, armour clank
  dieInfected: { gapMs: 60, wet: 0.18, vary: 0.08, layers: [...voice({ pitch: 115, dur: 0.9, gain: 0.75, vib: [12, 0.07], breath: 0.6, rasp: 0.15 }), body(400, 0.4, 0.3, 0.2), thud(0.85)] }, // choking gurgle
  dieZombie: { gapMs: 60, wet: 0.18, vary: 0.06, layers: [...voice({ pitch: 98, dur: 1.15, gain: 0.85, rise: 1.1, drop: 0.75, vowel: 'uh', vib: [3, 0.06], rasp: 0.2, hold: 0.5 }), thud(1.15)] }, // rotten groan
  dieAlien: { gapMs: 60, wet: 0.18, vary: 0.1, layers: [...voice({ type: 'creature', dur: 0.55, gain: 0.65, vib: [22, 0.08], rasp: 0 }), ...crackles(8, 0.45, 0.35, 4000, 71), thud(0.5, 0.35)] }, // chittering shriek
  dieMutant: { gapMs: 60, wet: 0.18, echo: 0.15, vary: 0.06, layers: [...voice({ type: 'brute', dur: 1.3, gain: 0.95, rise: 1.2, rasp: 0.15, vib: [4, 0.05], hold: 0.5 }), thud(1.15, 0.45)] }, // deep roar
  dieK9: { gapMs: 60, wet: 0.18, vary: 0.08, layers: [...voice({ type: 'creature', pitch: 650, dur: 0.18, gain: 0.85, rise: 1.2, drop: 0.5, rasp: 0 }), ...voice({ type: 'creature', pitch: 520, dur: 0.4, gain: 0.7, rise: 1.0, drop: 0.45, rasp: 0, vib: [8, 0.05], vowel: 'uh', delay: 0.22 })] }, // yelp, whimper
  dieCyborg: { gapMs: 60, wet: 0.18, vary: 0.06, layers: [...voice({ pitch: 120, dur: 0.35, gain: 0.6 }), fizz(0.3, 0.25, 0.25), ...metalScrap(9, 0.9, 0.32, 103)] }, // cry cut off, falls apart in scrap
  dieAndroid: { gapMs: 60, wet: 0.18, vary: 0.08, layers: [fizz(0.25, 0.3), powerDown(600, 0.35, 0.1), ...metalScrap(12, 1.0, 0.35, 107)] }, // fizzes out, scrap clattering down
  dieRobot: { gapMs: 60, wet: 0.18, vary: 0.06, layers: [fizz(0.2, 0.25), powerDown(700, 0.4, 0.12), ...metalScrap(15, 1.2, 0.36, 109)] }, // heavy scrap heap
  dieDrone: { gapMs: 60, wet: 0.18, vary: 0.1, layers: [{ wave: 'sawtooth', freq: 1200, freqEnd: 300, dur: 0.35, gain: 0.12 }, fizz(0.2, 0.2), ...metalScrap(8, 0.8, 0.32, 113)] }, // rotors die, light parts rain down
  deathBone: { gapMs: 60, layers: crackles(10, 0.4, 0.4, 1200, 41) },  // bones clattering down
  deathStraw: { gapMs: 60, layers: [{ noise: true, filter: 'bandpass', freq: 1000, q: 0.7, dur: 0.3, gain: 0.35 }] },
  deathMachine: { gapMs: 60, wet: 0.18, vary: 0.08, layers: [snap(0.4), fizz(0.25, 0.25), ...metalScrap(12, 1.0, 0.35, 127)] }, // scrap bot and other machines

  // On fire: a strangled cry of pain over crackling (repeats while burning).
  burnPain: { gapMs: 250, wet: 0.3, vary: 0.1, layers: [...voice({ pitch: 150, dur: 0.5, gain: 0.6, rise: 1.4, vib: [11, 0.05], rasp: 0.12 }), ...crackles(8, 0.4, 0.4, 2800, 51)] },
  burnPainYou: { gapMs: 250, wet: 0.3, vary: 0.08, layers: [...voice({ type: PLAYER_VOICE, dur: 0.55, gain: 0.65, rise: 1.4, vib: [11, 0.05], rasp: 0.12 }), ...crackles(8, 0.45, 0.4, 2800, 53)] },
  // The saw chewing into a body: wet, gritty squelch (on top of its grinding loop).
  grindFlesh: { gapMs: 140, layers: [{ noise: true, filter: 'lowpass', freq: 600, dur: 0.12, gain: 0.5 }, { noise: true, filter: 'bandpass', freq: 380, q: 3, dur: 0.15, gain: 0.45 }, ...crackles(4, 0.12, 0.35, 1500, 61)] },

  // Saw biting metal (each grind tick on a machine): a scrape and a shard.
  grindMetal: { gapMs: 140, vary: 0.2, layers: [{ noise: true, filter: 'bandpass', freq: 3500, q: 5, dur: 0.12, gain: 0.35 }, ...metalScrap(1, 0.01, 0.4, 137)] },
  // Pieces of a body landing (they play as each piece bounces, so the
  // death sound follows what you see): scrap, flesh, bone.
  landScrap: { gapMs: 45, vary: 0.25, layers: metalScrap(1, 0.01, 0.45, 139) },
  landFlesh: { gapMs: 60, vary: 0.2, layers: [{ noise: true, filter: 'lowpass', freq: 700, dur: 0.06, gain: 0.3 }, { noise: true, filter: 'bandpass', freq: 400, q: 2, dur: 0.05, gain: 0.2 }] },
  shellTink: { gapMs: 35, vary: 0.3, wet: 0.08, layers: [{ wave: 'sine', freq: 4200, dur: 0.05, gain: 0.08 }, { wave: 'sine', freq: 6100, dur: 0.035, gain: 0.05 }, { noise: true, filter: 'highpass', freq: 5000, dur: 0.01, gain: 0.08 }] }, // brass casing
  landBone: { gapMs: 50, vary: 0.25, layers: [{ wave: 'square', freq: 1100, dur: 0.02, gain: 0.12 }, { noise: true, filter: 'highpass', freq: 2500, dur: 0.02, gain: 0.2 }] },

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
  // Maps: a waterfall's steady roar, lava bubbling, a heat vent's hot breath.
  waterfall: { gain: 0.3, layers: [{ noise: true, filter: 'lowpass', freq: 1200, gain: 1 }, { noise: true, filter: 'bandpass', freq: 3000, q: 0.6, gain: 0.35 }] },
  lava: { gain: 0.35, pulse: { rate: 0.7, depth: 0.5 }, layers: [{ noise: true, filter: 'lowpass', freq: 220, gain: 1 }, { noise: 'crackle', filter: 'bandpass', freq: 700, q: 1, gain: 0.6 }] },
  vent: { gain: 0.18, layers: [{ noise: true, filter: 'bandpass', freq: 700, q: 0.8, gain: 1 }] },
  sawGrindMetal: { gain: 0.22, layers: [{ noise: true, filter: 'bandpass', freq: 3800, q: 6, gain: 1 }, { wave: 'sawtooth', freq: 2400, gain: 0.15, vibrato: { rate: 35, depth: 90 } }, { noise: 'crackle', filter: 'highpass', freq: 4500, gain: 0.8 }] }, // blade screeching on metal
};
