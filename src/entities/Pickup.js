import Phaser from 'phaser';
import { DEATH_DROPS } from '../data/airdrops.js';
import { iconKey } from '../ui/Icons.js';
import { itemArtKey, itemName, itemGlow, itemSize } from '../ui/ItemArt.js';
import Cloud from './Cloud.js';

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
    // With art: no tag box, the item's own sprite with a soft glow behind
    // it and its name under it.
    const A = DEATH_DROPS.art;
    this.glow = scene.add.image(x, y, Cloud.puffTexture(scene)).setBlendMode(Phaser.BlendModes.ADD).setDepth(10).setScale(A.glow / 128).setVisible(false);
    this.icon.setDepth(11); // items lie under the characters (12), over the ground
    this.tag = scene.add.text(x, y, '', { fontFamily: 'monospace', fontSize: A.tagSize, color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(11).setVisible(false);
    this.item = item;          // { type, key, count?, ammo? } (setter: updates the picture)
    this.worldHeight = worldHeight;
    this.expiresAt = scene.time.now + (options.lifetimeMs ?? DEATH_DROPS.lifetimeMs);
    this.spin = options.spin ?? 0;
    this.landed = false;

    this.setStrokeStyle(2, look.strokeColor);
    if (this.hasArt) this.isStroked = false;
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
    const art = itemArtKey(this.scene, item);
    this.hasArt = Boolean(art);
    if (art) {
      this.icon.setTexture(art);
      this.icon.setScale(itemSize(item) / Math.max(this.icon.width, this.icon.height));
      this.setFillStyle(0, 0);
      this.isStroked = false;
      this.glow.setTint(itemGlow(item)).setVisible(true);
      this.tag.setText(itemName(item));
    } else {
      this.icon.setTexture(iconKey(item)).setScale(DEATH_DROPS.look.iconScale);
    }
  }

  // The pickup panel is about this one: it lights up (art), or gets an
  // outline (placeholder box).
  setHighlight(on, color) {
    this.highlighted = on;
    if (!this.hasArt) {
      this.setStrokeStyle(2, on ? color : DEATH_DROPS.look.strokeColor);
      return;
    }
    if (on) this.icon.setTint(0xffffff, 0xffffff, 0xfff3b0, 0xfff3b0);
    else this.icon.clearTint();
    this.tag.setColor(on ? '#ffd166' : '#ffffff');
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
    if (!this.hasArt) return;
    const A = DEATH_DROPS.art;
    const t = (Math.sin(this.scene.time.now / A.pulseMs * Math.PI) + 1) / 2;
    const [lo, hi] = A.glowAlpha;
    this.glow.setPosition(this.x, this.y).setAlpha((lo + (hi - lo) * t) * (this.highlighted ? 1.4 : 1) * this.alpha);
    // sitting on the ground (its bottom on the box's bottom), name above it
    const lift = this.landed ? this.height / 2 - this.icon.displayHeight / 2 : 0;
    this.icon.y += lift;
    this.glow.y += lift;
    // its name only when you're right by it (or it's the one the panel is about)
    const p = this.scene.player;
    const near = p?.alive && Math.abs(p.x - this.x) < A.nameNearPx && Math.abs(p.y - this.y) < A.nameNearPx;
    this.tag.setPosition(this.x, this.icon.y - this.icon.displayHeight / 2 - 2).setVisible(this.landed && (near || this.highlighted)).setAlpha(this.alpha);
  }

  remove() {
    this.glow.destroy();
    this.tag.destroy();
    this.icon.destroy();
    this.collider.destroy();
    this.destroy();
  }
}
