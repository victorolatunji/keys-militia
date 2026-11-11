import { gravityK, fallScale } from './Gravity.js';
import Phaser from 'phaser';
import { isSolid } from './Terrain.js';
import { TILE_FAMILY } from '../data/maps.js';
import {

  GORE,
  GORE_LEVELS,
  FAMILY_MATERIAL,
  MATERIALS,
  HIT_SPRAY,
  GIBS,
  SPARKS,
} from '../data/effects.js';

const RIG_PIECE_MS = 4500; // a body's parts lie where they fell this long

const GRAVITY = 900;      // px/s² for drops and pieces (close to the world's)
const MAX_DROPS = 300;    // drops in the air at once
const DEPTH = 43;         // over characters, under words and the HUD
const SPLAT_DEPTH = 2;    // on the ground, under characters

// Blood, sparks, splats and gibs. Characters call hit() from takeDamage()
// and death() from kill()/die(); everything here is looks only (no damage).
// Drops and pieces are plain shapes moved by hand (cheap, and they bounce
// on the tile map without physics bodies).
// Gore level (off / cartoon / full): F2 cycles it, remembered in this browser.
export default class EffectsSystem {
  constructor(scene, groundLayer) {
    this.scene = scene;
    this.layer = groundLayer;
    this.drops = [];   // { obj, vx, vy, until, color, splat }
    this.pieces = [];  // gibs: { obj, vx, vy, spin, until, trailAt, color }
    this.splats = [];
    this.gore = this.loadGore();

    const kb = scene.input.keyboard;
    const toggle = (event) => {
      event.preventDefault?.();
      this.cycleGore();
    };
    kb.on(`keydown-${GORE.toggleKey}`, toggle);
    scene.events.once('shutdown', () => kb.off(`keydown-${GORE.toggleKey}`, toggle));
  }

  get level() {
    return GORE_LEVELS[this.gore];
  }

  // ---- Gore setting ----

  loadGore() {
    try {
      const saved = window.localStorage.getItem(GORE.storageKey);
      if (GORE.levels.includes(saved)) return saved;
    } catch {
      // storage blocked (private window): use the default
    }
    return GORE.default;
  }

  cycleGore() {
    const i = GORE.levels.indexOf(this.gore);
    this.gore = GORE.levels[(i + 1) % GORE.levels.length];
    try {
      window.localStorage.setItem(GORE.storageKey, this.gore);
    } catch {
      // not saved, still works for this session
    }
    if (this.gore === 'off') this.clearBlood();
    this.notice(`Gore: ${this.gore.charAt(0).toUpperCase()}${this.gore.slice(1)}  (F2)`);
  }

  notice(text) {
    this.noticeText?.destroy();
    const t = this.scene.add
      .text(640, 90, text, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(110);
    this.noticeText = t;
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 500, onComplete: () => t.destroy() });
  }

  // ---- What a character is made of ----

  material(target) {
    if (target === this.scene.player) return MATERIALS.flesh;
    const c = target.config ?? {};
    const key = c.material ?? FAMILY_MATERIAL[c.family] ?? (target.constructor.name === 'Dummy' ? 'straw' : 'flesh');
    return MATERIALS[key] ?? MATERIALS.flesh;
  }

  // Where the hit came from: you shoot enemies; enemies shoot you.
  source(target) {
    const player = this.scene.player;
    if (target === player) return player.lastAttacker?.alive ? player.lastAttacker : null;
    return player;
  }

  // ---- Hits ----

  // kind: 'bullet', 'melee', 'blast' or 'fire' (same kinds as takeDamage).
  hit(target, amount, kind = 'bullet') {
    if (!target || amount <= 0) return;
    const spray = HIT_SPRAY[kind] ?? HIT_SPRAY.bullet;
    const mat = this.material(target);
    const x = target.x + Phaser.Math.Between(-4, 4);
    const y = target.y + Phaser.Math.Between(-target.height / 4, target.height / 6);

    if (spray.ash) {
      this.ash(x, y, spray.color);
      return;
    }
    if (spray.drip) {
      this.bleed(target);
      return;
    }
    if (spray.bubbles) {
      this.bubbles(target.x, target.y - target.height / 3, 4);
      return;
    }

    // Spray away from whoever hit it (blasts: every way).
    const from = this.source(target);
    const base = from
      ? Phaser.Math.Angle.Between(from.x, from.y, target.x, target.y)
      : -Math.PI / 2;

    if (mat.sparks) this.sparks(x, y, base, spray);

    const lvl = this.level;
    if (!lvl.blood) {
      this.flakes(x, y, lvl.flakes);
      return;
    }

    const count = Phaser.Math.Clamp(
      Math.round(amount * lvl.dropsPerDamage * spray.countScale),
      lvl.minDrops,
      Math.round(lvl.maxDrops * spray.countScale)
    );
    const colors = mat.colors.slice(0, lvl.colorCount);
    for (let i = 0; i < count; i++) {
      const angle = base + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-spray.spreadDeg / 2, spray.spreadDeg / 2));
      const speed = Phaser.Math.Between(spray.speed[0], spray.speed[1]);
      this.drop(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 60, Phaser.Utils.Array.GetRandom(colors), mat.splat);
    }
  }

  drop(x, y, vx, vy, color, splat) {
    if (this.drops.length >= MAX_DROPS) this.drops.shift().obj.destroy();
    const lvl = this.level;
    const size = Phaser.Math.FloatBetween(lvl.dropSize[0], lvl.dropSize[1]);
    const obj = this.scene.add.circle(x, y, size, color).setDepth(DEPTH);
    this.drops.push({ obj, vx, vy: vy * fallScale(this.scene), color, splat, until: this.scene.time.now + lvl.dropLifeMs * Phaser.Math.FloatBetween(0.7, 1.3) });
  }

  // Sparks: machines at every gore level (they're not gore).
  sparks(x, y, base, spray) {
    for (let i = 0; i < SPARKS.count; i++) {
      const angle = base + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-70, 70)) + (spray.spreadDeg >= 360 ? Math.random() * Math.PI * 2 : 0);
      const speed = Phaser.Math.Between(SPARKS.speed[0], SPARKS.speed[1]);
      const len = Phaser.Math.Between(4, 9);
      const s = this.scene.add
        .rectangle(x, y, len, 2, Phaser.Utils.Array.GetRandom(SPARKS.colors))
        .setRotation(angle)
        .setDepth(DEPTH)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(angle) * speed * (SPARKS.lifeMs / 1000),
        y: y + Math.sin(angle) * speed * (SPARKS.lifeMs / 1000) + 10,
        alpha: 0,
        scaleX: 0.3,
        duration: SPARKS.lifeMs,
        onComplete: () => s.destroy(),
      });
    }
  }

  // Gore off: a few white impact flakes (you still see the hit land).
  flakes(x, y, count) {
    for (let i = 0; i < count; i++) {
      const f = this.scene.add.rectangle(x, y, 3, 3, 0xffffff).setDepth(DEPTH);
      this.scene.tweens.add({
        targets: f,
        x: x + Phaser.Math.Between(-18, 18),
        y: y + Phaser.Math.Between(-20, 4),
        alpha: 0,
        angle: 180,
        duration: 260,
        onComplete: () => f.destroy(),
      });
    }
  }

  // Fire damage: grey ash rising (no blood at any level).
  ash(x, y, color = 0x6c757d) {
    for (let i = 0; i < 2; i++) {
      const a = this.scene.add.circle(x + Phaser.Math.Between(-8, 8), y, Phaser.Math.Between(2, 4), color, 0.8).setDepth(DEPTH);
      this.scene.tweens.add({
        targets: a,
        y: a.y - Phaser.Math.Between(16, 30),
        alpha: 0,
        duration: 500,
        onComplete: () => a.destroy(),
      });
    }
  }

  // Blood loss (choking in gas): a drop or two running down the body.
  bleed(target) {
    const lvl = this.level;
    if (!lvl.blood || !target.alive) return;
    const mat = this.material(target);
    const count = Phaser.Math.Between(1, 2);
    for (let i = 0; i < count; i++) {
      const x = target.x + Phaser.Math.Between(-target.width / 3, target.width / 3);
      const y = target.y + Phaser.Math.Between(-target.height / 4, target.height / 4);
      this.drop(x, y, Phaser.Math.Between(-20, 20), Phaser.Math.Between(0, 40), mat.colors[0], mat.splat);
    }
  }

  // ---- Terrain chips ----

  // The color of the ground tile at a point (from the map palette), or null.
  tileColor(x, y) {
    const tile = this.layer.getTileAtWorldXY(x, y);
    if (!tile || !tile.collides) return null;
    const palette = this.scene.map?.palette;
    const family = TILE_FAMILY[tile.index];
    return (palette && family && palette[family]) || 0x6c757d;
  }

  // Colors of the ground around a point (for blast debris), or null.
  terrainColors(x, y, r) {
    const colors = [];
    for (const [dx, dy] of [[0, 0], [0, r], [r, 0], [-r, 0], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7]]) {
      const c = this.tileColor(x + dx, y + dy);
      if (c !== null) colors.push(c);
    }
    return colors.length ? colors : null;
  }

  // Bits knocked off a wall where a bullet hit it, thrown back the way the
  // bullet came (angle: the direction it was flying), with a puff of dust.
  chips(x, y, angle) {
    // Step back out of the wall to where it hit the surface.
    let color = null;
    for (let i = 0; i < 12 && isSolid(this.layer, x, y); i++) {
      color = this.tileColor(x, y);
      x -= Math.cos(angle) * 4;
      y -= Math.sin(angle) * 4;
    }
    color ??= this.tileColor(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6);
    if (color === null) return;
    const back = angle + Math.PI;
    for (let i = 0; i < 4; i++) {
      const a = back + Phaser.Math.FloatBetween(-0.9, 0.9);
      const size = Phaser.Math.Between(2, 4);
      this.piece(x, y, { w: size, h: size, color, angle: a, speed: Phaser.Math.Between(80, 200), lifeMs: 900 }, false);
    }
    const puff = this.scene.add.circle(x, y, 5, color, 0.5).setDepth(DEPTH);
    this.scene.tweens.add({ targets: puff, scale: 2.5, alpha: 0, y: y - 8, duration: 400, onComplete: () => puff.destroy() });
  }

  // Air bubbles rising out of someone underwater (drowning, splashes).
  bubbles(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      const b = this.scene.add
        .circle(x + Phaser.Math.Between(-6, 6), y, Phaser.Math.FloatBetween(1.5, 3.5))
        .setStrokeStyle(1, 0xe0fbfc, 0.9)
        .setDepth(46);
      this.scene.tweens.add({
        targets: b,
        y: y - Phaser.Math.Between(20, 50),
        x: b.x + Phaser.Math.Between(-6, 6),
        alpha: 0,
        duration: Phaser.Math.Between(500, 900),
        delay: i * 60,
        onComplete: () => b.destroy(),
      });
    }
  }

  // ---- Deaths ----

  // cause: 'void' (fell: nothing to show), or anything else.
  death(target, cause) {
    if (!target || cause === 'void') return;
    // Melted in lava: a burst of ash. Drowned: a last rush of bubbles.
    if (cause === 'lava') {
      for (let i = 0; i < 5; i++) this.ash(target.x, target.y - i * 6, 0x495057);
      return;
    }
    if (cause === 'drown') {
      this.bubbles(target.x, target.y, 10);
      return;
    }
    const mat = this.material(target);
    const lvl = this.level;
    const x = target.x;
    const y = target.y;
    const blast = target.lastHitKind === 'blast';

    if (mat.sparks) {
      this.sparks(x, y, -Math.PI / 2, { spreadDeg: 360 });
      this.poof(x, y, 0x495057);
    }

    if (!lvl.gibs) {
      this.poof(x, y, GIBS.poofColor);
      return;
    }

    // A last burst of blood (or oil, dust, straw).
    if (lvl.blood) this.hit(target, 60, 'blast');

    // Drawn from body parts (art pass): those parts fly apart.
    if (target.rig) {
      const landSound0 = { metal: 'landScrap', bone: 'landBone', flesh: 'landFlesh' }[mat.gibs] ?? null;
      const drip0 = mat.gibs === 'flesh' ? mat.colors[0] : null;
      for (const part of target.rig.pieces()) this.piece(part.x, part.y, { image: part, landSound: landSound0, lifeMs: RIG_PIECE_MS }, blast, drip0);
      target.rig.root.setVisible(false);
      for (let i = 0; i < lvl.gibRedBits && mat.gibs === 'flesh'; i++) {
        const size = Phaser.Math.Between(4, 7);
        const c = Phaser.Utils.Array.GetRandom(mat.colors);
        this.piece(x, y, { w: size, h: size, color: c }, blast, c);
      }
      return;
    }

    // The body breaks into pieces.
    const color = target.baseColor ?? target.config?.color ?? target.fillColor ?? 0xffffff;
    // Body chunks drip blood in full gore (machines and bones don't).
    const drip = mat.gibs === 'flesh' ? mat.colors[0] : null;
    const landSound = { metal: 'landScrap', bone: 'landBone', flesh: 'landFlesh' }[mat.gibs] ?? null;
    for (const shape of this.pieceShapes(mat, color, target)) this.piece(x, y, { ...shape, landSound }, blast, drip);
    for (let i = 0; i < lvl.gibRedBits && mat.gibs === 'flesh'; i++) {
      const size = Phaser.Math.Between(4, 7);
      const c = Phaser.Utils.Array.GetRandom(mat.colors);
      this.piece(x, y, { w: size, h: size, color: c }, blast, c);
    }
  }

  // Shapes the body breaks into, sized to the character.
  pieceShapes(mat, color, target) {
    const w = target.width ?? 32;
    const h = target.height ?? 48;
    const n = this.level.gibPieces;
    const shapes = [];
    switch (mat.gibs) {
      case 'metal': {
        const greys = [color, 0x495057, 0xadb5bd, 0x343a40];
        for (let i = 0; i < n; i++) {
          shapes.push({ w: Phaser.Math.Between(6, w / 2), h: Phaser.Math.Between(4, h / 4), color: greys[i % greys.length] });
        }
        shapes.push({ w: 4, h: 4, color: 0xffd166 }, { w: 3, h: 3, color: 0xadb5bd }); // bolts
        break;
      }
      case 'bone':
        shapes.push({ w: 10, h: 10, color: 0xf8f9fa }); // skull
        for (let i = 1; i < n; i++) shapes.push({ w: 3, h: Phaser.Math.Between(10, 16), color: 0xe9ecef });
        break;
      case 'straw':
        for (let i = 0; i < n + 2; i++) shapes.push({ w: Phaser.Math.Between(3, 6), h: Phaser.Math.Between(6, 12), color: Phaser.Utils.Array.GetRandom(mat.colors) });
        break;
      default: {
        // head, torso, then limbs in the body color
        shapes.push({ w: w * 0.4, h: w * 0.4, color, outline: true });
        shapes.push({ w: w * 0.55, h: h * 0.35, color, outline: true });
        for (let i = 2; i < n; i++) shapes.push({ w: w * 0.18, h: h * 0.28, color, outline: true });
      }
    }
    return shapes;
  }

  // drip: color the piece leaves behind as it flies (full gore), or null.
  piece(x, y, shape, blast, drip = null) {
    if (this.pieces.length >= GIBS.maxActive) this.pieces.shift().obj.destroy();
    // shape.angle + shape.speed: thrown that exact way (wall chips);
    // otherwise flung out sideways and up (body parts, blast debris).
    const aimed = shape.angle !== undefined;
    const jitter = aimed ? 0 : 1;
    const img = shape.image; // a body part (art pass): flies off from where it was
    const obj = img
      ? this.scene.add.image(x, y, img.key).setOrigin(...img.origin).setScale(img.scale).setAngle(img.angle).setFlipX(img.flipX).setTint(img.tint).setDepth(DEPTH - 1)
      : this.scene.add
          .rectangle(x + Phaser.Math.Between(-8, 8) * jitter, y + Phaser.Math.Between(-12, 8) * jitter, shape.w, shape.h, shape.color)
          .setDepth(DEPTH - 1);
    if (shape.outline) obj.setStrokeStyle(1, 0x000000, 0.8);
    const boost = blast ? 1.4 : 1;
    const dir = shape.dir ?? (Math.random() < 0.5 ? -1 : 1);
    this.pieces.push({
      obj,
      vx: aimed ? Math.cos(shape.angle) * shape.speed : dir * Phaser.Math.Between(GIBS.speed[0], GIBS.speed[1]) * Phaser.Math.FloatBetween(0.3, 1) * boost,
      vy: (aimed ? Math.sin(shape.angle) * shape.speed - 60 : -Phaser.Math.Between(GIBS.lift[0], GIBS.lift[1]) * boost) * fallScale(this.scene),
      spin: Phaser.Math.FloatBetween(-GIBS.spin, GIBS.spin),
      until: this.scene.time.now + (shape.lifeMs ?? (this.level.gibLifeMs ?? 2500) * Phaser.Math.FloatBetween(0.8, 1.2)),
      trailAt: 0,
      blood: drip,
      landSound: shape.landSound ?? null,
    });
  }

  // Smoke puff (a body vanishing with gore off, or a machine blowing apart).
  poof(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const p = this.scene.add.circle(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-14, 14), Phaser.Math.Between(6, 11), color, 0.85).setDepth(DEPTH);
      this.scene.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(14, 34),
        scale: 1.8,
        alpha: 0,
        duration: Phaser.Math.Between(450, 700),
        onComplete: () => p.destroy(),
      });
    }
  }

  // ---- Splats ----

  // A splat on the ground or a wall where a drop landed.
  splat(x, y, color) {
    const lvl = this.level;
    if (!lvl.splats) return;
    if (this.splats.length >= lvl.maxSplats) this.splats.shift().destroy();
    const size = Phaser.Math.Between(lvl.splatSize[0], lvl.splatSize[1]);
    const top = Math.floor(y / this.layer.tilemap.tileHeight) * this.layer.tilemap.tileHeight;
    const s = this.scene.add.ellipse(x, top + 1, size * 2, size * 0.6, color, 0.85).setDepth(SPLAT_DEPTH);
    this.splats.push(s);
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      delay: lvl.splatLifeMs * 0.75,
      duration: lvl.splatLifeMs * 0.25,
      onComplete: () => {
        s.destroy();
        this.splats = this.splats.filter((o) => o !== s);
      },
    });
  }

  clearBlood() {
    this.drops.forEach((d) => d.obj.destroy());
    this.drops = [];
    this.splats.forEach((s) => s.destroy());
    this.splats = [];
  }

  // ---- Frame update ----

  update(delta) {
    const dt = Math.min(delta, 50) / 1000;
    const now = this.scene.time.now;

    // Drops fly, fall and splat where they land (or fade out in the air).
    this.drops = this.drops.filter((d) => {
      if (now >= d.until || !d.obj.active) {
        d.obj.destroy();
        return false;
      }
      d.vy += GRAVITY * gravityK(this.scene) * dt;
      const nx = d.obj.x + d.vx * dt;
      const ny = d.obj.y + d.vy * dt;
      if (isSolid(this.layer, nx, ny)) {
        if (d.splat && d.vy > 0 && Math.random() < 0.6) this.splat(nx, ny, d.color);
        d.obj.destroy();
        return false;
      }
      d.obj.setPosition(nx, ny);
      return true;
    });

    // Pieces bounce on the tiles, spin, drip (full gore) and fade at the end.
    this.pieces = this.pieces.filter((p) => {
      const o = p.obj;
      if (!o.active) return false;
      if (now >= p.until) {
        this.scene.tweens.add({ targets: o, alpha: 0, duration: 300, onComplete: () => o.destroy() });
        return false;
      }
      p.vy += GRAVITY * gravityK(this.scene) * dt;
      let nx = o.x + p.vx * dt;
      let ny = o.y + p.vy * dt;
      if (isSolid(this.layer, nx, o.y)) {
        p.vx = -p.vx * GIBS.bounce;
        nx = o.x;
      }
      if (isSolid(this.layer, o.x, ny + (o.displayHeight ?? o.height) / 2)) {
        if (p.vy > 0) {
          // Landing sound for a body piece (scrap, flesh, bone), first few bounces.
          if (p.landSound && p.vy > 120 && (p.bounces = (p.bounces ?? 0) + 1) <= 2) {
            this.scene.sfx?.play(p.landSound, o, { volume: p.bounces === 1 ? 0.8 : 0.4 });
          }
          p.vy = -p.vy * GIBS.bounce;
          p.vx *= 0.7;
          p.spin *= 0.6;
          if (Math.abs(p.vy) < 40) p.vy = 0;
        } else {
          p.vy = 0;
        }
        ny = o.y;
      }
      o.setPosition(nx, ny);
      o.rotation += p.spin * dt;

      if (this.level.gibTrail && p.blood && now >= p.trailAt && Math.hypot(p.vx, p.vy) > 60) {
        p.trailAt = now + 90;
        this.drop(nx, ny, 0, 20, p.blood, true);
      }
      if (ny > this.layer.tilemap.heightInPixels + 200) {
        o.destroy();
        return false;
      }
      return true;
    });
  }
}
