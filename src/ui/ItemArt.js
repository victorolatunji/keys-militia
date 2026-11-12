import { gunKey, meleeKey, throwKey } from '../entities/CharacterRig.js';
import { WEAPONS, THROWABLES } from '../data/weapons.js';
import { ITEMS } from '../data/items.js';

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
