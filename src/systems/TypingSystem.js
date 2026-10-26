import Phaser from 'phaser';
import { WORDS, WORD_REFRESH } from '../data/words.js';
import { PLAYER } from '../data/player.js';
import { pickWord } from './wordPicker.js';
import { hasLineOfSight } from './LineOfSight.js';

// Typing: words on targets you can see (unique first letters), word refresh,
// typing state, lock-on, firing and typos. The current gun picks word length.

const LETTER = /^[a-z]$/; // lowercase only, so Shift/Space/digits never count
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const EYE_OFFSET_Y = -8;  // line of sight starts a bit above the player's center

export default class TypingSystem {
  // options.onFire(target): a word was finished
  // options.getWordList(): key of the word list for the current gun
  constructor(scene, player, groundLayer, options) {
    this.scene = scene;
    this.player = player;
    this.groundLayer = groundLayer;
    this.onFire = options.onFire;
    this.getWordList = options.getWordList;

    this.isTyping = false;
    this.targets = [];
    this.lock = null;         // target we're typing at
    this.progress = 0;        // letters typed correctly on the locked word
    this.blockedUntil = 0;    // scene time when letters work again
    this.blockReason = null;  // 'jam' or 'switch'
    this.typos = 0;

    scene.input.keyboard.on('keydown', this.handleKey, this);

    // Clean up when the scene shuts down (restarts, menu, etc.).
    scene.events.once('shutdown', () => {
      scene.input.keyboard.off('keydown', this.handleKey, this);
    });
  }

  // 'jam', 'switch', or null when letters are accepted.
  get blockedReason() {
    return this.scene.time.now < this.blockedUntil ? this.blockReason : null;
  }

  block(ms, reason) {
    this.blockedUntil = this.scene.time.now + ms;
    this.blockReason = reason;
  }

  // ---- Targets and words ----

  // Words are handed out in update(), once the target is in sight.
  addTarget(target) {
    this.targets.push(target);
    target.on('died', () => this.onTargetDied(target));
  }

  assignWord(target) {
    const used = new Set(
      this.targets
        .filter((t) => t !== target && t.word)
        .map((t) => t.word[0])
    );
    const list = WORDS[this.getWordList()];
    target.setWord(pickWord(list, used, target.word ?? target.lastWord));
    target.wordExpiresAt =
      this.scene.time.now + Phaser.Math.Between(WORD_REFRESH.minMs, WORD_REFRESH.maxMs);
  }

  hideWord(target) {
    if (this.lock === target) this.clearLock(); // leaving sight breaks the lock
    target.setWord(null);
  }

  onTargetDied(target) {
    if (this.lock === target) this.clearLock();
  }

  // Gun switched: break the lock, pause letters, re-roll every visible word.
  onWeaponChanged(switchMs) {
    this.clearLock();
    this.block(switchMs, 'switch');
    for (const target of this.targets) {
      if (target.alive && target.word) this.assignWord(target);
    }
  }

  canSee(target) {
    if (!this.player.alive) return false;

    const view = this.scene.cameras.main.worldView;
    if (!view.contains(target.x, target.y)) return false; // off screen

    return hasLineOfSight(
      this.groundLayer,
      this.player.x,
      this.player.y + EYE_OFFSET_Y,
      target.x,
      target.y
    );
  }

  // Runs every frame: show, hide and refresh words.
  update() {
    const now = this.scene.time.now;

    for (const target of this.targets) {
      if (!target.alive) continue;

      if (!this.canSee(target)) {
        if (target.word) this.hideWord(target);
        continue;
      }

      if (!target.word) {
        this.assignWord(target); // entered sight: fresh word
      } else if (target !== this.lock && now >= target.wordExpiresAt) {
        this.assignWord(target); // timer refresh (never while locked)
      }
    }
  }

  // ---- Keyboard ----

  handleKey(event) {
    if (!this.player.alive) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (LETTER.test(event.key)) {
      if (this.player.aiming) return; // throwing: letters ignored
      this.setTyping(true);
      this.handleLetter(event.key);
      return;
    }

    // Only a fresh arrow press cancels typing, not a held arrow repeating.
    // The lock and progress stay saved while you move.
    if (ARROWS.has(event.key) && !event.repeat) {
      this.setTyping(false);
    }
  }

  handleLetter(letter) {
    if (this.blockedReason) return; // jammed or switching: letters ignored

    // No lock yet: the first letter picks the target.
    if (!this.lock) {
      const target = this.targets.find((t) => t.alive && t.word && t.word[0] === letter);
      if (!target) {
        this.typo(); // no word starts with this letter
        return;
      }

      this.lock = target;
      this.progress = 0;
      target.label.setLocked(true);
    }

    const word = this.lock.word;
    if (letter !== word[this.progress]) {
      this.typo();
      return;
    }

    this.progress += 1;
    this.lock.label.setProgress(this.progress);
    this.player.faceToward(this.lock.x);

    if (this.progress === word.length) this.fire();
  }

  fire() {
    const target = this.lock;
    this.clearLock();
    this.onFire(target);

    // Word chain: a surviving target gets a fresh word.
    if (target.alive) this.assignWord(target);
  }

  // Wrong letter: break the lock, shake the word, jam the gun.
  // The word itself stays, so you can retry it after the jam.
  typo() {
    const target = this.lock;
    this.clearLock();
    if (target) target.label.shake();

    this.block(PLAYER.typoJamMs, 'jam');
    this.typos += 1;
    this.player.jamPuff();
  }

  clearLock() {
    if (this.lock) {
      this.lock.label.setLocked(false);
      this.lock.label.setProgress(0);
    }
    this.lock = null;
    this.progress = 0;
  }

  // ---- State ----

  setTyping(on) {
    if (this.isTyping === on) return;
    this.isTyping = on;
    this.player.setTyping(on);
  }

  reset() {
    this.clearLock();
    this.blockedUntil = 0;
    this.setTyping(false);
  }
}