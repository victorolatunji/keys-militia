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

    // Typing buffer, bottom center (test display until Phase 2).
    this.typingText = scene.add
      .text(640, 680, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);

    for (const obj of [this.label, this.fuelBg, this.fuelFill, this.typingText]) {
      obj.setScrollFactor(0).setDepth(100);
    }
  }

  update(player, typing) {
    const pct = player.fuel / PLAYER.fuelMax;
    this.fuelFill.scaleX = pct; // origin is left edge, so it shrinks to the left
    this.fuelFill.setFillStyle(pct < 0.25 ? FUEL_LOW_COLOR : FUEL_COLOR);

    if (typing.isTyping) {
      this.typingText.setText(`TYPING › ${typing.buffer}_`).setColor('#ffffff').setVisible(true);
    } else if (typing.buffer) {
      this.typingText.setText(`paused › ${typing.buffer}`).setColor('#8888aa').setVisible(true);
    } else {
      this.typingText.setVisible(false);
    }
  }
}