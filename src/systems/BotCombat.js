import Phaser from 'phaser';
import EnemyBullet from '../entities/EnemyBullet.js';
import Grenade from '../entities/Grenade.js';
import Projectile from '../entities/Projectile.js';
import { GUN_SWITCH_MS } from '../data/weapons.js';
import { BULLETS, BULLET_DEFAULT, MUZZLE_FLASH } from '../data/bullets.js';
import { BOT_AI, BOT_BULLETS, WORD_LETTERS } from '../data/enemies.js';
import { hasLineOfSight } from './LineOfSight.js';

const HIT_COLOR = '#ff4d6d';
const NOTE_COLOR = '#c9c9c9';
const PELLET_SPREAD_DEG = 8;  // shotgun pellets fan out this much either way
const SWING_COLOR = 0xff4d6d;

// Bots fighting you with whatever is in their hands (BotGear).
// A bot attacks only while it can see you, after a reaction delay, then once
// per "typed" attack (same words as yours, at its typing speed).
// Attack turns: only a couple of bots shoot at you at the same time.
// A bot you just hit flinches (worse aim, next shot delayed).
// Guns fire real bullets that can miss; launchers fire real rounds;
// melee needs you within reach; grenades get lobbed at you, often when you hide.
// Explosions reuse your WeaponSystem's blast rules (falloff, walls, knockback).
export default class BotCombat {
  constructor(scene, groundLayer, player, bots, weapons, collisions, worldHeight) {
    this.scene = scene;
    this.groundLayer = groundLayer;
    this.player = player;
    this.bots = bots;
    this.weapons = weapons;
    this.collisions = collisions;
    this.worldHeight = worldHeight;

    this.bullets = [];
    this.thrown = [];   // grenades and launcher rounds in flight
    this.shotsFired = 0;
    this.hits = 0;
  }

  update(delta) {
    const now = this.scene.time.now;
    for (const bot of this.bots) {
      this.updateAttack(bot, now);
      this.updateGrenade(bot, now);
    }

    this.bullets = this.bullets.filter((b) => b.active);
    for (const bullet of this.bullets) bullet.update(delta);

    this.thrown = this.thrown.filter((g) => g.active);
    for (const thing of this.thrown) thing.update();
  }

  // ---- Attacks (guns, launchers, melee) ----

  updateAttack(bot, now) {
    const { brain, gear } = bot;
    const weapon = gear.current;
    const ready = bot.alive && !bot.staggered && brain.sees && brain.target && !gear.busy(now);

    if (!ready) {
      if (!brain.sees || !bot.alive) {
        bot.spottedAt = 0; // lost sight: it has to react again next time
        this.endTurn(bot, now);
      }
      return;
    }

    // Wait for an attack turn (only a couple of bots shoot at you at once).
    if (!this.hasTurn(bot, now)) return;

    // Melee: only once you're within reach.
    if (weapon.category === 'melee') {
      const d = Phaser.Math.Distance.Between(bot.x, bot.y, brain.target.x, brain.target.y);
      if (d > weapon.reach) return;
    }

    // Just spotted you: react, then "type" the first word.
    if (!bot.spottedAt) {
      bot.spottedAt = now;
      bot.nextShotAt = Math.max(bot.nextShotAt, now + bot.config.reactionMs + this.typeTime(bot, weapon));
    }
    if (now < bot.nextShotAt) return;

    if (weapon.category === 'melee') this.swing(bot, brain.target, weapon);
    else if (weapon.category === 'launcher') this.launch(bot, brain.target, weapon);
    else this.attack(bot, brain.target, weapon);

    const used = gear.useAmmo(now, GUN_SWITCH_MS);
    if (used === 'reload') this.note(bot, 'reloading');
    else if (used) this.note(bot, `${used.name} empty`);
    bot.nextShotAt = now + this.typeTime(bot, gear.current);
  }

  // ---- Attack turns ----

  // Does this bot get to attack now? It keeps a turn for holdMs, then rests
  // for restMs. New turns are only handed out while fewer than `max` are taken.
  hasTurn(bot, now) {
    const { max, holdMs, restMs } = BOT_AI.turns;
    if (bot.turnUntil > now) return true;
    if (now < (bot.turnRestUntil ?? 0)) return false;

    const taken = this.bots.filter((b) => b !== bot && b.alive && b.turnUntil > now).length;
    if (taken >= max) return false;

    bot.turnUntil = now + holdMs;
    bot.turnRestUntil = bot.turnUntil + restMs;
    // It was waiting with you in sight: a short moment to aim, not a full reaction.
    bot.nextShotAt = Math.max(bot.nextShotAt, now + bot.config.reactionMs * 0.5);
    return true;
  }

  endTurn(bot, now) {
    if (bot.turnUntil > now) {
      bot.turnUntil = now;
      bot.turnRestUntil = now + BOT_AI.turns.restMs;
    }
  }

  // How many bots are attacking you right now (for the debug readout).
  get turnsTaken() {
    const now = this.scene.time.now;
    return this.bots.filter((b) => b.alive && b.turnUntil > now).length;
  }

  // ms to type one attack's words with this weapon (±20%, people aren't metronomes).
  // Heavy hitters (LMGs, snipers, launchers) wait longer between attacks, so
  // no bot deals more than maxDps damage per second (before misses).
  typeTime(bot, weapon) {
    const letters = WORD_LETTERS[weapon.wordList] * (weapon.wordsPerShot ?? 1);
    const typing = (letters / bot.config.typingSpeed) * 1000;
    const damage = weapon.damage * this.scale(bot);
    const capped = (damage / BOT_AI.maxDps) * 1000;
    return Math.max(typing, capped) * Phaser.Math.FloatBetween(0.8, 1.2);
  }

  // Guns: the bullets as a burst (one after another) or pellets (all at once),
  // sharing the damage like yours do.
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
    const { x, y } = this.muzzle(bot);

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

  muzzle(bot) {
    return { x: bot.x + bot.facing * 16, y: bot.y - 4 };
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
    const errorDeg =
      aim.spreadDeg +
      aim.movingTargetDeg * Math.min(1.5, targetSpeed) +
      (this.moving(bot) ? aim.selfMovingDeg : 0) +
      (bot.flinching ? BOT_AI.flinch.aimDeg : 0);

    // Two randoms averaged: small misses are common, big ones rare.
    const roll = (Math.random() + Math.random() - 1) * errorDeg;
    return Phaser.Math.Angle.Between(x, y, aimX, aimY) + Phaser.Math.DegToRad(roll);
  }

  moving(bot) {
    return Math.hypot(bot.body.velocity.x, bot.body.velocity.y) > 20 || !bot.onGround;
  }

  hit(bot, victim, gun, amount, distance) {
    const damage = Math.max(1, Math.round(amount * this.scale(bot) * this.falloff(gun.falloff, distance)));
    this.damage(bot, victim, damage);
  }

  damage(bot, victim, amount) {
    victim.lastAttacker = bot;
    victim.takeDamage(amount, 'bot');
    this.hits += 1;
    if (victim === this.player) this.scene.cameras.main.shake(60, 0.002);
    this.floatText(victim, `-${amount}`, HIT_COLOR);
  }

  scale(bot) {
    return bot.config.damageScale ?? 1;
  }

  // Same range falloff rule as your guns.
  falloff(falloff, distance) {
    if (!falloff || distance <= falloff.startPx) return 1;
    if (distance >= falloff.endPx) return falloff.minMultiplier;
    const t = (distance - falloff.startPx) / (falloff.endPx - falloff.startPx);
    return 1 - t * (1 - falloff.minMultiplier);
  }

  // Melee: a red arc in front of it, then the hit (always lands within reach).
  swing(bot, target, weapon) {
    const g = this.scene.add.graphics().setDepth(40);
    const start = bot.facing > 0 ? -70 : 250;
    const end = bot.facing > 0 ? 50 : 130;
    g.lineStyle(5, SWING_COLOR, 0.9);
    g.beginPath();
    g.arc(bot.x + bot.facing * 6, bot.y - 6, weapon.reach * 0.6,
      Phaser.Math.DegToRad(start), Phaser.Math.DegToRad(end), bot.facing < 0);
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });

    if (weapon.knockback && target.applyKnockback) {
      target.applyKnockback(bot.facing * weapon.knockback, -weapon.knockback * 0.4);
    }
    this.damage(bot, target, Math.max(1, Math.round(weapon.damage * this.scale(bot))));
  }

  // ---- Explosives (launchers and grenades) ----

  // Launcher rounds, aimed with the same kind of error as bullets.
  launch(bot, target, weapon) {
    const spec = weapon.projectile;
    const count = spec.count ?? 1;
    for (let i = 0; i < count; i++) {
      const fireOne = () => {
        if (!bot.alive) return;
        this.spawnRound(bot, target, weapon, i > 0 ? spec.spread ?? 0 : 0);
      };
      if (i === 0) fireOne();
      else this.scene.time.delayedCall(i * spec.delayMs, fireOne);
    }
  }

  spawnRound(bot, target, weapon, spread) {
    const spec = weapon.projectile;
    const { x, y } = this.muzzle(bot);
    let vx;
    let vy;
    let fuseMs = null;

    if (spec.kind === 'rocket') {
      const angle = this.aimAngle(bot, target, x, y, spec.speed);
      vx = Math.cos(angle) * spec.speed;
      vy = Math.sin(angle) * spec.speed;
    } else {
      const t = spec.flightMs / 1000;
      const g = this.scene.physics.world.gravity.y;
      const error = 1 + Phaser.Math.FloatBetween(-1, 1) * (spread + BOT_AI.grenade.errorShare);
      vx = ((target.x - x) / t) * error;
      vy = (target.y - y) / t - (g * t) / 2;
      if (spec.kind === 'bomb') fuseMs = spec.flightMs + spec.fuseExtraMs;
    }

    const round = new Projectile(
      this.scene, x, y, vx, vy, spec, bot, this.groundLayer, this.worldHeight, [target], fuseMs
    );
    this.collisions.addGrenade(round);
    round.on('explode', (ex, ey) => {
      this.weapons.blastFx(ex, ey, weapon.blast.blastRadius);
      this.blast(bot, ex, ey, weapon.blast, this.scale(bot));
    });
    this.thrown.push(round);
    this.muzzleFlash(x, y);
  }

  // Lob a grenade now and then: sometimes while it sees you, more often when
  // you've just ducked behind cover close to where it last saw you.
  updateGrenade(bot, now) {
    const cfg = BOT_AI.grenade;
    const { brain, gear } = bot;
    if (!bot.alive || bot.staggered || gear.throwableCount <= 0) return;
    if (now < (bot.nextThrowCheck ?? 0)) return;
    bot.nextThrowCheck = now + cfg.checkMs;
    if (now < (bot.nextThrowAt ?? 0)) return;

    let spot = null;
    let chance = 0;
    if (brain.sees && brain.target) {
      spot = brain.target;
      chance = cfg.chanceSeen;
    } else if (brain.lastSeen && now - brain.lastSeen.at < cfg.hiddenMemoryMs) {
      spot = brain.lastSeen;
      chance = cfg.chanceHidden;
    }
    if (!spot || Math.random() >= chance) return;

    const dist = Phaser.Math.Distance.Between(bot.x, bot.y, spot.x, spot.y);
    if (dist < cfg.minRangePx || dist > cfg.maxRangePx) return;

    this.throwGrenade(bot, spot);
    bot.nextThrowAt = now + cfg.cooldownMs;
  }

  // Pick a throw that lands on the spot: a lob that takes longer the farther
  // it goes, kept under the grenade's max throw speed. Then add some error.
  throwGrenade(bot, spot) {
    const config = bot.gear.throwable;
    bot.faceToward(spot.x);
    const x = bot.x + bot.facing * 14;
    const y = bot.y - 10;
    const g = this.scene.physics.world.gravity.y;

    let t = Phaser.Math.Clamp(Math.abs(spot.x - x) / 450, 0.6, 1.3);
    let vx;
    let vy;
    for (let i = 0; i < 6; i++) {
      vx = (spot.x - x) / t;
      vy = (spot.y - y) / t - (g * t) / 2;
      if (Math.hypot(vx, vy) <= config.maxSpeed) break;
      t += 0.15;
    }
    const error = 1 + Phaser.Math.FloatBetween(-1, 1) * BOT_AI.grenade.errorShare;

    const grenade = new Grenade(this.scene, x, y, config, this.groundLayer, this.worldHeight, bot);
    grenade.body.setVelocity(vx * error, vy * error);
    this.collisions.addGrenade(grenade);
    grenade.on('explode', (ex, ey) => this.blast(bot, ex, ey, config, this.scale(bot)));
    this.thrown.push(grenade);

    bot.gear.throwableCount -= 1;
    this.note(bot, 'grenade!');
  }

  // A bot's blast hurts you and itself (selfDamage), not other bots.
  blast(bot, x, y, config, scale) {
    if (this.player.alive && this.inBlast(x, y, config, this.player)) {
      this.player.lastAttacker = bot;
      this.weapons.applyBlast(x, y, config, this.player, scale, 'bot');
    }
    if (config.selfDamage > 0) {
      this.weapons.applyBlast(x, y, config, bot, config.selfDamage, 'self');
    }
  }

  inBlast(x, y, config, victim) {
    const d = Phaser.Math.Distance.Between(x, y, victim.x, victim.y);
    return d <= config.blastRadius && hasLineOfSight(this.groundLayer, x, y - 4, victim.x, victim.y);
  }

  // ---- Effects ----

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

  note(bot, message) {
    this.floatText(bot, message, NOTE_COLOR);
  }

  floatText(obj, message, color) {
    const text = this.scene.add
      .text(obj.x + Phaser.Math.Between(-8, 8), obj.y - 34, message, {
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color,
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