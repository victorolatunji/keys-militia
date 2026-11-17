import Phaser from 'phaser';
import { AUDIO_FILES, MUSIC_TRACKS, musicKeys } from '../data/audio.js';
import { Music } from '../systems/Music.js';
import { SPRITES } from '../data/spriteManifest.js';
import { partKey, gunKey, meleeKey } from '../entities/CharacterRig.js';
import { projKey, fxKey } from '../systems/ShotFx.js';
import { dropKey, utilKey } from '../ui/ItemArt.js';
import { MAPS, MAP_SELECT } from '../data/maps.js';
import { MODES, MODE_SELECT } from '../data/modes.js';
import { PARTNER } from '../data/partner.js';
import { createIconTextures } from '../ui/Icons.js';
import { TITLE } from '../data/menu.js';
import { makeButton } from '../ui/Button.js';

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

// The title screen, which is also the loader: an in-game action shot
// (jetpacks, an airdrop, a fight) under the KEYS MILITIA logo, a progress
// bar while the game loads, then PRESS ENTER (or a click) for the main menu.
// A testing address (?mode=, ?map=, ?partner=, ?character=) skips it and
// goes straight into a match.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // Only the title art first, so the screen can show while the rest loads.
  preload() {
    TITLE.scenes.forEach((src, i) => this.load.image(`title-scene-${i}`, src));
    this.load.image('logo', TITLE.logo);
    // The title music too, so it plays from the start of the loading screen.
    for (const { key, path } of musicKeys('title')) this.load.audio(key, path);
  }

  create() {
    const q = new URLSearchParams(window.location.search);
    this.testing = ['mode', 'map', 'partner', 'character'].some((k) => q.has(k));
    this.drawTitle();
    Music.play(this, 'title'); // (if the browser still blocks sound: from the first click or key)
    this.soundHint();
    this.queueAssets();
    // The bar shows the real progress, filling smoothly over at least
    // TITLE.minLoadMs so you can read it (the percentage counts up).
    this.real = 0;
    this.shown = 0;
    this.doneLoading = false;
    this.startedAt = this.time.now;
    this.load.on('progress', (v) => (this.real = v));
    this.load.once('complete', () => {
      this.real = 1;
      this.doneLoading = true;
    });
    this.load.start();
  }

  // A slow push-in on the scene showing.
  drift(img) {
    if (!img) return;
    img.setScale(img.base);
    this.tweens.add({ targets: img, scale: img.base * 1.05, duration: 9000, ease: 'Sine.easeOut' });
  }

  // The next title scene, cross-faded in.
  switchScene() {
    if (this.scenes.length < 2) return;
    const from = this.scenes[this.sceneIndex];
    this.sceneIndex = (this.sceneIndex + 1) % this.scenes.length;
    const to = this.scenes[this.sceneIndex];
    this.children.moveAbove(to, from);
    to.setAlpha(0);
    this.drift(to);
    this.tweens.add({ targets: to, alpha: 1, duration: TITLE.fadeMs });
    this.tweens.add({ targets: from, alpha: 0, duration: TITLE.fadeMs, delay: TITLE.fadeMs * 0.6 });
  }

  update(time, delta) {
    if (time >= this.nextSwitchAt) {
      this.switchScene();
      this.nextSwitchAt = time + (this.finished ? TITLE.slowSwitchMs : TITLE.switchMs);
    }
    if (this.finished) return;
    const cap = Math.min(this.real, (time - this.startedAt) / TITLE.minLoadMs); // never faster than minLoadMs
    this.shown += (cap - this.shown) * Math.min(1, delta / 120);
    if (cap >= 1 && this.shown > 0.995) this.shown = 1;
    this.setProgress(this.shown);
    if (this.doneLoading && this.shown >= 1) {
      this.finished = true;
      this.loaded();
    }
  }

  drawTitle() {
    const { width: W, height: H } = this.scale;
    const T = TITLE;
    // The title scenes, one at a time, cross-fading (slow drift on each).
    this.scenes = TITLE.scenes.map((_, i) => `title-scene-${i}`).filter((k) => this.textures.exists(k)).map((k, i) => {
      const top = T.sceneAnchor === 'top';
      const bg = this.add.image(W / 2, top ? 0 : H / 2, k).setOrigin(0.5, top ? 0 : 0.5).setAlpha(i === 0 ? 1 : 0);
      bg.base = Math.max(W / bg.width, H / bg.height) * 1.04;
      bg.setScale(bg.base);
      return bg;
    });
    this.sceneIndex = 0;
    this.nextSwitchAt = this.time.now + TITLE.switchMs;
    this.drift(this.scenes[0]);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1114, T.darken);
    this.add.rectangle(W / 2, H - 90, W, 180, 0x0d1114, 0.5); // calmer band for the bar
    // A soft dark band at the top, so the logo and the line under it read on any scene.
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x0d1114, 0x0d1114, 0x0d1114, 0x0d1114, T.topShade.alpha, T.topShade.alpha, 0, 0);
    shade.fillRect(0, 0, W, T.topShade.height);
    if (this.textures.exists('logo')) {
      const logo = this.add.image(W / 2, T.logoY, 'logo');
      logo.setScale(T.logoWidth / logo.width);
    } else {
      this.add.text(W / 2, T.logoY, 'KEYS MILITIA', { fontFamily: T.font, fontSize: '72px', fontStyle: 'bold', color: T.gold, stroke: '#131112', strokeThickness: 10 }).setOrigin(0.5);
    }
    const L = T.tagline;
    const tag = this.add.text(W / 2, L.y, L.text, { fontFamily: L.font, fontSize: `${L.size}px`, fontStyle: 'bold', color: L.color, stroke: L.stroke, strokeThickness: L.strokeThickness }).setOrigin(0.5);
    tag.setLetterSpacing(L.spacing);
    tag.setShadow(0, 2, '#000000', 4, true, true);
    this.add.rectangle(W / 2, L.y, tag.width + 36, tag.height + 6, 0x0d1114, L.plate).setDepth(tag.depth - 1);
    this.children.bringToTop(tag);
    // The bar
    const bw = T.bar.width;
    const by = H - 110;
    this.add.rectangle(W / 2, by, bw + 8, T.bar.height + 8, 0x131112, 0.9).setStrokeStyle(2, 0x5c5a5f);
    this.barFill = this.add.rectangle(W / 2 - bw / 2, by, 1, T.bar.height, T.bar.fill).setOrigin(0, 0.5);
    this.barText = this.add.text(W / 2, by + 26, 'LOADING 0%', { fontFamily: T.font, fontSize: '16px', fontStyle: 'bold', color: T.teal }).setOrigin(0.5);
    this.add.text(W - 20, H - 14, 'VAO LABS', { fontFamily: T.font, fontSize: '14px', color: '#8a837b' }).setOrigin(1, 1);
  }

  // Browsers block sound until the page gets its first click or key press
  // (no game can skip that). While it's blocked, a small line over the bar
  // says so; any click or key unlocks it and the title music starts.
  soundHint() {
    if (!this.sound.locked) return;
    const { width: W, height: H } = this.scale;
    const hint = this.add.text(W / 2, H - 146, 'CLICK OR PRESS ANY KEY FOR SOUND', { fontFamily: TITLE.font, fontSize: '14px', fontStyle: 'bold', color: '#d9e6ee', stroke: '#0d1114', strokeThickness: 4 }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });
    this.sound.once('unlocked', () => hint.destroy());
  }

  setProgress(v) {
    this.barFill.width = Math.max(1, TITLE.bar.width * v);
    const pct = Math.round(v * 100);
    this.barText.setText(pct >= 100 ? 'READY · 100%' : `LOADING · ${pct}%`);
  }

  // Everything the game uses: character parts and weapons (packed by
  // tools/pack-sprites.py), the maps and their tilesets, the menu art.
  queueAssets() {
    const loadedTilesets = new Set();
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
    // Recorded sounds: voices, cries, buttons (src/data/audio.js), and the music once it's added.
    for (const [key, path] of Object.entries(AUDIO_FILES)) this.load.audio(key, path);
    for (const name of MUSIC_TRACKS) if (name !== 'title') for (const { key, path } of musicKeys(name)) this.load.audio(key, path); // (title: already loaded)
    for (const map of Object.values(MAPS)) {
      this.load.tilemapTiledJSON(map.tilemapKey, map.tilemapFile);
      // Maps can share a tileset; only load each image once.
      if (!loadedTilesets.has(map.tilesetKey)) {
        this.load.image(map.tilesetKey, map.tilesetFile);
        loadedTilesets.add(map.tilesetKey);
      }
    }
  }

  loaded() {
    createIconTextures(this); // item icons for crates, drops, the pickup panel and the HUD
    this.setProgress(1);
    if (this.testing) {
      // Straight into a match (testing addresses).
      const q = new URLSearchParams(window.location.search);
      this.scene.start('Game', { mapKey: startingMap(), modeKey: startingMode(), partnerKey: startingPartner(), characterKey: q.get('character') ?? 'player', skipIntro: q.get('intro') !== '1' });
      return;
    }
    const go = makeButton(this, this.scale.width / 2, this.scale.height - 44, 'PRESS ENTER', () => this.scene.start('Menu'), { key: 'ENTER', keyLabel: '', size: 22, color: TITLE.gold });
    this.tweens.add({ targets: go, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.input.once('pointerdown', () => go.run());
  }
}
