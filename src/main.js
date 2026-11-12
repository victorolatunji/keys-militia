import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import MenuScene from './scenes/MenuScene.js';
import LobbyScene from './scenes/LobbyScene.js';
import IntroScene from './scenes/IntroScene.js';
import ComicScene from './scenes/ComicScene.js';

const config = {
  type: Phaser.AUTO,          // WebGL if available, else Canvas
  parent: 'game',             // the <div id="game"> in index.html
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,   // scale to fit the window, keep 16:9
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },    // placeholder, tuned in Phase 1
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, LobbyScene, GameScene, IntroScene, ComicScene], // first in the list starts first
};

export default new Phaser.Game(config);