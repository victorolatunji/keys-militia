import Phaser from 'phaser';

// The void under every map: draws the darkness and mist, and detects falls.
// void.lava (Hell): a glowing lava sea instead of the darkness.
export default class VoidSystem {
  constructor(scene, map, worldSize, onFall) {
    this.scene = scene;
    this.map = map;
    this.width = worldSize.width;
    this.height = worldSize.height;
    this.deathY = map.void.deathY;
    this.onFall = onFall;

    this.drawDarkness();
    if (map.void.lava) this.drawLavaSea();
    this.drawMist();
  }

  // Hell: the glow gets brighter toward a rolling lava surface just above
  // the death line, solid lava below it.
  drawLavaSea() {
    const surfaceY = this.deathY - 40;
    // seaColors: [body, deep, glow, surface] (Wastelands: toxic sludge)
    const [bodyC, deepC, glowC, surfC] = this.map.void.seaColors ?? [0xe85d04, 0x9d0208, 0xff5400, 0xffba08];
    this.surfaceColor = surfC;
    this.lavaY = surfaceY;
    this.scene.add
      .rectangle(0, surfaceY - 220, this.width, 220, glowC, 0.12)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(10);
    this.scene.add
      .rectangle(0, surfaceY, this.width, this.height - surfaceY, bodyC)
      .setOrigin(0, 0)
      .setDepth(10);
    this.scene.add
      .rectangle(0, surfaceY + 50, this.width, this.height - surfaceY, deepC)
      .setOrigin(0, 0)
      .setDepth(10);
    this.lavaSurface = this.scene.add.graphics().setDepth(10);
  }

  drawLavaSurface(now) {
    const g = this.lavaSurface;
    if (!g) return;
    const cam = this.scene.cameras.main;
    const x0 = Math.max(0, Math.floor(cam.scrollX / 16) * 16 - 16);
    const x1 = Math.min(this.width, cam.scrollX + cam.width + 32);
    g.clear();
    g.fillStyle(this.surfaceColor, 1);
    g.beginPath();
    g.moveTo(x0, this.lavaY + 14);
    for (let x = x0; x <= x1; x += 16) {
      g.lineTo(x, this.lavaY + Math.sin(x / 70 + now / 700) * 6 + Math.sin(x / 23 - now / 400) * 2);
    }
    g.lineTo(x1, this.lavaY + 14);
    g.closePath();
    g.fillPath();
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
    if (player === this.scene.player) this.drawLavaSurface(this.scene.time.now);
    if (player.alive && player.y > this.deathY) {
      if (this.map.void.lava) this.scene.sfx?.play(this.map.void.seaColors ? 'sandSink' : 'lavaSizzle', player);
      this.onFall(player);
    }
  }
}