import Phaser from 'phaser';

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

    // A dark scorch mark under the flames.
    this.scorch = scene.add
      .rectangle(x, surfaceY - 2, fire.widthPx, 5, 0x2b1d14, 0.8)
      .setDepth(39);
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
    if (now >= this.nextFxAt) {
      this.nextFxAt = now + 40;
      const count = left > 0.3 ? 3 : 1;
      for (let i = 0; i < count; i++) this.flame();
    }
  }

  flame() {
    const a = this.area;
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
    this.scene.tweens.add({ targets: this.scorch, alpha: 0, duration: 800, onComplete: () => this.scorch.destroy() });
  }
}