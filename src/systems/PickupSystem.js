import Phaser from 'phaser';
import PickupPanel from '../ui/PickupPanel.js';
import { AIRDROPS } from '../data/airdrops.js';
import { WEAPONS, THROWABLES } from '../data/weapons.js';

const SLOT_KEYS = { 1: 0, 2: 1 }; // number key -> gun slot index
const THROWABLE_KEY = '3';

// Get near a landed crate or a loose drop: it gets a yellow outline and a
// panel at the bottom of the screen shows what's inside.
// 1 / 2 swap that gun slot with the crate's gun (your old gun goes into
// the crate, so you can swap back). 3 takes the throwables.
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
      const name = WEAPONS[item.key].name.toUpperCase();
      if (w.hasGun(item.key)) {
        return { title: name, options: [{ label: 'already in your loadout', enabled: false }] };
      }

      const options = w.guns.map((gun, slot) => ({
        key: String(slot + 1),
        label: gun ? `swap for ${gun.name}` : 'take (empty slot)',
        enabled: true,
      }));
      return { title: name, options };
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
      this.takeGun(crate, SLOT_KEYS[event.key]);
    } else if (item.type === 'throwable' && event.key === THROWABLE_KEY) {
      this.takeThrowable(crate);
    }
  }

  takeGun(crate, slot) {
    if (this.weapons.hasGun(crate.item.key)) return;

    const name = WEAPONS[crate.item.key].name;
    const oldKey = this.weapons.setGun(slot, crate.item.key);

    // Your old gun goes into the crate (or drop); an empty slot leaves it empty.
    if (oldKey) crate.item = { type: 'gun', key: oldKey };
    else crate.remove();

    this.picked(name);
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