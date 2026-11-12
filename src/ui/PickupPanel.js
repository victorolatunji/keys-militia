// Pickup panel, pinned to the bottom of the screen (just above the state tag)
// so it never covers a word: the item's picture and name on top, then one
// line per key you can press, each with a picture of what it's about (the
// gun in that slot, the gun in the crate).
// Uses a Container: a group of display objects that move and show/hide together.
const BORDER_COLOR = 0xffd166;
const PADDING_X = 12;
const PADDING_Y = 6;
const ICON_GAP = 4;        // space between the top picture and the text
const ICON_HEIGHT = 26;    // the top picture: this tall (art is scaled to fit)
const ICON_MAX_W = 90;
const ROW_ART_H = 16;      // pictures on the option lines
const ROW_ART_W = 44;
const ROW_GAP = 6;         // between a line's picture and its text
const LINE_H = 19;
const SCREEN_X = 640;
const SCREEN_BOTTOM = 668; // panel's bottom edge, in screen pixels
const STYLE = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' };

export default class PickupPanel {
  constructor(scene) {
    this.scene = scene;
    this.bg = scene.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.8)
      .setStrokeStyle(1, BORDER_COLOR)
      .setOrigin(0.5, 1);
    this.title = scene.add.text(0, 0, '', { ...STYLE, align: 'center', lineSpacing: 3 }).setOrigin(0.5, 1);
    this.icon = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1);
    this.rows = []; // { art, text }

    this.container = scene.add
      .container(SCREEN_X, SCREEN_BOTTOM, [this.bg, this.title, this.icon])
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  row(i) {
    if (!this.rows[i]) {
      const art = this.scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 0.5);
      const text = this.scene.add.text(0, 0, '', STYLE).setOrigin(0, 0.5);
      this.container.add([art, text]);
      this.rows[i] = { art, text };
    }
    return this.rows[i];
  }

  // Fit a picture into w x h (keeps its shape).
  fit(img, key, w, h) {
    const ok = Boolean(key) && this.scene.textures.exists(key);
    img.setVisible(ok);
    if (!ok) return 0;
    img.setTexture(key).setScale(Math.min(w / img.width, h / img.height));
    return img.displayWidth;
  }

  // title: item name. options: [{ key, label, enabled, art? }] (art: texture
  // for that line). iconKey: the picture on top.
  show(title, options, iconKey) {
    this.title.setText(title);
    const iconW = this.fit(this.icon, iconKey, ICON_MAX_W, ICON_HEIGHT);

    // Option lines, from the bottom up.
    let width = this.title.width;
    const hasArt = options.some((o) => o.art && this.scene.textures.exists(o.art));
    const artW = hasArt ? ROW_ART_W + ROW_GAP : 0;
    options.forEach((opt, i) => {
      const r = this.row(i);
      r.text.setText(opt.enabled ? `[${opt.key}] ${opt.label}` : opt.label).setColor(opt.enabled ? '#ffffff' : '#adb5bd').setVisible(true);
      this.fit(r.art, opt.art, ROW_ART_W, ROW_ART_H);
      width = Math.max(width, artW + r.text.width);
    });
    for (let i = options.length; i < this.rows.length; i++) {
      this.rows[i].art.setVisible(false);
      this.rows[i].text.setVisible(false);
    }
    const left = -width / 2;
    let y = -PADDING_Y - LINE_H / 2;
    for (let i = options.length - 1; i >= 0; i--) {
      const r = this.rows[i];
      r.art.setPosition(left + ROW_ART_W / 2, y);
      r.text.setPosition(left + artW, y);
      y -= LINE_H;
    }
    const titleBottom = y + LINE_H / 2 - 2;
    this.title.setY(titleBottom);
    this.icon.setY(titleBottom - this.title.height - ICON_GAP);

    this.bg.setSize(
      Math.max(width, iconW) + PADDING_X * 2,
      -titleBottom + this.title.height + ICON_GAP + ICON_HEIGHT + PADDING_Y * 2
    );
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }
}
