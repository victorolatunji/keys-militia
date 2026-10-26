import Phaser from 'phaser';
import { DEATH_DROPS } from '../data/airdrops.js';

// An item lying loose on the map (dropped when someone dies).
// Pops out, falls, lands, then vanishes after a while (blinks first).
// Not solid: characters walk through it. Picked up with the same 1/2/3 panel as crates.
export default class Pickup extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, item, groundLayer, worldHeight) {
    const look = DEATH_DROPS.look[item.type];
    super(scene, x, y, look.width, look.height, look.color);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.item = item;          // { type, key, count? }
    this.worldHeight = worldHeight;
    this.expiresAt = scene.time.now + DEATH_DROPS.lifetimeMs;

    this.setStrokeStyle(2, look.strokeColor);
    this.body.setBounce(0.3);
    this.body.setCollideWorldBounds(true); // walls and top; no floor (the void)

    // Pop out in a random direction so several drops don't stack on one spot.
    this.body.setVelocity(
      Phaser.Math.Between(-DEATH_DROPS.popSpeedX, DEATH_DROPS.popSpeedX),
      -DEATH_DROPS.popSpeedY
    );

    this.collider = scene.physics.add.collider(this, groundLayer);
  }

  // Resting on the ground: the pickup panel only shows for settled items.
  get settled() {
    return this.body.blocked.down;
  }

  update() {
    if (!this.active) return;
    const now = this.scene.time.now;

    // Fell into the void, or its time is up.
    if (this.y > this.worldHeight || now >= this.expiresAt) {
      this.remove();
      return;
    }

    // Slide to a stop on the ground.
    if (this.body.blocked.down) this.body.velocity.x *= 0.85;

    // Blink near the end so players know it's about to go.
    const timeLeft = this.expiresAt - now;
    if (timeLeft < DEATH_DROPS.blinkBeforeMs) {
      this.setAlpha(Math.floor(now / 150) % 2 ? 0.35 : 1);
    }
  }

  remove() {
    this.collider.destroy();
    this.destroy();
  }
}