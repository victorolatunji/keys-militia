import { fallScale, gravityK } from './Gravity.js';
import Phaser from 'phaser';
import Grenade from '../entities/Grenade.js';
import Projectile from '../entities/Projectile.js';
import Saw from '../entities/Saw.js';
import StatusSystem from './StatusSystem.js';
import FirePatch from '../entities/FirePatch.js';
import Cloud from '../entities/Cloud.js';
import { FAMILY_MATERIAL, CLOUD_TINTS, BLAST_THROUGH_WALL, JUICE } from '../data/effects.js';
import { iconKey } from '../ui/Icons.js';
import { TACTICAL_SOUNDS } from '../data/sounds.js';
import { groundBelow } from './Terrain.js';
import Bullet from '../entities/Bullet.js';
import { hasLineOfSight } from './LineOfSight.js';
import {
  WEAPONS,
  THROWABLES,
  AIM,
  DEFAULT_LOADOUT,
  GUN_SWITCH_MS,
} from '../data/weapons.js';
import { ITEMS } from '../data/items.js';
import { BULLETS, BULLET_DEFAULT, DAMAGE_MERGE_MS, SHOT_ART } from '../data/bullets.js';
import { RIG } from '../data/rigs.js';
import { muzzleOf, muzzleFlash, shotImage, projKey } from './ShotFx.js';

const DAMAGE_COLOR = '#ff9f1c';  // full-damage hit
const REDUCED_COLOR = '#ffe8b0'; // hit weakened by range falloff
const BURN_COLOR = '#e5383b';    // burning damage ticks
const GAS_COLOR = '#9ef01a';     // gas damage ticks
const EMPTY_COLOR = '#c9c9c9';   // "Pistol empty"
const SWING_FADE_MS = 160;
const RELOAD_COLOR = '#ffd166';  // LMG "reloading"
const RING_RADIUS = 22;          // LMG reload ring around you
const PELLET_SPREAD = 14;        // px: shotgun pellets scatter at least this much...
const PELLET_CONE = 0.18;        // ...and this share of the distance (a cone that widens)
const BURST_SCATTER = 5;         // px: later bullets of a burst wander a little
const PREVIEW_DOTS = 14;
// Flashbang on you: glare size and strength (blur and length are in THROWABLES).
const FLASH_GLOW = {
  radiusPx: 380,    // how far the white glare reaches from the bang
  alpha: 0.7,       // peak strength at the middle (1 = solid white)
  afterimage: 0.3,  // how strong the burned-in picture is
};
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

    // Throwables: two slots, each its own kind and count (Tab or the mouse
    // wheel switches). Space / left mouse throws the one in your hand.
    this.resetThrowables();
    this.aiming = false;
    this.mouseAim = false;  // aiming with the cursor (else Up/Down + hold time)
    this.mouseCharge = 0;
    this.aimAngle = AIM.startAngle;
    this.aimStartedAt = 0;
    this.grenades = [];
    this.projectiles = []; // launcher rounds in flight
    this.saws = [];        // Saw Gun blades in flight or grinding

    // Burning, pinned (and later shocked, dazed...): ticks and damage.
    // Your effects count as your hits; a bot's would count as theirs.
    // kind: 'fire' (burning) or 'bleed' (an axe wound).
    this.status = new StatusSystem(scene, (target, amount, source, kind = 'fire') => {
      const color = kind === 'bleed' ? DAMAGE_COLOR : BURN_COLOR;
      if (source === 'player' && target === this.player) target.takeDamage(amount, 'self', kind); // your own fire
      else if (source === 'player') this.addDamage(target, amount, color, kind);
      else target.takeDamage(amount, source, kind);
    });
    this.fires = [];       // molotov fire patches
    this.stickies = [];    // your planted/flying stickies (they double as trip mines)
    this.clouds = [];      // smoke and gas clouds
    this.bullets = [];     // gun bullets in flight
    this.counters = new Map(); // target -> its running damage number
    this.thrown = 0;

    this.preview = scene.add.graphics().setDepth(45);
    this.reloadRing = scene.add.graphics().setDepth(46);

    player.on('shieldBroke', () => this.floatText(player, 'shield broke', EMPTY_COLOR));
    player.on('armorBroke', () => this.floatText(player, 'armor spent', EMPTY_COLOR));

    const kb = scene.input.keyboard;
    kb.addCapture(['SPACE', 'TAB']); // stop the browser scrolling / changing focus
    kb.on('keydown-SHIFT', this.handleShift, this);
    kb.on('keydown-SPACE', this.startAim, this);
    kb.on('keyup-SPACE', this.releaseAim, this);
    kb.on('keydown-TAB', this.handleTab, this);

    // Mouse: hold the left button to aim at the cursor, let go to throw.
    // Moving the mouse while holding Space aims with the cursor too.
    // The wheel switches throwables.
    const input = scene.input;
    const onDown = (ptr) => {
      if (ptr.leftButtonDown()) this.startAim({ repeat: false }, true);
    };
    const onUp = (ptr) => {
      if (this.aiming && this.mouseAim && ptr.leftButtonReleased()) this.releaseAim();
    };
    const onMove = () => {
      if (this.aiming) this.mouseAim = true;
    };
    const onWheel = (ptr, objects, dx, dy) => {
      if (dy !== 0) this.switchThrowable();
    };
    input.on('pointerdown', onDown);
    input.on('pointerup', onUp);
    input.on('pointermove', onMove);
    input.on('wheel', onWheel);

    scene.events.once('shutdown', () => {
      kb.off('keydown-SHIFT', this.handleShift, this);
      kb.off('keydown-SPACE', this.startAim, this);
      kb.off('keyup-SPACE', this.releaseAim, this);
      kb.off('keydown-TAB', this.handleTab, this);
      input.off('pointerdown', onDown);
      input.off('pointerup', onUp);
      input.off('pointermove', onMove);
      input.off('wheel', onWheel);
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

  // Spawn loadout, all full and reshuffled every spawn: a random gun from
  // each family in DEFAULT_LOADOUT.guns (assault + sniper) and a random
  // melee weapon.
  resetSlots() {
    const melee = Phaser.Utils.Array.GetRandom(DEFAULT_LOADOUT.melee);
    this.lastSpawnGuns ??= [];
    const guns = DEFAULT_LOADOUT.guns.map((g, i) => this.spawnGun(g, this.lastSpawnGuns[i]));
    this.lastSpawnGuns = guns.map((w) => w?.key);
    this.slots = [...guns, WEAPONS[melee]];
    this.ammo = this.slots.map((w) => (w ? w.ammo : 0));
    this.active = 0;
    this.belt = this.slots.map(() => 0);        // LMG bursts fired since the last reload
    this.reloadUntil = this.slots.map(() => 0); // LMG reloading until (per slot)
  }

  // A weapon key gives that gun; a family (or list of families) gives a
  // random gun from them, not the same as last time (avoid) if there's a choice.
  spawnGun(entry, avoid = null) {
    if (!entry) return null;
    if (typeof entry === 'string' && WEAPONS[entry]) return WEAPONS[entry];
    const families = Array.isArray(entry) ? entry : [entry];
    let pool = Object.values(WEAPONS).filter((w) => families.includes(w.category) && !w.natural);
    if (pool.length > 1) pool = pool.filter((w) => w.key !== avoid);
    return Phaser.Utils.Array.GetRandom(pool) ?? null;
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

  // 0 to 1: how charged the throw is (with the cursor: how far it is).
  get charge() {
    if (!this.aiming) return 0;
    if (this.mouseAim) return this.mouseCharge;
    const held = this.scene.time.now - this.aimStartedAt;
    return Math.min(1, held / this.throwable.chargeMs);
  }

  // ---- Guns ----

  handleShift(event) {
    if (event.repeat || !this.player.alive) return;
    this.switchGun();
  }

  // Can this weapon be used right now? With a Riot Shield, only one-handed
  // weapons (pistol, SMG, melee).
  usable(weapon) {
    if (!weapon) return false;
    const shield = this.player.shield;
    return !shield || shield.config.allowedWith.includes(weapon.category);
  }

  // Shift: next slot that holds something you can use (gun 1 -> gun 2 -> melee -> gun 1).
  switchGun() {
    if (this.shockedNote()) return;
    for (let step = 1; step < this.slots.length; step++) {
      const next = (this.active + step) % this.slots.length;
      if (this.usable(this.slots[next])) {
        this.active = next;
        this.typing.onWeaponChanged(GUN_SWITCH_MS);
        this.blockIfReloading();
        this.scene.sfx?.play('switch');
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

    // A gun you pick up goes straight into your hand (unless your Riot
    // Shield doesn't allow it: then you keep what you hold).
    if (this.usable(config) && slot !== this.active) {
      this.cancelAim();
      this.active = slot;
      this.scene.sfx?.play('switch');
      this.typing.onWeaponChanged(GUN_SWITCH_MS);
      this.blockIfReloading();
    } else if (slot === this.active) {
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
    this.scene.sfx?.play('empty');

    const next = this.slots.findIndex((w) => this.usable(w));
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
    p.lastAttackAt = this.scene.time.now; // shooting gives away a hiding spot
    this.lastShot = { distance: Math.round(distance), multiplier };

    const hits = weapon.hits ?? 1;
    const delay = weapon.hitDelayMs ?? 0;

    // A kick of the screen, by how heavy the weapon is.
    const kick = JUICE.shotShake[weapon.category] ?? 0;
    if (kick) this.scene.cameras.main.shake(JUICE.shotShake.ms, kick);

    // Bullets make their sound per shot (burst); everything else here.
    const bullets = !(weapon.category === 'launcher' || weapon.saw || weapon.beam || weapon.flame || weapon.category === 'melee');
    if (!bullets) this.scene.sfx?.shot(weapon, p);
    if (weapon.category === 'melee') this.scene.sfx?.play('meleeHit', target);

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
    const at = muzzleOf(p, target, this.groundLayer);
    const { x, y } = at;
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
    muzzleFlash(this.scene, weapon, at);
  }

  // ---- Laser and Flamethrower ----

  // A straight beam from you through the target, on until a wall (or its
  // range) stops it. Every enemy it crosses is hit: full damage to the
  // first, then pierceShare of the one before for each after.
  fireLaser(target, weapon, damage) {
    const beam = weapon.beam;
    const p = this.player;
    const at = muzzleOf(p, target, this.groundLayer);
    const { x: x1, y: y1 } = at;
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

    this.drawBeam(x1, y1, end, beam);
    muzzleFlash(this.scene, weapon, { x: x1, y: y1, angle });
  }

  // The laser-beam art stretched from the muzzle to where it stopped, with a
  // glow where it hits, both fading out. (No art: two drawn lines.)
  drawBeam(x1, y1, end, beam) {
    const art = SHOT_ART.laser;
    const length = Phaser.Math.Distance.Between(x1, y1, end.x, end.y);
    const ray = this.scene.textures.exists(projKey(art.beam)) && this.scene.add.image(x1, y1, projKey(art.beam));
    if (ray) {
      ray.setOrigin(0, 0.5).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
      ray.setDisplaySize(length, beam.width * art.thick).setRotation(Phaser.Math.Angle.Between(x1, y1, end.x, end.y));
      const glow = shotImage(this.scene, projKey(art.glow), art.glowSize, 45).setPosition(end.x, end.y).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: [ray, glow], alpha: 0, duration: beam.fadeMs, onComplete: () => { ray.destroy(); glow.destroy(); } });
      this.scene.tweens.add({ targets: ray, scaleY: ray.scaleY * 0.3, duration: beam.fadeMs });
      return;
    }
    const g = this.scene.add.graphics().setDepth(45);
    g.lineStyle(beam.width * 2.5, beam.color, 0.35);
    g.lineBetween(x1, y1, end.x, end.y);
    g.lineStyle(beam.width, beam.glowColor, 1);
    g.lineBetween(x1, y1, end.x, end.y);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: beam.fadeMs, onComplete: () => g.destroy() });
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
    const { x, y } = muzzleOf(p, target, this.groundLayer);
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const half = Phaser.Math.DegToRad(flame.coneDeg / 2);

    for (const t of this.typing.targets) {
      if (!t.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
      const off = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(x, y, t.x, t.y) - angle));
      const inCone = d <= weapon.reach + t.width / 2 && off <= half && hasLineOfSight(this.groundLayer, x, y, t.x, t.y);
      if (t !== target && !inCone) continue;
      this.addDamage(t, damage, BURN_COLOR, 'fire');
      this.status.apply(t, 'burning');
    }

    // Puffs of fire (the flame-puff art) rushing out along the cone, growing.
    const art = SHOT_ART.flame;
    for (let i = 0; i < 14; i++) {
      const a = angle + Phaser.Math.FloatBetween(-half, half);
      const dist = Phaser.Math.FloatBetween(weapon.reach * 0.6, weapon.reach);
      const puff =
        shotImage(this.scene, projKey(art.art), art.length * Phaser.Math.FloatBetween(0.7, 1.1), 44) ??
        this.scene.add.circle(0, 0, Phaser.Math.Between(4, 8), i % 3 ? flame.color : flame.coreColor, 0.85).setDepth(44);
      puff.setPosition(x, y).setRotation(a).setAlpha(0.95).setVisible(i === 0);
      if (Math.random() < 0.5) puff.setFlipY?.(true);
      // One after another (a tween's own delay left later puffs stuck at the muzzle).
      this.scene.time.delayedCall(i * 20, () => {
        puff.setVisible(true);
        this.scene.tweens.add({
          targets: puff,
          x: x + Math.cos(a) * dist,
          y: y + Math.sin(a) * dist - Phaser.Math.Between(0, 14),
          scale: puff.scale * art.grow,
          alpha: 0,
          duration: 300,
          ease: 'Quad.easeOut',
          onComplete: () => puff.destroy(),
        });
      });
    }
  }

  // ---- Saw Gun ----

  launchSaw(target, weapon) {
    const p = this.player;
    const at = muzzleOf(p, target, this.groundLayer);
    const { x, y } = at;
    const saw = new Saw(this.scene, x, y, target, weapon.saw, this.typing.targets, this.groundLayer, {
      cut: (enemy, dmg) => this.addDamage(enemy, dmg, REDUCED_COLOR),
      grind: (enemy, dmg) => {
        this.addDamage(enemy, dmg, DAMAGE_COLOR, 'melee');
        const metal = this.scene.sfx?.materialOf(enemy) === 'machine';
        this.scene.sfx?.play(metal ? 'grindMetal' : 'grindFlesh', enemy);
      },
      explode: (ex, ey) => {
        this.blastFx(ex, ey, weapon.blast.blastRadius);
        this.explode(ex, ey, weapon.blast);
      },
    });
    this.saws.push(saw);
    muzzleFlash(this.scene, weapon, at);
  }

  // Orange flash and a little camera shake.
  // Old circle burst: explosions now draw themselves in explode() / blast()
  // (BlastFx), so this does nothing. Kept so older calls still work.
  blastFx() {}

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
        if (!pellets || i === 0) {
          this.scene.sfx?.shot(weapon, this.player); // pellets: one bang
          // A spent casing flips out (fast guns: not every shot).
          const chance = JUICE.shells.chance[weapon.category] ?? 1;
          if (Math.random() < chance) this.scene.blastFx?.shell(this.player.x + this.player.facing * 6, this.player.y - 6, this.player.facing);
        }
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
    const at = muzzleOf(p, target, this.groundLayer);
    const { x, y } = at;
    const offset = {
      x: scatter ? Phaser.Math.Between(-scatter, scatter) : 0,
      y: scatter ? Phaser.Math.Between(-scatter, scatter) : 0,
    };
    const style = weapon.bullet ?? BULLETS[weapon.category] ?? BULLET_DEFAULT;

    this.bullets.push(
      new Bullet(this.scene, x, y, target, offset, style, weapon.tracerColor, weapon.tracerWidth, onArrive)
    );
    muzzleFlash(this.scene, weapon, at);
    this.scene.blastFx?.muzzleSmoke(x, y, p.facing);
  }

  // A bullet landed: damage, and one damage number per target that counts up
  // while a burst keeps hitting (instead of a pile of small numbers).
  // kind: 'bullet', 'melee', 'blast' or 'fire' (armor and hit effects use it).
  addDamage(target, amount, color, kind = 'bullet') {
    target.takeDamage(amount, undefined, kind);

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
    target.takeDamage(amount, undefined, 'melee');
    this.showDamage(target, amount, color);
  }

  // Melee hit: a quick arc in front of you.
  drawSwing(weapon) {
    const p = this.player;
    p.lastSwingAt = this.scene.time.now; // the rig swings your arm (CharacterRig.swingPose)
    // The slash trail shows as the arm comes down (after the wind-up).
    if (p.rig) {
      const M = RIG.melee;
      this.scene.time.delayedCall(M.swingMs * M.windUp, () => this.drawSlash(weapon));
      return;
    }
    this.drawSlash(weapon);
  }

  drawSlash(weapon) {
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

  // mouse: started with the left mouse button (aims at the cursor).
  startAim(event, mouse = false) {
    if (event.repeat || !this.player.alive || this.aiming) return;
    if (!this.throwable || this.throwableCount <= 0) return;

    this.typing.setTyping(false); // free to move while aiming; lock stays saved
    this.aiming = true;
    this.mouseAim = mouse;
    this.aimStartedAt = this.scene.time.now;
    this.aimAngle = AIM.startAngle;
    this.player.setAiming(true);
  }

  releaseAim() {
    if (!this.aiming) return;
    if (this.mouseAim) this.aimAtCursor();

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
    this.resetThrowables();
    this.clearFlash();
  }

  // ---- Throwable slots ----

  // Slot 1 gets your default throwable, slot 2 starts empty.
  resetThrowables() {
    this.throwSlots = [
      { config: THROWABLES[DEFAULT_LOADOUT.throwable.key], count: DEFAULT_LOADOUT.throwable.count },
      { config: null, count: 0 },
    ];
    this.throwActive = 0;
  }

  // The throwable in your hand (null when both slots are empty).
  get throwable() {
    return this.throwSlots[this.throwActive].config;
  }

  set throwable(config) {
    this.throwSlots[this.throwActive].config = config;
  }

  get throwableCount() {
    return this.throwSlots[this.throwActive].count;
  }

  // Run out: the slot empties and the other throwable (if any) comes to hand.
  set throwableCount(n) {
    const slot = this.throwSlots[this.throwActive];
    slot.count = Math.max(0, n);
    if (slot.count > 0) return;
    slot.config = null;
    const other = 1 - this.throwActive;
    if (this.throwSlots[other].config) this.throwActive = other;
  }

  handleTab(event) {
    event.preventDefault?.();
    if (event.repeat || !this.player.alive) return;
    this.switchThrowable();
  }

  // Tab / mouse wheel: the other throwable slot (if it holds anything).
  // Fine mid-aim: the preview just changes to the new throwable.
  switchThrowable() {
    const other = 1 - this.throwActive;
    const slot = this.throwSlots[other];
    if (!slot.config) return;
    this.throwActive = other;
    this.floatText(this.player, `${slot.config.name} x${slot.count}`, '#ffffff');
  }

  // What you're carrying, as pickup items (dropped when you die).
  // Your default melee stays with you (everyone respawns with one).
  loadoutItems() {
    const items = [];
    for (const slot of GUN_SLOTS) {
      const gun = this.slots[slot];
      if (gun) items.push({ type: 'gun', key: gun.key, ammo: this.ammo[slot] });
    }

    // Melee weapons never drop.
    for (const t of this.throwSlots) {
      if (t.config && t.count > 0) items.push({ type: 'throwable', key: t.config.key, count: t.count });
    }
    return items;
  }

  // Put this slot in your hand (if you can use it right now).
  selectSlot(slot) {
    if (slot === this.active || !this.usable(this.slots[slot])) return;
    if (this.shockedNote()) return;
    this.active = slot;
    this.scene.sfx?.play('switch');
    this.typing.onWeaponChanged(GUN_SWITCH_MS);
    this.blockIfReloading();
  }

  // ---- Jet Boost and Riot Shield ----

  pickBoost() {
    this.player.startBoost(ITEMS.jetBoost);
  }

  // The shield takes your second hand: switch to a one-handed weapon
  // (a pistol or SMG you carry, else your melee weapon).
  pickShield(hp) {
    this.player.equipShield(ITEMS.riotShield, hp);
    if (this.usable(this.current)) return;
    const slot = this.slots.findIndex((w) => this.usable(w));
    this.active = slot === -1 ? MELEE_SLOT : slot;
    this.typing.onWeaponChanged(GUN_SWITCH_MS);
    this.blockIfReloading();
  }

  // Pick up throwables (two slots, like your two guns, never mixed):
  //   same kind as a slot: top that slot up to maxCarry
  //   a free slot: it goes there, in your hand
  //   both slots hold other kinds: swaps with the one in your hand, and
  //   hands back what you had so it can lie where the pickup was.
  // Returns { taken, returned: { key, count } | null }.
  takeThrowable(key, count) {
    const config = THROWABLES[key];

    const sameIndex = this.throwSlots.findIndex((t) => t.config?.key === key);
    if (sameIndex !== -1) {
      const same = this.throwSlots[sameIndex];
      const taken = Math.max(0, Math.min(count, config.maxCarry - same.count));
      same.count += taken;
      if (taken > 0 && sameIndex !== this.throwActive) {
        this.cancelAim();
        this.throwActive = sameIndex; // what you just picked up is ready to throw
      }
      return { taken, returned: null };
    }

    let index = this.throwSlots.findIndex((t) => !t.config);
    let returned = null;
    if (index === -1) {
      index = this.throwActive;
      const old = this.throwSlots[index];
      returned = { key: old.config.key, count: old.count };
    }
    this.cancelAim();
    const taken = Math.min(count, config.maxCarry);
    this.throwSlots[index] = { config, count: taken };
    this.throwActive = index;
    return { taken, returned };
  }

  throwOrigin() {
    const p = this.player;
    return { x: p.x + p.facing * 14, y: p.y - 10 };
  }

  // Straight throws (sticky, axe): how far it flies flat before dropping.
  throwRange() {
    const t = this.throwable;
    return t.minRangePx + (t.maxRangePx - t.minRangePx) * this.charge;
  }

  throwVelocity() {
    const t = this.throwable;
    // Lobbed throws: slower on low-gravity maps, so they land about as far.
    const speed = t.flight === 'straight' ? t.speed : (t.minSpeed + (t.maxSpeed - t.minSpeed) * this.charge) * fallScale(this.scene);
    const rad = Phaser.Math.DegToRad(this.aimAngle);

    return {
      vx: Math.cos(rad) * speed * this.player.facing,
      vy: Math.sin(rad) * speed,
    };
  }

  // Throw whatever throwable you carry. What happens when it goes off
  // depends on its kind (see Grenade.js).
  throwGrenade({ vx, vy }) {
    const origin = this.throwOrigin();
    const config = this.throwable;

    // Throwing takes your free hand: a Riot Shield is put down where you
    // stand (it keeps its wear; press 3 on it to pick it back up).
    this.putDownShield();
    this.scene.sfx?.play('throw');

    const grenade = new Grenade(
      this.scene, origin.x, origin.y, config, this.groundLayer, this.worldHeight, this.player,
      { targets: this.typing.targets, rangePx: config.flight === 'straight' ? this.throwRange() : Infinity }
    );
    grenade.body.setVelocity(vx, vy);
    this.collisions.addGrenade(grenade);
    grenade.on('explode', (x, y) => this.explode(x, y, config));
    grenade.on('ignite', (x, y) => this.spawnFire(x, y, config, 'player'));
    grenade.on('strike', (enemy) => this.axeHit(enemy, config, grenade));
    grenade.on('pop', (x, y) => this.tactical(x, y, config));

    this.grenades.push(grenade);
    this.throwableCount -= 1;
    this.thrown += 1;

    // Stickies: only a few of yours on the map at once (the oldest fizzles).
    if (config.kind === 'sticky') {
      this.stickies = this.stickies.filter((g) => g.active && !g.done);
      this.stickies.push(grenade);
      while (this.stickies.length > config.maxActive) this.stickies.shift().remove();
    }
  }

  // Combat Axe: a heavy hit and a shove, no blast. The axe stays stuck in
  // them for a while and the wound bleeds (blood loss, no pin).
  axeHit(enemy, config, axe) {
    this.scene.sfx?.play('axeHit', enemy);
    const dir = Math.sign(axe.body.velocity.x) || this.player.facing;
    this.addDamage(enemy, config.damage, DAMAGE_COLOR, 'melee');
    if (enemy.applyKnockback) enemy.applyKnockback(dir * config.knockback, -config.knockback * 0.4);
    this.status.apply(enemy, 'bleeding', 'player', null, { dir });
  }

  // Molotov: a patch of fire on the ground below where it broke (nothing if
  // it broke over the void). It burns everyone standing in it, you too.
  // source: 'player' or 'bot' (attacker: the bot that threw it).
  spawnFire(x, y, config, source, attacker = null) {
    this.scene.sfx?.play('molotov', { x, y });
    const below = groundBelow(this.groundLayer, x, y - 8);
    if (below === null || below > 220) return;
    const surfaceY = Math.floor((y - 8 + below) / 32) * 32; // top of that tile row

    const victims = () => [...this.typing.targets, this.player];
    const burn = (v) => {
      if (source === 'bot' && attacker) v.lastAttacker = attacker;
      this.status.apply(v, 'burning', source);
    };
    this.fires.push(new FirePatch(this.scene, x, surfaceY, config.fire, victims, burn));
  }

  // Shared blast for every explosive throwable.
  // Full damage up close, falling to 0 at the edge. Walls block it.
  explode(x, y, config) {
    this.scene.sfx?.play(this.scene.hazards?.blastSound(x, y) ?? 'explosion', { x, y }); // muffled under water
    const style = config.kind === 'sticky' ? 'sticky' : config.kind === 'frag' ? 'frag' : 'rocket';
    this.scene.blastFx?.explosion(x, y, config.blastRadius, style);
    this.chainReaction(x, y, config.blastRadius);
    for (const target of this.typing.targets) {
      this.applyBlast(x, y, config, target, 1);
    }

    // Your own throwable can hurt you (selfDamage: 0 = safe, 1 = full).
    if (config.selfDamage > 0) {
      this.applyBlast(x, y, config, this.player, config.selfDamage, 'self');
    }
  }

  putDownShield() {
    const p = this.player;
    if (!p.shield) return;
    const hp = Math.max(1, Math.round(p.shield.hp));
    p.dropShield();
    this.scene.airdrops?.dropItems(p.x, p.y - 10, [{ type: 'shield', key: 'riotShield', hp }]);
    this.floatText(p, 'shield down', EMPTY_COLOR);
  }

  // Shocked by an EMP: no switching. Says so and returns true.
  shockedNote() {
    if (!this.player.hasStatus('shocked')) return false;
    this.floatText(this.player, 'shocked: can\'t switch', '#4cc9f0');
    return true;
  }

  // ---- Tacticals ----

  // A tactical went off. Smoke and gas leave a cloud (no bang); the others
  // reach everyone in radiusPx with a clear line to the bang (enemies and you).
  tactical(x, y, config) {
    this.scene.sfx?.play(TACTICAL_SOUNDS[config.effect], { x, y });
    if (config.cloud) {
      const cloud = new Cloud(this.scene, x, y - 20, config.effect, config.cloud, this.player, this.player);
      cloud.config = { ...config.cloud };
      cloud.throwable = config;
      cloud.nextTickAt = this.scene.time.now + (config.tickMs ?? 0);
      this.clouds.push(cloud);
      return;
    }
    this.tacticalFx(x, y, config);
    if (config.effect === 'emp') this.chainReaction(x, y, config.radiusPx);

    const victims = [...this.typing.targets, this.player].filter((v) => {
      if (!v.alive) return false;
      const d = Phaser.Math.Distance.Between(x, y, v.x, v.y);
      if (d > config.radiusPx) return false;
      // Light and frost need a clear line; a shockwave and an EMP pass walls.
      const needsSight = config.effect === 'flash' || config.effect === 'cryo';
      return !needsSight || hasLineOfSight(this.groundLayer, x, y - 4, v.x, v.y);
    });

    for (const v of victims) {
      const you = v === this.player;
      const dist = Phaser.Math.Distance.Between(x, y, v.x, v.y);
      switch (config.effect) {
        case 'flash': {
          // Closer = longer. Looking away from the bang cuts it a lot.
          const k = Math.min(1, dist / config.radiusPx);
          let ms = config.maxMs - (config.maxMs - config.minMs) * k;
          const facingIt = Math.sign(x - v.x) === v.facing || Math.abs(x - v.x) < 20;
          const intensity = (1 - k * 0.5) * (facingIt ? 1 : config.lookAwayScale);
          if (!facingIt) ms *= config.lookAwayScale;
          this.status.apply(v, 'blinded', 'player', Math.round(ms));
          if (you) this.flashBlind(Math.round(ms), intensity, { x, y });
          break;
        }
        case 'concussion':
          this.applyBlast(x, y, config, v, you ? config.selfDamage : 1, you ? 'self' : undefined);
          this.status.apply(v, 'dazed', 'player', config.statusMs);
          break;
        case 'emp':
          this.status.apply(v, 'shocked', 'player', config.statusMs);
          if (v.config?.family === 'machines') {
            this.addDamage(v, config.machineDamage, DAMAGE_COLOR);
          }
          break;
        case 'cryo':
          this.status.apply(v, 'frozen', 'player', config.statusMs);
          break;
      }
    }
    // Cryo freezes water (and crusts lava) it reaches; EMP shocks the water.
    this.scene.hazards?.onTactical(x, y, config);
  }

  // The bang itself: a ring in the tactical's colour.
  tacticalFx(x, y, config) {
    this.scene.blastFx?.tactical(x, y, config.effect, config.radiusPx);
  }

  // (old ring look, unused)
  tacticalRing(x, y, config) {
    const color = config.effect === 'flash' ? 0xffffff : config.color;
    const ring = this.scene.add
      .circle(x, y, config.radiusPx, color, config.effect === 'flash' ? 0.6 : 0.25)
      .setStrokeStyle(3, color, 0.9)
      .setDepth(42)
      .setScale(0.15);
    this.scene.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: config.effect === 'flash' ? 220 : 400,
      onComplete: () => ring.destroy(),
    });
    if (config.effect === 'emp') {
      // a few lightning strokes
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Phaser.Math.Between(40, config.radiusPx);
        const bolt = this.scene.add
          .line(0, 0, x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, 0x4cc9f0)
          .setOrigin(0, 0)
          .setLineWidth(2)
          .setDepth(43);
        this.scene.time.delayedCall(140, () => bolt.destroy());
      }
    }
    if (config.effect !== 'smoke') this.scene.cameras.main.shake(120, 0.004);
  }

  // Flashbang on you, done like real flash blindness:
  //   1. a white glare around the bang (bright in the middle, fading out)
  //   2. an afterimage: the picture you saw at the bang stays burned in,
  //      ghosting over the live view and fading slowly
  //   3. blurry, over-bright vision that clears last
  //   4. a small camera jolt
  // intensity 0..1: up close and looking at it = 1, looking away = weak.
  flashBlind(ms, intensity = 1, bang = this.player) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const renderer = scene.game.renderer;
    this.clearFlash();
    const fx = (this.flashFx = { objects: [], tweens: [] });
    cam.shake(200, 0.006 * intensity);

    // 1. Glare: a white glow centred on the bang (not the whole screen),
    // brightest at its middle and fading out to its edge. Starts once the
    // afterimage frame is grabbed (next frame), so it isn't in the picture.
    const startWhite = () => {
      if (this.flashFx !== fx || fx.started) return;
      fx.started = true;
      startBlur();
      const glow = scene.add
        .image(bang.x, bang.y, this.glowTexture())
        .setDepth(5000)
        .setScale((FLASH_GLOW.radiusPx * (0.6 + 0.4 * intensity)) / 128)
        .setAlpha(FLASH_GLOW.alpha * intensity)
        .setBlendMode(Phaser.BlendModes.ADD);
      fx.objects.push(glow);
      fx.tweens.push(
        scene.tweens.add({
          targets: glow,
          alpha: 0,
          scale: glow.scale * 1.3,
          delay: ms * 0.08,
          duration: ms * 0.7,
          ease: 'Cubic.easeOut',
          onComplete: () => glow.destroy(),
        })
      );
    };

    // 2. Afterimage: grab the frame as it is (before the white burst covers it).
    if (renderer.snapshot) {
      renderer.snapshot((image) => {
        startWhite();
        if (this.flashFx !== fx || !(image instanceof HTMLImageElement)) return;
        const key = `flash-snap-${scene.time.now | 0}`;
        scene.textures.addImage(key, image);
        fx.keys = [key];
        const ghost = scene.add
          .image(0, 0, key)
          .setOrigin(0, 0)
          .setDisplaySize(cam.width, cam.height)
          .setScrollFactor(0)
          .setDepth(4999)
          .setAlpha(FLASH_GLOW.afterimage * intensity)
          .setTint(0xfff6d5);
        fx.objects.push(ghost);
        fx.tweens.push(
          scene.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: ms * 0.9,
            ease: 'Sine.easeIn', // lingers, then goes
            onComplete: () => ghost.destroy(),
          })
        );
      });
    }

    // 3. Blur + brightness (WebGL only), clearing last. Starts with the
    // white burst so the afterimage stays a sharp picture.
    const startBlur = () => {
      if (this.flashFx !== fx || !cam.postFX || renderer.type !== Phaser.WEBGL) return;
      const blur = cam.postFX.addBlur(1, 2, 2, 2 * intensity);
      const glow = cam.postFX.addColorMatrix();
      glow.brightness(1 + 0.3 * intensity);
      fx.blur = blur;
      fx.glow = glow;
      const state = { k: 1 };
      fx.tweens.push(
        scene.tweens.add({
          targets: state,
          k: 0,
          duration: ms,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            blur.strength = 2 * intensity * state.k;
            glow.brightness(1 + 0.3 * intensity * state.k);
          },
          onComplete: () => this.clearFlash(),
        })
      );
    };

    if (!renderer.snapshot) startWhite(); // no afterimage possible: straight to the burst
  }

  // Soft round white glow (made once): solid in the middle, fading to clear.
  glowTexture() {
    const key = 'flash-glow';
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, 256, 256);
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,240,0.75)');
      grad.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      tex.refresh();
    }
    return key;
  }

  // End any flash effect still showing (new flash, or death/respawn).
  clearFlash() {
    const fx = this.flashFx;
    if (!fx) return;
    this.flashFx = null;
    fx.tweens.forEach((t) => t.remove());
    fx.objects.forEach((o) => o.active && o.destroy());
    const cam = this.scene.cameras.main;
    if (fx.blur) cam.postFX.remove(fx.blur);
    if (fx.glow) cam.postFX.remove(fx.glow);
    (fx.keys ?? []).forEach((k) => this.scene.textures.exists(k) && this.scene.textures.remove(k));
    this.whiteRect = null;
  }

  // Is the line between two points (or either end) in smoke? viewer: who's
  // looking. Your own smoke never blocks you (you see through it, thinly),
  // and neither does a teammate's (team modes later: same `team` value).
  // So in smoke only the thrower's side sees words on the enemies inside;
  // enemies can't see the thrower, or the words over the thrower's head.
  smokeBlocks(x1, y1, x2, y2, viewer = null) {
    return this.clouds.some(
      (c) =>
        c.active &&
        c.kind === 'smoke' &&
        !this.seesThrough(viewer, c.owner) &&
        c.blocksLine(x1, y1, x2, y2)
    );
  }

  seesThrough(viewer, owner) {
    if (!viewer) return false;
    return viewer === owner || (viewer.team != null && viewer.team === owner?.team);
  }

  // Gas: every tickMs, everyone breathing inside a gas cloud takes damage
  // (armor doesn't help; machines and cyborgs are immune). Your gas kills
  // enemies for you, and you too if you stay in it.
  updateGas(now) {
    for (const cloud of this.clouds) {
      if (!cloud.active || cloud.kind !== 'gas' || now < cloud.nextTickAt) continue;
      const t = cloud.throwable;
      cloud.nextTickAt = now + t.tickMs;
      const amount = Math.max(1, Math.round((t.dps * t.tickMs) / 1000));
      for (const v of [...this.typing.targets, this.player]) {
        if (!v.alive || !cloud.covers(v.x, v.y) || !this.breathes(v, t)) continue;
        this.status.apply(v, 'gassed', 'player');
        if (v === this.player) v.takeDamage(amount, 'self', 'gas');
        else this.addDamage(v, amount, GAS_COLOR, 'gas');
      }
    }
  }

  // Seen through clouds (CLOUD_VISION): in smoke, only the thrower's ENEMIES
  // show as a see-through night-vision silhouette (the thrower and teammates
  // are left alone: it's their smoke). In gas, anyone choking shows as a hot
  // orange silhouette, bleeds, and you gasp for air. Normal once they're out.
  updateCloudTints(now) {
    const gasTint = CLOUD_TINTS.gas;
    for (const v of [...this.typing.targets, this.player]) {
      if (!v.setEnvTint) continue;
      const heat = this.scene.blastFx;
      if (!v.alive) {
        heat?.setHeat(v, null);
        continue;
      }
      const gas = this.gasAt(v.x, v.y);
      const inEnemySmoke = this.clouds.some(
        (c) => c.active && c.kind === 'smoke' && c.covers(v.x, v.y) && !this.seesThrough(v, c.owner)
      );
      if (gas && this.breathes(v, gas.throwable)) {
        // Choking: heat vision (gas colors), bleeding, and you gasp for air.
        heat?.setHeat(v, 'gas');
        if (now >= (v.nextBleedAt ?? 0)) {
          v.nextBleedAt = now + gasTint.bleedEveryMs;
          this.scene.effects?.bleed(v);
        }
        if (v === this.player) this.scene.sfx?.hold('youGas', 'gasBreath');
      } else if (inEnemySmoke) {
        heat?.setHeat(v, 'smoke');
      } else {
        heat?.setHeat(v, null);
      }
    }
  }

  breathes(v, gas) {
    if (v === this.player) return true;
    const c = v.config ?? {};
    const material = c.material ?? FAMILY_MATERIAL[c.family] ?? 'flesh';
    return !gas.immuneMaterials.includes(material);
  }

  // The gas cloud a point is in (for bots running out of it), or null.
  gasAt(x, y) {
    return this.clouds.find((c) => c.active && c.kind === 'gas' && c.covers(x, y)) ?? null;
  }

  // Any blast (yours, a bot's, an EMP) sets off stickies caught in it.
  chainReaction(x, y, radius) {
    this.stickies = this.stickies.filter((g) => g.active && !g.done);
    for (const g of this.stickies) {
      if (Phaser.Math.Distance.Between(x, y, g.x, g.y) <= radius) g.setOff();
    }
  }

  applyBlast(x, y, config, victim, multiplier, cause) {
    if (!victim.alive) return;

    const dist = Phaser.Math.Distance.Between(x, y, victim.x, victim.y);
    if (dist > config.blastRadius) return;
    // Behind a wall it still reaches you, weaker (blasts go round corners).
    const wall = hasLineOfSight(this.groundLayer, x, y - 4, victim.x, victim.y)
      ? 1
      : config.wallFactor ?? BLAST_THROUGH_WALL;

    // Water: a blast under water rocks everyone in it and barely reaches
    // anyone outside; one in the air barely reaches anyone under water.
    const water = this.scene.hazards?.blastFactor(x, y, victim) ?? 1;
    const damage = Math.round(this.blastDamage(dist, config) * multiplier * wall * water);
    if (damage <= 0) return;

    // Explosions knock a Riot Shield out of your hands.
    if (victim.shield) {
      victim.dropShield();
      this.floatText(victim, 'shield knocked off', EMPTY_COLOR);
    }

    victim.takeDamage(damage, cause, 'blast');
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

    // Low gravity: the same push sends you further, so it's softened.
    const soft = 0.5 + 0.5 * fallScale(this.scene);
    victim.applyKnockback(
      dx * config.knockback * strength * soft,
      (dy * config.knockback - config.knockbackLift) * strength * soft
    );
  }

  blastDamage(dist, config) {
    const { damage, directHitRadius, blastRadius } = config;
    if (dist <= directHitRadius) return damage;

    const t = (dist - directHitRadius) / (blastRadius - directHitRadius);
    return damage * (1 - t);
  }

  updateAim(delta) {
    if (this.mouseAim) {
      this.aimAtCursor();
      this.drawPreview();
      return;
    }
    const dt = delta / 1000;
    const { up, down } = this.player.cursors;

    // Up/Down tilt the aim (Left/Right move the player, handled in Player).
    if (up.isDown) this.aimAngle -= AIM.turnSpeed * dt;
    if (down.isDown) this.aimAngle += AIM.turnSpeed * dt;
    this.aimAngle = Phaser.Math.Clamp(this.aimAngle, AIM.minAngle, AIM.maxAngle);

    this.drawPreview();
  }

  // Cursor aiming: you face the cursor and the throw goes to it.
  //   straight (sticky, axe): flies flat toward the cursor, as far as the
  //     cursor is (within its min/max range)
  //   arc (frag, molotov, tacticals): lobbed a bit higher than the cursor
  //     so it comes down on it (as far as the throw's strength allows)
  aimAtCursor() {
    const p = this.player;
    const cam = this.scene.cameras.main;
    const cursor = this.scene.input.activePointer.positionToCamera(cam);
    p.facing = cursor.x < p.x ? -1 : 1;

    const o = this.throwOrigin();
    const t = this.throwable;
    const dx = Math.max(1, Math.abs(cursor.x - o.x));
    const dy = cursor.y - o.y; // + is down
    const lineDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx));

    if (t.flight === 'straight') {
      this.aimAngle = Phaser.Math.Clamp(lineDeg, -85, 85);
      const dist = Math.hypot(dx, dy);
      this.mouseCharge = Phaser.Math.Clamp((dist - t.minRangePx) / (t.maxRangePx - t.minRangePx), 0, 1);
      return;
    }

    // Speed that lands it on the cursor at this angle (projectile motion).
    const g = this.scene.physics.world.gravity.y;
    const theta = Phaser.Math.DegToRad(Phaser.Math.Clamp(lineDeg - AIM.mouseLobDeg, AIM.minAngle, 70));
    const cos = Math.cos(theta);
    const denom = 2 * cos * cos * (dy - dx * Math.tan(theta));
    const fs = fallScale(this.scene);
    const speed = denom > 0 ? Math.sqrt((g * dx * dx) / denom) : t.maxSpeed * fs;
    this.aimAngle = Phaser.Math.RadToDeg(theta);
    this.mouseCharge = Phaser.Math.Clamp((speed - t.minSpeed * fs) / ((t.maxSpeed - t.minSpeed) * fs), 0, 1);
  }

  // Dotted path showing where it will fly: an arc for lobbed throwables,
  // a straight line (as far as it flies flat) for sticky and axe.
  drawPreview() {
    const { vx, vy } = this.throwVelocity();
    const o = this.throwOrigin();
    const gravity = this.scene.physics.world.gravity.y;

    this.preview.clear();
    this.preview.fillStyle(0xffffff, 0.8);

    if (this.throwable.flight === 'straight') {
      const range = this.throwRange();
      const speed = Math.hypot(vx, vy);
      const dots = 12;
      for (let i = 1; i <= dots; i++) {
        const d = (range * i) / dots;
        this.preview.fillCircle(o.x + (vx / speed) * d, o.y + (vy / speed) * d, 3.5 - i * 0.15);
      }
      return;
    }

    for (let i = 1; i <= PREVIEW_DOTS; i++) {
      const t = i * PREVIEW_STEP;
      const x = o.x + vx * t;
      const y = o.y + vy * t + 0.5 * gravity * t * t;
      this.preview.fillCircle(x, y, 3.5 - i * 0.15);
    }
  }

  // ---- Frame update ----

  // The weapon in your hand, shown at your side (the throwable while you aim).
  updateHeldIcon() {
    const p = this.player;
    this.heldIcon ??= this.scene.add.image(p.x, p.y, '__DEFAULT').setScale(0.5).setDepth(1);
    const weapon = this.current;
    const show = p.alive && !p.rig && (this.aiming ? Boolean(this.throwable) : Boolean(weapon)); // a rig holds its own
    this.heldIcon.setVisible(show);
    if (!show) return;
    const key = this.aiming ? iconKey({ type: 'throwable', key: this.throwable.key }) : iconKey({ type: 'gun', key: weapon.key });
    if (this.heldIcon.texture.key !== key) this.heldIcon.setTexture(key);
    this.heldIcon.setPosition(p.x + p.facing * 14, p.y + 4).setFlipX(p.facing < 0).setAlpha(p.alpha); // see-through with you when hidden
  }

  update(delta) {
    this.updateHeldIcon();
    if (this.aiming) this.updateAim(delta);

    this.grenades = this.grenades.filter((g) => g.active);
    for (const grenade of this.grenades) grenade.update();

    this.projectiles = this.projectiles.filter((r) => r.active);
    for (const round of this.projectiles) round.update(delta);

    this.bullets = this.bullets.filter((b) => b.active);
    for (const bullet of this.bullets) bullet.update(delta);

    this.saws = this.saws.filter((s) => s.active);
    for (const saw of this.saws) saw.update(delta);
    // Saw Gun: a whining blade, a rough grind once it bites (metal screams).
    for (const saw of this.saws) {
      const sfx = this.scene.sfx;
      if (!sfx || !saw.active) continue;
      const metal = saw.stuckIn && sfx.materialOf(saw.stuckIn) === 'machine';
      sfx.hold(sfx.idFor(saw, 'saw'), saw.stuckIn ? (metal ? 'sawGrindMetal' : 'sawGrind') : 'sawWhine', saw);
    }

    this.fires = this.fires.filter((f) => f.active);
    for (const fire of this.fires) fire.update();

    this.clouds = this.clouds.filter((c) => c.active);
    for (const cloud of this.clouds) {
      cloud.update();
      // Air hissing out of the canister until the cloud is gone.
      const sfx = this.scene.sfx;
      if (sfx && cloud.active) sfx.hold(sfx.idFor(cloud, 'cloud'), 'cloudHiss', cloud, Math.max(0.15, cloud.strength));
    }
    this.updateGas(this.scene.time.now);
    this.updateCloudTints(this.scene.time.now);

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
    this.scene.sfx?.play('reload');
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