import Phaser from 'phaser';
import { fxKey, projKey } from '../systems/ShotFx.js';
import { FIRE_LOOK } from '../data/effects.js';

const FLAME_COLORS = [0xe5383b, 0xe5383b, 0xff9f1c, 0xffd166];

// A patch of fire on the ground where a molotov broke. Anyone standing in it
// (whoever victims() returns) gets set on fire every tickMs via burn(victim),
// until it burns out after durationMs.
export default class FirePatch {
  // x: center. surfaceY: top of the ground it sits on. fire: THROWABLES.molotov.fire
  constructor(scene, x, surfaceY, fire, victims, burn) {
    this.scene = scene;
    this.fire = fire;
    this.victims = victims;
    this.burn = burn;
    this.active = true;

    const now = scene.time.now;
    this.endsAt = now + fire.durationMs;
    this.nextTickAt = now;
    this.nextFxAt = 0;
    // The burning fuel runs over the ground like a liquid: it's laid in
    // short pieces, each on the ground right there (down a slope, steps or
    // stairs, round a bump), and none over a gap.
    this.spots = this.spread(x, surfaceY, fire.widthPx);
    if (!this.spots.length) this.spots = [{ x, top: surfaceY }];
    const left = Math.min(...this.spots.map((p) => p.x)) - FIRE_LOOK.pieceWidth / 2;
    const right = Math.max(...this.spots.map((p) => p.x)) + FIRE_LOOK.pieceWidth / 2;
    const highest = Math.min(...this.spots.map((p) => p.top));
    const lowest = Math.max(...this.spots.map((p) => p.top));
    this.area = new Phaser.Geom.Rectangle(left, highest - fire.heightPx, right - left, lowest - highest + fire.heightPx);
    // Who it can burn: the fire's height over each piece (not the air over a step).
    this.areas = this.spots.map((p) => new Phaser.Geom.Rectangle(p.x - FIRE_LOOK.pieceWidth / 2, p.top - fire.heightPx, FIRE_LOOK.pieceWidth, fire.heightPx));

    // A soft burnt smudge on the ground under each piece (no hard line),
    // fading a little after the fire's out.
    this.spots.forEach((p, i) => {
      if (i % 2 === 0) scene.blastFx?.groundMark(p.x, p.top - 4, FIRE_LOOK.pieceWidth * 2, FIRE_LOOK.scorch.color, FIRE_LOOK.scorch.alpha, fire.durationMs + 2500);
    });

    // The fire itself: a piece of the fire-patch art on each spot, glowing
    // and flickering out of step with its neighbours.
    this.sheets = [];
    if (scene.textures.exists(fxKey('fire-patch'))) {
      this.spots.forEach((p, i) => {
        const img = scene.add.image(p.x, p.top + 3, fxKey('fire-patch')).setOrigin(0.5, 1).setDepth(42 + (i % 2)).setFlipX(i % 2 === 1);
        img.setDisplaySize(FIRE_LOOK.pieceWidth * FIRE_LOOK.pieceOverlap, fire.heightPx * Phaser.Math.FloatBetween(0.8, 1.15));
        img.baseX = img.scaleX;
        img.baseY = img.scaleY;
        img.phase = Math.random() * 10;
        img.setAlpha(0);
        if (FIRE_LOOK.glow) img.setBlendMode(Phaser.BlendModes.ADD); // no dark outline: glowing, formless
        scene.tweens.add({ targets: img, alpha: FIRE_LOOK.patchAlpha[i % 2], duration: 160 }); // see-through fire
        this.sheets.push(img);
      });
    }
  }

  // Where the fuel ends up across widthPx: for each piece, the top of the
  // ground there, looked for a few tiles above and below where it broke (so
  // it follows slopes and steps); a piece with no ground near (a gap, a
  // drop) is left out, and the fuel stops at a wall it meets.
  spread(x, surfaceY, widthPx) {
    const layer = this.scene.groundLayer;
    if (!layer) return [];
    const th = layer.tilemap.tileHeight;
    const step = FIRE_LOOK.pieceWidth;
    const reach = FIRE_LOOK.followTiles * th;
    const solid = (px, py) => Boolean(layer.getTileAtWorldXY(px, py)?.collides);
    const topAt = (px, nearY) => {
      for (let y = nearY - reach; y <= nearY + reach; y += th / 2) {
        if (solid(px, y) && !solid(px, y - th)) return Math.floor(y / th) * th;
      }
      return null;
    };
    const spots = [];
    for (const dir of [-1, 1]) {
      let last = surfaceY;
      for (let d = dir < 0 ? step / 2 : step / 2; d <= widthPx / 2; d += step) {
        const px = x + dir * d;
        const top = topAt(px, last);
        if (top === null) break;            // a gap: it doesn't run on over the air
        if (last - top > th * 1.5) break;   // a wall rising in front of it: stops there
        spots.push({ x: px, top });
        last = top;
      }
    }
    return spots.sort((a, b) => a.x - b.x);
  }

  update() {
    if (!this.active) return;
    const now = this.scene.time.now;
    if (now >= this.endsAt) {
      this.remove();
      return;
    }

    // Crackling fire for as long as it burns, quieter as it dies down.
    const sfx = this.scene.sfx;
    if (sfx) {
      const level = Math.min(1, ((this.endsAt - now) / this.fire.durationMs) * 1.5);
      sfx.hold(sfx.idFor(this, 'fire'), 'fire', { x: this.area.centerX, y: this.area.bottom }, level);
    }

    if (now >= this.nextTickAt) {
      this.nextTickAt = now + this.fire.tickMs;
      for (const v of this.victims()) {
        if (!v.alive) continue;
        const b = v.getBounds();
        if (this.areas.some((a) => Phaser.Geom.Rectangle.Overlaps(a, b))) this.burn(v);
      }
    }

    // Flames licking up along the patch, thinning out near the end.
    const left = (this.endsAt - now) / this.fire.durationMs;
    const fade = Math.min(1, left * 4); // the last quarter: dying down
    this.sheets.forEach((img, i) => {
      const t = now / (i % 2 ? 130 : 170) + img.phase;
      img.setScale(img.baseX * (1 + Math.sin(t) * 0.04), img.baseY * fade * (0.9 + Math.sin(t * 1.7) * 0.1));
    });
    if (now >= this.nextFxAt) {
      this.nextFxAt = now + 40;
      const count = left > 0.3 ? 3 : 1;
      for (let i = 0; i < count; i++) this.flame();
    }
  }

  flame() {
    const a = this.area;
    // With the art: a few flame puffs rising off it (tongues up).
    if (this.sheets.length) {
      if (Math.random() < 0.6) return;
      const spot = Phaser.Utils.Array.GetRandom(this.spots);
      const f = this.scene.add.image(spot.x + Phaser.Math.Between(-8, 8), spot.top - Phaser.Math.Between(6, 16), projKey('flame-puff'))
        .setRotation(Math.PI / 2 + Phaser.Math.FloatBetween(-0.3, 0.3)).setDepth(43);
      f.setScale(Phaser.Math.Between(12, 20) / f.width).setAlpha(FIRE_LOOK.puffAlpha);
      if (FIRE_LOOK.glow) f.setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: f, y: f.y - Phaser.Math.Between(18, this.fire.heightPx), alpha: 0, scale: f.scale * 0.4, duration: Phaser.Math.Between(350, 550), onComplete: () => f.destroy() });
      return;
    }
    const f = this.scene.add
      .circle(
        Phaser.Math.Between(a.left + 4, a.right - 4),
        a.bottom - Phaser.Math.Between(2, 10),
        Phaser.Math.Between(4, 8),
        Phaser.Utils.Array.GetRandom(FLAME_COLORS),
        0.9
      )
      .setDepth(43);
    this.scene.tweens.add({
      targets: f,
      y: f.y - Phaser.Math.Between(18, this.fire.heightPx),
      scale: 0.3,
      alpha: 0,
      duration: Phaser.Math.Between(350, 600),
      onComplete: () => f.destroy(),
    });
  }

  remove() {
    this.active = false;
    for (const img of this.sheets) this.scene.tweens.add({ targets: img, alpha: 0, duration: 300, onComplete: () => img.destroy() });
  }
}
