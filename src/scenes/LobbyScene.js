import Phaser from 'phaser';
import { CAST, fullName, canPick } from '../data/cast.js';
import { BOTS } from '../data/enemies.js';
import { MODES } from '../data/modes.js';
import { MAPS, MAP_SELECT } from '../data/maps.js';
import { LOBBY } from '../data/menu.js';
import { SPRITES } from '../data/spriteManifest.js';
import { gunKey, meleeKey, throwKey } from '../entities/CharacterRig.js';
import { WEAPONS, THROWABLES, WEAPON_CATEGORIES } from '../data/weapons.js';
import { makeRig } from '../entities/rigFactory.js';
import { makeButton } from '../ui/Button.js';
import { headIcon } from '../ui/ItemArt.js';

// The lobby (Phase 9), after you pick a mode: an armoury (gun racks and
// crates behind), one character at a time on the stage (left), your picks
// and the map on the right.
//   Stage: < > (or Left / Right) to scroll through the cast, a row of heads
//   to jump; PICK (Enter) puts the shown character in the lit slot (YOU,
//   then PARTNER). (i) or I: its name and story. Only characters that can
//   fight beside you show up while you pick a PARTNER.
//   Solo / Duo (D): Duo adds a second slot, your partner. Tab: switch slot.
//   Map: < > (or Q / E) with a picture of it; only the maps that suit the mode.
//   READY (R, or click): the mode intro, the countdown, the match.
//   Esc: back to the mode picker.
const FONT = 'monospace';
const GOLD = '#d2a35f';
const LEFT = 40;           // title and help line
const STAGE_X = 340;       // the stage's middle
const STAGE_FLOOR = 505;   // where the character stands
const HEADS_Y = 660;       // the row of heads
const X0 = 650;            // the right panel

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
  constructor(cast, x, bottom, scale, aim = 8) {
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
    this.restAim = aim;
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

  preload() {
    for (const k of LOBBY.portraits) if (!this.textures.exists(`lobby-${k}`)) this.load.image(`lobby-${k}`, LOBBY.portraitFile(k));
    if (!this.textures.exists('lobby-armoury')) this.load.image('lobby-armoury', LOBBY.armoury);
    for (const k of Object.keys(MAPS)) if (!MAPS[k].trainingOnly && k !== 'test' && !this.textures.exists(`map-prev-${k}`)) this.load.image(`map-prev-${k}`, LOBBY.mapPreview(k));
    this.load.on('loaderror', () => {}); // a missing picture: the lobby just goes without it
  }

  create(data) {
    this.info = null; // reused scene object: nothing left open from last time (B-025)
    this.arsenal = null;
    this.mode = MODES[data.modeKey] ?? MODES.free;
    const saved = storage.get();
    this.duo = Boolean(saved.duo);
    this.you = CAST.find((c) => c.key === saved.you && canPick(c, 'you')) ?? CAST[0];
    this.partner = CAST.find((c) => c.key === saved.partner && c.partner) ?? CAST.find((c) => c.partner);
    this.maps = (this.mode.maps ?? MAP_SELECT.order).filter((k) => MAPS[k] && !MAPS[k].trainingOnly && k !== 'test'); // the test map is for testing addresses only
    const savedMap = saved.maps?.[this.mode.key];
    this.mapIndex = Math.max(0, this.maps.indexOf(savedMap));
    this.slot = 'you';
    this.cursor = CAST.indexOf(this.you);
    this.rigs = [];

    this.drawArmoury();
    this.add.text(LEFT, 30, `LOBBY · ${this.mode.name.toUpperCase()}`, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: GOLD, stroke: '#000000', strokeThickness: 5 });
    this.add.text(LEFT, 64, '< > or ←/→: browse · Enter: pick · I: info · D: solo/duo · Tab: slot · Q/E: map · A: arsenal · R: ready · Esc: back', { fontFamily: FONT, fontSize: '12px', color: '#a49d95', stroke: '#000000', strokeThickness: 3 });
    this.drawStage();
    this.drawSide();
    makeButton(this, 1180, 46, 'ARSENAL', () => (this.arsenal ? this.closeArsenal() : this.openArsenal()), { key: null, keyLabel: 'A', size: 16, once: false });

    const k = this.input.keyboard;
    k.on('keydown-ENTER', () => (this.info ? this.closeInfo() : this.pick(CAST[this.cursor])));
    k.on('keydown-I', () => (this.info ? this.closeInfo() : this.openInfo(CAST[this.cursor])));
    k.on('keydown-D', () => this.toggleDuo());
    k.on('keydown-TAB', (e) => {
      e.preventDefault?.();
      if (this.duo) this.setSlot(this.slot === 'you' ? 'partner' : 'you');
    });
    k.addCapture('TAB');
    k.on('keydown-ESC', () => (this.arsenal ? this.closeArsenal() : this.info ? this.closeInfo() : this.scene.start('Menu', { page: 'modes' })));
    k.on('keydown-A', () => (this.arsenal ? this.closeArsenal() : this.openArsenal()));
    this.refresh();
  }

  update(time, delta) {
    for (const r of this.rigs) r.update(delta);
  }

  // ---- The room ----

  // A dark armoury wall: planks, two racks of rifles and pistols, crates.
  drawArmoury() {
    const { width: W, height: H } = this.scale;
    if (this.textures.exists('lobby-armoury')) {
      const bg = this.add.image(W / 2, H / 2, 'lobby-armoury');
      bg.setScale(Math.max(W / bg.width, H / bg.height));
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25);
      return;
    }
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
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25); // dim it so the stage stands out
  }

  // ---- The stage (left): one character at a time ----

  drawStage() {
    // A spotlight and a platform to stand on
    this.add.rectangle(STAGE_X, 389, 600, 610, 0x0d1114, 0.55).setStrokeStyle(2, 0x30353b);
    const g = this.add.graphics();
    g.fillStyle(0xe9dbc0, 0.07).fillTriangle(STAGE_X - 40, 84, STAGE_X + 40, 84, STAGE_X + 170, STAGE_FLOOR);
    g.fillTriangle(STAGE_X - 40, 84, STAGE_X - 170, STAGE_FLOOR, STAGE_X + 170, STAGE_FLOOR);
    // The platform: a steel deck with a hazard-striped front
    const L = STAGE_X - 150;
    const R = STAGE_X + 150;
    const top = STAGE_FLOOR - 6;
    g.fillStyle(0x000000, 0.35).fillRect(L + 6, STAGE_FLOOR + 18, 300, 6); // its shadow
    g.fillStyle(0x5c5a5f, 1).fillPoints([{ x: L + 16, y: top }, { x: R - 16, y: top }, { x: R, y: STAGE_FLOOR + 4 }, { x: L, y: STAGE_FLOOR + 4 }], true);
    g.fillStyle(0x35363d, 1).fillRect(L, STAGE_FLOOR + 4, 300, 16);
    for (let x = L + 4; x < R - 8; x += 18) {
      g.fillStyle(0xe29c53, 0.85).fillPoints([{ x, y: STAGE_FLOOR + 20 }, { x: x + 8, y: STAGE_FLOOR + 4 }, { x: x + 14, y: STAGE_FLOOR + 4 }, { x: x + 6, y: STAGE_FLOOR + 20 }], true);
    }
    g.lineStyle(2, 0x131112, 1).strokePoints([{ x: L + 16, y: top }, { x: R - 16, y: top }, { x: R, y: STAGE_FLOOR + 4 }, { x: R, y: STAGE_FLOOR + 20 }, { x: L, y: STAGE_FLOOR + 20 }, { x: L, y: STAGE_FLOOR + 4 }], true);
    g.lineBetween(L, STAGE_FLOOR + 4, R, STAGE_FLOOR + 4);
    g.fillStyle(0x928977, 1);
    for (const x of [L + 26, STAGE_X, R - 26]) g.fillCircle(x, STAGE_FLOOR - 1, 2); // bolts
    this.stageArt = null; // the rig or the picture on the stage
    this.stageKey = null;
    // < >
    makeButton(this, 70, 300, '◀', () => this.browse(-1), { key: 'LEFT', keyLabel: '', size: 26, once: false });
    makeButton(this, 610, 300, '▶', () => this.browse(1), { key: 'RIGHT', keyLabel: '', size: 26, once: false });
    // Name, type, (i), what it is for you
    this.stageName = this.add.text(STAGE_X, 532, '', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5, 0);
    this.stageType = this.add.text(STAGE_X, 564, '', { fontFamily: FONT, fontSize: '14px', color: '#a49d95' }).setOrigin(0.5, 0);
    this.stageTag = this.add.text(STAGE_X, 102, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#0d1114', padding: { x: 6, y: 2 } }).setOrigin(0.5, 0);
    this.infoBtn = makeButton(this, 0, 548, 'i', () => this.openInfo(CAST[this.cursor]), { keyLabel: '', size: 15, once: false });
    this.pickBtn = makeButton(this, STAGE_X, 608, 'PICK', () => this.pick(CAST[this.cursor]), { keyLabel: 'Enter', size: 17, once: false });
    // The row of heads: where you are in the cast, click one to jump
    const step = 36;
    const x0 = STAGE_X - ((CAST.length - 1) * step) / 2;
    this.heads = CAST.map((c, i) => {
      const x = x0 + i * step;
      const box = this.add.rectangle(x, HEADS_Y, 32, 32, 0x1a1f24, 0.95).setStrokeStyle(2, 0x30353b).setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.jump(i));
      const icon = headIcon(this, c.key, x, HEADS_Y, 24);
      return { c, box, icon };
    });
  }

  // Which characters you can browse right now (a partner must be able to
  // fight beside you; the Drone and the K9 can't be you either).
  browsable() {
    return CAST.filter((c) => canPick(c, this.slot));
  }

  browse(dir) {
    if (this.info || this.arsenal) return;
    const list = this.browsable();
    const i = list.indexOf(CAST[this.cursor]);
    const next = list[Phaser.Math.Wrap((i < 0 ? 0 : i) + dir, 0, list.length)];
    this.cursor = CAST.indexOf(next);
    this.refresh();
  }

  jump(i) {
    if (this.info || !this.browsable().includes(CAST[i])) return;
    this.cursor = i;
    this.refresh();
  }

  // The shown character: its front-view picture if it has one, else its rig.
  showOnStage(c) {
    if (this.stageKey === c.key) return;
    this.stageKey = c.key;
    if (this.stageArt) {
      this.rigs = this.rigs.filter((r) => r !== this.stageArt);
      this.stageArt.destroy();
      this.stageArt = null;
    }
    const pic = `lobby-${c.key}`;
    if (this.textures.exists(pic)) {
      const img = this.add.image(STAGE_X, STAGE_FLOOR, pic).setOrigin(0.5, 1).setDepth(10);
      img.setScale(Math.min(330 / img.width, 400 / img.height));
      this.stageArt = img;
    } else {
      this.stageArt = this.preview(c, STAGE_X - 20, STAGE_FLOOR, LOBBY.stageScale, LOBBY.poses[c.key] ?? 8);
    }
    // A little entrance
    const o = this.stageArt?.root ?? this.stageArt;
    if (o) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 180 });
    }
  }

  // A character drawn from its rig, standing with its gun.
  preview(c, x, bottom, scale, aim) {
    if (!SPRITES.characters[c.key]) return null;
    const owner = new Mannequin(c, x, bottom, scale, aim);
    const rig = makeRig(this, owner, c.key);
    rig.root.setDepth(10);
    rig.update(16);
    this.rigs.push(rig);
    return rig;
  }

  // ---- Your picks and the map (right side) ----

  drawSide() {
    this.add.rectangle(X0, 84, 590, 610, 0x0d1114, 0.82).setOrigin(0).setStrokeStyle(2, 0x30353b);
    // Solo / Duo
    this.soloBtn = makeButton(this, X0 + 80, 118, 'SOLO', () => this.toggleDuo(false), { size: 17, once: false });
    this.duoBtn = makeButton(this, X0 + 200, 118, 'DUO', () => this.toggleDuo(true), { keyLabel: 'D', size: 17, once: false });
    // Slots: who's picked (click one to pick for it)
    this.slotViews = {};
    for (const [slot, x] of [['you', X0 + 30], ['partner', X0 + 305]]) {
      const box = this.add.rectangle(x, 146, 255, 150, 0x1a1f24, 1).setOrigin(0).setStrokeStyle(2, 0x30353b).setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.setSlot(slot));
      const label = this.add.text(x + 10, 154, slot === 'you' ? 'YOU' : 'PARTNER', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#a49d95' });
      const name = this.add.text(x + 128, 256, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5, 0);
      const sub = this.add.text(x + 128, 275, '', { fontFamily: FONT, fontSize: '11px', color: '#a49d95' }).setOrigin(0.5, 0);
      this.slotViews[slot] = { box, label, name, sub, x, rig: null, key: null };
    }
    // Map: < name > and its picture
    this.add.text(X0 + 30, 310, 'MAP', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#a49d95' });
    makeButton(this, X0 + 60, 345, '◀', () => this.changeMap(-1), { key: 'Q', keyLabel: 'Q', size: 16, once: false });
    this.mapText = this.add.text(X0 + 295, 345, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    makeButton(this, X0 + 530, 345, '▶', () => this.changeMap(1), { key: 'E', keyLabel: 'E', size: 16, once: false });
    this.add.rectangle(X0 + 295, 474, 384, 220, 0x0d1114, 1).setStrokeStyle(2, 0x30353b);
    this.mapPic = this.add.image(X0 + 295, 474, '__DEFAULT').setVisible(false);
    this.mapNone = this.add.text(X0 + 295, 474, 'no picture yet', { fontFamily: FONT, fontSize: '13px', color: '#4d5967' }).setOrigin(0.5);
    this.mapNote = this.add.text(X0 + 295, 596, '', { fontFamily: FONT, fontSize: '12px', color: '#a49d95' }).setOrigin(0.5);
    // Ready
    makeButton(this, X0 + 295, 645, 'READY', () => this.ready(), { key: 'R', size: 26, color: '#d2a35f', once: false });
  }

  // ---- Actions ----

  // Pick a character for the lit slot (a partner must be one that can fight beside you).
  pick(c) {
    if (this.info || this.arsenal) return;
    if (!canPick(c, this.slot)) return;
    if (this.slot === 'partner') {
      this.partner = c;
    } else {
      this.you = c;
      if (this.duo) this.slot = 'partner'; // next: your partner
    }
    if (!canPick(CAST[this.cursor], this.slot)) this.cursor = CAST.indexOf(this.slot === 'partner' ? this.partner : this.you);
    this.save();
    this.refresh();
  }

  setSlot(slot) {
    if (slot === 'partner' && !this.duo) return;
    this.slot = slot;
    this.cursor = CAST.indexOf(slot === 'you' ? this.you : this.partner);
    this.refresh();
  }

  toggleDuo(on = !this.duo) {
    if (this.info) return;
    this.duo = on;
    if (!on) this.setSlot('you');
    this.save();
    this.refresh();
  }

  changeMap(dir) {
    if (this.info || this.arsenal || !this.maps.length) return;
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
    if (this.info || this.arsenal) return;
    this.save();
    this.scene.start('Game', {
      modeKey: this.mode.key,
      mapKey: this.maps[this.mapIndex],
      characterKey: this.you.key,
      partnerKey: this.duo ? this.partner?.bot ?? null : null,
    });
  }

  // ---- Arsenal (A): every gun, melee weapon and throwable, racked by family ----

  openArsenal() {
    if (this.arsenal) return;
    this.closeInfo();
    const { width: W, height: H } = this.scale;
    const parts = [];
    const add = (o) => {
      parts.push(o.setDepth(120));
      return o;
    };
    add(this.add.rectangle(W / 2, H / 2, W, H, 0x0d1114, 0.94).setInteractive()); // blocks clicks behind
    add(this.add.text(40, 22, 'ARSENAL', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: GOLD, stroke: '#000000', strokeThickness: 5 }));
    add(this.add.text(220, 34, 'every weapon and throwable, by family · point at one for its details', { fontFamily: FONT, fontSize: '13px', color: '#a49d95' }));
    const detail = add(this.add.text(W / 2, H - 44, '', { fontFamily: FONT, fontSize: '15px', color: '#dcd1bf', align: 'center' }).setOrigin(0.5));
    const rows = [...Object.entries(WEAPON_CATEGORIES).map(([cat, c]) => ({ name: c.name, items: Object.entries(WEAPONS).filter(([, w]) => w.category === cat).map(([key, w]) => ({ key, w, tex: cat === 'melee' ? meleeKey(key) : gunKey(key) })) })),
      { name: 'Throwables', items: Object.entries(THROWABLES).map(([key, w]) => ({ key, w, tex: throwKey(key), thrown: true })) }];
    const top = 74;
    const rowH = Math.floor((H - top - 80) / rows.length);
    rows.forEach((row, ri) => {
      const y = top + ri * rowH + rowH / 2;
      add(this.add.rectangle(W / 2, y, W - 60, rowH - 4, 0x1a1f24, 0.85).setStrokeStyle(1, 0x30353b)); // the rack
      add(this.add.text(44, y, row.name.toUpperCase(), { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#a49d95' }).setOrigin(0, 0.5));
      const step = Math.min(104, (W - 240) / Math.max(1, row.items.length));
      row.items.forEach((it, i) => {
        const x = 230 + i * step + step / 2;
        if (!this.textures.exists(it.tex)) return;
        const img = add(this.add.image(x, y - 6, it.tex));
        const maxW = it.thrown ? 30 : step - 14;
        img.setScale(Math.min(maxW / img.width, (rowH - 22) / img.height));
        const label = add(this.add.text(x, y + rowH / 2 - 10, it.w.name, { fontFamily: FONT, fontSize: '9px', color: '#8a837b' }).setOrigin(0.5));
        const hit = add(this.add.rectangle(x, y, step - 4, rowH - 6, 0xffffff, 0.001).setInteractive({ useHandCursor: true }));
        hit.on('pointerover', () => {
          label.setColor('#d2a35f');
          img.setScale(img.scale * 1.12);
          detail.setText(this.arsenalLine(it));
        });
        hit.on('pointerout', () => {
          label.setColor('#8a837b');
          img.setScale(img.scale / 1.12);
        });
      });
    });
    add(makeButton(this, W - 110, 40, 'CLOSE', () => this.closeArsenal(), { keyLabel: 'Esc', size: 14 }));
    this.arsenal = parts;
  }

  // One line about a weapon (Arsenal).
  arsenalLine(it) {
    const w = it.w;
    if (it.thrown) return `${w.name} · throwable${w.effect ? ` (${w.effect})` : ''}${w.damage ? ` · dmg ${w.damage}` : ''}${w.radiusPx || w.blastRadius ? ` · radius ${w.radiusPx ?? w.blastRadius}px` : ''}`;
    const fam = WEAPON_CATEGORIES[w.category]?.name ?? w.category;
    const hits = w.hits && w.hits > 1 ? ` in ${w.hits} hits` : '';
    const ammo = w.ammo === null || w.ammo === undefined ? 'melee' : `${w.ammo} per load`;
    const words = w.wordList ? ` · ${w.wordList.replace('extraLong', 'extra-long')} words` : '';
    return `${w.name} · ${fam} · dmg ${w.damage}${hits} · ${ammo}${words}`;
  }

  closeArsenal() {
    if (!this.arsenal) return;
    const parts = this.arsenal;
    this.arsenal = null;
    parts.forEach((o) => o.destroy());
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
    add(this.add.rectangle(W / 2, H / 2, 640, 300, 0x0d1114, 0.98).setStrokeStyle(2, 0xd2a35f));
    const icon = headIcon(this, c.key, W / 2 - 270, H / 2 - 106, 44);
    if (icon) add(icon);
    add(this.add.text(W / 2 - 236, H / 2 - 124, fullName(c), { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: GOLD }));
    add(this.add.text(W / 2 - 236, H / 2 - 86, `${c.type}${c.playable === false ? ' · not playable (enemy only)' : c.partner ? '' : ' · can\'t be your partner'}`, { fontFamily: FONT, fontSize: '15px', color: '#a49d95' }));
    add(this.add.text(W / 2 - 290, H / 2 - 48, c.story, { fontFamily: FONT, fontSize: '18px', color: '#dcd1bf', wordWrap: { width: 580 }, lineSpacing: 6 }));
    add(makeButton(this, W / 2, H / 2 + 118, 'CLOSE', () => this.closeInfo(), { keyLabel: 'Esc', size: 15 }));
    this.info = parts;
  }

  closeInfo() {
    if (!this.info) return;
    const parts = this.info;
    this.info = null;
    parts.forEach((o) => o.destroy());
  }

  // ---- Showing the state ----

  refresh() {
    const c = CAST[this.cursor];
    this.showOnStage(c);
    this.stageName.setText(fullName(c));
    this.stageType.setText(c.type);
    this.infoBtn.x = STAGE_X + this.stageName.width / 2 + 24;
    const isYou = c === this.you;
    const isPartner = this.duo && c === this.partner;
    this.stageTag.setText(isYou ? 'YOU' : isPartner ? 'PARTNER' : '').setBackgroundColor(isYou ? '#d2a35f' : '#06d6a0').setVisible(isYou || isPartner);
    const already = this.slot === 'you' ? isYou : isPartner;
    this.pickBtn.list[1].setText(already ? (this.slot === 'you' ? 'YOUR PICK' : 'YOUR PARTNER') : `[Enter] PICK FOR ${this.slot === 'you' ? 'YOU' : 'PARTNER'}`);
    this.pickBtn.list[0].setSize(this.pickBtn.list[1].width + 28, this.pickBtn.list[0].height);
    this.pickBtn.setSize(this.pickBtn.list[1].width + 28, this.pickBtn.list[0].height);
    this.pickBtn.setAlpha(already ? 0.6 : 1);
    // Heads: where you are; grey for ones that can't be picked for this slot
    this.heads.forEach((h, i) => {
      const lit = i === this.cursor;
      const blocked = !canPick(h.c, this.slot);
      h.box.setStrokeStyle(lit ? 3 : 2, lit ? 0xd2a35f : h.c === this.you ? 0x9c7a2e : this.duo && h.c === this.partner ? 0x06d6a0 : 0x30353b);
      h.box.setAlpha(blocked ? 0.35 : 1);
      h.icon?.setAlpha(blocked ? 0.25 : 1);
    });
    // Solo / Duo
    this.soloBtn.list[0].setFillStyle(this.duo ? 0x1a1f24 : 0x6b5320, 0.95);
    this.duoBtn.list[0].setFillStyle(this.duo ? 0x6b5320 : 0x1a1f24, 0.95);
    // Slots
    for (const slot of ['you', 'partner']) {
      const v = this.slotViews[slot];
      const on = slot === 'you' || this.duo;
      const who = slot === 'you' ? this.you : this.partner;
      v.box.setStrokeStyle(this.slot === slot && on ? 3 : 2, this.slot === slot && on ? 0xd2a35f : 0x30353b).setAlpha(on ? 1 : 0.35);
      v.label.setAlpha(on ? 1 : 0.35);
      v.name.setText(on && who ? fullName(who) : slot === 'partner' ? 'Solo: no partner' : '').setAlpha(on ? 1 : 0.5);
      v.sub.setText(on && who ? who.type : '');
      const want = on && who ? who.key : null;
      if (v.key !== want) {
        if (v.rig) {
          this.rigs = this.rigs.filter((r) => r !== v.rig);
          v.rig.destroy();
        }
        v.rig = want ? this.preview(who, v.x + 120, 250, 1.55) : null;
        v.rig?.root.setDepth(30);
        v.key = want;
      }
    }
    // Map
    const key = this.maps[this.mapIndex];
    const map = MAPS[key];
    this.mapText.setText(map?.name ?? '-');
    this.mapNote.setText(`${this.mapIndex + 1} of ${this.maps.length} maps for ${this.mode.name}`);
    const pic = `map-prev-${key}`;
    const has = this.textures.exists(pic);
    this.mapPic.setVisible(has);
    this.mapNone.setVisible(!has);
    if (has) {
      this.mapPic.setTexture(pic);
      this.mapPic.setScale(Math.min(380 / this.mapPic.width, 216 / this.mapPic.height));
    }
  }
}
