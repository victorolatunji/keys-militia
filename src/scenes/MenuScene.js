import Phaser from 'phaser';
import { MENU, PLAY_MODES, INTRO } from '../data/menu.js';
import { MODES } from '../data/modes.js';
import { TRAINING } from '../data/training.js';

// The main menu (Phase 9): PLAY, TRAINING, COMIC, STORY MODE and ONLINE
// (both coming soon) and CONTROLS over a dark, slowly drifting in-game shot. One scene with a few
// pages: the main list, the mode picker (Play), the first-time Training
// prompt, the controls list and the story page.
// Arrows (or the mouse) to choose, Enter (or a click) to pick, Esc to go back.
const FONT = 'monospace';
const GOLD = '#d2a35f';
const DIM = '#4d5967';

const KEY_LINES = [
  ['Left / Right', 'run'],
  ['Up', 'jetpack (hold)'],
  ['Down', 'crouch on the ground, dive in the air'],
  ['Letters', 'type the word over an enemy to shoot it'],
  ['Backspace', 'fix a typo'],
  ['Shift', 'switch gun'],
  ['Space / hold mouse', 'aim and throw'],
  ['Tab / mouse wheel', 'switch throwable'],
  ['1 - 6', 'take from a crate or an item'],
  ['Esc', 'leave the match'],
];

const storage = {
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

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  preload() {
    if (!this.textures.exists('menu-backdrop')) this.load.image('menu-backdrop', MENU.backdrop);
  }

  create(data = {}) {
    const { width: W, height: H } = this.scale;
    // Backdrop: an in-game shot, darkened, drifting slowly side to side.
    if (this.textures.exists('menu-backdrop')) {
      const bg = this.add.image(W / 2, H / 2, 'menu-backdrop');
      bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.12);
      this.tweens.add({ targets: bg, x: W / 2 - 50, duration: 14000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1114, MENU.backdropDarken);

    if (this.textures.exists('logo')) {
      const logo = this.add.image(W / 2, 92, 'logo');
      logo.setScale(400 / logo.width);
    } else {
      this.add.text(W / 2, 110, 'KEYS MILITIA', { fontFamily: FONT, fontSize: '76px', fontStyle: 'bold', color: GOLD, stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5);
    }
    this.add.text(W / 2, 168, 'E A R T H   R E S P O N D', { fontFamily: FONT, fontSize: '18px', color: '#dcd1bf', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(W - 20, H - 14, 'VAO', { fontFamily: FONT, fontSize: '14px', color: DIM }).setOrigin(1, 1);

    this.layer = this.add.container(0, 0);
    this.input.keyboard.on('keydown-UP', () => this.move(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard.on('keydown-ENTER', () => this.choose());
    this.input.keyboard.on('keydown-SPACE', () => this.choose());
    this.input.keyboard.on('keydown-ESC', () => this.back());
    this.show(data.page ?? 'main');
  }

  // ---- Pages ----

  show(page) {
    this.page = page;
    this.layer.removeAll(true);
    this.items = [];
    this.index = 0;
    const W = this.scale.width;
    if (page === 'main') {
      for (const e of MENU.entries) {
        this.item(e.label, e.off ? null : () => this.go(e.go), e.off);
      }
      this.list(W / 2, 262, 52, 32);
    } else if (page === 'modes') {
      this.heading('PLAY · PICK A MODE');
      for (const m of PLAY_MODES) this.item(MODES[m.key].name.toUpperCase(), () => this.scene.start('Lobby', { modeKey: m.key }), null, m.line);
      this.item('BACK', () => this.back());
      this.list(W / 2, 270, 66, 28);
    } else if (page === 'firstTime') {
      this.heading('NEW HERE?');
      this.note('Training teaches the basics in a few minutes: moving, flying, typing to shoot, crates.');
      this.item('START TRAINING', () => this.go('training'));
      this.item('SKIP, LET ME PLAY', () => {
        storage.set(TRAINING.storageKey + '.offered', '1');
        this.show('modes');
      });
      this.list(W / 2, 340, 56, 28);
    } else if (page === 'controls') {
      this.heading('CONTROLS');
      KEY_LINES.forEach(([k, what], i) => {
        const y = 250 + i * 30;
        this.layer.add(this.add.text(W / 2 - 20, y, k, { fontFamily: FONT, fontSize: '19px', color: GOLD }).setOrigin(1, 0.5));
        this.layer.add(this.add.text(W / 2 + 20, y, what, { fontFamily: FONT, fontSize: '19px', color: '#dcd1bf' }).setOrigin(0, 0.5));
      });
      const hidden = Object.keys(MODES).some((k) => storage.get(INTRO.hideKey + k));
      this.item(hidden ? 'SHOW MODE INTROS AGAIN' : 'MODE INTROS: ON', hidden ? () => {
        for (const k of Object.keys(MODES)) storage.set(INTRO.hideKey + k, null);
        this.show('controls');
      } : null);
      this.item('BACK', () => this.back());
      this.list(W / 2, 580, 46, 24);
    } else if (page === 'story') {
      this.heading('COMIC · EARTH RESPOND #0');
      this.note('The comic is on its way: four pages of how the Signal hit Earth\nand how the militias answered. Story mode comes after it.');
      this.item('BACK', () => this.back());
      this.list(W / 2, 420, 50, 26);
    }
    this.highlight();
  }

  heading(text) {
    this.layer.add(this.add.text(this.scale.width / 2, 218, text, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5));
  }

  note(text) {
    this.layer.add(this.add.text(this.scale.width / 2, 280, text, { fontFamily: FONT, fontSize: '18px', color: '#a49d95', align: 'center', lineSpacing: 6 }).setOrigin(0.5));
  }

  // A pickable line (action null: shown greyed out, with its note).
  item(label, action, off = null, line = null) {
    this.items.push({ label, action, off, line });
  }

  list(x, y0, step, size) {
    this.items.forEach((it, i) => {
      const y = y0 + i * step;
      const t = this.add.text(x, y, it.label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: it.action ? '#ffffff' : DIM, stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5);
      it.text = t;
      this.layer.add(t);
      if (it.off) this.layer.add(this.add.text(x + t.width / 2 + 14, y, it.off, { fontFamily: FONT, fontSize: '13px', color: '#0d1114', backgroundColor: '#8a837b', padding: { x: 6, y: 2 } }).setOrigin(0, 0.5));
      if (it.line) {
        it.sub = this.add.text(x, y + size * 0.85, it.line, { fontFamily: FONT, fontSize: '15px', color: '#a49d95' }).setOrigin(0.5);
        this.layer.add(it.sub);
      }
      if (it.action) {
        t.setInteractive({ useHandCursor: true });
        t.on('pointerover', () => {
          this.index = i;
          this.highlight();
        });
        t.on('pointerdown', () => it.action());
      }
    });
    this.index = Math.max(0, this.items.findIndex((it) => it.action));
  }

  highlight() {
    this.items.forEach((it, i) => {
      if (!it.text || !it.action) return;
      const on = i === this.index;
      it.text.setColor(on ? GOLD : '#ffffff').setScale(on ? 1.08 : 1);
      it.text.setText(on ? `▶ ${it.label} ◀` : it.label);
    });
  }

  move(dir) {
    if (!this.items?.length) return;
    let i = this.index;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + dir + this.items.length) % this.items.length;
      if (this.items[i].action) break;
    }
    this.index = i;
    this.highlight();
  }

  choose() {
    this.items?.[this.index]?.action?.();
  }

  back() {
    if (this.page === 'main') return;
    this.show('main');
  }

  go(where) {
    if (where === 'modes') {
      // First time: offer Training before the first match.
      const trained = storage.get(TRAINING.storageKey) || storage.get(TRAINING.storageKey + '.offered');
      this.show(trained ? 'modes' : 'firstTime');
    } else if (where === 'comic') {
      this.scene.start('Comic'); // Earth Respond #0
    } else if (where === 'training') {
      storage.set(TRAINING.storageKey + '.offered', '1');
      // Training is Victor's: the Rookie learning at the Militia Camp (the
      // story's start), whoever you last picked in the lobby.
      this.scene.start('Game', { modeKey: 'training', mapKey: 'camp', characterKey: TRAINING.character, partnerKey: null });
    } else {
      this.show(where);
    }
  }
}
