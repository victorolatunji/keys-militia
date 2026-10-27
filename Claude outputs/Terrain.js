// Small questions about the tile map, used by bot AI.

export function isSolid(layer, x, y) {
  const tile = layer.getTileAtWorldXY(x, y);
  return Boolean(tile && tile.collides);
}

// Distance in px from (x, y) straight down to the first solid tile,
// or null if there's nothing below (the void).
export function groundBelow(layer, x, y) {
  const step = layer.tilemap.tileHeight / 2;
  const bottom = layer.tilemap.heightInPixels;

  for (let d = 0; y + d < bottom; d += step) {
    if (isSolid(layer, x, y + d)) return d;
  }
  return null;
}

// Closest x (left or right, up to maxRange px) that has ground somewhere
// below height y, or null if there's only void around.
export function nearestGroundX(layer, x, y, maxRange) {
  const step = layer.tilemap.tileWidth;

  for (let offset = 0; offset <= maxRange; offset += step) {
    if (groundBelow(layer, x - offset, y) !== null) return x - offset;
    if (groundBelow(layer, x + offset, y) !== null) return x + offset;
  }
  return null;
}

// First x with ground below, walking from x in direction dir (-1 / 1), or null.
export function groundAhead(layer, x, y, dir, maxRange) {
  const step = layer.tilemap.tileWidth;

  for (let offset = step; offset <= maxRange; offset += step) {
    if (groundBelow(layer, x + dir * offset, y) !== null) return x + dir * offset;
  }
  return null;
}
