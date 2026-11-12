import { gunKey, meleeKey, throwKey, partKey } from '../entities/CharacterRig.js';
import { WEAPONS, THROWABLES } from '../data/weapons.js';
import { ITEMS } from '../data/items.js';
import { DEATH_DROPS } from '../data/airdrops.js';
import { WEAPON_LENGTH, MELEE_LENGTH } from '../data/rigs.js';

// The art for things you can pick up (packed by tools/pack-sprites.py):
// guns, melee and throwables use their held sprites; gear (Armor Vest,
// Health Pack, Jet Boost, Riot Shield) its utility art; crates and
// parachutes the drops art.
export const utilKey = (key) => `spr-util-${key}`;
export const dropKey = (key) => `spr-drop-${key}`;

const GEAR = ['boost', 'shield', 'health', 'armor'];

// Texture key for a loose item ({ type, key }), or null if it has no art.
export function itemArtKey(scene, item) {
  let key = null;
  if (GEAR.includes(item.type)) key = utilKey(item.key);
  else if (item.type === 'throwable') key = throwKey(item.key);
  else if (WEAPONS[item.key]) key = WEAPONS[item.key].category === 'melee' ? meleeKey(item.key) : gunKey(item.key);
  return key && scene.textures.exists(key) ? key : null;
}

// Its name for the tag under it.
export function itemName(item) {
  if (GEAR.includes(item.type)) return ITEMS[item.key]?.name ?? item.key;
  if (item.type === 'throwable') return THROWABLES[item.key]?.name ?? item.key;
  return WEAPONS[item.key]?.name ?? item.key;
}

// Glow color by what it is: guns gold, gear by kind, throwables orange.
export function itemGlow(item) {
  return { health: 0x80ed99, armor: 0x4cc9f0, shield: 0x4cc9f0, boost: 0x90e0ef, throwable: 0xff9f1c }[item.type] ??
    (WEAPONS[item.key]?.category === 'special' || WEAPONS[item.key]?.category === 'launcher' ? 0xff4d6d : 0xffd166);
}

// How big it's drawn lying on the ground (px across its longest side):
// guns and melee by their real length (WEAPON_LENGTH / MELEE_LENGTH in
// rigs.js), squeezed into DEATH_DROPS.art's min..max so every gun is easy
// to see but a pistol is never bigger than a rifle; throwables and gear small.
export function itemSize(item) {
  const A = DEATH_DROPS.art;
  if (GEAR.includes(item.type)) return A.gear;
  if (item.type === 'throwable') return A.throwable;
  const w = WEAPONS[item.key];
  if (!w) return A.gear;
  if (w.category === 'melee') {
    const len = MELEE_LENGTH[item.key] ?? 0.45;
    return A.melee.min + ((len - 0.26) / (0.66 - 0.26)) * (A.melee.max - A.melee.min);
  }
  const len = WEAPON_LENGTH[w.category] ?? 0.5;
  return A.gun.min + ((len - 0.3) / (0.66 - 0.3)) * (A.gun.max - A.gun.min);
}

// A character's head as a small picture (end screens, lists): the head part
// of its sprite folder (the drone has no head: its body), fitted into size px.
export function headIcon(scene, folder, x, y, size) {
  if (!folder) return null;
  const key = [partKey(folder, 'head'), partKey(folder, 'body')].find((k) => scene.textures.exists(k));
  if (!key) return null;
  const img = scene.add.image(x, y, key);
  img.setScale(size / Math.max(img.width, img.height));
  return img;
}
