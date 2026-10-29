import { ICONS, ICON_GRID, ICON_COLORS } from '../data/icons.js';
import { WEAPONS } from '../data/weapons.js';

const OUTLINE = 1; // px of black outline around every shape

// Turns the rectangle lists in data/icons.js into textures, once, at boot.
// generateTexture: draw on a Graphics object, then save the result as a texture
// with a key. After that, any Image can use it like a loaded picture (cheap to draw).
export function createIconTextures(scene) {
  const { width, height, unit } = ICON_GRID;
  const g = scene.make.graphics({ x: 0, y: 0 }, false); // not added to the scene

  for (const [id, shapes] of Object.entries(ICONS)) {
    g.clear();

    // Outline pass first, so outlines never cover a neighbor's fill.
    g.fillStyle(ICON_COLORS.outline, 1);
    for (const [x, y, w, h] of shapes) {
      g.fillRect(x * unit, y * unit, w * unit + OUTLINE * 2, h * unit + OUTLINE * 2);
    }
    for (const [x, y, w, h, color] of shapes) {
      g.fillStyle(ICON_COLORS[color], 1);
      g.fillRect(x * unit + OUTLINE, y * unit + OUTLINE, w * unit, h * unit);
    }

    g.generateTexture(`icon-${id}`, width * unit + OUTLINE * 2, height * unit + OUTLINE * 2);
  }

  g.destroy();
}

// Texture key for a crate / drop item ({ type, key }) or a weapon config.
export function iconKey(item) {
  if (item.type === 'throwable') return ICONS[item.key] ? `icon-${item.key}` : 'icon-grenade';

  const weapon = WEAPONS[item.key];
  if (!weapon) return 'icon-melee';
  if (ICONS[weapon.key]) return `icon-${weapon.key}`; // its own icon (melee, specials)
  if (weapon.category === 'melee') return 'icon-melee';
  return `icon-${weapon.category}`;
}