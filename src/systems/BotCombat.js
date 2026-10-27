import Phaser from 'phaser';
import EnemyBullet from '../entities/EnemyBullet.js';
import { WEAPONS } from '../data/weapons.js';
import { BULLETS, BULLET_DEFAULT, MUZZLE_FLASH } from '../data/bullets.js';
import { BOT_BULLETS, WORD_LETTERS } from '../data/enemies.js';

const HIT_COLOR = '#ff4d6d';
const PELLET_SPREAD_DEG = 8;  // shotgun pellets fan out this much either way

// Bots shooting at you. A bot fires only while it can see you, after a
// reaction delay, then once per "typed" attack (same words as yours, at
// its typing speed). Its bullets are real: aimed with some error, they
// fly straight, can miss, and walls stop them.
export default class BotCombat {
  constructor(scene, groundLayer, player, bots) {
    this.scene = scene;
    this.groundLayer = groundLayer;
    this.player = player;
    this.bots = bots;
    this.bullets = [];
    this.shotsFired = 0;
    this.hits = 0;
  }

  update(delta) {
    const now = this.scene.time.now;
    for (const bot of this.bots) this.updateBot(bot, now);

    this.bullets = this.bullets.filter((b) => b.active);
    for (const bullet of this.bullets) bullet.update(delta);
  }

  updateBot(bot, now) {
    const { brain } = bot;
    const gun = WEAPONS[bot.config.gun];
    const canShoot = bot.alive && !bot.staggered && brain.sees && brain.target && gun?.tracerColor;

    if (!canShoot) {
      bot.spottedAt = 0; // lost sight: it has to react again next time
      return;
    }

    // Just spotted you: react, then "type" the first word.
    if (!bot.spottedAt) {
      bot.spottedAt = now;
      bot.nextShotAt = Math.max(bot.nextShotAt, now + bot.config.reactionMs + this.typeTime(bot, gun));
    }

    if (now >= bot.nextShotAt) {
      this.attack(bot, brain.target, gun);
      bot.nextShotAt = now + this.typeTime(bot, gun);
    }
  }

  // ms to type one attack's words with this gun (±20%, people aren't metronomes).
  typeTime(bot, gun) {
    const letters = WORD_LETTERS[gun.wordList] * (gun.wordsPerShot ?? 1);
    return (letters / bot.config.typingSpeed) * 1000 * Phaser.Math.FloatBetween(0.8, 1.2);
  }

  // One attack: the gun's bullets, as a burst (one after another) or
  // pellets (all at once), sharing the damage like yours do.
  attack(bot, target, gun) {
    const hits = gun.hits ?? 1;
    const delay = gun.hitDelayMs ?? 0;
    const pellets = delay === 0 && hits > 1;
    const per = Math.floor(gun.damage / hits);
    const last = gun.damage - per * (hits - 1);

    for (let i = 0; i < hits; i++) {
      const amount = i === hits - 1 ? last : per;
      const shoot = () => {
        if (!bot.alive || bot.staggered) return; // a dead or stunned bot stops shooting
        const fan = pellets ? Phaser.Math.FloatBetween(-PELLET_SPREAD_DEG, PELLET_SPREAD_DEG) : 0;
        this.fireBullet(bot, target, gun, amount, fan);
      };

      if (i === 0 || pellets) shoot();
      else this.scene.time.delayedCall(i * delay, shoot);
    }
  }

  fireBullet(bot, target, gun, amount, fanDeg) {
    const style = BULLETS[gun.category] ?? BULLET_DEFAULT;
    const x = bot.x + bot.facing * 16;
    const y = bot.y - 4;

    const angle = this.aimAngle(bot, target, x, y, style.speed) + Phaser.Math.DegToRad(fanDeg);
    const look = { length: style.length, width: BOT_BULLETS.width, color: BOT_BULLETS.color };

    const bullet = new EnemyBullet(
      this.scene, x, y, angle, style.speed, look, this.groundLayer, target, BOT_BULLETS.maxRangePx,
      (victim, distance) => this.hit(bot, victim, gun, amount, distance)
    );
    this.bullets.push(bullet);
    this.shotsFired += 1;
    this.muzzleFlash(x, y);
  }

  // Where the bot aims: at you, led a little by your speed, then thrown off
  // by its aim error (worse when you move, and when it's moving itself).
  aimAngle(bot, target, x, y, speed) {
    const { aim } = bot.config;
    const tv = target.body.velocity;
    const travel = Phaser.Math.Distance.Between(x, y, target.x, target.y) / speed;
    const aimX = target.x + tv.x * travel * aim.lead;
    const aimY = target.y + tv.y * travel * aim.lead;

    const targetSpeed = Math.hypot(tv.x, tv.y) / target.stats.runSpeed;
    const botMoving = Math.hypot(bot.body.velocity.x, bot.body.velocity.y) > 20 || !bot.onGround;
    const errorDeg =
      aim.spreadDeg + aim.movingTargetDeg * Math.min(1.5, targetSpeed) + (botMoving ? aim.selfMovingDeg : 0);

    // Two randoms averaged: small misses are common, big ones rare.
    const roll = (Math.random() + Math.random() - 1) * errorDeg;
    return Phaser.Math.Angle.Between(x, y, aimX, aimY) + Phaser.Math.DegToRad(roll);
  }

  hit(bot, victim, gun, amount, distance) {
    const scale = bot.config.damageScale ?? 1;
    const damage = Math.max(1, Math.round(amount * scale * this.falloff(gun.falloff, distance)));
    victim.lastAttacker = bot;
    victim.takeDamage(damage, 'bot');
    this.hits += 1;

    if (victim === this.player) this.scene.cameras.main.shake(60, 0.002);
    this.floatDamage(victim, damage);
  }

  // Same range falloff rule as your guns.
  falloff(falloff, distance) {
    if (!falloff || distance <= falloff.startPx) return 1;
    if (distance >= falloff.endPx) return falloff.minMultiplier;
    const t = (distance - falloff.startPx) / (falloff.endPx - falloff.startPx);
    return 1 - t * (1 - falloff.minMultiplier);
  }

  muzzleFlash(x, y) {
    const flash = this.scene.add.circle(x, y, MUZZLE_FLASH.radius, MUZZLE_FLASH.color).setDepth(41);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 0.4,
      duration: MUZZLE_FLASH.durationMs,
      onComplete: () => flash.destroy(),
    });
  }

  floatDamage(victim, amount) {
    const text = this.scene.add
      .text(victim.x + Phaser.Math.Between(-8, 8), victim.y - 34, `-${amount}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: HIT_COLOR,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(60);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }
}