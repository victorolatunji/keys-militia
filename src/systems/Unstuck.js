// Safety net: anyone found inside solid ground (fell through a floor, was
// pushed into a wall) is lifted to the first open space above them, or put
// back at the nearest spawn point if there's none. Checked a few times a
// second for you, your partner and the bots (B-020).
const EVERY_MS = 250;
const MAX_ROWS = 80; // how far up it looks for open space (tiles)

const solidAt = (layer, x, y) => {
  const t = layer.getTileAtWorldXY(x, y, true);
  return Boolean(t && t.index > 0 && t.collides);
};

export default class Unstuck {
  constructor(scene) {
    this.scene = scene;
    this.nextAt = 0;
    this.rescues = 0; // how many times it stepped in (shown in testing)
  }

  update(now, who) {
    if (now < this.nextAt) return;
    this.nextAt = now + EVERY_MS;
    for (const c of who) if (c?.alive && c.body) this.check(c);
  }

  // Buried: the middle of the body and just above its feet are both in solid tiles.
  buried(c) {
    const layer = this.scene.groundLayer;
    const b = c.body;
    return solidAt(layer, b.center.x, b.center.y) && solidAt(layer, b.center.x, b.bottom - 6);
  }

  check(c) {
    if (!this.buried(c)) return;
    const layer = this.scene.groundLayer;
    const th = layer.tilemap.tileHeight;
    const b = c.body;
    const x = b.center.x;
    const rows = Math.ceil(b.height / th) + 1; // open rows it needs to fit
    let row = Math.floor(b.center.y / th);
    let free = 0;
    let found = null;
    for (let i = 0; i < MAX_ROWS && row >= 0; i++, row--) {
      free = solidAt(layer, x, row * th + th / 2) ? 0 : free + 1;
      if (free >= rows) {
        found = (row + rows) * th; // the bottom of the open space: stand there
        break;
      }
    }
    if (found !== null) {
      b.reset(x, found - b.height / 2 - 2);
    } else {
      const spot = this.scene.nearestSpawn(x);
      b.reset(spot.x, spot.y);
    }
    b.setVelocity(0, 0);
    this.rescues += 1;
  }
}
