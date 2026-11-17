import Phaser from 'phaser';
import { AudioSettings, uiSound } from '../systems/AudioSettings.js';
import { GORE } from '../data/effects.js';
import { INTRO, MENU } from '../data/menu.js';
import { MODES } from '../data/modes.js';
import { SOUND_SETTINGS } from '../data/sounds.js';
import { AUDIO_STORAGE_KEY } from '../data/audio.js';
import { makeButton } from '../ui/Button.js';
import { Music } from '../systems/Music.js';

// SETTINGS (Phase 9): from the main menu, or from the pause box in a match
// (then drawn over the paused match). Up / Down choose a line, Left / Right
// (or the mouse on - / +) change it, Enter uses a button, Esc goes back.
//   Volumes: Master, Music, Effects (and buttons), Voices (speech and cries)
//   Gore level, mode intros, fullscreen, reset saved progress.
// Everything is remembered in this browser.
const FONT = 'monospace';
const GOLD = '#d2a35f';
const BONE = '#dcd1bf';
const ASH = '#a49d95';

const store = {
  get(k) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v === null) window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, v);
    } catch {
      // storage blocked: fine
    }
  },
};

// Settings that "reset progress" keeps (everything else under keys-militia is your progress).
const KEEP = [GORE.storageKey, SOUND_SETTINGS.storageKey, AUDIO_STORAGE_KEY];

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(data = {}) {
    this.from = data.from ?? 'menu'; // 'menu' or 'pause'
    if (this.from === 'menu') Music.play(this, 'settings'); // (over a match: the match's music stays)
    this.index = 0;
    this.confirming = false;
    const { width: W, height: H } = this.scale;
    if (this.from === 'menu' && this.textures.exists('menu-backdrop')) {
      const bg = this.add.image(W / 2, H / 2, 'menu-backdrop');
      bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.12);
    }
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1114, this.from === 'menu' ? MENU.backdropDarken + 0.25 : 0.82);
    this.add.rectangle(W / 2, H / 2, 800, 560, 0x0d1114, 0.94).setStrokeStyle(2, 0xd2a35f);
    this.add.text(W / 2, H / 2 - 245, 'SETTINGS', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: GOLD }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 248, '↑ ↓ choose   ·   ← → change   ·   Enter use   ·   Esc back', { fontFamily: FONT, fontSize: '13px', color: ASH }).setOrigin(0.5);

    const vol = (key, name) => ({ name, get: () => `${Math.round(AudioSettings.get()[key] * 100)}%`, change: (d) => AudioSettings.set({ [key]: AudioSettings.get()[key] + d * 0.1 }), bar: () => AudioSettings.get()[key] });
    this.rows = [
      vol('master', 'MASTER VOLUME'),
      vol('music', 'MUSIC'),
      vol('sfx', 'EFFECTS'),
      vol('voice', 'VOICES'),
      { name: 'SOUND', get: () => (AudioSettings.get().muted ? 'OFF' : 'ON'), change: () => AudioSettings.toggleMute() },
      { name: 'BLOOD AND GORE', get: () => this.gore().toUpperCase(), change: (d) => this.setGore(d) },
      { name: 'MODE INTROS', get: () => (this.introsHidden() ? 'OFF' : 'ON'), change: () => this.toggleIntros() },
      { name: 'FULLSCREEN', get: () => (this.scale.isFullscreen ? 'ON' : 'OFF'), change: () => this.scale.toggleFullscreen(), press: true },
      { name: 'RESET PROGRESS', get: () => (this.confirming ? 'PRESS AGAIN TO ERASE' : ''), change: () => this.reset(), press: true, danger: true },
      { name: 'BACK', get: () => '', change: () => this.close(), press: true },
    ];
    const top = H / 2 - 190;
    this.rows.forEach((r, i) => {
      const y = top + i * 42;
      r.y = y;
      r.label = this.add.text(W / 2 - 360, y, r.name, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: BONE }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      r.value = this.add.text(W / 2 + 370, y, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: r.danger ? '#e07a5f' : GOLD }).setOrigin(1, 0.5);
      r.label.on('pointerover', () => this.select(i));
      r.label.on('pointerdown', () => this.use(i, 1));
      if (r.bar) {
        r.track = this.add.rectangle(W / 2 + 10, y, 180, 8, 0x30353b).setOrigin(0, 0.5);
        r.fill = this.add.rectangle(W / 2 + 10, y, 180, 8, 0xd2a35f).setOrigin(0, 0.5);
      }
      if (!r.press) {
        makeButton(this, W / 2 - 30, y, '-', () => this.use(i, -1), { size: 14, once: false, sound: null });
        makeButton(this, W / 2 + 222, y, '+', () => this.use(i, 1), { size: 14, once: false, sound: null });
      }
    });
    const k = this.input.keyboard;
    k.on('keydown-UP', () => this.select(this.index - 1));
    k.on('keydown-DOWN', () => this.select(this.index + 1));
    k.on('keydown-LEFT', () => !this.rows[this.index].press && this.use(this.index, -1));
    k.on('keydown-RIGHT', () => !this.rows[this.index].press && this.use(this.index, 1));
    k.on('keydown-ENTER', () => this.use(this.index, 1));
    k.on('keydown-ESC', () => this.close());
    this.scale.on('enterfullscreen', this.draw, this);
    this.scale.on('leavefullscreen', this.draw, this);
    this.events.once('shutdown', () => {
      this.scale.off('enterfullscreen', this.draw, this);
      this.scale.off('leavefullscreen', this.draw, this);
    });
    this.draw();
  }

  select(i) {
    const n = Phaser.Math.Wrap(i, 0, this.rows.length);
    if (n !== this.index) uiSound(this, 'ui-move');
    if (n !== this.index) this.confirming = false;
    this.index = n;
    this.draw();
  }

  use(i, dir) {
    this.index = i;
    const r = this.rows[i];
    if (r.name !== 'BACK') uiSound(this, r.press ? 'ui-select' : 'ui-scroll');
    r.change(dir);
    this.draw();
  }

  draw() {
    this.rows.forEach((r, i) => {
      const on = i === this.index;
      r.label.setColor(on ? GOLD : BONE).setText(on ? `▶ ${r.name}` : r.name);
      r.value.setText(r.get());
      if (r.fill) r.fill.width = Math.max(1, 180 * r.bar());
    });
  }

  // ---- The settings themselves ----

  gore() {
    const g = store.get(GORE.storageKey);
    return GORE.levels.includes(g) ? g : GORE.default;
  }

  setGore(dir) {
    const i = GORE.levels.indexOf(this.gore());
    store.set(GORE.storageKey, GORE.levels[Phaser.Math.Wrap(i + dir, 0, GORE.levels.length)]);
    // A match underneath (paused): it follows straight away.
    const fx = this.scene.get('Game')?.effects;
    if (fx) fx.gore = this.gore();
  }

  introsHidden() {
    return Object.keys(MODES).some((k) => store.get(INTRO.hideKey + k));
  }

  toggleIntros() {
    const hide = !this.introsHidden();
    for (const k of Object.keys(MODES)) store.set(INTRO.hideKey + k, hide ? '1' : null);
  }

  // Erase your progress (lobby picks, Training done, best scores, last map
  // and mode), keeping these settings. Press twice.
  reset() {
    if (!this.confirming) {
      this.confirming = true;
      return;
    }
    this.confirming = false;
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) keys.push(window.localStorage.key(i));
      for (const k of keys) if (k && k.startsWith('keys-militia') && !KEEP.includes(k)) window.localStorage.removeItem(k);
    } catch {
      // storage blocked: nothing saved anyway
    }
    this.cameras.main.flash(150, 224, 122, 95);
  }

  close() {
    uiSound(this, 'ui-back');
    if (this.from === 'pause') {
      // Back to the pause box over the match.
      this.scene.resume('Intro');
      this.scene.stop();
    } else {
      this.scene.start('Menu');
    }
  }
}
