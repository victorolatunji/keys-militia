import Phaser from 'phaser';
import { PLAYER } from '../data/player.js';

export default class Player extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y) {
    super(scene, x, y, PLAYER.width, PLAYER.height, PLAYER.color);

    scene.add.existing(this);        // draw it
    scene.physics.add.existing(this); // give it a physics body

    this.spawnPoint = { x, y };
    this.facing = 1; // 1 = right, -1 = left

    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(2000, PLAYER.maxFallSpeed);

    // Small marker so you can see which way the player faces.
    this.eye = scene.add.rectangle(x, y, 8, 8, PLAYER.eyeColor);

    this.cursors = scene.input.keyboard.createCursorKeys();
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  update() {
    const { left, right } = this.cursors;

    if (left.isDown && !right.isDown) {
      this.body.setVelocityX(-PLAYER.runSpeed);
      this.facing = -1;
    } else if (right.isDown && !left.isDown) {
      this.body.setVelocityX(PLAYER.runSpeed);
      this.facing = 1;
    } else {
      this.body.setVelocityX(0);
    }

    this.eye.setPosition(this.x + this.facing * 8, this.y - 12);
  }

  respawn() {
    this.body.reset(this.spawnPoint.x, this.spawnPoint.y); // move + zero velocity
  }
}