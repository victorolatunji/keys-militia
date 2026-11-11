import Phaser from 'phaser';
import Bot from '../entities/Bot.js';
import EnemyBullet from '../entities/EnemyBullet.js';
import { BOTS } from '../data/enemies.js';
import { PARTNER } from '../data/partner.js';
import { hasLineOfSight } from './LineOfSight.js';

// Your AI partner (Duo). It moves like a bot, but it walks YOUR path: your
// position is noted every few frames and it heads for where you were a
// moment ago, so it flies when you fly, drops down a tunnel after you and
// comes back up with you, while leaving you some room. It watches: it faces
// the nearest enemy, or looks where you look and now and then checks behind
// you. Every few seconds it shoots (or strikes) the nearest enemy it can see.
// Enemies don't target it and it can't be typed at.
export default class PartnerSystem {
  constructor(scene, key) {
    this.scene = scene;
    this.key = key;
    this.kills = 0;
    this.bullets = [];
    this.nextAttackAt = scene.time.now + 2000;
    this.trail = [];
    this.nextTrailAt = 0;
    this.glanceUntil = 0;
    this.nextGlanceAt = scene.time.now + 3000;
    const base = BOTS[key];
    this.config = { ...base, name: base.name, hp: Math.round(base.hp * PARTNER.hpScale), smart: false, dropsGear: false };
    const p = scene.player;
    this.follow = { x: p.x, y: p.y, alive: true, hidden: false };
    const bot = new Bot(scene, p.x - 60, p.y - 20, this.config, scene.groundLayer, () => this.follow, 'partner');
    bot.isPartner = true;
    bot.team = 'players';
    bot.setStrokeStyle(2, PARTNER.color);
    bot.hpFill.setFillStyle(PARTNER.color);
    scene.physics.add.collider(bot, scene.groundLayer);
    bot.on('died', () => {
      scene.stats?.onPartnerDeath(bot);
      scene.time.delayedCall(PARTNER.respawnMs, () => this.respawn());
    });
    this.bot = bot;
    this.tag = scene.add
      .text(0, 0, `ALLY · ${base.name}`, { fontFamily: 'monospace', fontSize: '12px', color: '#06d6a0', backgroundColor: '#000000aa', padding: { x: 4, y: 1 } })
      .setOrigin(0.5)
      .setDepth(44);
  }

  respawn() {
    if (this.scene.matchOver) return;
    const p = this.scene.player;
    this.bot.respawn({ x: p.x - p.facing * PARTNER.behindPx, y: p.y - 40 }, this.config);
    this.bot.setStrokeStyle(2, PARTNER.color);
    this.bot.hpFill.setFillStyle(PARTNER.color);
  }

  update(delta) {
    const scene = this.scene;
    const p = scene.player;
    const bot = this.bot;
    const now = scene.time.now;
    this.updateFollow(now);

    if (bot.alive) {
      // Fell far behind (stuck, or you flew off): it catches up, out of sight.
      if (Phaser.Math.Distance.Between(bot.x, bot.y, p.x, p.y) > PARTNER.catchUpPx && p.alive && p.onGround) {
        bot.body.reset(p.x - p.facing * PARTNER.behindPx, p.y - 30);
      }
      bot.hp = Math.min(bot.maxHp, bot.hp + (PARTNER.regenPerSec * delta) / 1000);
      bot.update(delta);
      this.look(now);
      if (now >= this.nextAttackAt) this.attack(now);
    } else {
      bot.layout();
    }
    this.tag.setVisible(bot.alive).setPosition(bot.x, bot.y - bot.height / 2 - 26);
    for (const b of this.bullets) b.update(delta);
    this.bullets = this.bullets.filter((b) => b.active);
  }

  // Where it heads: along your path, a moment behind you. Close to you
  // already: it holds where it is (gives you room).
  updateFollow(now) {
    const p = this.scene.player;
    const bot = this.bot;
    if (p.alive && now >= this.nextTrailAt) {
      this.nextTrailAt = now + PARTNER.trailEveryMs;
      this.trail.push({ x: p.x, y: p.y, at: now });
      if (this.trail.length > PARTNER.trailLength) this.trail.shift();
    }
    this.follow.alive = p.alive;
    if (!p.alive || !this.trail.length) {
      this.follow.x = bot.x;
      this.follow.y = bot.y;
      return;
    }
    const gap = Phaser.Math.Distance.Between(bot.x, bot.y, p.x, p.y);
    bot.speedBoost = gap > PARTNER.catchUp.farPx ? PARTNER.catchUp.speed : 1;
    // You walk into it: it steps out of your way, to the far side.
    if (gap < PARTNER.makeWayPx && Math.abs(bot.y - p.y) < 40) {
      const away = Math.sign(bot.x - p.x) || -(p.facing ?? 1);
      this.follow.x = bot.x + away * PARTNER.spacePx;
      this.follow.y = bot.y;
      return;
    }
    if (gap < PARTNER.spacePx) {
      this.follow.x = bot.x; // room enough: hold
      this.follow.y = bot.y;
      return;
    }
    // The newest point of your path that's at least trailDelayMs old...
    let latest = 0;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      if (now - this.trail[i].at >= PARTNER.trailDelayMs) {
        latest = i;
        break;
      }
    }
    // ...but if it's behind on the path, the next few points from where it is.
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i <= latest; i++) {
      const d = Phaser.Math.Distance.Between(bot.x, bot.y, this.trail[i].x, this.trail[i].y);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    const point = this.trail[Math.min(latest, nearest + 4)];
    this.follow.x = point.x;
    this.follow.y = point.y;
  }

  // Watching: face the nearest enemy; none near: look where you look, and
  // now and then over your shoulder.
  look(now) {
    const scene = this.scene;
    const bot = this.bot;
    const p = scene.player;
    let near = null;
    let nearDist = PARTNER.watchPx;
    for (const e of scene.bots) {
      if (!e.alive) continue;
      const d = Phaser.Math.Distance.Between(bot.x, bot.y, e.x, e.y);
      if (d < nearDist && hasLineOfSight(scene.groundLayer, bot.x, bot.y - 10, e.x, e.y - 10)) {
        near = e;
        nearDist = d;
      }
    }
    if (near) {
      bot.faceToward(near.x);
      return;
    }
    const still = Math.abs(p.body.velocity.x) < 20 && p.onGround;
    if (!still) this.glanceUntil = 0; // on the move: eyes the way you're going
    else if (now >= this.nextGlanceAt) {
      this.glanceUntil = now + Phaser.Math.Between(700, 1300);
      this.nextGlanceAt = now + Phaser.Math.Between(...PARTNER.glanceEveryMs);
    }
    const ahead = p.facing ?? 1;
    bot.facing = now < this.glanceUntil ? -ahead : ahead;
  }

  // Shoot (or strike) the nearest enemy it can see.
  attack(now) {
    const scene = this.scene;
    const bot = this.bot;
    this.nextAttackAt = now + Phaser.Math.Between(...PARTNER.attackEveryMs);
    const melee = bot.gear.current.category === 'melee';
    const range = melee ? PARTNER.meleeRangePx : PARTNER.rangePx;
    let best = null;
    let bestDist = range;
    for (const e of scene.bots) {
      if (!e.alive) continue;
      const d = Phaser.Math.Distance.Between(bot.x, bot.y, e.x, e.y);
      if (d < bestDist && hasLineOfSight(scene.groundLayer, bot.x, bot.y - 10, e.x, e.y - 10)) {
        best = e;
        bestDist = d;
      }
    }
    if (!best) return;
    bot.faceToward?.(best.x);
    const damage = Math.max(1, Math.round(best.maxHp * Phaser.Math.FloatBetween(...PARTNER.damageShare)));
    if (melee) {
      this.hit(best, damage);
      scene.sfx?.play('meleeHit', best);
      return;
    }
    const style = PARTNER.bullet;
    const x = bot.x + (bot.facing ?? 1) * 14;
    const y = bot.y - 8;
    const angle = Phaser.Math.Angle.Between(x, y, best.x, best.y - 6) + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-3, 3));
    this.bullets.push(new EnemyBullet(scene, x, y, angle, style.speed, style, scene.groundLayer, best, PARTNER.rangePx + 200, (victim) => this.hit(victim, damage)));
    scene.sfx?.play(bot.gear.current.category ?? 'assault', bot, { volume: 0.6 });
  }

  // Its hit: the kill is its own, never yours.
  hit(enemy, damage) {
    if (!enemy.alive) return;
    enemy.takeDamage(damage, 'partner', 'bullet');
    if (!enemy.alive) this.kills += 1;
  }
}
