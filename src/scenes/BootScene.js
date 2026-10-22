import Phaser from 'phaser';
import { MAPS } from '../data/maps.js';

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
    this.scene.start('Game', { mapKey: 'test' });
  }
}