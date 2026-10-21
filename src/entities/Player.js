import Phaser from 'phaser';
import { PLAYER } from '../data/player.js';

export default class Player extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y) {
    super(scene, x, y, PLAYER.width, PLAYER.height, PLAYER.color);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.spawnPoint = { x, y };
    this.facing = 1;          // 1 = right, -1 = left
    this.fuel = PLAYER.fuelMax;
    this.thrusting = false;

    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(2000, PLAYER.maxFallSpeed);

    // Placeholder visuals
    this.flame = scene.add.rectangle(x, y, 10, 14, PLAYER.flameColor).setVisible(false);
    this.eye = scene.add.rectangle(x, y, 8, 8, PLAYER.eyeColor);

    this.cursors = scene.input.keyboard.createCursorKeys();
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(delta) {
    const dt = delta / 1000;
    const { left, right, up, down } = this.cursors;

    this.updateHorizontal(left, right);
    this.updateJetpack(up, down, dt);
    this.updateVisuals();
  }

  updateHorizontal(left, right) {
    const speed = this.onGround ? PLAYER.runSpeed : PLAYER.airSpeed;

    if (left.isDown && !right.isDown) {
      this.body.setVelocityX(-speed);
      this.facing = -1;
    } else if (right.isDown && !left.isDown) {
      this.body.setVelocityX(speed);
      this.facing = 1;
    } else {
      this.body.setVelocityX(0);
    }
  }

  updateJetpack(up, down, dt) {
    this.thrusting = up.isDown && this.fuel > 0;

    if (this.thrusting) {
      this.body.setAccelerationY(-PLAYER.jetThrust);
      this.fuel = Math.max(0, this.fuel - PLAYER.fuelDrain * dt);
    } else if (down.isDown && !this.onGround) {
      this.body.setAccelerationY(PLAYER.descendBoost);
    } else {
      this.body.setAccelerationY(0);
    }

    // Cap upward speed so the jetpack feels controlled.
    if (this.body.velocity.y < -PLAYER.maxRiseSpeed) {
      this.body.setVelocityY(-PLAYER.maxRiseSpeed);
    }

    // Fuel refills only on the ground.
    if (this.onGround && !this.thrusting) {
      this.fuel = Math.min(PLAYER.fuelMax, this.fuel + PLAYER.fuelRefill * dt);
    }
  }

  updateVisuals() {
    this.eye.setPosition(this.x + this.facing * 8, this.y - 12);

    // Flame comes out of the back, flickers while thrusting.
    this.flame.setVisible(this.thrusting);
    if (this.thrusting) {
      this.flame.setPosition(this.x - this.facing * 10, this.y + 30);
      this.flame.height = Phaser.Math.Between(10, 18);
    }
  }

  respawn() {
    this.body.reset(this.spawnPoint.x, this.spawnPoint.y); // move + zero velocity
    this.body.setAccelerationY(0);
    this.fuel = PLAYER.fuelMax;
  }
}