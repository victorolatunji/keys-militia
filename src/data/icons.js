// Placeholder item icons, drawn from rectangles (no image files needed).
// Each icon is a 24 x 12 grid, facing right. A shape is [x, y, width, height, color].
// Real pixel art can replace these later: same icon ids, just load images instead.
export const ICON_GRID = { width: 24, height: 12, unit: 2 }; // unit: pixels per grid cell

export const ICON_COLORS = {
  metal: 0x3d4650,
  steel: 0xc0c8d0,
  wood: 0x8d5a2b,
  olive: 0x556b2f,
  red: 0xe63946,
  gold: 0xffd166,
  glass: 0x48cae4,
  outline: 0x000000,
};

export const ICONS = {
  // Guns: one icon per family (category in weapons.js)
  pistol: [
    [5, 3, 13, 3, 'metal'], [18, 3, 2, 2, 'metal'], [6, 6, 4, 5, 'wood'], [10, 6, 3, 2, 'metal'],
  ],
  smg: [
    [0, 4, 3, 2, 'metal'], [3, 4, 14, 3, 'metal'], [17, 4, 4, 2, 'metal'],
    [10, 7, 3, 5, 'olive'], [6, 7, 3, 4, 'metal'],
  ],
  shotgun: [
    [0, 4, 6, 4, 'wood'], [6, 4, 17, 2, 'metal'], [12, 6, 6, 2, 'wood'], [4, 6, 3, 3, 'wood'],
  ],
  assault: [
    [0, 4, 5, 3, 'wood'], [5, 3, 11, 4, 'metal'], [16, 4, 7, 1, 'metal'],
    [10, 7, 3, 3, 'metal'], [11, 9, 3, 3, 'metal'], [6, 7, 2, 3, 'wood'],
  ],
  lmg: [
    [0, 3, 4, 4, 'metal'], [4, 3, 12, 4, 'olive'], [16, 4, 8, 2, 'metal'],
    [8, 7, 5, 4, 'olive'], [18, 6, 1, 5, 'metal'], [20, 6, 1, 5, 'metal'],
  ],
  marksman: [
    [0, 4, 6, 3, 'wood'], [6, 4, 10, 2, 'metal'], [16, 4, 8, 1, 'metal'],
    [7, 1, 7, 2, 'metal'], [13, 1, 1, 2, 'glass'], [9, 3, 1, 1, 'metal'], [12, 3, 1, 1, 'metal'],
    [10, 6, 2, 3, 'metal'],
  ],
  rifle: [
    [0, 4, 5, 3, 'olive'], [5, 4, 9, 2, 'olive'], [14, 4, 10, 1, 'metal'],
    [5, 1, 9, 2, 'metal'], [13, 1, 1, 2, 'glass'], [7, 3, 1, 1, 'metal'], [11, 3, 1, 1, 'metal'],
    [12, 3, 2, 1, 'steel'], [18, 5, 1, 4, 'metal'],
  ],
  launcher: [
    [1, 3, 19, 4, 'olive'], [20, 2, 4, 6, 'red'], [0, 2, 2, 6, 'metal'],
    [8, 7, 2, 3, 'metal'], [14, 7, 2, 3, 'metal'],
  ],

  // Specials: one icon each
  sawGun: [
    [1, 4, 12, 4, 'metal'], [3, 8, 3, 3, 'wood'], [13, 3, 2, 6, 'metal'],
    [15, 1, 8, 10, 'steel'], [17, 0, 4, 12, 'steel'], [18, 5, 2, 2, 'red'],
  ],

  nailGun: [
    [2, 3, 14, 4, 'gold'], [16, 4, 4, 2, 'metal'], [20, 4, 3, 1, 'steel'],
    [5, 7, 3, 4, 'metal'], [10, 7, 4, 3, 'metal'],
  ],
  laser: [
    [1, 3, 15, 4, 'steel'], [4, 2, 8, 1, 'glass'], [16, 4, 6, 2, 'glass'],
    [22, 4, 2, 2, 'steel'], [5, 7, 3, 4, 'metal'],
  ],
  flamethrower: [
    [0, 5, 10, 3, 'metal'], [2, 1, 5, 4, 'red'], [10, 4, 9, 3, 'metal'],
    [19, 3, 3, 5, 'metal'], [22, 4, 2, 3, 'gold'], [12, 7, 3, 4, 'wood'],
  ],

  // Melee: one icon each
  knife: [[3, 5, 6, 2, 'metal'], [9, 4, 1, 4, 'steel'], [10, 5, 12, 2, 'steel'], [22, 5, 1, 1, 'steel']],
  machete: [[2, 5, 6, 2, 'wood'], [8, 4, 1, 4, 'metal'], [9, 4, 14, 3, 'steel']],
  bat: [[2, 5, 6, 2, 'metal'], [8, 4, 15, 4, 'wood']],
  spade: [[0, 4, 2, 4, 'metal'], [2, 5, 14, 2, 'wood'], [16, 3, 6, 6, 'steel']],
  hammer: [[2, 5, 14, 2, 'wood'], [16, 2, 4, 8, 'metal']],
  sword: [[2, 5, 5, 2, 'wood'], [7, 3, 1, 6, 'gold'], [8, 5, 14, 2, 'steel'], [22, 5, 1, 1, 'steel']],
  axe: [[1, 5, 18, 2, 'wood'], [17, 2, 4, 6, 'steel'], [21, 1, 1, 8, 'steel']],
  melee: [[3, 5, 6, 2, 'wood'], [9, 5, 13, 2, 'steel']], // fallback

  // Throwables
  grenade: [[8, 3, 8, 8, 'olive'], [10, 1, 4, 2, 'metal'], [14, 1, 4, 1, 'metal'], [9, 6, 6, 1, 'metal']],
};