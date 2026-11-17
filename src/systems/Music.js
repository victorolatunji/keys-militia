import { MUSIC, musicKeys } from '../data/audio.js';
import { AudioSettings } from './AudioSettings.js';

// Music per screen (title, menu, lobby, comic, settings...), one track at a time,
// cross-faded when the screen changes, looping. Game-wide: it keeps playing
// across scenes (a scene changing doesn't cut it). A track with no file in
// MUSIC (src/data/audio.js) is simply silent, so this works before the
// music is added. Its volume follows Settings (Master x Music).
let current = null; // { name, sound }
let manager = null;
let ducked = false;
let wanted = null;   // the track asked for while audio was still locked
let waiting = false;


function target(name) {
  return AudioSettings.level('music') * (MUSIC.volume[name] ?? 0.6) * (ducked ? 0.45 : 1);
}

// Fade a sound's volume over ms (plain timers: no scene owns the music).
function fade(sound, to, ms, done) {
  const from = sound.volume;
  const t0 = performance.now();
  const step = () => {
    if (!sound.manager) return; // destroyed
    const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
    sound.setVolume(from + (to - from) * k);
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  step();
}

export const Music = {
  // Play this screen's track (a stinger plays once). Same track: keeps going.
  play(scene, name, { once = false } = {}) {
    manager = scene.sound;
    if (name === 'lobby' && !MUSIC.lobby) name = 'menu'; // the lobby keeps the menu's track
    if (current?.name === name) return;
    // The browser keeps audio locked until the first click or key: start
    // this screen's track as soon as it unlocks.
    if (scene.sound.locked) {
      wanted = { scene, name, once };
      if (!waiting) {
        waiting = true;
        scene.sound.once('unlocked', () => {
          waiting = false;
          const w = wanted;
          wanted = null;
          if (w?.scene.sys.isActive()) this.play(w.scene, w.name, { once: w.once });
        });
      }
      return;
    }
    wanted = null;
    this.stop();
    const keys = musicKeys(name).map((m) => m.key).filter((k) => scene.cache.audio.exists(k));
    if (!keys.length) return;
    try {
      const sound = scene.sound.add(keys[Math.floor(Math.random() * keys.length)], { loop: !once, volume: 0 });
      sound.play();
      current = { name, sound };
      fade(sound, target(name), MUSIC.fadeMs);
      if (once) sound.once('complete', () => current?.sound === sound && this.stop());
    } catch {
      current = null; // audio locked until the first click or key: the next screen tries again
    }
  },

  stop() {
    if (!current) return;
    const { sound } = current;
    current = null;
    fade(sound, 0, MUSIC.fadeMs, () => sound.destroy());
  },

  // Quieter while a match is paused.
  duck(on) {
    ducked = on;
    if (current) fade(current.sound, target(current.name), 250);
  },

  refresh() {
    if (current) current.sound.setVolume(target(current.name));
  },
};

AudioSettings.onChange(() => Music.refresh());
