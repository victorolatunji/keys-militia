import Phaser from 'phaser';
import { DEATH_DROPS } from '../data/airdrops.js';
import { iconKey } from '../ui/Icons.js';

// An item lying loose on the map: a death drop (pops out when someone dies)
// or a supply drop (falls from the sky, spinning). Shows the item's icon on a
// small dark tag. Lands, then vanishes after a while (blinks first).
// Not solid: characters walk through it. Picked up with the same 1/2/3/4 panel as crates.
export default class Pickup extends Phaser.GameObjects.Rectangle {
  // options: { lifetimeMs, velocity: { x, y }, maxFallSpeed, spin }
  //   no velocity = pop out in a random direction (death drop)
  constructor(scene, x, y, item, groundLayer, worldHeight, options = {}) {
    const look = DEATH_DROPS.look;
    super(scene, x, y, look.width, look.height, look.color, look.alpha);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.icon = scene.add.image(x, y, iconKey(item)).setScale(look.iconScale);
    this.item = item;          // { type, key, count?, ammo? } (setter: updates the icon)
    this.worldHeight = worldHeight;
    this.expiresAt = scene.time.now + (options.lifetimeMs ?? DEATH_DROPS.lifetimeMs);
    this.spin = options.spin ?? 0;
    this.landed = false;

    this.setStrokeStyle(2, look.strokeColor);
    this.body.setBounce(0.3);
    this.body.setCollideWorldBounds(true); // walls and top; no floor (the void)
    if (options.maxFallSpeed) this.body.setMaxVelocityY(options.maxFallSpeed);

    // Death drops pop out in a random direction so several don't stack on one spot.
    const v = options.velocity ?? {
      x: Phaser.Math.Between(-DEATH_DROPS.popSpeedX, DEATH_DROPS.popSpeedX),
      y: -DEATH_DROPS.popSpeedY,
    };
    this.body.setVelocity(v.x, v.y);

    this.collider = scene.physics.add.collider(this, groundLayer);
  }

  // Swapping an item in (PickupSystem) also swaps the picture.
  get item() {
    return this._item;
  }

  set item(item) {
    this._item = item;
    this.icon.setTexture(iconKey(item));
  }

  // Resting on the ground: the pickup panel only shows for settled items.
  get settled() {
    return this.body.blocked.down;
  }

  update(delta) {
    if (!this.active) return;
    const now = this.scene.time.now;

    // Fell into the void, or its time is up.
    if (this.y > this.worldHeight || now >= this.expiresAt) {
      this.remove();
      return;
    }

    if (this.body.blocked.down) {
      // Slide to a stop, and stand up straight on the first landing.
      this.body.velocity.x *= 0.85;
      if (!this.landed && this.rotation !== 0) {
        this.scene.tweens.add({ targets: this, rotation: 0, duration: 150 });
      }
      this.landed = true;
    } else if (!this.landed && this.spin) {
      this.rotation += this.spin * (delta / 1000);
    }

    // Blink near the end so players know it's about to go.
    const timeLeft = this.expiresAt - now;
    if (timeLeft < DEATH_DROPS.blinkBeforeMs) {
      this.setAlpha(Math.floor(now / 150) % 2 ? 0.35 : 1);
    }

    this.syncIcon();
  }

  syncIcon() {
    this.icon.setPosition(this.x, this.y);
    this.icon.setRotation(this.rotation);
    this.icon.setAlpha(this.alpha);
  }

  remove() {
    this.icon.destroy();
    this.collider.destroy();
    this.destroy();
  }
}