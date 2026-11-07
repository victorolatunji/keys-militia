import Phaser from 'phaser';
import { HIDING, WATER, LAVA, GEYSER, VENT, FALLS, FREEZE, DECOR } from '../data/hazards.js';

// Map hazards and advantages (Phase 7), read from the Tiled object layer
// "hazards" (and bushes from "decor"). Rules live in src/data/hazards.js.
//   water: slows you; fully under you're hidden but hold your breath.
//          Jet Boost floats you. Blasts, bullets, grenades, items and body
//          parts all act differently in it (see liquidObjects, blastFactor).
//   lava:  sets you burning; fully in it you melt after a moment
//   geysers: warn, then blast fire straight up
//   vents: hot air that lifts you and refuels your jetpack
//   bushes: stand inside one and you're hidden
//   waterfalls / lavafalls: push you down (lava also burns), splash, sound
//   cryo freezes water into ice (lava into a crust); EMP shocks the water
// Every character gets a few flags each frame: inWater, submerged, inLava,
// inBush, hidden (TypingSystem and BotBrain respect `hidden`).
const DEPTH_WATER = 30; // over characters (they look submerged), under words (50)
const DEPTH_BUSH = 32;
const HEARING = 900;    // ambient loops (waterfall, lava) fade out past this

export default class HazardSystem {
  constructor(scene, tilemap, map, groundLayer) {
    this.scene = scene;
    this.map = map;
    this.layer = groundLayer;
    const objects = tilemap.getObjectLayer('hazards')?.objects ?? [];
    const decor = tilemap.getObjectLayer('decor')?.objects ?? [];
    const rects = (list, name) => list.filter((o) => o.name === name && !o.point && o.width > 0);
    const points = (list, name) => list.filter((o) => o.name === name);

    this.makeDotTexture();
    const waterCfg = { ...WATER, ...(map.water ?? {}) };
    const lavaCfg = { ...LAVA, ...(map.lava ?? {}) };
    this.waters = rects(objects, 'water').map((o) => this.makePool(o, waterCfg, 'water'));
    this.lavas = rects(objects, 'lava').map((o) => this.makePool(o, lavaCfg, 'lava'));
    this.falls = [
      ...rects(objects, 'waterfall').map((o) => this.makeFall(o, waterCfg, 'waterfall')),
      ...rects(objects, 'lavafall').map((o) => this.makeFall(o, lavaCfg, 'lava')),
    ];
    this.geysers = points(objects, 'geyser').map((o) => this.makeGeyser(o));
    this.vents = points(objects, 'vent').map((o) => this.makeVent(o));
    this.bushes = rects(decor, 'bush').map((o) => this.makeBush(o));

    // Bots and crates treat water and lava like the void: they don't walk
    // into it or land in it (see Terrain.groundBelow).
    const pools = [...this.waters, ...this.lavas];
    if (pools.length) groundLayer.unsafeAt = (x, y) => pools.some((p) => inside(p, x, y));

    this.breathBar = scene.add.graphics().setDepth(55);
    this.slabs = [];        // ice / lava crust from cryo (solid for a while)
    this.slabGroup = scene.physics.add.staticGroup();
    this.nextFishAt = scene.time.now + 2000;
  }

  // What a blast sounds like there (muffled under water).
  blastSound(x, y) {
    return this.waters.some((p) => inside(p, x, y)) ? 'waterBlast' : 'explosion';
  }

  // Steam where something burning hits water (a molotov).
  steam(x, y) {
    for (let i = 0; i < 6; i++) {
      const c = this.scene.add.circle(x + Phaser.Math.Between(-14, 14), y, Phaser.Math.Between(6, 11), 0xf8f9fa, 0.6).setDepth(DEPTH_WATER + 2);
      this.scene.tweens.add({ targets: c, y: y - Phaser.Math.Between(30, 60), scale: 2, alpha: 0, duration: Phaser.Math.Between(600, 1000), onComplete: () => c.destroy() });
    }
    this.scene.sfx?.play('steam', { x, y });
  }

  // The pool (water or lava) at a point, or null.
  poolAt(x, y) {
    return this.waters.find((p) => inside(p, x, y)) ?? this.lavas.find((p) => inside(p, x, y)) ?? null;
  }

  // How hard a blast at (x, y) hits a victim, given water: a blast under
  // water rocks everyone in that water and barely reaches anyone outside;
  // a blast in the air barely reaches anyone fully under water.
  blastFactor(x, y, victim) {
    const pool = this.waters.find((p) => inside(p, x, y));
    if (pool) return victim.inWater && this.waters.find((p) => touches(p, victim.body)) === pool ? WATER.blastInWater : WATER.blastOutOfWater;
    return victim.submerged ? WATER.blastOutOfWater : 1;
  }

  // Everyone hazards act on: you and the bots (dummies don't move).
  characters() {
    return [this.scene.player, ...(this.scene.bots ?? [])].filter((c) => c && c.body);
  }

  // Runs every frame, after characters have moved for this frame.
  update() {
    const now = this.scene.time.now;
    const dt = Math.min(0.25, (now - (this.lastAt ?? now)) / 1000); // game time since last frame
    this.lastAt = now;
    for (const c of this.characters()) this.updateCharacter(c, now);
    for (const p of this.waters) this.drawSurface(p, now);
    for (const p of this.lavas) this.drawSurface(p, now);
    for (const f of this.falls) this.drawFall(f, now);
    for (const g of this.geysers) this.updateGeyser(g, now);
    for (const v of this.vents) this.updateVent(v, now, dt);
    this.liquidObjects(now, dt);
    this.updateSlabs(now);
    this.updateFish(now);
    this.updateBushes();
    this.ambience();
    this.drawBreath();
  }

  // ---- Characters ----

  updateCharacter(c, now) {
    const st = (c.hazard ??= { breath: WATER.breathMs, nextDrownAt: 0, nextLavaAt: 0, nextBubbleAt: 0, lastAt: now });
    const elapsed = Math.min(250, now - st.lastAt); // game time since last frame (breath runs on the clock)
    st.lastAt = now;
    if (!c.alive) {
      c.inWater = c.submerged = c.inLava = c.inBush = c.hidden = false;
      st.wasInWater = st.wasInLava = false;
      this.setHiddenLook(c, false);
      return;
    }
    const b = c.body;
    // Jet Boost: you float on water, feet just under the surface.
    const floatOn = c.boosted ? this.waters.find((p) => touches(p, b)) : null;
    if (floatOn && b.bottom > floatOn.y + WATER.floatDepth) {
      b.y = floatOn.y + WATER.floatDepth - b.height;
      if (b.velocity.y > 0) b.velocity.y = 0;
      if (c.floatVel) c.floatVel.y = Math.min(c.floatVel.y, 0); // Jet Boost's own glide can't sink you
    }
    const water = this.waters.find((p) => touches(p, b));
    const lava = this.lavas.find((p) => touches(p, b));
    c.inWater = Boolean(water);
    c.submerged = Boolean(water && !c.boosted && b.top > water.y + 2 && b.top < water.bottom);
    c.inLava = Boolean(lava);

    // Water: partly in it changes only how you move. Fully under: hidden,
    // holding your breath, then drowning.
    if (water) {
      this.slow(b, water.cfg);
      if (!st.wasInWater) this.enterPool(c, water, b.velocity.y);
      if (water.cfg.putsOutFire && c.statuses?.burning) this.scene.weapons?.status.clear(c, 'burning');
    } else if (st.wasInWater) {
      this.scene.sfx?.play('splashSmall', c, { volume: 0.6 });
    }
    if (c.submerged) {
      st.breath -= elapsed;
      if (now >= st.nextBubbleAt) {
        st.nextBubbleAt = now + (st.breath > 0 ? 450 : 200);
        this.scene.effects?.bubbles(c.x + (c.facing ?? 1) * 6, b.top + 4, st.breath > 0 ? 1 : 3);
      }
      if (st.breath <= 0 && now >= st.nextDrownAt) {
        st.nextDrownAt = now + WATER.drownTickMs;
        c.takeDamage(WATER.drownDamage, 'drown', 'drown');
      }
    } else {
      if (st.breath < WATER.breathMs * 0.5 && st.wasSubmerged && c === this.scene.player) this.scene.sfx?.play('gasp', c);
      st.breath = Math.min(WATER.breathMs, st.breath + elapsed * 2); // breath comes back quickly
    }
    st.wasInWater = Boolean(water);
    st.wasSubmerged = c.submerged;

    // Lava: touching it sets you burning. Fully in: like drowning, only
    // faster and on fire (a moment to get out, then you melt).
    if (lava) {
      this.slow(b, lava.cfg);
      if (!st.wasInLava) {
        this.scene.sfx?.play('lavaSizzle', c);
        this.splash(lava, c.x, lava.cfg.surfaceColor, 8);
      }
      this.scene.weapons?.status.apply(c, 'burning', 'env');
    }
    const melting = Boolean(lava && b.top > lava.y + 2);
    if (melting) {
      st.heat = (st.heat ?? 0) + elapsed;
      if (st.heat >= lava.cfg.holdMs && now >= st.nextLavaAt) {
        st.nextLavaAt = now + lava.cfg.tickMs;
        c.takeDamage(lava.cfg.damage, 'lava', 'fire');
      }
    } else {
      st.heat = Math.max(0, (st.heat ?? 0) - elapsed * 2);
    }
    c.melting = melting;
    st.wasInLava = Boolean(lava);

    // Waterfalls and lavafalls push you down (and lava burns).
    for (const f of this.falls) {
      if (c.x < f.x || c.x > f.x + f.w || b.bottom < f.y || b.top > f.y + f.h) continue;
      b.velocity.y += FALLS.push * (elapsed / 1000);
      if (f.sound === 'lava') this.scene.weapons?.status.apply(c, 'burning', 'env');
    }

    // Hidden: fully under water, or in a bush, and not just attacked.
    c.inBush = this.bushes.some((bush) => c.x > bush.x && c.x < bush.right && b.top >= bush.y - 4 && b.bottom <= bush.bottom + 6);
    const hidden = (c.submerged || c.inBush) && now >= (c.lastAttackAt ?? -1e9) + HIDING.revealMs;
    if (hidden !== c.hidden && c === this.scene.player) this.note(c, hidden ? 'hidden' : 'spotted');
    c.hidden = hidden;
    this.setHiddenLook(c, hidden);
  }

  // In water or lava: slower running and flying, slow sinking.
  slow(b, cfg) {
    b.velocity.x *= cfg.moveScale;
    b.velocity.y = Phaser.Math.Clamp(b.velocity.y, -cfg.maxRiseSpeed, cfg.maxSinkSpeed);
  }

  enterPool(c, pool, vy) {
    const big = vy > pool.cfg.splashSpeed;
    this.scene.sfx?.play(big ? 'splash' : 'splashSmall', c);
    this.splash(pool, c.x, pool.cfg.surfaceColor, big ? 14 : 6);
  }

  // Droplets thrown up from the surface.
  // power: how high they fly (a blast under water throws a tall column).
  splash(pool, x, color, count, power = 1) {
    for (let i = 0; i < count; i++) {
      const d = this.scene.add.circle(x + Phaser.Math.Between(-10, 10) * power, pool.y, Phaser.Math.FloatBetween(1.5, 3.5) * Math.min(2, power), color, 0.9).setDepth(46);
      const vx = Phaser.Math.Between(-90, 90) * Math.sqrt(power);
      const vy = -Phaser.Math.Between(120, 280) * power;
      const ms = Phaser.Math.Between(350, 600) * Math.sqrt(power);
      const x0 = d.x;
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => {
          const t = (tw.getValue() * ms) / 1000; // seconds in flight: up, then back down
          d.setPosition(x0 + vx * t, pool.y + vy * t + 450 * power * t * t).setAlpha(1 - tw.getValue() * 0.7);
        },
        onComplete: () => d.destroy(),
      });
    }
  }

  // A blast near (above) a surface whips up spray.
  surfaceSplash(x, y, radius) {
    for (const p of [...this.waters, ...this.lavas]) {
      if (x < p.x - 20 || x > p.right + 20) continue;
      const above = p.y - y;
      if (above < 0 || above > radius * 0.6) continue;
      this.splash(p, Phaser.Math.Clamp(x, p.x + 6, p.right - 6), p.cfg.surfaceColor, 14, 1.4);
    }
  }

  // A blast under water: no fire, a muffled boom, bubbles, a tall column of
  // water and a ring on the surface. (Damage: see blastFactor.)
  waterBlast(x, y, radius, pool) {
    const scene = this.scene;
    const fx = scene.effects;
    fx?.bubbles(x, y, 16);
    const flash = scene.add.circle(x, y, radius * 0.5, 0xe0fbfc, 0.5).setDepth(DEPTH_WATER + 2);
    scene.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 350, onComplete: () => flash.destroy() });
    const sx = Phaser.Math.Clamp(x, pool.x + 8, pool.right - 8);
    const depth = Math.max(0, y - pool.y);
    const power = Phaser.Math.Clamp(2.4 - depth / 120, 0.8, 2.4); // deeper = smaller column
    this.splash(pool, sx, 0xffffff, 18, power);
    this.splash(pool, sx, pool.cfg.surfaceColor, 14, power * 0.7);
    const ring = scene.add.ellipse(sx, pool.y + 2, 30, 8).setStrokeStyle(2, 0xffffff, 0.8).setDepth(DEPTH_WATER + 2);
    scene.tweens.add({ targets: ring, scaleX: (radius * 2) / 30, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    scene.cameras.main.shake(140, 0.004);
  }

  // Lava thrown everywhere by a blast in it.
  lavaBlast(x, y, pool) {
    this.splash(pool, Phaser.Math.Clamp(x, pool.x + 8, pool.right - 8), pool.cfg.surfaceColor, 16, 1.8);
    this.splash(pool, Phaser.Math.Clamp(x, pool.x + 8, pool.right - 8), pool.cfg.glowColor, 10, 1.3);
  }

  // ---- Things falling into liquids ----

  // Grenades, rockets, enemy bullets, items, body parts and blood in water
  // or lava: splash when they go in, then each acts its own way.
  liquidObjects(now, dt) {
    const scene = this.scene;
    if (!this.waters.length && !this.lavas.length) return;
    const enter = (obj, x, y, size) => {
      const pool = this.poolAt(x, y);
      if (!pool) {
        obj.inPool = null;
        return null;
      }
      if (obj.inPool !== pool) {
        obj.inPool = pool;
        this.splash(pool, x, pool.cfg.surfaceColor, size);
        if (size >= 4) scene.sfx?.play(pool.kind === 'lava' ? 'lavaSizzle' : 'splashSmall', { x, y }, { volume: size >= 6 ? 0.7 : 0.35 });
        obj.justEntered = true;
      } else {
        obj.justEntered = false;
      }
      return pool;
    };

    // Grenades and throwables: sink slowly in water; in lava they cook off.
    const grenades = [...(scene.weapons?.grenades ?? []), ...(scene.botCombat?.thrown ?? [])];
    for (const g of grenades) {
      if (!g.active || g.done || !g.body || g.planted) continue;
      const pool = enter(g, g.x, g.y, 5);
      if (!pool) continue;
      // A molotov breaking on water or lava: no fire patch, just steam / a flare.
      if (g.kind === 'molotov' && g.justEntered) {
        if (pool.kind === 'water') this.steam(g.x, pool.y);
        else this.splash(pool, g.x, pool.cfg.glowColor, 8, 1.2);
        g.remove();
        continue;
      }
      g.body.velocity.x *= 0.9;
      g.body.velocity.y = Math.min(g.body.velocity.y, WATER.sinkSpeed);
      if (pool.kind === 'lava' && g.explodeAt !== undefined) g.explodeAt = Math.min(g.explodeAt, now + LAVA.cookOffMs);
    }

    // Launcher rounds go off when they hit the surface.
    for (const r of scene.weapons?.projectiles ?? []) {
      if (!r.active || r.done) continue;
      if (enter(r, r.x, r.y, 6) && r.justEntered && r.explode) r.explode();
    }

    // Enemy bullets: slowed to nothing in water (it protects you), gone in lava.
    for (const b of scene.botCombat?.bullets ?? []) {
      if (!b.active) continue;
      const pool = enter(b, b.x, b.y, 3);
      if (!pool || !b.justEntered) continue;
      if (pool.kind === 'lava') b.destroy();
      else b.maxRangePx = Math.min(b.maxRangePx, Phaser.Math.Distance.Between(b.startX, b.startY, b.x, b.y) + WATER.bulletRangePx);
    }

    // Loose items: sink to the bottom of water; burn up in lava.
    const items = [...(scene.airdrops?.drops ?? []), ...(scene.airdrops?.supplies ?? [])];
    for (const it of items) {
      if (!it.active || !it.body) continue;
      const pool = enter(it, it.x, it.y, 5);
      if (!pool) continue;
      if (pool.kind === 'lava') {
        scene.effects?.ash(it.x, it.y, 0x495057);
        it.remove?.();
        continue;
      }
      it.body.velocity.x *= 0.85;
      it.body.velocity.y = Math.min(it.body.velocity.y, WATER.sinkSpeed);
    }

    // Body parts sink (or burn up); blood thins out in water.
    const fx = scene.effects;
    if (fx) {
      for (const piece of fx.pieces) {
        const o = piece.obj;
        if (!o.active) continue;
        const pool = enter(piece, o.x, o.y, 2);
        if (!pool) continue;
        if (pool.kind === 'lava') {
          fx.ash(o.x, o.y, 0x495057);
          o.destroy();
          continue;
        }
        piece.vx *= 0.85;
        piece.vy = Math.min(piece.vy, WATER.sinkSpeed * 0.6);
        piece.spin *= 0.9;
      }
      for (const d of fx.drops) {
        const o = d.obj;
        if (!o.active || !this.poolAt(o.x, o.y)) continue;
        const cloud = scene.add.circle(o.x, o.y, 3, d.color, 0.35).setDepth(DEPTH_WATER + 1);
        scene.tweens.add({ targets: cloud, scale: 4, alpha: 0, duration: 900, onComplete: () => cloud.destroy() });
        o.destroy();
      }
    }
  }

  // ---- Cryo and EMP on liquids ----

  // Called by WeaponSystem when a tactical goes off.
  onTactical(x, y, config) {
    const r = config.radiusPx ?? 150;
    const near = (p) => x > p.x - r && x < p.right + r && y > p.y - r && y < p.bottom + r;
    if (config.effect === 'cryo') {
      for (const p of [...this.waters, ...this.lavas]) if (near(p)) this.freeze(p, Math.max(p.x, x - r), Math.min(p.right, x + r));
    } else if (config.effect === 'emp') {
      for (const p of this.waters) {
        if (!near(p)) continue;
        for (const c of this.characters()) {
          if (!c.alive || !touches(p, c.body)) continue;
          this.scene.weapons.status.apply(c, 'shocked', 'player');
          if (c === this.scene.player) c.takeDamage(FREEZE.empDamage, 'self', 'blast');
          else this.scene.weapons.addDamage(c, FREEZE.empDamage, '#4cc9f0', 'blast');
        }
        this.zapWater(p, x);
      }
    }
  }

  // Electric arcs running across the water.
  zapWater(p, x) {
    for (let i = 0; i < 10; i++) {
      const sx = Phaser.Math.Clamp(x + Phaser.Math.Between(-160, 160), p.x, p.right);
      const sy = p.y + Phaser.Math.Between(4, Math.max(6, p.h - 6));
      const bolt = this.scene.add
        .line(0, 0, sx, sy, sx + Phaser.Math.Between(-30, 30), sy + Phaser.Math.Between(-20, 20), 0x4cc9f0)
        .setOrigin(0, 0)
        .setLineWidth(2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH_WATER + 3);
      this.scene.time.delayedCall(Phaser.Math.Between(80, 260), () => bolt.destroy());
    }
  }

  // A sheet of ice over water (or a cooled crust over lava) from x0 to x1:
  // solid for a while, you can stand on it; it cracks, then breaks.
  freeze(p, x0, x1) {
    if (x1 - x0 < 24) return;
    const scene = this.scene;
    const lava = p.kind === 'lava';
    const t = FREEZE.thickness;
    const slab = scene.add
      .rectangle((x0 + x1) / 2, p.y - 4 + t / 2, x1 - x0, t, lava ? FREEZE.crustColor : FREEZE.iceColor, lava ? 1 : 0.92)
      .setStrokeStyle(2, lava ? 0xff7b00 : 0xffffff, 0.8)
      .setDepth(DEPTH_WATER + 2);
    scene.physics.add.existing(slab, true);
    this.slabGroup.add(slab);
    if (!this.slabCollider) {
      this.slabCollider = scene.physics.add.collider([scene.player, ...(scene.bots ?? [])], this.slabGroup);
    }
    const ms = lava ? FREEZE.crustMs : FREEZE.ms;
    const marks = scene.add.graphics().setDepth(DEPTH_WATER + 3);
    this.slabs.push({ slab, marks, lava, until: scene.time.now + ms, x0, x1, y: p.y - 4, pool: p, cracked: false });
    scene.sfx?.play(lava ? 'lavaSizzle' : 'iceForm', { x: (x0 + x1) / 2, y: p.y });
    // Anyone under fresh ice is frozen in it for a moment.
    if (!lava) {
      for (const c of this.characters()) {
        if (c.alive && c.x > x0 && c.x < x1 && touches(p, c.body)) scene.weapons?.status.apply(c, 'frozen', 'player');
      }
    }
  }

  updateSlabs(now) {
    for (const s of this.slabs) {
      const left = s.until - now;
      if (left <= 1500 && !s.cracked) {
        s.cracked = true;
        s.marks.lineStyle(2, s.lava ? 0xff7b00 : 0x48cae4, 0.9);
        for (let x = s.x0 + 12; x < s.x1 - 12; x += Phaser.Math.Between(18, 34)) {
          s.marks.lineBetween(x, s.y + 2, x + Phaser.Math.Between(-8, 8), s.y + FREEZE.thickness - 2);
        }
        this.scene.sfx?.play('iceCrack', s.slab, { volume: 0.6 });
      }
      if (s.cracked) s.slab.setAlpha(0.6 + Math.sin(now / 60) * 0.3);
      if (left <= 0) this.breakSlab(s);
    }
    this.slabs = this.slabs.filter((s) => s.slab.active);
  }

  breakSlab(s) {
    const color = s.lava ? FREEZE.crustColor : FREEZE.iceColor;
    for (let x = s.x0 + 6; x < s.x1; x += 14) this.splash(s.pool, x, color, 1, 1.1);
    this.scene.sfx?.play(s.lava ? 'lavaSizzle' : 'iceBreak', s.slab);
    s.marks.destroy();
    s.slab.destroy();
  }

  // ---- Fish (Forest lakes) ----

  // Now and then a fish jumps out of a big lake and plops back in.
  updateFish(now) {
    if (now < this.nextFishAt) return;
    this.nextFishAt = now + Phaser.Math.Between(...DECOR.fish.everyMs);
    const lakes = this.waters.filter((p) => p.cfg.fish && p.w > 200 && !this.slabs.some((s) => s.pool === p));
    if (!lakes.length) return;
    const p = Phaser.Utils.Array.GetRandom(lakes);
    const x0 = Phaser.Math.Between(p.x + 40, p.right - 120);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const startX = dir > 0 ? x0 : x0 + 80;
    const fish = this.scene.add.ellipse(startX, p.y, 14, 6, DECOR.fish.color).setDepth(DEPTH_WATER - 1);
    this.splash(p, startX, p.cfg.surfaceColor, 3);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 700,
      onUpdate: (tw) => {
        const t = tw.getValue();
        fish.setPosition(startX + dir * 80 * t, p.y - Math.sin(t * Math.PI) * 60).setRotation(dir * (t - 0.5) * 2.2);
      },
      onComplete: () => {
        this.splash(p, fish.x, p.cfg.surfaceColor, 4);
        const player = this.scene.player;
        if (player && Phaser.Math.Distance.Between(fish.x, p.y, player.x, player.y) < 500) this.scene.sfx?.play('splashSmall', fish, { volume: 0.3 });
        fish.destroy();
      },
    });
  }

  // You (only you see this): see-through while hidden.
  setHiddenLook(c, hidden) {
    if (c !== this.scene.player) return;
    const a = hidden ? HIDING.hiddenAlpha : 1;
    if (c.alpha === a) return;
    c.setAlpha(a);
    c.eye?.setAlpha(a);
  }

  note(c, text) {
    const t = this.scene.add
      .text(c.x, c.y - 50, text, { fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: HIDING.labelColor, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(60);
    this.scene.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  // Your breath, as a bar over your head while you're under.
  drawBreath() {
    const g = this.breathBar;
    g.clear();
    const p = this.scene.player;
    if (!p?.alive || (!p.submerged && !p.melting)) return;
    const share = p.melting
      ? Math.max(0, 1 - (p.hazard.heat ?? 0) / LAVA.holdMs)
      : Math.max(0, p.hazard.breath / WATER.breathMs);
    const x = p.x - 18;
    const y = p.body.top - 14;
    g.fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, 38, 6);
    const color = p.melting ? 0xff9f1c : share > 0.3 ? 0x90e0ef : 0xe63946;
    g.fillStyle(color, 1).fillRect(x, y, 36 * share, 4);
  }

  // ---- Pools (water, lava) ----

  makePool(o, cfg, kind) {
    const pool = { kind, cfg, x: o.x, y: o.y, w: o.width, h: o.height, right: o.x + o.width, bottom: o.y + o.height };
    // The body: bands getting darker toward the bottom.
    const g = this.scene.add.graphics().setDepth(DEPTH_WATER);
    const bands = 8;
    const alpha = cfg.alpha ?? (kind === 'lava' ? 0.96 : 0.55);
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(cfg.color),
        Phaser.Display.Color.IntegerToColor(cfg.deepColor),
        1,
        t
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), Math.min(1, alpha + t * 0.15));
      g.fillRect(pool.x, pool.y + (pool.h * i) / bands, pool.w, pool.h / bands + 1);
    }
    pool.body = g;
    pool.surface = this.scene.add.graphics().setDepth(DEPTH_WATER + 1);
    if (kind === 'lava') {
      // A glow over lava, and bubbles popping on it.
      pool.glow = this.scene.add.rectangle(pool.x + pool.w / 2, pool.y - 10, pool.w + 30, 40, cfg.glowColor, 0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_WATER - 1);
      pool.bubbles = this.scene.add.particles(0, 0, 'hz-dot', {
        x: { min: pool.x + 6, max: pool.right - 6 },
        y: { min: pool.y + 2, max: pool.y + 10 },
        lifespan: 700,
        speedY: { min: -60, max: -20 },
        scale: { start: 0.35, end: 0.05 },
        alpha: { start: 1, end: 0 },
        tint: [cfg.surfaceColor, cfg.glowColor],
        blendMode: 'ADD',
        frequency: 90,
      }).setDepth(DEPTH_WATER + 2);
    }
    return pool;
  }

  // The rippling top edge (and a light line on water).
  drawSurface(p, now) {
    const g = p.surface;
    const wave = p.cfg.waveHeight ?? 3;
    g.clear();
    g.fillStyle(p.cfg.surfaceColor, p.kind === 'lava' ? 0.95 : 0.5);
    g.beginPath();
    g.moveTo(p.x, p.y + 6);
    for (let x = 0; x <= p.w; x += 8) {
      const y = p.y + Math.sin(x / 26 + now / 400) * wave + Math.sin(x / 11 - now / 650) * (wave * 0.4);
      g.lineTo(p.x + x, y);
    }
    g.lineTo(p.right, p.y + 6);
    g.closePath();
    g.fillPath();
    if (p.glow) p.glow.setAlpha(0.14 + Math.sin(now / 500) * 0.06);
  }

  // ---- Waterfalls / lavafalls (looks and sound) ----

  makeFall(o, cfg, sound) {
    const fall = { cfg, sound, x: o.x, y: o.y, w: o.width, h: o.height, gfx: this.scene.add.graphics().setDepth(DEPTH_WATER - 2) };
    // Spray where it lands.
    fall.foam = this.scene.add.particles(0, 0, 'hz-dot', {
      x: { min: o.x, max: o.x + o.width },
      y: o.y + o.height - 4,
      lifespan: 600,
      speedX: { min: -70, max: 70 },
      speedY: { min: -110, max: -40 },
      gravityY: 300,
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 0.9, end: 0 },
      tint: sound === 'lava' ? [cfg.surfaceColor, cfg.glowColor] : [0xffffff, cfg.surfaceColor],
      blendMode: sound === 'lava' ? 'ADD' : 'NORMAL',
      frequency: 40,
    }).setDepth(DEPTH_WATER + 2);
    return fall;
  }

  drawFall(f, now) {
    const g = f.gfx;
    g.clear();
    g.fillStyle(f.cfg.color, f.sound === 'lava' ? 0.95 : 0.7);
    g.fillRect(f.x, f.y, f.w, f.h);
    // Streaks pouring down.
    g.fillStyle(f.cfg.surfaceColor, 0.6);
    for (let i = 0; i < 4; i++) {
      const sx = f.x + 3 + ((i * 7) % (f.w - 4));
      const len = 30 + i * 9;
      const off = (now * (0.35 + i * 0.05) + i * 40) % (f.h + len);
      g.fillRect(sx, f.y + off - len, 2, len);
      g.fillRect(sx, f.y + ((off + f.h / 2) % (f.h + len)) - len, 2, len * 0.6);
    }
  }

  // ---- Fire geysers ----

  makeGeyser(o) {
    const g = { x: o.x, y: o.y, state: 'idle', nextAt: this.scene.time.now + Phaser.Math.Between(...GEYSER.everyMs), hits: new Map() };
    // The vent in the ground: a dark crack glowing inside.
    this.scene.add.ellipse(o.x, o.y + 2, 30, 8, 0x1a0505).setDepth(2);
    g.core = this.scene.add.ellipse(o.x, o.y + 2, 18, 4, 0xff7b00, 0.8).setDepth(2);
    g.fire = this.scene.add.particles(o.x, o.y, 'hz-dot', {
      x: { min: -GEYSER.widthPx / 4, max: GEYSER.widthPx / 4 },
      lifespan: { min: 380, max: 520 },
      speedY: { min: -GEYSER.heightPx * 2.1, max: -GEYSER.heightPx * 1.5 },
      speedX: { min: -30, max: 30 },
      scale: { start: 1.5, end: 0.4 },
      alpha: { start: 1, end: 0 },
      tint: GEYSER.colors,
      blendMode: 'ADD',
      frequency: 12,
      quantity: 2,
      emitting: false,
    }).setDepth(43);
    g.smoke = this.scene.add.particles(o.x, o.y, 'hz-dot', {
      x: { min: -10, max: 10 },
      lifespan: 900,
      speedY: { min: -70, max: -30 },
      speedX: { min: -15, max: 15 },
      scale: { start: 0.6, end: 1.6 },
      alpha: { start: 0.5, end: 0 },
      tint: 0x495057,
      frequency: 70,
      emitting: false,
    }).setDepth(42);
    return g;
  }

  updateGeyser(g, now) {
    if (g.state === 'idle' && now >= g.nextAt) {
      g.state = 'warn';
      g.until = now + GEYSER.warnMs;
      g.smoke.start();
      this.scene.sfx?.play('geyserWarn', g);
    } else if (g.state === 'warn' && now >= g.until) {
      g.state = 'erupt';
      g.until = now + GEYSER.eruptMs;
      g.smoke.stop();
      g.fire.start();
      g.hits.clear();
      this.scene.sfx?.play('geyser', g);
      this.scene.cameras.main.shake(120, 0.003);
    } else if (g.state === 'erupt') {
      if (now >= g.until) {
        g.state = 'idle';
        g.fire.stop();
        g.nextAt = now + Phaser.Math.Between(...GEYSER.everyMs);
      } else {
        this.geyserHits(g, now);
      }
    }
    g.core.setAlpha(g.state === 'idle' ? 0.5 + Math.sin(now / 300) * 0.2 : 1);
  }

  geyserHits(g, now) {
    const half = GEYSER.widthPx / 2;
    for (const c of this.characters()) {
      if (!c.alive) continue;
      const b = c.body;
      if (b.right < g.x - half || b.left > g.x + half || b.bottom < g.y - GEYSER.heightPx || b.top > g.y + 4) continue;
      if (now < (g.hits.get(c) ?? 0)) continue;
      g.hits.set(c, now + GEYSER.hitEveryMs);
      c.takeDamage(GEYSER.damage, 'geyser', 'fire');
      this.scene.weapons?.status.apply(c, 'burning', 'env');
      b.velocity.y = -GEYSER.launch;
    }
  }

  // ---- Heat vents ----

  makeVent(o) {
    const v = { x: o.x, y: o.y };
    // A glowing grate, with hot air shimmering up from it.
    this.scene.add.rectangle(o.x, o.y + 3, VENT.widthPx * 0.7, 6, 0x22222a).setStrokeStyle(1, 0x000000).setDepth(2);
    for (let i = -2; i <= 2; i++) this.scene.add.rectangle(o.x + i * 8, o.y + 3, 3, 4, VENT.color, 0.9).setDepth(2);
    v.air = this.scene.add.particles(o.x, o.y, 'hz-dot', {
      x: { min: -VENT.widthPx / 2.5, max: VENT.widthPx / 2.5 },
      lifespan: 1400,
      speedY: { min: -VENT.heightPx / 1.2, max: -VENT.heightPx / 2 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.5, end: 1.4 },
      alpha: { start: 0.25, end: 0 },
      tint: VENT.color,
      blendMode: 'ADD',
      frequency: 60,
    }).setDepth(3);
    return v;
  }

  updateVent(v, now, dt) {
    const half = VENT.widthPx / 2;
    for (const c of this.characters()) {
      if (!c.alive) continue;
      const b = c.body;
      if (c.x < v.x - half || c.x > v.x + half || b.bottom < v.y - VENT.heightPx || b.bottom > v.y + 4) continue;
      const max = c.stats?.fuelMax ?? 100;
      c.fuel = Math.min(max, (c.fuel ?? 0) + VENT.refuelPerSec * dt);
      if (b.velocity.y > -VENT.maxLiftSpeed) b.velocity.y = Math.max(-VENT.maxLiftSpeed, b.velocity.y - VENT.lift * dt);
    }
  }

  // ---- Bushes ----

  makeBush(o) {
    const bush = { x: o.x, y: o.y, w: o.width, h: o.height, right: o.x + o.width, bottom: o.y + o.height };
    const g = this.scene.add.graphics().setDepth(DEPTH_BUSH);
    const greens = [0x2d6a4f, 0x40916c, 0x52b788, 0x1b4332];
    const blobs = Math.max(4, Math.round(o.width / 14));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < blobs; i++) {
        const t = (i + 0.5) / blobs;
        const r = Phaser.Math.Between(14, 20) - pass * 3;
        const x = o.x + t * o.width + Phaser.Math.Between(-4, 4);
        const y = o.y + o.height - r + 2 - pass * Phaser.Math.Between(6, 16) - Math.sin(t * Math.PI) * 12;
        g.fillStyle(greens[(i + pass) % greens.length], 1);
        g.fillCircle(x, y, r);
      }
    }
    // A few leaves and berries on top.
    for (let i = 0; i < blobs; i++) {
      g.fillStyle(i % 3 ? 0x74c69d : 0xe63946, 1);
      g.fillCircle(o.x + Phaser.Math.Between(6, o.width - 6), o.y + Phaser.Math.Between(10, o.height - 10), i % 3 ? 3 : 2);
    }
    bush.gfx = g;
    return bush;
  }

  // A bush you're in goes see-through so you can still see yourself.
  updateBushes() {
    const p = this.scene.player;
    for (const bush of this.bushes) {
      const near = p?.alive && p.x > bush.x - 10 && p.x < bush.right + 10 && p.body.bottom > bush.y && p.body.top < bush.bottom;
      bush.gfx.setAlpha(near ? 0.6 : 1);
    }
  }

  // ---- Sound ----

  // Waterfalls and lava pools you're near keep sounding.
  ambience() {
    const sfx = this.scene.sfx;
    const p = this.scene.player;
    if (!sfx || !p) return;
    const near = (x, y) => Phaser.Math.Distance.Between(x, y, p.x, p.y);
    for (const [i, f] of this.falls.entries()) {
      const at = { x: f.x + f.w / 2, y: Phaser.Math.Clamp(p.y, f.y, f.y + f.h) };
      const d = near(at.x, at.y);
      if (d < HEARING) sfx.hold(`fall${i}`, f.sound === 'lava' ? 'lava' : 'waterfall', at, 1 - d / HEARING);
    }
    for (const [i, l] of this.lavas.entries()) {
      const at = { x: Phaser.Math.Clamp(p.x, l.x, l.right), y: l.y };
      const d = near(at.x, at.y);
      if (d < HEARING) sfx.hold(`lava${i}`, 'lava', at, 1 - d / HEARING);
    }
    for (const [i, v] of this.vents.entries()) {
      const d = near(v.x, v.y - 60);
      if (d < 400) sfx.hold(`vent${i}`, 'vent', v, 1 - d / 400);
    }
  }

  // A soft white dot, tinted by each emitter.
  makeDotTexture() {
    if (this.scene.textures.exists('hz-dot')) return;
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(12, 12, 12);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 12, 7);
    g.generateTexture('hz-dot', 24, 24);
    g.destroy();
  }
}

function inside(p, x, y) {
  return x >= p.x && x <= p.right && y >= p.y && y <= p.bottom;
}

// A body touches a pool when its feet are below the surface and its middle is over it.
function touches(p, b) {
  const cx = b.center.x;
  return cx > p.x && cx < p.right && b.bottom > p.y + 4 && b.top < p.bottom;
}
