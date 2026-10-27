import Phaser from 'phaser';
import PickupPanel from '../ui/PickupPanel.js';
import { AIRDROPS } from '../data/airdrops.js';
import { WEAPONS, THROWABLES } from '../data/weapons.js';
import { GUN_SLOTS, MELEE_SLOT } from './WeaponSystem.js';

const SLOT_KEYS = { 1: 0, 2: 1 }; // number key -> gun slot index
const THROWABLE_KEY = '3';
const MELEE_KEY = '4';

// Get near a landed crate or a loose drop: it gets a yellow outline and a
// panel at the bottom of the screen shows what's inside.
// 1 / 2 swap that gun slot with the crate's gun (your old gun goes into
// the crate with its ammo, so you can swap back). If you already hold that
// gun, its number refills your ammo instead. 3 takes the throwables,
// 4 swaps your melee weapon (your old one goes into the crate).
// The game never pauses, and digits never clash with typing (letters only).
export default class PickupSystem {
  constructor(scene, player, weapons, airdrops) {
    this.scene = scene;
    this.player = player;
    this.weapons = weapons;
    this.airdrops = airdrops;

    this.target = null;      // crate or drop the panel is showing
    this.targetStroke = 0;   // its outline color before we highlighted it
    this.pickups = 0;
    this.panel = new PickupPanel(scene);

    scene.input.keyboard.on('keydown', this.handleKey, this);
    scene.events.once('shutdown', () => {
      scene.input.keyboard.off('keydown', this.handleKey, this);
    });
  }

  // Closest settled crate or drop within reach, or null.
  findTarget() {
    if (!this.player.alive) return null;

    let best = null;
    let bestDist = AIRDROPS.pickupRadius;
    for (const source of this.airdrops.pickupables) {
      if (!source.active || !source.settled) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, source.x, source.y);
      if (d <= bestDist) {
        best = source;
        bestDist = d;
      }
    }
    return best;
  }

  update() {
    const target = this.findTarget();

    // Outline what the panel is about (and restore the old outline after).
    if (target !== this.target) {
      if (this.target?.active) this.target.setStrokeStyle(2, this.targetStroke);
      if (target) {
        this.targetStroke = target.strokeColor;
        target.setStrokeStyle(2, AIRDROPS.crate.highlightColor);
      }
      this.target = target;
    }

    if (!target) {
      this.panel.hide();
      return;
    }

    const { title, options } = this.describe(target.item);
    this.panel.show(title, options);
  }

  // What the panel says for this item, given your current loadout.
  describe(item) {
    const w = this.weapons;

    if (item.type === 'gun') {
      const config = WEAPONS[item.key];
      const title = `${config.name.toUpperCase()} (${this.ammoOf(item)} shots)`;

      // Already holding this gun: its slot number refills your ammo.
      const heldSlot = w.slotOf(item.key);
      if (heldSlot !== -1) {
        const have = w.ammo[heldSlot];
        const full = have >= config.ammo;
        const label = full ? 'ammo full' : `refill ammo (${have}/${config.ammo})`;
        return { title, options: [{ key: String(heldSlot + 1), label, enabled: !full }] };
      }

      const options = GUN_SLOTS.map((slot) => {
        const gun = w.slots[slot];
        return {
          key: String(slot + 1),
          label: gun ? `swap for ${gun.name} (${w.ammo[slot]})` : 'take (empty slot)',
          enabled: true,
        };
      });
      return { title, options };
    }

    if (item.type === 'melee') {
      const config = WEAPONS[item.key];
      const title = `${config.name.toUpperCase()} (melee)`;
      const mine = w.slots[MELEE_SLOT];

      if (mine?.key === item.key) {
        return { title, options: [{ label: 'already in hand', enabled: false }] };
      }
      const label = mine ? `swap for ${mine.name}` : 'take';
      return { title, options: [{ key: MELEE_KEY, label, enabled: true }] };
    }

    // Throwable
    const config = THROWABLES[item.key];
    const title = `${config.name.toUpperCase()} x${item.count}`;
    const sameType = w.throwable.key === item.key;
    const full = sameType && w.throwableCount >= config.maxCarry;

    const label = full
      ? `full (${w.throwableCount}/${config.maxCarry})`
      : sameType
        ? `take (you have ${w.throwableCount}/${config.maxCarry})`
        : `swap for ${w.throwable.name} x${w.throwableCount}`;

    return { title, options: [{ key: THROWABLE_KEY, label, enabled: !full }] };
  }

  handleKey(event) {
    if (event.repeat || !this.target) return;
    const crate = this.target;
    const item = crate.item;

    if (item.type === 'gun' && event.key in SLOT_KEYS) {
      const slot = SLOT_KEYS[event.key];
      const heldSlot = this.weapons.slotOf(item.key);

      if (heldSlot === -1) this.takeGun(crate, slot);
      else if (slot === heldSlot) this.refillAmmo(crate, slot);
    } else if (item.type === 'throwable' && event.key === THROWABLE_KEY) {
      this.takeThrowable(crate);
    } else if (item.type === 'melee' && event.key === MELEE_KEY) {
      this.takeMelee(crate);
    }
  }

  takeMelee(crate) {
    const { key } = crate.item;
    if (this.weapons.slots[MELEE_SLOT]?.key === key) return;

    const old = this.weapons.setGun(MELEE_SLOT, key);
    if (old) crate.item = { type: 'melee', key: old.key };
    else crate.remove();

    this.picked(WEAPONS[key].name);
  }

  // Shots in a gun item. Crate guns come full; dropped guns keep what was left.
  ammoOf(item) {
    return item.ammo ?? WEAPONS[item.key].ammo;
  }

  takeGun(crate, slot) {
    const { key } = crate.item;
    const old = this.weapons.setGun(slot, key, this.ammoOf(crate.item));

    // Your old gun goes into the crate (or drop) with its ammo;
    // an empty slot leaves it empty.
    if (old) crate.item = { type: 'gun', key: old.key, ammo: old.ammo };
    else crate.remove();

    this.picked(WEAPONS[key].name);
  }

  // Same gun as one you hold: move its shots into yours.
  refillAmmo(crate, slot) {
    const { key } = crate.item;
    const available = this.ammoOf(crate.item);
    const taken = this.weapons.refillGun(slot, available);
    if (taken === 0) return;

    const left = available - taken;
    if (left > 0) crate.item = { type: 'gun', key, ammo: left };
    else crate.remove();

    this.picked(`${WEAPONS[key].name} ammo +${taken}`);
  }

  takeThrowable(crate) {
    const { key, count } = crate.item;
    const { taken, returned } = this.weapons.takeThrowable(key, count);
    if (taken === 0) return;

    const left = count - taken;
    if (returned) crate.item = { type: 'throwable', ...returned };
    else if (left > 0) crate.item = { type: 'throwable', key, count: left };
    else crate.remove();

    this.picked(`${THROWABLES[key].name} x${taken}`);
  }

  // Floating "+ Sniper" above the player.
  picked(label) {
    this.pickups += 1;

    const text = this.scene.add
      .text(this.player.x, this.player.y - 40, `+ ${label}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#06d6a0',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(60);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 900,
      onComplete: () => text.destroy(),
    });
  }
}