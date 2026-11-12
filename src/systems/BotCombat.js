import Phaser from 'phaser';
import EnemyBullet from '../entities/EnemyBullet.js';
import Grenade from '../entities/Grenade.js';
import Projectile from '../entities/Projectile.js';
import { GUN_SWITCH_MS } from '../data/weapons.js';
import { BULLETS, BULLET_DEFAULT } from '../data/bullets.js';
import { muzzleOf, muzzleFlash } from './ShotFx.js';
import { BOT_AI, BOT_BULLETS, WORD_LETTERS } from '../data/enemies.js';
import { hasLineOfSight } from './LineOfSight.js';
import { STATUS } from '../data/status.js';

const HIT_COLOR = '#ff4d6d';
const NOTE_COLOR = '#c9c9c9';
const PELLET_SPREAD_DEG = 8;  // shotgun pellets fan out this much either way
const SWING_COLOR = 0xff4d6d;

// Bots fighting you with whatever is in their hands (BotGear).
// A bot attacks only while it can see you, after a reaction delay, then once
// per "typed" attack (same words as yours, at its typing speed).
// Attack turns: only a couple of bots shoot at you at the same time.
// A bot you just hit flinches (worse aim, next shot delayed).
// Bombers (Scrap Bot) don't attack: they run up, beep, and blow up.
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
    for (const thing of this.thrown) thing.update(delta);
  }

  // ---- Attacks (guns, launchers, melee) ----

  updateAttack(bot, now) {
    if (bot.config.bomber) {
      this.updateBomber(bot, now);
      return;
    }
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
    // Melee rushers don't wait: every charge ends in a strike.
    const rusher = weapon.category === 'melee' && bot.config.rush;
    if (!rusher && !this.hasTurn(bot, now)) return;

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
    if (rusher) bot.nextShotAt = Math.min(bot.nextShotAt, now + bot.config.rush.strikeWaitMs); // in reach: strike soon
    if (now < bot.nextShotAt) return;

    if (weapon.category === 'melee') this.swing(bot, brain.target, weapon);
    else if (weapon.category === 'launcher') this.launch(bot, brain.target, weapon);
    else this.attack(bot, brain.target, weapon);

    const used = gear.useAmmo(now, GUN_SWITCH_MS);
    if (used === 'reload') this.note(bot, 'reloading');
    else if (used) this.note(bot, `${used.name} empty`);
    bot.nextShotAt = now + this.typeTime(bot, gear.current) * this.slowdown(bot);
  }

  // Dazed, shocked or frozen bots attack slower (the strongest one wins).
  slowdown(bot) {
    let k = 1;
    for (const type of ['dazed', 'shocked', 'frozen']) {
      if (bot.hasStatus(type)) k = Math.max(k, STATUS[type].attackScale);
    }
    return k;
  }

  // ---- Bombers ----

  // Close enough and it can see you: start the fuse (blinking, "beep!").
  // When it runs out, boom. Killed before that, it just falls apart.
  updateBomber(bot, now) {
    const bomb = bot.config.bomb;
    if (!bot.alive) return;

    if (bot.fuseUntil) {
      bot.setFillStyle(Math.floor(now / 80) % 2 ? 0xff4d6d : bot.baseColor);
      if (now >= bot.fuseUntil) this.detonate(bot);
      return;
    }

    const t = bot.brain.target;
    if (!t || !bot.brain.sees) return;
    if (Phaser.Math.Distance.Between(bot.x, bot.y, t.x, t.y) > bomb.triggerPx) return;

    bot.fuseUntil = now + bomb.fuseMs;
    this.note(bot, 'beep!');
  }

  detonate(bot) {
    const bomb = bot.config.bomb;
    const { x, y } = bot;
    bot.fuseUntil = 0;
    this.weapons.blastFx(x, y, bomb.blastRadius);
    this.blast(bot, x, y, bomb, this.scale(bot));
    bot.kill('self'); // blew itself up: not your kill
  }

  // ---- Attack turns ----

  // Does this bot get to attack now? It keeps a turn for holdMs, then rests
  // for restMs. New turns are only handed out while fewer than `max` are taken.
  hasTurn(bot, now) {
    const { holdMs, restMs } = BOT_AI.turns;
    const max = this.maxTurns ?? BOT_AI.turns.max; // a mode's stage can change it
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
    const damage = weapon.damage * this.scale(bot, weapon);
    const capped = (damage / (BOT_AI.maxDps * (bot.config.dpsScale ?? 1))) * 1000; // a mode's harder stages raise the cap
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
        if (!pellets || i === 0) this.scene.sfx?.shot(gun, bot, true);
        bot.lastAttackAt = this.scene.time.now; // shooting gives away a hiding spot
        this.fireBullet(bot, target, gun, amount, fan);
      };

      if (i === 0 || pellets) shoot();
      else this.scene.time.delayedCall(i * delay, shoot);
    }
  }

  fireBullet(bot, target, gun, amount, fanDeg) {
    const style = BULLETS[gun.category] ?? BULLET_DEFAULT;
    const at = this.muzzle(bot, target);
    const { x, y } = at;

    const angle = this.aimAngle(bot, target, x, y, style.speed) + Phaser.Math.DegToRad(fanDeg);
    const look = { length: style.length, width: BOT_BULLETS.width, color: BOT_BULLETS.color };

    const bullet = new EnemyBullet(
      this.scene, x, y, angle, style.speed, look, this.groundLayer, target, BOT_BULLETS.maxRangePx,
      (victim, distance) => this.hit(bot, victim, gun, amount, distance)
    );
    this.bullets.push(bullet);
    this.shotsFired += 1;
    this.muzzleFlash(at, gun, bot.facing);
  }

  // The end of the bot's barrel (its rig), or just in front of it.
  muzzle(bot, target) {
    return muzzleOf(bot, target, this.groundLayer);
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

  // A gun bullet landed. A Riot Shield on that side takes it instead
  // (shields only stop bullets: melee, blasts and specials get through).
  hit(bot, victim, gun, amount, distance) {
    const damage = Math.max(1, Math.round(amount * this.scale(bot, gun) * this.falloff(gun.falloff, distance)));
    if (victim.shieldCovers?.(bot.x)) {
      victim.absorb(damage);
      this.floatText(victim, 'blocked', NOTE_COLOR);
      this.scene.sfx?.play('block', victim);
      return;
    }
    this.damage(bot, victim, damage);
  }

  // kind: 'bullet' or 'melee' (an Armor Vest soaks them differently).
  damage(bot, victim, amount, kind = 'bullet') {
    victim.lastAttacker = bot;
    victim.takeDamage(amount, 'bot', kind);
    this.hits += 1;
    if (victim === this.player) this.scene.cameras.main.shake(60, 0.002);
    this.floatText(victim, `-${amount}`, HIT_COLOR);
  }

  // Share of a weapon's damage a bot deals (some families have their own).
  scale(bot, weapon) {
    return BOT_AI.damageByCategory?.[weapon?.category] ?? bot.config.damageScale ?? 1;
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
    bot.lastSwingAt = this.scene.time.now; // the rig snaps the K9's jaw / swings the arm
    this.scene.sfx?.play('swing', bot, { volume: 0.7 });
    this.scene.sfx?.play('meleeHit', target);
    this.damage(bot, target, Math.max(1, Math.round(weapon.damage * this.scale(bot))), 'melee');

    // Rushers (and hit and run): fall back after each hit, then come again.
    const rush = bot.config.rush;
    const run = rush ? { px: rush.backPx, ms: rush.backMs } : bot.config.hitAndRun;
    if (run) bot.brain.retreat(target, run.px, run.ms);
  }

  // ---- Explosives (launchers and grenades) ----

  // Launcher rounds, aimed with the same kind of error as bullets.
  launch(bot, target, weapon) {
    const spec = weapon.projectile;
    const count = spec.count ?? 1;
    for (let i = 0; i < count; i++) {
      const fireOne = () => {
        if (!bot.alive) return;
        this.scene.sfx?.shot(weapon, bot, true);
        bot.lastAttackAt = this.scene.time.now;
        this.spawnRound(bot, target, weapon, i > 0 ? spec.spread ?? 0 : 0);
      };
      if (i === 0) fireOne();
      else this.scene.time.delayedCall(i * spec.delayMs, fireOne);
    }
  }

  spawnRound(bot, target, weapon, spread) {
    const spec = weapon.projectile;
    const at = this.muzzle(bot, target);
    const { x, y } = at;
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
    this.muzzleFlash(at, weapon);
  }

  // Lob a grenade now and then: sometimes while it sees you, more often when
  // you've just ducked behind cover close to where it last saw you.
  updateGrenade(bot, now) {
    const cfg = BOT_AI.grenade;
    const { brain, gear } = bot;
    if (!cfg.enabled) return; // enemies don't throw (see BOT_AI.grenade)
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

    // Straight throws (sticky, axe) need you in sight and in range.
    const config = gear.throwable;
    if (config.flight === 'straight' && (!brain.sees || dist > config.maxRangePx)) return;

    this.throwGrenade(bot, spot);
    bot.nextThrowAt = now + cfg.cooldownMs;
  }

  // Lobbed throwables (frag, molotov): a lob that lands on the spot, taking
  // longer the farther it goes, kept under the max throw speed.
  // Straight ones (sticky, axe): thrown flat at the spot.
  // Either way with some error.
  throwGrenade(bot, spot) {
    const config = bot.gear.throwable;
    bot.faceToward(spot.x);
    const x = bot.x + bot.facing * 14;
    const y = bot.y - 10;
    const g = this.scene.physics.world.gravity.y;
    const errShare = BOT_AI.grenade.errorShare;
    let vx;
    let vy;
    let rangePx = Infinity;

    if (config.flight === 'straight') {
      const angle = Phaser.Math.Angle.Between(x, y, spot.x, spot.y) + Phaser.Math.FloatBetween(-1, 1) * errShare * 0.6;
      vx = Math.cos(angle) * config.speed;
      vy = Math.sin(angle) * config.speed;
      rangePx = Phaser.Math.Distance.Between(x, y, spot.x, spot.y) + 40;
    } else {
      let t = Phaser.Math.Clamp(Math.abs(spot.x - x) / 450, 0.6, 1.3);
      for (let i = 0; i < 6; i++) {
        vx = (spot.x - x) / t;
        vy = (spot.y - y) / t - (g * t) / 2;
        if (Math.hypot(vx, vy) <= config.maxSpeed) break;
        t += 0.15;
      }
      const error = 1 + Phaser.Math.FloatBetween(-1, 1) * errShare;
      vx *= error;
      vy *= error;
    }

    const grenade = new Grenade(this.scene, x, y, config, this.groundLayer, this.worldHeight, bot, {
      targets: [this.player],
      rangePx,
    });
    grenade.body.setVelocity(vx, vy);
    this.collisions.addGrenade(grenade);
    grenade.on('explode', (ex, ey) => this.blast(bot, ex, ey, config, this.scale(bot)));
    grenade.on('ignite', (ex, ey) => this.weapons.spawnFire(ex, ey, config, 'bot', bot));
    grenade.on('strike', (victim) => {
      // A bot's axe sticks in you and bleeds too.
      const dir = Math.sign(grenade.body.velocity.x) || bot.facing || 1;
      this.damage(bot, victim, Math.round(config.damage * this.scale(bot)), 'melee');
      if (victim.alive) this.weapons.status.apply(victim, 'bleeding', 'bot', null, { dir });
    });
    this.thrown.push(grenade);

    bot.gear.throwableCount -= 1;
    this.note(bot, `${config.name.toLowerCase()}!`);
  }

  // A bot's blast hurts everyone caught in it: you, other bots, and itself
  // (at selfDamage strength). A bot killed by a bot's blast isn't your kill.
  blast(bot, x, y, config, scale) {
    this.scene.sfx?.play(this.scene.hazards?.blastSound(x, y) ?? 'explosion', { x, y }); // muffled under water
    const style = config.kind === 'frag' ? 'frag' : config === bot.config.bomb ? 'bomb' : 'rocket';
    this.scene.blastFx?.explosion(x, y, config.blastRadius, style, config.damage);
    this.weapons.chainReaction(x, y, config.blastRadius);
    if (this.player.alive && this.inBlast(x, y, config, this.player)) {
      this.player.lastAttacker = bot;
      this.weapons.applyBlast(x, y, config, this.player, scale, 'bot');
    }
    for (const other of this.bots) {
      if (other === bot || !other.alive) continue;
      this.weapons.applyBlast(x, y, config, other, scale, 'bot');
    }
    if (config.selfDamage > 0) {
      this.weapons.applyBlast(x, y, config, bot, config.selfDamage, 'self');
    }
  }

  inBlast(x, y, config, victim) {
    const d = Phaser.Math.Distance.Between(x, y, victim.x, victim.y);
    return d <= config.blastRadius; // walls only weaken it (WeaponSystem.applyBlast)
  }

  // ---- Effects ----

  // at: { x, y, angle } from muzzle(). Sized by the gun's family.
  muzzleFlash(at, weapon, dir = 0) {
    if (dir) this.scene.blastFx?.muzzleSmoke(at.x, at.y, dir);
    muzzleFlash(this.scene, weapon, at);
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
