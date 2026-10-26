import { PLAYER } from '../data/player.js';

const BAR_WIDTH = 200;
const BAR_HEIGHT = 12;
const FUEL_COLOR = 0x3a86ff;
const FUEL_LOW_COLOR = 0xff4d6d;

// On-screen UI pinned to the camera (scroll factor 0).
export default class Hud {
  constructor(scene) {
    const x = 16;
    const y = 16;

    this.label = scene.add.text(x, y - 1, 'FUEL', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    });

    this.fuelBg = scene.add
      .rectangle(x + 48, y, BAR_WIDTH + 4, BAR_HEIGHT + 4, 0x000000, 0.5)
      .setOrigin(0, 0);

    this.fuelFill = scene.add
      .rectangle(x + 50, y + 2, BAR_WIDTH, BAR_HEIGHT, FUEL_COLOR)
      .setOrigin(0, 0);

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

    // State tag, bottom center: TYPING, JAMMED or SWITCHING.
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

    for (const obj of [this.label, this.fuelBg, this.fuelFill, this.weaponText, this.typingTag]) {
      obj.setScrollFactor(0).setDepth(100);
    }
  }

  update(player, typing, weapons) {
    const pct = player.fuel / PLAYER.fuelMax;
    this.fuelFill.scaleX = pct; // origin is left edge, so it shrinks to the left
    this.fuelFill.setFillStyle(pct < 0.25 ? FUEL_LOW_COLOR : FUEL_COLOR);

    this.updateWeapons(weapons);
    this.updateTag(typing);
  }

  updateWeapons(weapons) {
    const gun = weapons.current;
    const lines = weapons.guns.map(
      (g, i) => `${i === weapons.active ? '>' : ' '} ${i + 1}. ${g ? g.name : '(empty)'}`
    );
    lines.push(`dmg ${gun.damage} · ${gun.wordList} words`);
    lines.push('Shift: switch');
    this.weaponText.setText(lines);
  }

  updateTag(typing) {
    const reason = typing.blockedReason;

    if (reason === 'jam') {
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