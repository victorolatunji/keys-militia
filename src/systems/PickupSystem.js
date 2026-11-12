import Phaser from 'phaser';
import PickupPanel from '../ui/PickupPanel.js';
import { AIRDROPS } from '../data/airdrops.js';
import { WEAPONS, THROWABLES, WEAPON_CATEGORIES } from '../data/weapons.js';
import { ITEMS } from '../data/items.js';
import { GUN_SLOTS, MELEE_SLOT } from './WeaponSystem.js';
import { iconKey } from '../ui/Icons.js';
import { itemArtKey, dropKey } from '../ui/ItemArt.js';
import { gunKey, throwKey } from '../entities/CharacterRig.js';

const SLOT_KEYS = { 1: 0, 2: 1 }; // number key -> gun slot index
const AUTO_PICKUP_PX = 44;        // walk this close: health, Jet Boost, more of your throwable
const ITEM_KEY = '3';             // throwables, Jet Boost, Riot Shield, Health Pack, Armor Vest

// Get near a landed crate or a loose item: it gets a yellow outline and a
// panel at the bottom of the screen shows what's inside (icon and name).
// Crates: a choice of guns, one per family. Keys 1-6 take that gun (into an
// empty gun slot, else the gun in your hand; your old gun drops beside the
// crate). 2 picks, then the crate is empty.
// Loose guns: 1 / 2 swap that gun slot (your old gun is left in its place,
// with its ammo). Holding the same gun: its number refills your ammo.
// Throwables, Jet Boost and Riot Shield: key 3.
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

  // Closest settled crate within reach, else the closest loose item, or null.
  // (Crates come first, so the old guns you drop beside one don't hide it.)
  findTarget() {
    if (!this.player.alive) return null;

    let best = null;
    let bestDist = AIRDROPS.pickupRadius;
    let bestIsCrate = false;
    for (const source of this.airdrops.pickupables) {
      if (!source.active || !source.settled) continue;
      const isCrate = source.item.type === 'crate';
      if (bestIsCrate && !isCrate) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, source.x, source.y);
      if (d <= AIRDROPS.pickupRadius && ((isCrate && !bestIsCrate) || d <= bestDist)) {
        best = source;
        bestDist = d;
        bestIsCrate = isCrate;
      }
    }
    return best;
  }

  update() {
    this.autoPickup();
    const target = this.findTarget();

    // Outline what the panel is about (and restore the old outline after).
    if (target !== this.target) {
      if (this.target?.active) {
        if (this.target.setHighlight) this.target.setHighlight(false);
        else this.target.setStrokeStyle(2, this.targetStroke);
      }
      if (target) {
        this.targetStroke = target.strokeColor;
        if (target.setHighlight) target.setHighlight(true, AIRDROPS.crate.highlightColor);
        else target.setStrokeStyle(2, AIRDROPS.crate.highlightColor);
      }
      this.target = target;
    }

    if (!target) {
      this.panel.hide();
      return;
    }

    const { title, options } = this.describe(target.item);
    const art = target.item.type === 'crate' ? dropKey('crate-landed') : itemArtKey(this.scene, target.item);
    this.panel.show(title, options, art && this.scene.textures.exists(art) ? art : iconKey(target.item));
  }

  // Walk over these and they're yours, no key needed (AUTO_PICKUP_PX):
  //   Health Pack (only if you're hurt), Jet Boost, Armor Vest (unless yours
  //   is full), and more of a throwable
  //   you already carry (until that slot is full; the rest stays on the ground).
  autoPickup() {
    if (!this.player.alive) return;
    for (const source of this.airdrops.pickupables) {
      if (!source.active || !source.settled) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, source.x, source.y);
      if (d > AUTO_PICKUP_PX) continue;
      const item = source.item;
      if (item.type === 'health' && this.player.hp < this.player.stats.maxHp) {
        const healed = this.player.heal(ITEMS.healthPack.heal);
        source.remove();
        this.picked(`${healed} HP`, 'heal');
      } else if (item.type === 'boost') {
        this.weapons.pickBoost();
        source.remove();
        this.picked(ITEMS.jetBoost.name);
      } else if (item.type === 'armor' && !(this.player.armor && this.player.armor.points >= ITEMS.armorVest.points)) {
        this.player.equipArmor(ITEMS.armorVest);
        source.remove();
        this.picked(ITEMS.armorVest.name, 'armor');
      } else if (item.type === 'throwable') {
        const slot = this.weapons.throwSlots.find((t) => t.config?.key === item.key);
        if (slot && slot.count < slot.config.maxCarry) this.takeThrowable(source);
      }
    }
  }

  // What the panel says for this item, given your current loadout.
  describe(item) {
    const w = this.weapons;

    if (item.type === 'crate') {
      const slot = this.crateSlot(item);
      const replacing = w.slots[slot] ? `next pick replaces ${w.slots[slot].name}` : 'next pick fills an empty slot';
      const title = `SUPPLY CRATE · take ${item.picksLeft} more\n${replacing}`;
      const options = [];
      item.options.forEach((key, i) => {
        if (!key) return;
        const gun = WEAPONS[key];
        const held = w.slotOf(key) !== -1;
        options.push({
          key: String(i + 1),
          label: `${gun.name} (${WEAPON_CATEGORIES[gun.category].name})${held ? ' · refill' : ''}`,
          enabled: true,
          art: gunKey(key),
        });
      });
      return { title, options };
    }

    if (item.type === 'boost') {
      return { title: ITEMS.jetBoost.name.toUpperCase(), options: [{ key: ITEM_KEY, label: 'use (fuel stays full)', enabled: true }] };
    }

    if (item.type === 'health') {
      const full = this.player.hp >= this.player.stats.maxHp;
      const cfg = ITEMS.healthPack;
      return { title: cfg.name.toUpperCase(), options: [{ key: ITEM_KEY, label: full ? 'HP full' : `heal +${cfg.heal} HP`, enabled: !full }] };
    }

    if (item.type === 'armor') {
      const cfg = ITEMS.armorVest;
      const worn = this.player.armor;
      const full = worn && worn.points >= cfg.points;
      const label = full ? 'vest full' : worn ? `replace your vest (${Math.ceil(worn.points)}/${cfg.points})` : 'wear (stops most bullet damage)';
      return { title: cfg.name.toUpperCase(), options: [{ key: ITEM_KEY, label, enabled: !full }] };
    }

    if (item.type === 'shield') {
      const has = Boolean(this.player.shield);
      const max = ITEMS.riotShield.hp;
      const worn = item.hp && item.hp < max ? ` ${item.hp}/${max}` : '';
      return {
        title: `${ITEMS.riotShield.name.toUpperCase()}${worn}`,
        options: [{ key: ITEM_KEY, label: has ? 'replace your shield' : 'equip (pistol, SMG or melee only)', enabled: true }],
      };
    }

    if (item.type === 'gun') {
      const config = WEAPONS[item.key];
      const title = `${config.name.toUpperCase()} (${this.ammoOf(item)} shots)`;

      // Already holding this gun: its slot number refills your ammo.
      const heldSlot = w.slotOf(item.key);
      if (heldSlot !== -1) {
        const have = w.ammo[heldSlot];
        const full = have >= config.ammo;
        const label = full ? 'ammo full' : `refill ammo (${have}/${config.ammo})`;
        return { title, options: [{ key: String(heldSlot + 1), label, enabled: !full, art: gunKey(item.key) }] };
      }

      const options = GUN_SLOTS.map((slot) => {
        const gun = w.slots[slot];
        return {
          key: String(slot + 1),
          label: gun ? `swap for ${gun.name} (${w.ammo[slot]})` : 'take (empty slot)',
          enabled: true,
          art: gun ? gunKey(gun.key) : null, // the gun you'd give up
        };
      });
      return { title, options };
    }

    // Throwable: two slots. Same kind: top up. A free slot: goes there.
    // Both slots taken by other kinds: swaps with the one in your hand.
    const config = THROWABLES[item.key];
    const title = `${config.name.toUpperCase()} x${item.count}`;
    const same = w.throwSlots.find((t) => t.config?.key === item.key);
    const free = w.throwSlots.some((t) => !t.config);
    let label;
    let enabled = true;
    let art = throwKey(item.key);
    if (same) {
      enabled = same.count < config.maxCarry;
      label = enabled ? `take (you have ${same.count}/${config.maxCarry})` : `full (${same.count}/${config.maxCarry})`;
    } else if (free) {
      label = 'take (empty throwable slot)';
    } else {
      const held = w.throwSlots[w.throwActive];
      label = `swap for ${held.config.name} x${held.count}`;
      art = throwKey(held.config.key);
    }

    return { title, options: [{ key: ITEM_KEY, label, enabled, art }] };
  }

  handleKey(event) {
    if (event.repeat || !this.target) return;
    const crate = this.target;
    const item = crate.item;

    if (item.type === 'crate') {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < item.options.length) this.pickFromCrate(crate, index);
    } else if (item.type === 'boost' && event.key === ITEM_KEY) {
      this.weapons.pickBoost();
      crate.remove();
      this.picked(ITEMS.jetBoost.name);
    } else if (item.type === 'health' && event.key === ITEM_KEY) {
      if (this.player.hp >= this.player.stats.maxHp) return;
      const healed = this.player.heal(ITEMS.healthPack.heal);
      crate.remove();
      this.picked(`${healed} HP`, 'heal');
    } else if (item.type === 'armor' && event.key === ITEM_KEY) {
      const worn = this.player.armor;
      if (worn && worn.points >= ITEMS.armorVest.points) return;
      this.player.equipArmor(ITEMS.armorVest);
      crate.remove();
      this.picked(ITEMS.armorVest.name, 'armor');
    } else if (item.type === 'shield' && event.key === ITEM_KEY) {
      this.weapons.pickShield(crate.item.hp);
      crate.remove();
      this.picked(ITEMS.riotShield.name);
    } else if (item.type === 'gun' && event.key in SLOT_KEYS) {
      const slot = SLOT_KEYS[event.key];
      const heldSlot = this.weapons.slotOf(item.key);

      if (heldSlot === -1) this.takeGun(crate, slot);
      else if (slot === heldSlot) this.refillAmmo(crate, slot);
    } else if (item.type === 'throwable' && event.key === ITEM_KEY) {
      this.takeThrowable(crate);
    }
  }

  // Which gun slot the next crate pick goes into: an empty one; else, on a
  // second pick from the same crate, the slot you didn't just fill; else the
  // gun in your hand (gun 1 if you're holding your melee weapon).
  crateSlot(item) {
    const w = this.weapons;
    const empty = GUN_SLOTS.find((i) => !w.slots[i]);
    if (empty !== undefined) return empty;
    const filled = item?.filledSlot;
    if (filled !== undefined) return GUN_SLOTS.find((i) => i !== filled) ?? GUN_SLOTS[0];
    return GUN_SLOTS.includes(w.active) ? w.active : GUN_SLOTS[0];
  }

  // Take gun `index` out of a crate. Same gun as one you hold: refill it.
  // Otherwise it goes into crateSlot(); the old gun drops beside the crate
  // with its ammo. If you can take another, your other old gun is put in
  // your hand as the suggested next swap: press another number to replace
  // it too, or walk away to keep it.
  pickFromCrate(crate, index) {
    const item = crate.item;
    const key = item.options[index];
    if (!key) return;
    const w = this.weapons;

    const held = w.slotOf(key);
    if (held !== -1) {
      w.refillGun(held, WEAPONS[key].ammo);
      this.picked(`${WEAPONS[key].name} ammo`);
    } else {
      const slot = this.crateSlot(item);
      const old = w.setGun(slot, key); // the new gun goes straight into your hand
      if (old) this.airdrops.dropItems(crate.x, crate.y - 10, [{ type: 'gun', key: old.key, ammo: old.ammo }]);
      this.picked(WEAPONS[key].name);
      item.filledSlot = slot; // a second pick replaces your other gun, not this one
    }

    item.options[index] = null;
    item.picksLeft -= 1;
    if (item.picksLeft <= 0 || !item.options.some(Boolean)) crate.remove();
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
  // sound: which pickup sound to play (default 'pickup').
  picked(label, sound = 'pickup') {
    this.pickups += 1;
    this.scene.sfx?.play(sound);

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
