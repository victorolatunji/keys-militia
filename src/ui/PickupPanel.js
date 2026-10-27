// Pickup panel, pinned to the bottom of the screen (just above the state tag)
// so it never covers a word: the item's icon and name, then one line per key you can press.
// Uses a Container: a group of display objects that move and show/hide together.
const BORDER_COLOR = 0xffd166;
const PADDING_X = 12;
const PADDING_Y = 6;
const ICON_GAP = 4;        // space between the icon and the text
const ICON_HEIGHT = 26;    // icon textures are 50 x 26 px
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

    this.icon = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1);

    this.container = scene.add
      .container(SCREEN_X, SCREEN_BOTTOM, [this.bg, this.text, this.icon])
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  // title: item name. options: [{ key, label, enabled }]. iconKey: texture to show on top.
  show(title, options, iconKey) {
    const lines = [title];
    for (const opt of options) {
      lines.push(opt.enabled ? `[${opt.key}] ${opt.label}` : opt.label);
    }
    this.text.setText(lines);

    // Icon sits above the text, centered.
    this.icon.setTexture(iconKey);
    this.icon.setY(-PADDING_Y - this.text.height - ICON_GAP);

    this.bg.setSize(
      Math.max(this.text.width, this.icon.width) + PADDING_X * 2,
      this.text.height + ICON_GAP + ICON_HEIGHT + PADDING_Y * 2
    );
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }
}