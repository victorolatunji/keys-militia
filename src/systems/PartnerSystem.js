import Phaser from 'phaser';
import Bot from '../entities/Bot.js';
import EnemyBullet from '../entities/EnemyBullet.js';
import { BOTS } from '../data/enemies.js';
import { PARTNER } from '../data/partner.js';
import { castOfBot } from '../data/cast.js';
import { hasLineOfSight } from './LineOfSight.js';
import { muzzleOf, muzzleFlash } from './ShotFx.js';
import { groundBelow } from './Terrain.js';

// Your AI partner (Duo). It replays YOUR path: each time you move a few px
// a point is added, and it goes through the points in order, a little way
// behind you. So it goes wherever you went (through tunnels and gaps, up
// into the air, down a hole) and never picks its own route or gets lost on
// one. It walks where you walked and flies where you flew. If something
// still blocks it, it hops along your path; if it's left far behind, it
// reappears behind you. It watches: it faces the nearest enemy, or looks
// where you look and now and then checks behind you. It attacks often but
// lightly. Enemies don't target it and it can't be typed at.
export default class PartnerSystem {
  constructor(scene, key) {
    this.scene = scene;
    this.key = key;
    this.kills = 0;
    this.bullets = [];
    this.nextAttackAt = scene.time.now + 2000;
    this.trail = [];   // your path: { x, y, ground }
    this.cursor = 0;   // the next point it's heading for
    this.hops = 0;
    this.stuck = { cursor: -1, best: Infinity, since: 0 };
    this.glanceUntil = 0;
    this.nextGlanceAt = scene.time.now + 3000;
    const base = BOTS[key];
    this.config = { ...base, name: base.name, hp: Math.round(base.hp * PARTNER.hpScale), smart: false, dropsGear: false };
    const p = scene.player;
    // (its BotBrain never runs: PartnerSystem moves it along your path)
    const bot = new Bot(scene, p.x - 60, p.y - 20, this.config, scene.groundLayer, () => null, 'partner');
    bot.isPartner = true;
    bot.castName = castOfBot(key)?.name ?? base.name; // its name from the cast (cast.js)
    this.castName = bot.castName;
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
      .text(0, 0, bot.castName, { fontFamily: 'monospace', fontSize: '12px', color: '#06d6a0', backgroundColor: '#000000aa', padding: { x: 4, y: 1 } })
      .setOrigin(0.5)
      .setDepth(44);
  }

  respawn() {
    if (this.scene.matchOver) return;
    const p = this.scene.player;
    this.bot.respawn({ x: p.x - p.facing * PARTNER.behindPx, y: p.y - 40 }, this.config);
    this.cursor = this.trail.length;
    this.bot.setStrokeStyle(2, PARTNER.color);
    this.bot.hpFill.setFillStyle(PARTNER.color);
  }

  update(delta) {
    const scene = this.scene;
    const p = scene.player;
    const bot = this.bot;
    const now = scene.time.now;
    this.record();

    if (bot.alive) {
      // Left far behind (off screen): it reappears behind you.
      if (Phaser.Math.Distance.Between(bot.x, bot.y, p.x, p.y) > PARTNER.path.lostPx && p.alive && p.onGround) this.rejoin();
      bot.hp = Math.min(bot.maxHp, bot.hp + (PARTNER.regenPerSec * delta) / 1000);
      this.move(now);
      this.look(now);
      bot.updateVisuals();
      if (now >= this.nextAttackAt) this.attack(now);
    }
    bot.layout();
    this.tag.setVisible(bot.alive).setPosition(bot.x, bot.visualTop - 26);
    for (const b of this.bullets) b.update(delta);
    this.bullets = this.bullets.filter((b) => b.active);
  }

  // ---- Your path ----

  // A new point each time you've moved stepPx. A big jump (you respawned):
  // the path starts over and it comes to you.
  record() {
    const p = this.scene.player;
    if (!p.alive) return;
    const cfg = PARTNER.path;
    const last = this.trail[this.trail.length - 1];
    const d = last ? Phaser.Math.Distance.Between(last.x, last.y, p.x, p.y) : Infinity;
    if (last && d < cfg.stepPx) return;
    if (!last || d > cfg.jumpPx) {
      this.trail = [this.point(p)];
      this.cursor = 1;
      if (last && this.bot.alive) this.rejoin();
      return;
    }
    this.trail.push(this.point(p));
    if (this.trail.length > cfg.maxPoints) {
      this.trail.shift();
      this.cursor = Math.max(0, this.cursor - 1);
    }
  }

  // A point of your path. Over the void (nothing below but the drop): it
  // only follows you out there once your path comes back over ground, so
  // it never follows you into a fall.
  point(p) {
    this.nextId = (this.nextId ?? 0) + 1;
    const safe = !this.scene.map.void || groundBelow(this.scene.groundLayer, p.x, p.body.bottom + 1) !== null;
    if (safe) this.lastSafeId = this.nextId;
    return { x: p.x, y: p.y, ground: p.onGround, id: this.nextId };
  }

  // How far it is from you, along your path (not in a straight line).
  pathLeft() {
    const bot = this.bot;
    const p = this.scene.player;
    const t = this.trail;
    if (this.cursor >= t.length) return Phaser.Math.Distance.Between(bot.x, bot.y, p.x, p.y);
    let d = Phaser.Math.Distance.Between(bot.x, bot.y, t[this.cursor].x, t[this.cursor].y);
    for (let i = this.cursor; i < t.length - 1; i++) d += Phaser.Math.Distance.Between(t[i].x, t[i].y, t[i + 1].x, t[i + 1].y);
    const end = t[t.length - 1];
    return d + Phaser.Math.Distance.Between(end.x, end.y, p.x, p.y);
  }

  // Back in a little behind you, caught up with the path.
  rejoin() {
    const p = this.scene.player;
    this.bot.body.reset(p.x - (p.facing ?? 1) * PARTNER.behindPx, p.y - 20);
    this.cursor = this.trail.length;
  }

  // ---- Moving ----

  move(now) {
    const bot = this.bot;
    const body = bot.body;
    const p = this.scene.player;
    const cfg = PARTNER.path;
    bot.thrusting = false;
    // Thrown by a blast or nailed down: no control for now.
    if (bot.staggered || bot.pinned) {
      body.setAllowGravity(true);
      return;
    }
    const t = this.trail;
    while (this.cursor < t.length && Phaser.Math.Distance.Between(bot.x, bot.y, t[this.cursor].x, t[this.cursor].y) < cfg.reachPx) this.cursor += 1;
    const left = this.pathLeft();
    const target = t[this.cursor];
    const overVoid = target && target.id > (this.lastSafeId ?? 0); // you're still out over the void
    // Stops at roomPx, sets off again past roomPx + startPx.
    if (this.following ? left < cfg.roomPx : left < cfg.roomPx + cfg.startPx) this.following = false;
    else this.following = true;
    if (!p.alive || !target || !this.following || overVoid) {
      this.following = false;
      this.idle();
      return;
    }

    // Its own pace, but faster the farther behind it is (you fall fast, so
    // it may need to as well), up to catchUp.maxSpeed.
    const pace = (base) => Phaser.Math.Clamp((left - cfg.roomPx) * cfg.catchUp.perPx, base, cfg.catchUp.maxSpeed) * bot.moveScale;
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const walking = target.ground && bot.onGround && Math.abs(dy) < 20;
    const ease = (v, want) => (left > cfg.roomPx * 3 ? want : v + (want - v) * cfg.steer); // far behind: no easing, just catch up
    body.setAcceleration(0, 0);
    if (walking) {
      // On the ground where you walked: run, gravity keeps it on the floor.
      const speed = pace(bot.stats.runSpeed);
      body.setAllowGravity(true);
      body.setVelocityX(ease(body.velocity.x, Math.sign(dx) * Math.min(speed, Math.abs(dx) * 12)));
    } else {
      // Where you flew, fell or climbed: it flies the same line.
      const speed = pace(bot.stats.airSpeed);
      const d = Math.max(1, Math.hypot(dx, dy));
      body.setAllowGravity(false);
      body.setVelocity(ease(body.velocity.x, (dx / d) * speed), ease(body.velocity.y, (dy / d) * speed));
      bot.thrusting = dy < -4; // your partner always has its jetpack (or boots) on
    }
    this.checkStuck(now, target);
  }

  // Not getting any closer to the next point (wedged on a ledge): hop onto
  // it (you stood there, so there's room) and carry on.
  checkStuck(now, target) {
    const bot = this.bot;
    const s = this.stuck;
    const d = Phaser.Math.Distance.Between(bot.x, bot.y, target.x, target.y);
    if (s.cursor !== this.cursor || d < s.best - 4) {
      s.cursor = this.cursor;
      s.best = d;
      s.since = now;
      return;
    }
    if (now - s.since > PARTNER.path.stuckMs) {
      bot.body.reset(target.x, target.y);
      this.cursor += 1;
      this.hops += 1; // (for testing: how often it had to)
      s.cursor = -1;
    }
  }

  // Close enough behind you: stay put. On the ground it stands (and steps
  // aside if you walk into it); in the air it hovers with you.
  idle() {
    const bot = this.bot;
    const body = bot.body;
    const p = this.scene.player;
    body.setAcceleration(0, 0);
    const dx = bot.x - p.x;
    if (p.alive && Math.abs(dx) < PARTNER.path.makeWayPx && Math.abs(bot.y - p.y) < 40) {
      body.setAllowGravity(true);
      body.setVelocityX((Math.sign(dx) || -(p.facing ?? 1)) * bot.stats.runSpeed * bot.moveScale);
      return;
    }
    // Hover: you're in the air too, you're down (waiting for you), or
    // there's nothing under it but the void.
    const overVoid = this.scene.map.void && groundBelow(this.scene.groundLayer, bot.x, bot.body.bottom + 1) === null;
    if (!bot.onGround && (!p.alive || !p.onGround || overVoid)) {
      body.setAllowGravity(false);
      body.setVelocity(body.velocity.x * 0.85, body.velocity.y * 0.85);
      bot.thrusting = bot.movement === 'jetpack';
      return;
    }
    body.setAllowGravity(true);
    body.setVelocityX(body.velocity.x * 0.7);
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
    bot.lookTarget = near;
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
      bot.lastSwingAt = scene.time.now; // its arm swings (CharacterRig.swingPose)
      this.hit(best, damage);
      scene.sfx?.play('meleeHit', best);
      return;
    }
    const style = PARTNER.bullet;
    const at = muzzleOf(bot, best, scene.groundLayer);
    const { x, y } = at;
    const angle = Phaser.Math.Angle.Between(x, y, best.x, best.y - 6) + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-3, 3));
    this.bullets.push(new EnemyBullet(scene, x, y, angle, style.speed, style, scene.groundLayer, best, PARTNER.rangePx + 200, (victim) => this.hit(victim, damage)));
    muzzleFlash(scene, bot.gear.current, { x, y, angle });
    scene.sfx?.play(bot.gear.current.category ?? 'assault', bot, { volume: 0.6 });
  }

  // Its hit: the kill is its own, never yours.
  hit(enemy, damage) {
    if (!enemy.alive) return;
    enemy.takeDamage(damage, 'partner', 'bullet');
    if (!enemy.alive) this.kills += 1;
  }
}
