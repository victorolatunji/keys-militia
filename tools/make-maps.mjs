// Phase 7 map maker: builds the Forest and Hell placeholder maps (Tiled JSON)
// and their placeholder tilesets (PNG), with no extra packages.
//
//   node tools/make-maps.mjs
//
// Writes public/assets/maps/forest.json, hell.json and
// public/assets/tilesets/forest-tiles.png, hell-tiles.png.
// The JSON files open in Tiled like any other map, so from here on you can
// also just edit them there (re-running this script overwrites them).
//
// Every map has its own shape (no shared template). Both are tall: open sky
// with islands up high, the main level, openings to drop through, open air
// UNDER the map with low islands, then the void (Hell: a lava sea).
//   Forest "Riverbend": a cliff with a cave tunnel and a waterfall into a
//     lake, a rolling meadow with boulders and a treehouse, a chasm, a rocky
//     highland with a pond, root caverns and islands underneath.
//   Hell "Inferno": a basalt plateau with spikes and a lava pit, a volcano
//     with a lava crater and a tunnel through it, floating rock steps with a
//     hot spring and a lava fall into the sea, broken islands underneath.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = 32;
let W = 100; // set per map
let H = 76;

// ---------------------------------------------------------------- PNG ----

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Seeded random, so the same script always makes the same files.
let seed = 12345;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

// A tile painter gets (x, y) inside the tile and returns [r, g, b] or
// [r, g, b, a] (a = 0: see-through, used for rounded corners).
// Each tileset is one row of 32x32 tiles.
function tileset(painters) {
  const width = painters.length * T;
  const buf = Buffer.alloc(width * T * 4);
  painters.forEach((paint, i) => {
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const [r, g, b, a = 255] = paint(x, y);
        const o = (y * width + i * T + x) * 4;
        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
        buf[o + 3] = a;
      }
    }
  });
  return png(width, T, buf);
}

// Grainy fill with a few darker specks.
const grain = (base, amount = 0.12, specks = 0.04, speckColor = null) => () => {
  if (rand() < specks) return speckColor ?? shade(base, 0.7);
  return shade(base, 1 - amount / 2 + rand() * amount);
};
// A top layer (grass, crust) of `depth` px with a ragged edge over a body.
const topped = (top, bodyPaint, depth = 7) => {
  const edge = Array.from({ length: T }, () => depth + Math.floor(rand() * 4) - 1);
  return (x, y) => {
    if (y < edge[x]) return shade(y < 2 ? mix(top, [255, 255, 255], 0.2) : top, 0.9 + rand() * 0.2);
    if (y === edge[x]) return shade(top, 0.6);
    return bodyPaint(x, y);
  };
};
// Boulder rock: lit from the top left, darker to the bottom right, cracks.
const stone = (base, crack) => {
  const cracks = Array.from({ length: 2 }, () => [Math.floor(rand() * 24) + 4, Math.floor(rand() * 20) + 6]);
  return (x, y) => {
    for (const [cx, cy] of cracks) if (Math.abs(x - cx - (y - cy) * 0.5) < 0.8 && y > cy && y < cy + 9) return crack;
    const light = 1.12 - ((x + y) / 64) * 0.3;
    return shade(base, light * (0.93 + rand() * 0.12));
  };
};
// Wooden planks / metal grate.
const planks = (base, gap) => (x, y) => {
  if (y === 0 || y === 31 || x % 16 === 0) return gap;
  if ((x % 16 === 3 || x % 16 === 12) && (y === 4 || y === 27)) return shade(base, 0.5); // nails / rivets
  return shade(base, 0.9 + rand() * 0.15 - (y % 8 === 0 ? 0.15 : 0));
};
// Underside: the body color with roots / glowing cracks hanging down.
const underside = (base, line) => {
  const lines = Array.from({ length: 4 }, () => [Math.floor(rand() * 30) + 1, 12 + Math.floor(rand() * 20)]);
  const body = grain(base, 0.14, 0.05);
  return (x, y) => {
    for (const [lx, len] of lines) if (Math.abs(x - lx - Math.sin(y / 4) * 1.5) < 1 && y > 32 - len) return shade(line, 0.85 + rand() * 0.3);
    return shade(body(x, y), 0.8 + (y / 32) * 0.1);
  };
};
// Rounded corners (looks only: the tile is still a full solid square).
// corners: any of 'tl', 'tr', 'bl', 'br'.
const rounded = (paint, corners, r = 11) => (x, y) => {
  const c = paint(x, y);
  for (const k of corners) {
    const cx = k.includes('l') ? r : T - 1 - r;
    const cy = k.includes('t') ? r : T - 1 - r;
    const inCorner = (k.includes('l') ? x < cx : x > cx) && (k.includes('t') ? y < cy : y > cy);
    if (!inCorner) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) return [0, 0, 0, 0];
    if (d > r - 1.5) return shade(c, 0.6); // a darker rim along the curve
  }
  return c;
};

// Tile ids (1-based gids, the same order as the painters below).
const TILE = {
  top: 1, soil: 2, deep: 3, sand: 4, plank: 5, under: 6, rock: 7,
  topL: 8, topR: 9, topLR: 10, rockTL: 11, rockTR: 12, rockTLR: 13,
  sandL: 14, sandR: 15, sandLR: 16, underL: 17, underR: 18, underLR: 19,
};

// One tileset from a palette: every tile and its rounded versions.
function paletteTiles(p) {
  const top = () => topped(hex(p.top), grain(hex(p.soil), 0.14, 0.06), p.topDepth ?? 7);
  const soil = () => grain(hex(p.soil), 0.14, 0.06);
  const rock = () => stone(hex(p.rock), hex(p.crack));
  const sand = () => grain(hex(p.sand), 0.1, 0.06, hex(p.sandSpeck));
  const under = () => underside(hex(p.under), hex(p.roots));
  return [
    top(),                                            // 1
    soil(),                                           // 2
    grain(hex(p.deep), 0.12, 0.08, hex(p.deepSpeck)), // 3
    sand(),                                           // 4
    planks(hex(p.plank), hex(p.plankGap)),            // 5
    under(),                                          // 6
    rock(),                                           // 7
    rounded(top(), ['tl']), rounded(top(), ['tr']), rounded(top(), ['tl', 'tr']),     // 8-10
    rounded(rock(), ['tl']), rounded(rock(), ['tr']), rounded(rock(), ['tl', 'tr']), // 11-13
    rounded(sand(), ['tl']), rounded(sand(), ['tr']), rounded(sand(), ['tl', 'tr']), // 14-16
    rounded(under(), ['bl']), rounded(under(), ['br']), rounded(under(), ['bl', 'br']), // 17-19
  ];
}

const FOREST_PALETTE = {
  top: 0x52b788, soil: 0x7f5539, deep: 0x6c757d, deepSpeck: 0x495057, sand: 0xe9c46a, sandSpeck: 0xd4a373,
  plank: 0xa47148, plankGap: 0x582f0e, under: 0x6f4518, roots: 0xb08968, rock: 0x8d99ae, crack: 0x4a4e69,
};
const HELL_PALETTE = {
  top: 0xff6b35, topDepth: 5, soil: 0x3d2b2b, deep: 0x1b1423, deepSpeck: 0x5a189a, sand: 0x6b5b55, sandSpeck: 0x4a3f3b,
  plank: 0x5c5c66, plankGap: 0x22222a, under: 0x2b1d1d, roots: 0xff7b00, rock: 0x4a2c2a, crack: 0xff7b00,
};

// ---------------------------------------------------------------- map ----

// mats: what each cell is made of ('soil' | 'sand' | 'rock' | 'plank' | null).
function grid() {
  return Array.from({ length: H }, () => Array(W).fill(null));
}
function fill(mats, x0, y0, x1, y1, mat) {
  for (let y = Math.round(y0); y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < H && x >= 0 && x < W) mats[y][x] = mat;
}
function carve(mats, x0, y0, x1, y1) {
  fill(mats, x0, y0, x1, y1, null);
}
// Ground whose top follows top(x) and bottom follows bottom(x) (rows).
function land(mats, x0, x1, top, bottom, mat = 'soil') {
  for (let x = x0; x <= x1; x++) fill(mats, x, Math.round(top(x)), x, Math.round(bottom(x)), mat);
}
// A floating island: flat top, a bottom that tapers into a point.
function island(mats, x0, x1, top, depth, mat = 'soil') {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / Math.max(1, x1 - x0);
    const d = Math.max(1, Math.round(depth * (1 - Math.pow(Math.abs(t - 0.5) * 2, 2)) + (rand() < 0.4 ? 1 : 0)));
    fill(mats, x, top, x, top + d, mat);
  }
}
// Ragged rock / roots hanging under ground (longest in the middle).
function hang(mats, x0, x1, from, maxLen, mat = 'soil') {
  for (let x = x0; x <= x1; x++) {
    const len = Math.floor(rand() * maxLen * (1 - Math.abs((x - x0) / Math.max(1, x1 - x0) - 0.5)));
    fill(mats, x, from, x, from + len, mat);
  }
}
// A boulder (w x h tiles) sitting on the ground at column x.
function boulder(mats, x, w, h) {
  const top = topAt(mats, x, 0);
  fill(mats, x, top - h, x + w - 1, top - 1, 'rock');
}
// First solid row at column x, at or below row `from`.
function topAt(mats, x, from) {
  for (let y = from; y < H; y++) if (mats[y][x]) return y;
  return H;
}
// A pool dug into the ground: carve x0..x1 from row top for `depth` rows,
// line it with `rim`, and return the Tiled rectangle for the liquid.
function pool(mats, name, x0, x1, top, depth, rim = 'sand', inset = 10) {
  fill(mats, x0 - 1, top, x1 + 1, top + depth, rim);
  carve(mats, x0, top, x1, top + depth - 1);
  return rect(name, px(x0), px(top) + inset, px(x1 - x0 + 1), px(depth) - inset);
}

// Turn materials into tile ids: tops get the top tile (rounded at open
// ends), undersides the underside tile, soil deep inside turns to stone.
function tiles(mats) {
  const data = [];
  const solid = (x, y) => y >= 0 && y < H && x >= 0 && x < W && mats[y][x];
  const pick = (l, r, both, left, right, plain) => (l && r ? both : l ? left : r ? right : plain);
  // How far below the top of its soil this cell is (boulders on top don't count).
  const soilDepth = (x, y) => {
    let d = 0;
    while (y - d - 1 >= 0 && mats[y - d - 1][x] && mats[y - d - 1][x] !== 'rock') d++;
    return d;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = mats[y][x];
      const openTop = !solid(x, y - 1);
      const openL = !solid(x - 1, y) && !solid(x - 1, y - 1);
      const openR = !solid(x + 1, y) && !solid(x + 1, y - 1);
      let id = 0;
      if (m === 'sand') id = openTop ? pick(openL, openR, TILE.sandLR, TILE.sandL, TILE.sandR, TILE.sand) : TILE.sand;
      else if (m === 'rock') id = openTop ? pick(openL, openR, TILE.rockTLR, TILE.rockTL, TILE.rockTR, TILE.rock) : TILE.rock;
      else if (m === 'plank') id = TILE.plank;
      else if (m === 'soil') {
        if (openTop) id = pick(openL, openR, TILE.topLR, TILE.topL, TILE.topR, TILE.top);
        else if (!solid(x, y + 1)) {
          const bl = !solid(x - 1, y) && !solid(x - 1, y + 1);
          const br = !solid(x + 1, y) && !solid(x + 1, y + 1);
          id = pick(bl, br, TILE.underLR, TILE.underL, TILE.underR, TILE.under);
        } else if (soilDepth(x, y) >= 5 && solid(x, y + 2)) id = TILE.deep;
        else id = TILE.soil;
      }
      data.push(id);
    }
  }
  return data;
}

let objectId = 1;
const point = (name, x, y) => ({ id: objectId++, name, type: '', point: true, x, y, width: 0, height: 0, rotation: 0, visible: true });
const rect = (name, x, y, w, h) => ({ id: objectId++, name, type: '', x, y, width: w, height: h, rotation: 0, visible: true });
const px = (tiles) => tiles * T;
// A point standing on the ground at column x (first ground at or below row `from`).
const on = (mats, name, x, from = 0, dx = 16) => point(name, px(x) + dx, px(topAt(mats, x, from)));

function tiledMap(tilesetName, mats, layers) {
  const count = Object.keys(TILE).length;
  return {
    compressionlevel: -1, width: W, height: H, infinite: false, orientation: 'orthogonal',
    renderorder: 'right-down', tiledversion: '1.11.0', version: '1.10', type: 'map',
    tilewidth: T, tileheight: T, nextlayerid: layers.length + 2, nextobjectid: objectId,
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: tiles(mats) },
      ...layers.map((l, i) => ({ id: i + 2, name: l.name, type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: l.objects })),
    ],
    tilesets: [{
      firstgid: 1, name: tilesetName, image: `../tilesets/${tilesetName}.png`,
      imagewidth: count * T, imageheight: T, tilewidth: T, tileheight: T, tilecount: count, columns: count, margin: 0, spacing: 0,
    }],
  };
}

// ------------------------------------------------------------- Forest ----
// 110 x 80 tiles. Main level around row 36; void from row 72.
function forest() {
  W = 110;
  H = 80;
  seed = 777;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];

  // West cliff: a high hill with a cave tunnel straight through it.
  land(m, 2, 22, (x) => 26 + Math.round(Math.sin(x / 2.6) * 1.4) + (x < 5 ? 3 : 0), () => 44);
  carve(m, 2, 34, 22, 36);                  // the tunnel (3 tiles tall), open at both ends
  fill(m, 2, 37, 4, 37, 'rock');            // a lip at the west mouth
  fill(m, 23, 26, 26, 27, 'rock');          // rock lip the waterfall pours off
  hang(m, 3, 21, 45, 6);
  boulder(m, 8, 2, 2);
  boulder(m, 17, 1, 1);
  // Beach under the tunnel's east mouth, then the lake.
  fill(m, 22, 37, 25, 49, 'sand');
  hz.push(pool(m, 'water', 26, 47, 38, 10));
  fill(m, 33, 45, 36, 47, 'rock');          // a sunken boulder in the lake
  fill(m, 41, 46, 44, 47, 'sand');          // uneven lake bed
  hz.push(rect('waterfall', px(26) + 4, px(28), 26, px(10) + 10));
  hang(m, 23, 48, 50, 4, 'sand');

  // Meadow: rolling ground, boulders, a shaft down, a treehouse.
  land(m, 49, 70, (x) => 36 + Math.round(Math.sin((x - 49) / 3.2) * 1.3), () => 43);
  carve(m, 58, 30, 61, 43);                  // shaft
  hang(m, 49, 57, 44, 6);
  hang(m, 62, 70, 44, 7);
  boulder(m, 52, 2, 2);
  boulder(m, 66, 2, 1);
  boulder(m, 67, 1, 1);
  fill(m, 50, 28, 56, 28, 'plank');         // treehouse floor
  fill(m, 63, 31, 67, 31, 'plank');
  // (gap 71-76: the chasm, open to the air below)

  // East highland: higher and rockier, a pond on top, a shaft, a rock pile.
  land(m, 77, 106, (x) => 34 - (x > 101 ? 1 : 0) + (x < 80 ? 1 : 0), () => 41);
  carve(m, 89, 30, 91, 41);                  // shaft
  hz.push(pool(m, 'water', 95, 100, 34, 3, 'sand', 8));
  fill(m, 82, 30, 85, 32, 'rock');           // rock pile (cover)
  fill(m, 83, 28, 84, 29, 'rock');
  boulder(m, 103, 2, 2);
  hang(m, 77, 88, 42, 6);
  hang(m, 92, 106, 42, 6);

  // Sky: grassy islands and planks up high.
  island(m, 30, 38, 18, 3);
  island(m, 60, 67, 13, 3);
  island(m, 86, 93, 20, 3);
  fill(m, 12, 18, 17, 18, 'plank');
  fill(m, 100, 24, 105, 24, 'plank');

  // Under the map: root caverns above, islands to fight on, a hidden pond.
  island(m, 6, 20, 57, 5);
  island(m, 36, 52, 61, 4);
  island(m, 66, 81, 55, 6);
  hz.push(pool(m, 'water', 71, 76, 55, 2, 'sand', 6));
  island(m, 92, 104, 60, 4);
  boulder(m, 45, 2, 1);
  boulder(m, 98, 1, 1);

  const spawns = [
    point('player', px(64), px(9)),
    on(m, 'bot', 12), on(m, 'bot', 54, 20), on(m, 'bot', 80, 20), on(m, 'bot', 102, 26),
    on(m, 'bot', 13, 50), on(m, 'bot', 69, 50), on(m, 'bot', 98, 50), on(m, 'bot', 33, 10), on(m, 'bot', 90, 10),
  ];
  for (const x of [6, 14, 20, 79, 87, 93, 105]) decor.push(on(m, 'tree', x, 20));
  for (const x of [51, 64, 69]) decor.push(on(m, 'tree', x, 32)); // under the planks
  decor.push(rect('bigtree', px(53), px(27), px(2), px(36) - px(27))); // the treehouse tree
  decor.push(on(m, 'tree', 34, 10), on(m, 'tree', 63, 5), on(m, 'tree', 10, 50), on(m, 'tree', 78, 50), on(m, 'tree', 100, 50));
  for (const x of [11, 47, 57, 68, 81, 86, 106]) decor.push(on(m, 'rock', x, 20, 8));
  for (const x of [16, 40, 67, 95]) decor.push(on(m, 'rock', x, 50, 10));
  for (const x of [9, 62, 101, 106]) decor.push(on(m, 'mushroom', x, 20, 20));
  for (const x of [18, 48, 79]) decor.push(on(m, 'mushroom', x, 50, 20));
  for (const [x, w] of [[15, 3], [62, 3], [78, 3], [39, 2]]) {
    const top = topAt(m, x, x === 39 ? 50 : 20);
    decor.push(rect('bush', px(x), px(top) - 56, px(w) - 10, 56));
  }
  decor.push(rect('fireflies', 0, px(46), px(W), px(22)));
  decor.push(rect('cave', px(2), px(34), px(21), px(3)));          // the tunnel's dark back wall

  return tiledMap('forest-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}

// --------------------------------------------------------------- Hell ----
// 100 x 88 tiles. Taller and broken up; the lava sea from row 80.
function hell() {
  W = 100;
  H = 88;
  seed = 666;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];

  // West plateau: basalt with spikes, a lava pit and a shaft.
  land(m, 2, 28, (x) => 42 + (x < 6 ? 1 : 0), () => 49);
  hz.push(pool(m, 'lava', 12, 18, 42, 3, 'rock', 12));
  carve(m, 23, 40, 25, 49);
  fill(m, 8, 38, 8, 41, 'rock');            // spikes (cover)
  fill(m, 20, 37, 21, 41, 'rock');
  fill(m, 4, 40, 5, 41, 'rock');
  hang(m, 2, 22, 50, 9, 'rock');
  hang(m, 26, 28, 50, 4, 'rock');
  // (gap 29-33: open to the air below)

  // The volcano: slopes up to a crater full of lava, a tunnel through its base.
  land(m, 34, 64, (x) => 27 + Math.max(0, Math.abs(x - 49) - 5) * 1.1, (x) => 52 - Math.abs(x - 49) * 0.2);
  hz.push(pool(m, 'lava', 46, 52, 27, 4, 'rock', 10));
  carve(m, 46, 18, 52, 26);                 // nothing over the crater
  carve(m, 34, 40, 64, 42);                 // the tunnel
  hang(m, 37, 61, 53, 10, 'rock');

  // East: floating rock steps, an iron bridge, a hot spring up top.
  island(m, 66, 74, 44, 3);
  fill(m, 74, 41, 77, 41, 'plank');
  island(m, 77, 84, 38, 3);
  island(m, 87, 97, 32, 5);
  hz.push(pool(m, 'water', 89, 93, 32, 3, 'rock', 8));
  fill(m, 96, 29, 97, 31, 'rock');
  hz.push(rect('lavafall', px(86) + 2, px(33), 26, px(80) - px(33)));

  // Sky: floating rocks (on chains) and grates.
  island(m, 13, 19, 26, 2, 'rock');
  island(m, 70, 75, 22, 2, 'rock');
  island(m, 88, 93, 16, 2, 'rock');
  fill(m, 40, 15, 45, 15, 'plank');
  for (const [x0, x1, y] of [[13, 19, 26], [70, 75, 22], [88, 93, 16]]) {
    decor.push(rect('chain', px(x0) + 8, 0, 6, px(y)), rect('chain', px(x1) + 18, 0, 6, px(y)));
  }

  // Under the map: broken islands over the lava sea.
  island(m, 8, 22, 63, 4, 'rock');
  island(m, 40, 56, 67, 5, 'rock');
  island(m, 70, 86, 61, 4, 'rock');
  island(m, 26, 32, 72, 2, 'rock');

  // Geysers and heat vents.
  hz.push(on(m, 'geyser', 3, 30, 16), on(m, 'geyser', 27, 30, 16), on(m, 'geyser', 80, 30, 16), on(m, 'geyser', 48, 60, 16));
  hz.push(point('vent', px(49) + 16, px(43)));          // inside the tunnel
  hz.push(on(m, 'vent', 16, 20), on(m, 'vent', 15, 55), on(m, 'vent', 78, 55), on(m, 'vent', 69, 40));

  const spawns = [
    point('player', px(16), px(22)),
    on(m, 'bot', 6, 30), on(m, 'bot', 26, 30), point('bot', px(44), px(43)), on(m, 'bot', 70, 30),
    on(m, 'bot', 81, 30), on(m, 'bot', 95, 20), on(m, 'bot', 12, 55), on(m, 'bot', 80, 55), on(m, 'bot', 50, 60),
  ];
  for (const x of [10, 27, 36, 62, 72, 84]) decor.push(on(m, 'spire', x, 20));
  decor.push(on(m, 'spire', 18, 55), on(m, 'spire', 84, 55), on(m, 'spire', 54, 60));
  for (const x of [6, 22, 38, 60, 67, 79, 94]) decor.push(on(m, 'rock', x, 20, 8));
  for (const x of [11, 46, 75]) decor.push(on(m, 'rock', x, 55, 10));
  for (const x of [7, 64, 82, 44]) decor.push(on(m, 'bones', x, x === 44 ? 60 : 20, 14));
  decor.push(rect('cave', px(34), px(40), px(31), px(3)));         // the volcano tunnel

  return tiledMap('hell-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}

// ---------------------------------------------------------------- out ----

const out = (rel, data) => {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log('wrote', rel);
};

seed = 101;
out('public/assets/tilesets/forest-tiles.png', tileset(paletteTiles(FOREST_PALETTE)));
seed = 202;
out('public/assets/tilesets/hell-tiles.png', tileset(paletteTiles(HELL_PALETTE)));
out('public/assets/maps/forest.json', JSON.stringify(forest()));
out('public/assets/maps/hell.json', JSON.stringify(hell()));
