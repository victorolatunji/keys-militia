import Phaser from 'phaser';
import { MODES } from '../data/modes.js';
import { MAPS } from '../data/maps.js';
import { MODE_INTRO, INTRO } from '../data/menu.js';

// Drawn over the (paused) match:
//   kind 'start': the mode's intro pop-up (its goal and the keys that
//     matter; "don't show again" with D), then a ring timer counting 11 ... 0,
//     then the match runs. With the intro turned off: just the countdown.
//   kind 'pause' (Esc in a match): leave for the main menu, or keep playing.
const FONT = 'monospace';
const GOLD = '#ffd166';

const hidden = (mode) => {
  try {
    return Boolean(window.localStorage.getItem(INTRO.hideKey + mode));
  } catch {
    return false;
  }
};

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create(data) {
    this.kind = data.kind ?? 'start';
    this.mode = MODES[data.modeKey] ?? MODES.free;
    this.map = MAPS[data.mapKey];
    const { width: W, height: H } = this.scale;
    this.shade = this.add.rectangle(W / 2, H / 2, W, H, 0x05070d, 0.55);
    this.parts = [];
    const k = this.input.keyboard;
    if (this.kind === 'pause') {
      this.panel(['LEAVE THE MATCH?'], ['Enter: main menu', 'Esc: keep playing']);
      k.once('keydown-ENTER', () => this.toMenu());
      k.once('keydown-ESC', () => this.resume());
      return;
    }
    if (hidden(this.mode.key)) {
      this.countdown();
      return;
    }
    this.intro();
  }

  // A small box with a title line and a few quieter lines.
  panel(titles, lines) {
    const { width: W, height: H } = this.scale;
    this.parts.push(this.add.rectangle(W / 2, H / 2, 520, 200, 0x0b0d12, 0.96).setStrokeStyle(2, 0xffd166));
    titles.forEach((t, i) => this.parts.push(this.add.text(W / 2, H / 2 - 50 + i * 34, t, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: GOLD }).setOrigin(0.5)));
    lines.forEach((t, i) => this.parts.push(this.add.text(W / 2, H / 2 + 10 + i * 30, t, { fontFamily: FONT, fontSize: '18px', color: '#e9ecef' }).setOrigin(0.5)));
  }

  // ---- The mode intro ----

  intro() {
    const { width: W, height: H } = this.scale;
    const text = MODE_INTRO[this.mode.key] ?? MODE_INTRO.free;
    const add = (o) => {
      this.parts.push(o);
      return o;
    };
    add(this.add.rectangle(W / 2, H / 2, 760, 400, 0x0b0d12, 0.96).setStrokeStyle(2, 0xffd166));
    add(this.add.text(W / 2, H / 2 - 160, this.mode.name.toUpperCase(), { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: GOLD }).setOrigin(0.5));
    add(this.add.text(W / 2, H / 2 - 118, this.map?.name ?? '', { fontFamily: FONT, fontSize: '16px', color: '#9aa3b5' }).setOrigin(0.5));
    add(this.add.text(W / 2, H / 2 - 72, text.goal, { fontFamily: FONT, fontSize: '19px', color: '#ffffff', align: 'center', wordWrap: { width: 680 } }).setOrigin(0.5));
    text.keys.forEach((line, i) => add(this.add.text(W / 2, H / 2 - 4 + i * 32, line, { fontFamily: FONT, fontSize: '17px', color: '#c9d1e0' }).setOrigin(0.5)));
    this.hideBox = add(this.add.text(W / 2, H / 2 + 120, '', { fontFamily: FONT, fontSize: '15px', color: '#9aa3b5' }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    this.hideBox.on('pointerdown', () => this.toggleHide());
    this.drawHide();
    const go = add(this.add.text(W / 2, H / 2 + 164, '  START (Enter)  ', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#05070d', backgroundColor: '#ffd166', padding: { x: 10, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    go.on('pointerdown', () => this.start());
    const k = this.input.keyboard;
    k.on('keydown-D', () => this.toggleHide());
    k.once('keydown-ENTER', () => this.start());
    k.once('keydown-SPACE', () => this.start());
  }

  drawHide() {
    this.hideBox.setText(`[${hidden(this.mode.key) ? 'x' : ' '}] don't show this again (D)   ·   turn intros back on in Controls`);
  }

  toggleHide() {
    try {
      if (hidden(this.mode.key)) window.localStorage.removeItem(INTRO.hideKey + this.mode.key);
      else window.localStorage.setItem(INTRO.hideKey + this.mode.key, '1');
    } catch {
      // storage blocked: fine
    }
    this.drawHide();
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.parts.forEach((o) => o.destroy());
    this.parts = [];
    this.countdown();
  }

  // ---- The countdown: a ring timer, 11 ... 0 ----

  countdown() {
    const { width: W, height: H } = this.scale;
    const cx = W / 2;
    const cy = H / 2;
    const r = 70;
    const ring = this.add.graphics();
    const num = this.add.text(cx, cy, '', { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    const label = this.add.text(cx, cy + r + 34, 'GET READY', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: GOLD, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    const total = INTRO.countdownFrom * INTRO.stepMs;
    const t0 = this.time.now;
    let shown = null;
    this.ticker = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const left = Math.max(0, total - (this.time.now - t0));
        const n = Math.ceil(left / INTRO.stepMs);
        if (n !== shown) {
          shown = n;
          num.setText(String(n)).setScale(1.25);
          this.tweens.add({ targets: num, scale: 1, duration: 220, ease: 'Back.easeOut' });
          num.setColor(n <= 3 ? '#ff4d6d' : '#ffffff');
        }
        // The ring empties as the seconds run out.
        ring.clear();
        ring.lineStyle(10, 0x2a3345, 0.9).strokeCircle(cx, cy, r);
        ring.lineStyle(10, n <= 3 ? 0xff4d6d : 0xffd166, 1);
        ring.beginPath();
        ring.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (left / total) * Math.PI * 2, false);
        ring.strokePath();
        if (left <= 0) {
          this.ticker.remove();
          ring.clear();
          num.setText('FIGHT!').setColor(GOLD).setScale(1);
          label.setVisible(false);
          this.shade.setVisible(false);
          this.resume();
          this.tweens.add({ targets: num, alpha: 0, scale: 1.4, duration: 600, delay: 300, onComplete: () => this.scene.stop() });
        }
      },
    });
  }

  resume() {
    this.scene.resume('Game');
    if (this.kind === 'pause') this.scene.stop();
  }

  toMenu() {
    this.scene.stop('Game');
    this.scene.start('Menu');
  }
}
