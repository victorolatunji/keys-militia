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
import { MODES, MODE_SELECT } from '../data/modes.js';
import MatchSystem from '../systems/MatchSystem.js';
import PartnerSystem from '../systems/PartnerSystem.js';
import { PARTNER } from '../data/partner.js';

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
  quicksand: 'Swallowed by quicksand',
  cactus: 'Pricked to death by a cactus',
  boulder: 'Crushed by a boulder',
  hands: 'Dragged under by the dead',
  rockfall: 'Hit by falling rock',
  toxic: 'Poisoned by toxic waste',
  radiation: 'Radiation poisoning',
  acid: 'Burned by acid rain',
  meteor: 'Hit by a meteor',
  icicle: 'Speared by an icicle',
};

// Deaths to the map itself (not a weapon). A bot you hurt badly just before
// counts as your kill, like a fall into the void.
const MAP_DEATHS = new Set(['void', 'lava', 'drown', 'geyser', 'env', 'quicksand', 'cactus', 'boulder', 'hands', 'rockfall', 'toxic', 'radiation', 'acid', 'meteor', 'icicle']);

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.map = MAPS[data.mapKey] ?? MAPS[MAP_SELECT.default];
    this.mode = MODES[data.modeKey] ?? MODES[this.mode?.key] ?? MODES[MODE_SELECT.default];
    // A mode only plays on maps that fit it (Zombies can't fly).
    if (this.mode.maps && !this.mode.maps.includes(this.map.key)) this.map = MAPS[this.mode.maps[0]];
    this.matchOver = false;
    this.partnerKey = data.partnerKey !== undefined ? data.partnerKey : (this.partnerKey ?? null);
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
    this.input.keyboard.on(`keydown-${MODE_SELECT.key}`, () => this.nextMode());
    this.input.keyboard.addCapture(MODE_SELECT.key); // keep the browser from using the key
    this.input.keyboard.on(`keydown-${PARTNER.select.key}`, () => this.nextPartner());
    this.input.keyboard.addCapture(PARTNER.select.key);

    // World bounds: walls left, right and top. No floor: below is the void
    // (maps with no void, like Catacombs and Graveyard, get a floor too).
    this.physics.world.setBounds(0, 0, width, height, true, true, true, !this.map.void);
    this.physics.world.gravity.y = this.map.gravity ?? 800; // Space: very low

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

    // Glacier's icicles are word targets too.
    this.hazards.registerTargets(this.typing);

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
    // A mode with a clock (You vs Military) sets who comes and how many.
    const ramp = this.mode.ramp?.[0];
    const waves = Boolean(this.mode.waves);
    const settings = ramp ? { slots: { main: ramp.bots }, families: [this.mode.family], allowed: ramp.types } : waves ? { slots: {} } : this.map.enemies;
    this.spawner = new EnemySpawner(this, settings);
    this.match = ramp || waves ? new MatchSystem(this, this.mode) : null;
    this.bots = this.spawner.startingSlots().map((slot) => this.spawnBot(slot));
    this.botCombat = new BotCombat(
      this, this.groundLayer, this.player, this.bots, this.weapons, this.collisions, height
    );
    if (ramp) this.botCombat.maxTurns = ramp.turns;

    // Crates parachute in on a timer; get near a landed one to pick up its item.
    this.airdrops = new AirdropSystem(this, this.groundLayer, { width, height }, this.collisions);
    this.pickups = new PickupSystem(this, this.player, this.weapons, this.airdrops);
    if (ramp) this.airdrops.difficulty = ramp.drops;

    // Duo: your AI partner (the character picked with the ` key).
    this.partner = this.partnerKey ? new PartnerSystem(this, this.partnerKey) : null;

    this.voidSystem = this.map.void
      ? new VoidSystem(this, this.map, { width, height }, (player) => player.kill('void'))
      : null;

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
      .text(16, 92, '', { fontFamily: 'monospace', fontSize: '14px', color: '#aaaacc' })
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

  spawnBot(slot, given = null) {
    const config = given ?? this.tuned(this.spawner.pick(slot));
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
    // (checks the whole width of a body, so it never drops in inside ragged rock)
    const clear = (yy) => [-16, 0, 16].every((dx) => !isSolid(this.groundLayer, p.x + dx, yy - 24) && !isSolid(this.groundLayer, p.x + dx, yy + 24));
    while (y - step > Math.max(BOT_DROP_Y, p.y - BOT_DROP_PX) && clear(y - step)) y -= step;
    return y;
  }

  // An enemy type, tuned for the match's current stage (if a mode has one).
  tuned(config) {
    return this.match ? this.match.tune(config) : config;
  }

  // F7 (testing, until the menus): the next mode, remembered in this browser.
  nextMode() {
    const order = MODE_SELECT.order;
    const next = order[(order.indexOf(this.mode.key) + 1) % order.length];
    try {
      window.localStorage.setItem(MODE_SELECT.storageKey, next);
    } catch {
      // storage blocked
    }
    const maps = MODES[next].maps;
    const mapKey = !maps || maps.includes(this.map.key) ? this.map.key : maps[0];
    this.scene.restart({ mapKey, modeKey: next, partnerKey: this.partnerKey });
  }

  // ` (testing, until the menus): Solo → each character as your partner → Solo.
  nextPartner() {
    const order = [null, ...PARTNER.select.order];
    const next = order[(order.indexOf(this.partnerKey) + 1) % order.length];
    try {
      window.localStorage.setItem(PARTNER.select.storageKey, next ?? '');
    } catch {
      // storage blocked
    }
    this.scene.restart({ mapKey: this.map.key, modeKey: this.mode.key, partnerKey: next });
  }

  // F6 (testing): the next map in MAP_SELECT.order, remembered in this browser.
  nextMap() {
    // Only the maps that fit the mode (all of them in Free play).
    const order = this.mode.maps ?? MAP_SELECT.order;
    const next = order[(order.indexOf(this.map.key) + 1) % order.length];
    try {
      window.localStorage.setItem(MAP_SELECT.storageKey, next);
    } catch {
      // storage blocked: still switch, just not remembered
    }
    this.scene.restart({ mapKey: next, modeKey: this.mode.key, partnerKey: this.partnerKey });
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

    // Waves: no respawn (the wave sends the next one).
    if (this.match?.waves) {
      this.match.onBotDeath(bot);
      return;
    }

    // A new random enemy takes its slot after a moment.
    this.time.delayedCall(bot.config.respawnDelay, () => {
      if (this.matchOver) return;
      const next = this.tuned(this.spawner.pick(bot.slot));
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

    let message = (cause === 'void' && this.map.void?.deathMessage) || DEATH_MESSAGES[cause] || 'You died';
    const attacker = this.player.lastAttacker;
    if (cause === 'bot' && attacker) {
      attacker.kills += 1;
      message = `Killed by a ${attacker.config.name}`;
    }
    this.message.setText(message).setVisible(true);
    this.match?.onPlayerDeath(cause, cause === 'bot' ? attacker : null);

    this.time.delayedCall(PLAYER.respawnDelay, () => {
      if (this.matchOver) return;
      this.message.setVisible(false);
      this.player.respawn();
      this.weapons.resetLoadout(); // back to the default guns and grenades
    });
  }

  update(time, delta) {
    this.match?.update();
    if (this.matchOver) return; // the result is up: everything stops
    this.player.update(delta);
    for (const dummy of this.dummies) dummy.update();
    this.spawner.update();
    for (const bot of this.bots) bot.update(delta);
    this.partner?.update(delta);
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
    this.voidSystem?.update(this.player);
    for (const bot of this.bots) this.voidSystem?.update(bot);
    if (this.partner) this.voidSystem?.update(this.partner.bot);
    this.hud.update(this.player, this.typing, this.weapons);

    const b = this.player.body;
    const lock = this.typing.lock;
    const shot = this.weapons.lastShot;
    this.debugText.setText([
      `map: ${this.map.name} (F6 next)  mode: ${this.mode.name} (F8)  ${this.partner ? `ally: ${this.partner.config.name} kills ${this.partner.kills}` : 'solo'} (key left of 1)  x: ${Math.round(this.player.x)}  y: ${Math.round(this.player.y)}  ${this.player.hidden ? 'HIDDEN' : ''}${this.player.submerged ? ` breath ${Math.ceil(this.player.hazard.breath / 1000)}s` : ''}`,
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