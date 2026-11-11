import Phaser from 'phaser';
import { SHOT_ART } from '../data/bullets.js';
import { projKey, shotImage } from '../systems/ShotFx.js';

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

    // Drawn with its art (rocket, grenade shell) over the hidden hit circle.
    this.art = SHOT_ART[spec.kind];
    this.look = this.art ? shotImage(scene, projKey(this.art.art), this.art.length, 41) : null;
    if (this.look) {
      this.setVisible(false);
      if (this.art.origin) this.look.setOrigin(...this.art.origin);
      this.look.setRotation(Math.atan2(vy, vx));
      this.syncLook(0);
    }
  }

  // Rockets and shells point the way they fly; bombs tumble.
  syncLook(delta) {
    if (!this.look) return;
    this.look.setPosition(this.x, this.y);
    const v = this.body.velocity;
    if (this.art.tumble) this.look.rotation += (this.art.tumble * delta * (v.x < 0 ? -1 : 1)) / 1000;
    else if (v.x * v.x + v.y * v.y > 400) this.look.setRotation(Math.atan2(v.y, v.x));
  }

  preDestroy() {
    this.look?.destroy();
    super.preDestroy?.();
  }

  update(delta = 16) {
    if (!this.active) return;
    const now = this.scene.time.now;
    this.syncLook(delta);

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

    // From the tail of the round: a soft wisp of smoke (no circles).
    const v = this.body.velocity;
    const len = Math.hypot(v.x, v.y) || 1;
    const back = (this.art?.length ?? 0) * 0.45;
    const x = this.x - (v.x / len) * back;
    const y = this.y - (v.y / len) * back;
    const fx = this.scene.blastFx;
    if (fx) {
      fx.blob(x, y, this.spec.radius * 2.6, this.spec.trailColor, { alpha: 0.5, grow: 2.2, life: 380, rise: 6, depth: 40 });
      return;
    }
    const puff = this.scene.add.circle(x, y, this.spec.radius * 0.8, this.spec.trailColor, 0.6).setDepth(40);
    this.scene.tweens.add({ targets: puff, alpha: 0, scale: 2, duration: 300, onComplete: () => puff.destroy() });
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
