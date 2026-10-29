import Phaser from 'phaser';
import { BOTS, SPAWNER } from '../data/enemies.js';

// Decides which enemy types appear. The map lists slots (how many 'main',
// 'machine' and 'animal' enemies at once) and the families the main slots
// rotate through. Each slot holds one Bot; when it dies, the slot gets a new
// random type for that role (main slots: from the current family).
export default class EnemySpawner {
  constructor(scene, settings) {
    this.scene = scene;
    this.slots = settings?.slots ?? { main: 2 };
    this.families = settings?.families ?? ['military'];
    this.familyIndex = 0;
    this.nextFamilyAt = scene.time.now + SPAWNER.familyEveryMs;
  }

  get family() {
    return this.families[this.familyIndex % this.families.length];
  }

  // One entry per slot to fill at the start: ['main', 'main', 'machine', ...].
  // Roles with no types yet (animals until step 4b) are skipped.
  startingSlots() {
    const list = [];
    for (const [role, count] of Object.entries(this.slots)) {
      if (!this.pick(role)) continue;
      for (let i = 0; i < count; i++) list.push(role);
    }
    return list;
  }

  // A random BOTS entry for this role (main: from the current family,
  // or any main type if that family has none yet). null = none exist.
  pick(role) {
    const all = Object.values(BOTS).filter((b) => b.role === role);
    if (all.length === 0) return null;
    const family = role === 'main' ? all.filter((b) => b.family === this.family) : all;
    return Phaser.Utils.Array.GetRandom(family.length ? family : all);
  }

  // The main family changes every familyEveryMs (enemies already out stay
  // until they die; their replacements come from the new family).
  update() {
    const now = this.scene.time.now;
    if (now < this.nextFamilyAt) return;
    this.familyIndex += 1;
    this.nextFamilyAt = now + SPAWNER.familyEveryMs;
  }
}