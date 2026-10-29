import Phaser from 'phaser';
import { hasLineOfSight } from '../systems/LineOfSight.js';

const TEXTURE = 'saw-blade';
const TEETH = 10;
const SPIN = 22;              // radians per second
const CUT_AGAIN_MS = 500;     // the same enemy can be cut again after this
const GRIND_TICK_MS = 100;    // grind damage is dealt in small ticks
const PATTERNS = ['zigzag', 'wave', 'diagonal'];

// The Saw Gun's blade. Flies toward its target with a random weave, bounces
// off walls and keeps homing, cuts any other enemy it passes through, then
// sticks into the target and grinds until its fuse runs out, and explodes.
// Moved by hand (no physics body): each frame it checks tiles and targets.
// Calls hooks.cut(enemy, dmg), hooks.grind(enemy, dmg), hooks.explode(x, y).
export default class Saw extends Phaser.GameObjects.Image {
  // spec: the weapon's `saw` settings. targets: everything it can hit.
  constructor(scene, x, y, target, spec, targets, groundLayer, hooks) {
    Saw.makeTexture(scene, spec);
    super(scene, x, y, TEXTURE);
    scene.add.existing(this);
    this.setDepth(42);

    this.spec = spec;
    this.target = target;
    this.targets = targets;
    this.layer = groundLayer;
    this.hooks = hooks;

    const now = scene.time.now;
    this.bornAt = now;
    this.explodeAt = now + spec.maxFlightMs; // until it bites into something
    this.pattern = Phaser.Utils.Array.GetRandom(PATTERNS);
    this.weaveSide = Math.random() < 0.5 ? -1 : 1;
    this.stuckIn = null;         // the enemy it's grinding
    this.stuckOffset = { x: 0, y: 0 };
    this.bounceUntil = 0;        // flying a bounce, not homing
    this.vx = 0;
    this.vy = 0;
    this.cutAt = new Map();      // enemy -> last time it was cut
    this.grindDue = 0;           // damage waiting for the next tick
    this.nextGrindAt = 0;
  }

  // A round blade with teeth, drawn once into a texture.
  static makeTexture(scene, spec) {
    if (scene.textures.exists(TEXTURE)) return;
    const r = spec.radius;
    const size = r * 2 + 6;
    const c = size / 2;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0x000000, 1);
    g.fillCircle(c, c, r + 1);
    g.fillStyle(spec.color, 1);
    for (let i = 0; i < TEETH; i++) {
      const a = (i / TEETH) * Math.PI * 2;
      g.fillTriangle(
        c + Math.cos(a - 0.25) * r, c + Math.sin(a - 0.25) * r,
        c + Math.cos(a + 0.25) * r, c + Math.sin(a + 0.25) * r,
        c + Math.cos(a) * (r + 3), c + Math.sin(a) * (r + 3)
      );
    }
    g.fillCircle(c, c, r);
    g.fillStyle(0x3d4650, 1);
    g.fillCircle(c, c, r * 0.35);

    g.generateTexture(TEXTURE, size, size);
    g.destroy();
  }

  update(delta) {
    if (!this.active) return;
    const now = this.scene.time.now;
    const dt = delta / 1000;
    this.rotation += SPIN * dt;

    if (now >= this.explodeAt) {
      this.explode();
      return;
    }

    if (this.stuckIn) this.updateGrinding(now);
    else this.updateFlying(now, dt);
  }

  // ---- Flying ----

  updateFlying(now, dt) {
    if (!this.target?.alive) this.target = this.findNewTarget();

    if (now >= this.bounceUntil) this.steer(now);

    // Move, bouncing off tiles one axis at a time.
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    let bounced = false;
    if (this.solid(nx, this.y)) {
      this.vx = -this.vx;
      bounced = true;
    } else {
      this.x = nx;
    }
    if (this.solid(this.x, ny)) {
      this.vy = -this.vy;
      bounced = true;
    } else {
      this.y = ny;
    }
    if (bounced) {
      this.bounceUntil = now + this.spec.bounceMs;
      this.spark();
    }

    // Out of the map: gone.
    const map = this.layer.tilemap;
    if (this.x < -50 || this.x > map.widthInPixels + 50 || this.y > map.heightInPixels) {
      this.destroy();
      return;
    }

    this.cutThrough(now);

    // Reached the target: bite in and start the fuse.
    const t = this.target;
    if (t?.alive && this.touches(t)) this.stickInto(t, now);
  }

  // Head for the target, swerving off the straight line by the weave pattern.
  steer(now) {
    const t = this.target;
    const speed = this.spec.speed;
    if (!t) return; // no target: keep flying the way it was going

    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const fx = dx / dist;
    const fy = dy / dist;

    // Close in: no more weaving, go straight for it.
    const weave = dist < 60 ? 0 : this.weaveAmount(now);
    const px = -fy * weave;
    const py = fx * weave;
    const len = Math.hypot(fx + px, fy + py) || 1;
    this.vx = ((fx + px) / len) * speed;
    this.vy = ((fy + py) / len) * speed;
  }

  // -1..1 sideways push: zigzag (sharp back and forth), wave (smooth),
  // diagonal (holds one side, then snaps to the other).
  weaveAmount(now) {
    const t = (now - this.bornAt) / this.spec.weaveMs;
    const amount = (this.spec.weavePx / this.spec.speed) * 4; // weavePx -> sideways strength
    let w;
    if (this.pattern === 'wave') w = Math.sin(t * Math.PI * 2);
    else if (this.pattern === 'zigzag') w = 1 - 4 * Math.abs((t % 1) - 0.5);
    else w = Math.floor(t) % 2 ? 1 : -1;
    return w * amount * this.weaveSide;
  }

  // Enemies it passes through on the way take a cut.
  cutThrough(now) {
    for (const enemy of this.targets) {
      if (enemy === this.target || !enemy.alive || !this.touches(enemy)) continue;
      if (now - (this.cutAt.get(enemy) ?? -Infinity) < CUT_AGAIN_MS) continue;
      this.cutAt.set(enemy, now);
      this.hooks.cut(enemy, this.spec.cutDamage);
    }
  }

  // Nearest enemy it can see from where it is, or null.
  findNewTarget() {
    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.targets) {
      if (!enemy.alive) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (d < bestDist && hasLineOfSight(this.layer, this.x, this.y, enemy.x, enemy.y)) {
        best = enemy;
        bestDist = d;
      }
    }
    return best;
  }

  // ---- Grinding ----

  stickInto(enemy, now) {
    this.stuckIn = enemy;
    this.stuckOffset = { x: this.x - enemy.x, y: this.y - enemy.y };
    // The fuse lights on the first bite and keeps running after that.
    if (!this.fuseLit) {
      this.fuseLit = true;
      this.explodeAt = now + Phaser.Math.Between(this.spec.fuseMinMs, this.spec.fuseMaxMs);
    }
    this.nextGrindAt = now;
  }

  updateGrinding(now) {
    const enemy = this.stuckIn;
    if (!enemy.alive) {
      // It died under the blade: fly on to the next one (fuse keeps running).
      this.stuckIn = null;
      this.target = this.findNewTarget();
      return;
    }

    this.setPosition(enemy.x + this.stuckOffset.x, enemy.y + this.stuckOffset.y);
    this.x += Phaser.Math.FloatBetween(-1.5, 1.5); // shake while it bites
    this.y += Phaser.Math.FloatBetween(-1.5, 1.5);

    if (now >= this.nextGrindAt) {
      this.nextGrindAt = now + GRIND_TICK_MS;
      this.grindDue += (this.spec.grindDps * GRIND_TICK_MS) / 1000;
      const whole = Math.floor(this.grindDue);
      if (whole > 0) {
        this.grindDue -= whole;
        this.hooks.grind(enemy, whole);
      }
      if (Math.random() < 0.6) this.spark();
    }
  }

  // ---- Helpers ----

  solid(x, y) {
    const tile = this.layer.getTileAtWorldXY(x, y);
    return Boolean(tile && tile.collides);
  }

  touches(enemy) {
    const b = enemy.getBounds();
    Phaser.Geom.Rectangle.Inflate(b, this.spec.radius, this.spec.radius);
    return b.contains(this.x, this.y);
  }

  spark() {
    const s = this.scene.add
      .circle(this.x + Phaser.Math.Between(-6, 6), this.y + Phaser.Math.Between(-6, 6), 2, 0xffd166)
      .setDepth(43);
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      y: s.y - Phaser.Math.Between(6, 16),
      duration: 200,
      onComplete: () => s.destroy(),
    });
  }

  explode() {
    const { x, y } = this;
    this.hooks.explode(x, y);
    this.destroy();
  }
}