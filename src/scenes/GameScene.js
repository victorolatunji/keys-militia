import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Dummy from '../entities/Dummy.js';
import Hud from '../ui/Hud.js';
import VoidSystem from '../systems/VoidSystem.js';
import TypingSystem from '../systems/TypingSystem.js';
import WeaponSystem from '../systems/WeaponSystem.js';
import AirdropSystem from '../systems/AirdropSystem.js';
import CollisionSystem from '../systems/CollisionSystem.js';
import PickupSystem from '../systems/PickupSystem.js';
import { MAPS } from '../data/maps.js';
import { PLAYER } from '../data/player.js';

// What the death message says for each cause.
const DEATH_MESSAGES = {
  void: 'Fell into the void',
  self: 'Blew yourself up',
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.map = MAPS[data.mapKey ?? 'test'];
    this.deaths = 0;
    this.suicides = 0;
    this.kills = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor(this.map.background);

    const { width, height, spawn, dummySpawns } = this.buildTilemap();

    // World bounds: walls left, right and top. No floor: below is the void.
    this.physics.world.setBounds(0, 0, width, height, true, true, true, false);

    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player, this.groundLayer);
    this.player.on('died', (cause) => this.handlePlayerDeath(cause));

    // Object-vs-object collisions (characters, crates, grenades).
    this.collisions = new CollisionSystem(this);
    this.collisions.addCharacter(this.player);

    // Typing and weapons need each other; the arrow functions run later,
    // once both exist.
    this.typing = new TypingSystem(this, this.player, this.groundLayer, {
      onFire: (target) => this.weapons.fire(target),
      getWordList: () => this.weapons.current?.wordList ?? null,
      getReach: () => this.weapons.reach,
    });
    this.weapons = new WeaponSystem(
      this,
      this.player,
      this.typing,
      this.groundLayer,
      height,
      this.collisions
    );

    // Practice targets from the Tiled "dummy" points.
    this.dummies = dummySpawns.map((p) => new Dummy(this, p.x, p.y));
    for (const dummy of this.dummies) {
      this.typing.addTarget(dummy);
      this.collisions.addCharacter(dummy);
      dummy.on('died', () => (this.kills += 1));
    }

    // Crates parachute in on a timer; get near a landed one to pick up its item.
    this.airdrops = new AirdropSystem(this, this.groundLayer, { width, height }, this.collisions);
    this.pickups = new PickupSystem(this, this.player, this.weapons, this.airdrops);

    this.voidSystem = new VoidSystem(this, this.map, { width, height }, (player) =>
      player.kill('void')
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
      .text(16, 60, '', { fontFamily: 'monospace', fontSize: '14px', color: '#aaaacc' })
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

  // Every player death (void, own grenade, later enemies) lands here.
  handlePlayerDeath(cause) {
    this.typing.reset();      // clears your lock and progress
    this.weapons.cancelAim(); // and any throw in progress

    // Your gear spills out where you died (not in the void: it would just fall).
    if (cause !== 'void') {
      this.airdrops.dropItems(this.player.x, this.player.y, this.weapons.loadoutItems());
    }
    this.deaths += 1;
    if (cause === 'self') this.suicides += 1;

    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(250, 120, 0, 40);

    this.message.setText(DEATH_MESSAGES[cause] ?? 'You died').setVisible(true);

    this.time.delayedCall(PLAYER.respawnDelay, () => {
      this.message.setVisible(false);
      this.player.respawn();
      this.weapons.resetLoadout(); // back to the default guns and grenades
    });
  }

  update(time, delta) {
    this.player.update(delta);
    for (const dummy of this.dummies) dummy.update();
    this.typing.update();
    this.weapons.update(delta);
    this.airdrops.update(delta);
    this.pickups.update();
    this.voidSystem.update(this.player);
    this.hud.update(this.player, this.typing, this.weapons);

    const b = this.player.body;
    const lock = this.typing.lock;
    const shot = this.weapons.lastShot;
    this.debugText.setText([
      `x: ${Math.round(this.player.x)}  y: ${Math.round(this.player.y)}`,
      `vx: ${Math.round(b.velocity.x)}  vy: ${Math.round(b.velocity.y)}`,
      `onGround: ${this.player.onGround}  fuel: ${Math.round(this.player.fuel)}  hp: ${this.player.hp}`,
      `alive: ${this.player.alive}  deaths: ${this.deaths}  suicides: ${this.suicides}`,
      `lock: ${lock ? `${lock.word} (${this.typing.progress}/${lock.word.length})` : '-'}`,
      `shots: ${this.weapons.shots}  kills: ${this.kills}  typos: ${this.typing.typos}`,
      `last shot: ${shot ? `${shot.distance}px  x${shot.multiplier.toFixed(2)}` : '-'}  staggered: ${this.player.staggered}`,
      `thrown: ${this.weapons.thrown}  grenades in air: ${this.weapons.grenades.length}`,
      `words: ${this.dummies.map((d) => d.word ?? '-').join(', ')}`,
      `crates: ${this.airdrops.crates.map((c) => `${c.item.key} (${c.state})`).join(', ') || '-'}  next drop: ${Math.ceil(this.airdrops.timeToNextDrop / 1000)}s  drops: ${this.airdrops.drops.length}  pickups: ${this.pickups.pickups}`,
    ]);
  }
}