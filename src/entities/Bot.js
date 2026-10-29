import Player from './Player.js';
import WordLabel from '../ui/WordLabel.js';
import BotBrain from '../systems/BotBrain.js';
import BotGear from '../systems/BotGear.js';
import { iconKey } from '../ui/Icons.js';
import { BOT_AI } from '../data/enemies.js';
import { PLAYER } from '../data/player.js';

const HP_WIDTH = 40;
const HP_HEIGHT = 6;
const HP_COLOR = 0xff4d6d;

// An enemy bot. It extends Player, so it runs, flies, burns fuel, falls,
// takes damage and gets knocked back exactly like you. Instead of the
// keyboard, its BotBrain presses a "virtual controller" every frame.
// It is also a typing target: word label and HP bar above its head.
// It carries gear like yours (BotGear); the weapon in its hand is shown
// at its side, so you can see what it's holding.
// One Bot object is reused for every enemy that spawns in its slot:
// setType() turns it into another character (looks, HP, speed, gear).
// Emits 'died' (cause): 'player' (you killed it), 'self' (its own blast) or 'void'.
export default class Bot extends Player {
  // config: a BOTS entry. getTarget(): who it fights (you, for now).
  // slot: which spawn slot it fills ('main', 'machine', 'animal').
  constructor(scene, x, y, config, groundLayer, getTarget, slot = 'main') {
    super(scene, x, y, config.color, Bot.statsFor(config));
    this.slot = slot;
    this.kills = 0;           // times it killed you
    this.spottedAt = 0;       // when it last started seeing you (BotCombat)
    this.nextShotAt = 0;
    this.hurtLog = [];        // recent damage from you: { at, amount }
    this.flinchUntil = 0;     // hit by you: aim thrown off until then
    this.setType(config);
    this.heldIcon = scene.add.image(x, y, iconKey({ type: 'gun', key: this.gear.current.key }))
      .setScale(0.5)
      .setDepth(1);

    // Typing target fields (same as a dummy).
    this.word = null;
    this.lastWord = null;
    this.wordExpiresAt = 0;

    this.hpBg = scene.add.rectangle(0, 0, HP_WIDTH + 2, HP_HEIGHT + 2, 0x000000, 0.6);
    this.hpFill = scene.add.rectangle(0, 0, HP_WIDTH, HP_HEIGHT, HP_COLOR).setOrigin(0, 0.5);
    this.label = new WordLabel(scene);
    this.label.setVisible(false);

    this.brain = new BotBrain(this, groundLayer, getTarget);
    this.layout();
  }

  // Become this character: looks, size, HP, speeds, movement and a fresh loadout.
  setType(config) {
    this.config = config;
    this.stats = Bot.statsFor(config);
    this.baseColor = config.color;
    this.setFillStyle(config.color);
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.gear = new BotGear(config);
    this.fuseUntil = 0; // bombers

    // Size (drones and dogs are smaller, mutants bigger). The physics body
    // follows the rectangle's size.
    const size = config.size ?? { width: PLAYER.width, height: PLAYER.height };
    this.setSize(size.width, size.height);
    this.body.setSize(size.width, size.height);

    // Flyers ignore gravity.
    const flyer = this.movement === 'flyer';
    this.body.setAllowGravity(!flyer);

  }

  // 'jetpack' (default), 'walker', 'leaper' or 'flyer'.
  get movement() {
    return this.config.movement ?? 'jetpack';
  }

  // Walkers and leapers: jump if standing on something.
  jump() {
    if (this.onGround && this.config.jumpSpeed) this.body.setVelocityY(-this.config.jumpSpeed);
  }

  // Your movement stats, scaled by the bot type's speeds, with its own HP.
  // Thrust never drops below what it takes to beat gravity (800). No regen.
  // Walkers and leapers get no jetpack fuel at all.
  static statsFor(config) {
    const scale = config.speedScale ?? 1;
    const jet = config.jetScale ?? 1;
    const movement = config.movement ?? 'jetpack';
    const noJetpack = movement === 'walker' || movement === 'leaper';
    return {
      ...PLAYER,
      maxHp: config.hp,
      regenPerSec: 0,
      runSpeed: PLAYER.runSpeed * scale,
      airSpeed: PLAYER.airSpeed * (config.airScale ?? scale),
      maxRiseSpeed: PLAYER.maxRiseSpeed * jet,
      jetThrust: Math.max(1000, PLAYER.jetThrust * jet),
      fuelMax: noJetpack ? 0 : PLAYER.fuelMax,
      fuelRefill: noJetpack ? 0 : PLAYER.fuelRefill,
    };
  }

  // Buttons the brain presses (same shape as the arrow keys).
  createControls() {
    return {
      left: { isDown: false },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
    };
  }

  get controls() {
    return this.cursors;
  }

  update(delta) {
    if (this.alive && this.movement === 'flyer') {
      // Drones set their own speed (BotBrain.fly); no running or jetpack.
      this.brain.update(delta);
      if (this.brain.sees && this.brain.target) this.faceToward(this.brain.target.x);
      this.updateVisuals();
    } else if (this.alive) {
      this.brain.update(delta);
      super.update(delta);
      // Keep facing you while it can see you (even when backing off).
      if (this.brain.sees && this.brain.target) this.faceToward(this.brain.target.x);
    }
    this.layout();
  }

  setWord(word) {
    this.word = word;
    if (word) this.lastWord = word;

    this.label.setWord(word ?? '');
    this.label.setVisible(Boolean(word) && this.alive);
    this.layout();
  }

  // Your bullets, blasts and melee land here (no cause = it was you).
  // Your hits make it flinch: its aim is thrown off and its next shot waits.
  takeDamage(amount, cause = 'player') {
    if (!this.alive) return;
    if (cause === 'player') {
      const now = this.scene.time.now;
      this.hurtLog.push({ at: now, amount });
      this.flinchUntil = now + BOT_AI.flinch.ms;
      this.nextShotAt = Math.max(this.nextShotAt, now) + BOT_AI.flinch.delayMs;
    }
    super.takeDamage(amount, cause);
    this.layout();
  }

  // Heavy characters barely move when hit.
  applyKnockback(vx, vy) {
    const k = this.config.knockbackScale ?? 1;
    super.applyKnockback(vx * k, vy * k);
  }

  get flinching() {
    return this.scene.time.now < this.flinchUntil;
  }

  // Fell into the void soon after you hurt it badly: still your kill.
  get fallCredited() {
    const { windowMs, share } = BOT_AI.fallCredit;
    const since = this.scene.time.now - windowMs;
    const recent = this.hurtLog
      .filter((h) => h.at >= since)
      .reduce((sum, h) => sum + h.amount, 0);
    return recent >= this.maxHp * share;
  }

  die() {
    super.die();
    this.setWord(null);
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.heldIcon.setVisible(false);
  }

  // Drop back in, optionally as a different character (config).
  respawn(point, config) {
    if (config) this.setType(config);
    super.respawn(point);
    this.hurtLog = [];
    this.spottedAt = 0;
    this.nextShotAt = 0;
    this.nextThrowAt = 0;
    this.flinchUntil = 0;
    this.gear.reset();
    this.brain.reset();
    this.heldIcon.setVisible(true);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
    this.layout();
  }

  layout() {
    const top = this.y - this.height / 2;

    this.hpBg.setPosition(this.x, top - 10);
    this.hpFill.setPosition(this.x - HP_WIDTH / 2, top - 10);
    this.hpFill.scaleX = this.hp / this.maxHp;

    this.label.setPosition(this.x, top - 32);

    // Weapon in hand, at its side, facing the way it faces
    // (none for claws, fists and the like).
    this.heldIcon.setVisible(this.alive && !this.gear.current.natural);
    const key = iconKey({ type: 'gun', key: this.gear.current.key });
    if (this.heldIcon.texture.key !== key) this.heldIcon.setTexture(key);
    this.heldIcon.setPosition(this.x + this.facing * 14, this.y + 4).setFlipX(this.facing < 0);
  }
}