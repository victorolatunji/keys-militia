import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 20, 'KEYS MILITIA', {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 40, `Phase 0 · Phaser ${Phaser.VERSION}`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#8888aa',
      })
      .setOrigin(0.5);
  }

  update() {
    // Runs every frame. Game logic goes here from Phase 1 on.
  }
}