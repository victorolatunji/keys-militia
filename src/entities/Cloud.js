import Phaser from 'phaser';

const PUFF_KEY = 'cloud-puff';
const PUFF_SIZE = 128; // texture size in px

// A drifting cloud from a Smoke or Gas Grenade: lots of soft, see-through
// puffs that billow out from where it popped, churn slowly, then thin away.
// No hard edge: puffs are soft round blobs that fade out to nothing.
//   kind 'smoke': nobody sees through it, except whoever threw it (they
//                 see it thinner: ownerAlpha). Enemies inside are blind.
//   kind 'gas':   green; hurts anyone breathing inside it (WeaponSystem).
// WeaponSystem keeps the list and asks covers() / blocksLine().
// config (THROWABLES[...].cloud): radiusPx, durationMs, growMs, fadeMs,
// puffs, color, alpha, ownerAlpha
export default class Cloud {
  constructor(scene, x, y, kind, config, owner, viewer) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.config = config;
    this.owner = owner;
    this.bornAt = scene.time.now;
    this.endsAt = this.bornAt + config.durationMs;
    this.active = true;

    // How thick it looks on this screen: thinner for whoever threw smoke.
    this.alpha = viewer === owner && config.ownerAlpha != null ? config.ownerAlpha : config.alpha;

    const texture = Cloud.puffTexture(scene);
    this.puffs = [];
    for (let i = 0; i < config.puffs; i++) {
      // Spread over the circle (more toward the middle), a bit flatter than tall.
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * config.radiusPx * 0.8;
      const size = Phaser.Math.FloatBetween(0.55, 0.95) * config.radiusPx; // puff diameter
      const img = scene.add
        .image(x, y, texture)
        .setTint(config.color)
        .setDepth(70) // over characters and their words
        .setScale(0.05)
        .setAlpha(0)
        .setRotation(Math.random() * Math.PI * 2);
      this.puffs.push({
        img,
        dx: Math.cos(angle) * r,
        dy: Math.sin(angle) * r * 0.75,
        scale: (size / PUFF_SIZE) * 1.6, // soft edge: the visible part is smaller than the texture
        phase: Math.random() * Math.PI * 2,
        wander: Phaser.Math.FloatBetween(4, 10),
        spin: Phaser.Math.FloatBetween(-0.25, 0.25),
        thick: Phaser.Math.FloatBetween(0.7, 1),
      });
    }
  }

  // A soft, formless wisp (white, tinted per use): several soft lumps
  // overlapping off-centre, so smoke, gas, mist and glows never read as
  // circles. Used by every cloud-like effect in the game.
  static puffTexture(scene) {
    if (!scene.textures.exists(PUFF_KEY)) {
      const tex = scene.textures.createCanvas(PUFF_KEY, PUFF_SIZE, PUFF_SIZE);
      const ctx = tex.getContext();
      const half = PUFF_SIZE / 2;
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 9; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * half * 0.32;
        const cx = half + Math.cos(a) * d;
        const cy = half + Math.sin(a) * d * 0.8;
        const r = half * (0.3 + rnd() * 0.32);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.42)');
        grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, PUFF_SIZE, PUFF_SIZE);
      }
      tex.refresh();
    }
    return PUFF_KEY;
  }

  // 0 -> 1 while it billows out, 1 while it hangs, back to 0 as it thins.
  get strength() {
    const now = this.scene.time.now;
    const { growMs, fadeMs } = this.config;
    const grow = Phaser.Math.Easing.Cubic.Out(Math.min(1, (now - this.bornAt) / growMs));
    const fade = Math.min(1, Math.max(0, (this.endsAt - now) / fadeMs));
    return Math.min(grow, fade);
  }

  // Radius that counts (blocks sight / gasses people); a thin cloud counts less.
  get radius() {
    const k = this.strength;
    return k < 0.35 ? 0 : this.config.radiusPx * k;
  }

  covers(x, y) {
    return Phaser.Math.Distance.Between(x, y, this.x, this.y) <= this.radius;
  }

  // Does the line from (x1, y1) to (x2, y2) pass through (or start in) it?
  blocksLine(x1, y1, x2, y2) {
    const r = this.radius;
    if (r <= 0) return false;
    if (this.covers(x1, y1) || this.covers(x2, y2)) return true;
    return Phaser.Geom.Intersects.LineToCircle(
      new Phaser.Geom.Line(x1, y1, x2, y2),
      new Phaser.Geom.Circle(this.x, this.y, r)
    );
  }

  update() {
    if (!this.active) return;
    const now = this.scene.time.now;
    if (now >= this.endsAt) {
      this.destroy();
      return;
    }
    const k = this.strength;
    const t = (now - this.bornAt) / 1000;
    for (const p of this.puffs) {
      // Billow out from the middle, churn in slow circles, rise a little as it thins.
      const wx = Math.cos(t * 0.6 + p.phase) * p.wander;
      const wy = Math.sin(t * 0.5 + p.phase) * p.wander * 0.6;
      p.img.setPosition(this.x + p.dx * k + wx, this.y + p.dy * k + wy - (1 - k) * 12);
      p.img.setScale(p.scale * (0.4 + 0.6 * k) * (1 + Math.sin(t * 0.8 + p.phase) * 0.06));
      p.img.rotation += p.spin * 0.016;
      p.img.setAlpha(this.alpha * p.thick * k);
    }
  }

  destroy() {
    this.active = false;
    this.puffs.forEach((p) => p.img.destroy());
    this.puffs = [];
  }
}
