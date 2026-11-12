import { PLAYER } from '../data/player.js';
import { MELEE_SLOT } from '../systems/WeaponSystem.js';
import { WEAPON_CATEGORIES } from '../data/weapons.js';
import { iconKey } from './Icons.js';
import { gunKey, meleeKey, throwKey } from '../entities/CharacterRig.js';
import { ITEMS } from '../data/items.js';

const BAR_WIDTH = 200;
const BAR_HEIGHT = 12;
const HP_COLOR = 0x06d6a0;
const FUEL_COLOR = 0x3a86ff;
const LOW_COLOR = 0xff4d6d;
const LIST_NAMES = { short: 'short', medium: 'medium', long: 'long', extraLong: 'extra-long' };
const FONT = 'monospace';
const INK = 0x131112;
const PLATE = 0x0b0d12;
const EDGE = 0x35363d;
const GOLD = 0xffd166;
// The weapon panel, top right: one row per slot with the gun's own art.
const PANEL = { right: 1264, top: 12, width: 292, row: 34, art: { w: 74, h: 24 } };

// On-screen UI pinned to the camera (scroll factor 0).
//   Top left: HP, FUEL and (with a vest) ARMOR bars on a dark plate.
//   Top right: your guns (slot 1, slot 2, melee) drawn from their own art
//   with ammo, a line about the one in hand, your two throwables and the
//   Riot Shield when you carry one.
//   Bottom middle: TYPING, JAMMED, RELOADING, SWITCHING or AIMING.
export default class Hud {
  constructor(scene) {
    this.scene = scene;
    const fix = (o) => o.setScrollFactor(0).setDepth(100);
    this.vitalsPlate = fix(scene.add.rectangle(8, 8, 300, 50, PLATE, 0.72).setOrigin(0).setStrokeStyle(2, EDGE));
    this.hpBar = this.makeBar(scene, 16, 16, 'HP', HP_COLOR);
    this.fuelBar = this.makeBar(scene, 16, 36, 'FUEL', FUEL_COLOR);
    // Armor Vest points, below (only while you wear one).
    this.armorBar = this.makeBar(scene, 16, 56, 'ARMOR', ITEMS.armorVest.barColor);
    this.armorBar.parts.forEach((o) => o.setVisible(false));

    // Weapon panel
    this.panel = fix(scene.add.rectangle(PANEL.right, PANEL.top, PANEL.width, 10, PLATE, 0.72).setOrigin(1, 0).setStrokeStyle(2, EDGE));
    this.rows = [];
    for (let i = 0; i < 3; i++) this.rows.push(this.makeRow(scene, fix));
    this.info = fix(scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#9aa3b5', wordWrap: { width: PANEL.width - 16 } }));
    this.throwRows = [0, 1].map(() => this.makeChip(scene, fix));
    this.shieldRow = this.makeChip(scene, fix);
    this.hint = fix(scene.add.text(0, 0, 'Shift guns · Tab throwables · Space throw', { fontFamily: FONT, fontSize: '10px', color: '#5c6478' }));
    this.iconFor = null;

    // State tag, bottom center: TYPING, JAMMED, SWITCHING or AIMING.
    this.typingTag = fix(scene.add
      .text(640, 690, 'TYPING', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0b0d12cc', padding: { x: 10, y: 4 } })
      .setOrigin(0.5)
      .setVisible(false));
  }

  // Label + track + fill (shrinks to the left) + its value.
  makeBar(scene, x, y, label, color, width = BAR_WIDTH) {
    const fix = (o) => o.setScrollFactor(0).setDepth(100);
    const text = fix(scene.add.text(x, y - 1, label, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#c9d1e0' }));
    const pad = 48;
    const bg = fix(scene.add.rectangle(x + pad, y, width + 4, BAR_HEIGHT + 4, INK, 0.9).setOrigin(0, 0).setStrokeStyle(1, EDGE));
    const fill = fix(scene.add.rectangle(x + pad + 2, y + 2, width, BAR_HEIGHT, color).setOrigin(0, 0));
    const shine = fix(scene.add.rectangle(x + pad + 2, y + 2, width, 3, 0xffffff, 0.22).setOrigin(0, 0)); // a light top edge
    // Notches every quarter, so you can read it at a glance
    const ticks = fix(scene.add.graphics());
    ticks.fillStyle(INK, 0.55);
    for (let k = 1; k < 4; k++) ticks.fillRect(x + pad + 2 + (width * k) / 4, y + 2, 1, BAR_HEIGHT);
    const value = fix(scene.add.text(x + pad + width + 10, y - 1, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#e9ecef' }));
    return { fill, shine, color, value, parts: [text, bg, fill, shine, ticks, value] };
  }

  setBar(bar, pct, value) {
    const k = Math.max(0, Math.min(1, pct));
    bar.fill.scaleX = k;
    bar.shine.scaleX = k;
    bar.fill.setFillStyle(k < 0.25 ? LOW_COLOR : bar.color);
    bar.value.setText(value);
  }

  // A gun row: key, its art, name, ammo (count and a strip).
  makeRow(scene, fix) {
    const bg = fix(scene.add.rectangle(0, 0, PANEL.width - 12, PANEL.row - 4, 0x141821, 0.9).setOrigin(0).setStrokeStyle(1, EDGE));
    const key = fix(scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#7d879c' }).setOrigin(0, 0.5));
    const art = fix(scene.add.image(0, 0, '__DEFAULT').setVisible(false));
    const name = fix(scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#e9ecef' }).setOrigin(0, 0.5));
    const ammo = fix(scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#e9dbc0' }).setOrigin(1, 0.5));
    const strip = fix(scene.add.rectangle(0, 0, 10, 3, 0xe29c53).setOrigin(0, 0.5));
    return { bg, key, art, name, ammo, strip };
  }

  // A small row: picture, name and count (throwables, the shield).
  makeChip(scene, fix) {
    const bg = fix(scene.add.rectangle(0, 0, (PANEL.width - 18) / 2, 24, 0x141821, 0.9).setOrigin(0).setStrokeStyle(1, EDGE));
    const art = fix(scene.add.image(0, 0, '__DEFAULT').setVisible(false));
    const name = fix(scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#e9ecef' }).setOrigin(0, 0.5));
    return { bg, art, name };
  }

  fit(img, tex, w, h) {
    const ok = Boolean(tex) && this.scene.textures.exists(tex);
    img.setVisible(ok);
    if (ok) {
      img.setTexture(tex);
      img.setScale(Math.min(w / img.width, h / img.height));
    }
    return ok;
  }

  update(player, typing, weapons) {
    this.setBar(this.hpBar, player.hp / PLAYER.maxHp, String(Math.max(0, Math.ceil(player.hp))));
    this.setBar(this.fuelBar, player.fuel / PLAYER.fuelMax, `${Math.round((player.fuel / PLAYER.fuelMax) * 100)}%`);
    if (player.boosted) this.fuelBar.fill.setFillStyle(ITEMS.jetBoost.fuelColor); // Jet Boost: gold bar

    const armor = player.armor;
    this.armorBar.parts.forEach((o) => o.setVisible(Boolean(armor)));
    this.vitalsPlate.height = armor ? 70 : 50;
    if (armor) this.setBar(this.armorBar, Math.max(0, armor.points) / armor.config.points, String(Math.max(0, Math.ceil(armor.points))));

    this.updateWeapons(weapons);
    this.updateTag(typing, weapons);
  }

  updateWeapons(weapons) {
    const current = weapons.current;
    const L = PANEL.right - PANEL.width + 6; // rows' left edge
    let y = PANEL.top + 6;
    weapons.slots.forEach((w, i) => {
      const r = this.rows[i];
      if (!r) return;
      const on = i === weapons.active;
      r.bg.setPosition(L, y).setStrokeStyle(on ? 2 : 1, on ? GOLD : EDGE).setFillStyle(on ? 0x2a2418 : 0x141821, 0.9);
      const cy = y + (PANEL.row - 4) / 2;
      r.key.setPosition(L + 6, cy).setText(i === MELEE_SLOT ? 'M' : String(i + 1)).setColor(on ? '#ffd166' : '#7d879c');
      const tex = w ? (w.category === 'melee' ? meleeKey(w.key) : gunKey(w.key)) : null;
      const has = this.fit(r.art, tex, PANEL.art.w, PANEL.art.h);
      if (!has && w) this.fit(r.art, iconKey({ type: 'gun', key: w.key }), PANEL.art.w, PANEL.art.h);
      r.art.setPosition(L + 22 + PANEL.art.w / 2, cy).setAlpha(w ? 1 : 0);
      r.name.setPosition(L + 104, cy - (w && w.ammo !== null ? 4 : 0)).setText(w ? w.name : '(empty)').setColor(w ? '#e9ecef' : '#5c6478');
      const right = L + PANEL.width - 18;
      if (w && w.ammo !== null) {
        const left = weapons.ammo[i];
        r.ammo.setPosition(right, cy - 4).setText(`${left}/${w.ammo}`).setColor(left === 0 ? '#ff4d6d' : '#e9dbc0').setVisible(true);
        const full = right - (L + 104);
        r.strip.setPosition(L + 104, cy + 8).setSize(Math.max(1, full * (left / w.ammo)), 3).setVisible(true);
      } else {
        r.ammo.setVisible(Boolean(w)).setPosition(right, cy).setText(w ? 'melee' : '').setColor('#9aa3b5');
        r.strip.setVisible(false);
      }
      y += PANEL.row;
    });
    // About the one in hand
    const info = current ? this.weaponInfo(current, weapons) : ['nothing in hand'];
    this.info.setPosition(L + 2, y).setText(info.join(' · '));
    y += this.info.height + 4;
    // Throwables, two chips side by side
    const chipW = (PANEL.width - 18) / 2;
    weapons.throwSlots.forEach((t, i) => {
      const c = this.throwRows[i];
      const x = L + i * (chipW + 6);
      const on = i === weapons.throwActive;
      c.bg.setPosition(x, y).setStrokeStyle(on ? 2 : 1, on ? 0xff9f1c : EDGE);
      const ok = this.fit(c.art, t.config ? throwKey(t.config.key) : null, 22, 18);
      c.art.setPosition(x + 15, y + 12);
      c.name.setPosition(x + (ok ? 30 : 8), y + 12).setText(t.config ? `${t.config.name} x${t.count}` : `T${i + 1} (empty)`).setColor(t.config ? '#e9ecef' : '#5c6478');
    });
    y += 30;
    // Riot Shield
    const shield = weapons.player.shield;
    const sr = this.shieldRow;
    [sr.bg, sr.art, sr.name].forEach((o) => o.setVisible(Boolean(shield)));
    if (shield) {
      sr.bg.setPosition(L, y).setSize(PANEL.width - 12, 24);
      this.fit(sr.art, 'spr-util-riotShield', 18, 20);
      sr.art.setPosition(L + 14, y + 12);
      sr.name.setPosition(L + 30, y + 12).setText(`Riot Shield ${Math.max(0, Math.ceil(shield.hp))}/${shield.config.hp}`);
      y += 30;
    }
    this.hint.setPosition(L + 2, y);
    y += 14;
    this.panel.height = y - PANEL.top + 4;

    // A little pop when the gun in hand changes
    const key = current?.key ?? null;
    if (key !== this.iconFor) {
      this.iconFor = key;
      const r = this.rows[weapons.active];
      if (r?.art.visible) {
        const s0 = r.art.scale;
        this.scene.tweens.add({ targets: r.art, scale: { from: s0 * 1.3, to: s0 }, duration: 180 });
      }
    }
  }

  // Three lines about the weapon in hand: family and words, damage, range.
  weaponInfo(w, weapons) {
    const words = `${LIST_NAMES[w.wordList]} words`;

    const hits = w.hits ?? 1;
    let damage = `dmg ${w.damage}`;
    if (w.saw) {
      damage += ' grind + blast';
    } else if (w.flame) {
      damage += ' + burning';
    } else if (w.projectile) {
      const count = w.projectile.count ?? 1;
      damage += count > 1 ? ` in ${count} bombs` : ' splash';
    } else if (hits > 1) {
      damage += w.hitDelayMs ? ` in ${hits} hits` : ` in ${hits} pellets`;
    }

    let range;
    if (w.saw) range = 'homes in · grinds · explodes';
    else if (w.beam) range = 'beam pierces every enemy in line';
    else if (w.flame) range = `reach ${w.reach}px · cone · sets on fire`;
    else if (w.pins) range = 'each nail pins them in place';
    else if (w.blast) range = `blast ${w.blast.blastRadius}px · can hurt you`;
    else if (w.category === 'melee') range = `reach ${w.reach}px: get close`;
    else if (w.belt) range = weapons.reloading ? 'reloading…' : `belt ${weapons.beltLeft}/${w.belt} · then reload`;
    else if (w.falloff) range = `weaker past ${w.falloff.startPx}px`;
    else range = 'full dmg at any range';

    return [`${WEAPON_CATEGORIES[w.category].name}, ${words}`, damage, range];
  }

  updateTag(typing, weapons) {
    const reason = typing.blockedReason;

    if (weapons.aiming) {
      const power = Math.round(weapons.charge * 100);
      this.typingTag.setText(`AIMING ${power}%`).setColor('#ff9f1c').setVisible(true);
    } else if (reason === 'jam') {
      this.typingTag.setText('JAMMED').setColor('#ff4d6d').setVisible(true);
    } else if (reason === 'reload') {
      this.typingTag.setText('RELOADING').setColor('#ffd166').setVisible(true);
    } else if (reason === 'switch') {
      this.typingTag.setText('SWITCHING').setColor('#ffd166').setVisible(true);
    } else if (typing.isTyping) {
      this.typingTag.setText('TYPING').setColor('#ffffff').setVisible(true);
    } else {
      this.typingTag.setVisible(false);
    }
  }
}