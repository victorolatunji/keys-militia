import Phaser from 'phaser';

const STEP = 8; // px between checks; smaller = more precise, slower

// True if no solid tile lies on the straight line between two points.
export function hasLineOfSight(layer, x1, y1, x2, y2) {
  const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
  const steps = Math.ceil(distance / STEP);

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tile = layer.getTileAtWorldXY(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    if (tile && tile.collides) return false;
  }

  return true;
}