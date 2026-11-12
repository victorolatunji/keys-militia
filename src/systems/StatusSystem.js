import Phaser from 'phaser';
import { STATUS } from '../data/status.js';
import { projKey, fxKey } from './ShotFx.js';
import { FIRE_LOOK } from '../data/effects.js';

// The drawn character's box (its art is taller than the physics box).
const drawn = (t) => {
  const top = t.visualTop ?? t.y - t.height / 2;
  const bottom = t.body?.bottom ?? t.y + t.height / 2;
  return { top, bottom, mid: (top + bottom) / 2, h: bottom - top, w: t.rig ? t.width * 1.25 : t.width };
};

// Status effects on any character (you or a bot). Each effect lives on the
// character as statuses[type] = { until, source, ... } and is ticked here.
//   burning: damage every tickMs until it runs out, little flames rising
//   pinned:  sets character.pinnedUntil (Player/Bot movement checks it) and
//            draws nails sticking out of the character
//   bleeding: an axe stuck in the body (follows it), blood loss ticks and
//            drips; when it runs out the axe drops out and falls away
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
  // opts.dir: bleeding only, the way the axe was flying (-1 / 1), so it
  // sticks in the side it hit.
  apply(target, type, source = 'player', durationMs = null, opts = {}) {
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
      axes: old?.axes ?? null,
      nextPainAt: old?.nextPainAt ?? 0,
      nextDripAt: 0,
    };
    if (type === 'grabbed') target.pinnedUntil = now + (durationMs ?? config.durationMs);
    if (type === 'pinned') {
      target.pinnedUntil = now + config.durationMs;
      target.statuses.pinned.nails ??= this.makeNails(target, config);
    }
    if (type === 'bleeding') {
      const axes = (target.statuses.bleeding.axes ??= []);
      axes.push(this.makeAxe(target, config, opts.dir ?? 1));
      while (axes.length > config.maxAxes) this.dropAxe(axes.shift(), target);
    }
    if (fresh) this.label(target, type);
    this.affected.add(target);
  }

  // End an effect now (water puts out burning).
  clear(target, type) {
    const s = target.statuses?.[type];
    if (s) s.until = 0;
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
          if (s.axes) s.axes.forEach((a) => this.dropAxe(a, target));
          if (s.overlay) this.shatter(s.overlay);
          if (type === 'pinned' || type === 'grabbed') target.pinnedUntil = 0;
          delete statuses[type];
          continue;
        }
        if (type === 'burning') this.burn(target, s, now);
        else if (type === 'bleeding') this.bleed(target, s, now);
        else if (type === 'dazed') this.every(s, now, 160, () => this.star(target));
        else if (type === 'shocked') this.every(s, now, 90, () => this.spark(target));
        else if (type === 'blinded') this.every(s, now, 200, () => this.glare(target));
        else if (type === 'gassed') this.every(s, now, 180, () => this.cough(target));
        else if (type === 'frozen') this.ice(target, s);
        if (s.nails) {
          for (const n of s.nails) n.img.setPosition(target.x + n.dx, target.y + n.dy);
        }
        if (s.axes) {
          for (const a of s.axes) a.img.setPosition(target.x + a.dx, target.y + a.dy).setVisible(target.visible);
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
      s.nextFxAt = now + config.flameEveryMs;
      this.flame(target, Math.random() < 0.7 ? config.flameColor : config.flameCoreColor);
    }
  }

  // Axe wound: blood loss in small ticks (counts as the thrower's damage)
  // and a steady drip of blood (oil for machines; nothing with gore off).
  bleed(target, s, now) {
    const config = STATUS.bleeding;
    // (catch up if frames were slow, so the total stays dps x time)
    for (let n = 0; n < 3 && now >= s.nextTickAt && target.alive; n++) {
      s.nextTickAt += config.tickMs;
      const amount = Math.max(1, Math.round((config.dps * config.tickMs) / 1000));
      this.damage(target, amount, s.source, 'bleed');
    }
    if (now >= s.nextTickAt) s.nextTickAt = now + config.tickMs;
    if (now >= s.nextDripAt) {
      s.nextDripAt = now + config.dripMs;
      this.scene.effects?.bleed(target);
    }
  }

  every(s, now, ms, fn) {
    if (now < s.nextFxAt) return;
    s.nextFxAt = now + ms;
    fn();
  }

  // Dazed: little stars circling over the head.
  star(target) {
    const top = (target.visualTop ?? target.y - target.height / 2) - 6;
    const st = this.scene.add.star(target.x - 12, top, 5, 2, 4, STATUS.dazed.fxColor).setDepth(44);
    this.scene.tweens.add({
      targets: st,
      x: target.x + 12,
      angle: 180,
      alpha: 0,
      duration: 500,
      onUpdate: () => (st.y = (target.visualTop ?? target.y - target.height / 2) - 6),
      onComplete: () => st.destroy(),
    });
  }

  // Shocked: lightning (the arc art) crackling over the body.
  spark(target) {
    const cfg = STATUS.shocked;
    const key = fxKey(Phaser.Utils.Array.GetRandom(cfg.arcArt));
    if (this.scene.textures.exists(key)) {
      const d = drawn(target);
      const img = this.scene.add
        .image(target.x + Phaser.Math.Between(-d.w / 3, d.w / 3), Phaser.Math.Between(d.top + d.h * 0.15, d.bottom - d.h * 0.15), key)
        .setRotation(Math.random() * Math.PI * 2)
        .setFlipY(Math.random() < 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(44);
      img.setScale(Phaser.Math.Between(...cfg.arcSize) / img.width);
      this.scene.time.delayedCall(90, () => img.destroy());
      return;
    }
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

  // Frozen: a rough block of ice around the body (jagged sides, a few
  // cracks across it), following it. Drawn once, then just moved.
  ice(target, s) {
    const cfg = STATUS.frozen.ice;
    const d = drawn(target);
    if (!s.overlay) {
      const g = this.scene.add.graphics().setDepth(44);
      const hw = Math.max(d.w * 0.75, d.h * 0.32);
      const hh = d.h * 0.56;
      const pts = [];
      for (let i = 0; i < cfg.sides; i++) {
        const a = (i / cfg.sides) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
        const r = 1 + Phaser.Math.FloatBetween(-cfg.rough, cfg.rough);
        // a squarish block (not round): push the points out toward the corners
        const c = Math.cos(a), sn = Math.sin(a);
        const sq = 1 / Math.max(Math.abs(c), Math.abs(sn));
        pts.push(new Phaser.Math.Vector2(c * sq * hw * r * 0.92, sn * sq * hh * r * 0.92));
      }
      g.fillStyle(STATUS.frozen.fxColor, cfg.alpha);
      g.fillPoints(pts, true);
      g.lineStyle(2, cfg.edge, cfg.edgeAlpha);
      g.strokePoints(pts, true);
      // cracks and a shine
      g.lineStyle(1, cfg.facets, 0.6);
      for (let i = 0; i < 3; i++) {
        const p = pts[Phaser.Math.Between(0, pts.length - 1)];
        g.lineBetween(p.x * 0.9, p.y * 0.9, Phaser.Math.Between(-hw / 3, hw / 3), Phaser.Math.Between(-hh / 3, hh / 3));
      }
      g.fillStyle(0xffffff, 0.35);
      g.fillTriangle(-hw * 0.6, -hh * 0.75, -hw * 0.35, -hh * 0.8, -hw * 0.7, -hh * 0.2);
      s.overlay = g;
    }
    s.overlay.setPosition(target.x, d.mid).setVisible(target.visible !== false);
  }

  // An effect drawn over a character ends: the ice cracks away (grows a
  // little and fades) rather than vanishing.
  shatter(img) {
    if (!img.active) return;
    this.scene.tweens.add({ targets: img, alpha: 0, scaleX: img.scaleX * 1.15, scaleY: img.scaleY * 1.08, duration: 220, onComplete: () => img.destroy() });
  }

  // A few grey nails stuck into the character, at random spots.
  // Nails (the Nail Gun's nail art) driven into the body, tip first,
  // from the side they came from. (No art: little grey bars.)
  makeNails(target, config) {
    const nails = [];
    const d = drawn(target);
    const key = projKey('nail');
    const art = this.scene.textures.exists(key);
    for (let i = 0; i < config.nails; i++) {
      const dx = Phaser.Math.Between(-d.w * 0.3, d.w * 0.3);
      const dy = Phaser.Math.Between(d.top + d.h * 0.2, d.bottom - d.h * 0.25) - target.y;
      let img;
      if (art) {
        const from = dx < 0 ? 1 : -1; // tip points into the body
        img = this.scene.add.image(target.x + dx, target.y + dy, key).setOrigin(0.85, 0.5).setDepth(44);
        img.setScale(config.nailSize / img.width).setFlipX(from < 0).setRotation(Phaser.Math.FloatBetween(-0.5, 0.5));
        if (from < 0) img.setOrigin(0.15, 0.5);
      } else {
        img = this.scene.add
          .rectangle(target.x + dx, target.y + dy, 10, 3, config.nailColor)
          .setStrokeStyle(1, 0x000000)
          .setRotation(Phaser.Math.FloatBetween(-0.6, 0.6))
          .setDepth(44);
      }
      nails.push({ img, dx, dy });
    }
    return nails;
  }

  // An axe buried in the side it hit: blade in the body, handle sticking
  // out the way it came from, at a slight random tilt.
  makeAxe(target, config, dir) {
    const dx = -dir * Phaser.Math.Between(2, Math.max(3, Math.floor(target.width / 3)));
    const dy = Phaser.Math.Between(-target.height / 3, target.height / 5);
    const img = this.scene.add
      .image(target.x + dx, target.y + dy, 'icon-combatAxe')
      .setScale(config.axeScale)
      .setOrigin(0.88, 0.5)          // the blade edge sits on the hit point
      .setFlipX(dir < 0)
      .setRotation(Phaser.Math.FloatBetween(-0.5, 0.5))
      .setDepth(44);
    if (dir < 0) img.setOrigin(0.12, 0.5);
    return { img, dx, dy };
  }

  // The axe drops out of the wound and tumbles away.
  dropAxe(axe, target) {
    const img = axe.img;
    if (!img.active) return;
    this.scene.tweens.add({
      targets: img,
      y: img.y + 60,
      x: img.x + (img.flipX ? 14 : -14),
      angle: img.angle + (img.flipX ? 160 : -160),
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeIn',
      onComplete: () => img.destroy(),
    });
  }

  // A flame (the flame-puff art) licking up off a burning character:
  // turned so its tongues point up, rising and fading. (No art: a dot.)
  flame(target, color) {
    const cfg = STATUS.burning;
    const key = cfg.flameArt && projKey(cfg.flameArt);
    if (this.scene.textures.exists(key)) {
      const d = drawn(target);
      const f = this.scene.add
        .image(target.x + Phaser.Math.Between(-d.w * 0.4, d.w * 0.4), Phaser.Math.Between(d.top + d.h * 0.15, d.bottom - d.h * 0.1), key)
        .setRotation(Math.PI / 2 + Phaser.Math.FloatBetween(-0.35, 0.35))
        .setFlipY(Math.random() < 0.5)
        .setDepth(44);
      f.setScale(Phaser.Math.Between(...cfg.flameSize) / f.width).setAlpha(cfg.flameAlpha);
      if (FIRE_LOOK.glow) f.setBlendMode(Phaser.BlendModes.ADD); // glowing, no dark outline
      this.scene.tweens.add({
        targets: f,
        y: f.y - Phaser.Math.Between(14, 28),
        x: f.x + Phaser.Math.Between(-4, 4),
        alpha: 0,
        scale: f.scale * 0.45,
        duration: Phaser.Math.Between(320, 460),
        onComplete: () => f.destroy(),
      });
      return;
    }
    // The drawn flames (as before the art): small red and orange tongues
    // rising off the body and fading (pointed, not dots).
    const x = target.x + Phaser.Math.Between(-target.width / 2, target.width / 2);
    const y = target.y + Phaser.Math.Between(-target.height / 3, target.height / 3);
    const w = Phaser.Math.Between(3, 6);
    const f = this.scene.add.triangle(x, y, 0, w * 2.6, w, 0, w * 2, w * 2.6, color, 0.9).setDepth(44);
    if (FIRE_LOOK.glow) f.setBlendMode(Phaser.BlendModes.ADD);
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
    if (STATUS[type].noLabel) return;
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
