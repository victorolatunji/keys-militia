import Phaser from 'phaser';

const BLINK_COLOR = 0xff4d6d;
const BURST_COLOR = 0xff9f1c;

// A thrown grenade: arcs, bounces, rolls, blinks, then explodes.
// Emits 'explode' (x, y) so WeaponSystem can apply damage.
export default class Grenade extends Phaser.GameObjects.Arc {
  constructor(scene, x, y, config, groundLayer, worldHeight) {
    super(scene, x, y, config.radius, 0, 360, false, config.color);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.config = config;
    this.worldHeight = worldHeight;
    this.explodeAt = scene.time.now + config.fuseMs;

    this.body.setCircle(config.radius);
    this.body.setBounce(config.bounce);
    this.body.setCollideWorldBounds(true); // walls and top; no floor (the void)

    this.collider = scene.physics.add.collider(this, groundLayer);
  }

  update() {
    if (!this.active) return;
    const now = this.scene.time.now;

    // Roll to a stop on the ground.
    if (this.body.blocked.down) {
      this.body.velocity.x *= this.config.groundFriction;
    }

    // Blink, faster near the end of the fuse.
    const timeLeft = this.explodeAt - now;
    const rate = timeLeft < 600 ? 80 : 200;
    this.setFillStyle(Math.floor(now / rate) % 2 ? BLINK_COLOR : this.config.color);

    // Fell into the void: gone, no explosion.
    if (this.y > this.worldHeight) {
      this.remove();
      return;
    }

    if (now >= this.explodeAt) this.explode();
  }

  explode() {
    const { x, y } = this;

    const burst = this.scene.add
      .circle(x, y, this.config.blastRadius, BURST_COLOR, 0.45)
      .setDepth(42)
      .setScale(0.2);

    this.scene.tweens.add({
      targets: burst,
      scale: 1,
      alpha: 0,
      duration: 300,
      onComplete: () => burst.destroy(),
    });

    this.scene.cameras.main.shake(150, 0.006);

    this.emit('explode', x, y);
    this.remove();
  }

  remove() {
    this.collider.destroy();
    this.destroy();
  }
}