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
};

const crack = (freq, dur, gain) => ({ noise: true, filter: 'bandpass', freq, q: 0.9, dur, gain });
const thump = (freq, freqEnd, dur, gain) => ({ wave: 'sine', freq, freqEnd, dur, gain });
const tail = (dur, gain) => ({ noise: true, filter: 'lowpass', freq: 900, freqEnd: 200, dur, gain, delay: 0.02 });

export const SOUNDS = {
  // ---- Guns (your shots; enemies use the same, quieter and lower) ----
  pistol: { gapMs: 40, layers: [crack(1800, 0.12, 0.6), thump(170, 60, 0.08, 0.35)] },
  smg: { gapMs: 35, layers: [{ noise: true, filter: 'highpass', freq: 1300, dur: 0.07, gain: 0.45 }, thump(220, 90, 0.05, 0.22)] },
  assault: { gapMs: 45, layers: [crack(1400, 0.14, 0.6), thump(140, 50, 0.1, 0.4), tail(0.18, 0.15)] },
  lmg: { gapMs: 40, layers: [{ noise: true, filter: 'lowpass', freq: 2600, dur: 0.15, gain: 0.65 }, thump(110, 40, 0.13, 0.45)] },
  shotgun: { gapMs: 80, layers: [{ noise: true, filter: 'lowpass', freq: 3200, freqEnd: 600, dur: 0.38, gain: 0.85 }, thump(95, 35, 0.25, 0.55)] },
  marksman: { gapMs: 80, layers: [{ noise: true, filter: 'highpass', freq: 2000, dur: 0.1, gain: 0.6 }, thump(160, 50, 0.1, 0.35), tail(0.45, 0.25)] },
  rifle: { gapMs: 100, layers: [{ noise: true, filter: 'highpass', freq: 1800, dur: 0.12, gain: 0.75 }, thump(130, 40, 0.14, 0.5), tail(0.7, 0.3)] },
  launcher: { gapMs: 80, layers: [{ noise: true, filter: 'bandpass', freq: 700, freqEnd: 200, q: 0.7, dur: 0.5, gain: 0.55, attack: 0.03 }, thump(90, 40, 0.2, 0.4)] },

  // ---- Specials ----
  sawGun: { gapMs: 80, layers: [{ wave: 'sawtooth', freq: 900, freqEnd: 1300, dur: 0.45, gain: 0.12 }, { noise: true, filter: 'highpass', freq: 3000, dur: 0.45, gain: 0.12 }] },
  nailGun: { gapMs: 40, layers: [{ wave: 'square', freq: 620, freqEnd: 200, dur: 0.05, gain: 0.22 }, { noise: true, filter: 'highpass', freq: 2500, dur: 0.04, gain: 0.3 }] },
  laser: { gapMs: 80, layers: [{ wave: 'sawtooth', freq: 1800, freqEnd: 300, dur: 0.25, gain: 0.2 }, { wave: 'sine', freq: 900, freqEnd: 150, dur: 0.28, gain: 0.2 }] },
  flamethrower: { gapMs: 120, layers: [{ noise: true, filter: 'bandpass', freq: 900, q: 0.5, dur: 0.5, gain: 0.45, attack: 0.05 }] },

  // ---- Melee ----
  swing: { gapMs: 60, layers: [{ noise: true, filter: 'bandpass', freq: 900, freqEnd: 2600, q: 1.2, dur: 0.15, gain: 0.3, attack: 0.03 }] },
  meleeHit: { gapMs: 50, layers: [thump(130, 60, 0.12, 0.55), { noise: true, filter: 'lowpass', freq: 700, dur: 0.08, gain: 0.4 }] },

  // ---- Explosives and throwables ----
  explosion: { gapMs: 60, layers: [{ noise: true, filter: 'lowpass', freq: 1400, freqEnd: 150, dur: 1.0, gain: 0.95 }, thump(75, 28, 0.7, 0.8)] },
  throw: { gapMs: 80, layers: [{ noise: true, filter: 'bandpass', freq: 1600, freqEnd: 600, q: 1, dur: 0.18, gain: 0.18, attack: 0.03 }] },
  beep: { gapMs: 50, layers: [{ wave: 'square', freq: 1500, dur: 0.06, gain: 0.18 }] },
  stick: { gapMs: 50, layers: [{ wave: 'square', freq: 320, freqEnd: 140, dur: 0.06, gain: 0.2 }] },
  molotov: { gapMs: 80, layers: [{ noise: true, filter: 'highpass', freq: 3500, dur: 0.18, gain: 0.45 }, { noise: true, filter: 'bandpass', freq: 500, q: 0.6, dur: 0.9, gain: 0.35, attack: 0.12, delay: 0.05 }] },
  hiss: { gapMs: 200, layers: [{ noise: true, filter: 'highpass', freq: 2600, dur: 1.4, gain: 0.25, attack: 0.15 }] },
  flashbang: { gapMs: 100, layers: [{ noise: true, filter: 'lowpass', freq: 2500, freqEnd: 300, dur: 0.5, gain: 0.8 }, { wave: 'sine', freq: 3600, dur: 1.6, gain: 0.06, attack: 0.05 }] },
  concussion: { gapMs: 100, layers: [thump(65, 28, 0.6, 0.9), { noise: true, filter: 'lowpass', freq: 450, dur: 0.35, gain: 0.55 }] },
  emp: { gapMs: 100, layers: [{ wave: 'sawtooth', freq: 180, freqEnd: 2200, dur: 0.3, gain: 0.2 }, { wave: 'square', freq: 60, dur: 0.45, gain: 0.18 }, { noise: true, filter: 'highpass', freq: 4000, dur: 0.3, gain: 0.2 }] },
  cryo: { gapMs: 100, layers: [{ noise: true, filter: 'highpass', freq: 4200, dur: 0.45, gain: 0.35 }, { wave: 'sine', freq: 2600, freqEnd: 1200, dur: 0.35, gain: 0.1 }] },

  // ---- Bodies ----
  hurtFlesh: { gapMs: 0, layers: [{ wave: 'sawtooth', freq: 230, freqEnd: 120, dur: 0.14, gain: 0.22, filter: 'lowpass', cutoff: 900 }, { noise: true, filter: 'lowpass', freq: 500, dur: 0.06, gain: 0.3 }] },
  hurtMachine: { gapMs: 0, layers: [{ wave: 'square', freq: 1800, freqEnd: 1200, dur: 0.06, gain: 0.12 }, { noise: true, filter: 'highpass', freq: 3000, dur: 0.05, gain: 0.2 }] },
  hurtBone: { gapMs: 0, layers: [{ wave: 'square', freq: 900, dur: 0.03, gain: 0.15 }, { wave: 'square', freq: 700, dur: 0.03, gain: 0.12, delay: 0.05 }] },
  hurtStraw: { gapMs: 0, layers: [{ noise: true, filter: 'bandpass', freq: 1200, q: 0.8, dur: 0.06, gain: 0.25 }] },
  youHurt: { gapMs: 120, layers: [{ wave: 'sawtooth', freq: 190, freqEnd: 90, dur: 0.2, gain: 0.3, filter: 'lowpass', cutoff: 700 }, { noise: true, filter: 'lowpass', freq: 400, dur: 0.08, gain: 0.35 }] },
  cough: { gapMs: 350, layers: [{ noise: true, filter: 'bandpass', freq: 700, q: 1.5, dur: 0.12, gain: 0.25 }, { noise: true, filter: 'bandpass', freq: 600, q: 1.5, dur: 0.1, gain: 0.2, delay: 0.16 }] },
  deathFlesh: { gapMs: 60, layers: [{ wave: 'sawtooth', freq: 210, freqEnd: 65, dur: 0.45, gain: 0.28, filter: 'lowpass', cutoff: 800 }, { noise: true, filter: 'lowpass', freq: 350, dur: 0.3, gain: 0.5, delay: 0.05 }] },
  deathMachine: { gapMs: 60, layers: [{ noise: true, filter: 'lowpass', freq: 1800, freqEnd: 200, dur: 0.6, gain: 0.7 }, { wave: 'square', freq: 1400, freqEnd: 300, dur: 0.25, gain: 0.12 }] },

  // ---- You and the HUD ----
  key: { gapMs: 0, layers: [{ wave: 'sine', freq: 2300, dur: 0.015, gain: 0.05 }] },
  jam: { gapMs: 100, layers: [{ wave: 'square', freq: 110, dur: 0.18, gain: 0.2 }] },
  switch: { gapMs: 80, layers: [{ noise: true, filter: 'highpass', freq: 2500, dur: 0.03, gain: 0.3 }, { noise: true, filter: 'highpass', freq: 2000, dur: 0.03, gain: 0.25, delay: 0.07 }] },
  reload: { gapMs: 200, layers: [{ wave: 'square', freq: 300, dur: 0.05, gain: 0.15 }, { wave: 'square', freq: 420, dur: 0.05, gain: 0.15, delay: 0.25 }] },
  empty: { gapMs: 150, layers: [{ wave: 'square', freq: 900, dur: 0.03, gain: 0.12 }, { wave: 'square', freq: 900, dur: 0.03, gain: 0.12, delay: 0.08 }] },
  pickup: { gapMs: 80, layers: [{ wave: 'sine', freq: 660, dur: 0.07, gain: 0.22 }, { wave: 'sine', freq: 990, dur: 0.1, gain: 0.22, delay: 0.07 }] },
  heal: { gapMs: 200, layers: [{ wave: 'sine', freq: 520, freqEnd: 780, dur: 0.3, gain: 0.22 }] },
  armor: { gapMs: 200, layers: [{ noise: true, filter: 'bandpass', freq: 1500, dur: 0.1, gain: 0.3 }, { wave: 'square', freq: 700, dur: 0.05, gain: 0.08 }] },
  block: { gapMs: 60, layers: [{ wave: 'square', freq: 2400, freqEnd: 1800, dur: 0.08, gain: 0.15 }] },
  land: { gapMs: 100, layers: [thump(90, 50, 0.15, 0.4), { noise: true, filter: 'lowpass', freq: 600, dur: 0.08, gain: 0.25 }] },
};

// Which sound a weapon fires with: its own key if SOUNDS has one (specials),
// else its family (category).
export function shotSoundFor(weapon) {
  if (!weapon) return null;
  if (SOUNDS[weapon.key]) return weapon.key;
  if (weapon.category === 'melee') return 'swing';
  return SOUNDS[weapon.category] ? weapon.category : 'pistol';
}

// Tactical throwables pop with these.
export const TACTICAL_SOUNDS = {
  smoke: 'hiss',
  gas: 'hiss',
  flash: 'flashbang',
  concussion: 'concussion',
  emp: 'emp',
  cryo: 'cryo',
};

// Jetpack: a soft rushing loop while you thrust (your jetpack only).
export const JET_LOOP = { filter: 'bandpass', freq: 420, q: 0.7, gain: 0.12, fadeMs: 80 };