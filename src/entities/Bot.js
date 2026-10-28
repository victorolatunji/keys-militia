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
// Emits 'died' (cause): 'player' (you killed it), 'self' (its own blast) or 'void'.
export default class Bot extends Player {
  // config: a BOTS entry. getTarget(): who it fights (you, for now).
  constructor(scene, x, y, config, groundLayer, getTarget) {
    super(scene, x, y, config.color, Bot.statsFor(config));
    this.config = config;
    this.kills = 0;           // times it killed you
    this.spottedAt = 0;       // when it last started seeing you (BotCombat)
    this.nextShotAt = 0;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.hurtLog = [];        // recent damage from you: { at, amount }
    this.gear = new BotGear(config.loadout);
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

  // Your movement stats, scaled by the bot type's speeds, with its own HP.
  // Thrust never drops below what it takes to beat gravity (800).
  static statsFor(config) {
    const scale = config.speedScale ?? 1;
    const jet = config.jetScale ?? 1;
    return {
      ...PLAYER,
      maxHp: config.hp,
      runSpeed: PLAYER.runSpeed * scale,
      airSpeed: PLAYER.airSpeed * scale,
      maxRiseSpeed: PLAYER.maxRiseSpeed * jet,
      jetThrust: Math.max(1000, PLAYER.jetThrust * jet),
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
    if (this.alive) {
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
  takeDamage(amount, cause = 'player') {
    if (!this.alive) return;
    if (cause === 'player') this.hurtLog.push({ at: this.scene.time.now, amount });
    super.takeDamage(amount, cause);
    this.layout();
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

  respawn(point) {
    super.respawn(point);
    this.hurtLog = [];
    this.spottedAt = 0;
    this.nextShotAt = 0;
    this.nextThrowAt = 0;
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

    // Weapon in hand, at its side, facing the way it faces.
    const key = iconKey({ type: 'gun', key: this.gear.current.key });
    if (this.heldIcon.texture.key !== key) this.heldIcon.setTexture(key);
    this.heldIcon.setPosition(this.x + this.facing * 14, this.y + 4).setFlipX(this.facing < 0);
  }
}