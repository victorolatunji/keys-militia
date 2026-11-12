import Phaser from 'phaser';
import { SPRITES } from '../data/spriteManifest.js';
import { partKey, gunKey, meleeKey } from '../entities/CharacterRig.js';
import { projKey, fxKey } from '../systems/ShotFx.js';
import { dropKey, utilKey } from '../ui/ItemArt.js';
import { MAPS, MAP_SELECT } from '../data/maps.js';
import { MODES, MODE_SELECT } from '../data/modes.js';
import { PARTNER } from '../data/partner.js';
import { createIconTextures } from '../ui/Icons.js';

// Which map to open: ?map=forest in the address, else the last one picked
// with F6, else the default.
function startingMap() {
  const fromUrl = new URLSearchParams(window.location.search).get('map');
  if (MAPS[fromUrl]) return fromUrl;
  let saved = null;
  try {
    saved = window.localStorage.getItem(MAP_SELECT.storageKey);
  } catch {
    // storage blocked
  }
  return MAPS[saved] ? saved : MAP_SELECT.default;
}

// Which mode: ?mode=military in the address, else the last one picked with F7.
function startingMode() {
  const fromUrl = new URLSearchParams(window.location.search).get('mode');
  if (MODES[fromUrl]) return fromUrl;
  let saved = null;
  try {
    saved = window.localStorage.getItem(MODE_SELECT.storageKey);
  } catch {
    // storage blocked
  }
  return MODES[saved] ? saved : MODE_SELECT.default;
}

// Your partner: ?partner=commando (or ?partner=none), else the last one picked with the ` key.
function startingPartner() {
  const fromUrl = new URLSearchParams(window.location.search).get('partner');
  if (fromUrl === 'none') return null;
  const allowed = (key) => PARTNER.select.order.includes(key); // removed picks (Drone, K9...) fall back to solo
  if (allowed(fromUrl)) return fromUrl;
  let saved = null;
  try {
    saved = window.localStorage.getItem(PARTNER.select.storageKey);
  } catch {
    // storage blocked
  }
  return allowed(saved) ? saved : null;
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const loadedTilesets = new Set();

    // Character parts and weapons (art pass), packed by tools/pack-sprites.py.
    for (const [folder, c] of Object.entries(SPRITES.characters)) {
      for (const part of Object.keys(c.parts)) this.load.image(partKey(folder, part), `assets/sprites/${folder}/${part}.png`);
    }
    for (const key of Object.keys(SPRITES.weapons)) this.load.image(gunKey(key), `assets/sprites/weapons/${key}.png`);
    for (const key of Object.keys(SPRITES.melee)) this.load.image(meleeKey(key), `assets/sprites/melee/${key}.png`);
    for (const key of Object.keys(SPRITES.throwables)) this.load.image(`spr-throw-${key}`, `assets/sprites/throwables/${key}.png`);
    for (const key of Object.keys(SPRITES.projectiles ?? {})) this.load.image(projKey(key), `assets/sprites/projectiles/${key}.png`);
    for (const key of Object.keys(SPRITES.effects ?? {})) this.load.image(fxKey(key), `assets/sprites/effects/${key}.png`);
    for (const key of Object.keys(SPRITES.drops ?? {})) this.load.image(dropKey(key), `assets/sprites/drops/${key}.png`);
    for (const key of Object.keys(SPRITES.utility ?? {})) this.load.image(utilKey(key), `assets/sprites/utility/${key}.png`);

    for (const map of Object.values(MAPS)) {
      this.load.tilemapTiledJSON(map.tilemapKey, map.tilemapFile);

      // Maps can share a tileset; only load each image once.
      if (!loadedTilesets.has(map.tilesetKey)) {
        this.load.image(map.tilesetKey, map.tilesetFile);
        loadedTilesets.add(map.tilesetKey);
      }
    }
  }

  create() {
    createIconTextures(this); // item icons for crates, drops, the pickup panel and the HUD
    // Straight into a match when the address says which (?mode=, ?map=,
    // ?partner=, ?character=: testing); otherwise the main menu.
    const q = new URLSearchParams(window.location.search);
    if (['mode', 'map', 'partner', 'character'].some((k) => q.has(k))) {
      this.scene.start('Game', { mapKey: startingMap(), modeKey: startingMode(), partnerKey: startingPartner(), characterKey: q.get('character') ?? 'player', skipIntro: q.get('intro') !== '1' });
    } else {
      this.scene.start('Menu');
    }
  }
}