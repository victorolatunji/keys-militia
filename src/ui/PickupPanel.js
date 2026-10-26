// Pickup panel, pinned to the bottom of the screen (just above the state tag)
// so it never covers a word: the item name, then one line per key you can press.
// Uses a Container: a group of display objects that move and show/hide together.
const BORDER_COLOR = 0xffd166;
const PADDING_X = 12;
const PADDING_Y = 6;
const SCREEN_X = 640;
const SCREEN_BOTTOM = 668; // panel's bottom edge, in screen pixels

export default class PickupPanel {
  constructor(scene) {
    this.bg = scene.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.8)
      .setStrokeStyle(1, BORDER_COLOR)
      .setOrigin(0.5, 1);

    this.text = scene.add
      .text(0, -PADDING_Y, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 3,
      })
      .setOrigin(0.5, 1);

    this.container = scene.add
      .container(SCREEN_X, SCREEN_BOTTOM, [this.bg, this.text])
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  // title: item name. options: [{ key, label, enabled }]
  show(title, options) {
    const lines = [title];
    for (const opt of options) {
      lines.push(opt.enabled ? `[${opt.key}] ${opt.label}` : opt.label);
    }

    this.text.setText(lines);
    this.bg.setSize(this.text.width + PADDING_X * 2, this.text.height + PADDING_Y * 2);
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }
}