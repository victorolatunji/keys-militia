import Phaser from 'phaser';
import Crate from '../entities/Crate.js';
import Pickup from '../entities/Pickup.js';
import { AIRDROPS, AIRDROP_POOL, DEATH_DROPS, SUPPLY_DROPS } from '../data/airdrops.js';

// Drops a crate on a timer, above a spot that has ground under it,
// drops loose throwables on a second timer (supply drops),
// and spills loose pickups when someone dies (death drops).
// PickupSystem handles the 1/2/3/4 panel for all of them.
export default class AirdropSystem {
  constructor(scene, groundLayer, worldSize, collisions) {
    this.scene = scene;
    this.collisions = collisions;
    this.groundLayer = groundLayer;
    this.width = worldSize.width;
    this.height = worldSize.height;

    this.crates = [];
    this.drops = [];    // loose death-drop pickups
    this.supplies = []; // loose supply-drop throwables
    this.dropped = 0;
    this.supplied = 0;
    this.nextDropAt = scene.time.now + AIRDROPS.firstDropMs;
    this.nextSupplyAt = scene.time.now + SUPPLY_DROPS.firstDropMs;
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

    if (now >= this.nextDropAt) {
      if (this.crates.length < AIRDROPS.maxCrates) this.drop();
      this.nextDropAt = now + AIRDROPS.intervalMs;
    }

    if (now >= this.nextSupplyAt) {
      if (this.supplies.length < SUPPLY_DROPS.maxOnMap) this.dropSupply();
      this.nextSupplyAt = now + SUPPLY_DROPS.intervalMs;
    }
  }

  drop() {
    const x = this.findDropX();
    const crate = new Crate(
      this.scene,
      x,
      AIRDROPS.spawnY,
      this.pickItem(),
      this.groundLayer,
      this.height
    );

    this.collisions.addCrate(crate);
    this.crates.push(crate);
    this.dropped += 1;
  }

  // A loose throwable falls from the top of the map, spinning.
  // Items take turns, in the order of SUPPLY_DROPS.rotation.
  dropSupply() {
    const { rotation } = SUPPLY_DROPS;
    const item = { ...rotation[this.supplied % rotation.length] };

    const supply = new Pickup(
      this.scene,
      this.findDropX(),
      AIRDROPS.spawnY,
      item,
      this.groundLayer,
      this.height,
      {
        lifetimeMs: SUPPLY_DROPS.lifetimeMs,
        velocity: { x: 0, y: 0 },
        maxFallSpeed: SUPPLY_DROPS.fallSpeed,
        spin: SUPPLY_DROPS.spin,
      }
    );

    this.supplies.push(supply);
    this.supplied += 1;
  }

  // Spill items at a spot (a death). items: [{ type, key, count? }]
  dropItems(x, y, items) {
    for (const item of items) {
      this.drops.push(new Pickup(this.scene, x, y, item, this.groundLayer, this.height));
    }

    // Too many on the map: the oldest go first.
    while (this.drops.length > DEATH_DROPS.maxOnMap) {
      this.drops.shift().remove();
    }
  }

  // Random x with a solid tile somewhere below it, so most crates land.
  findDropX() {
    const min = AIRDROPS.edgeMarginPx;
    const max = this.width - AIRDROPS.edgeMarginPx;
    let x = Phaser.Math.Between(min, max);

    for (let i = 0; i < AIRDROPS.tries; i++) {
      x = Phaser.Math.Between(min, max);
      if (this.hasGroundBelow(x)) return x;
    }

    return x; // no luck: this one may fall into the void
  }

  hasGroundBelow(x) {
    const tileSize = this.groundLayer.tilemap.tileHeight;
    for (let y = 0; y < this.height; y += tileSize) {
      const tile = this.groundLayer.getTileAtWorldXY(x, y);
      if (tile && tile.collides) return true;
    }
    return false;
  }

  // Weighted random pick from the pool.
  pickItem() {
    const total = AIRDROP_POOL.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;

    for (const entry of AIRDROP_POOL) {
      roll -= entry.weight;
      if (roll < 0) return { ...entry };
    }
    return { ...AIRDROP_POOL[0] };
  }
}