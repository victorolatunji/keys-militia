import Phaser from 'phaser';
import { CAST, fullName } from '../data/cast.js';
import { BOTS } from '../data/enemies.js';
import { MODES } from '../data/modes.js';
import { MAPS, MAP_SELECT } from '../data/maps.js';
import { LOBBY } from '../data/menu.js';
import { SPRITES } from '../data/spriteManifest.js';
import { gunKey } from '../entities/CharacterRig.js';
import { makeRig } from '../entities/rigFactory.js';

// The lobby (Phase 9), after you pick a mode: an armoury (gun racks and
// crates behind), the cast as cards on the left, your picks on the right.
//   Solo / Duo (D): Duo adds a second slot, your partner.
//   Cards: arrows or the mouse to move, Enter or a click to pick for the
//   slot that's lit (YOU, then PARTNER). (i) or I: the character's name
//   and story. Only characters that can fight beside you go in PARTNER.
//   Map: < > (or Q / E): only the maps that suit the mode.
//   READY (R, or click): the mode intro, the countdown, the match.
//   Esc: back to the mode picker.
const FONT = 'monospace';
const GOLD = '#ffd166';
const CARD_W = 140;
const CARD_H = 128;
const GRID_X = 40;
const GRID_Y = 118;
const GAP = 10;

const storage = {
  get() {
    try {
      return JSON.parse(window.localStorage.getItem(LOBBY.storageKey) ?? '{}');
    } catch {
      return {};
    }
  },
  set(v) {
    try {
      window.localStorage.setItem(LOBBY.storageKey, JSON.stringify(v));
    } catch {
      // storage blocked: fine
    }
  },
};

// Stands in for a character so its rig can be drawn on a card (still,
// facing right, holding its gun, jetpack on).
class Mannequin {
  constructor(cast, x, bottom, scale) {
    const size = (cast.bot && BOTS[cast.bot]?.size) ?? { width: 32, height: 48 };
    this.width = size.width * scale;
    this.height = size.height * scale;
    this.x = x;
    this.y = bottom - this.height / 2;
    this.body = { velocity: { x: 0, y: 0 }, bottom };
    this.alive = true;
    this.facing = 1;
    this.onGround = true;
    this.isPartner = true; // shows the jetpack
    this.restAim = 8;
    this.weapon = cast.weapon ?? null;
  }

  aimTarget() {
    return null;
  }

  heldWeapon() {
    return this.weapon;
  }

  heldThrowable() {
    return null;
  }
}

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  create(data) {
    this.mode = MODES[data.modeKey] ?? MODES.free;
    const saved = storage.get();
    this.duo = Boolean(saved.duo);
    this.you = CAST.find((c) => c.key === saved.you) ?? CAST[0];
    this.partner = CAST.find((c) => c.key === saved.partner && c.partner) ?? CAST.find((c) => c.partner);
    this.maps = (this.mode.maps ?? MAP_SELECT.order).filter((k) => MAPS[k] && !MAPS[k].trainingOnly);
    const savedMap = saved.maps?.[this.mode.key];
    this.mapIndex = Math.max(0, this.maps.indexOf(savedMap));
    this.slot = 'you';
    this.cursor = CAST.indexOf(this.you);
    this.rigs = [];

    this.drawArmoury();
    this.add.text(GRID_X, 34, `LOBBY · ${this.mode.name.toUpperCase()}`, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: GOLD, stroke: '#000000', strokeThickness: 5 });
    this.add.text(GRID_X, 72, 'Arrows: move · Enter: pick · I: info · D: solo/duo · Q/E: map · R: ready · Esc: back', { fontFamily: FONT, fontSize: '13px', color: '#c9d1e0', stroke: '#000000', strokeThickness: 3 });
    this.drawCards();
    this.drawSide();

    const k = this.input.keyboard;
    k.on('keydown-LEFT', () => this.moveCursor(-1, 0));
    k.on('keydown-RIGHT', () => this.moveCursor(1, 0));
    k.on('keydown-UP', () => this.moveCursor(0, -1));
    k.on('keydown-DOWN', () => this.moveCursor(0, 1));
    k.on('keydown-ENTER', () => (this.info ? this.closeInfo() : this.pick(CAST[this.cursor])));
    k.on('keydown-I', () => (this.info ? this.closeInfo() : this.openInfo(CAST[this.cursor])));
    k.on('keydown-D', () => this.toggleDuo());
    k.on('keydown-TAB', (e) => {
      e.preventDefault?.();
      if (this.duo) this.setSlot(this.slot === 'you' ? 'partner' : 'you');
    });
    k.addCapture('TAB');
    k.on('keydown-Q', () => this.changeMap(-1));
    k.on('keydown-E', () => this.changeMap(1));
    k.on('keydown-R', () => this.ready());
    k.on('keydown-ESC', () => (this.info ? this.closeInfo() : this.scene.start('Menu', { page: 'modes' })));
    this.refresh();
  }

  update(time, delta) {
    for (const r of this.rigs) r.update(delta);
  }

  // ---- The room ----

  // A dark armoury wall: planks, two racks of rifles and pistols, crates.
  drawArmoury() {
    const { width: W, height: H } = this.scale;
    this.add.rectangle(W / 2, H / 2, W, H, 0x1c1a17);
    const g = this.add.graphics();
    for (let y = 0; y < H; y += 36) {
      g.fillStyle(y % 72 ? 0x24211d : 0x2a2621, 1).fillRect(0, y, W, 34);
    }
    g.fillStyle(0x3a3027, 1).fillRect(0, 96, W, 6).fillRect(0, 300, W, 6).fillRect(0, 504, W, 6); // rack shelves
    const guns = Object.keys(SPRITES.weapons);
    let n = 0;
    for (const [y, step] of [[90, 120], [294, 104], [498, 132]]) {
      for (let x = 30 + (n % 2) * 40; x < W; x += step) {
        const key = gunKey(guns[n % guns.length]);
        n += 1;
        if (!this.textures.exists(key)) continue;
        const img = this.add.image(x, y - 4, key).setOrigin(0.5, 1).setAngle(-8 + (n % 3) * 8).setAlpha(0.32).setTint(0xb8a890);
        img.setScale(90 / img.width);
      }
    }
    if (this.textures.exists('spr-drop-crate-landed')) {
      for (const [x, s] of [[70, 120], [170, 90], [W - 90, 130], [W - 200, 96]]) {
        const c = this.add.image(x, H + 6, 'spr-drop-crate-landed').setOrigin(0.5, 1).setAlpha(0.5);
        c.setScale(s / c.width);
      }
    }
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25); // dim it so the cards stand out
  }

  // ---- Cards ----

  cardPos(i) {
    const col = i % LOBBY.cols;
    const row = Math.floor(i / LOBBY.cols);
    return { x: GRID_X + col * (CARD_W + GAP), y: GRID_Y + row * (CARD_H + GAP) };
  }

  drawCards() {
    this.cards = CAST.map((c, i) => {
      const { x, y } = this.cardPos(i);
      const bg = this.add.rectangle(x, y, CARD_W, CARD_H, 0x0b0d12, 0.82).setOrigin(0).setStrokeStyle(2, 0x2a3345).setDepth(5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        this.cursor = i;
        this.refresh();
      });
      bg.on('pointerdown', () => this.pick(c));
      const rig = this.preview(c, x + CARD_W / 2, y + CARD_H - 30, 0.95);
      const name = this.add.text(x + CARD_W / 2, y + CARD_H - 16, c.name, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(20);
      const info = this.add.text(x + CARD_W - 8, y + 8, 'i', { fontFamily: 'serif', fontSize: '15px', fontStyle: 'bold italic', color: '#05070d', backgroundColor: '#c9d1e0', padding: { x: 7, y: 1 } }).setOrigin(1, 0).setDepth(21);
      info.setInteractive({ useHandCursor: true });
      info.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation?.();
        this.openInfo(c);
      });
      const tag = this.add.text(x + 8, y + 8, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#05070d', padding: { x: 4, y: 1 } }).setDepth(21);
      return { c, bg, rig, name, info, tag };
    });
  }

  // A character drawn from its rig, standing with its gun.
  preview(c, x, bottom, scale) {
    if (!SPRITES.characters[c.key]) return null;
    const owner = new Mannequin(c, x, bottom, scale);
    const rig = makeRig(this, owner, c.key);
    rig.root.setDepth(10);
    rig.update(16);
    this.rigs.push(rig);
    return rig;
  }

  // ---- Your picks (right side) ----

  drawSide() {
    const x0 = 650;
    this.add.rectangle(x0, 110, 590, 560, 0x0b0d12, 0.82).setOrigin(0).setStrokeStyle(2, 0x2a3345);
    // Solo / Duo
    this.soloBtn = this.button(x0 + 30, 130, 'SOLO', () => this.toggleDuo(false));
    this.duoBtn = this.button(x0 + 150, 130, 'DUO', () => this.toggleDuo(true));
    // Slots
    this.slotViews = {};
    for (const [slot, x] of [['you', x0 + 30], ['partner', x0 + 305]]) {
      const box = this.add.rectangle(x, 190, 255, 250, 0x141821, 1).setOrigin(0).setStrokeStyle(2, 0x2a3345).setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.setSlot(slot));
      const label = this.add.text(x + 12, 200, slot === 'you' ? 'YOU' : 'PARTNER', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#9aa3b5' });
      const name = this.add.text(x + 128, 400, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5, 0);
      const sub = this.add.text(x + 128, 422, '', { fontFamily: FONT, fontSize: '12px', color: '#9aa3b5' }).setOrigin(0.5, 0);
      this.slotViews[slot] = { box, label, name, sub, x, rig: null, key: null };
    }
    // Map
    this.add.text(x0 + 30, 470, 'MAP', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#9aa3b5' });
    this.button(x0 + 30, 500, '<', () => this.changeMap(-1));
    this.mapText = this.add.text(x0 + 295, 516, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.button(x0 + 520, 500, '>', () => this.changeMap(1));
    this.mapNote = this.add.text(x0 + 295, 546, '', { fontFamily: FONT, fontSize: '12px', color: '#9aa3b5' }).setOrigin(0.5);
    // Ready
    this.readyBtn = this.button(x0 + 205, 590, '  READY  ', () => this.ready(), 30);
  }

  button(x, y, label, action, size = 20) {
    const t = this.add.text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff', backgroundColor: '#2a3345', padding: { x: 12, y: 6 } });
    t.setInteractive({ useHandCursor: true }).on('pointerdown', action);
    return t;
  }

  // ---- Actions ----

  moveCursor(dx, dy) {
    if (this.info) return;
    const cols = LOBBY.cols;
    let i = this.cursor;
    if (dx) i = Phaser.Math.Wrap(i + dx, 0, CAST.length);
    if (dy) {
      i += dy * cols;
      if (i < 0) i += Math.ceil(CAST.length / cols) * cols;
      if (i >= CAST.length) i %= cols;
    }
    this.cursor = Math.min(i, CAST.length - 1);
    this.refresh();
  }

  // Pick a character for the lit slot (a partner must be one that can fight beside you).
  pick(c) {
    if (this.info) return;
    if (this.slot === 'partner') {
      if (!c.partner) return;
      this.partner = c;
    } else {
      this.you = c;
      if (this.duo) this.slot = 'partner'; // next: your partner
    }
    this.cursor = CAST.indexOf(c);
    this.save();
    this.refresh();
  }

  setSlot(slot) {
    if (slot === 'partner' && !this.duo) return;
    this.slot = slot;
    this.refresh();
  }

  toggleDuo(on = !this.duo) {
    this.duo = on;
    if (!on) this.slot = 'you';
    this.save();
    this.refresh();
  }

  changeMap(dir) {
    if (this.info || !this.maps.length) return;
    this.mapIndex = Phaser.Math.Wrap(this.mapIndex + dir, 0, this.maps.length);
    this.save();
    this.refresh();
  }

  save() {
    const saved = storage.get();
    storage.set({
      ...saved,
      you: this.you.key,
      partner: this.partner?.key,
      duo: this.duo,
      maps: { ...(saved.maps ?? {}), [this.mode.key]: this.maps[this.mapIndex] },
    });
  }

  ready() {
    if (this.info) return;
    this.save();
    this.scene.start('Game', {
      modeKey: this.mode.key,
      mapKey: this.maps[this.mapIndex],
      characterKey: this.you.key,
      partnerKey: this.duo ? this.partner?.bot ?? null : null,
    });
  }

  // ---- Info (the (i) button) ----

  openInfo(c) {
    this.closeInfo();
    const { width: W, height: H } = this.scale;
    const parts = [];
    const add = (o) => {
      parts.push(o.setDepth(100));
      return o;
    };
    add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive().on('pointerdown', () => this.closeInfo()));
    add(this.add.rectangle(W / 2, H / 2, 640, 300, 0x0b0d12, 0.98).setStrokeStyle(2, 0xffd166));
    add(this.add.text(W / 2 - 290, H / 2 - 124, fullName(c), { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: GOLD }));
    add(this.add.text(W / 2 - 290, H / 2 - 84, `${c.type}${c.partner ? '' : ' · can\'t be your partner'}`, { fontFamily: FONT, fontSize: '15px', color: '#9aa3b5' }));
    add(this.add.text(W / 2 - 290, H / 2 - 48, c.story, { fontFamily: FONT, fontSize: '18px', color: '#e9ecef', wordWrap: { width: 580 }, lineSpacing: 6 }));
    add(this.add.text(W / 2, H / 2 + 120, 'Esc / I / click: close', { fontFamily: FONT, fontSize: '13px', color: '#7d879c' }).setOrigin(0.5));
    this.info = parts;
  }

  closeInfo() {
    if (!this.info) return;
    this.info.forEach((o) => o.destroy());
    this.info = null;
  }

  // ---- Showing the state ----

  refresh() {
    // Cards: the cursor, who's picked, who can't be a partner right now.
    this.cards.forEach((card, i) => {
      const c = card.c;
      const lit = i === this.cursor;
      const blocked = this.slot === 'partner' && !c.partner;
      card.bg.setStrokeStyle(lit ? 3 : 2, lit ? 0xffd166 : 0x2a3345).setFillStyle(0x0b0d12, blocked ? 0.45 : 0.82);
      card.rig?.root.setAlpha(blocked ? 0.35 : 1);
      card.name.setAlpha(blocked ? 0.45 : 1);
      const isYou = c === this.you;
      const isPartner = this.duo && c === this.partner;
      card.tag.setText(isYou ? 'YOU' : isPartner ? 'PARTNER' : '').setBackgroundColor(isYou ? '#ffd166' : '#06d6a0').setVisible(isYou || isPartner);
    });
    // Solo / Duo
    this.soloBtn.setBackgroundColor(this.duo ? '#2a3345' : '#b5862b');
    this.duoBtn.setBackgroundColor(this.duo ? '#b5862b' : '#2a3345');
    // Slots
    for (const slot of ['you', 'partner']) {
      const v = this.slotViews[slot];
      const on = slot === 'you' || this.duo;
      const c = slot === 'you' ? this.you : this.partner;
      v.box.setStrokeStyle(this.slot === slot && on ? 3 : 2, this.slot === slot && on ? 0xffd166 : 0x2a3345).setAlpha(on ? 1 : 0.35);
      v.label.setAlpha(on ? 1 : 0.35);
      v.name.setText(on && c ? fullName(c) : slot === 'partner' ? 'Solo: no partner' : '').setAlpha(on ? 1 : 0.5);
      v.sub.setText(on && c ? c.type : '');
      const want = on && c ? c.key : null;
      if (v.key !== want) {
        if (v.rig) {
          this.rigs = this.rigs.filter((r) => r !== v.rig);
          v.rig.destroy();
        }
        v.rig = want ? this.preview(c, v.x + 128, 380, 2.1) : null;
        v.rig?.root.setDepth(30);
        v.key = want;
      }
    }
    // Map
    const map = MAPS[this.maps[this.mapIndex]];
    this.mapText.setText(map?.name ?? '-');
    this.mapNote.setText(`${this.mapIndex + 1} of ${this.maps.length} maps for ${this.mode.name}`);
  }
}
