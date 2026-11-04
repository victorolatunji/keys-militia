import Phaser from 'phaser';
import { SOUNDS, SOUND_SETTINGS, JET_LOOP, shotSoundFor } from '../data/sounds.js';

// Plays the sounds in data/sounds.js, made on the spot with Web Audio
// (no files). Louder near you, quieter far away, panned left/right.
// F4 turns sound on/off (remembered in this browser).
// Lives on the scene as scene.sfx (scene.sound is Phaser's own).
export default class SoundSystem {
  constructor(scene) {
    this.scene = scene;
    this.ctx = scene.sound?.context ?? null; // null: no Web Audio (sound off)
    this.lastPlayed = {};
    this.on = this.loadSetting();

    if (this.ctx) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? SOUND_SETTINGS.master : 0;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }

    const kb = scene.input.keyboard;
    const toggle = (event) => {
      event.preventDefault?.();
      this.toggle();
    };
    kb.on(`keydown-${SOUND_SETTINGS.toggleKey}`, toggle);
    scene.events.once('shutdown', () => {
      kb.off(`keydown-${SOUND_SETTINGS.toggleKey}`, toggle);
      this.stopJet();
    });
  }

  // ---- Setting ----

  loadSetting() {
    try {
      return window.localStorage.getItem(SOUND_SETTINGS.storageKey) !== 'off';
    } catch {
      return true;
    }
  }

  toggle() {
    this.on = !this.on;
    try {
      window.localStorage.setItem(SOUND_SETTINGS.storageKey, this.on ? 'on' : 'off');
    } catch {
      // not saved
    }
    if (this.master) this.master.gain.value = this.on ? SOUND_SETTINGS.master : 0;
    this.scene.effects?.notice(`Sound: ${this.on ? 'On' : 'Off'}  (${SOUND_SETTINGS.toggleKey})`);
  }

  // ---- Playing ----

  // key: a SOUNDS entry. at: where it happens ({ x, y }, default: on you).
  // opts.volume, opts.pitch: extra scaling (enemy shots use these).
  play(key, at = null, opts = {}) {
    const sound = SOUNDS[key];
    if (!sound || !this.ctx || !this.on || this.ctx.state !== 'running') return;

    const now = this.scene.time.now;
    if (sound.gapMs && now - (this.lastPlayed[key] ?? -1e9) < sound.gapMs) return;
    this.lastPlayed[key] = now;

    // Distance from you: quieter far away, panned to its side.
    const player = this.scene.player;
    let volume = opts.volume ?? 1;
    let pan = 0;
    if (at && player) {
      const dx = at.x - player.x;
      const dist = Phaser.Math.Distance.Between(at.x, at.y, player.x, player.y);
      const { hearingPx, minDistanceVolume } = SOUND_SETTINGS;
      volume *= Phaser.Math.Clamp(1 - dist / hearingPx, minDistanceVolume, 1);
      pan = Phaser.Math.Clamp(dx / 700, -0.8, 0.8);
    }

    const out = this.ctx.createStereoPanner();
    out.pan.value = pan;
    out.connect(this.master);
    const t0 = this.ctx.currentTime;
    let end = t0;
    for (const layer of sound.layers) {
      end = Math.max(end, this.layer(layer, out, t0, volume, opts.pitch ?? 1));
    }
    // Let go of the nodes once it's over.
    setTimeout(() => out.disconnect(), (end - t0) * 1000 + 100);
  }

  // One noise or tone layer. Returns when it ends (audio time).
  layer(l, out, t0, volume, pitch) {
    const ctx = this.ctx;
    const start = t0 + (l.delay ?? 0);
    const attack = l.attack ?? 0.004;
    const stop = start + l.dur;

    let source;
    let head; // node the envelope feeds from
    if (l.noise) {
      source = ctx.createBufferSource();
      source.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = l.filter ?? 'lowpass';
      filter.frequency.setValueAtTime(l.freq * pitch, start);
      if (l.freqEnd) filter.frequency.exponentialRampToValueAtTime(l.freqEnd * pitch, stop);
      filter.Q.value = l.q ?? 0.7;
      source.connect(filter);
      head = filter;
    } else {
      source = ctx.createOscillator();
      source.type = l.wave ?? 'sine';
      source.frequency.setValueAtTime(l.freq * pitch, start);
      if (l.freqEnd) source.frequency.exponentialRampToValueAtTime(l.freqEnd * pitch, stop);
      head = source;
      if (l.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = l.filter;
        filter.frequency.value = l.cutoff ?? 1000;
        source.connect(filter);
        head = filter;
      }
    }

    // Envelope: quick rise, then fall away to silence.
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, l.gain * volume), start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, stop);
    head.connect(env);
    env.connect(out);

    if (l.noise) source.start(start, Math.random() * 1.5, l.dur + 0.05);
    else {
      source.start(start);
      source.stop(stop + 0.05);
    }
    source.onended = () => env.disconnect();
    return stop;
  }

  // 2 seconds of white noise, shared by every noise layer.
  makeNoise() {
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ---- Shortcuts used around the game ----

  // A weapon going off. enemy: a bot's shot (quieter, lower).
  shot(weapon, at, enemy = false) {
    const key = shotSoundFor(weapon);
    if (!key) return;
    const opts = enemy ? { volume: SOUND_SETTINGS.enemyVolume, pitch: SOUND_SETTINGS.enemyPitch } : {};
    this.play(key, at, opts);
  }

  // A character got hurt: what you hear depends on what it's made of.
  hurt(target, kind) {
    const now = this.scene.time.now;
    if (now - (target.lastHurtSoundAt ?? -1e9) < SOUND_SETTINGS.hurtGapMs) return;
    target.lastHurtSoundAt = now;
    if (kind === 'gas') {
      this.play('cough', target);
      return;
    }
    if (target === this.scene.player) {
      this.play('youHurt');
      return;
    }
    this.play(this.bodySound(target, 'hurt'), target, { volume: 0.8 });
  }

  death(target) {
    const mat = this.scene.effects?.material(target);
    this.play(mat?.gibs === 'metal' ? 'deathMachine' : 'deathFlesh', target);
  }

  bodySound(target, prefix) {
    const gibs = this.scene.effects?.material(target)?.gibs ?? 'flesh';
    const name = { metal: 'Machine', bone: 'Bone', straw: 'Straw' }[gibs] ?? 'Flesh';
    return `${prefix}${name}`;
  }

  // ---- Jetpack loop ----

  // Called every frame with whether your jetpack is firing.
  updateJet(thrusting) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (thrusting && !this.jet) this.startJet();
    else if (!thrusting && this.jet) this.stopJet();
  }

  startJet() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = JET_LOOP.filter;
    filter.frequency.value = JET_LOOP.freq;
    filter.Q.value = JET_LOOP.q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(JET_LOOP.gain, ctx.currentTime + JET_LOOP.fadeMs / 1000);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.jet = { source, gain };
  }

  stopJet() {
    if (!this.jet || !this.ctx) return;
    const { source, gain } = this.jet;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + JET_LOOP.fadeMs / 1000);
    source.stop(t + JET_LOOP.fadeMs / 1000 + 0.02);
    this.jet = null;
  }
}