import Phaser from 'phaser';
import { HIDING, WATER, LAVA, GEYSER, VENT, FALLS, FREEZE, DECOR, ICE, THIN_ICE, QUICKSAND, CACTUS, SANDSTORM, IGLOO, DUST_DEVIL, BOULDER, HANDS, BELL, ROCKFALL, BAMBOO, TOXIC, RADIATION, ACID_RAIN, BARREL, METEOR, WIND, UPDRAFT, COFFIN } from '../data/hazards.js';
import Trigger from '../entities/Trigger.js';
import { gravityK, fallScale } from './Gravity.js';
import { groundBelow, isSolid as isSolidAt } from './Terrain.js';
import { TILE_FAMILY, SLIPPERY } from '../data/maps.js';
import Icicle from '../entities/Icicle.js';

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
//   cryo freezes water into an iceberg (not lava); EMP shocks the water
//   ice: you slide; thin ice cracks and breaks under you; freezing water
//   quicksand: sinks you, suffocates you slowly when you're under
//   icicles: word targets that drop on whoever is below; cacti prick
//   sandstorms: nobody sees far while one blows (visionPx)
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
    // Glacier's endless sea: water like any other, just huge (and deep).
    for (const o of rects(objects, 'sea')) this.waters.push(this.makePool(o, { ...waterCfg, fish: false, sea: true }, 'water'));
    this.lavas = rects(objects, 'lava').map((o) => this.makePool(o, lavaCfg, 'lava'));
    this.sands = rects(objects, 'quicksand').map((o) => this.makePool(o, { ...QUICKSAND }, 'quicksand'));
    this.toxics = rects(objects, 'toxic').map((o) => this.makePool(o, { ...TOXIC, glowColor: TOXIC.surfaceColor }, 'toxic'));
    this.icicles = points(objects, 'icicle').map((o) => new Icicle(scene, o.x, o.y));
    this.cacti = points(decor, 'cactus').map((o) => ({ x: o.x, y: o.y }));
    this.thin = new Map();      // thin ice tile -> how long it's been stood on
    this.refreeze = [];         // broken thin ice waiting to freeze over
    if (map.sandstorm) this.makeStorm();
    this.falls = [
      ...rects(objects, 'waterfall').map((o) => this.makeFall(o, waterCfg, 'waterfall')),
      ...rects(objects, 'lavafall').map((o) => this.makeFall(o, lavaCfg, 'lava')),
    ];
    this.geysers = points(objects, 'geyser').map((o) => this.makeGeyser(o));
    this.vents = points(objects, 'vent').map((o) => this.makeVent(o));
    this.bushes = rects(decor, 'bush').map((o) => this.makeBush(o));
    this.bushes.push(...rects(decor, 'igloo').map((o) => this.makeIgloo(o)));
    this.devils = rects(objects, 'dustdevil').map((o) => this.makeDevil(o));
    this.triggers = [];  // levers, the bell: word targets (registerTargets)
    this.ramps = objects.filter((o) => o.name === 'boulderR' || o.name === 'boulderL').map((o) => this.makeRamp(o));
    this.handZones = rects(objects, 'hands').map((o) => ({ x: o.x, y: o.y, right: o.x + o.width, bottom: o.y + o.height, nextAt: scene.time.now + Phaser.Math.Between(...HANDS.everyMs), hand: null }));
    this.bells = points(objects, 'bell').map((o) => this.makeBell(o));
    this.coffinGroup = scene.physics.add.staticGroup();
    this.coffins = points(objects, 'coffin').map((o) => this.makeCoffin(o));
    this.bushes.push(...rects(decor, 'bamboo').map((o) => this.makeBamboo(o)));
    const fallZone = (o, cfg) => ({ cfg, x: o.x, y: o.y, right: o.x + o.width, bottom: o.y + o.height, nextAt: scene.time.now + Phaser.Math.Between(...cfg.everyMs), rock: null });
    this.rockZones = [
      ...rects(objects, 'rockfall').map((o) => fallZone(o, { ...ROCKFALL, cause: 'rockfall' })),
      ...rects(objects, 'meteor').map((o) => fallZone(o, { ...METEOR, cause: 'meteor', meteor: true })),
    ];
    this.updrafts = rects(objects, 'updraft').map((o) => this.makeUpdraft(o));
    if (map.wind) this.makeWind();
    this.radZones = rects(objects, 'radiation').map((o) => this.makeRadiation(o));
    this.barrels = points(objects, 'barrel').map((o) => this.makeBarrel(o));
    if (map.acidRain) this.makeRain();

    // Bots and crates treat water and lava like the void: they don't walk
    // into it or land in it (see Terrain.groundBelow).
    const pools = [...this.waters, ...this.lavas, ...this.sands, ...this.toxics];
    if (pools.length) groundLayer.unsafeAt = (x, y) => pools.some((p) => inside(p, x, y));

    this.breathBar = scene.add.graphics().setDepth(55);
    this.slabs = [];        // ice / lava crust from cryo (solid for a while)
    this.slabGroup = scene.physics.add.staticGroup();
    this.nextFishAt = scene.time.now + 2000;
  }

  // What a blast sounds like there (muffled under water).
  blastSound(x, y) {
    return [...this.waters, ...this.toxics, ...this.sands].some((p) => inside(p, x, y)) ? 'waterBlast' : 'explosion';
  }

  // Steam where something burning hits water (a molotov).
  steam(x, y) {
    for (let i = 0; i < 6; i++) {
      const c = this.scene.add.circle(x + Phaser.Math.Between(-14, 14), y, Phaser.Math.Between(6, 11), 0xf8f9fa, 0.6).setDepth(DEPTH_WATER + 2);
      this.scene.tweens.add({ targets: c, y: y - Phaser.Math.Between(30, 60), scale: 2, alpha: 0, duration: Phaser.Math.Between(600, 1000), onComplete: () => c.destroy() });
    }
    this.scene.sfx?.play('steam', { x, y });
  }

  // A molotov on toxic sludge: a flash of green chemical fire that hurts
  // anyone standing in it.
  toxicFlare(x, pool) {
    const scene = this.scene;
    for (let i = 0; i < 14; i++) {
      const f = scene.add.circle(x + Phaser.Math.Between(-40, 40), pool.y, Phaser.Math.Between(5, 10), Phaser.Utils.Array.GetRandom([0x9ef01a, 0xffd166, 0x70e000]), 0.85).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_WATER + 3);
      scene.tweens.add({ targets: f, y: f.y - Phaser.Math.Between(30, 80), scale: 0.2, alpha: 0, duration: Phaser.Math.Between(400, 800), onComplete: () => f.destroy() });
    }
    scene.sfx?.play('molotov', { x, y: pool.y });
    for (const c of this.characters()) {
      if (c.alive && touches(pool, c.body) && Math.abs(c.x - x) < 80) {
        if (c === scene.player) c.takeDamage(8, 'self', 'fire');
        else scene.weapons?.addDamage(c, 8, '#9ef01a', 'fire');
        scene.weapons?.status.apply(c, 'burning', 'player', 1500);
      }
    }
  }

  // The pool (water, lava or quicksand) at a point, or null.
  poolAt(x, y) {
    return this.waters.find((p) => inside(p, x, y)) ?? this.lavas.find((p) => inside(p, x, y)) ?? this.sands.find((p) => inside(p, x, y)) ?? this.toxics.find((p) => inside(p, x, y)) ?? null;
  }

  // Icicles are word targets: TypingSystem needs to know about them.
  registerTargets(typing) {
    for (const t of this.triggers) typing.addTarget(t);
  }

  // How far anyone can see right now (a sandstorm cuts it), or null = normal.
  get visionPx() {
    return this.storm && this.storm.level > 0.5 ? SANDSTORM.visionPx : null;
  }

  // How hard a blast at (x, y) hits a victim, given water: a blast under
  // water rocks everyone in that water and barely reaches anyone outside;
  // a blast in the air barely reaches anyone fully under water.
  blastFactor(x, y, victim) {
    // Toxic sludge carries a blast like water; quicksand smothers it.
    const pool = [...this.waters, ...this.toxics].find((p) => inside(p, x, y));
    if (pool) return touches(pool, victim.body) ? WATER.blastInWater : WATER.blastOutOfWater;
    const sand = this.sands.find((p) => inside(p, x, y));
    if (sand) return touches(sand, victim.body) ? 0.8 : 0.4;
    return victim.submerged || victim.buried ? WATER.blastOutOfWater : 1;
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
    for (const p of this.sands) this.drawSurface(p, now);
    for (const p of this.toxics) this.drawSurface(p, now);
    for (const z of this.rockZones) this.updateRockfall(z, now, dt);
    for (const bell of this.bells) this.updateBell(bell, now);
    if (this.coffins.length) this.updateCoffins(now);
    if (this.wind) this.updateWind(now);
    if (this.rain) this.updateRain(now);
    for (const ic of this.icicles) ic.update(dt);
    this.updateThinIce(now);
    for (const d of this.devils) this.updateDevil(d, now, dt);
    for (const r of this.ramps) this.updateRamp(r, now, dt);
    for (const z of this.handZones) this.updateHands(z, now);
    for (const t of this.triggers) t.update();
    if (this.storm) this.updateStorm(now);
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
      c.inWater = c.submerged = c.inLava = c.inBush = c.hidden = c.inSand = c.buried = false;
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
    const sand = this.sands.find((p) => touches(p, b));
    c.inSand = Boolean(sand);
    c.buried = Boolean(sand && b.top > sand.y + 2);

    // Ice underfoot: you slide (and thin ice cracks; see updateThinIce).
    this.slide(c, b, elapsed);

    // Water: partly in it changes only how you move. Fully under: hidden,
    // holding your breath, then drowning.
    if (water) {
      this.slow(b, water.cfg);
      if (!st.wasInWater) this.enterPool(c, water, b.velocity.y);
      if (water.cfg.putsOutFire && c.statuses?.burning) this.scene.weapons?.status.clear(c, 'burning');
      // Freezing water (Glacier): frozen stiff for a moment when you fall in.
      if (water.cfg.freezing && !st.wasInWater) this.scene.weapons?.status.apply(c, 'frozen', 'env', THIN_ICE.freezingMs);
    } else if (st.wasInWater) {
      this.scene.sfx?.play('splashSmall', c, { volume: 0.6 });
    }
    // Quicksand: you can barely move and it keeps pulling you down.
    if (sand) {
      this.slow(b, sand.cfg);
      // It only pulls while you're not fighting it: the jetpack (or a jump)
      // gets you out, slowly. (Fixed: it used to cancel the jetpack every frame.)
      if (!c.thrusting && b.velocity.y >= 0) b.velocity.y = Math.max(b.velocity.y, sand.cfg.pull);
      if (!st.wasInSand) {
        this.scene.sfx?.play('sandSink', c);
        this.splash(sand, c.x, sand.cfg.surfaceColor, 6, 0.6);
      }
    }
    st.wasInSand = Boolean(sand);

    // Toxic puddles: they slow you and eat at you while you're in them.
    const toxic = this.toxics.find((p) => touches(p, b));
    if (toxic) {
      this.slow(b, toxic.cfg);
      if (!st.wasInToxic) {
        this.scene.sfx?.play('splashSmall', c);
        this.splash(toxic, c.x, toxic.cfg.surfaceColor, 6);
      }
      if (now >= (st.nextToxicAt ?? 0)) {
        st.nextToxicAt = now + toxic.cfg.tickMs;
        c.takeDamage(toxic.cfg.damage, 'toxic', 'gas');
      }
    }
    st.wasInToxic = Boolean(toxic);
    c.inToxic = Boolean(toxic);

    // Sky Islands: updrafts lift you; gusts of wind push you sideways
    // (hard in the air, a little on the ground). Ride them for long flights.
    const draft = this.updrafts.find((z) => c.x > z.x && c.x < z.right && b.bottom > z.y && b.top < z.bottom);
    if (draft) b.velocity.y = Math.max(b.velocity.y - UPDRAFT.lift * elapsed / 1000, -UPDRAFT.maxRise);
    if (this.wind?.level > 0) {
      // A drift on top of however they're moving (movement sets velocity
      // every frame, so the wind moves them directly). Walls stop it.
      const dir = this.wind.dir;
      const blocked = dir > 0 ? b.blocked.right : b.blocked.left;
      if (!blocked && !c.inWater) c.x += WIND.speed * this.wind.level * dir * (b.blocked.down ? WIND.groundFactor : 1) * elapsed / 1000;
    }

    // Radiation zones: a slow drain while you stand in one.
    const rad = this.radZones.find((z) => z.has(c));
    if (rad && now >= (st.nextRadAt ?? 0)) {
      st.nextRadAt = now + RADIATION.tickMs;
      c.takeDamage(RADIATION.damage, 'radiation', 'gas');
    }
    if (rad && c === this.scene.player) this.scene.sfx?.play('geiger', c, { volume: 0.5 });

    // Acid rain: out in the open, it burns a little.
    if (this.rain?.level > 0.5 && now >= (st.nextAcidAt ?? 0) && this.exposed(c)) {
      st.nextAcidAt = now + ACID_RAIN.tickMs;
      c.takeDamage(ACID_RAIN.damage, 'acid', 'gas');
    }

    // Fully under water or quicksand: holding your breath, then drowning
    // (suffocating in sand: no hiding in it).
    const under = c.submerged ? water : c.buried ? sand : null;
    if (under) {
      st.breathMax = under.cfg.breathMs;
      st.breath = Math.min(st.breath, st.breathMax) - elapsed;
      if (under.kind === 'water' && now >= st.nextBubbleAt) {
        st.nextBubbleAt = now + (st.breath > 0 ? 450 : 200);
        this.scene.effects?.bubbles(c.x + (c.facing ?? 1) * 6, b.top + 4, st.breath > 0 ? 1 : 3);
      }
      if (st.breath <= 0 && now >= st.nextDrownAt) {
        st.nextDrownAt = now + under.cfg.drownTickMs;
        c.takeDamage(under.cfg.drownDamage, under.kind === 'quicksand' ? 'quicksand' : 'drown', 'drown');
      }
    } else {
      if (st.breath < (st.breathMax ?? WATER.breathMs) * 0.5 && st.wasUnder && c === this.scene.player) this.scene.sfx?.play('gasp', c);
      st.breathMax = WATER.breathMs;
      st.breath = Math.min(WATER.breathMs, st.breath + elapsed * 2); // breath comes back quickly
    }
    c.underSomething = Boolean(under);
    st.wasInWater = Boolean(water);
    st.wasSubmerged = c.submerged;
    st.wasUnder = Boolean(under);

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

    // Cacti prick you and push you off.
    for (const k of this.cacti) {
      if (Math.abs(c.x - k.x) > CACTUS.widthPx / 2 + b.width / 2 || b.bottom < k.y - CACTUS.heightPx || b.top > k.y) continue;
      if (now < (st.nextPrickAt ?? 0)) break;
      st.nextPrickAt = now + CACTUS.everyMs;
      c.takeDamage(CACTUS.damage, 'cactus', 'melee');
      b.velocity.x = Math.sign(c.x - k.x || 1) * CACTUS.push;
      b.velocity.y = Math.min(b.velocity.y, -140);
      break;
    }

    // Hidden: fully under water, or in a bush, and not just attacked.
    const cover = this.bushes.find((bush) => c.x > bush.x && c.x < bush.right && b.top >= bush.y - 4 && b.bottom <= bush.bottom + 6);
    c.inBush = Boolean(cover);
    if (cover?.bamboo && Math.abs(b.velocity.x) > 30) {
      cover.rustleUntil = now + 400;
      this.scene.sfx?.play('rustle', c, { volume: 0.6 });
    }
    // An igloo's warmth thaws you out.
    if (cover?.igloo && c.statuses?.frozen) this.scene.weapons?.status.clear(c, 'frozen');
    const hidden = (c.submerged || c.inBush) && now >= (c.lastAttackAt ?? -1e9) + HIDING.revealMs;
    if (hidden !== c.hidden && c === this.scene.player) this.note(c, hidden ? 'hidden' : 'spotted');
    c.hidden = hidden;
    this.setHiddenLook(c, hidden);
  }

  // ---- Ice ----

  // Standing on ice: your speed only slowly follows what you press, so you
  // skid to a stop and take a moment to get going.
  slide(c, b, elapsed) {
    const fam = c.onGround ? this.familyUnder(b) : null;
    if (fam && SLIPPERY.has(fam)) {
      const k = 1 - Math.exp(-elapsed / ICE.gripMs);
      c.slideVx = (c.slideVx ?? b.velocity.x) + (b.velocity.x - (c.slideVx ?? b.velocity.x)) * k;
      b.velocity.x = c.slideVx;
      if (Math.abs(c.slideVx) > 120 && Math.random() < 0.15) this.scene.effects?.flakes?.(c.x, b.bottom, 1); // ice spray
    } else {
      c.slideVx = b.velocity.x;
    }
  }

  // The tile family under a body's feet (middle, then the edges), or null.
  familyUnder(b) {
    for (const x of [b.center.x, b.left + 3, b.right - 3]) {
      const t = this.layer.getTileAtWorldXY(x, b.bottom + 2);
      if (t && t.collides) return TILE_FAMILY[t.index] ?? null;
    }
    return null;
  }

  // Thin ice under anyone standing on it cracks, then breaks, then freezes
  // over again later (once nobody is in the way).
  updateThinIce(now) {
    const stood = new Set();
    for (const c of this.characters()) {
      if (!c.alive || !c.onGround) continue;
      const b = c.body;
      for (const x of [b.center.x, b.left + 3, b.right - 3]) {
        const t = this.layer.getTileAtWorldXY(x, b.bottom + 2);
        if (t && t.collides && (TILE_FAMILY[t.index] === 'thin' || TILE_FAMILY[t.index] === 'crumble')) stood.add(t);
      }
    }
    const dt = Math.min(250, now - (this.thinAt ?? now));
    this.thinAt = now;
    for (const t of stood) {
      const ms = (this.thin.get(t) ?? 0) + dt;
      this.thin.set(t, ms);
      if (ms >= THIN_ICE.crackMs && !t.cracked) {
        t.cracked = true;
        t.tint = 0x90a8c0;
        this.scene.sfx?.play(TILE_FAMILY[t.index] === 'crumble' ? 'dirtCrumble' : 'iceCrack', { x: t.getCenterX(), y: t.pixelY }, { volume: 0.5 });
      }
      if (ms >= THIN_ICE.breakMs) this.breakThin(t, now);
    }
    // Ice nobody is on slowly stops cracking.
    for (const [t, ms] of this.thin) if (!stood.has(t)) this.thin.set(t, Math.max(0, ms - dt * 0.5));
    // Freeze broken ice over again when it's clear.
    this.refreeze = this.refreeze.filter((r) => {
      if (now < r.at) return true;
      const x = r.x * this.layer.tilemap.tileWidth;
      const y = r.y * this.layer.tilemap.tileHeight;
      const blocked = this.characters().some((c) => c.alive && c.body.right > x && c.body.left < x + 32 && c.body.bottom > y && c.body.top < y + 32);
      if (blocked) return true;
      const t = this.layer.putTileAt(r.index, r.x, r.y);
      t.setCollision(true, true, true, true);
      return false;
    });
  }

  breakThin(t, now) {
    this.thin.delete(t);
    const x = t.getCenterX();
    const y = t.pixelY;
    const stone = TILE_FAMILY[t.index] === 'crumble';
    this.scene.sfx?.play(stone ? 'boulderCrash' : 'iceBreak', { x, y }, { volume: stone ? 0.4 : 1 });
    for (let i = 0; i < 5; i++) {
      const size = Phaser.Math.Between(3, 6);
      this.scene.effects?.piece(x, y + 4, { w: size, h: stone ? size : 3, color: stone ? (this.map.palette?.crumble ?? 0x9c9287) : 0xcaf0f8 }, false);
    }
    this.refreeze.push({ x: t.x, y: t.y, index: t.index, at: now + THIN_ICE.refreezeMs });
    this.layer.removeTileAt(t.x, t.y);
  }

  // A blast smashes thin ice near it (and kills or scares the wildlife).
  blastTerrain(x, y, radius) {
    const r = radius * 0.8;
    const now = this.scene.time.now;
    for (const t of this.layer.getTilesWithinWorldXY(x - r, y - r, r * 2, r * 2)) {
      if ((TILE_FAMILY[t.index] !== 'thin' && TILE_FAMILY[t.index] !== 'crumble') || !t.collides) continue;
      if (Phaser.Math.Distance.Between(x, y, t.getCenterX(), t.getCenterY()) <= r) this.breakThin(t, now);
    }
    this.scene.backdrop?.blast(x, y, radius); // wildlife caught in it dies, near it panics
    // Icicles near a blast snap off; coffins in it break.
    for (const ic of this.icicles) if (ic.alive && Phaser.Math.Distance.Between(x, y, ic.x, ic.ceilingY) < radius) ic.die();
    for (const cf of this.coffins) if (cf.alive && Phaser.Math.Distance.Between(x, y, cf.x, cf.y) < radius + 20) this.hitCoffin(cf, 100);
  }

  // ---- Igloos ----

  // A dome of snow blocks with a dark doorway. Inside you're hidden.
  makeIgloo(o) {
    const igloo = { igloo: true, x: o.x, y: o.y, w: o.width, h: o.height, right: o.x + o.width, bottom: o.y + o.height };
    const g = this.scene.add.graphics().setDepth(DEPTH_BUSH);
    const cx = o.x + o.width / 2;
    const r = o.width / 2;
    g.fillStyle(IGLOO.color, 1);
    g.slice(cx, igloo.bottom, r, Math.PI, 0, false);
    g.fillPath();
    g.lineStyle(1.5, IGLOO.shade, 1);
    for (let k = 1; k < 4; k++) {
      const yy = igloo.bottom - (r * k) / 4;
      const half = Math.sqrt(r * r - (igloo.bottom - yy) ** 2);
      g.lineBetween(cx - half, yy, cx + half, yy);
      for (let bx = cx - half + ((k % 2) * 14); bx < cx + half; bx += 28) g.lineBetween(bx, yy, bx, yy + r / 4);
    }
    g.fillStyle(0x1b263b, 1);
    g.slice(cx + r * 0.45, igloo.bottom, r * 0.35, Math.PI, 0, false); // the doorway
    g.fillPath();
    igloo.gfx = g;
    return igloo;
  }

  // ---- Dust devils ----

  makeDevil(o) {
    const d = { x0: o.x, x1: o.x + o.width, x: Phaser.Math.Between(o.x, o.x + o.width), y: o.y + o.height, dir: Math.random() < 0.5 ? -1 : 1, speed: Phaser.Math.Between(...DUST_DEVIL.speed), spin: 1, nextSpinAt: 0 };
    d.fx = this.scene.add
      .particles(0, 0, 'hz-dot', {
        x: { min: -DUST_DEVIL.widthPx / 2, max: DUST_DEVIL.widthPx / 2 },
        y: { min: -10, max: 0 },
        lifespan: 1300,
        speedY: { min: -DUST_DEVIL.heightPx * 1.1, max: -DUST_DEVIL.heightPx * 0.6 },
        speedX: { min: -50, max: 50 },
        scale: { start: 0.35, end: 1.2 },
        alpha: { start: 0.55, end: 0 },
        tint: [0xe9c46a, 0xd4a373, 0xb08968],
        frequency: 25,
        quantity: 2,
      })
      .setDepth(42);
    return d;
  }

  updateDevil(d, now, dt) {
    d.x += d.dir * d.speed * dt;
    if (d.x < d.x0 || d.x > d.x1) d.dir *= -1;
    const below = groundBelow(this.layer, d.x, d.y - 260);
    if (below !== null) d.y = d.y - 260 + below;
    d.fx.setPosition(d.x, d.y);
    if (now >= d.nextSpinAt) {
      d.nextSpinAt = now + 400;
      d.spin *= -1;
    }
    const half = DUST_DEVIL.widthPx / 2;
    for (const c of this.characters()) {
      if (!c.alive) continue;
      const b = c.body;
      if (Math.abs(c.x - d.x) > half || b.bottom < d.y - DUST_DEVIL.heightPx || b.top > d.y) continue;
      if (b.velocity.y > -DUST_DEVIL.maxLift) b.velocity.y = Math.max(-DUST_DEVIL.maxLift, b.velocity.y - DUST_DEVIL.lift * dt);
      b.velocity.x += d.spin * DUST_DEVIL.swirl * dt * 6;
    }
    const p = this.scene.player;
    if (p) {
      const dist = Phaser.Math.Distance.Between(d.x, d.y - 60, p.x, p.y);
      if (dist < 500) this.scene.sfx?.hold(`devil${this.devils.indexOf(d)}`, 'wind', { x: d.x, y: d.y }, 0.5 * (1 - dist / 500));
    }
  }

  // ---- Boulders (Catacombs) ----

  makeRamp(o) {
    const scene = this.scene;
    const dir = o.name === 'boulderR' ? 1 : -1;
    const r = { x: o.x, y: o.y, dir, state: 'wait', nextAt: scene.time.now + Phaser.Math.Between(...BOULDER.everyMs), by: null, boulder: null, hits: new Map() };
    if (!scene.textures.exists('boulder')) this.makeBoulderTexture();
    r.dust = scene.add
      .particles(o.x, o.y - BOULDER.radius - 4, 'hz-dot', {
        x: { min: -40, max: 40 },
        lifespan: 900,
        speedY: { min: 40, max: 120 },
        scale: { start: 0.3, end: 0.05 },
        alpha: { start: 0.6, end: 0 },
        tint: 0x8a8278,
        frequency: 40,
        emitting: false,
      })
      .setDepth(42);
    // (No lever any more: the boulders roll on their own, on a timer.)
    return r;
  }

  makeBoulderTexture() {
    const R = BOULDER.radius;
    const g = this.scene.add.graphics();
    g.fillStyle(BOULDER.color, 1).fillCircle(R + 2, R + 2, R);
    g.fillStyle(0x5c544c, 1).fillCircle(R + 8, R + 10, R * 0.75);
    g.fillStyle(BOULDER.color, 1).fillCircle(R - 2, R - 2, R * 0.75);
    g.fillStyle(0xa39a8f, 0.6).fillCircle(R - 8, R - 10, R * 0.3);
    g.lineStyle(2, 0x3d3a36, 1);
    g.lineBetween(R - 10, R - 4, R + 6, R + 8).lineBetween(R + 6, R + 8, R + 2, R + 20).lineBetween(R - 14, R + 10, R - 4, R + 16);
    g.strokeCircle(R + 2, R + 2, R);
    g.generateTexture('boulder', R * 2 + 4, R * 2 + 4);
    g.destroy();
  }

  // Rumble and dust at the top, then it goes. by: 'player' (your lever) or 'map'.
  warnBoulder(r, by, now, warnMs = BOULDER.warnMs) {
    if (r.state !== 'wait') return;
    r.state = 'warn';
    r.by = by;
    r.goAt = now + warnMs;
    r.dust.start();
    this.scene.sfx?.play('boulderWarn', r);
  }

  updateRamp(r, now, dt) {
    if (r.state === 'wait' && now >= r.nextAt) this.warnBoulder(r, 'map', now);
    if (r.state === 'warn' && now >= r.goAt) {
      r.dust.stop();
      r.state = 'roll';
      r.hits.clear();
      const b = this.scene.add.image(r.x, r.y, 'boulder').setDepth(41);
      this.scene.physics.add.existing(b);
      b.body.setCircle(BOULDER.radius, 2, 2);
      b.body.setBounce(0.15);
      b.body.setMaxVelocity(BOULDER.speed, 900);
      b.collider = this.scene.physics.add.collider(b, this.layer);
      r.boulder = b;
      r.stallMs = 0;
      return;
    }
    if (r.state !== 'roll') return;
    const b = r.boulder;
    b.body.setVelocityX(r.dir * BOULDER.speed);
    b.rotation += (r.dir * BOULDER.speed * dt) / BOULDER.radius;
    const blocked = r.dir > 0 ? b.body.blocked.right : b.body.blocked.left;
    r.stallMs = blocked ? r.stallMs + dt * 1000 : 0;
    this.scene.sfx?.hold(`roll${this.ramps.indexOf(r)}`, 'roll', b);
    // Crushing anyone in its way: hurt and thrown (not an instant kill).
    for (const c of this.characters()) {
      if (!c.alive || now < (r.hits.get(c) ?? 0)) continue;
      if (Phaser.Math.Distance.Between(b.x, b.y, c.x, c.y) > BOULDER.radius + c.width / 2 + 4) continue;
      r.hits.set(c, now + BOULDER.hitEveryMs);
      const yours = r.by === 'player';
      if (c === this.scene.player) c.takeDamage(BOULDER.damage, yours ? 'self' : 'boulder', 'blast');
      else if (yours) this.scene.weapons?.addDamage(c, BOULDER.damage, '#ff9f1c', 'blast');
      else c.takeDamage(BOULDER.damage, 'boulder', 'blast');
      c.applyKnockback?.(r.dir * BOULDER.knockback, -BOULDER.knockback * 0.5);
      this.scene.sfx?.play('meleeHit', c);
      this.scene.cameras.main.shake(120, 0.004);
    }
    // Hit the wall at the bottom (or stuck): it smashes apart.
    if (r.stallMs > 120 || b.y > this.layer.tilemap.heightInPixels) this.smashBoulder(r, now);
  }

  smashBoulder(r, now) {
    const b = r.boulder;
    this.scene.sfx?.play('boulderCrash', b);
    this.scene.cameras.main.shake(200, 0.006);
    for (let i = 0; i < 12; i++) {
      const size = Phaser.Math.Between(5, 12);
      this.scene.effects?.piece(b.x, b.y, { w: size, h: size, color: i % 3 ? BOULDER.color : 0x5c544c }, true);
    }
    this.scene.effects?.poof?.(b.x, b.y, 0x8a8278);
    b.collider.destroy();
    b.destroy();
    r.boulder = null;
    r.state = 'wait';
    r.nextAt = now + Phaser.Math.Between(...BOULDER.everyMs);
  }

  // ---- Grabbing hands (Graveyard) ----

  updateHands(z, now) {
    const h = z.hand;
    if (h) {
      if (h.state === 'warn' && now >= h.at) {
        h.state = 'up';
        h.at = now + HANDS.holdMs;
        h.gfx = this.scene.add.graphics().setDepth(35);
        this.scene.sfx?.play('handGrab', { x: h.x, y: h.y });
        // Grabs whoever is standing on that spot now.
        const c = this.characters().find((ch) => ch.alive && Math.abs(ch.x - h.x) < 34 && Math.abs(ch.body.bottom - h.y) < 20);
        if (c) {
          h.caught = c;
          this.scene.weapons?.status.apply(c, 'grabbed', 'env', HANDS.holdMs);
          c.takeDamage(HANDS.damage, 'hands', 'melee');
        }
      }
      if (h.state === 'up') {
        const t = 1 - Math.max(0, (h.at - now) / HANDS.holdMs);
        const rise = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1; // bursts up, holds, sinks back
        this.drawHand(h, rise, now);
        if (now >= h.at) {
          h.gfx.destroy();
          z.hand = null;
        }
      }
      return;
    }
    if (now < z.nextAt) return;
    z.nextAt = now + Phaser.Math.Between(...HANDS.everyMs);
    // On its interval a hand comes up: under someone standing in the zone
    // if anyone is, otherwise somewhere in it (a warning to stay clear).
    const inside = this.characters().filter((c) => c.alive && c.onGround && c.x > z.x && c.x < z.right && c.body.bottom > z.y && c.body.bottom < z.bottom + 12 && !c.statuses?.grabbed);
    const c = inside.length ? Phaser.Utils.Array.GetRandom(inside) : null;
    const hx = c ? c.x : Phaser.Math.Between(z.x + 10, z.right - 10);
    let hy = c ? c.body.bottom : z.y;
    if (!c) while (hy < z.bottom + 64 && !isSolidAt(this.layer, hx, hy)) hy += 4;
    if (!c && !isSolidAt(this.layer, hx, hy)) return;
    z.hand = { state: 'warn', at: now + HANDS.warnMs, x: hx, y: hy, target: c ?? { alive: false }, caught: null };
    this.scene.sfx?.play('dirtCrumble', { x: hx, y: hy });
    for (let i = 0; i < 6; i++) {
      const d = this.scene.add.circle(hx + Phaser.Math.Between(-12, 12), hy, Phaser.Math.Between(2, 4), 0x4a3b2c).setDepth(35);
      this.scene.tweens.add({ targets: d, y: d.y - Phaser.Math.Between(6, 18), alpha: 0, duration: 500, delay: i * 60, onComplete: () => d.destroy() });
    }
  }

  // A rotting hand out of the ground, fingers clutching (round the ankle).
  drawHand(h, rise, now) {
    const g = h.gfx;
    g.clear();
    const len = 34 * rise;
    const x = h.caught ? h.caught.x : h.x;
    const y = h.y;
    g.fillStyle(0x4a3b2c, 1).fillEllipse(x, y + 1, 30, 6); // broken earth
    if (len < 2) return;
    const sway = Math.sin(now / 90) * 2;
    g.fillStyle(HANDS.color, 1);
    g.fillRect(x - 5 + sway * 0.3, y - len, 10, len);            // forearm
    g.fillEllipse(x + sway, y - len, 16, 12);                       // palm
    g.lineStyle(3, HANDS.color, 1);
    for (let k = -2; k <= 2; k++) g.lineBetween(x + sway + k * 3.5, y - len - 4, x + sway + k * 4.5, y - len - 12 + Math.abs(k));
    g.lineStyle(1, 0x3d4a2a, 1).strokeRect(x - 5 + sway * 0.3, y - len, 10, len);
  }

  // ---- Coffins (Graveyard) ----

  // A wooden coffin lying on the ground or in an open grave: solid cover
  // you can stand on. Enemy bullets thud into it; your bullets and blasts
  // splinter it. Broken, it may spill a health pack; a new one is put back
  // later.
  makeCoffin(o) {
    const scene = this.scene;
    const cf = { x: o.x, y: o.y - COFFIN.height / 2, hp: COFFIN.hp, alive: true };
    cf.body = scene.add.rectangle(cf.x, cf.y, COFFIN.width, COFFIN.height, 0x000000, 0);
    scene.physics.add.existing(cf.body, true);
    this.coffinGroup.add(cf.body);
    if (!this.coffinCollider) this.coffinCollider = scene.physics.add.collider([scene.player, ...(scene.bots ?? [])], this.coffinGroup);
    cf.look = scene.add.graphics().setDepth(3).setPosition(cf.x, cf.y);
    this.drawCoffin(cf);
    return cf;
  }

  drawCoffin(cf) {
    const g = cf.look.clear();
    const w = COFFIN.width / 2;
    const h = COFFIN.height / 2;
    const cracked = cf.hp < COFFIN.hp * 0.5;
    // The six-sided coffin shape, lying down: wider at the shoulder end.
    const pts = [[-w, -h * 0.7], [-w * 0.55, -h], [w, -h * 0.75], [w, h * 0.75], [-w * 0.55, h], [-w, h * 0.7]].map(([x, y]) => new Phaser.Math.Vector2(x, y));
    g.fillStyle(COFFIN.color, 1).fillPoints(pts, true);
    g.lineStyle(2, COFFIN.edge, 1).strokePoints(pts, true);
    g.lineStyle(2, COFFIN.edge, 0.8).lineBetween(-w * 0.2, -h * 0.6, -w * 0.2, h * 0.6).lineBetween(-w * 0.45, 0, w * 0.05, 0); // a cross on the lid
    if (cracked) g.lineStyle(1, 0x1b120c, 1).lineBetween(w * 0.2, -h, w * 0.45, 0).lineBetween(w * 0.45, 0, w * 0.3, h);
  }

  hitCoffin(cf, damage) {
    if (!cf.alive) return;
    cf.hp -= damage;
    this.scene.sfx?.play('meleeHit', cf, { volume: 0.5 });
    if (cf.hp > 0) {
      this.drawCoffin(cf);
      return;
    }
    // Splinters, the bones inside, maybe a health pack.
    cf.alive = false;
    cf.body.body.enable = false;
    cf.look.clear();
    this.scene.sfx?.play('dirtCrumble', cf);
    for (let i = 0; i < 10; i++) this.scene.effects?.piece(cf.x, cf.y, { w: Phaser.Math.Between(6, 16), h: 4, color: i % 3 ? COFFIN.color : COFFIN.edge }, true);
    for (let i = 0; i < 3; i++) this.scene.effects?.piece(cf.x, cf.y, { w: 10, h: 3, color: 0xe9e4d4 }, false);
    if (Math.random() < COFFIN.healthChance) this.scene.airdrops?.dropItems(cf.x, cf.y - 10, [{ type: 'health', key: 'healthPack' }]);
    cf.backAt = this.scene.time.now + COFFIN.backMs;
  }

  // Bullets hitting coffins; broken ones come back once nobody's in the way.
  updateCoffins(now) {
    const inside = (cf, x, y) => Math.abs(x - cf.x) < COFFIN.width / 2 && Math.abs(y - cf.y) < COFFIN.height / 2;
    for (const cf of this.coffins) {
      if (!cf.alive) {
        if (now < cf.backAt) continue;
        if (this.characters().some((c) => c.alive && Math.abs(c.x - cf.x) < COFFIN.width && Math.abs(c.y - cf.y) < 50)) continue;
        cf.alive = true;
        cf.hp = COFFIN.hp;
        cf.body.body.enable = true;
        this.drawCoffin(cf);
        continue;
      }
      for (const b of this.scene.botCombat?.bullets ?? []) {
        if (b.active && inside(cf, b.x, b.y)) {
          this.hitCoffin(cf, COFFIN.bulletDamage);
          this.scene.effects?.piece(b.x, b.y, { w: 4, h: 3, color: COFFIN.color }, false);
          b.destroy();
        }
      }
      for (const b of this.scene.weapons?.bullets ?? []) {
        if (!b.active || b.chippedCoffin === cf || !inside(cf, b.x, b.y)) continue;
        b.chippedCoffin = cf; // your bullets go on to the target, but chip it
        this.hitCoffin(cf, COFFIN.bulletDamage);
      }
    }
  }

  // ---- The church bell (Graveyard) ----

  makeBell(o) {
    const scene = this.scene;
    const bell = { x: o.x, y: o.y + 10, nextAt: scene.time.now + Phaser.Math.Between(...BELL.everyMs) };
    const g = scene.add.graphics().setDepth(3).setPosition(bell.x, bell.y);
    g.lineStyle(3, 0x3d3a36, 1).lineBetween(0, -22, 0, -16);
    g.fillStyle(BELL.color, 1);
    g.fillTriangle(-6, -16, 6, -16, 0, -20);
    g.fillRoundedRect(-11, -16, 22, 24, 7);
    g.fillRect(-16, 4, 32, 6);
    g.fillStyle(0x3d3a36, 1).fillCircle(0, 12, 3);
    bell.look = g;
    return bell;
  }

  // It rings by itself now and then. Dong: rings spread out and everyone
  // within reach (you too) is dazed for a moment.
  // It senses movement: when anyone moves close to it, it rings (then it
  // rests a while before it can ring again).
  updateBell(bell, now) {
    if (now < bell.nextAt) return;
    const moving = this.characters().some((c) => c.alive && Phaser.Math.Distance.Between(c.x, c.y, bell.x, bell.y) < BELL.senseRadiusPx && Math.hypot(c.body.velocity.x, c.body.velocity.y) > 40);
    if (!moving) return;
    bell.nextAt = now + Phaser.Math.Between(...BELL.everyMs);
    this.ringBell(bell);
  }

  ringBell(bell) {
    const scene = this.scene;
    scene.sfx?.play('bell', bell);
    scene.tweens.add({ targets: bell.look, angle: { from: -25, to: 25 }, duration: 260, yoyo: true, repeat: 3, onComplete: () => bell.look.setAngle(0) });
    for (let i = 0; i < 3; i++) {
      const ring = scene.add.circle(bell.x, bell.y, 20).setStrokeStyle(3, BELL.color, 0.8).setDepth(43);
      scene.tweens.add({ targets: ring, radius: BELL.radiusPx, alpha: 0, duration: 900, delay: i * 250, onComplete: () => ring.destroy() });
    }
    for (const c of this.characters()) {
      if (c.alive && Phaser.Math.Distance.Between(c.x, c.y, bell.x, bell.y) <= BELL.radiusPx) {
        scene.weapons?.status.apply(c, 'dazed', 'env', BELL.dazedMs);
      }
    }
  }

  // ---- Monastery: bamboo groves and rockfalls ----

  // A grove of bamboo: tall jointed stalks with leaves. Inside it you're
  // hidden; it sways and rustles when someone moves through it.
  makeBamboo(o) {
    const grove = { bamboo: true, x: o.x, y: o.y, w: o.width, h: o.height, right: o.x + o.width, bottom: o.y + o.height, rustleUntil: 0 };
    const g = this.scene.add.graphics().setDepth(DEPTH_BUSH);
    const n = Math.max(4, Math.round(o.width / 9));
    for (let i = 0; i < n; i++) {
      const x = o.x + 4 + (i / (n - 1)) * (o.width - 8) + Phaser.Math.Between(-3, 3);
      const top = o.y + Phaser.Math.Between(0, 18);
      const color = BAMBOO.colors[i % BAMBOO.colors.length];
      g.lineStyle(5, color, 1).lineBetween(x, grove.bottom, x, top);
      g.lineStyle(2, 0x344e41, 1);
      for (let y = grove.bottom - 14; y > top + 6; y -= 16) g.lineBetween(x - 3, y, x + 3, y); // joints
      g.fillStyle(BAMBOO.colors[(i + 2) % BAMBOO.colors.length], 1);
      for (let k = 0; k < 3; k++) {
        const ly = top + 8 + k * 14;
        const d = k % 2 ? 1 : -1;
        g.fillTriangle(x, ly, x + d * 16, ly - 4, x + d * 14, ly + 2);
      }
    }
    grove.gfx = g;
    this.scene.tweens.add({ targets: g, x: { from: -1, to: 1 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return grove;
  }

  // Under the cliffs: pebbles trickle down (a warning), then a rock drops.
  updateRockfall(z, now, dt) {
    const cfg = z.cfg;
    const r = z.rock;
    if (r) {
      if (r.state === 'warn' && now >= r.at) {
        r.state = 'fall';
        r.marker?.destroy();
        r.gfx = this.scene.add.graphics().setDepth(41);
        if (cfg.meteor) {
          r.gfx.fillStyle(0xff9f1c, 0.35).fillCircle(0, 0, cfg.radius * 1.8);
          r.gfx.fillStyle(cfg.color, 1).fillCircle(0, 0, cfg.radius).fillStyle(0xffd166, 1).fillCircle(-3, -3, cfg.radius * 0.5);
        } else {
          r.gfx.fillStyle(cfg.color, 1).fillCircle(0, 0, cfg.radius).fillStyle(0x5e5850, 1).fillCircle(5, 6, cfg.radius * 0.6);
        }
        r.gfx.setPosition(r.x, r.y);
      }
      if (r.state === 'fall') {
        // Moved in small steps so a slow frame can't skip it past someone or the floor.
        const from = r.y;
        const to = r.y + cfg.fallSpeed * fallScale(this.scene) * Math.min(dt, 0.1);
        let landed = false;
        for (r.y = from; r.y < to && !landed; r.y = Math.min(to, r.y + 8)) {
          if (isSolidAt(this.layer, r.x, r.y + cfg.radius)) landed = true;
        }
        r.gfx.setPosition(r.x, r.y).setRotation(r.gfx.rotation + dt * 4);
        if (cfg.meteor && Math.random() < 0.7) {
          const t = this.scene.add.circle(r.x + Phaser.Math.Between(-4, 4), r.y - 10, Phaser.Math.Between(3, 6), Phaser.Utils.Array.GetRandom([0xff9f1c, 0xffd166, 0xe85d04]), 0.8).setDepth(40);
          this.scene.tweens.add({ targets: t, alpha: 0, scale: 0.2, duration: 400, onComplete: () => t.destroy() });
        }
        for (const c of this.characters()) {
          if (!c.alive || r.hit.has(c)) continue;
          if (Math.abs(c.x - r.x) < cfg.radius + c.width / 2 && r.y + cfg.radius > c.body.top && from - cfg.radius < c.body.bottom) {
            r.hit.add(c);
            c.takeDamage(cfg.damage, cfg.cause, 'blast');
            c.applyKnockback?.(Math.sign(c.x - r.x || 1) * 200, -120);
            this.scene.sfx?.play('meleeHit', c);
          }
        }
        if (landed || r.y > this.layer.tilemap.heightInPixels) {
          if (cfg.meteor) {
            // It bursts on impact: a small blast hurts anyone close by.
            this.scene.blastFx?.explosion(r.x, r.y, cfg.blastRadius, 'frag');
            this.scene.sfx?.play('explosion', r, { volume: 0.5 });
            for (const c of this.characters()) {
              if (!c.alive || r.hit.has(c)) continue;
              const d = Phaser.Math.Distance.Between(c.x, c.y, r.x, r.y);
              if (d < cfg.blastRadius) c.takeDamage(Math.round(cfg.damage * (1 - d / cfg.blastRadius)), cfg.cause, 'blast');
            }
          } else {
            this.scene.sfx?.play('boulderCrash', r, { volume: 0.5 });
          }
          for (let i = 0; i < 6; i++) this.scene.effects?.piece(r.x, r.y, { w: 5, h: 5, color: cfg.color }, true);
          r.gfx.destroy();
          z.rock = null;
        }
      }
      return;
    }
    if (now < z.nextAt) return;
    z.nextAt = now + Phaser.Math.Between(...cfg.everyMs);
    // Aim at someone standing in the zone, else anywhere in it.
    const under = this.characters().filter((c) => c.alive && c.x > z.x && c.x < z.right && c.y > z.y && c.y < z.bottom + 40);
    const x = under.length ? Phaser.Utils.Array.GetRandom(under).x : Phaser.Math.Between(z.x + 10, z.right - 10);
    // It breaks off the first open air at the top of the zone.
    let y = z.y;
    while (y < z.bottom && isSolidAt(this.layer, x, y)) y += 8;
    z.rock = { state: 'warn', at: now + cfg.warnMs, x, y, hit: new Set() };
    if (cfg.meteor) {
      // Meteors: a red ring flashes where it will hit.
      let ground = y;
      while (ground < this.layer.tilemap.heightInPixels && !isSolidAt(this.layer, x, ground)) ground += 8;
      const ring = this.scene.add.ellipse(x, ground - 4, 60, 14).setStrokeStyle(3, 0xe63946, 0.9).setDepth(41);
      this.scene.tweens.add({ targets: ring, alpha: 0.2, duration: 180, yoyo: true, repeat: -1 });
      z.rock.marker = ring;
      this.scene.sfx?.play('geyserWarn', { x, y: ground }, { volume: 0.5 });
      return;
    }
    this.scene.sfx?.play('pebbles', { x, y });
    for (let i = 0; i < 8; i++) {
      const p = this.scene.add.circle(x + Phaser.Math.Between(-10, 10), y, Phaser.Math.Between(1, 3), cfg.color).setDepth(41);
      this.scene.tweens.add({ targets: p, y: p.y + Phaser.Math.Between(80, 200), alpha: 0, duration: 700, delay: i * 90, onComplete: () => p.destroy() });
    }
  }

  // ---- Wastelands: radiation, acid rain, fuel barrels ----

  // A cloud of radioactive gas: soft green puffs drifting and swelling in
  // an oval (no hard edges), a glow of specks, the warning sign. You're in
  // it inside the oval.
  makeRadiation(o) {
    const scene = this.scene;
    const z = { cx: o.x + o.width / 2, cy: o.y + o.height / 2, rx: o.width / 2, ry: o.height / 2 };
    z.has = (c) => ((c.x - z.cx) / z.rx) ** 2 + ((c.y - z.cy) / z.ry) ** 2 < 1;
    const n = Math.max(6, Math.round((o.width * o.height) / 9000));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * 0.7;
      const px = z.cx + Math.cos(a) * z.rx * d;
      const py = z.cy + Math.sin(a) * z.ry * d;
      const r = Phaser.Math.Between(30, 60) * Math.min(1, z.ry / 80 + 0.4);
      const puff = scene.add.circle(px, py, r, RADIATION.color, 0.1).setDepth(36);
      scene.tweens.add({
        targets: puff,
        x: px + Phaser.Math.Between(-24, 24),
        y: py + Phaser.Math.Between(-14, 10),
        scale: Phaser.Math.FloatBetween(1.1, 1.4),
        alpha: 0.2,
        duration: Phaser.Math.Between(2200, 3800),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }
    scene.add
      .particles(0, 0, 'hz-dot', {
        emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(z.cx, z.cy, z.rx * 1.6, z.ry * 1.6) },
        lifespan: 2400,
        speedY: { min: -14, max: -4 },
        speedX: { min: -8, max: 8 },
        scale: { min: 0.15, max: 0.4 },
        alpha: { values: [0, 0.5, 0] },
        tint: RADIATION.color,
        blendMode: 'ADD',
        frequency: 90,
      })
      .setDepth(36);
    // The radiation sign.
    const g = scene.add.graphics().setDepth(4);
    const cx = z.cx;
    const cy = o.y + 18;
    g.fillStyle(0xffd60a, 1).fillCircle(cx, cy, 11);
    g.fillStyle(0x1b1b1b, 1).fillCircle(cx, cy, 2.5);
    for (let k = 0; k < 3; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI * 2) / 3;
      g.slice(cx, cy, 9, ang - 0.45, ang + 0.45, false);
      g.fillPath();
    }
    return z;
  }

  // Anything solid over this character's head? (the overpass, the sewer roof)
  exposed(c) {
    for (let y = c.body.top - 8; y > 0; y -= this.layer.tilemap.tileHeight) {
      if (isSolidAt(this.layer, c.x, y)) return false;
    }
    return true;
  }

  makeRain() {
    const scene = this.scene;
    this.rain = { level: 0, active: false, nextAt: scene.time.now + Phaser.Math.Between(...ACID_RAIN.everyMs) * 0.4 };
    if (!scene.textures.exists('raindrop')) {
      const g = scene.add.graphics();
      g.lineStyle(2, 0xffffff, 1).lineBetween(1, 0, 4, 14);
      g.generateTexture('raindrop', 6, 16);
      g.destroy();
    }
    this.rain.veil = scene.add.rectangle(0, 0, 1280, 720, ACID_RAIN.color, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(45);
    this.rain.drops = scene.add
      .particles(0, 0, 'raindrop', {
        x: { min: -100, max: 1380 },
        y: -20,
        lifespan: 1100,
        speedY: { min: 700, max: 900 },
        speedX: { min: 120, max: 180 },
        alpha: { start: 0.7, end: 0.4 },
        tint: ACID_RAIN.color,
        frequency: 6,
        quantity: 3,
        emitting: false,
      })
      .setScrollFactor(0)
      .setDepth(46);
  }

  updateRain(now) {
    const r = this.rain;
    if (!r.active && now >= r.nextAt) {
      r.active = true;
      r.startAt = now;
      r.until = now + ACID_RAIN.lastMs;
      r.drops.start();
      this.scene.effects?.notice('Acid rain!  Take cover');
    }
    if (r.active) {
      r.level = Math.max(0, Math.min(1, (now - r.startAt) / ACID_RAIN.fadeMs, (r.until - now) / ACID_RAIN.fadeMs));
      this.scene.sfx?.hold('acidrain', 'rain', null, 0.3 + r.level * 0.7);
      if (now >= r.until) {
        r.active = false;
        r.level = 0;
        r.drops.stop();
        r.nextAt = now + Phaser.Math.Between(...ACID_RAIN.everyMs);
      }
    }
    r.veil.setAlpha(0.12 * r.level);
  }

  // A red fuel barrel: type its word (or blast it) and it goes up.
  makeBarrel(o) {
    const scene = this.scene;
    const barrel = { x: o.x, y: o.y };
    const trig = new Trigger(scene, o.x, o.y - 18, {
      name: 'Fuel Barrel', width: 24, height: 34, rearmMs: BARREL.rearmMs, labelOffset: 14,
      draw: (g, ready) => {
        if (!ready) {
          g.fillStyle(0x2b2b2b, 1).fillEllipse(0, 16, 30, 6); // a scorch where it was
          return;
        }
        g.fillStyle(BARREL.color, 1).fillRoundedRect(-12, -17, 24, 34, 4);
        g.fillStyle(0x780000, 1).fillRect(-12, -8, 24, 3).fillRect(-12, 6, 24, 3);
        g.fillStyle(0xffd60a, 1).fillTriangle(-5, 3, 5, 3, 0, -5);
        g.fillStyle(0x1b1b1b, 1).fillRect(-1, -2, 2, 3);
      },
      onTrigger: () => this.blowBarrel(barrel),
    });
    this.triggers.push(trig);
    barrel.trigger = trig;
    return barrel;
  }

  blowBarrel(barrel) {
    const config = { ...BARREL, key: 'fuelBarrel', name: 'Fuel Barrel', kind: 'frag', selfDamage: 0.6 };
    this.scene.weapons?.explode(barrel.x, barrel.y - 16, config);
  }

  // ---- Sky Islands: updrafts and wind ----

  makeUpdraft(o) {
    const z = { x: o.x, y: o.y, right: o.x + o.width, bottom: o.y + o.height };
    this.scene.add
      .particles(0, 0, 'hz-dot', {
        x: { min: o.x, max: o.x + o.width },
        y: o.y + o.height,
        lifespan: 2600,
        speedY: { min: -420, max: -260 },
        scale: { min: 0.1, max: 0.3 },
        alpha: { start: 0.6, end: 0 },
        tint: 0xffffff,
        frequency: 60,
      })
      .setDepth(36);
    this.scene.add.rectangle(o.x + o.width / 2, o.y + o.height / 2, o.width, o.height, 0xffffff, 0.06).setDepth(36);
    return z;
  }

  makeWind() {
    const scene = this.scene;
    this.wind = { level: 0, dir: 1, active: false, nextAt: scene.time.now + Phaser.Math.Between(...WIND.everyMs) * 0.4 };
    if (!scene.textures.exists('streak')) {
      const g = scene.add.graphics();
      g.lineStyle(2, 0xffffff, 1).lineBetween(0, 1, 40, 1);
      g.generateTexture('streak', 40, 3);
      g.destroy();
    }
    // Streaks blowing across the screen, one emitter per direction.
    this.wind.streaks = [1, -1].map((dir) =>
      scene.add
        .particles(0, 0, 'streak', {
          x: dir > 0 ? { min: -40, max: 600 } : { min: 680, max: 1320 },
          y: { min: 0, max: 720 },
          lifespan: 700,
          speedX: dir > 0 ? { min: 900, max: 1300 } : { min: -1300, max: -900 },
          alpha: { start: 0.5, end: 0 },
          frequency: 25,
          emitting: false,
        })
        .setScrollFactor(0)
        .setDepth(46)
    );
  }

  updateWind(now) {
    const w = this.wind;
    if (!w.active && now >= w.nextAt) {
      w.active = true;
      w.dir = Math.random() < 0.5 ? -1 : 1;
      w.startAt = now;
      w.until = now + WIND.lastMs;
      w.streaks[w.dir > 0 ? 0 : 1].start();
      this.scene.effects?.notice(`Strong wind from the ${w.dir > 0 ? 'west' : 'east'}!`);
    }
    if (w.active) {
      w.level = Math.max(0, Math.min(1, (now - w.startAt) / WIND.fadeMs, (w.until - now) / WIND.fadeMs));
      if (now >= w.until) {
        w.active = false;
        w.level = 0;
        w.streaks.forEach((e) => e.stop());
        w.nextAt = now + Phaser.Math.Between(...WIND.everyMs);
      }
      this.scene.sfx?.hold('gust', 'wind', null, 0.3 + w.level * 0.7);
    }
  }

    // ---- Sandstorm ----

  makeStorm() {
    const scene = this.scene;
    this.storm = { level: 0, nextAt: scene.time.now + Phaser.Math.Between(...SANDSTORM.everyMs) * 0.5, until: 0 };
    this.storm.veil = scene.add.rectangle(0, 0, 1280, 720, SANDSTORM.color, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(45);
    this.storm.dust = scene.add
      .particles(0, 0, 'hz-dot', {
        x: -20,
        y: { min: 0, max: 720 },
        lifespan: 1600,
        speedX: { min: 700, max: 1100 },
        speedY: { min: -40, max: 60 },
        scale: { min: 0.15, max: 0.5 },
        alpha: { start: 0.7, end: 0 },
        tint: [0xe9c46a, 0xd4a373, 0xb08968],
        frequency: 8,
        quantity: 3,
        emitting: false,
      })
      .setScrollFactor(0)
      .setDepth(46);
  }

  updateStorm(now) {
    const s = this.storm;
    const cfg = SANDSTORM;
    if (!s.active && now >= s.nextAt) {
      s.active = true;
      s.startAt = now;
      s.until = now + cfg.lastMs;
      s.dust.start();
      this.scene.effects?.notice('Sandstorm!  Nobody sees far');
    }
    if (s.active) {
      const t = Math.min(1, (now - s.startAt) / cfg.fadeMs, (s.until - now) / cfg.fadeMs);
      s.level = Math.max(0, t);
      if (now >= s.until) {
        s.active = false;
        s.level = 0;
        s.dust.stop();
        s.nextAt = now + Phaser.Math.Between(...cfg.everyMs);
      }
      this.scene.sfx?.hold('storm', 'wind', null, 0.3 + s.level * 0.7);
    }
    s.veil.setAlpha(cfg.alpha * s.level);
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
          d.setPosition(x0 + vx * t, pool.y + vy * t + 450 * power * gravityK(this.scene) * t * t).setAlpha(1 - tw.getValue() * 0.7);
        },
        onComplete: () => d.destroy(),
      });
    }
  }

  // A blast near (above) a surface whips up spray.
  surfaceSplash(x, y, radius) {
    for (const p of [...this.waters, ...this.lavas, ...this.toxics, ...this.sands]) {
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

  // A blast in toxic sludge: muffled, a green column, and a puff of
  // poison gas drifting up off it.
  sludgeBlast(x, y, radius, pool) {
    const scene = this.scene;
    const sx = Phaser.Math.Clamp(x, pool.x + 8, pool.right - 8);
    this.splash(pool, sx, pool.cfg.surfaceColor, 18, 1.8);
    this.splash(pool, sx, pool.cfg.color, 12, 1.2);
    for (let i = 0; i < 8; i++) {
      const c = scene.add.circle(sx + Phaser.Math.Between(-30, 30), pool.y - 6, Phaser.Math.Between(10, 18), RADIATION.color, 0.25).setDepth(DEPTH_WATER + 2);
      scene.tweens.add({ targets: c, y: c.y - Phaser.Math.Between(40, 90), x: c.x + Phaser.Math.Between(-20, 20), scale: 2.2, alpha: 0, duration: Phaser.Math.Between(1200, 2000), onComplete: () => c.destroy() });
    }
    scene.cameras.main.shake(140, 0.004);
  }

  // A blast in quicksand: a dull thump and a fountain of sand.
  sandBlast(x, y, radius, pool) {
    const sx = Phaser.Math.Clamp(x, pool.x + 8, pool.right - 8);
    this.splash(pool, sx, pool.cfg.surfaceColor, 22, 1.6);
    this.splash(pool, sx, pool.cfg.color, 14, 1.1);
    this.scene.effects?.poof?.(sx, pool.y - 10, pool.cfg.surfaceColor);
    this.scene.cameras.main.shake(120, 0.004);
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
    if (!this.waters.length && !this.lavas.length && !this.toxics.length && !this.sands.length) return;
    const enter = (obj, x, y, size) => {
      const pool = this.poolAt(x, y);
      if (!pool) {
        obj.inPool = null;
        return null;
      }
      if (obj.inPool !== pool) {
        obj.inPool = pool;
        this.splash(pool, x, pool.cfg.surfaceColor, size);
        if (size >= 4) scene.sfx?.play(pool.kind === 'lava' ? 'lavaSizzle' : pool.kind === 'quicksand' ? 'sandSink' : 'splashSmall', { x, y }, { volume: size >= 6 ? 0.7 : 0.35 });
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
        else if (pool.kind === 'quicksand') this.scene.effects?.poof?.(g.x, pool.y - 6, pool.cfg.surfaceColor); // smothered
        else if (pool.kind === 'toxic') this.toxicFlare(g.x, pool); // the chemicals flare up
        else this.splash(pool, g.x, pool.cfg.glowColor, 8, 1.2);
        g.remove();
        continue;
      }
      // Water: they sink slowly. Toxic sludge is thicker; quicksand nearly
      // stops them and swallows them.
      const drag = pool.kind === 'quicksand' ? 0.6 : pool.kind === 'toxic' ? 0.8 : 0.9;
      const sink = pool.kind === 'quicksand' ? 22 : pool.kind === 'toxic' ? 40 : WATER.sinkSpeed;
      g.body.velocity.x *= drag;
      g.body.velocity.y = Math.min(g.body.velocity.y, sink);
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
      if (pool.kind !== 'water' && pool.kind !== 'toxic') b.destroy();
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
      it.body.velocity.x *= pool.kind === 'quicksand' ? 0.6 : 0.85;
      it.body.velocity.y = Math.min(it.body.velocity.y, pool.kind === 'quicksand' ? 22 : pool.kind === 'toxic' ? 40 : WATER.sinkSpeed);
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
      // Water only: cryo does nothing to lava.
      for (const p of this.waters) if (near(p)) this.freeze(p, Math.max(p.x, x - r), Math.min(p.right, x + r));
    } else if (config.effect === 'emp') {
      for (const p of [...this.waters, ...this.toxics]) { // sludge conducts too
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

  // An iceberg frozen out of the water from x0 to x1: rough cut edges, a
  // jagged top just above the surface and a deep, tapering chunk under it.
  // You can stand on it; anyone caught in it is frozen and anyone under it
  // is trapped until it cracks and breaks.
  freeze(p, x0, x1) {
    if (x1 - x0 < 24 || p.kind !== 'water') return;
    const scene = this.scene;
    const cfg = FREEZE;
    const cx = (x0 + x1) / 2;
    const w = x1 - x0;
    const top = p.y - cfg.aboveSurface;
    const deep = Math.min(cfg.depth, p.bottom - p.y - 4);

    // The solid part: a slab from just above the surface down into the water.
    const slab = scene.add.rectangle(cx, top + cfg.bodyHeight / 2, w, cfg.bodyHeight, 0xffffff, 0);
    scene.physics.add.existing(slab, true);
    this.slabGroup.add(slab);
    if (!this.slabCollider) {
      this.slabCollider = scene.physics.add.collider([scene.player, ...(scene.bots ?? [])], this.slabGroup);
    }

    // The look: one jagged outline (top edge, a rough side, a tapering
    // bottom, the other side), lighter above the water, glints on top.
    const pts = [];
    const steps = Math.max(4, Math.round(w / 22));
    for (let i = 0; i <= steps; i++) pts.push({ x: x0 + (w * i) / steps, y: top - Phaser.Math.Between(0, cfg.peak) });
    pts.push({ x: x1 + Phaser.Math.Between(2, 8), y: p.y + Phaser.Math.Between(4, 12) });
    const bottom = [];
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const taper = 1 - Math.pow(Math.abs(t - 0.5) * 2, 1.6); // deepest in the middle
      bottom.push({ x: x0 + w * (0.08 + 0.84 * t) + Phaser.Math.Between(-6, 6), y: p.y + 10 + deep * taper * Phaser.Math.FloatBetween(0.75, 1) });
    }
    pts.push(...bottom, { x: x0 - Phaser.Math.Between(2, 8), y: p.y + Phaser.Math.Between(4, 12) });

    const gfx = scene.add.graphics().setDepth(DEPTH_WATER + 2);
    gfx.fillStyle(cfg.iceColor, 0.95);
    gfx.fillPoints(pts, true);
    gfx.fillStyle(cfg.deepIceColor, 0.45); // the part under water, bluer
    gfx.fillPoints([{ x: x0 - 8, y: p.y + 6 }, { x: x1 + 8, y: p.y + 6 }, ...bottom], true);
    gfx.lineStyle(2, 0xffffff, 0.9);
    gfx.strokePoints(pts, true);
    gfx.lineStyle(2, 0xffffff, 0.7); // glints along the top
    for (let i = 0; i < steps; i += 2) gfx.lineBetween(pts[i].x + 3, pts[i].y + 3, pts[i + 1].x - 3, pts[i + 1].y + 3);

    const marks = scene.add.graphics().setDepth(DEPTH_WATER + 3);
    this.slabs.push({ slab, gfx, marks, until: scene.time.now + cfg.ms, x0, x1, y: top, pool: p, cracked: false });
    scene.sfx?.play('iceForm', { x: cx, y: p.y });
    for (const c of this.characters()) {
      if (c.alive && c.x > x0 && c.x < x1 && touches(p, c.body)) scene.weapons?.status.apply(c, 'frozen', 'player');
    }
  }

  updateSlabs(now) {
    for (const s of this.slabs) {
      const left = s.until - now;
      if (left <= 1500 && !s.cracked) {
        s.cracked = true;
        s.marks.lineStyle(2, 0x48cae4, 0.9);
        for (let x = s.x0 + 14; x < s.x1 - 14; x += Phaser.Math.Between(18, 34)) {
          let y = s.y + 2;
          let cx = x;
          s.marks.beginPath();
          s.marks.moveTo(cx, y);
          for (let k = 0; k < 4; k++) {
            cx += Phaser.Math.Between(-7, 7);
            y += Phaser.Math.Between(6, 12);
            s.marks.lineTo(cx, y);
          }
          s.marks.strokePath();
        }
        this.scene.sfx?.play('iceCrack', s.slab, { volume: 0.6 });
      }
      if (s.cracked) s.gfx.setAlpha(0.65 + Math.sin(now / 60) * 0.25);
      if (left <= 0) this.breakSlab(s);
    }
    this.slabs = this.slabs.filter((s) => s.slab.active);
  }

  breakSlab(s) {
    for (let x = s.x0 + 6; x < s.x1; x += 12) this.splash(s.pool, x, FREEZE.iceColor, 2, 1.2);
    this.scene.sfx?.play('iceBreak', s.slab);
    s.gfx.destroy();
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
    if (!p?.alive || (!p.underSomething && !p.melting)) return;
    const share = p.melting
      ? Math.max(0, 1 - (p.hazard.heat ?? 0) / LAVA.holdMs)
      : Math.max(0, p.hazard.breath / (p.hazard.breathMax ?? WATER.breathMs));
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
    if (kind === 'lava' || kind === 'toxic') {
      // A glow over lava (or toxic sludge), and bubbles popping on it.
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
      gravityY: 300 * gravityK(this.scene),
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
      tint: 0xadb5bd, // darkened white smoke
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
