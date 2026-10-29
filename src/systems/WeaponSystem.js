import Phaser from 'phaser';
import Grenade from '../entities/Grenade.js';
import Projectile from '../entities/Projectile.js';
import Saw from '../entities/Saw.js';
import StatusSystem from './StatusSystem.js';
import Bullet from '../entities/Bullet.js';
import { hasLineOfSight } from './LineOfSight.js';
import {
  WEAPONS,
  THROWABLES,
  AIM,
  DEFAULT_LOADOUT,
  GUN_SWITCH_MS,
} from '../data/weapons.js';
import { BULLETS, BULLET_DEFAULT, MUZZLE_FLASH, DAMAGE_MERGE_MS } from '../data/bullets.js';

const DAMAGE_COLOR = '#ff9f1c';  // full-damage hit
const REDUCED_COLOR = '#ffe8b0'; // hit weakened by range falloff
const BURN_COLOR = '#ff7b00';    // burning damage ticks
const EMPTY_COLOR = '#c9c9c9';   // "Pistol empty"
const SWING_FADE_MS = 160;
const RELOAD_COLOR = '#ffd166';  // LMG "reloading"
const RING_RADIUS = 22;          // LMG reload ring around you
const PELLET_SPREAD = 14;        // px: shotgun pellets scatter at least this much...
const PELLET_CONE = 0.18;        // ...and this share of the distance (a cone that widens)
const BURST_SCATTER = 5;         // px: later bullets of a burst wander a little
const PREVIEW_DOTS = 14;
const PREVIEW_STEP = 0.06; // seconds between preview dots

// Weapon slots: two guns, then your melee weapon (always there, never runs out).
export const GUN_SLOTS = [0, 1];
export const MELEE_SLOT = 2;

// Weapon slots, Shift switching, attacks (gun bullets or melee swing, damage),
// and throwables (hold Space to aim and charge, release to throw, blast with falloff).
export default class WeaponSystem {
  constructor(scene, player, typing, groundLayer, worldHeight, collisions) {
    this.scene = scene;
    this.collisions = collisions;
    this.player = player;
    this.typing = typing;
    this.groundLayer = groundLayer;
    this.worldHeight = worldHeight;

    // Weapons: slots[0..1] guns, slots[2] melee. ammo[i] = shots left (null = endless).
    this.resetSlots();
    this.shots = 0;
    this.lastShot = null; // { distance, multiplier } for the debug readout

    // Throwable
    this.throwable = THROWABLES[DEFAULT_LOADOUT.throwable.key];
    this.throwableCount = DEFAULT_LOADOUT.throwable.count;
    this.aiming = false;
    this.aimAngle = AIM.startAngle;
    this.aimStartedAt = 0;
    this.grenades = [];
    this.projectiles = []; // launcher rounds in flight
    this.saws = [];        // Saw Gun blades in flight or grinding

    // Burning, pinned (and later shocked, dazed...): ticks and damage.
    // Your effects count as your hits; a bot's would count as theirs.
    this.status = new StatusSystem(scene, (target, amount, source) => {
      if (source === 'player') this.addDamage(target, amount, BURN_COLOR);
      else target.takeDamage(amount, source);
    });
    this.bullets = [];     // gun bullets in flight
    this.counters = new Map(); // target -> its running damage number
    this.thrown = 0;

    this.preview = scene.add.graphics().setDepth(45);
    this.reloadRing = scene.add.graphics().setDepth(46);

    const kb = scene.input.keyboard;
    kb.addCapture('SPACE'); // stop the browser from scrolling on Space
    kb.on('keydown-SHIFT', this.handleShift, this);
    kb.on('keydown-SPACE', this.startAim, this);
    kb.on('keyup-SPACE', this.releaseAim, this);

    scene.events.once('shutdown', () => {
      kb.off('keydown-SHIFT', this.handleShift, this);
      kb.off('keydown-SPACE', this.startAim, this);
      kb.off('keyup-SPACE', this.releaseAim, this);
    });
  }

  // Weapon in your hand (null only if every slot is empty).
  get current() {
    return this.slots[this.active];
  }

  // Melee words only show on enemies this close; guns: null (any distance).
  get reach() {
    return this.current?.reach ?? null;
  }

  // Default guns and melee, all full.
  resetSlots() {
    this.slots = [
      ...DEFAULT_LOADOUT.guns.map((key) => (key ? WEAPONS[key] : null)),
      WEAPONS[DEFAULT_LOADOUT.melee],
    ];
    this.ammo = this.slots.map((w) => (w ? w.ammo : 0));
    this.active = 0;
    this.belt = this.slots.map(() => 0);        // LMG bursts fired since the last reload
    this.reloadUntil = this.slots.map(() => 0); // LMG reloading until (per slot)
  }

  // LMG: is the gun in your hand reloading?
  get reloading() {
    return this.scene.time.now < this.reloadUntil[this.active];
  }

  // LMG: bursts left before the next reload (null for other weapons).
  get beltLeft() {
    const w = this.current;
    return w?.belt ? w.belt - this.belt[this.active] : null;
  }

  // After a switch: if the gun you switched to is still reloading,
  // letters stay blocked until it's done.
  blockIfReloading() {
    const left = this.reloadUntil[this.active] - this.scene.time.now;
    if (left > GUN_SWITCH_MS) this.typing.block(left, 'reload');
  }

  // 0 to 1: how charged the throw is.
  get charge() {
    if (!this.aiming) return 0;
    const held = this.scene.time.now - this.aimStartedAt;
    return Math.min(1, held / this.throwable.chargeMs);
  }

  // ---- Guns ----

  handleShift(event) {
    if (event.repeat || !this.player.alive) return;
    this.switchGun();
  }

  // Shift: next slot that holds something (gun 1 -> gun 2 -> melee -> gun 1).
  switchGun() {
    for (let step = 1; step < this.slots.length; step++) {
      const next = (this.active + step) % this.slots.length;
      if (this.slots[next]) {
        this.active = next;
        this.typing.onWeaponChanged(GUN_SWITCH_MS);
        this.blockIfReloading();
        return;
      }
    }
  }

  hasGun(key) {
    return this.slots.some((w) => w?.key === key);
  }

  // Slot holding this weapon, or -1.
  slotOf(key) {
    return this.slots.findIndex((w) => w?.key === key);
  }

  // Put a weapon in a slot with this much ammo (default: full).
  // Returns what was there as { key, ammo }, or null.
  // Replacing the weapon in your hand counts as a switch (words re-roll).
  setGun(slot, key, ammo) {
    const old = this.slots[slot] ? { key: this.slots[slot].key, ammo: this.ammo[slot] } : null;
    const config = WEAPONS[key];

    this.slots[slot] = config;
    this.ammo[slot] = config.ammo === null ? null : Math.min(ammo ?? config.ammo, config.ammo);
    this.belt[slot] = 0;
    this.reloadUntil[slot] = 0;

    // Holding nothing? Take the new weapon in hand.
    if (!this.slots[this.active]) this.active = slot;
    if (slot === this.active) {
      this.typing.onWeaponChanged(GUN_SWITCH_MS);
    }
    return old;
  }

  // Top up a gun's ammo, up to full. Returns how many shots were added.
  refillGun(slot, ammo) {
    const gun = this.slots[slot];
    if (!gun || gun.ammo === null) return 0;

    const taken = Math.max(0, Math.min(ammo, gun.ammo - this.ammo[slot]));
    this.ammo[slot] += taken;
    return taken;
  }

  // Out of ammo: the gun is thrown away and you switch to your next weapon
  // (your other gun, else melee).
  emptyCurrent() {
    const gun = this.current;
    this.slots[this.active] = null;
    this.ammo[this.active] = 0;
    this.belt[this.active] = 0;
    this.reloadUntil[this.active] = 0;
    this.floatText(this.player, `${gun.name} empty`, EMPTY_COLOR);

    const next = this.slots.findIndex(Boolean);
    if (next !== -1) this.active = next;
    this.typing.onWeaponChanged(GUN_SWITCH_MS); // re-roll words for the new weapon
    this.blockIfReloading();
  }

  // Called by TypingSystem when a word is finished. Always hits;
  // for guns, distance only changes how much damage the attack does.
  fire(target) {
    const weapon = this.current;
    if (!weapon || this.reloading) return;

    const p = this.player;
    const distance = Phaser.Math.Distance.Between(p.x, p.y, target.x, target.y);
    const multiplier = this.falloffMultiplier(weapon.falloff, distance);
    const damage = Math.round(weapon.damage * multiplier);
    const color = multiplier < 1 ? REDUCED_COLOR : DAMAGE_COLOR;

    this.shots += 1;
    this.lastShot = { distance: Math.round(distance), multiplier };

    const hits = weapon.hits ?? 1;
    const delay = weapon.hitDelayMs ?? 0;

    if (weapon.category === 'launcher') {
      this.launch(target, weapon); // the round does the damage when it explodes
    } else if (weapon.saw) {
      this.launchSaw(target, weapon); // the blade does the damage
    } else if (weapon.beam) {
      this.fireLaser(target, weapon, damage);
    } else if (weapon.flame) {
      this.sprayFlame(target, weapon, damage);
    } else if (weapon.category === 'melee') {
      this.drawSwing(weapon);
      if (weapon.knockback && target.applyKnockback) {
        target.applyKnockback(p.facing * weapon.knockback, -weapon.knockback * 0.4);
      }
      this.hit(target, damage, color);
    } else {
      // Bullets: one, a burst (one after another) or pellets (all at once).
      this.burst(target, weapon, damage, hits, delay, color);
    }

    // Guns use one attack's ammo; melee never runs out.
    if (this.ammo[this.active] !== null) {
      this.ammo[this.active] -= 1;
      if (this.ammo[this.active] <= 0) this.emptyCurrent();
      else this.countBurst(weapon);
    }
  }

  // ---- Launchers ----

  // Fire this weapon's round(s) at the target.
  launch(target, weapon) {
    const spec = weapon.projectile;
    const count = spec.count ?? 1;

    for (let i = 0; i < count; i++) {
      const fireOne = () => {
        if (!this.player.alive) return;
        this.spawnRound(target, weapon, i > 0 ? spec.spread ?? 0 : 0);
      };
      if (i === 0) fireOne();
      else this.scene.time.delayedCall(i * spec.delayMs, fireOne);
    }
  }

  spawnRound(target, weapon, spread) {
    const spec = weapon.projectile;
    const p = this.player;
    const x = p.x + p.facing * 18;
    const y = p.y - 6;
    let vx;
    let vy;
    let fuseMs = null;

    if (spec.kind === 'rocket') {
      // Straight at the target.
      const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
      vx = Math.cos(angle) * spec.speed;
      vy = Math.sin(angle) * spec.speed;
    } else {
      // Lobbed: pick the launch speed that lands on the target after flightMs.
      // x = vx*t ; y = vy*t + g*t*t/2  ->  vx = dx/t ; vy = dy/t - g*t/2
      const t = spec.flightMs / 1000;
      const g = this.scene.physics.world.gravity.y;
      const scatter = 1 + Phaser.Math.FloatBetween(-spread, spread);
      vx = ((target.x - x) / t) * scatter;
      vy = (target.y - y) / t - (g * t) / 2;
      if (spec.kind === 'bomb') fuseMs = spec.flightMs + spec.fuseExtraMs;
    }

    const round = new Projectile(
      this.scene, x, y, vx, vy, spec, p,
      this.groundLayer, this.worldHeight, this.typing.targets, fuseMs
    );
    this.collisions.addGrenade(round); // bounces off crates (bombs); rockets and shells explode on them
    round.on('explode', (ex, ey) => {
      this.blastFx(ex, ey, weapon.blast.blastRadius);
      this.explode(ex, ey, weapon.blast);
    });
    this.projectiles.push(round);
  }

  // ---- Laser and Flamethrower ----

  // A straight beam from you through the target, on until a wall (or its
  // range) stops it. Every enemy it crosses is hit: full damage to the
  // first, then pierceShare of the one before for each after.
  fireLaser(target, weapon, damage) {
    const beam = weapon.beam;
    const p = this.player;
    const x1 = p.x + p.facing * 16;
    const y1 = p.y - 4;
    const angle = Phaser.Math.Angle.Between(x1, y1, target.x, target.y);
    const end = this.beamEnd(x1, y1, angle, beam.rangePx);

    const line = new Phaser.Geom.Line(x1, y1, end.x, end.y);
    const hit = this.typing.targets
      .filter((t) => t.alive && Phaser.Geom.Intersects.LineToRectangle(line, t.getBounds()))
      .sort((a, b) =>
        Phaser.Math.Distance.Between(x1, y1, a.x, a.y) - Phaser.Math.Distance.Between(x1, y1, b.x, b.y)
      );
    if (!hit.includes(target)) hit.unshift(target); // a finished word always hits

    let amount = damage;
    for (const t of hit) {
      this.addDamage(t, Math.max(1, Math.round(amount)), DAMAGE_COLOR);
      amount *= beam.pierceShare;
    }

    // Glowing core with a wider soft glow, fading out.
    const g = this.scene.add.graphics().setDepth(45);
    g.lineStyle(beam.width * 2.5, beam.color, 0.35);
    g.lineBetween(x1, y1, end.x, end.y);
    g.lineStyle(beam.width, beam.glowColor, 1);
    g.lineBetween(x1, y1, end.x, end.y);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: beam.fadeMs, onComplete: () => g.destroy() });
    this.muzzleFlash(x1, y1);
  }

  // Where a beam from (x, y) at this angle stops: the first solid tile,
  // or rangePx away.
  beamEnd(x, y, angle, rangePx) {
    const step = 8;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let d = step; d <= rangePx; d += step) {
      const tile = this.groundLayer.getTileAtWorldXY(x + dx * d, y + dy * d);
      if (tile && tile.collides) return { x: x + dx * d, y: y + dy * d };
    }
    return { x: x + dx * rangePx, y: y + dy * rangePx };
  }

  // A cone of fire toward the target, out to the weapon's reach. Everyone
  // inside it (that the fire can reach past walls) takes the damage and
  // starts burning. The target is always hit.
  sprayFlame(target, weapon, damage) {
    const flame = weapon.flame;
    const p = this.player;
    const x = p.x + p.facing * 16;
    const y = p.y - 4;
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const half = Phaser.Math.DegToRad(flame.coneDeg / 2);

    for (const t of this.typing.targets) {
      if (!t.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
      const off = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(x, y, t.x, t.y) - angle));
      const inCone = d <= weapon.reach + t.width / 2 && off <= half && hasLineOfSight(this.groundLayer, x, y, t.x, t.y);
      if (t !== target && !inCone) continue;
      this.addDamage(t, damage, BURN_COLOR);
      this.status.apply(t, 'burning');
    }

    // Puffs of fire rushing out along the cone.
    for (let i = 0; i < 14; i++) {
      const a = angle + Phaser.Math.FloatBetween(-half, half);
      const dist = Phaser.Math.FloatBetween(weapon.reach * 0.5, weapon.reach);
      const puff = this.scene.add
        .circle(x, y, Phaser.Math.Between(4, 8), i % 3 ? flame.color : flame.coreColor, 0.85)
        .setDepth(44);
      this.scene.tweens.add({
        targets: puff,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist - Phaser.Math.Between(0, 14),
        scale: 2.2,
        alpha: 0,
        delay: i * 12,
        duration: 320,
        onComplete: () => puff.destroy(),
      });
    }
  }

  // ---- Saw Gun ----

  launchSaw(target, weapon) {
    const p = this.player;
    const x = p.x + p.facing * 20;
    const y = p.y - 6;
    const saw = new Saw(this.scene, x, y, target, weapon.saw, this.typing.targets, this.groundLayer, {
      cut: (enemy, dmg) => this.addDamage(enemy, dmg, REDUCED_COLOR),
      grind: (enemy, dmg) => this.addDamage(enemy, dmg, DAMAGE_COLOR),
      explode: (ex, ey) => {
        this.blastFx(ex, ey, weapon.blast.blastRadius);
        this.explode(ex, ey, weapon.blast);
      },
    });
    this.saws.push(saw);
    this.muzzleFlash(x, y);
  }

  // Orange flash and a little camera shake.
  blastFx(x, y, radius) {
    const burst = this.scene.add
      .circle(x, y, radius, 0xff9f1c, 0.45)
      .setDepth(42)
      .setScale(0.2);

    this.scene.tweens.add({
      targets: burst,
      scale: 1,
      alpha: 0,
      duration: 300,
      onComplete: () => burst.destroy(),
    });
    this.scene.cameras.main.shake(140, 0.005);
  }

  // Split damage over several hits, delay ms apart. Stops if the target dies.
  // Fire `hits` bullets that share the damage. delay > 0: one after another;
  // delay 0: all at once in a spread (pellets). Each does its share on arrival.
  burst(target, weapon, damage, hits, delay, color) {
    const per = Math.floor(damage / hits);
    const last = damage - per * (hits - 1); // remainder goes on the last bullet
    const pellets = delay === 0 && hits > 1;
    const range = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    const cone = Math.max(PELLET_SPREAD, range * PELLET_CONE);

    for (let i = 0; i < hits; i++) {
      const amount = i === hits - 1 ? last : per;
      const scatter = pellets ? cone : i > 0 ? BURST_SCATTER : 0;
      const shoot = () => {
        if (!target.alive || !this.player.alive) return; // stop the burst
        this.fireBullet(target, weapon, scatter, (t) => {
          this.addDamage(t, amount, color);
          if (weapon.pins) this.status.apply(t, 'pinned'); // Nail Gun
        });
      };

      if (i === 0 || pellets) shoot();
      else this.scene.time.delayedCall(i * delay, shoot);
    }
  }

  fireBullet(target, weapon, scatter, onArrive) {
    const p = this.player;
    const x = p.x + p.facing * 16;
    const y = p.y - 4;
    const offset = {
      x: scatter ? Phaser.Math.Between(-scatter, scatter) : 0,
      y: scatter ? Phaser.Math.Between(-scatter, scatter) : 0,
    };
    const style = weapon.bullet ?? BULLETS[weapon.category] ?? BULLET_DEFAULT;

    this.bullets.push(
      new Bullet(this.scene, x, y, target, offset, style, weapon.tracerColor, weapon.tracerWidth, onArrive)
    );
    this.muzzleFlash(x, y);
  }

  muzzleFlash(x, y) {
    const flash = this.scene.add
      .circle(x, y, MUZZLE_FLASH.radius, MUZZLE_FLASH.color)
      .setDepth(41);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 0.4,
      duration: MUZZLE_FLASH.durationMs,
      onComplete: () => flash.destroy(),
    });
  }

  // A bullet landed: damage, and one damage number per target that counts up
  // while a burst keeps hitting (instead of a pile of small numbers).
  addDamage(target, amount, color) {
    target.takeDamage(amount);

    const now = this.scene.time.now;
    let counter = this.counters.get(target);
    if (!counter || now - counter.lastAt > DAMAGE_MERGE_MS) {
      counter = { total: 0, lastAt: now, text: this.makeFloatText(target.x, target.y - 30, '', color), tween: null };
      this.counters.set(target, counter);
    }

    counter.total += amount;
    counter.lastAt = now;
    counter.tween?.remove();
    counter.text
      .setText(`-${counter.total}`)
      .setColor(color)
      .setPosition(target.x, target.y - 30)
      .setAlpha(1)
      .setScale(1.25);

    // Float away once the hits stop coming.
    const text = counter.text;
    counter.tween = this.scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      scale: 1,
      delay: DAMAGE_MERGE_MS,
      duration: 700,
      onComplete: () => {
        text.destroy();
        if (this.counters.get(target)?.text === text) this.counters.delete(target);
      },
    });
  }

  hit(target, amount, color) {
    target.takeDamage(amount);
    this.showDamage(target, amount, color);
  }

  // Melee hit: a quick arc in front of you.
  drawSwing(weapon) {
    const p = this.player;
    const g = this.scene.add.graphics().setDepth(40);
    const radius = weapon.reach * 0.6;
    const cx = p.x + p.facing * 6;
    const cy = p.y - 6;

    // Facing right: sweep from up-forward to down-forward (mirrored for left).
    const start = p.facing > 0 ? -70 : 250;
    const end = p.facing > 0 ? 50 : 130;

    g.lineStyle(5, weapon.swingColor, 0.9);
    g.beginPath();
    g.arc(cx, cy, radius, Phaser.Math.DegToRad(start), Phaser.Math.DegToRad(end), p.facing < 0);
    g.strokePath();

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: SWING_FADE_MS,
      onComplete: () => g.destroy(),
    });
  }

  // 1 up close, sliding down to minMultiplier between startPx and endPx.
  falloffMultiplier(falloff, distance) {
    if (!falloff) return 1;

    const { startPx, endPx, minMultiplier } = falloff;
    if (distance <= startPx) return 1;
    if (distance >= endPx) return minMultiplier;

    const t = (distance - startPx) / (endPx - startPx);
    return 1 - t * (1 - minMultiplier);
  }

  // Floating "-34" above whatever got hit.
  showDamage(victim, amount, color = DAMAGE_COLOR) {
    this.floatText(victim, `-${amount}`, color);
  }

  // Small text that floats up from something and fades.
  floatText(obj, message, color) {
    const jitter = Phaser.Math.Between(-10, 10); // numbers don't stack exactly
    const text = this.makeFloatText(obj.x + jitter, obj.y - 30, message, color);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 700,
      onComplete: () => text.destroy(),
    });
  }

  makeFloatText(x, y, message, color) {
    return this.scene.add
      .text(x, y, message, {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(60);
  }

  // ---- Throwables ----

  startAim(event) {
    if (event.repeat || !this.player.alive || this.aiming) return;
    if (this.throwableCount <= 0) return;

    this.typing.setTyping(false); // free to move while aiming; lock stays saved
    this.aiming = true;
    this.aimStartedAt = this.scene.time.now;
    this.aimAngle = AIM.startAngle;
    this.player.setAiming(true);
  }

  releaseAim() {
    if (!this.aiming) return;

    const velocity = this.throwVelocity();
    this.stopAim();
    this.throwGrenade(velocity);
  }

  stopAim() {
    this.aiming = false;
    this.player.setAiming(false);
    this.preview.clear();
  }

  // Called when the player dies mid-aim: no throw.
  cancelAim() {
    if (this.aiming) this.stopAim();
  }

  // Called on respawn: back to the default weapons and throwables.
  resetLoadout() {
    this.resetSlots();
    this.throwable = THROWABLES[DEFAULT_LOADOUT.throwable.key];
    this.throwableCount = DEFAULT_LOADOUT.throwable.count;
  }

  // What you're carrying, as pickup items (dropped when you die).
  // Your default melee stays with you (everyone respawns with one).
  loadoutItems() {
    const items = [];
    for (const slot of GUN_SLOTS) {
      const gun = this.slots[slot];
      if (gun) items.push({ type: 'gun', key: gun.key, ammo: this.ammo[slot] });
    }

    const melee = this.slots[MELEE_SLOT];
    if (melee && melee.key !== DEFAULT_LOADOUT.melee) {
      items.push({ type: 'melee', key: melee.key });
    }

    if (this.throwableCount > 0) {
      items.push({ type: 'throwable', key: this.throwable.key, count: this.throwableCount });
    }
    return items;
  }

  // Pick up throwables. Same type: top up to maxCarry. Different type: swap,
  // and hand back what you had so it can go into the crate.
  // Returns { taken, returned: { key, count } | null }.
  takeThrowable(key, count) {
    const config = THROWABLES[key];

    if (this.throwable.key === key) {
      const taken = Math.min(count, config.maxCarry - this.throwableCount);
      this.throwableCount += Math.max(0, taken);
      return { taken: Math.max(0, taken), returned: null };
    }

    const returned =
      this.throwableCount > 0 ? { key: this.throwable.key, count: this.throwableCount } : null;
    this.cancelAim();
    this.throwable = config;
    this.throwableCount = Math.min(count, config.maxCarry);
    return { taken: this.throwableCount, returned };
  }

  throwOrigin() {
    const p = this.player;
    return { x: p.x + p.facing * 14, y: p.y - 10 };
  }

  throwVelocity() {
    const t = this.throwable;
    const speed = t.minSpeed + (t.maxSpeed - t.minSpeed) * this.charge;
    const rad = Phaser.Math.DegToRad(this.aimAngle);

    return {
      vx: Math.cos(rad) * speed * this.player.facing,
      vy: Math.sin(rad) * speed,
    };
  }

  throwGrenade({ vx, vy }) {
    const origin = this.throwOrigin();
    const config = this.throwable;
    const grenade = new Grenade(
      this.scene,
      origin.x,
      origin.y,
      config,
      this.groundLayer,
      this.worldHeight,
      this.player
    );
    grenade.body.setVelocity(vx, vy);
    this.collisions.addGrenade(grenade);
    grenade.on('explode', (x, y) => this.explode(x, y, config));

    this.grenades.push(grenade);
    this.throwableCount -= 1;
    this.thrown += 1;
  }

  // Shared blast for every explosive throwable.
  // Full damage up close, falling to 0 at the edge. Walls block it.
  explode(x, y, config) {
    for (const target of this.typing.targets) {
      this.applyBlast(x, y, config, target, 1);
    }

    // Your own throwable can hurt you (selfDamage: 0 = safe, 1 = full).
    if (config.selfDamage > 0) {
      this.applyBlast(x, y, config, this.player, config.selfDamage, 'self');
    }
  }

  applyBlast(x, y, config, victim, multiplier, cause) {
    if (!victim.alive) return;

    const dist = Phaser.Math.Distance.Between(x, y, victim.x, victim.y);
    if (dist > config.blastRadius) return;
    if (!hasLineOfSight(this.groundLayer, x, y - 4, victim.x, victim.y)) return;

    const damage = Math.round(this.blastDamage(dist, config) * multiplier);
    if (damage <= 0) return;

    victim.takeDamage(damage, cause);
    this.showDamage(victim, damage);
    this.applyKnockback(x, y, config, victim, damage);
  }

  // Push survivors away from the blast. Only things with a physics body
  // and applyKnockback() move (the player now; bots later, not dummies).
  applyKnockback(x, y, config, victim, damage) {
    if (!config.knockback || !victim.alive || !victim.applyKnockback) return;

    const strength = Math.min(1, damage / config.knockbackFullAt);
    let dx = victim.x - x;
    let dy = victim.y - y;
    const len = Math.hypot(dx, dy);

    if (len < 1) {
      dx = 0;  // blast right on top of you: straight up
      dy = -1;
    } else {
      dx /= len;
      dy /= len;
    }

    victim.applyKnockback(
      dx * config.knockback * strength,
      (dy * config.knockback - config.knockbackLift) * strength
    );
  }

  blastDamage(dist, config) {
    const { damage, directHitRadius, blastRadius } = config;
    if (dist <= directHitRadius) return damage;

    const t = (dist - directHitRadius) / (blastRadius - directHitRadius);
    return damage * (1 - t);
  }

  updateAim(delta) {
    const dt = delta / 1000;
    const { up, down } = this.player.cursors;

    // Up/Down tilt the aim (Left/Right move the player, handled in Player).
    if (up.isDown) this.aimAngle -= AIM.turnSpeed * dt;
    if (down.isDown) this.aimAngle += AIM.turnSpeed * dt;
    this.aimAngle = Phaser.Math.Clamp(this.aimAngle, AIM.minAngle, AIM.maxAngle);

    this.drawPreview();
  }

  // Dotted arc showing where the grenade will fly.
  drawPreview() {
    const { vx, vy } = this.throwVelocity();
    const o = this.throwOrigin();
    const gravity = this.scene.physics.world.gravity.y;

    this.preview.clear();
    this.preview.fillStyle(0xffffff, 0.8);

    for (let i = 1; i <= PREVIEW_DOTS; i++) {
      const t = i * PREVIEW_STEP;
      const x = o.x + vx * t;
      const y = o.y + vy * t + 0.5 * gravity * t * t;
      this.preview.fillCircle(x, y, 3.5 - i * 0.15);
    }
  }

  // ---- Frame update ----

  update(delta) {
    if (this.aiming) this.updateAim(delta);

    this.grenades = this.grenades.filter((g) => g.active);
    for (const grenade of this.grenades) grenade.update();

    this.projectiles = this.projectiles.filter((r) => r.active);
    for (const round of this.projectiles) round.update();

    this.bullets = this.bullets.filter((b) => b.active);
    for (const bullet of this.bullets) bullet.update(delta);

    this.saws = this.saws.filter((s) => s.active);
    for (const saw of this.saws) saw.update(delta);

    this.status.update();

    this.drawReloadRing();
  }

  // LMG: after `belt` bursts the gun spins down to reload for reloadMs.
  // Letters are blocked meanwhile (switching or running is up to you).
  countBurst(weapon) {
    if (!weapon.belt) return;
    this.belt[this.active] += 1;
    if (this.belt[this.active] < weapon.belt) return;

    this.belt[this.active] = 0;
    this.reloadUntil[this.active] = this.scene.time.now + weapon.reloadMs;
    this.typing.block(weapon.reloadMs, 'reload');
    this.floatText(this.player, 'reloading', RELOAD_COLOR);
  }

  // A spinning ring around you that fills up while the LMG reloads.
  drawReloadRing() {
    const g = this.reloadRing;
    g.clear();
    if (!this.reloading || !this.player.alive) return;

    const now = this.scene.time.now;
    const weapon = this.current;
    const done = 1 - (this.reloadUntil[this.active] - now) / weapon.reloadMs;
    const spin = (now / 150) % (Math.PI * 2);
    const x = this.player.x;
    const y = this.player.y - 4;

    g.lineStyle(3, 0x000000, 0.5);
    g.strokeCircle(x, y, RING_RADIUS);
    g.lineStyle(3, 0xffd166, 1);
    g.beginPath();
    g.arc(x, y, RING_RADIUS, spin, spin + Math.PI * 2 * done, false);
    g.strokePath();
  }
}