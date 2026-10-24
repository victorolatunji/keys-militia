import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Dummy from '../entities/Dummy.js';
import Hud from '../ui/Hud.js';
import VoidSystem from '../systems/VoidSystem.js';
import TypingSystem from '../systems/TypingSystem.js';
import { MAPS } from '../data/maps.js';
import { PLAYER } from '../data/player.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.map = MAPS[data.mapKey ?? 'test'];
    this.deaths = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor(this.map.background);

    const { width, height, spawn, dummySpawns } = this.buildTilemap();

    // World bounds: walls left, right and top. No floor: below is the void.
    this.physics.world.setBounds(0, 0, width, height, true, true, true, false);

    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player, this.groundLayer);

    this.typing = new TypingSystem(this, this.player);

    // Practice targets from the Tiled "dummy" points.
    this.dummies = dummySpawns.map((p) => new Dummy(this, p.x, p.y));
    for (const dummy of this.dummies) this.typing.addTarget(dummy);

    this.voidSystem = new VoidSystem(this, this.map, { width, height }, (player) =>
      this.handleFall(player)
    );

    // Camera follows the player smoothly and stays inside the map.
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.hud = new Hud(this);

    // Center-screen message (death notice for now).
    this.message = this.add
      .text(640, 300, '', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // Debug readout, pinned to the screen.
    this.debugText = this.add
      .text(16, 44, '', { fontFamily: 'monospace', fontSize: '14px', color: '#aaaacc' })
      .setScrollFactor(0)
      .setDepth(100);
  }

  // Builds the level from the Tiled file. Needs a tile layer "ground"
  // and an object layer "spawns" with a point named "player".
  // Optional: points named "dummy" (placed at the dummy's feet).
  buildTilemap() {
    const { key, tilemapKey, tilesetName, tilesetKey } = this.map;

    const tilemap = this.make.tilemap({ key: tilemapKey });
    const tileset = tilemap.addTilesetImage(tilesetName, tilesetKey);

    this.groundLayer = tilemap.createLayer('ground', tileset, 0, 0);
    if (!this.groundLayer) {
      throw new Error(`Map "${key}" needs a tile layer named "ground".`);
    }
    this.groundLayer.setCollisionByExclusion([-1]); // every painted tile is solid

    const spawn = tilemap.findObject('spawns', (obj) => obj.name === 'player');
    if (!spawn) {
      throw new Error(`Map "${key}" needs an object layer "spawns" with a point named "player".`);
    }

    const dummySpawns = tilemap.filterObjects('spawns', (obj) => obj.name === 'dummy') ?? [];

    return {
      width: tilemap.widthInPixels,
      height: tilemap.heightInPixels,
      spawn: { x: spawn.x, y: spawn.y },
      dummySpawns: dummySpawns.map((obj) => ({ x: obj.x, y: obj.y })),
    };
  }

  handleFall(player) {
    this.typing.reset(); // dying clears your half-typed text
    player.die();
    this.deaths += 1;

    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(250, 120, 0, 40);

    this.message.setText('Fell into the void').setVisible(true);

    this.time.delayedCall(PLAYER.respawnDelay, () => {
      this.message.setVisible(false);
      player.respawn();
    });
  }

  update(time, delta) {
    this.player.update(delta);
    for (const dummy of this.dummies) dummy.update();
    this.voidSystem.update(this.player);
    this.hud.update(this.player, this.typing);

    const b = this.player.body;
    this.debugText.setText([
      `x: ${Math.round(this.player.x)}  y: ${Math.round(this.player.y)}`,
      `vx: ${Math.round(b.velocity.x)}  vy: ${Math.round(b.velocity.y)}`,
      `onGround: ${this.player.onGround}  fuel: ${Math.round(this.player.fuel)}`,
      `alive: ${this.player.alive}  deaths: ${this.deaths}  typing: ${this.typing.isTyping}`,
      `targets: ${this.dummies.length}  words: ${this.dummies.map((d) => d.word).join(', ')}`,
    ]);
  }
}