import Phaser from 'phaser';
import { COMIC } from '../data/comic.js';
import { makeButton } from '../ui/Button.js';

// The comic viewer (COMIC on the main menu): the cover, then each page
// with its three panels on the war-room table, captions and speech
// bubbles lettered by the game. ← / → (or the buttons, or a click on the
// page) to turn pages, Esc for the menu.
const FONT = 'monospace';
const INK = 0x0d1114;
const GOLD = '#d2a35f';
const BONE = '#dcd1bf';
const CAPTION = 0xf2d36b; // the yellow caption box

export default class ComicScene extends Phaser.Scene {
  constructor() {
    super('Comic');
  }

  preload() {
    const all = [COMIC.cover, COMIC.backdrop, ...COMIC.pages.flatMap((p) => p.panels.map((x) => x.art))];
    for (const k of all) if (!this.textures.exists(`comic-${k}`)) this.load.image(`comic-${k}`, `assets/comic/${k}.jpg`);
    // a bar while the pages load
    const { width: W, height: H } = this.scale;
    const bar = this.add.rectangle(W / 2 - 200, H / 2, 1, 10, 0xd2a35f).setOrigin(0, 0.5);
    this.add.text(W / 2, H / 2 - 30, 'OPENING THE COMIC...', { fontFamily: FONT, fontSize: '16px', color: BONE }).setOrigin(0.5);
    this.load.on('progress', (v) => (bar.width = 400 * v));
  }

  create() {
    this.page = -1; // -1: the cover
    this.layer = this.add.container(0, 0);
    const k = this.input.keyboard;
    k.on('keydown-RIGHT', () => this.turn(1));
    k.on('keydown-LEFT', () => this.turn(-1));
    k.on('keydown-SPACE', () => this.turn(1));
    k.on('keydown-ESC', () => this.scene.start('Menu'));
    this.show();
  }

  turn(dir) {
    const next = Phaser.Math.Clamp(this.page + dir, -1, COMIC.pages.length - 1);
    if (next === this.page) return;
    this.page = next;
    this.show();
  }

  show() {
    this.children.list.filter((o) => o !== this.layer).forEach((o) => o.destroy());
    this.layer.removeAll(true);
    const { width: W, height: H } = this.scale;
    if (this.textures.exists(`comic-${COMIC.backdrop}`)) {
      const bg = this.add.image(W / 2, H / 2, `comic-${COMIC.backdrop}`);
      bg.setScale(Math.max(W / bg.width, H / bg.height));
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, 0x1a1f24);
    }
    if (this.page < 0) this.drawCover();
    else this.drawPage(COMIC.pages[this.page]);
    // Navigation
    makeButton(this, 52, H / 2, '◀', () => this.turn(-1), { size: 24, once: false }).setAlpha(this.page < 0 ? 0.3 : 1).setDepth(50);
    makeButton(this, W - 52, H / 2, '▶', () => this.turn(1), { size: 24, once: false }).setAlpha(this.page >= COMIC.pages.length - 1 ? 0.3 : 1).setDepth(50);
    makeButton(this, W - 90, 30, 'MENU', () => this.scene.start('Menu'), { keyLabel: 'Esc', size: 13 }).setDepth(50);
    const where = this.page < 0 ? 'COVER' : `PAGE ${this.page + 1} OF ${COMIC.pages.length}`;
    this.add.text(W / 2, H - 14, `${where}   ·   ← / → to turn`, { fontFamily: FONT, fontSize: '12px', color: '#a49d95', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(50);
  }

  drawCover() {
    const { width: W, height: H } = this.scale;
    const key = `comic-${COMIC.cover}`;
    if (!this.textures.exists(key)) return;
    const img = this.add.image(W / 2, H / 2 + 6, key);
    img.setScale(Math.min(640 / img.height, 600 / img.width));
    this.add.rectangle(W / 2, H / 2 + 6, img.displayWidth + 12, img.displayHeight + 12).setStrokeStyle(6, INK);
    const top = H / 2 + 6 - img.displayHeight / 2;
    this.add.text(W / 2, top + 54, COMIC.title, { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: GOLD, stroke: '#0d1114', strokeThickness: 8 }).setOrigin(0.5);
    this.add.text(W / 2, top + 92, 'KEYS MILITIA · A VAO COMIC', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: BONE, stroke: '#0d1114', strokeThickness: 4 }).setOrigin(0.5);
  }

  // Two panels side by side, one wide below (its art cropped to a band).
  drawPage(page) {
    const { width: W } = this.scale;
    const boxes = [
      { x: 100, y: 52, w: 532, h: 355 },
      { x: 648, y: 52, w: 532, h: 355 },
      { x: 100, y: 423, w: 1080, h: 268 },
    ];
    this.add.text(W / 2, 30, page.title, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: GOLD, stroke: '#0d1114', strokeThickness: 6 }).setOrigin(0.5);
    page.panels.forEach((p, i) => this.drawPanel(p, boxes[i], i));
  }

  drawPanel(p, b, i) {
    const key = `comic-${p.art}`;
    this.add.rectangle(b.x + b.w / 2 + 5, b.y + b.h / 2 + 6, b.w, b.h, 0x000000, 0.45); // shadow
    if (this.textures.exists(key)) {
      const img = this.add.image(b.x + b.w / 2, b.y + b.h / 2, key);
      const s = Math.max(b.w / img.width, b.h / img.height);
      img.setScale(s);
      // crop to the box (centre of the art)
      const cw = b.w / s;
      const ch = b.h / s;
      img.setCrop((img.width - cw) / 2, (img.height - ch) / 2, cw, ch);
    }
    this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h).setStrokeStyle(5, INK);
    // a little entrance, panel by panel
    const pop = this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, 0x0d1114, 1);
    this.tweens.add({ targets: pop, alpha: 0, duration: 260, delay: 140 * i, onComplete: () => pop.destroy() });
    if (p.text) this.letter(p, b, i);
  }

  // A caption box (yellow) or a speech bubble (white with a tail).
  letter(p, b, i) {
    const pad = 12;
    const maxW = Math.min(b.w * 0.55, 420);
    const t = this.add.text(0, 0, p.speaker ? p.text : p.text.toUpperCase(), {
      fontFamily: FONT, fontSize: p.speaker ? '16px' : '14px', fontStyle: 'bold', color: '#131112', wordWrap: { width: maxW - pad * 2 }, lineSpacing: 3,
    });
    const name = p.speaker ? this.add.text(0, 0, p.speaker, { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#a05d4c' }) : null;
    const w = Math.max(t.width, name?.width ?? 0) + pad * 2;
    const h = t.height + pad * 2 + (name ? 14 : 0);
    const left = p.at === 'tr' ? b.x + b.w - w - 14 : b.x + 14;
    const top = p.at === 'bl' ? b.y + b.h - h - 14 : b.y + 14;
    const g = this.add.graphics();
    if (p.speaker) {
      g.fillStyle(0xffffff, 1).lineStyle(3, INK, 1);
      g.fillRoundedRect(left, top, w, h, 16).strokeRoundedRect(left, top, w, h, 16);
      // the tail, pointing down into the panel
      const tx = p.at === 'tr' ? left + w * 0.3 : left + w * 0.7;
      g.fillTriangle(tx - 10, top + h - 2, tx + 10, top + h - 2, tx + (p.at === 'tr' ? -18 : 18), top + h + 22);
      g.lineBetween(tx - 10, top + h, tx + (p.at === 'tr' ? -18 : 18), top + h + 22).lineBetween(tx + 10, top + h, tx + (p.at === 'tr' ? -18 : 18), top + h + 22);
    } else {
      g.fillStyle(CAPTION, 1).lineStyle(3, INK, 1);
      g.fillRect(left, top, w, h).strokeRect(left, top, w, h);
    }
    name?.setPosition(left + pad, top + pad - 2);
    t.setPosition(left + pad, top + pad + (name ? 12 : 0));
    for (const o of [g, t, name].filter(Boolean)) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 220, delay: 260 + 160 * i });
    }
    g.setDepth(10);
    t.setDepth(11);
    name?.setDepth(11);
  }
}
