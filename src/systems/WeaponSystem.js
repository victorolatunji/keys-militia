import Phaser from 'phaser';
import Grenade from '../entities/Grenade.js';
import { hasLineOfSight } from './LineOfSight.js';
import {
  WEAPONS,
  THROWABLES,
  AIM,
  DEFAULT_LOADOUT,
  GUN_SWITCH_MS,
} from '../data/weapons.js';

const TRACER_FADE_MS = 150;
const DAMAGE_COLOR = '#ff9f1c';  // full-damage hit
const REDUCED_COLOR = '#ffe8b0'; // hit weakened by range falloff
const EMPTY_COLOR = '#c9c9c9';   // "Pistol empty"
const PREVIEW_DOTS = 14;
const PREVIEW_STEP = 0.06; // seconds between preview dots

// Gun slots, Shift switching, firing (damage + tracer), and throwables
// (hold Space to aim and charge, release to throw, blast with falloff).
export default class WeaponSystem {
  constructor(scene, player, typing, groundLayer, worldHeight, collisions) {
    this.scene = scene;
    this.collisions = collisions;
    this.player = player;
    this.typing = typing;
    this.groundLayer = groundLayer;
    this.worldHeight = worldHeight;

    // Guns
    this.guns = DEFAULT_LOADOUT.guns.map((key) => (key ? WEAPONS[key] : null));
    this.ammo = this.guns.map((gun) => (gun ? gun.ammo : 0)); // shots left per slot
    this.active = 0;
    this.shots = 0;
    this.lastShot = null; // { distance, multiplier } for the debug readout

    // Throwable
    this.throwable = THROWABLES[DEFAULT_LOADOUT.throwable.key];
    this.throwableCount = DEFAULT_LOADOUT.throwable.count;
    this.aiming = false;
    this.aimAngle = AIM.startAngle;
    this.aimStartedAt = 0;
    this.grenades = [];
    this.thrown = 0;

    this.preview = scene.add.graphics().setDepth(45);

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

  // Gun in your hand, or null when both slots are empty.
  get current() {
    return this.guns[this.active];
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

  switchGun() {
    const next = (this.active + 1) % this.guns.length;
    if (next === this.active || !this.guns[next]) return; // empty slot

    this.active = next;
    this.typing.onWeaponChanged(GUN_SWITCH_MS);
  }

  hasGun(key) {
    return this.guns.some((gun) => gun?.key === key);
  }

  // Slot holding this gun, or -1.
  slotOf(key) {
    return this.guns.findIndex((gun) => gun?.key === key);
  }

  // Put a gun in a slot (0 or 1) with this much ammo (default: full).
  // Returns the gun that was there as { key, ammo }, or null.
  // Replacing the gun in your hand counts as a switch (words re-roll).
  setGun(slot, key, ammo) {
    const old = this.guns[slot] ? { key: this.guns[slot].key, ammo: this.ammo[slot] } : null;
    const config = WEAPONS[key];

    this.guns[slot] = config;
    this.ammo[slot] = Math.min(ammo ?? config.ammo, config.ammo);

    // Holding nothing? Take the new gun in hand.
    if (!this.guns[this.active]) this.active = slot;
    if (slot === this.active) this.typing.onWeaponChanged(GUN_SWITCH_MS);
    return old;
  }

  // Top up a slot's ammo, up to a full gun. Returns how many shots were added.
  refillGun(slot, ammo) {
    const gun = this.guns[slot];
    if (!gun) return 0;

    const taken = Math.max(0, Math.min(ammo, gun.ammo - this.ammo[slot]));
    this.ammo[slot] += taken;
    return taken;
  }

  // Out of ammo: the gun is thrown away and you switch to your other gun.
  emptyCurrent() {
    const gun = this.current;
    this.guns[this.active] = null;
    this.ammo[this.active] = 0;
    this.floatText(this.player, `${gun.name} empty`, EMPTY_COLOR);

    const other = this.guns.findIndex(Boolean);
    if (other !== -1) this.active = other;
    this.typing.onWeaponChanged(GUN_SWITCH_MS); // re-roll words (or hide them: no gun)
  }

  // Called by TypingSystem when a word is finished. Always hits;
  // distance only changes how much damage the shot does.
  fire(target) {
    const gun = this.current;
    if (!gun) return;
    const p = this.player;
    const distance = Phaser.Math.Distance.Between(p.x, p.y, target.x, target.y);
    const multiplier = this.falloffMultiplier(gun.falloff, distance);
    const damage = Math.round(gun.damage * multiplier);

    this.shots += 1;
    this.lastShot = { distance: Math.round(distance), multiplier };
    this.drawTracer(target, gun);
    target.takeDamage(damage);
    this.showDamage(target, damage, multiplier < 1 ? REDUCED_COLOR : DAMAGE_COLOR);

    this.ammo[this.active] -= 1;
    if (this.ammo[this.active] <= 0) this.emptyCurrent();
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

  drawTracer(target, gun) {
    const p = this.player;
    const g = this.scene.add.graphics().setDepth(40);
    g.lineStyle(gun.tracerWidth, gun.tracerColor, 1);
    g.lineBetween(p.x + p.facing * 16, p.y - 4, target.x, target.y);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: TRACER_FADE_MS,
      onComplete: () => g.destroy(),
    });
  }

  // Floating "-34" above whatever got hit.
  showDamage(victim, amount, color = DAMAGE_COLOR) {
    this.floatText(victim, `-${amount}`, color);
  }

  // Small text that floats up from something and fades.
  floatText(obj, message, color) {
    const text = this.scene.add
      .text(obj.x, obj.y - 30, message, {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(60);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 700,
      onComplete: () => text.destroy(),
    });
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

  // Called on respawn: back to the default guns and throwables.
  resetLoadout() {
    this.guns = DEFAULT_LOADOUT.guns.map((key) => (key ? WEAPONS[key] : null));
    this.ammo = this.guns.map((gun) => (gun ? gun.ammo : 0));
    this.active = 0;
    this.throwable = THROWABLES[DEFAULT_LOADOUT.throwable.key];
    this.throwableCount = DEFAULT_LOADOUT.throwable.count;
  }

  // What you're carrying, as pickup items (dropped when you die).
  loadoutItems() {
    const items = [];
    this.guns.forEach((gun, slot) => {
      if (gun) items.push({ type: 'gun', key: gun.key, ammo: this.ammo[slot] });
    });
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
  }
}