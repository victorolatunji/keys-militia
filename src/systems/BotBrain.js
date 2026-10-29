import Phaser from 'phaser';
import { hasLineOfSight } from './LineOfSight.js';
import { isSolid, groundBelow, nearestGroundX, groundAhead } from './Terrain.js';
import { BOT_AI } from '../data/enemies.js';
import { AIRDROPS } from '../data/airdrops.js';
import { GUN_SWITCH_MS } from '../data/weapons.js';

const EYE_OFFSET_Y = -8;

// A bot's AI. Two layers, like a person:
//   think() - a few times a second (its reaction time): can I see you?
//             which gun suits the distance? anything worth looting?
//             where do I want to be? (approach, back off, hold, hunt, loot)
//   steer() - every frame: press left/right/up to get there safely
//             (stop at the void, fly over gaps and walls, keep fuel to get back).
//             Walkers and leapers jump instead of flying; drones use fly().
// It only presses buttons (and jumps); Player's movement code does the rest.
export default class BotBrain {
  constructor(bot, groundLayer, getTarget) {
    this.bot = bot;
    this.layer = groundLayer;
    this.getTarget = getTarget;
    this.reset();
  }

  reset() {
    this.target = null;
    this.sees = false;
    this.lastSeen = null;     // { x, y, at }
    this.mode = 'idle';       // idle, approach, backoff, hold, hunt
    this.goalX = this.bot.x;
    this.goalY = this.bot.y;
    this.nextThink = 0;
    this.lastX = this.bot.x;
    this.stuckSince = 0;
    this.unstickUntil = 0;
    this.refueling = false;   // landed to refuel: stays down until refuelTo
    this.detourDir = 0;       // going around a platform overhead
    this.loot = null;         // crate or drop it's heading for
    this.lootSince = 0;
    this.lootBest = Infinity; // closest it got to that loot
    this.ignoredLoot = new Map(); // loot it gave up on -> until when
    this.retreatUntil = 0;    // hit and run: backing off until then
    this.retreatX = 0;
  }

  update(delta) {
    const bot = this.bot;
    const c = bot.controls;
    c.left.isDown = false;
    c.right.isDown = false;
    c.up.isDown = false;
    c.down.isDown = false;
    if (!bot.alive || bot.staggered) return;

    const now = bot.scene.time.now;
    if (now >= this.nextThink) {
      this.think(now);
      this.nextThink = now + BOT_AI.thinkMs * Phaser.Math.FloatBetween(0.8, 1.2);
    }
    this.steer(now, delta);
  }

  // ---- Deciding ----

  // Back away from the target for a while (hit and run), then come back.
  retreat(target, px, ms) {
    const away = Math.sign(this.bot.x - target.x) || (Math.random() < 0.5 ? -1 : 1);
    this.retreatUntil = this.bot.scene.time.now + ms;
    this.retreatX = this.bot.x + away * px;
    this.mode = 'retreat';
    this.goalX = this.retreatX;
  }

  get retreating() {
    return this.bot.scene.time.now < (this.retreatUntil ?? 0);
  }

  think(now) {
    const bot = this.bot;
    const t = this.getTarget();
    this.target = t && t.alive ? t : null;
    this.sees = false;

    if (this.target) {
      this.sees = hasLineOfSight(this.layer, bot.x, bot.y + EYE_OFFSET_Y, t.x, t.y + EYE_OFFSET_Y);
      if (this.sees) this.lastSeen = { x: t.x, y: t.y, at: now };
    }

    if (this.retreating) {
      this.mode = 'retreat';
      this.goalX = this.retreatX;
      this.goalY = bot.y;
      return;
    }
    const dist = this.target ? Phaser.Math.Distance.Between(bot.x, bot.y, t.x, t.y) : Infinity;

    // Weapon for the distance (only while it can see you).
    if (this.sees) bot.gear.chooseFor(dist, now, GUN_SWITCH_MS);

    // Crates and drops: worth a detour when it has no gun, can't see you,
    // or the item is right next to it.
    const loot = this.findLoot(now);
    this.trackLoot(loot, now);
    if (loot) {
      const lootDist = Phaser.Math.Distance.Between(bot.x, bot.y, loot.x, loot.y);
      if (lootDist <= AIRDROPS.pickupRadius) {
        this.grab(loot, now);
      } else if (!bot.gear.hasGun || !this.sees || lootDist < 150) {
        this.mode = 'loot';
        this.goalX = loot.x;
        this.goalY = loot.y;
        this.keepSpacing();
        return;
      }
    }

    if (!this.target) {
      this.mode = 'idle';
      this.goalX = bot.x;
      this.goalY = bot.y;
      return;
    }

    const { min, max } = bot.gear.range;
    const side = Math.sign(t.x - bot.x) || 1;
    const melee = bot.gear.current.category === 'melee';

    if (!this.sees) {
      // Go where it last saw you (or straight for you once that memory fades).
      this.mode = 'hunt';
      const memory = this.lastSeen && now - this.lastSeen.at < BOT_AI.memoryMs ? this.lastSeen : t;
      this.goalX = memory.x;
      this.goalY = memory.y;
    } else if (dist > max) {
      this.mode = 'approach';
      this.goalX = t.x;
      this.goalY = t.y;
    } else if (dist < min) {
      this.mode = 'backoff';
      this.goalX = bot.x - side * min;
      this.goalY = bot.y;
    } else {
      // Good range: hold, with the odd side-step so it isn't a sitting duck.
      if (this.mode !== 'hold') this.goalX = bot.x;
      this.mode = 'hold';
      if (!melee && Math.random() < BOT_AI.strafeChance) {
        this.goalX = bot.x + Phaser.Math.FloatBetween(-1, 1) * BOT_AI.strafePx;
      }
      this.goalY = t.y;
    }

    // Drones hang above you and keep darting about.
    if (bot.movement === 'flyer' && this.target) {
      this.goalY = t.y - (bot.config.hoverAbove ?? 120);
      if (Math.random() < BOT_AI.drone.dartChance) {
        this.goalX += Phaser.Math.Between(-BOT_AI.drone.dartPx, BOT_AI.drone.dartPx);
        this.goalY += Phaser.Math.Between(-BOT_AI.drone.dartPx / 2, BOT_AI.drone.dartPx / 2);
      }
      this.goalY = Math.min(this.goalY, this.layer.tilemap.heightInPixels - BOT_AI.drone.floorMarginPx);
    }

    this.keepSpacing();
  }

  // Closest landed crate or drop it wants, within its search distance.
  findLoot(now) {
    const bot = this.bot;
    const sources = bot.scene.airdrops?.pickupables ?? [];
    let best = null;
    let bestDist = BOT_AI.loot.searchPx;

    for (const source of sources) {
      if (!source.active || !source.settled || !bot.gear.wants(source.item)) continue;
      if ((this.ignoredLoot.get(source) ?? 0) > now) continue;
      const d = Phaser.Math.Distance.Between(bot.x, bot.y, source.x, source.y);
      if (d < bestDist) {
        best = source;
        bestDist = d;
      }
    }
    return best;
  }

  // Can't reach it (no progress for a while)? Give up on it for a bit.
  trackLoot(loot, now) {
    if (loot !== this.loot) {
      this.loot = loot;
      this.lootSince = now;
      this.lootBest = Infinity;
      return;
    }
    if (!loot) return;

    const d = Phaser.Math.Distance.Between(this.bot.x, this.bot.y, loot.x, loot.y);
    if (d < this.lootBest - 16) {
      this.lootBest = d;
      this.lootSince = now; // still getting closer
    } else if (now - this.lootSince > BOT_AI.loot.giveUpMs) {
      this.ignoredLoot.set(loot, now + BOT_AI.loot.ignoreMs);
      this.loot = null;
    }
  }

  // Same swap rules as yours: its old gun goes into the crate with its ammo.
  grab(source, now) {
    const back = this.bot.gear.take(source.item, now, GUN_SWITCH_MS);
    if (back) source.item = back;
    else source.remove();
    this.bot.emit('picked', source);
  }

  // Don't bunch up with other bots: step away from one that's too close.
  keepSpacing() {
    const bot = this.bot;
    for (const other of bot.scene.bots ?? []) {
      if (other === bot || !other.alive) continue;
      const dx = bot.x - other.x;
      if (Math.abs(dx) < BOT_AI.spacingPx && Math.abs(bot.y - other.y) < bot.height) {
        const away = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
        this.goalX = bot.x + away * BOT_AI.spacingPx;
        return;
      }
    }
  }

  // ---- Moving ----

  // Which way (-1 / 1) is the closest spot with nothing overhead? 0 = none near.
  openSide(ceilY) {
    const bot = this.bot;
    const half = bot.width / 2 + 4;
    const toward = Math.sign(this.goalX - bot.x) || 1;
    for (let off = 16; off <= 480; off += 16) {
      const leftOpen = !isSolid(this.layer, bot.x - off - half, ceilY);
      const rightOpen = !isSolid(this.layer, bot.x + off + half, ceilY);
      if (leftOpen && rightOpen) return toward;
      if (leftOpen) return -1;
      if (rightOpen) return 1;
    }
    return 0;
  }

  // Fuel to fly dx px sideways while holding altitude (with a safety factor).
  fuelFor(dx) {
    const { airSpeed, fuelDrain } = this.bot.stats;
    return (Math.abs(dx) / airSpeed) * fuelDrain * BOT_AI.fuelSafety;
  }

  // Drones: no gravity, so just set a speed toward the goal. Blocked by a
  // wall? Go over it.
  fly(delta) {
    const bot = this.bot;
    const dx = this.goalX - bot.x;
    const dy = this.goalY - bot.y;
    const dist = Math.hypot(dx, dy);
    const speed = bot.stats.airSpeed;
    let vx = dist > BOT_AI.arrivePx ? (dx / dist) * speed : 0;
    let vy = dist > BOT_AI.arrivePx ? (dy / dist) * speed : 0;

    if (vx !== 0 && isSolid(this.layer, bot.x + Math.sign(vx) * (bot.width / 2 + 10), bot.y)) {
      vy = -speed;
    }

    // Ease into the new speed so it glides instead of snapping.
    const k = 1 - Math.pow(0.85, delta / 16.7); // same feel at any frame rate
    const v = bot.body.velocity;
    bot.body.setVelocity(v.x + (vx - v.x) * k, v.y + (vy - v.y) * k);
  }

  // Walkers and leapers: is there ground ahead that one jump reaches?
  // A landing lower down gives more time in the air, so it can be farther.
  canLeap(aheadX, feetY, dir) {
    const bot = this.bot;
    const g = bot.scene.physics.world.gravity.y;
    const v = bot.config.jumpSpeed ?? 0;
    const step = this.layer.tilemap.tileWidth;
    const top = feetY - this.jumpHeight() * 0.85;

    for (let off = step; off <= 640; off += step) {
      const x = aheadX + dir * off;
      const d = groundBelow(this.layer, x, top);
      if (d === null) continue;
      const drop = top + d - feetY; // > 0: landing is lower than its feet
      if (drop > 400) continue;     // too far down to count on
      const airtime = (v + Math.sqrt(Math.max(0, v * v + 2 * g * drop))) / g;
      return off + bot.width / 2 <= airtime * bot.stats.airSpeed * 0.85;
    }
    return false;
  }

  // ...and how high (px).
  jumpHeight() {
    const g = this.bot.scene.physics.world.gravity.y;
    const v = this.bot.config.jumpSpeed ?? 0;
    return (v * v) / (2 * g);
  }

  steer(now, delta) {
    const bot = this.bot;
    const body = bot.body;
    const layer = this.layer;
    const half = bot.width / 2;
    const feetY = body.bottom + 1;
    const canFly = bot.movement === 'jetpack';
    const walks = bot.movement === 'walker' || bot.movement === 'leaper';

    if (bot.movement === 'flyer') {
      this.fly(delta);
      return;
    }

    let dir = Math.abs(this.goalX - bot.x) > BOT_AI.arrivePx ? Math.sign(this.goalX - bot.x) : 0;
    let up = false;

    const below = groundBelow(layer, bot.x, feetY); // null = the void is under me

    // 0. Wants to go up but a platform is overhead: go around it, out the
    //    nearer open side (keeps that side until it's clear).
    const ceilY = body.top - 6;
    const ceilingOver =
      isSolid(layer, body.left + 2, ceilY) || isSolid(layer, bot.x, ceilY) || isSolid(layer, body.right - 2, ceilY);
    if (canFly && ceilingOver && this.goalY < bot.y - BOT_AI.climbMarginPx) {
      if (!this.detourDir) this.detourDir = this.openSide(ceilY);
      if (this.detourDir) dir = this.detourDir;
    } else if (!ceilingOver) {
      this.detourDir = 0;
    }

    // Walkers remember where they last stood, for getting back to it.
    if (bot.onGround && below !== null) {
      this.lastGroundX = bot.x;
      this.leapDir = 0;
    }

    // 1. Over the void: head back to ground while there's still enough
    //    fuel to make it (a little inside the edge, not on it).
    //    Walkers mid-leap keep going; otherwise they steer back to ground.
    if (walks && !bot.onGround && below === null) {
      dir = this.leapDir || Math.sign((this.lastGroundX ?? bot.x) - bot.x);
    } else if (canFly && !bot.onGround && below === null) {
      const safeX = nearestGroundX(layer, bot.x, feetY, BOT_AI.landSearchPx);
      if (safeX !== null) {
        const back = Math.sign(safeX - bot.x);
        if (bot.fuel <= this.fuelFor(safeX - bot.x) + BOT_AI.returnMarginFuel) {
          dir = back;
          this.goalX = safeX + back * BOT_AI.landInsetPx;
        }
      }
    }

    // 2. About to go out over the void (walking off an edge, or flying past
    //    one): only with a jetpack, somewhere to land ahead, and the fuel
    //    to get there. Otherwise stop at the edge.
    if (dir !== 0 && below !== null) {
      const aheadX = bot.x + dir * (half + 6);
      if (groundBelow(layer, aheadX, feetY) === null) {
        const range = (bot.fuel / bot.stats.fuelDrain) * bot.stats.airSpeed;
        const landing = groundAhead(layer, aheadX, feetY - 160, dir, range);
        const fuelOk =
          bot.fuel >= BOT_AI.crossFuel &&
          landing !== null &&
          bot.fuel >= this.fuelFor(landing - bot.x) + BOT_AI.returnMarginFuel;

        if (canFly && fuelOk) {
          up = bot.onGround || up; // take off over the gap
        } else if (walks && bot.onGround) {
          // Jump it only if there's ground within one leap; never into the void.
          if (this.canLeap(aheadX, feetY, dir)) {
            bot.jump();
            this.leapDir = dir;
          } else {
            dir = 0;
          }
        } else if (!walks || bot.onGround) {
          dir = 0;
        }
      }
    }

    // 3. Walls in the way.
    const wallX = bot.x + dir * (half + 4);
    const wallAhead =
      dir !== 0 &&
      (isSolid(layer, wallX, body.top + 4) ||
        isSolid(layer, wallX, bot.y) ||
        isSolid(layer, wallX, body.bottom - 4));

    if (canFly) {
      if (wallAhead) up = true;
      if (this.goalY < bot.y - BOT_AI.climbMarginPx) up = true;

      // Crossing a gap or over the void: don't sink.
      const unsafeBelow = below === null;
      if (!bot.onGround && unsafeBelow && body.velocity.y > BOT_AI.hoverFallSpeed) up = true;

      // Low on fuel with ground below: land and refuel before flying again.
      if (bot.fuel < BOT_AI.reserveFuel) this.refueling = true;
      if (bot.fuel >= BOT_AI.refuelTo) this.refueling = false;
      if (this.refueling && !unsafeBelow) up = false;
    } else if (walks) {
      // Jump walls low enough to clear; stop at taller ones.
      if (wallAhead && bot.onGround) {
        const clearY = body.bottom - this.jumpHeight() + 8;
        if (!isSolid(layer, wallX, clearY)) bot.jump();
        else dir = 0;
      }
      // Goal above and close: jump for it (onto a ledge or a crate).
      if (bot.onGround && this.goalY < bot.y - BOT_AI.climbMarginPx && Math.abs(this.goalX - bot.x) < 120) {
        bot.jump();
      }
      // Landed on your head? Slide off to the side.
      const t = this.target;
      if (t && bot.onGround && (below === null || below > 4) && Math.abs(t.x - bot.x) <= (t.width + bot.width) / 2 && bot.y < t.y) {
        dir = bot.x < t.x ? -1 : 1;
      }

      // Leapers pounce when they're close to you.
      if (bot.movement === 'leaper' && t && this.sees && bot.onGround && !this.retreating) {
        const dx = Math.abs(t.x - bot.x);
        if (dx < (bot.config.pouncePx ?? 0) && dx > 70 && Math.abs(t.y - bot.y) < 120) bot.jump();
      }
    }

    // 4. Pushing but not moving (snagged on a corner): hop up for a moment.
    if (dir !== 0 && Math.abs(bot.x - this.lastX) < 0.5) {
      if (!this.stuckSince) this.stuckSince = now;
      else if (now - this.stuckSince > BOT_AI.stuckMs) {
        this.unstickUntil = now + 400;
        this.stuckSince = 0;
      }
    } else {
      this.stuckSince = 0;
    }
    this.lastX = bot.x;
    if (canFly && now < this.unstickUntil) up = true;

    const c = bot.controls;
    c.left.isDown = dir < 0;
    c.right.isDown = dir > 0;
    c.up.isDown = up;
  }
}