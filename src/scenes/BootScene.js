import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Assets get loaded here in later phases.
  }

  create() {
    this.scene.start('Game');
  }
}