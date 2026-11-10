import Phaser from 'phaser';
import { DECOR } from '../data/hazards.js';
import { groundBelow } from './Terrain.js';

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
    this.critters = [];
    this.tumbleweeds = [];
    if (!this.sky) return;

    this.groundY = this.sky.horizonY ?? mainGroundY(groundLayer);
    this.drawSky();
    if (this.sky.sun) this.drawSun();
    if (this.sky.moon) this.drawMoon();
    if (this.sky.clouds) this.drawClouds();
    (this.sky.ridges ?? []).forEach((r, i) => this.drawRidge(r, i));
    if (this.sky.birds) this.makeBirds();
    if (this.sky.embers) this.makeEmbers();
    if (this.sky.leaves) this.makeLeaves();
    if (this.sky.snow) this.makeSnow();
    if (this.sky.aurora) this.drawAurora();
    if (this.sky.bergs) this.drawBergs();
    if (this.sky.camels) this.makeCaravan();
    if (this.sky.haze) this.makeHaze();
    if (this.sky.bats) this.makeBats();
    if (this.sky.dust) this.makeCaveDust();
    this.tumbleweeds = [];
    this.nextWeedAt = scene.time.now + 1500;
    this.layer = groundLayer;
    this.palette = map.palette ?? {};

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
      else if (o.name === 'pine') this.drawPine(o.x, o.y);
      else if (o.name === 'palm') this.drawPalm(o.x, o.y);
      else if (o.name === 'cactus') this.drawCactus(o.x, o.y);
      else if (o.name === 'fireflies') this.makeFireflies(o);
      else if (o.name === 'cave') this.drawCave(o);
      else if (o.name === 'penguin' || o.name === 'scorpion') this.addCritter(o.name, o.x, o.y);
      else if (o.name === 'coffin') this.drawCoffin(o.x, o.y);
      else if (o.name === 'cobweb') this.drawCobweb(o.x, o.y);
      else if (o.name === 'candles') this.addCandles(o.x, o.y);
      else if (o.name === 'deadtree') this.drawDeadTree(o.x, o.y);
      else if (o.name === 'cross') this.drawCross(o.x, o.y);
      else if (o.name === 'lantern') this.addLantern(o.x, o.y);
      else if (o.name === 'fence') this.drawFence(o);
      else if (o.name === 'fog') this.makeFog(o);
    }
    if (this.critters.length) this.critterGfx = scene.add.graphics().setDepth(3);
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
    const { color, x, y, size = 1 } = this.sky.sun;
    const factor = 0.05;
    const sx = VIEW_W * x;
    const sy = this.placeY(VIEW_H * y, factor);
    for (const [r, a] of [[90, 0.12], [60, 0.2], [38, 1]]) {
      this.scene.add.circle(sx, sy, r * size, color, a).setScrollFactor(factor).setDepth(-99);
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
        if (r.mesa) {
          // Flat-topped mesas with steep sides.
          const period = 260;
          const p = (x % period) / period;
          const tall = 0.55 + 0.35 * Math.sin(Math.floor(x / period) * 7.13);
          return p < 0.55 ? r.height * (1 - tall) : p < 0.62 ? r.height * (1 - tall * (1 - (p - 0.55) / 0.07)) : r.height * 0.92;
        }
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
      // Snow on the peaks: white wherever the ridge is high.
      if (r.snowCaps) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let x = 0; x <= w; x += 3) {
          const y = top(x);
          const cap = Math.max(0, (r.height * 0.5 - y) * 0.45);
          if (cap > 2) ctx.fillRect(x, y, 3, cap);
        }
      }
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
      speed: Phaser.Math.Between(...speed) * (this.sky.birds?.speed ?? 1),
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
      const look = typeof this.sky.birds === 'object' ? this.sky.birds : {};
      const size = look.size ?? 1;
      g.lineStyle(2 * Math.min(1.5, size), look.color ?? 0x1d3557, 0.85);
      for (const b of f.birds) {
        const flap = Math.sin(now / (110 * size) + b.phase) * 5 * size;
        // Vultures (look.speed < 1) circle slowly instead of crossing.
        const circle = look.speed ? Math.sin(now / 2200 + b.phase) * 60 : 0;
        const x = f.x + b.dx + circle;
        const y = f.y + b.dy + Math.sin(now / 900 + b.phase) * 4 + (look.speed ? Math.cos(now / 2200 + b.phase) * 20 : 0);
        g.beginPath();
        g.moveTo(x - 7 * size, y - flap);
        g.lineTo(x, y);
        g.lineTo(x + 7 * size, y - flap);
        g.strokePath();
      }
      // A chirp now and then when a flock is near the middle of the screen.
      if (!look.color && Math.abs(screenX - VIEW_W / 2) < DECOR.birds.chirpPx / 2 && now >= f.nextChirpAt) {
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
    g.fillStyle(this.palette.cave ?? (hell ? 0x1a0808 : 0x2b1d14), 1).fillRect(o.x, o.y, o.width, o.height);
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
    if (this.sky.tumbleweeds) this.updateTumbleweeds(now);
    if (this.aurora) this.aurora.setAlpha(0.35 + Math.sin(now / 2600) * 0.15);
    if (this.critters.length) this.updateCritters(now, dt);
    if (this.caravan) this.updateCaravan(now, dt);
    if (this.bergs) this.updateWhales(now);
    if (this.haze) this.haze.forEach((h, i) => h.setAlpha(0.06 + Math.sin(now / 300 + i * 1.7) * 0.04));
    if (this.flames) for (const f of this.flames) f.setScale(0.85 + Math.sin(now / 70 + f.phase) * 0.15 + Math.random() * 0.08).setAlpha(0.75 + Math.random() * 0.25);
    if (this.bats) this.updateBats(now, dt);
  }

  // ---- Graveyard and Catacombs ----

  drawMoon() {
    const { color, x, y } = this.sky.moon;
    const factor = 0.05;
    const sx = VIEW_W * x;
    const sy = this.placeY(VIEW_H * y, factor);
    for (const [r, a] of [[110, 0.06], [75, 0.12], [48, 1]]) this.scene.add.circle(sx, sy, r, color, a).setScrollFactor(factor).setDepth(-99);
    const g = this.scene.add.graphics().setScrollFactor(factor).setDepth(-99);
    g.fillStyle(0xced4da, 0.8).fillCircle(sx - 14, sy - 8, 9).fillCircle(sx + 12, sy + 10, 6).fillCircle(sx + 4, sy - 18, 4);
  }

  // A stone coffin in a burial niche, lid on.
  drawCoffin(x, y) {
    const g = this.back;
    g.fillStyle(0x4a4540, 1).fillRect(x - 30, y - 22, 60, 22);
    g.fillStyle(0x5e5850, 1).fillRect(x - 33, y - 26, 66, 6);
    g.lineStyle(2, 0x2b2622, 1).strokeRect(x - 30, y - 22, 60, 22);
    g.lineStyle(2, 0x8a8278, 0.8).lineBetween(x - 6, y - 18, x + 6, y - 18).lineBetween(x, y - 22, x, y - 10); // a carved cross
  }

  // Cobwebs in a corner (x, y = the corner; they open toward the middle).
  drawCobweb(x, y) {
    const g = this.back;
    const sx = x < this.world.width / 2 ? 1 : -1;
    g.lineStyle(1, 0xdee2e6, 0.35);
    for (let k = 0; k < 5; k++) {
      const a = (k / 4) * (Math.PI / 2);
      g.lineBetween(x, y, x + sx * Math.cos(a) * 60, y + Math.sin(a) * 60);
    }
    for (let r = 14; r <= 56; r += 14) {
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * (Math.PI / 2);
        const rr = r * (0.92 + (k % 2) * 0.08);
        const px = x + sx * Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
  }

  // Candles, their flames flickering (and a little glow).
  addCandles(x, y) {
    const g = this.back;
    this.flames ??= [];
    for (const [dx, h] of [[-8, 14], [0, 20], [8, 11]]) {
      g.fillStyle(0xe9ecef, 1).fillRect(x + dx - 2.5, y - h, 5, h);
      const glow = this.scene.add.circle(x + dx, y - h - 6, 14, 0xffb703, 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);
      const flame = this.scene.add.ellipse(x + dx, y - h - 4, 5, 9, 0xffd166).setDepth(-5);
      flame.phase = Math.random() * 6;
      glow.phase = Math.random() * 6;
      this.flames.push(flame, glow);
    }
  }

  drawDeadTree(x, y) {
    const g = this.back;
    g.lineStyle(9, 0x1b1b1f, 1).lineBetween(x, y, x - 4, y - 90);
    g.lineStyle(5, 0x1b1b1f, 1).lineBetween(x - 3, y - 55, x - 34, y - 88).lineBetween(x - 2, y - 70, x + 30, y - 104).lineBetween(x - 4, y - 88, x - 12, y - 122);
    g.lineStyle(3, 0x1b1b1f, 1).lineBetween(x - 24, y - 78, x - 40, y - 74).lineBetween(x + 18, y - 92, x + 34, y - 88).lineBetween(x - 9, y - 110, x + 4, y - 124);
  }

  // A wooden grave cross.
  drawCross(x, y) {
    const g = this.back;
    g.fillStyle(0x5c4033, 1).fillRect(x - 3, y - 34, 6, 34).fillRect(x - 12, y - 26, 24, 5);
    g.fillStyle(0x3d2b1f, 1).fillEllipse(x, y, 26, 6); // the grave mound
  }

  // An old lantern on a post, its light flickering.
  addLantern(x, y) {
    const g = this.back;
    g.fillStyle(0x2b2622, 1).fillRect(x - 2, y - 56, 4, 56).fillRect(x - 2, y - 56, 16, 3);
    g.fillStyle(0x343a40, 1).fillRect(x + 8, y - 54, 12, 14);
    this.flames ??= [];
    const glow = this.scene.add.circle(x + 14, y - 47, 40, 0xffb703, 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);
    const flame = this.scene.add.ellipse(x + 14, y - 47, 6, 9, 0xffd166).setDepth(-5);
    flame.phase = Math.random() * 6;
    glow.phase = Math.random() * 6;
    this.flames.push(flame, glow);
  }

  // An iron fence with spiked railings.
  drawFence(o) {
    const g = this.back;
    g.lineStyle(2, 0x212529, 1);
    g.lineBetween(o.x, o.y + 10, o.x + o.width, o.y + 10).lineBetween(o.x, o.y + o.height - 6, o.x + o.width, o.y + o.height - 6);
    for (let x = o.x; x <= o.x + o.width; x += 12) {
      g.lineBetween(x, o.y + o.height, x, o.y);
      g.fillStyle(0x212529, 1).fillTriangle(x - 3, o.y + 2, x + 3, o.y + 2, x, o.y - 5);
    }
  }

  // Low fog creeping along the ground.
  makeFog(o) {
    this.scene.add
      .particles(0, 0, 'hz-dot', {
        x: { min: o.x, max: o.x + o.width },
        y: { min: o.y + o.height * 0.4, max: o.y + o.height },
        lifespan: 7000,
        speedX: { min: 6, max: 18 },
        speedY: { min: -3, max: 3 },
        scale: { start: 2.2, end: 4 },
        alpha: { values: [0, 0.12, 0.12, 0] },
        tint: 0xc8d6e5,
        frequency: 60,
      })
      .setDepth(34);
  }

  // Bats: they flit in jerky zigzags across the night sky.
  makeBats() {
    this.bats = [];
    for (let i = 0; i < 7; i++) {
      this.bats.push({ x: Phaser.Math.Between(0, this.world.width), y: Phaser.Math.Between(300, this.groundY - 250), vx: Phaser.Math.Between(60, 120) * (Math.random() < 0.5 ? -1 : 1), vy: 0, phase: Math.random() * 6, nextTurnAt: 0 });
    }
    this.batGfx = this.scene.add.graphics().setDepth(-4);
  }

  updateBats(now, dt) {
    const g = this.batGfx;
    g.clear();
    g.fillStyle(0x0b0b0f, 1);
    for (const b of this.bats) {
      if (now >= b.nextTurnAt) {
        b.nextTurnAt = now + Phaser.Math.Between(250, 700);
        b.vy = Phaser.Math.Between(-70, 70);
        if (Math.random() < 0.2) b.vx *= -1;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -50) b.x = this.world.width + 40;
      if (b.x > this.world.width + 50) b.x = -40;
      b.y = Phaser.Math.Clamp(b.y, 200, this.groundY - 150);
      const flap = Math.sin(now / 45 + b.phase) * 6;
      g.fillEllipse(b.x, b.y, 6, 5);
      g.fillTriangle(b.x - 2, b.y, b.x - 13, b.y - flap, b.x - 8, b.y + 3);
      g.fillTriangle(b.x + 2, b.y, b.x + 13, b.y - flap, b.x + 8, b.y + 3);
    }
  }

  // Catacombs: dust motes drifting in the dark.
  makeCaveDust() {
    this.scene.add
      .particles(0, 0, 'hz-dot', {
        x: { min: 0, max: VIEW_W },
        y: { min: 0, max: VIEW_H },
        lifespan: 6000,
        speedX: { min: -6, max: 6 },
        speedY: { min: 2, max: 10 },
        scale: { min: 0.05, max: 0.12 },
        alpha: { values: [0, 0.5, 0] },
        tint: 0xd6ccc2,
        frequency: 120,
      })
      .setScrollFactor(0)
      .setDepth(34);
  }

  // ---- Wildlife: penguins (Glacier), scorpions (Desert) ----
  // Each one stands on the exact top of the ground (no jitter) and runs a
  // little routine:
  //   penguin: waddles (sways and bobs with each step, slow), stops to look
  //            around, and when scared flops on its belly and slides away,
  //            slowing down, then gets back up.
  //   scorpion: scuttles in short bursts, freezes, and raises its tail when
  //            scared before scuttling off.
  // They turn back at edges, water, lava and walls. A blast kills any caught
  // in it (feathers / bits); they come back after a while.

  addCritter(kind, x, y) {
    const c = { kind, x, y, home: { x, y }, dir: Math.random() < 0.5 ? -1 : 1, state: 'idle', until: 0, phase: Math.random() * 6, speed: 0, alive: true };
    c.y = this.surfaceAt(x, y) ?? y;
    this.critters.push(c);
  }

  // The exact top of the ground under (x, around y), or null (no ground,
  // or water / lava there).
  surfaceAt(x, y) {
    const layer = this.layer;
    const th = layer.tilemap.tileHeight;
    for (let yy = y - th * 1.5; yy < y + th * 2; yy += th / 4) {
      if (layer.unsafeAt?.(x, yy)) return null;
      const t = layer.getTileAtWorldXY(x, yy);
      if (t && t.collides) return t.pixelY;
    }
    return null;
  }

  // A blast: anything caught in it dies, anything near it panics.
  blast(x, y, radius) {
    const now = this.scene.time.now;
    for (const c of this.critters) {
      if (!c.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y - 8);
      if (d <= radius) this.killCritter(c, now);
      else if (d <= radius * 1.8) this.startle(c, x, now);
    }
    for (const t of this.tumbleweeds) {
      if (t.active && Phaser.Math.Distance.Between(x, y, t.x, t.y) <= radius) this.breakWeed(t);
    }
  }

  scare(x, y, r) {
    this.blast(x, y, r / 1.6);
  }

  startle(c, fromX, now) {
    c.dir = c.x < fromX ? -1 : 1;
    if (c.kind === 'penguin') {
      c.state = 'slide';
      c.speed = DECOR.critters.flee * 1.3;
    } else {
      c.state = 'alarm';
      c.until = now + 350;
    }
  }

  killCritter(c, now) {
    c.alive = false;
    c.backAt = now + DECOR.critters.respawnMs;
    const fx = this.scene.effects;
    const colors = c.kind === 'penguin' ? [0x1b1b1b, 0xffffff, 0xffffff, 0xf4a261] : [0x5c3a21, 0x3d2314];
    for (let i = 0; i < (c.kind === 'penguin' ? 9 : 6); i++) {
      fx?.piece(c.x, c.y - 10, { w: 3, h: c.kind === 'penguin' ? 5 : 3, color: colors[i % colors.length] }, true);
    }
    if (c.kind === 'penguin') fx?.poof?.(c.x, c.y - 12, 0xffffff);
  }

  updateCritters(now, dt) {
    const cfg = DECOR.critters;
    const p = this.scene.player;
    const g = this.critterGfx;
    g.clear();
    for (const c of this.critters) {
      if (!c.alive) {
        if (now >= c.backAt) {
          Object.assign(c, { alive: true, x: c.home.x, y: this.surfaceAt(c.home.x, c.home.y) ?? c.home.y, state: 'idle', until: now + 1000, speed: 0 });
        }
        continue;
      }
      // You coming close scares it (once, not every frame).
      const near = p?.alive && Phaser.Math.Distance.Between(p.x, p.y, c.x, c.y) < cfg.scarePx;
      if (near && c.state !== 'slide' && c.state !== 'flee' && c.state !== 'alarm' && now > (c.calmUntil ?? 0)) {
        this.startle(c, p.x, now);
        c.calmUntil = now + 3000;
      }

      // The routine.
      if (c.kind === 'penguin') this.penguinStep(c, now, dt);
      else this.scorpionStep(c, now, dt);

      // Move along the ground; at an edge, a wall or water: stop and turn.
      if (c.speed > 0) {
        const nx = c.x + c.dir * c.speed * dt;
        const ny = this.surfaceAt(nx + c.dir * 8, c.y);
        if (ny === null || Math.abs(ny - c.y) > 34) {
          c.dir *= -1;
          c.speed = 0;
          c.state = 'idle';
          c.until = now + Phaser.Math.Between(600, 1500);
        } else {
          c.x = nx;
          const y = this.surfaceAt(nx, c.y) ?? c.y;
          c.ofs = (c.ofs ?? 0) + c.y - y; // a step up or down: ease onto it (a little hop)
          c.y = y;
        }
      }
      if (c.ofs) c.ofs = Math.abs(c.ofs) < 1 ? 0 : c.ofs - Math.sign(c.ofs) * Math.min(Math.abs(c.ofs), 160 * dt);
      if (c.kind === 'penguin') this.drawPenguin(g, c, now);
      else this.drawScorpion(g, c, now);
    }
  }

  penguinStep(c, now, dt) {
    const cfg = DECOR.critters;
    if (c.state === 'slide') {
      c.speed = Math.max(0, c.speed - 70 * dt); // glides, slowing down
      if (c.speed < 12) {
        c.state = 'getup';
        c.until = now + 500;
        c.speed = 0;
      }
      return;
    }
    if (now < c.until && c.state !== 'walk') return;
    if (c.state === 'walk') {
      // Each step: a push, then a pause as it rocks onto the other foot.
      c.phase += dt * 7;
      c.speed = cfg.walk * (0.35 + 0.65 * Math.abs(Math.sin(c.phase)));
      if (now >= c.until) {
        c.state = 'idle';
        c.until = now + Phaser.Math.Between(1200, 3500);
        c.speed = 0;
      }
      return;
    }
    // idle / getup finished: walk somewhere, sometimes turning first.
    if (Math.random() < 0.4) c.dir *= -1;
    c.state = 'walk';
    c.until = now + Phaser.Math.Between(1500, 4000);
  }

  scorpionStep(c, now, dt) {
    const cfg = DECOR.critters;
    if (c.state === 'alarm') {
      c.speed = 0;
      if (now >= c.until) {
        c.state = 'flee';
        c.until = now + 900;
      }
      return;
    }
    if (c.state === 'flee' || c.state === 'scuttle') {
      c.phase += dt * 30;
      c.speed = c.state === 'flee' ? cfg.flee * 0.7 : cfg.walk * 1.6;
      if (now >= c.until) {
        c.state = 'idle';
        c.until = now + Phaser.Math.Between(500, 2200);
        c.speed = 0;
      }
      return;
    }
    if (now < c.until) return;
    if (Math.random() < 0.35) c.dir *= -1;
    c.state = 'scuttle';
    c.until = now + Phaser.Math.Between(300, 1000);
  }

  drawPenguin(g, c, now) {
    const x = c.x;
    const y = c.y + (c.ofs ?? 0);
    const d = c.dir;
    if (c.state === 'slide') {
      // On its belly, flippers back, gliding.
      g.fillStyle(0x1b1b1b, 1).fillEllipse(x, y - 6, 28, 11);
      g.fillStyle(0xffffff, 1).fillEllipse(x + d * 2, y - 2, 20, 5);
      g.fillStyle(0x1b1b1b, 1).fillCircle(x + d * 12, y - 8, 5);
      g.fillStyle(0xf4a261, 1).fillTriangle(x + d * 16, y - 9, x + d * 21, y - 8, x + d * 16, y - 6);
      g.fillStyle(0xf4a261, 1).fillEllipse(x - d * 15, y - 5, 6, 3);
      return;
    }
    const walking = c.state === 'walk';
    const sway = walking ? Math.sin(c.phase) * 0.16 : 0;           // rocks side to side
    const bob = walking ? Math.abs(Math.sin(c.phase)) * 1.5 : 0;   // a little lift each step
    const up = c.state === 'getup' ? 6 * Math.max(0, (c.until - now) / 500) : 0;
    const look = !walking && Math.sin(now / 900 + c.phase) > 0.6 ? -d : d; // looks around while standing
    const cx = x + sway * 8;
    const top = y - 24 - bob + up;
    // feet (step in turn)
    g.fillStyle(0xf4a261, 1);
    g.fillEllipse(x - 4 + (walking ? Math.sin(c.phase) * 2 : 0), y - 1, 7, 3);
    g.fillEllipse(x + 4 - (walking ? Math.sin(c.phase) * 2 : 0), y - 1, 7, 3);
    // body and belly
    g.fillStyle(0x1b1b1b, 1).fillEllipse(cx, y - 12 - bob + up / 2, 17, 23 - up);
    g.fillStyle(0xffffff, 1).fillEllipse(cx + look * 2, y - 11 - bob + up / 2, 10, 16 - up);
    // flippers
    g.fillStyle(0x1b1b1b, 1);
    g.fillEllipse(cx - 8, y - 13 - bob, 4, 12).fillEllipse(cx + 8, y - 13 - bob, 4, 12);
    // head, eye, beak
    g.fillCircle(cx + sway * 4, top, 6.5);
    g.fillStyle(0xffffff, 1).fillCircle(cx + sway * 4 + look * 3, top - 1, 1.8);
    g.fillStyle(0xf4a261, 1).fillTriangle(cx + sway * 4 + look * 5, top, cx + sway * 4 + look * 11, top + 1.5, cx + sway * 4 + look * 5, top + 3);
  }

  drawScorpion(g, c, now) {
    const x = c.x;
    const y = c.y + (c.ofs ?? 0);
    const d = c.dir;
    const moving = c.state === 'scuttle' || c.state === 'flee';
    const alarmed = c.state === 'alarm' || c.state === 'flee';
    // legs: four a side, stepping in waves while it moves
    g.lineStyle(1.3, 0x3d2314, 1);
    for (let k = 0; k < 4; k++) {
      const lx = x - 5 + k * 3.5;
      const lift = moving ? Math.sin(c.phase + k * 1.6) * 1.8 : 0;
      g.lineBetween(lx, y - 3, lx - 3, y - lift * (k % 2 ? 1 : -1) * 0.5);
      g.lineBetween(lx, y - 3, lx + 3, y + lift * (k % 2 ? -1 : 1) * 0.5);
    }
    // body
    g.fillStyle(0x5c3a21, 1).fillEllipse(x, y - 4, 14, 6);
    // tail: segments curling over the back, higher when alarmed
    const curl = alarmed ? 1.35 : 1;
    g.fillCircle(x - d * 8, y - 5 * curl, 2.6).fillCircle(x - d * 11, y - 9 * curl, 2.3).fillCircle(x - d * 11, y - 13 * curl, 2.1).fillCircle(x - d * 8, y - 16 * curl, 1.9);
    g.fillStyle(0x3d2314, 1).fillTriangle(x - d * 8, y - 16 * curl, x - d * 4, y - 15 * curl, x - d * 6, y - 12 * curl); // stinger
    // pincers out front (open when alarmed)
    const open = alarmed ? 2 : 0.8;
    g.fillStyle(0x5c3a21, 1).fillCircle(x + d * 9, y - 5 - open, 2.2).fillCircle(x + d * 9, y - 2 + open, 2.2);
  }

  // ---- Desert: a camel caravan on the far dunes ----

  makeCaravan() {
    const cfg = DECOR.camels;
    const factor = 0.16;
    this.caravanFactor = factor;
    this.caravanBase = this.placeY(345, factor);
    this.caravanSpan = VIEW_W + (this.world.width - VIEW_W) * factor;
    // Their own low dune to walk on (between the far and near ridges).
    const dune = this.scene.add.graphics().setScrollFactor(factor).setDepth(-96.5);
    dune.fillStyle(0xe0b36a, 1);
    dune.beginPath();
    dune.moveTo(0, this.caravanBase + 300);
    for (let x = 0; x <= this.caravanSpan; x += 10) dune.lineTo(x, this.duneTop(x));
    dune.lineTo(this.caravanSpan, this.caravanBase + 300);
    dune.closePath();
    dune.fillPath();
    this.caravan = {
      gfx: this.scene.add.graphics().setScrollFactor(factor).setDepth(-96.4),
      x: Phaser.Math.Between(0, this.caravanSpan),
      speed: cfg.speed,
    };
  }

  duneTop(x) {
    return this.caravanBase + Math.sin(x / 210) * 10 + Math.sin(x / 77) * 4;
  }

  updateCaravan(now, dt) {
    const cfg = DECOR.camels;
    const c = this.caravan;
    c.x += c.speed * dt;
    if (c.x - cfg.count * cfg.spacing > this.caravanSpan) c.x = -40;
    const g = c.gfx;
    g.clear();
    g.fillStyle(cfg.color, 0.85);
    g.lineStyle(2, cfg.color, 0.85);
    for (let k = 0; k < cfg.count; k++) {
      const x = c.x - k * cfg.spacing;
      const y = this.duneTop(x) - 2;
      const step = Math.sin(now / 260 + k * 1.3) * 3;
      // legs
      g.lineBetween(x - 8, y - 14, x - 8 + step, y);
      g.lineBetween(x - 4, y - 14, x - 4 - step, y);
      g.lineBetween(x + 8, y - 14, x + 8 - step, y);
      g.lineBetween(x + 12, y - 14, x + 12 + step, y);
      // body, hump, neck and head
      g.fillEllipse(x + 2, y - 18, 30, 12);
      g.fillEllipse(x, y - 25, 14, 10);
      g.lineBetween(x + 16, y - 20, x + 22, y - 32);
      g.fillEllipse(x + 25, y - 33, 9, 5);
      // a rider on the first camel
      if (k === 0) {
        g.fillRect(x - 2, y - 40, 5, 10);
        g.fillCircle(x, y - 43, 3);
      }
    }
  }

  // Heat shimmer: faint bands wavering over the horizon.
  makeHaze() {
    this.haze = [];
    for (let i = 0; i < 3; i++) {
      this.haze.push(this.scene.add.rectangle(0, 380 + i * 26, VIEW_W, 14, 0xfff3e0, 0.06).setOrigin(0, 0).setScrollFactor(0).setDepth(-95));
    }
  }

  // ---- Glacier: icebergs on the far sea, and whales spouting ----

  drawBergs() {
    const factor = 0.12;
    const span = VIEW_W + (this.world.width - VIEW_W) * factor;
    const sea = this.placeY(470, factor);
    const g = this.scene.add.graphics().setScrollFactor(factor).setDepth(-96.5);
    g.fillStyle(0x5e8cad, 1).fillRect(0, sea, span, 400);           // the far sea
    g.fillStyle(0x8fb8d6, 0.6).fillRect(0, sea, span, 3);
    this.bergs = [];
    for (let x = 60; x < span; x += Phaser.Math.Between(140, 280)) {
      const w = Phaser.Math.Between(40, 110);
      const h = Phaser.Math.Between(20, 55);
      g.fillStyle(0xf1faee, 1).fillTriangle(x, sea, x + w, sea, x + w * Phaser.Math.FloatBetween(0.3, 0.7), sea - h);
      g.fillStyle(0xc8d6e5, 1).fillTriangle(x + w * 0.5, sea, x + w, sea, x + w * 0.6, sea - h * 0.6);
      this.bergs.push(x + w + 40);
    }
    this.bergSea = sea;
    this.bergFactor = factor;
    this.nextWhaleAt = this.scene.time.now + 3000;
  }

  updateWhales(now) {
    if (now < this.nextWhaleAt) return;
    this.nextWhaleAt = now + Phaser.Math.Between(...DECOR.whales.everyMs);
    const cam = this.scene.cameras.main;
    const x = cam.scrollX * this.bergFactor + Phaser.Math.Between(100, VIEW_W - 100);
    const back = this.scene.add.ellipse(x, this.bergSea + 2, 40, 10, 0x2b3a55).setScrollFactor(this.bergFactor).setDepth(-96.4);
    this.scene.tweens.add({ targets: back, y: this.bergSea + 10, alpha: 0, delay: 1200, duration: 800, onComplete: () => back.destroy() });
    for (let i = 0; i < 10; i++) {
      const d = this.scene.add.circle(x + 8, this.bergSea - 2, Phaser.Math.Between(2, 4), 0xffffff, 0.9).setScrollFactor(this.bergFactor).setDepth(-96.3);
      this.scene.tweens.add({
        targets: d,
        x: x + 8 + Phaser.Math.Between(-14, 14),
        y: this.bergSea - Phaser.Math.Between(25, 45),
        alpha: 0,
        delay: i * 30,
        duration: 700,
        ease: 'Quad.easeOut',
        onComplete: () => d.destroy(),
      });
    }
  }

  // ---- Glacier ----

  makeSnow() {
    this.scene.add
      .particles(0, 0, 'hz-dot', {
        x: { min: -100, max: VIEW_W + 100 },
        y: -10,
        lifespan: 9000,
        speedX: { min: -25, max: 15 },
        speedY: { min: 35, max: 70 },
        scale: { min: 0.08, max: 0.22 },
        alpha: { start: 0.95, end: 0.6 },
        tint: 0xffffff,
        frequency: 1000 / DECOR.snow.perSecond,
      })
      .setScrollFactor(0)
      .setDepth(34);
  }

  // Northern lights: soft green and teal bands high in the sky.
  drawAurora() {
    const key = `aurora-${this.key}`;
    const w = 1400;
    const h = 260;
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, w, h);
      const ctx = tex.getContext();
      for (const [color, off, amp] of [['rgba(112,224,140,', 0, 40], ['rgba(72,202,228,', 2, 30], ['rgba(157,78,221,', 4, 20]]) {
        for (let x = 0; x < w; x += 2) {
          const y = 90 + Math.sin(x / 140 + off) * amp + Math.sin(x / 47 + off) * 10;
          const grad = ctx.createLinearGradient(0, y - 70, 0, y + 10);
          grad.addColorStop(0, color + '0)');
          grad.addColorStop(0.7, color + '0.55)');
          grad.addColorStop(1, color + '0)');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y - 70, 2, 80);
        }
      }
      tex.refresh();
    }
    this.aurora = this.scene.add.image(-60, this.placeY(10, 0.05), key).setOrigin(0, 0).setScrollFactor(0.05).setDepth(-99).setBlendMode(Phaser.BlendModes.ADD);
  }

  // A snowy pine: dark green tiers with snow on each.
  drawPine(x, y) {
    const g = this.back;
    const h = Phaser.Math.Between(80, 130);
    g.fillStyle(0x582f0e, 1).fillRect(x - 4, y - 18, 8, 18);
    for (let k = 0; k < 4; k++) {
      const ty = y - 14 - k * h * 0.22;
      const tw = (4 - k) * 13;
      g.fillStyle(0x1b4332, 1).fillTriangle(x - tw, ty, x + tw, ty, x, ty - h * 0.36);
      g.fillStyle(0xffffff, 0.95).fillTriangle(x - tw * 0.45, ty - h * 0.2, x + tw * 0.45, ty - h * 0.2, x, ty - h * 0.36);
    }
  }

  // ---- Desert ----

  drawPalm(x, y) {
    const g = this.back;
    const h = Phaser.Math.Between(110, 150);
    const lean = Phaser.Math.Between(-20, 20);
    g.lineStyle(9, 0x8d5a2b, 1);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + lean * 0.5, y - h * 0.5);
    g.lineTo(x + lean, y - h);
    g.strokePath();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.5;
      const tx = x + lean + Math.cos(a) * 55;
      const ty = y - h + Math.sin(a) * 30 + 22;
      g.fillStyle(k % 2 ? 0x2d6a4f : 0x40916c, 1).fillTriangle(x + lean, y - h - 4, x + lean, y - h + 6, tx, ty);
    }
    g.fillStyle(0x6f4518, 1).fillCircle(x + lean - 4, y - h + 6, 5).fillCircle(x + lean + 5, y - h + 7, 5);
  }

  // A saguaro: a trunk and two arms (it pricks: see CACTUS in hazards.js).
  drawCactus(x, y) {
    const g = this.back;
    const green = 0x2d6a4f;
    g.fillStyle(green, 1);
    g.fillRoundedRect(x - 8, y - 54, 16, 54, 8);
    g.fillRoundedRect(x - 22, y - 38, 10, 22, 5);
    g.fillRect(x - 18, y - 22, 12, 8);
    g.fillRoundedRect(x + 12, y - 46, 10, 20, 5);
    g.fillRect(x + 6, y - 30, 10, 8);
    g.lineStyle(1, 0x95d5b2, 0.8);
    for (let k = 0; k < 6; k++) g.lineBetween(x - 4 + (k % 2) * 8, y - 50 + k * 8, x - 7 + (k % 2) * 14, y - 52 + k * 8);
  }

  // A tumbleweed: a loose, tangled ball of dry twigs.
  makeWeedTexture(r) {
    const size = r * 2 + 4;
    const g = this.scene.add.graphics();
    const c = size / 2;
    for (let i = 0; i < 26; i++) {
      const a0 = Math.random() * Math.PI * 2;
      const a1 = a0 + Phaser.Math.FloatBetween(0.6, 2.2);
      const rr = Phaser.Math.FloatBetween(r * 0.3, r);
      g.lineStyle(1.3, i % 3 ? 0xb08968 : 0x7f5539, 0.95);
      g.beginPath();
      g.arc(c + Phaser.Math.FloatBetween(-2, 2), c + Phaser.Math.FloatBetween(-2, 2), rr, a0, a1);
      g.strokePath();
    }
    g.generateTexture('tumbleweed', size, size);
    g.destroy();
  }

  // Caught in a blast: it bursts into twigs.
  breakWeed(t) {
    for (let i = 0; i < 6; i++) this.scene.effects?.piece(t.x, t.y, { w: 5, h: 1.5, color: 0xb08968 }, true);
    t.destroy();
  }

  // Tumbleweeds: dry desert plants rolled along by the wind, hopping over
  // bumps (looks only; a blast bursts them).
  updateTumbleweeds(now) {
    const cfg = DECOR.tumbleweeds;
    this.tumbleweeds = this.tumbleweeds.filter((t) => {
      if (!t.active) return false;
      if (t.y > this.world.height || t.x > this.world.width + 40) {
        t.destroy();
        return false;
      }
      t.body.setVelocityX(t.speed);
      if (t.body.blocked.right || (t.body.blocked.down && Math.random() < 0.02)) t.body.setVelocityY(-Phaser.Math.Between(180, 300));
      t.rotation += t.speed / 900;
      return true;
    });
    if (now < this.nextWeedAt || this.tumbleweeds.length >= cfg.max) return;
    this.nextWeedAt = now + Phaser.Math.Between(...cfg.everyMs);
    if (!this.scene.textures.exists('tumbleweed')) this.makeWeedTexture(cfg.size);
    const t = this.scene.add.image(-20, Phaser.Math.Between(400, this.groundY - 200), 'tumbleweed').setDepth(-2);
    this.scene.physics.add.existing(t);
    t.body.setCircle(cfg.size, t.width / 2 - cfg.size, t.height / 2 - cfg.size);
    t.body.setBounce(0.4);
    t.speed = Phaser.Math.Between(...cfg.speed);
    this.scene.physics.add.collider(t, this.layer);
    this.tumbleweeds.push(t);
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
