import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Hud from '../ui/Hud.js';
import { MAPS } from '../data/maps.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.map = MAPS[data.mapKey ?? 'test'];
  }

  create() {
    const { width, height, spawn } = this.map;

    this.cameras.main.setBackgroundColor(this.map.background);

    // World bounds: walls left, right and top. No floor: below is the void.
    this.physics.world.setBounds(0, 0, width, height, true, true, true, false);

    this.buildPlatforms();

    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player, this.platforms);

    // Camera follows the player smoothly and stays inside the map.
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.hud = new Hud(this);

    // Debug readout, pinned to the screen.
    this.debugText = this.add
      .text(16, 44, '', { fontFamily: 'monospace', fontSize: '14px', color: '#aaaacc' })
      .setScrollFactor(0)
      .setDepth(100);
  }

  buildPlatforms() {
    this.platforms = this.physics.add.staticGroup();

    for (const p of this.map.platforms) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;

      const block = this.add.rectangle(cx, cy, p.w, p.h, this.map.groundColor);
      this.platforms.add(block);

      // Grass strip on top (visual only, no physics).
      this.add.rectangle(cx, p.y + 4, p.w, 8, this.map.grassColor);
    }
  }

  update(time, delta) {
    this.player.update(delta);
    this.hud.update(this.player);

    // Temporary: fell off the map → respawn. Proper void death comes in Step 3.
    if (this.player.y > this.map.height + 100) {
      this.player.respawn();
    }

    const b = this.player.body;
    this.debugText.setText([
      `x: ${Math.round(this.player.x)}  y: ${Math.round(this.player.y)}`,
      `vx: ${Math.round(b.velocity.x)}  vy: ${Math.round(b.velocity.y)}`,
      `onGround: ${this.player.onGround}  fuel: ${Math.round(this.player.fuel)}`,
    ]);
  }
}