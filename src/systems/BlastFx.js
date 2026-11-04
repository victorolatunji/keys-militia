import Phaser from 'phaser';
import Cloud from '../entities/Cloud.js';
import { groundBelow } from './Terrain.js';
import { BLAST_FX, CLOUD_VISION } from '../data/effects.js';

const DEPTH = 44;

// What explosions and tactical grenades look like when they go off, and
// heat vision on characters inside a cloud. Looks only, no damage.
// No hard shapes: everything is built from soft puffs (the clouds' blob
// texture), sparks, flying debris and scorch, so a bang looks like a bang.
// Each throwable has its own look (BLAST_FX in effects.js).
export default class BlastFx {
  constructor(scene, groundLayer, effects) {
    this.scene = scene;
    this.layer = groundLayer;
    this.effects = effects; // for flying debris pieces
    this.puff = Cloud.puffTexture(scene);
    this.heat = new Map();  // character -> heat-vision overlay image
  }

  // ---- Small builders ----

  // A soft blob that grows, drifts and fades. add: glowing (fire, light).
  blob(x, y, size, color, { alpha = 0.9, grow = 1.8, life = 500, rise = 0, dx = 0, add = false, depth = DEPTH } = {}) {
    const img = this.scene.add
      .image(x, y, this.puff)
      .setTint(color)
      .setAlpha(alpha)
      .setDepth(depth)
      .setScale(size / 128)
      .setRotation(Math.random() * Math.PI * 2);
    if (add) img.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: img,
      x: x + dx,
      y: y - rise,
      scale: (size / 128) * grow,
      alpha: 0,
      duration: life,
      ease: 'Cubic.easeOut',
      onComplete: () => img.destroy(),
    });
    return img;
  }

  // Bright streaks flying out (sparks, embers, ice glints).
  streaks(x, y, count, colors, speed, life, { len = [4, 10], width = 2, gravity = 0, add = true } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Phaser.Math.Between(speed[0], speed[1]);
      const s = this.scene.add
        .rectangle(x, y, Phaser.Math.Between(len[0], len[1]), width, Phaser.Utils.Array.GetRandom(colors))
        .setRotation(a)
        .setDepth(DEPTH + 1);
      if (add) s.setBlendMode(Phaser.BlendModes.ADD);
      const t = life / 1000;
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * v * t,
        y: y + Math.sin(a) * v * t + 0.5 * gravity * t * t,
        alpha: 0,
        scaleX: 0.3,
        duration: life * Phaser.Math.FloatBetween(0.6, 1.1),
        onComplete: () => s.destroy(),
      });
    }
  }

  // Dark scorch (or frost) on the ground under a blast: a few flattened
  // soft blobs, so it's a smudge, not a shape. Fades slowly.
  groundMark(x, y, width, color, alpha, lifeMs) {
    const below = groundBelow(this.layer, x, y);
    if (below === null || below > 90) return;
    const tile = this.layer.tilemap.tileHeight;
    const top = Math.floor((y + below) / tile) * tile;
    for (let i = 0; i < 4; i++) {
      const img = this.scene.add
        .image(x + Phaser.Math.Between(-width / 3, width / 3), top + 2, this.puff)
        .setTint(color)
        .setAlpha(alpha)
        .setDepth(3)
        .setScale((width * Phaser.Math.FloatBetween(0.5, 0.9)) / 128, (width * 0.18) / 128);
      this.scene.tweens.add({ targets: img, alpha: 0, delay: lifeMs * 0.7, duration: lifeMs * 0.3, onComplete: () => img.destroy() });
    }
    return top;
  }

  // ---- Explosions ----

  // style: 'frag', 'sticky', 'rocket' or 'bomb' (see BLAST_FX).
  explosion(x, y, radius, style = 'frag') {
    const fx = BLAST_FX[style] ?? BLAST_FX.frag;
    const k = (radius / 120) * fx.size;

    // A white-hot flash at the heart of it.
    this.blob(x, y, 90 * k, 0xfff3c4, { alpha: 1, grow: 1.6, life: 140, add: true, depth: DEPTH + 2 });

    // Fireballs rolling out and up (glowing).
    for (let i = 0; i < fx.fireballs; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.35;
      this.blob(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, Phaser.Math.Between(40, 75) * k,
        Phaser.Utils.Array.GetRandom(fx.fireColors),
        { alpha: 0.95, grow: 1.9, life: Phaser.Math.Between(300, 520), rise: Phaser.Math.Between(10, 40), dx: Math.cos(a) * 25, add: true });
    }

    // Thick smoke left behind, rising slowly.
    for (let i = 0; i < fx.smoke; i++) {
      const delay = Phaser.Math.Between(60, 200);
      this.scene.time.delayedCall(delay, () => {
        this.blob(x + Phaser.Math.Between(-radius * 0.35, radius * 0.35), y + Phaser.Math.Between(-20, 10),
          Phaser.Math.Between(50, 85) * k, Phaser.Utils.Array.GetRandom(fx.smokeColors),
          { alpha: 0.75, grow: 2.2, life: Phaser.Math.Between(1400, 2200), rise: Phaser.Math.Between(40, 90), dx: Phaser.Math.Between(-20, 20) });
      });
    }

    // Sparks and burning bits flying out.
    this.streaks(x, y, fx.sparks, [0xffd166, 0xff9f1c, 0xffffff], [200, 520], 380, { gravity: 600 });

    // Dirt and shrapnel thrown about (they bounce on the ground).
    for (let i = 0; i < fx.debris; i++) {
      const size = Phaser.Math.Between(3, 6);
      this.effects.piece(x, y, { w: size, h: size, color: Phaser.Utils.Array.GetRandom(fx.debrisColors) }, true);
    }

    // Dust kicked up along the ground, and a scorch mark.
    const top = this.groundMark(x, y, radius * 1.1, 0x1b1410, 0.75, fx.scorchMs);
    if (top !== undefined && top - y < 60) {
      for (const dir of [-1, 1]) {
        this.blob(x + dir * 20, top - 8, 45 * k, 0x8d7b68, { alpha: 0.6, grow: 2, life: 900, dx: dir * radius * 0.9, rise: 10 });
      }
    }

    this.scene.cameras.main.shake(fx.shakeMs, fx.shake);
  }

  // ---- Tactical grenades: each its own look ----

  tactical(x, y, effect, radius) {
    switch (effect) {
      case 'flash':
        return this.flashbang(x, y, radius);
      case 'concussion':
        return this.concussion(x, y, radius);
      case 'emp':
        return this.emp(x, y, radius);
      case 'cryo':
        return this.cryo(x, y, radius);
      default:
        return null;
    }
  }

  // Flashbang: a blinding white star and glitter, a wisp of smoke.
  flashbang(x, y, radius) {
    this.blob(x, y, 260, 0xffffff, { alpha: 1, grow: 1.4, life: 260, add: true, depth: DEPTH + 3 });
    this.blob(x, y, 120, 0xfffbe6, { alpha: 1, grow: 1.2, life: 450, add: true, depth: DEPTH + 3 });
    // Rays: long thin streaks of light.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      const ray = this.scene.add
        .rectangle(x, y, radius * Phaser.Math.FloatBetween(0.6, 1.1), 3, 0xffffff)
        .setOrigin(0, 0.5)
        .setRotation(a)
        .setDepth(DEPTH + 3)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: ray, alpha: 0, scaleY: 0.2, duration: 220, onComplete: () => ray.destroy() });
    }
    this.streaks(x, y, 18, [0xffffff, 0xfff3b0], [100, 320], 500, { len: [2, 4], gravity: 200 });
    this.blob(x, y - 10, 50, 0xced4da, { alpha: 0.5, grow: 2, life: 1400, rise: 50 });
    this.scene.cameras.main.shake(120, 0.004);
  }

  // Concussion: no fire, a hard shockwave of dust and air thrown outward.
  concussion(x, y, radius) {
    this.blob(x, y, 70, 0xffffff, { alpha: 0.5, grow: 2.5, life: 180, add: true });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * Phaser.Math.FloatBetween(0.5, 0.9);
      this.blob(x, y, Phaser.Math.Between(30, 55), Phaser.Utils.Array.GetRandom([0xa89f91, 0x8d7b68, 0xced4da]),
        { alpha: 0.6, grow: 2.2, life: Phaser.Math.Between(600, 1000), dx: Math.cos(a) * r, rise: -Math.sin(a) * r * 0.5 });
    }
    this.groundMark(x, y, radius * 0.8, 0x4a3f35, 0.35, 4000);
    for (let i = 0; i < 6; i++) {
      const size = Phaser.Math.Between(2, 4);
      this.effects.piece(x, y, { w: size, h: size, color: 0x6c584c }, true);
    }
    this.scene.cameras.main.shake(260, 0.012);
  }

  // EMP: jagged lightning crawling out, blue glow, crackling sparks.
  emp(x, y, radius) {
    this.blob(x, y, 160, 0x4cc9f0, { alpha: 0.8, grow: 1.5, life: 350, add: true });
    const g = this.scene.add.graphics().setDepth(DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD);
    const draw = () => {
      g.clear();
      for (let b = 0; b < 7; b++) {
        const a = Math.random() * Math.PI * 2;
        const len = radius * Phaser.Math.FloatBetween(0.5, 1);
        g.lineStyle(Phaser.Math.Between(1, 3), Phaser.Utils.Array.GetRandom([0x4cc9f0, 0xbde0fe, 0xffffff]), 1);
        g.beginPath();
        g.moveTo(x, y);
        let px = x;
        let py = y;
        const steps = 7;
        for (let s = 1; s <= steps; s++) {
          const d = (len * s) / steps;
          const jitter = Phaser.Math.Between(-18, 18);
          px = x + Math.cos(a) * d - Math.sin(a) * jitter;
          py = y + Math.sin(a) * d + Math.cos(a) * jitter;
          g.lineTo(px, py);
        }
        g.strokePath();
      }
    };
    // Re-draw the bolts a few times so they flicker and crawl.
    draw();
    let n = 0;
    const timer = this.scene.time.addEvent({
      delay: 60,
      repeat: 5,
      callback: () => {
        n += 1;
        if (n < 5) draw();
        else {
          g.destroy();
          timer.remove();
        }
      },
    });
    this.streaks(x, y, 20, [0x4cc9f0, 0xffffff], [150, 420], 300, { len: [3, 7] });
    this.scene.cameras.main.shake(140, 0.004);
  }

  // Cryo: a burst of icy mist, shards flying and frost on the ground.
  cryo(x, y, radius) {
    this.blob(x, y, 110, 0xe0fbfc, { alpha: 0.9, grow: 1.6, life: 300, add: true });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * Phaser.Math.FloatBetween(0.2, 0.7);
      this.blob(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.2, Phaser.Math.Between(40, 70),
        Phaser.Utils.Array.GetRandom([0xe0fbfc, 0xa8dadc, 0xcaf0f8]),
        { alpha: 0.7, grow: 2, life: Phaser.Math.Between(1200, 1900), dx: Math.cos(a) * r, rise: 15 });
    }
    // Ice shards: little pale slivers that fly and fall.
    for (let i = 0; i < 10; i++) {
      this.effects.piece(x, y, { w: 3, h: Phaser.Math.Between(6, 10), color: Phaser.Utils.Array.GetRandom([0xcaf0f8, 0xffffff, 0x90e0ef]) }, false);
    }
    this.streaks(x, y, 12, [0xffffff, 0xcaf0f8], [120, 300], 450, { len: [2, 5] });
    this.groundMark(x, y, radius, 0xcaf0f8, 0.55, 6000);
    this.scene.cameras.main.shake(100, 0.003);
  }

  // ---- Seen through a cloud ----

  // A character inside a cloud keeps its exact shape but shows as a
  // see-through glowing silhouette over the cloud (night-vision style).
  // kind: 'smoke', 'gas' or null (back to normal). Colors in CLOUD_VISION.
  setHeat(target, kind) {
    let mark = this.heat.get(target);
    if (!kind || !target.alive) {
      if (mark) {
        mark.shape.destroy();
        mark.lines?.destroy();
        this.heat.delete(target);
      }
      return;
    }
    const look = CLOUD_VISION[kind];
    if (!mark || mark.kind !== kind) {
      if (mark) {
        mark.shape.destroy();
        mark.lines?.destroy();
      }
      const shape = this.scene.add
        .rectangle(target.x, target.y, target.width, target.height, look.fill, look.fillAlpha)
        .setStrokeStyle(look.edgeWidth, look.edge, 0.95)
        .setDepth(72); // over the clouds (normal blend: stays readable over pale smoke)
      const lines = look.scanlines ? this.scene.add.graphics().setDepth(72).setBlendMode(Phaser.BlendModes.ADD) : null;
      mark = { kind, shape, lines };
      this.heat.set(target, mark);
    }

    // Follow the body exactly (size too: drones, dogs and mutants differ).
    const now = this.scene.time.now;
    const shimmer = 1 - look.flicker + Math.random() * look.flicker;
    mark.shape.setPosition(target.x, target.y).setSize(target.width, target.height);
    mark.shape.geom.setSize(target.width, target.height);
    mark.shape.setOrigin(0.5).setAlpha(shimmer);
    if (mark.lines) {
      const g = mark.lines.clear();
      const left = target.x - target.width / 2;
      const top = target.y - target.height / 2;
      const roll = Math.floor(now / 60) % 4; // lines crawl down slowly
      g.fillStyle(look.edge, 0.35 * shimmer);
      for (let y = top + roll; y < top + target.height; y += 4) g.fillRect(left, y, target.width, 1);
      // the eye still shows (which way it's facing)
      g.fillStyle(0xffffff, 0.9 * shimmer);
      g.fillRect(target.x + (target.facing ?? 1) * 8 - 3, top + 10, 6, 6);
    }
  }
}