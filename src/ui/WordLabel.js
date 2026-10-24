// A word floating above a target: typed letters lit up, the rest white,
// on a dark plate so words are always the most readable thing on screen.

const STYLE = { fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold' };
const TYPED_COLOR = '#ffd166';
const REST_COLOR = '#ffffff';
const PLATE_HEIGHT = 28;
const PLATE_PADDING = 16;

export default class WordLabel {
  constructor(scene) {
    this.word = '';
    this.progress = 0;
    this.x = 0;
    this.y = 0;

    this.plate = scene.add.rectangle(0, 0, 10, PLATE_HEIGHT, 0x000000, 0.75).setDepth(50);
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

  setVisible(visible) {
    for (const part of [this.plate, this.typed, this.rest]) part.setVisible(visible);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.layout();
  }

  render() {
    this.typed.setText(this.word.slice(0, this.progress));
    this.rest.setText(this.word.slice(this.progress));
    this.layout();
  }

  layout() {
    const total = this.typed.width + this.rest.width;
    const left = this.x - total / 2;

    this.typed.setPosition(left, this.y);
    this.rest.setPosition(left + this.typed.width, this.y);
    this.plate.setPosition(this.x, this.y).setSize(total + PLATE_PADDING, PLATE_HEIGHT);
  }
}