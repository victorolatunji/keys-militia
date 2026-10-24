import { WORDS } from '../data/words.js';
import { pickWord } from './wordPicker.js';

// Typing: words on targets (unique first letters), typing state, lock-on, firing.
// Step 3 adds typos, Step 4 line of sight and word refresh.

const LETTER = /^[a-z]$/; // lowercase only, so Shift/Space/digits never count
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export default class TypingSystem {
  constructor(scene, player, onFire) {
    this.player = player;
    this.onFire = onFire;   // called with the target when a word is finished
    this.isTyping = false;
    this.targets = [];
    this.lock = null;       // target we're typing at
    this.progress = 0;      // letters typed correctly on the locked word

    scene.input.keyboard.on('keydown', this.handleKey, this);

    // Clean up when the scene shuts down (restarts, menu, etc.).
    scene.events.once('shutdown', () => {
      scene.input.keyboard.off('keydown', this.handleKey, this);
    });
  }

  // ---- Targets and words ----

  addTarget(target) {
    this.targets.push(target);
    this.assignWord(target);

    target.on('died', () => this.onTargetDied(target));
    target.on('respawn', () => this.assignWord(target));
  }

  assignWord(target) {
    const used = new Set(
      this.targets
        .filter((t) => t !== target && t.word)
        .map((t) => t.word[0])
    );
    const list = WORDS[target.config.wordList];
    target.setWord(pickWord(list, used, target.word));
  }

  onTargetDied(target) {
    if (this.lock === target) this.clearLock();
  }

  // ---- Keyboard ----

  handleKey(event) {
    if (!this.player.alive) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (LETTER.test(event.key)) {
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
    // No lock yet: the first letter picks the target.
    if (!this.lock) {
      const target = this.targets.find((t) => t.alive && t.word && t.word[0] === letter);
      if (!target) return; // Step 3: this becomes a typo

      this.lock = target;
      this.progress = 0;
      target.label.setLocked(true);
    }

    const word = this.lock.word;
    if (letter !== word[this.progress]) return; // Step 3: this becomes a typo

    this.progress += 1;
    this.lock.label.setProgress(this.progress);
    this.player.faceToward(this.lock.x);

    if (this.progress === word.length) this.fire();
  }

  fire() {
    const target = this.lock;
    this.clearLock();
    this.onFire(target);
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
    this.setTyping(false);
  }
}