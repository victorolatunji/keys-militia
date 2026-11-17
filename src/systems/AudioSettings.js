import { AUDIO_DEFAULTS, AUDIO_STORAGE_KEY, SAMPLE_GAIN } from '../data/audio.js';
import { SOUND_SETTINGS } from '../data/sounds.js';

// The volume settings (Settings screen; F4 mutes everything), shared by
// every scene and remembered in this browser. 0..1 each:
//   master (everything), music, sfx (effects and buttons), voice (speech, cries).
// Anything that plays a sound asks here how loud it may be.
const listeners = new Set();
let state = null;

function load() {
  let saved = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(AUDIO_STORAGE_KEY) ?? '{}') ?? {};
    // Before 0.34, F4 saved just on/off.
    if (window.localStorage.getItem(SOUND_SETTINGS.storageKey) === 'off' && saved.muted === undefined) saved.muted = true;
  } catch {
    // storage blocked: defaults
  }
  return { ...AUDIO_DEFAULTS, ...saved };
}

export const AudioSettings = {
  get() {
    state ??= load();
    return state;
  },

  set(changes) {
    state = { ...this.get(), ...changes };
    for (const k of ['master', 'music', 'sfx', 'voice']) state[k] = Math.min(1, Math.max(0, Math.round(state[k] * 100) / 100));
    try {
      window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(state));
      window.localStorage.setItem(SOUND_SETTINGS.storageKey, state.muted ? 'off' : 'on');
    } catch {
      // not saved
    }
    for (const fn of listeners) fn(state);
  },

  toggleMute() {
    this.set({ muted: !this.get().muted });
    return !this.get().muted;
  },

  // How loud a channel plays right now (0 when muted).
  level(channel) {
    const s = this.get();
    if (s.muted) return 0;
    return s.master * (s[channel] ?? 1);
  },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// A button or menu sound (ui-move, ui-select, ui-back, ui-pause, ui-scroll),
// from any scene. Quietly does nothing if the file isn't there.
export function uiSound(scene, key, volume = 1) {
  const level = AudioSettings.level('sfx') * SAMPLE_GAIN.ui * volume;
  if (level <= 0 || !scene?.cache?.audio?.exists(key)) return;
  try {
    scene.sound.play(key, { volume: level });
  } catch {
    // audio not ready yet (no click on the page so far): skip it
  }
}
