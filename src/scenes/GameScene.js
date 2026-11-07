import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Dummy from '../entities/Dummy.js';
import EffectsSystem from '../systems/EffectsSystem.js';
import SoundSystem from '../systems/SoundSystem.js';
import BlastFx from '../systems/BlastFx.js';
import { JUICE } from '../data/effects.js';
import Bot from '../entities/Bot.js';
import Hud from '../ui/Hud.js';
import VoidSystem from '../systems/VoidSystem.js';
import TypingSystem from '../systems/TypingSystem.js';
import WeaponSystem from '../systems/WeaponSystem.js';
import AirdropSystem from '../systems/AirdropSystem.js';
import CollisionSystem from '../systems/CollisionSystem.js';
import PickupSystem from '../systems/PickupSystem.js';
import BotCombat from '../systems/BotCombat.js';
import EnemySpawner from '../systems/EnemySpawner.js';
import { isSolid, groundBelow } from '../systems/Terrain.js';
import HazardSystem from '../systems/HazardSystem.js';
import BackdropSystem from '../systems/BackdropSystem.js';
import { MAPS, MAP_SELECT } from '../data/maps.js';
import { PLAYER } from '../data/player.js';

const BOT_DROP_Y = 40;     // bots drop in from no higher than this...
const BOT_DROP_PX = 600;   // ...and at most this far above their spawn point
const WALKER_MIN_GAP = 220; // walkers drop in at least this far from you
const WALKER_DROP_PX = 120; // ...from this high above the ground

// What the death message says for each cause.
const DEATH_MESSAGES = {
  void: 'Fell into the void',
  self: 'Blew yourself up',
  lava: 'Melted in lava',
  drown: 'Drowned',
  geyser: 'Caught by a fire geyser',
  env: 'Burned to death',
};

// Deaths to the map itself (not a weapon). A bot you hurt badly just before
// counts as your kill, like a fall into the void.
const MAP_DEATHS = new Set(['void', 'lava', 'drown', 'geyser', 'env']);

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.map = MAPS[data.mapKey] ?? MAPS[MAP_SELECT.default];
    this.deaths = 0;
    this.suicides = 0;
    this.kills = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor(this.map.background);

    const { width, height, spawn, dummySpawns, botSpawns } = this.buildTilemap();
    this.spawnPoints = [spawn, ...dummySpawns, ...botSpawns]; // bots drop in above one of these

    // Water, lava, geysers, vents, bushes (before bots and crates: they keep
    // out of water and lava), and the sky, hills and decor behind it all.
    this.hazards = new HazardSystem(this, this.tilemap, this.map, this.groundLayer);
    this.backdrop = new BackdropSystem(this, this.map, this.tilemap, this.groundLayer, { width, height });
    this.input.keyboard.on(`keydown-${MAP_SELECT.key}`, () => this.nextMap());

    // World bounds: walls left, right and top. No floor: below is the void.
    this.physics.world.setBounds(0, 0, width, height, true, true, true, false);

    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player, this.groundLayer);
    this.player.on('died', (cause) => this.handlePlayerDeath(cause));

    // Blood, sparks, splats and gibs (looks only). F2 cycles the gore level.
    this.effects = new EffectsSystem(this, this.groundLayer);
    // Explosions, tactical bursts and heat vision in clouds.
    this.blastFx = new BlastFx(this, this.groundLayer, this.effects);
    // Sounds made in code (no files). F4 turns sound on/off.
    this.sfx = new SoundSystem(this);

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
      dummy.on('died', () => {
        this.kills += 1;
        this.hitStop();
      });
    }

    // Enemies: one bot per spawn slot in the map config; types picked at random.
    this.spawner = new EnemySpawner(this, this.map.enemies);
    this.bots = this.spawner.startingSlots().map((slot) => this.spawnBot(slot));
    this.botCombat = new BotCombat(
      this, this.groundLayer, this.player, this.bots, this.weapons, this.collisions, height
    );

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

  // Hit-stop: everything with physics freezes for a moment when you land a
  // kill, with a small shake, so kills feel heavy. (Real-time timer: the
  // game's own clock keeps running so nothing else gets out of step.)
  hitStop() {
    const { hitStopMs, killShake } = JUICE;
    this.cameras.main.shake(killShake.ms, killShake.power);
    if (this.hitStopping) return;
    this.hitStopping = true;
    this.physics.world.pause();
    window.setTimeout(() => {
      this.hitStopping = false;
      if (this.sys.isActive()) this.physics.world.resume();
    }, hitStopMs);
  }

  spawnBot(slot) {
    const config = this.spawner.pick(slot);
    const point = this.botSpawnPoint(config);
    const bot = new Bot(this, point.x, point.y, config, this.groundLayer, () => this.player, slot);

    this.physics.add.collider(bot, this.groundLayer);
    this.collisions.addCharacter(bot);
    this.typing.addTarget(bot);
    bot.on('died', (cause) => this.handleBotDeath(bot, cause));
    return bot;
  }

  // Drop in above a spawn point far from you. Walkers can't fly across
  // gaps, so they drop onto the ground you're on, at its far end.
  botSpawnPoint(config) {
    const walks = config && (config.movement === 'walker' || config.movement === 'leaper');
    if (walks) {
      const point = this.walkerSpawnPoint();
      if (point) return point;
    }

    // One of the three points farthest from you, at random (so they don't
    // all pile in at the same spot).
    const far = (p) => Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y);
    const farthest = [...this.spawnPoints].sort((a, b) => far(b) - far(a)).slice(0, 3);
    const best = Phaser.Utils.Array.GetRandom(farthest);
    return { x: best.x, y: this.dropY(best) };
  }

  // How high above a spawn point a bot drops in from: up to BOT_DROP_PX,
  // but never through a ceiling (points under the map drop from just under it).
  dropY(p) {
    const step = this.groundLayer.tilemap.tileHeight / 2;
    let y = p.y - 40;
    while (y - step > Math.max(BOT_DROP_Y, p.y - BOT_DROP_PX) && !isSolid(this.groundLayer, p.x, y - step - 24)) y -= step;
    return y;
  }

  // F6 (testing): the next map in MAP_SELECT.order, remembered in this browser.
  nextMap() {
    const order = MAP_SELECT.order;
    const next = order[(order.indexOf(this.map.key) + 1) % order.length];
    try {
      window.localStorage.setItem(MAP_SELECT.storageKey, next);
    } catch {
      // storage blocked: still switch, just not remembered
    }
    this.scene.restart({ mapKey: next });
  }

  // The far end of the ground under you that it can walk to you from
  // (stops at edges and walls), or null (you're over the void, or it's too short).
  walkerSpawnPoint() {
    const layer = this.groundLayer;
    const p = this.player;
    const below = groundBelow(layer, p.x, p.body.bottom);
    if (below === null) return null;

    const surfaceY = p.body.bottom + below + 2; // inside the top row of tiles
    const step = layer.tilemap.tileWidth;
    let left = p.x;
    let right = p.x;
    // Walk the ground both ways until it ends or a wall blocks the way.
    const open = (x) => isSolid(layer, x, surfaceY) && !isSolid(layer, x, surfaceY - 24);
    while (open(left - step)) left -= step;
    while (open(right + step)) right += step;

    const x = p.x - left > right - p.x ? left + 24 : right - 24;
    if (Math.abs(x - p.x) < WALKER_MIN_GAP) return null;

    // Drop from a little above the ground, unless something is in the way.
    const top = surfaceY - 4;
    const clear = groundBelow(layer, x, top - WALKER_DROP_PX) >= WALKER_DROP_PX - layer.tilemap.tileHeight;
    return { x, y: clear ? top - WALKER_DROP_PX : top - 40 };
  }

  handleBotDeath(bot, cause) {
    // Your kill: you finished it, or it fell into the void soon after you hurt it.
    if (cause === 'player' || (MAP_DEATHS.has(cause) && bot.fallCredited)) this.kills += 1;
    if (cause === 'player') this.hitStop(); // your kill: a split-second freeze

    // Only Military enemies (the ones that swap weapons) drop their gear,
    // like you. Everyone else vanishes with theirs: a cleaner battlefield.
    if (cause !== 'void' && cause !== 'lava' && bot.gear.smart && bot.config.dropsGear !== false) {
      this.airdrops.dropItems(bot.x, bot.y, bot.gear.items());
    }

    // A new random enemy takes its slot after a moment.
    this.time.delayedCall(bot.config.respawnDelay, () => {
      const next = this.spawner.pick(bot.slot);
      bot.respawn(this.botSpawnPoint(next), next);
    });
  }

  // Builds the level from the Tiled file. Needs a tile layer "ground"
  // and an object layer "spawns" with a point named "player".
  // Optional: points named "dummy" (placed at the dummy's feet).
  buildTilemap() {
    const { key, tilemapKey, tilesetName, tilesetKey } = this.map;

    const tilemap = this.make.tilemap({ key: tilemapKey });
    this.tilemap = tilemap;
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
    const botSpawns = tilemap.filterObjects('spawns', (obj) => obj.name === 'bot') ?? [];

    return {
      width: tilemap.widthInPixels,
      height: tilemap.heightInPixels,
      spawn: { x: spawn.x, y: spawn.y },
      dummySpawns: dummySpawns.map((obj) => ({ x: obj.x, y: obj.y })),
      botSpawns: botSpawns.map((obj) => ({ x: obj.x, y: obj.y })),
    };
  }

  // Every player death (void, own grenade, later enemies) lands here.
  handlePlayerDeath(cause) {
    this.typing.reset();      // clears your lock and progress
    this.weapons.cancelAim(); // and any throw in progress

    // Your gear spills out where you died (not in the void: it would just fall).
    if (cause !== 'void' && cause !== 'lava') {
      this.airdrops.dropItems(this.player.x, this.player.y, this.weapons.loadoutItems());
    }
    this.deaths += 1;
    if (cause === 'self') this.suicides += 1;

    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(250, 120, 0, 40);

    let message = (cause === 'void' && this.map.void.deathMessage) || DEATH_MESSAGES[cause] || 'You died';
    const attacker = this.player.lastAttacker;
    if (cause === 'bot' && attacker) {
      attacker.kills += 1;
      message = `Killed by a ${attacker.config.name}`;
    }
    this.message.setText(message).setVisible(true);

    this.time.delayedCall(PLAYER.respawnDelay, () => {
      this.message.setVisible(false);
      this.player.respawn();
      this.weapons.resetLoadout(); // back to the default guns and grenades
    });
  }

  update(time, delta) {
    this.player.update(delta);
    for (const dummy of this.dummies) dummy.update();
    this.spawner.update();
    for (const bot of this.bots) bot.update(delta);
    this.hazards.update(); // after everyone moved: water slows, lava burns
    this.backdrop.update(delta);
    this.botCombat.update(delta);
    this.typing.update();
    this.weapons.update(delta);
    this.airdrops.update(delta);
    this.pickups.update();
    this.effects.update(delta);
    this.sfx.updateJet(this.player.alive && this.player.thrusting, this.player.boosted);
    this.sfx.endFrame(); // loops nobody held this frame fade out
    this.voidSystem.update(this.player);
    for (const bot of this.bots) this.voidSystem.update(bot);
    this.hud.update(this.player, this.typing, this.weapons);

    const b = this.player.body;
    const lock = this.typing.lock;
    const shot = this.weapons.lastShot;
    this.debugText.setText([
      `map: ${this.map.name} (F6 next)  x: ${Math.round(this.player.x)}  y: ${Math.round(this.player.y)}  ${this.player.hidden ? 'HIDDEN' : ''}${this.player.submerged ? ` breath ${Math.ceil(this.player.hazard.breath / 1000)}s` : ''}`,
      `vx: ${Math.round(b.velocity.x)}  vy: ${Math.round(b.velocity.y)}`,
      `onGround: ${this.player.onGround}  fuel: ${Math.round(this.player.fuel)}  hp: ${Math.round(this.player.hp)}`,
      `alive: ${this.player.alive}  deaths: ${this.deaths}  suicides: ${this.suicides}`,
      `lock: ${lock ? `${lock.word} (${this.typing.progress}/${lock.word.length})` : '-'}`,
      `shots: ${this.weapons.shots}  kills: ${this.kills}  typos: ${this.typing.typos}`,
      `last shot: ${shot ? `${shot.distance}px  x${shot.multiplier.toFixed(2)}` : '-'}  staggered: ${this.player.staggered}`,
      `thrown: ${this.weapons.thrown}  grenades in air: ${this.weapons.grenades.length}`,
      `words: ${this.dummies.map((d) => d.word ?? '-').join(', ')}`,
      `family: ${this.spawner.family}  attacking you: ${this.botCombat.turnsTaken}  shots: ${this.botCombat.shotsFired}  hit you: ${this.botCombat.hits}`,
      ...this.bots.map((bot) => `  ${bot.config.name}: ${bot.alive ? bot.brain.mode : 'dead'} hp${bot.hp} ${bot.gear.current.name}${bot.gear.smart && bot.gear.active !== 'melee' ? ` ${bot.gear.guns[bot.gear.active]?.ammo}` : ''}${bot.gear.smart ? ` g${bot.gear.throwableCount}` : ''}`),
      `crates: ${this.airdrops.crates.map((c) => `${c.item.picksLeft} picks (${c.state})`).join(', ') || '-'}  next drop: ${Math.ceil(this.airdrops.timeToNextDrop / 1000)}s  drops: ${this.airdrops.drops.length}  pickups: ${this.pickups.pickups}`,
    ]);
  }
}