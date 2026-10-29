import Phaser from 'phaser';
import { STATUS } from '../data/status.js';

// Status effects on any character (you or a bot). Each effect lives on the
// character as statuses[type] = { until, source, ... } and is ticked here.
//   burning: damage every tickMs until it runs out, little flames rising
//   pinned:  sets character.pinnedUntil (Player/Bot movement checks it) and
//            draws nails sticking out of the character
// damage(target, amount, source) is given by WeaponSystem so damage
// numbers and kill credit work like any other hit.
export default class StatusSystem {
  constructor(scene, damage) {
    this.scene = scene;
    this.damage = damage;
    this.affected = new Set();
  }

  // Start (or refresh) an effect. source: 'player' or 'bot'.
  apply(target, type, source = 'player') {
    if (!target.alive) return;
    const config = STATUS[type];
    const now = this.scene.time.now;
    target.statuses ??= {};
    const fresh = !target.statuses[type] || target.statuses[type].until <= now;

    const old = target.statuses[type];
    target.statuses[type] = {
      until: now + config.durationMs,
      source,
      nextTickAt: old?.nextTickAt ?? now + (config.tickMs ?? 0),
      nextFxAt: 0,
      nails: old?.nails ?? null,
    };
    if (type === 'pinned') {
      target.pinnedUntil = now + config.durationMs;
      target.statuses.pinned.nails ??= this.makeNails(target, config);
    }
    if (fresh) this.label(target, type);
    this.affected.add(target);
  }

  has(target, type) {
    return (target.statuses?.[type]?.until ?? 0) > this.scene.time.now;
  }

  update() {
    const now = this.scene.time.now;
    for (const target of this.affected) {
      const statuses = target.statuses ?? {};
      for (const [type, s] of Object.entries(statuses)) {
        if (!target.alive || now >= s.until) {
          if (s.nails) s.nails.forEach((n) => n.img.destroy());
          if (type === 'pinned') target.pinnedUntil = 0;
          delete statuses[type];
          continue;
        }
        if (type === 'burning') this.burn(target, s, now);
        if (s.nails) {
          for (const n of s.nails) n.img.setPosition(target.x + n.dx, target.y + n.dy);
        }
      }
      if (Object.keys(statuses).length === 0) this.affected.delete(target);
    }
  }

  burn(target, s, now) {
    const config = STATUS.burning;
    if (now >= s.nextTickAt) {
      s.nextTickAt = now + config.tickMs;
      const amount = Math.max(1, Math.round((config.dps * config.tickMs) / 1000));
      this.damage(target, amount, s.source);
    }
    if (now >= s.nextFxAt) {
      s.nextFxAt = now + 70;
      this.flame(target, Math.random() < 0.7 ? config.flameColor : config.flameCoreColor);
    }
  }

  // A few grey nails stuck into the character, at random spots.
  makeNails(target, config) {
    const nails = [];
    for (let i = 0; i < config.nails; i++) {
      const dx = Phaser.Math.Between(-target.width / 2, target.width / 2);
      const dy = Phaser.Math.Between(-target.height / 2 + 4, target.height / 2 - 4);
      const img = this.scene.add
        .rectangle(target.x + dx, target.y + dy, 10, 3, config.nailColor)
        .setStrokeStyle(1, 0x000000)
        .setRotation(Phaser.Math.FloatBetween(-0.6, 0.6))
        .setDepth(44);
      nails.push({ img, dx, dy });
    }
    return nails;
  }

  // A small flame that rises off a burning character.
  flame(target, color) {
    const f = this.scene.add
      .circle(
        target.x + Phaser.Math.Between(-target.width / 2, target.width / 2),
        target.y + Phaser.Math.Between(-target.height / 3, target.height / 3),
        Phaser.Math.Between(3, 6),
        color,
        0.9
      )
      .setDepth(44);
    this.scene.tweens.add({
      targets: f,
      y: f.y - Phaser.Math.Between(14, 28),
      alpha: 0,
      scale: 0.3,
      duration: 380,
      onComplete: () => f.destroy(),
    });
  }

  // "burning" / "pinned" floats up once when it starts.
  label(target, type) {
    const text = this.scene.add
      .text(target.x, target.y - 46, type, {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: STATUS[type].textColor,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 18,
      alpha: 0,
      duration: 700,
      onComplete: () => text.destroy(),
    });
  }
}