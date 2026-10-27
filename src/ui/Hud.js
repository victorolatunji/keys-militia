import { PLAYER } from '../data/player.js';
import { MELEE_SLOT } from '../systems/WeaponSystem.js';
import { WEAPON_CATEGORIES } from '../data/weapons.js';

const BAR_WIDTH = 200;
const BAR_HEIGHT = 12;
const HP_COLOR = 0x06d6a0;
const FUEL_COLOR = 0x3a86ff;
const LOW_COLOR = 0xff4d6d;
const LIST_NAMES = { short: 'short', medium: 'medium', long: 'long', extraLong: 'extra-long' };

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

    for (const obj of [this.weaponText, this.typingTag]) {
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
  }

  // Three lines about the weapon in hand: family and words, damage, range.
  weaponInfo(w, weapons) {
    const needed = w.wordsPerShot ?? 1;
    const words = `${LIST_NAMES[w.wordList]} words${needed > 1 ? ` x${needed}` : ''}`;
    const family = `${WEAPON_CATEGORIES[w.category].name} · ${words}`;

    const hits = w.hits ?? 1;
    let damage = `dmg ${w.damage}`;
    if (w.projectile) {
      const count = w.projectile.count ?? 1;
      damage += count > 1 ? ` in ${count} bombs` : ' splash';
    } else if (hits > 1) {
      damage += w.hitDelayMs ? ` in ${hits} hits` : ` in ${hits} pellets`;
    }

    let range;
    if (w.blast) range = `blast ${w.blast.blastRadius}px · can hurt you`;
    else if (w.category === 'melee') range = `reach ${w.reach}px: get close`;
    else if (needed > 1) range = `spin ${weapons.spinCount}/${needed} · then burst`;
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
    } else if (reason === 'switch') {
      this.typingTag.setText('SWITCHING').setColor('#ffd166').setVisible(true);
    } else if (typing.isTyping) {
      this.typingTag.setText('TYPING').setColor('#ffffff').setVisible(true);
    } else {
      this.typingTag.setVisible(false);
    }
  }
}