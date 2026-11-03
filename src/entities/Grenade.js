import Phaser from 'phaser';

const BLINK_COLOR = 0xff4d6d;
const BURST_COLOR = 0xff9f1c;

// Anything thrown with Space: frag, sticky (also the trip mine), molotov,
// combat axe (config.kind, see THROWABLES in weapons.js).
//   flight 'arc':      lobbed, gravity pulls it down from the start
//   flight 'straight': flies flat (no gravity) until it has gone rangePx,
//                      then drops like anything else
// Bounces off terrain, crates and characters (CollisionSystem), but ignores
// its owner for a moment after the throw. It never decides damage itself;
// it emits events and the thrower's system applies the effects:
//   'explode' (x, y)       frag, sticky: a blast
//   'ignite'  (x, y)       molotov: a patch of fire
//   'strike'  (enemy)      combat axe: hit the first enemy it reached
// opts.targets: who it can hit, strike, or trip on (not the owner).
// opts.rangePx: straight throws: how far before it starts to drop.
export default class Grenade extends Phaser.GameObjects.Arc {
  constructor(scene, x, y, config, groundLayer, worldHeight, owner, opts = {}) {
    super(scene, x, y, config.radius, 0, 360, false, config.color);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(41);

    this.config = config;
    this.kind = config.kind ?? 'frag';
    this.worldHeight = worldHeight;
    this.owner = owner;
    this.targets = opts.targets ?? [];
    this.groundLayer = groundLayer;
    const now = scene.time.now;
    this.explodeAt = now + config.fuseMs;
    this.ignoreOwnerUntil = now + config.ownerIgnoreMs;

    // Straight throws: no gravity until they've gone rangePx.
    this.startX = x;
    this.startY = y;
    this.rangePx = opts.rangePx ?? Infinity;
    this.dropping = config.flight !== 'straight';

    this.planted = false;         // sticky or axe stuck in a wall or the floor
    this.armedAt = Infinity;      // stuck sticky: live (a trip mine) from this time
    this.done = false;

    this.body.setCircle(config.radius);
    this.body.setBounce(config.bounce ?? 0);
    this.body.setMass(config.mass ?? 0.2);
    this.body.setAllowGravity(this.dropping);
    this.body.setCollideWorldBounds(true); // walls and top; no floor (the void)

    this.collider = scene.physics.add.collider(this, groundLayer);
  }

  update() {
    if (!this.active || this.done) return;
    const now = this.scene.time.now;

    // Fell into the void: gone, nothing happens.
    if (this.y > this.worldHeight) {
      this.remove();
      return;
    }

    // Straight throw: start dropping once it has flown its range.
    if (!this.dropping && !this.planted) {
      const flown = Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y);
      if (flown >= this.rangePx) {
        this.dropping = true;
        this.body.setAllowGravity(true);
      }
    }

    if (this.kind === 'axe' && !this.planted) this.rotation += 0.35; // spins in flight

    const b = this.body;
    const hitTerrain = b.enable && (b.blocked.up || b.blocked.down || b.blocked.left || b.blocked.right);
    const enemy = this.touchingEnemy();

    switch (this.kind) {
      case 'sticky':
        // In flight: an enemy sets it off at once; a wall or the floor catches it.
        if (!this.planted) {
          if (enemy) {
            this.explode();
            return;
          }
          if (hitTerrain || b.blocked.down) {
            this.plant();
            this.armedAt = now + this.config.armMs;
          }
          if (now >= this.explodeAt) this.remove();
          return;
        }
        this.updateTrap(now);
        return;
      case 'molotov':
        if (enemy || hitTerrain || !b.touching.none) {
          this.finish('ignite', this.x, this.y);
          return;
        }
        break;
      case 'axe':
        if (!this.planted && enemy) {
          this.finish('strike', enemy);
          return;
        }
        if (!this.planted && hitTerrain) this.plant();
        if (this.planted && now >= this.explodeAt) {
          this.remove();
          return;
        }
        break;
      default:
        if (b.blocked.down) b.velocity.x *= this.config.groundFriction; // frag: roll to a stop
    }

    // Frag: blink, faster near the end of the fuse.
    if (this.kind === 'frag') {
      const timeLeft = this.explodeAt - now;
      const rate = timeLeft < 600 ? 80 : 200;
      this.setFillStyle(Math.floor(now / rate) % 2 ? BLINK_COLOR : this.config.color);
    }

    if (now >= this.explodeAt) {
      if (this.kind === 'molotov') this.finish('ignite', this.x, this.y);
      else if (this.kind === 'axe') this.remove();
      else this.explode();
    }
  }

  // ---- Sticky / axe ----

  // Stop dead against the wall or floor it hit.
  plant() {
    this.planted = true;
    this.body.stop();
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
  }

  // A stuck sticky is a trip mine: once armed it blinks red and goes off
  // when an enemy comes close (walking or flying). Fizzles after fuseMs.
  updateTrap(now) {
    if (now >= this.explodeAt) {
      this.remove();
      return;
    }
    if (now < this.armedAt) return;

    this.setFillStyle(Math.floor(now / 500) % 2 ? BLINK_COLOR : this.config.color);
    const trip = this.targets.some(
      (t) => t.alive && t !== this.owner &&
        Phaser.Geom.Rectangle.Inflate(t.getBounds(), this.config.triggerPx, this.config.triggerPx)
          .contains(this.x, this.y)
    );
    if (trip) this.explode();
  }

  // Set off by a blast nearby (chain reaction), after a short delay.
  setOff(delayMs = 120) {
    if (this.done || this.settingOff) return;
    this.settingOff = true;
    this.scene.time.delayedCall(delayMs, () => {
      if (this.active && !this.done) this.explode();
    });
  }

  // First living target (not the owner) it overlaps, or null.
  touchingEnemy() {
    if (this.planted) return null;
    // Use the physics body's position: it's already moved this frame.
    const x = this.body.enable ? this.body.center.x : this.x;
    const y = this.body.enable ? this.body.center.y : this.y;
    for (const t of this.targets) {
      if (!t.alive || t === this.owner) continue;
      const bounds = t.getBounds();
      const reach = this.config.radius + 4; // a touch counts, even when it bounced off
      Phaser.Geom.Rectangle.Inflate(bounds, reach, reach);
      if (bounds.contains(x, y)) return t;
    }
    return null;
  }

  // ---- Endings ----

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
    this.finish('explode', x, y);
  }

  // Emit the event first (destroy() drops listeners), then go away.
  finish(event, ...args) {
    this.done = true;
    this.emit(event, ...args);
    this.remove();
  }

  remove() {
    this.done = true;
    this.collider.destroy();
    this.destroy();
  }
}