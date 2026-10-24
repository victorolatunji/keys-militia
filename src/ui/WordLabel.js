// A word floating above a target: typed letters lit up, the rest white,
// on a dark plate so words are always the most readable thing on screen.

const STYLE = { fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold' };
const TYPED_COLOR = '#ffd166';
const REST_COLOR = '#ffffff';
const TYPO_COLOR = '#ff4d6d';
const LOCK_COLOR = 0xffd166;
const PLATE_HEIGHT = 28;
const PLATE_PADDING = 16;

export default class WordLabel {
  constructor(scene) {
    this.scene = scene;
    this.word = '';
    this.progress = 0;
    this.x = 0;
    this.y = 0;
    this.shakeOffset = 0; // animated by the typo shake

    this.plate = scene.add.rectangle(0, 0, 10, PLATE_HEIGHT, 0x000000, 0.75).setDepth(50);
    this.plate.setStrokeStyle(2, LOCK_COLOR);
    this.plate.isStroked = false; // outline only while locked

    this.typed = scene.add
      .text(0, 0, '', { ...STYLE, color: TYPED_COLOR })
      .setOrigin(0, 0.5)
      .setDepth(51);
    this.rest = scene.add
      .text(0, 0, '', { ...STYLE, color: REST_COLOR })
      .setOrigin(0, 0.5)
      .setDepth(51);
  }

  setWord(word) {
    this.word = word;
    this.progress = 0;
    this.render();
  }

  setProgress(count) {
    this.progress = count;
    this.render();
  }

  setLocked(locked) {
    this.plate.isStroked = locked;
  }

  setVisible(visible) {
    for (const part of [this.plate, this.typed, this.rest]) part.setVisible(visible);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.layout();
  }

  // Typo feedback: flash red and shake side to side.
  shake() {
    this.typed.setColor(TYPO_COLOR);
    this.rest.setColor(TYPO_COLOR);

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      shakeOffset: { from: -6, to: 6 },
      duration: 50,
      yoyo: true,
      repeat: 2,
      onUpdate: () => this.layout(),
      onComplete: () => {
        this.shakeOffset = 0;
        this.typed.setColor(TYPED_COLOR);
        this.rest.setColor(REST_COLOR);
        this.layout();
      },
    });
  }

  render() {
    this.typed.setText(this.word.slice(0, this.progress));
    this.rest.setText(this.word.slice(this.progress));
    this.layout();
  }

  layout() {
    const cx = this.x + this.shakeOffset;
    const total = this.typed.width + this.rest.width;
    const left = cx - total / 2;

    this.typed.setPosition(left, this.y);
    this.rest.setPosition(left + this.typed.width, this.y);
    this.plate.setPosition(cx, this.y).setSize(total + PLATE_PADDING, PLATE_HEIGHT);
  }
}