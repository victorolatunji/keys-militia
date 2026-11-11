import Phaser from 'phaser';
import { MAPS, MAP_SELECT } from '../data/maps.js';
import { MODES, MODE_SELECT } from '../data/modes.js';
import { PARTNER } from '../data/partner.js';
import { BOTS } from '../data/enemies.js';
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
  if (BOTS[fromUrl]) return fromUrl;
  let saved = null;
  try {
    saved = window.localStorage.getItem(PARTNER.select.storageKey);
  } catch {
    // storage blocked
  }
  return BOTS[saved] ? saved : null;
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const loadedTilesets = new Set();

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
    this.scene.start('Game', { mapKey: startingMap(), modeKey: startingMode(), partnerKey: startingPartner() });
  }
}