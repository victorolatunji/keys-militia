import { BOTS } from '../data/enemies.js';

// Ground-bound types (they walk or leap, no jetpack): zombies, skeletons,
// mutants, Zombie K9s, Scrap Bots. They only fight on maps marked
// groundFighters (Graveyard, Wastelands, Catacombs): in open air and low
// gravity their movement falls apart.
export const GROUND_BOUND = (bot) => bot.movement === 'walker' || bot.movement === 'leaper';

// Can this enemy type fight on this map?
export function fitsMap(bot, map) {
  return !GROUND_BOUND(bot) || Boolean(map?.enemies?.groundFighters);
}

// How often a type comes on this map: its family's weight there
// (map.enemies.families, e.g. Space: scifi 6, military 1; families not
// listed, like machines and animals, count as 1), times walkerBoost for the
// walkers and leapers on the maps they belong to (so they outnumber the
// jetpack shooters there, who still come plenty).
export function typeWeight(bot, map) {
  const e = map?.enemies;
  const f = e?.families;
  const family = !f || Array.isArray(f) ? 1 : f[bot.family] ?? 1;
  return family * (GROUND_BOUND(bot) && e?.groundFighters ? e.walkerBoost ?? 1 : 1);
}

// A random item from list, weighted by weightOf.
function weighted(list, weightOf) {
  let roll = Math.random() * list.reduce((t, x) => t + weightOf(x), 0);
  for (const x of list) if ((roll -= weightOf(x)) <= 0) return x;
  return list[list.length - 1];
}

// A random BOTS key from keys (a wave's types): only types that fit the
// map (any of them if none fit), weighted by typeWeight. needShooter: none
// of the enemies out there has a jetpack, so bring one if the wave can.
export function pickForMap(keys, map, needShooter = false) {
  let fit = keys.filter((k) => fitsMap(BOTS[k], map));
  if (!fit.length) fit = keys;
  const shooters = fit.filter((k) => !GROUND_BOUND(BOTS[k]));
  if (needShooter && shooters.length) fit = shooters;
  return weighted(fit, (k) => typeWeight(BOTS[k], map));
}

// Decides which enemy types appear. The map lists slots (how many 'main',
// 'machine' and 'animal' enemies at once) and how often each family comes
// (weights). Each slot holds one Bot; when it dies, the slot gets a new type
// for its role, picked by typeWeight from the types that fit the map.
// Jetpack shooters are the heart of the game, so a main slot always brings
// one when no other main enemy out there is one. A role with nothing that
// fits the map (animals on open maps: the K9 is ground-bound) gives its
// slots to main instead, so no map has fewer enemies.
export default class EnemySpawner {
  constructor(scene, settings) {
    this.scene = scene;
    this.slots = settings?.slots ?? { main: 2 };
    const f = settings?.families ?? ['military'];
    this.weights = Array.isArray(f) ? Object.fromEntries(f.map((k) => [k, 1])) : f;
    this.allowed = settings?.allowed ?? null; // a mode can limit the types (BOTS keys)
  }

  // The map's main family (debug readout).
  get family() {
    return Object.entries(this.weights).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
  }

  // One entry per slot to fill at the start: ['main', 'main', 'machine', ...].
  startingSlots() {
    const list = [];
    let spare = 0;
    for (const [role, count] of Object.entries(this.slots)) {
      if (!this.types(role).length) {
        spare += count;
        continue;
      }
      for (let i = 0; i < count; i++) list.push(role);
    }
    if (spare && this.types('main').length) for (let i = 0; i < spare; i++) list.push('main');
    return list;
  }

  // The BOTS entries for this role that fit the map (and the mode).
  types(role) {
    const map = this.scene.map;
    return Object.entries(BOTS)
      .filter(([key, b]) => b.role === role && fitsMap(b, map) && (!this.allowed || this.allowed.includes(key)))
      .map(([, b]) => b);
  }

  // A BOTS entry for this role, or null if none exist.
  pick(role) {
    let all = this.types(role);
    if (all.length === 0) return null;
    if (role === 'main') {
      const shooters = all.filter((b) => !GROUND_BOUND(b));
      const out = (this.scene.bots ?? []).filter((b) => b.alive && b.slot === 'main' && !GROUND_BOUND(b.config));
      if (shooters.length && out.length === 0) all = shooters; // keep a jetpack shooter out there
    }
    return weighted(all, (b) => typeWeight(b, this.scene.map));
  }

  update() {}
}
