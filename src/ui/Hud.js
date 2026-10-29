import { PLAYER } from '../data/player.js';
import { MELEE_SLOT } from '../systems/WeaponSystem.js';
import { WEAPON_CATEGORIES } from '../data/weapons.js';
import { iconKey } from './Icons.js';

const BAR_WIDTH = 200;
const BAR_HEIGHT = 12;
const HP_COLOR = 0x06d6a0;
const FUEL_COLOR = 0x3a86ff;
const LOW_COLOR = 0xff4d6d;
const LIST_NAMES = { short: 'short', medium: 'medium', long: 'long', extraLong: 'extra-long' };
const ICON_BOX = { width: 62, height: 36, gap: 6 }; // weapon-in-hand icon, left of the panel

// On-screen UI pinned to the camera (scroll factor 0).
export default class Hud {
  constructor(scene) {
    this.hpBar = this.makeBar(scene, 16, 16, 'HP', HP_COLOR);
    this.fuelBar = this.makeBar(scene, 16, 36, 'FUEL', FUEL_COLOR);

    // Weapon panel, top right.
    this.weaponText = scene.add
      .text(1264, 16, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0);

    // Picture of the weapon in your hand, just left of the panel. Pops on a switch.
    this.iconBox = scene.add
      .rectangle(0, 16, ICON_BOX.width, ICON_BOX.height, 0x000000, 0.67)
      .setOrigin(1, 0);
    this.weaponIcon = scene.add.image(0, 16 + ICON_BOX.height / 2, '__DEFAULT');
    this.iconFor = null; // weapon key the icon shows
    this.scene = scene;

    // State tag, bottom center: TYPING, JAMMED, SWITCHING or AIMING.
    this.typingTag = scene.add
      .text(640, 690, 'TYPING', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    for (const obj of [this.weaponText, this.typingTag, this.iconBox, this.weaponIcon]) {
      obj.setScrollFactor(0).setDepth(100);
    }
  }

  // Label + dark background + colored fill that shrinks to the left.
  makeBar(scene, x, y, label, color) {
    const text = scene.add.text(x, y - 1, label, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    });
    const bg = scene.add
      .rectangle(x + 48, y, BAR_WIDTH + 4, BAR_HEIGHT + 4, 0x000000, 0.5)
      .setOrigin(0, 0);
    const fill = scene.add
      .rectangle(x + 50, y + 2, BAR_WIDTH, BAR_HEIGHT, color)
      .setOrigin(0, 0);

    for (const obj of [text, bg, fill]) obj.setScrollFactor(0).setDepth(100);
    return { fill, color };
  }

  setBar(bar, pct) {
    bar.fill.scaleX = pct;
    bar.fill.setFillStyle(pct < 0.25 ? LOW_COLOR : bar.color);
  }

  update(player, typing, weapons) {
    this.setBar(this.hpBar, player.hp / PLAYER.maxHp);
    this.setBar(this.fuelBar, player.fuel / PLAYER.fuelMax);

    this.updateWeapons(weapons);
    this.updateTag(typing, weapons);
  }

  updateWeapons(weapons) {
    const current = weapons.current;

    // One line per slot, e.g. "> 1. Sniper 4/6" or "  M. Knife (melee)".
    const lines = weapons.slots.map((w, i) => {
      const marker = i === weapons.active ? '>' : ' ';
      const name = i === MELEE_SLOT ? 'M' : String(i + 1);
      let label = '(empty)';
      if (w) label = w.ammo === null ? `${w.name} (melee)` : `${w.name} ${weapons.ammo[i]}/${w.ammo}`;
      return `${marker} ${name}. ${label}`;
    });

    if (current) {
      lines.push(...this.weaponInfo(current, weapons));
    } else {
      lines.push('nothing in hand');
    }
    lines.push(`${weapons.throwable.name} x${weapons.throwableCount}`);
    lines.push('Shift: switch · Space: throw');
    this.weaponText.setText(lines);

    this.updateIcon(current);
  }

  updateIcon(current) {
    // Keep the box glued to the panel's left edge (the panel's width changes).
    const right = this.weaponText.x - this.weaponText.width - ICON_BOX.gap;
    this.iconBox.setX(right);
    this.weaponIcon.setX(right - ICON_BOX.width / 2);

    const key = current?.key ?? null;
    this.iconBox.setVisible(key !== null);
    this.weaponIcon.setVisible(key !== null);
    if (key === this.iconFor) return;

    this.iconFor = key;
    if (!key) return;
    this.weaponIcon.setTexture(iconKey({ type: 'gun', key }));
    this.scene.tweens.add({ targets: this.weaponIcon, scale: { from: 1.4, to: 1 }, duration: 180 });
  }

  // Three lines about the weapon in hand: family and words, damage, range.
  weaponInfo(w, weapons) {
    const words = `${LIST_NAMES[w.wordList]} words`;
    const family = `${WEAPON_CATEGORIES[w.category].name} · ${words}`;

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

    return [family, damage, range];
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