import Phaser from 'phaser';

const TRAIL_EVERY_MS = 30;

// A launcher round: a rocket (flies straight), a shell (lobbed, explodes on
// impact) or a bomb (lobbed, bounces, explodes on its fuse).
// Every kind also explodes when it touches an enemy. It never hits its owner.
// Emits 'explode' (x, y) so WeaponSystem can apply the blast.
export default class Projectile extends Phaser.GameObjects.Arc {
  // spec: the weapon's projectile settings (see weapons.js, launchers)
  // targets: things it can hit directly (TypingSystem targets)
  constructor(scene, x, y, vx, vy, spec, owner, groundLayer, worldHeight, targets, fuseMs) {
    super(scene, x, y, spec.radius, 0, 360, false, spec.color);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.spec = spec;
    this.owner = owner;
    this.ignoreOwnerUntil = Infinity; // CollisionSystem: never bump the shooter
    this.targets = targets;
    this.worldHeight = worldHeight;
    this.diesAt = scene.time.now + spec.maxLifeMs;
    this.explodeAt = fuseMs ? scene.time.now + fuseMs : Infinity;
    this.nextTrail = 0;

    this.setDepth(41);
    this.body.setCircle(spec.radius);
    this.body.setAllowGravity(spec.gravity);
    this.body.setBounce(spec.bounce ?? 0);
    this.body.setMass(0.2);
    this.body.setCollideWorldBounds(true); // walls and top; no floor (the void)
    this.body.setVelocity(vx, vy);

    this.collider = scene.physics.add.collider(this, groundLayer);
  }

  update() {
    if (!this.active) return;
    const now = this.scene.time.now;

    // Fell into the void: gone, no explosion.
    if (this.y > this.worldHeight) {
      this.remove();
      return;
    }

    this.drawTrail(now);

    const b = this.body;
    const hitSomething = b.blocked.up || b.blocked.down || b.blocked.left || b.blocked.right || !b.touching.none;

    if (
      now >= this.explodeAt ||
      now >= this.diesAt ||
      (this.spec.explodeOnImpact && hitSomething) ||
      this.touchingEnemy()
    ) {
      this.explode();
      return;
    }

    // Bombs roll to a stop on the ground.
    if (b.blocked.down) b.velocity.x *= 0.9;
  }

  // Direct hit on an enemy (or a dummy): explode right there.
  touchingEnemy() {
    for (const t of this.targets) {
      if (!t.alive || t === this.owner) continue;
      const bounds = t.getBounds();
      Phaser.Geom.Rectangle.Inflate(bounds, this.spec.radius, this.spec.radius);
      if (bounds.contains(this.x, this.y)) return true;
    }
    return false;
  }

  // Small fading puffs behind rockets and shells.
  drawTrail(now) {
    if (!this.spec.trailColor || now < this.nextTrail) return;
    this.nextTrail = now + TRAIL_EVERY_MS;

    const puff = this.scene.add
      .circle(this.x, this.y, this.spec.radius * 0.8, this.spec.trailColor, 0.6)
      .setDepth(40);
    this.scene.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => puff.destroy(),
    });
  }

  explode() {
    const { x, y } = this;
    this.emit('explode', x, y); // before remove(): destroy() drops listeners
    this.remove();
  }

  remove() {
    this.collider.destroy();
    this.destroy();
  }
}