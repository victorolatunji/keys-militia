import Phaser from 'phaser';
import { throwKey } from './CharacterRig.js';
import { THROWN_SIZE } from '../data/bullets.js';

const BLINK_COLOR = 0xff4d6d;

// Anything thrown with Space: frag, sticky (also the trip mine), molotov,
// combat axe, tacticals (config.kind, see THROWABLES in weapons.js).
//   flight 'arc':      lobbed, gravity pulls it down from the start
//   flight 'straight': flies flat (no gravity) until it has gone rangePx,
//                      then drops like anything else
// Bounces off terrain, crates and characters (CollisionSystem), but ignores
// its owner for a moment after the throw. It never decides damage itself;
// it emits events and the thrower's system applies the effects:
//   'explode' (x, y)       frag, sticky: a blast
//   'ignite'  (x, y)       molotov: a patch of fire
//   'strike'  (enemy)      combat axe: hit the first enemy it reached
//   'pop'     (x, y)       tacticals (smoke, flashbang, concussion, EMP,
//                          cryo): goes off on its fuse, effect by config.effect
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

    // Drawn with its throwable art (the same picture as in the hand),
    // tumbling over the hidden hit circle. The Combat Axe falls back to its icon.
    this.spinDir = 1;
    const art = throwKey(config.key);
    if (scene.textures.exists(art)) {
      this.look = scene.add.image(x, y, art).setDepth(41);
      const size = THROWN_SIZE * (this.kind === 'axe' ? 1.4 : 1);
      this.look.setScale(size / Math.max(this.look.width, this.look.height));
    } else if (this.kind === 'axe') {
      this.look = scene.add.image(x, y, 'icon-combatAxe').setScale(0.8).setDepth(41);
    }
    if (this.look) this.setVisible(false);
  }

  // The picture follows the (hidden) circle that does the physics.
  syncLook() {
    if (!this.look) return;
    this.look.setPosition(this.x, this.y).setRotation(this.rotation);
    this.look.setFlipX(this.spinDir < 0);
  }

  // Blinking (frag fuse, armed trip mine, about to blow): the art lights up.
  paint(color) {
    if (!this.look) {
      this.setFillStyle(color);
      return;
    }
    if (color === this.config.color) this.look.clearTint();
    else if (color === 0xffffff) this.look.setTintFill(0xffffff);
    else this.look.setTint(color);
  }

  // Tumbles end over end in the air (the axe fastest), rolls on the ground.
  spin() {
    if (this.planted) return;
    const b = this.body;
    this.spinDir = Math.sign(b.velocity.x) || this.spinDir;
    if (b.blocked.down) this.rotation += (b.velocity.x / (this.config.radius * 60)) * 0.6;
    else this.rotation += (this.kind === 'axe' ? 0.35 : 0.18) * this.spinDir;
  }

  update() {
    if (!this.active || this.done) return;
    const now = this.scene.time.now;

    // Fell into the void: gone, nothing happens.
    if (this.y > this.worldHeight) {
      this.remove();
      return;
    }

    // Tripped or caught in a blast: fast beeping, then boom.
    if (this.settingOff) {
      if (now >= this.blowAt) this.explode();
      else this.paint(Math.floor(now / 60) % 2 ? 0xffffff : BLINK_COLOR);
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

    this.spin();
    this.syncLook();

    const b = this.body;
    const hitTerrain = b.enable && (b.blocked.up || b.blocked.down || b.blocked.left || b.blocked.right);
    const enemy = this.touchingEnemy();

    switch (this.kind) {
      case 'sticky':
        // In flight: an enemy sets it off at once. Anything solid it lands
        // on or hits (floor, wall, ceiling, a crate) catches it.
        if (!this.planted) {
          if (enemy) {
            this.explode();
            return;
          }
          if (hitTerrain || b.touching.down || b.blocked.down) {
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
      this.paint(Math.floor(now / rate) % 2 ? BLINK_COLOR : this.config.color);
    }

    if (now >= this.explodeAt) {
      if (this.kind === 'molotov') this.finish('ignite', this.x, this.y);
      else if (this.kind === 'axe') this.remove();
      else if (this.kind === 'tactical') this.finish('pop', this.x, this.y);
      else this.explode();
    }
  }

  // ---- Sticky / axe ----

  // Stop dead against the wall or floor it hit.
  plant() {
    if (this.kind === 'sticky') this.scene.sfx?.play('stick', this);
    this.planted = true;
    this.body.stop();
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
  }

  // A stuck sticky is a trip mine: once armed it blinks red (with a faint
  // ring showing its trigger zone) and goes off when ANYONE comes within
  // triggerPx: an enemy walking or flying by, or you (that's on you).
  // After it trips it beeps fast for tripDelayMs, so whoever set it off
  // usually gets a step closer (more damage) before it blows.
  updateTrap(now) {
    if (now >= this.explodeAt) {
      this.remove();
      return;
    }
    if (now < this.armedAt) return;

    if (!this.ring) {
      this.ring = this.scene.add
        .circle(this.x, this.y, this.config.triggerPx, BLINK_COLOR, 0.07)
        .setStrokeStyle(1, BLINK_COLOR, 0.35)
        .setDepth(40);
    }
    this.paint(Math.floor(now / 500) % 2 ? BLINK_COLOR : this.config.color);

    const near = (t) => {
      if (!t || !t.alive || !t.body) return false;
      const c = t.body.center;
      return Phaser.Math.Distance.Between(c.x, c.y, this.x, this.y) <= this.config.triggerPx;
    };
    if (this.targets.some(near) || near(this.owner)) this.setOff(this.config.tripDelayMs);
  }

  // Set off by a blast nearby (chain reaction), after a short delay.
  // update() beeps it fast and blows it at blowAt.
  setOff(delayMs = 120) {
    if (this.done || this.settingOff) return;
    this.settingOff = true;
    this.scene.sfx?.play('beep', this);
    this.blowAt = this.scene.time.now + delayMs;
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
    // The look (fire, smoke, debris) and sound come from whoever threw it.
    const { x, y } = this;
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
    this.look?.destroy();
    this.ring?.destroy();
    this.collider.destroy();
    this.destroy();
  }
}
