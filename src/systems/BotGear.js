import Phaser from 'phaser';
import { WEAPONS, THROWABLES } from '../data/weapons.js';
import { BOT_RANGES, BOT_AI, WORD_LETTERS, NATURAL_WEAPONS } from '../data/enemies.js';

export const BOT_MELEE = 'melee'; // value of `active` when the melee weapon is in hand

// What a bot carries, and its weapon choices.
// Smart bots (Military) follow your rules: two gun slots with ammo, switching
// for the distance, looting, grenades. Other bots keep the gun they spawn
// with: endless ammo, a reload pause every few attacks, nothing else.
// Pure data and decisions: BotCombat does the shooting, BotBrain the moving.
export default class BotGear {
  // config: a BOTS entry (uses loadout and smart)
  constructor(config) {
    this.loadout = config.loadout;
    this.smart = config.smart ?? false;
    this.reset();
  }

  // A fresh spawn loadout: one random gun from each slot's list.
  reset() {
    this.guns = this.loadout.guns.map((options) => {
      if (!options) return null;
      const key = Array.isArray(options) ? Phaser.Utils.Array.GetRandom(options) : options;
      return { weapon: WEAPONS[key], ammo: WEAPONS[key].ammo };
    });
    this.melee = WEAPONS[this.loadout.melee] ?? NATURAL_WEAPONS[this.loadout.melee];
    this.throwable = THROWABLES[this.loadout.throwable.key];
    this.throwableCount = this.loadout.throwable.count;
    this.active = this.firstGun();
    this.switchingUntil = 0;
    this.lastSwitchAt = 0;
    this.reloadingUntil = 0;
    this.attacksSinceReload = 0;
  }

  firstGun() {
    const i = this.guns.findIndex(Boolean);
    return i === -1 ? BOT_MELEE : i;
  }

  get current() {
    return this.active === BOT_MELEE ? this.melee : this.guns[this.active]?.weapon ?? this.melee;
  }

  get hasGun() {
    return this.guns.some(Boolean);
  }

  // The distance band it tries to keep with the weapon in hand.
  get range() {
    return BOT_RANGES[this.current.category] ?? BOT_RANGES.assault;
  }

  switching(now) {
    return now < this.switchingUntil;
  }

  // Can't attack right now: switching guns or reloading.
  busy(now) {
    return now < this.switchingUntil || now < this.reloadingUntil;
  }

  // ---- Choosing a weapon ----

  // How well a weapon suits this distance: 1 inside its range, less outside.
  fit(weapon, distance) {
    const { min, max } = BOT_RANGES[weapon.category] ?? BOT_RANGES.assault;
    if (distance >= min && distance <= max) return 1;
    const off = distance < min ? min - distance : distance - max;
    return Math.max(0, 1 - off / 400);
  }

  // Switch to the gun that suits the distance best, if it's clearly better.
  // Melee only when it has no gun left.
  chooseFor(distance, now, switchMs) {
    if (!this.smart) return; // sticks with what it spawned with
    if (!this.hasGun) {
      if (this.active !== BOT_MELEE) this.switchTo(BOT_MELEE, now, switchMs);
      return;
    }
    if (now - this.lastSwitchAt < BOT_AI.switchEveryMs) return;

    let best = this.active === BOT_MELEE ? this.firstGun() : this.active;
    let bestFit = this.fit(this.guns[best].weapon, distance);
    this.guns.forEach((slot, i) => {
      if (!slot || i === best) return;
      const f = this.fit(slot.weapon, distance);
      if (f > bestFit + BOT_AI.switchMargin) {
        best = i;
        bestFit = f;
      }
    });

    if (best !== this.active) this.switchTo(best, now, switchMs);
  }

  switchTo(active, now, switchMs) {
    this.active = active;
    this.attacksSinceReload = 0;
    this.lastSwitchAt = now;
    this.switchingUntil = now + switchMs;
  }

  // One attack used. Returns the gun if that emptied it (it's thrown away),
  // or 'reload' when a reload pause starts: LMGs after their belt (like
  // yours), and non-smart bots (endless ammo) every few attacks.
  useAmmo(now, switchMs) {
    if (this.active === BOT_MELEE) return null;
    const slot = this.guns[this.active];
    const weapon = slot.weapon;

    if (this.smart) {
      slot.ammo -= 1;
      if (slot.ammo <= 0) return this.throwAway(now, switchMs);
    }

    const every = weapon.belt ?? (this.smart ? Infinity : BOT_AI.reload.every);
    this.attacksSinceReload += 1;
    if (this.attacksSinceReload < every) return null;
    this.attacksSinceReload = 0;
    this.reloadingUntil = now + (weapon.reloadMs ?? BOT_AI.reload.ms);
    return 'reload';
  }

  // Empty gun: thrown away, next gun (or melee) in hand.
  throwAway(now, switchMs) {
    const slot = this.guns[this.active];

    this.guns[this.active] = null;
    this.switchTo(this.firstGun(), now, switchMs);
    return slot.weapon;
  }

  // ---- Loot ----

  // Rough strength of a gun: damage per letter typed.
  value(weapon) {
    const letters = WORD_LETTERS[weapon.wordList] * (weapon.wordsPerShot ?? 1);
    return weapon.damage / letters;
  }

  // Would it bother walking over for this crate or drop item?
  wants(item) {
    if (!this.smart) return false; // only Military bots loot
    if (item.type === 'throwable') {
      return item.key === this.throwable.key && this.throwableCount < this.throwable.maxCarry;
    }
    if (item.type !== 'gun') return false; // melee pickups: rushers, later

    const weapon = WEAPONS[item.key];
    if (weapon.category === 'special') return false; // specials are player-only
    const same = this.guns.findIndex((s) => s?.weapon.key === item.key);
    if (same !== -1) {
      const slot = this.guns[same];
      return slot.ammo < weapon.ammo * BOT_AI.loot.lowAmmoShare; // worth a refill
    }
    if (this.guns.some((s) => !s)) return true; // free slot

    const worst = this.worstSlot();
    const g = this.guns[worst];
    return this.value(weapon) > this.value(g.weapon) || g.ammo < g.weapon.ammo * BOT_AI.loot.lowAmmoShare;
  }

  worstSlot() {
    let worst = 0;
    this.guns.forEach((s, i) => {
      const w = this.guns[worst];
      const score = (x) => this.value(x.weapon) * Math.min(1, x.ammo / x.weapon.ammo + 0.3);
      if (s && (!w || score(s) < score(w))) worst = i;
    });
    return worst;
  }

  // Take an item. Returns what goes back into the crate (or null if emptied),
  // just like your swaps: an old gun keeps its ammo.
  take(item, now, switchMs) {
    if (item.type === 'throwable') {
      const space = this.throwable.maxCarry - this.throwableCount;
      const taken = Math.min(space, item.count);
      this.throwableCount += taken;
      const left = item.count - taken;
      return left > 0 ? { ...item, count: left } : null;
    }

    const weapon = WEAPONS[item.key];
    const ammo = item.ammo ?? weapon.ammo;

    const same = this.guns.findIndex((s) => s?.weapon.key === item.key);
    if (same !== -1) {
      const slot = this.guns[same];
      const taken = Math.min(ammo, weapon.ammo - slot.ammo);
      slot.ammo += taken;
      return ammo - taken > 0 ? { ...item, ammo: ammo - taken } : null;
    }

    let slotIndex = this.guns.findIndex((s) => !s);
    if (slotIndex === -1) slotIndex = this.worstSlot();
    const old = this.guns[slotIndex];
    this.guns[slotIndex] = { weapon, ammo };
    if (this.active === BOT_MELEE || this.active === slotIndex) this.switchTo(slotIndex, now, switchMs);
    return old ? { type: 'gun', key: old.weapon.key, ammo: old.ammo } : null;
  }

  // Dropped when it dies (the melee weapon stays, like your knife).
  // Non-smart bots drop their gun half loaded.
  items() {
    if (!this.smart) {
      return this.guns
        .filter(Boolean)
        .map((s) => ({ type: 'gun', key: s.weapon.key, ammo: Math.max(1, Math.ceil(s.weapon.ammo / 2)) }));
    }
    const items = this.guns
      .filter(Boolean)
      .map((s) => ({ type: 'gun', key: s.weapon.key, ammo: s.ammo }));
    if (this.throwableCount > 0) {
      items.push({ type: 'throwable', key: this.throwable.key, count: this.throwableCount });
    }
    return items;
  }
}