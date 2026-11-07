import Phaser from 'phaser';
import { DECOR } from '../data/hazards.js';

// Everything behind the action (looks only, no physics), from map.sky in
// maps.js and the Tiled "decor" layer:
//   sky gradient, sun, drifting clouds or smoke, two rows of hills or
//   spires (parallax), birds (Forest), rising embers (Hell),
//   trees and spires on the ground, grass tufts on grass tiles.
// Parallax: an object with scrollFactor 0.3 moves at 30% of the camera's
// speed, so it looks far away. Phaser does this for us per game object.
const VIEW_W = 1280;
const VIEW_H = 720;

export default class BackdropSystem {
  constructor(scene, map, tilemap, groundLayer, world) {
    this.scene = scene;
    this.sky = map.sky;
    this.world = world;
    this.key = map.key;
    this.birds = [];
    this.clouds = [];
    if (!this.sky) return;

    this.groundY = this.sky.horizonY ?? mainGroundY(groundLayer);
    this.drawSky();
    if (this.sky.sun) this.drawSun();
    if (this.sky.clouds) this.drawClouds();
    (this.sky.ridges ?? []).forEach((r, i) => this.drawRidge(r, i));
    if (this.sky.birds) this.makeBirds();
    if (this.sky.embers) this.makeEmbers();
    if (this.sky.leaves) this.makeLeaves();

    // Ground decor, all drawn once into two layers: behind the characters
    // (trees, spires, chains...) and in front of their feet (small rocks).
    this.back = scene.add.graphics().setDepth(-6);
    this.front = scene.add.graphics().setDepth(33);
    const decor = tilemap.getObjectLayer('decor')?.objects ?? [];
    for (const o of decor) {
      if (o.name === 'tree') this.drawTree(o.x, o.y);
      else if (o.name === 'bigtree') this.drawBigTree(o);
      else if (o.name === 'spire') this.drawSpire(o.x, o.y);
      else if (o.name === 'rock') this.drawRock(o.x, o.y);
      else if (o.name === 'mushroom') this.drawMushroom(o.x, o.y);
      else if (o.name === 'bones') this.drawBones(o.x, o.y);
      else if (o.name === 'chain') this.drawChain(o);
      else if (o.name === 'fireflies') this.makeFireflies(o);
      else if (o.name === 'cave') this.drawCave(o);
    }
    if (map.key === 'forest') this.drawGrass(groundLayer);
  }

  // Where an object with this scroll factor must sit so that it shows at
  // screenY when the camera looks at the main ground.
  placeY(screenY, factor) {
    const camY = Phaser.Math.Clamp(this.groundY - VIEW_H / 2, 0, this.world.height - VIEW_H);
    return screenY + camY * factor;
  }

  // ---- Sky ----

  drawSky() {
    const factor = 0.5;
    const key = `sky-${this.key}`;
    const colors = this.sky.colors;
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, 4, 512);
      const ctx = tex.getContext();
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), css(c)));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 512);
      tex.refresh();
    }
    const w = VIEW_W + (this.world.width - VIEW_W) * factor;
    const h = VIEW_H + (this.world.height - VIEW_H) * factor;
    this.scene.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(w, h).setScrollFactor(factor).setDepth(-100);
  }

  drawSun() {
    const { color, x, y } = this.sky.sun;
    const factor = 0.05;
    const sx = VIEW_W * x;
    const sy = this.placeY(VIEW_H * y, factor);
    for (const [r, a] of [[90, 0.12], [60, 0.2], [38, 1]]) {
      this.scene.add.circle(sx, sy, r, color, a).setScrollFactor(factor).setDepth(-99);
    }
  }

  // Soft puffs drifting sideways (Hell: dark smoke).
  drawClouds() {
    const { count, color } = this.sky.clouds;
    const key = `cloud-${this.key}`;
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.add.graphics();
      g.fillStyle(color, 0.85);
      for (const [x, y, r] of [[40, 40, 26], [70, 30, 32], [105, 40, 26], [60, 50, 24], [90, 52, 22]]) g.fillCircle(x, y, r);
      g.generateTexture(key, 140, 80);
      g.destroy();
    }
    const factor = 0.15;
    const span = VIEW_W + (this.world.width - VIEW_W) * factor;
    for (let i = 0; i < count; i++) {
      const c = this.scene.add
        .image(Phaser.Math.Between(0, span), this.placeY(Phaser.Math.Between(30, 300), factor), key)
        .setScale(Phaser.Math.FloatBetween(0.8, 1.8))
        .setAlpha(Phaser.Math.FloatBetween(0.6, 0.95))
        .setScrollFactor(factor)
        .setDepth(-98);
      this.clouds.push({ img: c, speed: Phaser.Math.FloatBetween(4, 12), span });
    }
  }

  // A row of hills (or spires) as one long picture, far away.
  drawRidge(r, i) {
    const key = `ridge-${this.key}-${i}`;
    const w = Math.ceil(VIEW_W + (this.world.width - VIEW_W) * r.factor);
    const fade = 160;
    const h = r.height + fade;
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, w, h);
      const ctx = tex.getContext();
      const top = (x) => {
        if (r.spiky) {
          const period = 90 + (i * 37) % 50;
          const p = (x % period) / period;
          const peak = 0.5 + 0.5 * Math.sin(Math.floor(x / period) * 12.9898 + i);
          return r.height * (1 - peak * (1 - Math.abs(p - 0.5) * 2) * 0.85) * 0.9;
        }
        const n = Math.sin(x / (180 + i * 40)) * 0.5 + Math.sin(x / 67 + i) * 0.25 * r.rough + Math.sin(x / 31) * 0.1 * r.rough;
        return r.height * (0.45 + n * 0.35);
      };
      ctx.fillStyle = css(r.color);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) ctx.lineTo(x, top(x));
      ctx.lineTo(w, r.height);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      // Pine trees along the near ridge.
      if (r.trees) {
        ctx.fillStyle = css(darken(r.color, 0.7));
        for (let x = 10; x < w; x += 14 + ((x * 7) % 23)) {
          const y = top(x);
          const th = 16 + ((x * 13) % 18);
          ctx.beginPath();
          ctx.moveTo(x - th / 3, y + 4);
          ctx.lineTo(x, y - th);
          ctx.lineTo(x + th / 3, y + 4);
          ctx.fill();
        }
      }
      // Fade out at the bottom so the air under the map stays sky.
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createLinearGradient(0, r.height * 0.7, 0, h);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, r.height * 0.7, w, h);
      tex.refresh();
    }
    const screenTop = 230 + i * 70;
    this.scene.add.image(0, this.placeY(screenTop, r.factor), key).setOrigin(0, 0).setScrollFactor(r.factor).setDepth(-97 + i);
  }

  // ---- Birds (Forest) ----

  makeBirds() {
    const { flocks } = DECOR.birds;
    for (let i = 0; i < flocks; i++) this.birds.push(this.makeFlock(Phaser.Math.Between(0, this.world.width)));
  }

  makeFlock(x) {
    const { perFlock, speed } = DECOR.birds;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const flock = {
      x,
      y: Phaser.Math.Between(150, Math.max(200, this.groundY - 350)),
      dir,
      speed: Phaser.Math.Between(...speed),
      gfx: this.scene.add.graphics().setDepth(-90).setScrollFactor(0.8),
      birds: Array.from({ length: Phaser.Math.Between(...perFlock) }, (_, k) => ({
        dx: -dir * k * Phaser.Math.Between(16, 26),
        dy: (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Phaser.Math.Between(8, 14),
        phase: Math.random() * 6,
      })),
      nextChirpAt: 0,
    };
    return flock;
  }

  updateBirds(now, dt) {
    const cam = this.scene.cameras.main;
    for (const [i, f] of this.birds.entries()) {
      f.x += f.dir * f.speed * dt;
      const screenX = f.x - cam.scrollX * 0.8;
      if (screenX < -400 || screenX > VIEW_W + 400) {
        f.gfx.destroy();
        const fresh = this.makeFlock(cam.scrollX * 0.8 + (f.dir > 0 ? -300 : VIEW_W + 300));
        fresh.dir = f.dir;
        this.birds[i] = fresh;
        continue;
      }
      const g = f.gfx;
      g.clear();
      g.lineStyle(2, 0x1d3557, 0.85);
      for (const b of f.birds) {
        const flap = Math.sin(now / 110 + b.phase) * 5;
        const x = f.x + b.dx;
        const y = f.y + b.dy + Math.sin(now / 900 + b.phase) * 4;
        g.beginPath();
        g.moveTo(x - 7, y - flap);
        g.lineTo(x, y);
        g.lineTo(x + 7, y - flap);
        g.strokePath();
      }
      // A chirp now and then when a flock is near the middle of the screen.
      if (Math.abs(screenX - VIEW_W / 2) < DECOR.birds.chirpPx / 2 && now >= f.nextChirpAt) {
        f.nextChirpAt = now + Phaser.Math.Between(2500, 6000);
        this.scene.sfx?.play('chirp', null, { volume: 0.5 });
      }
    }
  }

  // ---- Embers (Hell) ----

  makeEmbers() {
    const { color, perSecond } = DECOR.embers;
    if (!this.scene.textures.exists('hz-dot')) return;
    this.embers = this.scene.add
      .particles(0, 0, 'hz-dot', {
        x: { min: 0, max: VIEW_W },
        y: { min: 0, max: VIEW_H + 100 },
        lifespan: 4000,
        speedY: { min: -60, max: -20 },
        speedX: { min: -15, max: 15 },
        scale: { start: 0.25, end: 0.05 },
        alpha: { start: 0.9, end: 0 },
        tint: color,
        blendMode: 'ADD',
        frequency: 1000 / perSecond,
      })
      .setScrollFactor(0) // drifting across the screen
      .setDepth(-5);
  }

  // ---- Ground decor ----

  drawTree(x, y) {
    const g = this.back;
    const h = Phaser.Math.Between(90, 140);
    g.fillStyle(0x6f4518, 1).fillRect(x - 5, y - h * 0.55, 10, h * 0.55);
    g.fillStyle(0x582f0e, 1).fillRect(x + 1, y - h * 0.55, 4, h * 0.55);
    const greens = [0x1b4332, 0x2d6a4f, 0x40916c, 0x52b788];
    for (let k = 0; k < 7; k++) {
      const r = Phaser.Math.Between(18, 30);
      g.fillStyle(greens[k % greens.length], 1);
      g.fillCircle(x + Phaser.Math.Between(-26, 26), y - h * 0.55 - Phaser.Math.Between(0, h * 0.45), r);
    }
  }

  drawSpire(x, y) {
    const g = this.back;
    const h = Phaser.Math.Between(70, 150);
    const w = Phaser.Math.Between(16, 26);
    g.fillStyle(0x1a0a0a, 1);
    g.fillTriangle(x - w, y, x + w, y, x + Phaser.Math.Between(-6, 6), y - h);
    g.lineStyle(2, 0xff7b00, 0.7);
    g.beginPath();
    g.moveTo(x - 2, y - 4);
    g.lineTo(x + 3, y - h * 0.35);
    g.lineTo(x - 1, y - h * 0.6);
    g.strokePath();
  }

  // The treehouse tree: a tall trunk up to the platform, a big canopy.
  drawBigTree(o) {
    const g = this.back;
    const x = o.x + o.width / 2;
    g.fillStyle(0x6f4518, 1).fillRect(x - 9, o.y, 18, o.height);
    g.fillStyle(0x582f0e, 1).fillRect(x + 2, o.y, 7, o.height);
    for (let k = 0; k < 6; k++) g.fillRect(x - 9 - 6, o.y + 30 + k * 40, 6, 3); // ladder rungs
    const greens = [0x1b4332, 0x2d6a4f, 0x40916c, 0x52b788];
    for (let k = 0; k < 11; k++) {
      g.fillStyle(greens[k % greens.length], 1);
      g.fillCircle(x + Phaser.Math.Between(-90, 90), o.y - Phaser.Math.Between(10, 80), Phaser.Math.Between(26, 40));
    }
  }

  // A small boulder or pebbles at someone's feet (drawn in front).
  drawRock(x, y) {
    const g = this.front;
    const hell = this.key === 'hell';
    const base = hell ? 0x3d2b2b : 0x8d99ae;
    const r = Phaser.Math.Between(7, 13);
    g.fillStyle(darken(base, 0.7), 1).fillEllipse(x, y - r * 0.45, r * 2.2, r * 1.3);
    g.fillStyle(base, 1).fillEllipse(x - 2, y - r * 0.6, r * 1.8, r * 1.0);
    g.fillStyle(0xffffff, hell ? 0.08 : 0.25).fillEllipse(x - r * 0.4, y - r * 0.85, r * 0.7, r * 0.35);
    if (hell) g.lineStyle(1, 0xff7b00, 0.6).lineBetween(x - 3, y - 2, x + 2, y - r * 0.8);
    g.fillStyle(darken(base, 0.8), 1).fillEllipse(x + r * 1.3, y - 3, r * 0.8, r * 0.5);
  }

  drawMushroom(x, y) {
    const g = this.back;
    for (const [dx, s] of [[0, 1], [9, 0.7]]) {
      g.fillStyle(0xf1faee, 1).fillRect(x + dx - 2 * s, y - 9 * s, 4 * s, 9 * s);
      g.fillStyle(0xe63946, 1).fillEllipse(x + dx, y - 10 * s, 14 * s, 8 * s);
      g.fillStyle(0xffffff, 1).fillCircle(x + dx - 3 * s, y - 11 * s, 1.5 * s).fillCircle(x + dx + 3 * s, y - 10 * s, 1.2 * s);
    }
  }

  // Hell: an old skull and bones (cartoon) lying about.
  drawBones(x, y) {
    const g = this.back;
    g.fillStyle(0xe9ecef, 1);
    g.fillCircle(x, y - 7, 7).fillRect(x - 4, y - 3, 8, 4);
    g.fillStyle(0x1a0505, 1).fillCircle(x - 2.5, y - 8, 1.8).fillCircle(x + 2.5, y - 8, 1.8);
    g.lineStyle(3, 0xdee2e6, 1).lineBetween(x + 10, y - 2, x + 26, y - 5).lineBetween(x - 10, y - 1, x - 22, y - 4);
  }

  // The dark back wall of a tunnel (so you don't see sky through rock).
  drawCave(o) {
    const g = this.scene.add.graphics().setDepth(-7);
    const hell = this.key === 'hell';
    g.fillStyle(hell ? 0x1a0808 : 0x2b1d14, 1).fillRect(o.x, o.y, o.width, o.height);
    g.fillStyle(hell ? 0xff5400 : 0x000000, hell ? 0.08 : 0.25);
    for (let x = o.x + 10; x < o.x + o.width; x += 46) g.fillEllipse(x, o.y + o.height * 0.5, 30, o.height * 0.7);
  }

  // A chain hanging a floating rock from the sky.
  drawChain(o) {
    const g = this.back;
    const x = o.x + o.width / 2;
    g.lineStyle(2, 0x495057, 1);
    for (let y = o.y; y < o.y + o.height; y += 10) g.strokeEllipse(x, y + 5, 6, 10);
  }

  // Fireflies drifting in the dark under the Forest.
  makeFireflies(o) {
    const { color, count } = DECOR.fireflies;
    this.flies = this.scene.add
      .particles(0, 0, 'hz-dot', {
        x: { min: o.x, max: o.x + o.width },
        y: { min: o.y, max: o.y + o.height },
        lifespan: 3000,
        speedX: { min: -12, max: 12 },
        speedY: { min: -10, max: 10 },
        scale: { start: 0.18, end: 0.1 },
        alpha: { values: [0, 1, 0.3, 1, 0] },
        tint: color,
        blendMode: 'ADD',
        frequency: 3000 / count,
      })
      .setDepth(-3);
  }

  // Leaves drifting down across the screen (Forest).
  makeLeaves() {
    const { colors, perSecond } = DECOR.leaves;
    if (!this.scene.textures.exists('leaf')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1).fillEllipse(6, 3, 12, 6);
      g.generateTexture('leaf', 12, 6);
      g.destroy();
    }
    this.scene.add
      .particles(0, 0, 'leaf', {
        x: { min: 0, max: VIEW_W },
        y: -10,
        lifespan: 9000,
        speedX: { min: -30, max: 10 },
        speedY: { min: 25, max: 50 },
        rotate: { start: 0, end: 540 },
        scale: { min: 0.6, max: 1 },
        alpha: 0.85,
        tint: colors,
        frequency: 1000 / perSecond,
      })
      .setScrollFactor(0)
      .setDepth(34);
  }

  // Blades of grass (and a few flowers) on every grass tile with sky above.
  drawGrass(layer) {
    const g = this.scene.add.graphics().setDepth(-4);
    layer.forEachTile((t) => {
      if (![1, 8, 9, 10].includes(t.index)) return; // grass tops
      const above = layer.getTileAt(t.x, t.y - 1);
      if (above && above.index > 0) return;
      const x0 = t.pixelX;
      const y0 = t.pixelY + 2;
      for (let k = 0; k < 5; k++) {
        const x = x0 + 3 + k * 6 + Phaser.Math.Between(-2, 2);
        const len = Phaser.Math.Between(4, 9);
        g.lineStyle(2, k % 2 ? 0x40916c : 0x74c69d, 1);
        g.lineBetween(x, y0, x + Phaser.Math.Between(-2, 2), y0 - len);
      }
      if (Math.random() < 0.12) {
        g.fillStyle([0xffd166, 0xffffff, 0xf28482][Phaser.Math.Between(0, 2)], 1);
        g.fillCircle(x0 + Phaser.Math.Between(6, 26), y0 - 7, 2.5);
      }
    });
  }

  update(delta) {
    if (!this.sky) return;
    const now = this.scene.time.now;
    const dt = delta / 1000;
    for (const c of this.clouds) {
      c.img.x += c.speed * dt;
      if (c.img.x > c.span + 150) c.img.x = -150;
    }
    if (this.birds.length) this.updateBirds(now, dt);
  }
}

// The y of the main ground: the first row (from the top) that's at least
// a third solid.
function mainGroundY(layer) {
  const map = layer.tilemap;
  for (let y = 0; y < map.height; y++) {
    let solid = 0;
    for (let x = 0; x < map.width; x++) if (layer.getTileAt(x, y)?.index > 0) solid += 1;
    if (solid > map.width / 3) return y * map.tileHeight;
  }
  return map.heightInPixels / 2;
}

const css = (c) => `#${c.toString(16).padStart(6, '0')}`;
const darken = (c, k) => {
  const col = Phaser.Display.Color.IntegerToColor(c);
  return Phaser.Display.Color.GetColor(col.red * k, col.green * k, col.blue * k);
};
