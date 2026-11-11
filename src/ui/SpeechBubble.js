import Phaser from 'phaser';

const PAD_X = 12;
const PAD_Y = 8;
const MAX_W = 300;   // text wraps past this
const TAIL = 12;     // the little point toward the speaker
const DEPTH = 60;

// A speech bubble over a character's head (Training coaches). say() types
// the line out letter by letter; it follows the speaker every frame.
export default class SpeechBubble {
  constructor(scene, speaker, { name = '', color = '#ffd166', lettersPerSec = 40 } = {}) {
    this.scene = scene;
    this.speaker = speaker;
    this.lettersPerSec = lettersPerSec;
    this.full = '';
    this.shown = 0;
    this.bg = scene.add.graphics().setDepth(DEPTH);
    this.name = scene.add.text(0, 0, name, { fontFamily: 'monospace', fontSize: '11px', color, fontStyle: 'bold' }).setDepth(DEPTH + 1);
    this.text = scene.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '14px', color: '#1b1b1f', wordWrap: { width: MAX_W }, lineSpacing: 2 })
      .setDepth(DEPTH + 1);
    this.hide();
  }

  // Start typing a new line.
  say(line) {
    this.full = line;
    this.shown = 0;
    this.visible = true;
    this.text.setText(line); // measure the full size first, so the bubble doesn't grow as it types
    this.w = Math.max(this.text.width, this.name.width) + PAD_X * 2;
    this.h = this.text.height + PAD_Y * 2 + 14;
    this.text.setText('');
    this.setVisible(true);
  }

  get done() {
    return this.shown >= this.full.length;
  }

  hide() {
    this.visible = false;
    this.setVisible(false);
  }

  setVisible(on) {
    this.bg.setVisible(on);
    this.name.setVisible(on);
    this.text.setVisible(on);
  }

  update(delta) {
    if (!this.visible) return;
    if (!this.done) {
      this.shown = Math.min(this.full.length, this.shown + (this.lettersPerSec * delta) / 1000);
      this.text.setText(this.full.slice(0, Math.floor(this.shown)));
    }
    const s = this.speaker;
    const x = Phaser.Math.Clamp(s.x - this.w / 2, 8, this.scene.physics.world.bounds.width - this.w - 8);
    const y = (s.visualTop ?? s.y - s.height / 2) - 26 - this.h - TAIL;
    const g = this.bg.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 3, y + 4, this.w, this.h, 12); // soft shadow
    g.fillStyle(0xfdfcf7, 0.97).fillRoundedRect(x, y, this.w, this.h, 12);
    g.fillTriangle(s.x - 8, y + this.h - 1, s.x + 8, y + this.h - 1, s.x, y + this.h + TAIL);
    this.name.setPosition(x + PAD_X, y + PAD_Y - 2);
    this.text.setPosition(x + PAD_X, y + PAD_Y + 12);
  }

  destroy() {
    this.bg.destroy();
    this.name.destroy();
    this.text.destroy();
  }
}
