// Typing state for Phase 1: letters enter typing mode, fresh arrow presses leave it.
// Phase 2 replaces the test buffer with real words, lock-on and typos.

const LETTER = /^[a-z]$/; // lowercase only, so Shift/Space/digits never count
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const MAX_BUFFER = 20;

export default class TypingSystem {
  constructor(scene, player) {
    this.player = player;
    this.isTyping = false;
    this.buffer = '';

    scene.input.keyboard.on('keydown', this.handleKey, this);

    // Clean up when the scene shuts down (restarts, menu, etc.).
    scene.events.once('shutdown', () => {
      scene.input.keyboard.off('keydown', this.handleKey, this);
    });
  }

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