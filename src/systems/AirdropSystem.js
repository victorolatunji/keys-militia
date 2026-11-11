import Phaser from 'phaser';
import Crate from '../entities/Crate.js';
import Pickup from '../entities/Pickup.js';
import { AIRDROPS, CRATE_CONTENTS, DEATH_DROPS, SUPPLY_DROPS } from '../data/airdrops.js';
import { WEAPONS } from '../data/weapons.js';

// Drops a crate on a timer, above a spot that has ground under it (it holds
// a choice of guns, one per family, and 2 can be taken),
// drops loose items in two lanes (supply drops: throwables in one; health,
// armor, Jet Boost, Riot Shield, pistols and rarely specials/launchers in
// the other), each with its own timer and cap,
// and spills loose pickups when someone dies (death drops).
// PickupSystem handles the 1/2/3/4 panel for all of them.
// Melee weapons only come with your spawn (random each time); they never
// drop on their own: not in crates, supply drops or when anyone dies.
function isMelee(item) {
  if (item.type === 'melee') return true;
  return item.type === 'gun' && WEAPONS[item.key]?.category === 'melee';
}

export default class AirdropSystem {
  constructor(scene, groundLayer, worldSize, collisions) {
    this.scene = scene;
    this.collisions = collisions;
    this.groundLayer = groundLayer;
    this.width = worldSize.width;
    this.height = worldSize.height;

    this.crates = [];
    this.drops = [];    // loose death-drop pickups
    this.supplies = []; // loose supply drops (both lanes)
    this.dropped = 0;
    this.supplied = 0;
    this.nextDropAt = scene.time.now + AIRDROPS.firstDropMs;

    // One timer per supply lane (see SUPPLY_DROPS.lanes).
    this.lanes = Object.entries(SUPPLY_DROPS.lanes).map(([name, config]) => ({
      name,
      config,
      nextAt: scene.time.now + config.firstDropMs,
    }));
    this.lastRareAt = scene.time.now; // last special or launcher drop
  }

  // Pause or move every supply lane's timer at once (tests, debug).
  set nextSupplyAt(time) {
    for (const lane of this.lanes) lane.nextAt = time;
  }

  get nextSupplyAt() {
    return Math.min(...this.lanes.map((l) => l.nextAt));
  }

  // Everything the pickup panel can open: crates, death drops and supply drops.
  get pickupables() {
    return [...this.crates, ...this.drops, ...this.supplies];
  }

  // ms until the next supply drop (for testing and the debug readout).
  get timeToNextSupply() {
    return Math.max(0, this.nextSupplyAt - this.scene.time.now);
  }

  // ms until the next drop (for the debug readout).
  get timeToNextDrop() {
    return Math.max(0, this.nextDropAt - this.scene.time.now);
  }

  update(delta) {
    const now = this.scene.time.now;

    this.crates = this.crates.filter((c) => c.active);
    for (const crate of this.crates) crate.update(delta);

    this.drops = this.drops.filter((d) => d.active);
    for (const drop of this.drops) drop.update(delta);

    this.supplies = this.supplies.filter((s) => s.active);
    for (const supply of this.supplies) supply.update(delta);
    this.unbury();

    if (this.paused) return; // Training: no drops on a timer
    if (now >= this.nextDropAt) {
      if (this.crates.length < AIRDROPS.maxCrates) this.drop();
      this.nextDropAt = now + AIRDROPS.intervalMs;
    }

    for (const lane of this.lanes) {
      if (now < lane.nextAt) continue;
      lane.nextAt = now + this.laneInterval(lane);
      const onMap = this.supplies.filter((s) => s.lane === lane.name).length;
      const loose = this.supplies.length + this.drops.length;
      if (onMap < lane.config.maxOnMap && loose < SUPPLY_DROPS.maxLoose) this.dropSupply(lane);
    }
  }

  // An item lying under a landed crate (it dropped there after the crate
  // picked its spot, e.g. a death drop) is pushed out to the crate's side,
  // whichever side has ground, so you can still reach it.
  unbury() {
    for (const crate of this.crates) {
      if (crate.state !== 'settled') continue;
      const box = crate.getBounds();
      for (const item of [...this.drops, ...this.supplies]) {
        if (!item.active || !box.contains(item.x, item.y)) continue;
        const out = box.width / 2 + 18;
        const sides = item.x < crate.x ? [-1, 1] : [1, -1];
        const side = sides.find((d) => this.flatLanding(crate.x + d * out) !== null) ?? sides[0];
        item.body.reset(crate.x + side * out, box.top - 10);
      }
    }
  }

  // Throwables come faster while you have none at all.
  laneInterval(lane) {
    const c = lane.config;
    const slots = this.scene.weapons?.throwSlots;
    const empty = slots && slots.every((t) => !t.config || t.count <= 0);
    return c.hungryIntervalMs && empty ? c.hungryIntervalMs : c.intervalMs;
  }

  drop() {
    const { x, y } = this.dropPoint();
    const crate = new Crate(
      this.scene,
      x,
      y,
      this.crateItem(),
      this.groundLayer,
      this.height
    );

    this.collisions.addCrate(crate);
    this.crates.push(crate);
    this.dropped += 1;
  }

  // A crate straight down at x (Training's airdrop lesson).
  dropAt(x, item = this.crateItem()) {
    const crate = new Crate(this.scene, x, AIRDROPS.spawnY, item, this.groundLayer, this.height);
    this.collisions.addCrate(crate);
    this.crates.push(crate);
    return crate;
  }

  // A loose item falls from the top of the map, spinning (random by weight).
  dropSupply(lane = this.lanes[0]) {
    const item = this.supplyItem(lane);

    if (isMelee(item)) return; // melee only comes with your spawn, never loose
    const at = this.dropPoint();
    const supply = new Pickup(
      this.scene,
      at.x,
      at.y,
      item,
      this.groundLayer,
      this.height,
      {
        lifetimeMs: lane.config.lifetimeMs,
        velocity: { x: 0, y: 0 },
        maxFallSpeed: SUPPLY_DROPS.fallSpeed,
        spin: SUPPLY_DROPS.spin,
      }
    );

    supply.lane = lane.name;
    this.supplies.push(supply);
    this.supplied += 1;
  }

  // Spill items at a spot (a death). items: [{ type, key, count? }]
  dropItems(x, y, items) {
    for (const item of items.filter((i) => !isMelee(i))) {
      this.drops.push(new Pickup(this.scene, x, y, item, this.groundLayer, this.height));
    }

    // Too many on the map: the oldest go first.
    while (this.drops.length > DEATH_DROPS.maxOnMap) {
      this.drops.shift().remove();
    }
  }

  // Random x with a solid tile somewhere below it, so most crates land.
  // Where a drop starts: above the map, or (enclosed maps, like the
  // Catacombs) just under the roof of a random tunnel with a floor below.
  dropPoint() {
    if (!this.scene.map?.enclosed) return { x: this.findDropX(), y: AIRDROPS.spawnY };
    const layer = this.groundLayer;
    const th = layer.tilemap.tileHeight;
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(AIRDROPS.edgeMarginPx, this.width - AIRDROPS.edgeMarginPx);
      if (i < 30 && !this.clearOfOthers(x)) continue;
      const open = [];
      for (let y = th; y < this.height - th; y += th) {
        const here = layer.getTileAtWorldXY(x, y)?.collides;
        const above = layer.getTileAtWorldXY(x, y - th)?.collides;
        if (!here && above && !layer.unsafeAt?.(x, y)) open.push(y + th / 2);
      }
      if (open.length) return { x, y: Phaser.Utils.Array.GetRandom(open) };
    }
    return { x: this.findDropX(), y: AIRDROPS.spawnY };
  }

  // Where a crate drops: over ground. About a third of the time it aims for
  // the lower levels instead, falling through a gap or hole in the floors
  // above, so every level gets crates, not just the top one.
  // A spot is only used if the crate lands flat (solid under both sides,
  // so it can't tip off into the void) and clear of other crates and items
  // (so two never stack and none buries a pickup).
  findDropX() {
    const min = AIRDROPS.edgeMarginPx;
    const max = this.width - AIRDROPS.edgeMarginPx;
    const wantLow = Math.random() < AIRDROPS.lowShare;

    for (let pass = wantLow ? 0 : 1; pass < 3; pass++) {
      for (let i = 0; i < AIRDROPS.tries * 3; i++) {
        const x = Phaser.Math.Between(min, max);
        const land = this.flatLanding(x);
        if (land === null) continue;
        if (pass === 0 && land < this.height * 0.55) continue; // lands up top: try again for a low one
        if (pass < 2 && !this.clearOfOthers(x)) continue;     // last pass: anywhere safe will do
        return x;
      }
    }
    // Still nothing (a crowded map): walk the map for the first safe spot.
    for (let x = min; x <= max; x += 16) if (this.flatLanding(x) !== null && this.clearOfOthers(x)) return x;
    for (let x = min; x <= max; x += 16) if (this.flatLanding(x) !== null) return x;
    return Phaser.Math.Between(min, max);
  }

  // Lands at the same height under the crate's middle and both its sides.
  flatLanding(x) {
    const y = this.landingY(x);
    if (y === null) return null;
    const f = AIRDROPS.footPx;
    return this.landingY(x - f) === y && this.landingY(x + f) === y ? y : null;
  }

  // Far enough sideways from every crate and every item lying on the map.
  clearOfOthers(x) {
    const near = (o) => o.active && Math.abs(o.x - x) < AIRDROPS.clearPx;
    if (this.crates.some(near) || this.supplies.some(near) || this.drops.some(near)) return false;
    return !this.scene.children.list.some((o) => o instanceof Pickup && near(o));
  }

  // The top of the first solid ground straight below the top of the map at
  // x, or null (open to the void, or water / lava first).
  landingY(x) {
    const tileSize = this.groundLayer.tilemap.tileHeight;
    for (let y = 0; y < this.height; y += tileSize) {
      if (this.groundLayer.unsafeAt?.(x, y)) return null;
      const tile = this.groundLayer.getTileAtWorldXY(x, y);
      if (tile && tile.collides) return y;
    }
    return null;
  }

  hasGroundBelow(x) {
    const tileSize = this.groundLayer.tilemap.tileHeight;
    for (let y = 0; y < this.height; y += tileSize) {
      if (this.groundLayer.unsafeAt?.(x, y)) return false; // not into water or lava
      const tile = this.groundLayer.getTileAtWorldXY(x, y);
      if (tile && tile.collides) return true;
    }
    return false;
  }

  // A crate: one random gun from each family, keys 1-6 in this order.
  crateItem() {
    return {
      type: 'crate',
      options: CRATE_CONTENTS.families.filter((f) => f !== 'melee').map((family) => this.randomGun(family)),
      picksLeft: CRATE_CONTENTS.picks,
    };
  }

  // A supply drop: weighted random entry; guns pick a random model.
  // Pick a lane's item by weight. Items lane: more health packs while
  // you're hurt, and a guaranteed special/launcher when none fell for a while.
  supplyItem(lane) {
    const c = lane.config;
    const now = this.scene.time.now;
    const rare = SUPPLY_DROPS.rare;
    const rareEntry = (e) => e.type === 'gun' && rare.categories.includes(e.category);
    let pool = c.pool;

    if (pool.some(rareEntry) && now - this.lastRareAt >= rare.guaranteeMs * (1 - 0.5 * (this.difficulty ?? 0))) {
      const category = Math.random() < rare.specialShare ? 'special' : 'launcher';
      this.lastRareAt = now;
      return { type: 'gun', key: this.randomGun(category) };
    }

    const player = this.scene.player;
    if (c.hurt && player && player.hp / player.stats.maxHp < c.hurt.below) {
      pool = pool.map((e) => (e.type === 'health' ? { ...e, weight: e.weight * c.hurt.healthWeightScale } : e));
    }

    // Harder stages (a mode's difficulty ramp): more specials and helpful
    // gear, fewer weak guns (they still turn up now and then).
    const d = this.difficulty ?? 0;
    if (d > 0) {
      const helpful = new Set(['health', 'boost', 'armor', 'shield']);
      const tactical = new Set(['flashbang', 'concussion', 'emp', 'cryo', 'gas', 'smoke']);
      pool = pool.map((e) => {
        let k = 1;
        if (rareEntry(e) || helpful.has(e.type) || tactical.has(e.key)) k = 1 + 1.5 * d;
        else if (e.type === 'gun' && e.category === 'pistol') k = 1 - 0.6 * d;
        return { ...e, weight: e.weight * k };
      });
    }

    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    let entry = pool[0];
    for (const e of pool) {
      roll -= e.weight;
      if (roll < 0) {
        entry = e;
        break;
      }
    }

    if (rareEntry(entry)) this.lastRareAt = now;
    if (entry.type === 'gun') return { type: 'gun', key: this.randomGun(entry.category) };
    const { weight, ...item } = entry;
    return { ...item };
  }

  // Random WEAPONS key of one family.
  randomGun(category) {
    const keys = Object.values(WEAPONS)
      .filter((w) => w.category === category)
      .map((w) => w.key);
    return Phaser.Utils.Array.GetRandom(keys);
  }
}
