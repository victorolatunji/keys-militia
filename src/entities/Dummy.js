import Phaser from 'phaser';
import WordLabel from '../ui/WordLabel.js';
import { ENEMIES } from '../data/enemies.js';

const HP_WIDTH = 40;
const HP_HEIGHT = 6;
const HP_COLOR = 0x06d6a0;

// Stationary practice target. Placed by its feet (Tiled point on a platform).
export default class Dummy extends Phaser.GameObjects.Rectangle {
  constructor(scene, feetX, feetY, config = ENEMIES.dummy) {
    super(scene, feetX, feetY - config.height / 2, config.width, config.height, config.color);
    scene.add.existing(this);

    this.config = config;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.alive = true;
    this.word = null;

    this.hpBg = scene.add.rectangle(0, 0, HP_WIDTH + 2, HP_HEIGHT + 2, 0x000000, 0.6);
    this.hpFill = scene.add.rectangle(0, 0, HP_WIDTH, HP_HEIGHT, HP_COLOR).setOrigin(0, 0.5);
    this.label = new WordLabel(scene);

    this.layout();
  }

  setWord(word) {
    this.word = word;
    this.label.setWord(word ?? '');
    this.label.setVisible(Boolean(word) && this.alive);
    this.layout();
  }

  layout() {
    const top = this.y - this.height / 2;

    this.hpBg.setPosition(this.x, top - 10);
    this.hpFill.setPosition(this.x - HP_WIDTH / 2, top - 10);
    this.hpFill.scaleX = this.hp / this.maxHp;

    this.label.setPosition(this.x, top - 32);
  }

  update() {
    this.layout(); // dummies don't move, but bots will
  }
}