import Phaser from 'phaser';
import { STATUS } from '../data/status.js';

// Status effects on any character (you or a bot). Each effect lives on the
// character as statuses[type] = { until, source, ... } and is ticked here.
//   burning: damage every tickMs until it runs out, little flames rising
//   pinned:  sets character.pinnedUntil (Player/Bot movement checks it) and
//            draws nails sticking out of the character
//   blinded, dazed, shocked, frozen: Player/Bot read them through
//            hasStatus() (movement, jetpack, sight, attacks); drawn here
// damage(target, amount, source) is given by WeaponSystem so damage
// numbers and kill credit work like any other hit.
export default class StatusSystem {
  constructor(scene, damage) {
    this.scene = scene;
    this.damage = damage;
    this.affected = new Set();
  }

  // Start (or refresh) an effect. source: 'player' or 'bot'.
  // durationMs: optional, overrides the default (a flashbang up close lasts longer).
  apply(target, type, source = 'player', durationMs = null) {
    if (!target.alive) return;
    const config = STATUS[type];
    const now = this.scene.time.now;
    target.statuses ??= {};
    const fresh = !target.statuses[type] || target.statuses[type].until <= now;

    const old = target.statuses[type];
    const until = now + (durationMs ?? config.durationMs);
    target.statuses[type] = {
      until: fresh ? until : Math.max(until, old.until),
      overlay: old?.overlay ?? null,
      source,
      nextTickAt: old?.nextTickAt ?? now + (config.tickMs ?? 0),
      nextFxAt: 0,
      nails: old?.nails ?? null,
      nextPainAt: old?.nextPainAt ?? 0,
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
          if (s.overlay) s.overlay.destroy();
          if (type === 'pinned') target.pinnedUntil = 0;
          delete statuses[type];
          continue;
        }
        if (type === 'burning') this.burn(target, s, now);
        else if (type === 'dazed') this.every(s, now, 160, () => this.star(target));
        else if (type === 'shocked') this.every(s, now, 90, () => this.spark(target));
        else if (type === 'blinded') this.every(s, now, 200, () => this.glare(target));
        else if (type === 'gassed') this.every(s, now, 180, () => this.cough(target));
        else if (type === 'frozen') this.ice(target, s);
        if (s.nails) {
          for (const n of s.nails) n.img.setPosition(target.x + n.dx, target.y + n.dy);
        }
      }
      if (Object.keys(statuses).length === 0) this.affected.delete(target);
    }
  }

  burn(target, s, now) {
    const config = STATUS.burning;
    // Crying out in pain every so often while on fire (you: crackling too).
    if (now >= (s.nextPainAt ?? 0)) {
      s.nextPainAt = now + (target === this.scene.player ? 1400 : 2200);
      this.scene.sfx?.burnPain(target);
    }
    if (target === this.scene.player) this.scene.sfx?.hold('youBurning', 'burning');
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

  every(s, now, ms, fn) {
    if (now < s.nextFxAt) return;
    s.nextFxAt = now + ms;
    fn();
  }

  // Dazed: little stars circling over the head.
  star(target) {
    const top = target.y - target.height / 2 - 6;
    const st = this.scene.add.star(target.x - 12, top, 5, 2, 4, STATUS.dazed.fxColor).setDepth(44);
    this.scene.tweens.add({
      targets: st,
      x: target.x + 12,
      angle: 180,
      alpha: 0,
      duration: 500,
      onUpdate: () => (st.y = target.y - target.height / 2 - 6),
      onComplete: () => st.destroy(),
    });
  }

  // Shocked: blue sparks crackling on the body.
  spark(target) {
    const x = target.x + Phaser.Math.Between(-target.width / 2, target.width / 2);
    const y = target.y + Phaser.Math.Between(-target.height / 2, target.height / 2);
    const sp = this.scene.add
      .line(0, 0, x, y, x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-8, 8), STATUS.shocked.fxColor)
      .setOrigin(0, 0)
      .setLineWidth(2)
      .setDepth(44);
    this.scene.time.delayedCall(80, () => sp.destroy());
  }

  // Gassed: little green puffs coughed out of the face.
  cough(target) {
    const x = target.x + (target.facing ?? 1) * 8;
    const y = target.y - target.height / 2 + 12;
    const c = this.scene.add.circle(x, y, Phaser.Math.Between(2, 4), STATUS.gassed.fxColor, 0.8).setDepth(44);
    this.scene.tweens.add({
      targets: c,
      x: x + (target.facing ?? 1) * Phaser.Math.Between(6, 14),
      y: y - Phaser.Math.Between(4, 12),
      scale: 2,
      alpha: 0,
      duration: 450,
      onComplete: () => c.destroy(),
    });
  }

  // Blinded (bots): a white glare over the eyes.
  glare(target) {
    const g = this.scene.add
      .circle(target.x, target.y - target.height / 2 + 10, 7, STATUS.blinded.fxColor, 0.9)
      .setDepth(44);
    this.scene.tweens.add({ targets: g, scale: 1.8, alpha: 0, duration: 300, onComplete: () => g.destroy() });
  }

  // Frozen: a sheet of ice over the body that follows it.
  ice(target, s) {
    if (!s.overlay) {
      s.overlay = this.scene.add
        .rectangle(target.x, target.y, target.width + 4, target.height + 4, STATUS.frozen.fxColor, 0.5)
        .setStrokeStyle(2, 0xffffff, 0.8)
        .setDepth(44);
    }
    s.overlay.setPosition(target.x, target.y);
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