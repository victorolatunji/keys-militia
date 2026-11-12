// A clickable button with its shortcut key: "[R] PLAY AGAIN".
// Works in any scene: the mouse (hover lights it up, click runs it) and the
// key both run the same action, once.
//   opts: key (Phaser key name, e.g. 'R', 'ENTER', 'ESC'), keyLabel (what the
//   label shows for the key), size, fixed (stays on screen while the camera
//   moves), depth, color, width.
const GOLD = 0xd2a35f;
const EDGE = 0x30353b;

export function makeButton(scene, x, y, label, action, opts = {}) {
  const size = opts.size ?? 18;
  const keyLabel = opts.keyLabel ?? opts.key;
  const str = keyLabel ? `[${keyLabel}] ${label}` : label;
  const text = scene.add.text(0, 0, str, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color: opts.color ?? '#ffffff' }).setOrigin(0.5);
  const w = Math.max(opts.width ?? 0, text.width + 28);
  const h = text.height + 14;
  const bg = scene.add.rectangle(0, 0, w, h, 0x1a1f24, 0.95).setStrokeStyle(2, EDGE);
  const box = scene.add.container(x, y, [bg, text]).setSize(w, h).setDepth(opts.depth ?? 0);
  if (opts.fixed) box.setScrollFactor(0);
  let done = false;
  const run = () => {
    if (done && opts.once !== false) return;
    done = true;
    action();
  };
  box.setInteractive({ useHandCursor: true });
  box.on('pointerover', () => {
    bg.setStrokeStyle(2, GOLD);
    text.setColor('#d2a35f');
  });
  box.on('pointerout', () => {
    bg.setStrokeStyle(2, EDGE);
    text.setColor(opts.color ?? '#ffffff');
  });
  box.on('pointerdown', (ptr, lx, ly, e) => {
    e?.stopPropagation?.();
    run();
  });
  if (opts.key) {
    const ev = `keydown-${opts.key}`;
    scene.input.keyboard.on(ev, run);
    box.once('destroy', () => scene.input.keyboard?.off(ev, run));
  }
  box.run = run;
  return box;
}

// A row of buttons centred on x: [[label, action, key, keyLabel?], ...]
export function buttonRow(scene, x, y, buttons, opts = {}) {
  const made = buttons.map(([label, action, key, keyLabel]) => makeButton(scene, 0, y, label, action, { ...opts, key, keyLabel }));
  const gap = opts.gap ?? 18;
  const total = made.reduce((s, b) => s + b.width, 0) + gap * (made.length - 1);
  let cx = x - total / 2;
  for (const b of made) {
    b.x = cx + b.width / 2;
    cx += b.width + gap;
  }
  return made;
}
