import Phaser from 'phaser';

// The void under every map: draws the darkness and mist, and detects falls.
export default class VoidSystem {
  constructor(scene, map, worldSize, onFall) {
    this.scene = scene;
    this.map = map;
    this.width = worldSize.width;
    this.height = worldSize.height;
    this.deathY = map.void.deathY;
    this.onFall = onFall;

    this.drawDarkness();
    this.drawMist();
  }

  drawDarkness() {
    const { top, color } = this.map.void;
    const texKey = `void-${this.map.key}`;

    // Build a vertical gradient once: transparent at the top, solid at the bottom.
    if (!this.scene.textures.exists(texKey)) {
      const c = Phaser.Display.Color.IntegerToColor(color);
      const rgba = (a) => `rgba(${c.red}, ${c.green}, ${c.blue}, ${a})`;

      const tex = this.scene.textures.createCanvas(texKey, 4, 256);
      const ctx = tex.getContext();
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, rgba(0));
      grad.addColorStop(0.45, rgba(0.85));
      grad.addColorStop(1, rgba(1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 256);
      tex.refresh();
    }

    // Stretch it across the bottom of the map, drawn above the player.
    this.scene.add
      .image(0, top, texKey)
      .setOrigin(0, 0)
      .setDisplaySize(this.width, this.height - top)
      .setDepth(10);
  }

  drawMist() {
    const { glowColor } = this.map.void;

    // Soft white dot texture, tinted by the emitter.
    if (!this.scene.textures.exists('mist-dot')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture('mist-dot', 32, 32);
      g.destroy();
    }

    this.scene.add
      .particles(0, 0, 'mist-dot', {
        x: { min: 0, max: this.width },
        y: { min: this.deathY - 40, max: this.height },
        lifespan: 4000,
        speedX: { min: -10, max: 10 },
        speedY: { min: -22, max: -8 },  // drifts slowly upward
        scale: { start: 1.2, end: 3 },
        alpha: { start: 0.18, end: 0 },
        tint: glowColor,
        blendMode: 'ADD',               // glows where wisps overlap
        frequency: 80,                  // one new wisp every 80ms
      })
      .setDepth(11);
  }

  update(player) {
    if (player.alive && player.y > this.deathY) {
      this.onFall(player);
    }
  }
}