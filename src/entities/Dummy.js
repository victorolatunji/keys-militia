import Phaser from 'phaser';
import WordLabel from '../ui/WordLabel.js';
import { ENEMIES } from '../data/enemies.js';

const HP_WIDTH = 40;
const HP_HEIGHT = 6;
const HP_COLOR = 0x06d6a0;
const HIT_FLASH_MS = 80;

// Stationary practice target. Placed by its feet (Tiled point on a platform).
// Emits 'died' and 'respawn' so other systems can react.
export default class Dummy extends Phaser.GameObjects.Rectangle {
  constructor(scene, feetX, feetY, config = ENEMIES.dummy) {
    super(scene, feetX, feetY - config.height / 2, config.width, config.height, config.color);
    scene.add.existing(this);

    this.config = config;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.alive = true;
    this.word = null;         // current word (null = no word showing)
    this.lastWord = null;     // so a returning target gets a different word
    this.wordExpiresAt = 0;   // scene time when the word refreshes

    this.hpBg = scene.add.rectangle(0, 0, HP_WIDTH + 2, HP_HEIGHT + 2, 0x000000, 0.6);
    this.hpFill = scene.add.rectangle(0, 0, HP_WIDTH, HP_HEIGHT, HP_COLOR).setOrigin(0, 0.5);
    this.label = new WordLabel(scene);
    this.label.setVisible(false);

    this.layout();
  }

  setWord(word) {
    this.word = word;
    if (word) this.lastWord = word;

    this.label.setWord(word ?? '');
    this.label.setVisible(Boolean(word) && this.alive);
    this.layout();
  }

  takeDamage(amount) {
    if (!this.alive) return;

    this.hp = Math.max(0, this.hp - amount);
    this.flash();
    this.layout();

    if (this.hp === 0) this.die();
  }

  flash() {
    this.setFillStyle(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => this.setFillStyle(this.config.color));
  }

  die() {
    this.alive = false;
    this.setWord(null);
    this.setVisible(false);
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);

    this.emit('died', this);
    this.scene.time.delayedCall(this.config.respawnDelay, () => this.respawn());
  }

  respawn() {
    this.hp = this.maxHp;
    this.alive = true;
    this.setVisible(true);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
    this.layout();

    this.emit('respawn', this);
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