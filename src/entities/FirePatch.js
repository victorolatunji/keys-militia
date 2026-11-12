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
    this.area = new Phaser.Geom.Rectangle(
      x - fire.widthPx / 2, surfaceY - fire.heightPx, fire.widthPx, fire.heightPx
    );

    // A soft burnt smudge on the ground under it (no hard line), fading
    // a little after the fire's out.
    scene.blastFx?.groundMark(x, surfaceY - 4, fire.widthPx, FIRE_LOOK.scorch.color, FIRE_LOOK.scorch.alpha, fire.durationMs + 2500);

    // The fire itself: the fire-patch art along the ground, flickering
    // (two copies, one flipped, swaying out of step).
    this.sheets = [];
    if (scene.textures.exists(fxKey('fire-patch'))) {
      for (let i = 0; i < 2; i++) {
        const img = scene.add.image(x + (i ? 6 : -6), surfaceY + 2, fxKey('fire-patch')).setOrigin(0.5, 1).setDepth(42 + i).setFlipX(i === 1);
        img.setDisplaySize(fire.widthPx * (i ? 0.9 : 1.05), fire.heightPx * (i ? 0.95 : 1.15));
        img.baseX = img.scaleX;
        img.baseY = img.scaleY;
        img.setAlpha(0);
        if (FIRE_LOOK.glow) img.setBlendMode(Phaser.BlendModes.ADD); // no dark outline: glowing, formless
        scene.tweens.add({ targets: img, alpha: FIRE_LOOK.patchAlpha[i], duration: 160 }); // see-through fire
        this.sheets.push(img);
      }
    }
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
        if (v.alive && Phaser.Geom.Rectangle.Overlaps(this.area, v.getBounds())) this.burn(v);
      }
    }

    // Flames licking up along the patch, thinning out near the end.
    const left = (this.endsAt - now) / this.fire.durationMs;
    const fade = Math.min(1, left * 4); // the last quarter: dying down
    this.sheets.forEach((img, i) => {
      const t = now / (i ? 130 : 170) + i * 2;
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
      const f = this.scene.add.image(Phaser.Math.Between(a.left + 6, a.right - 6), a.bottom - Phaser.Math.Between(6, 16), projKey('flame-puff'))
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
