import { WORDS } from '../data/words.js';
import { pickWord } from './wordPicker.js';

// Typing: words on targets (unique first letters), typing state.
// Step 2 adds lock-on and shooting, Step 3 typos, Step 4 line of sight.

const LETTER = /^[a-z]$/; // lowercase only, so Shift/Space/digits never count
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const MAX_BUFFER = 20;

export default class TypingSystem {
  constructor(scene, player) {
    this.player = player;
    this.isTyping = false;
    this.buffer = '';
    this.targets = [];

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

  // ---- Keyboard ----

  handleKey(event) {
    if (!this.player.alive) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (LETTER.test(event.key)) {
      this.buffer = (this.buffer + event.key).slice(-MAX_BUFFER);
      this.setTyping(true);
      return;
    }

    // Only a fresh arrow press cancels typing, not a held arrow repeating.
    if (ARROWS.has(event.key) && !event.repeat) {
      this.setTyping(false); // buffer stays saved
    }
  }

  setTyping(on) {
    if (this.isTyping === on) return;
    this.isTyping = on;
    this.player.setTyping(on);
  }

  reset() {
    this.buffer = '';
    this.setTyping(false);
  }
}