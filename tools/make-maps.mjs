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
//   Glacier "Frostbite": floats on an endless icy sea (no void). A snowy peak
//     with an icicle cave and a sea cave, a frozen lake with thin spots, a
//     chasm with floes, a slippery glacier with crevasses down to the sea, a
//     grotto, an icicle overhang, igloos and penguins.
//   Desert "Dune Sea": dunes with quicksand, a mesa with an arch, an oasis,
//     a buried temple with a pillared chamber, islands underneath.
//   Catacombs: enclosed, all rock pieces (roof and floor, no void): three
//     levels of tunnels, shafts, two boulder ramps, burial niches, ossuaries
//     and a flooded crypt.
//   Graveyard: night, solid ground (no void): a hill of tombstones, a chapel
//     with a bell tower, fences, dead trees, open graves into a crypt.
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
  ice: 20, iceL: 21, iceR: 22, iceLR: 23, thin: 24,
};

// One tileset from a palette: every tile and its rounded versions.
function paletteTiles(p) {
  // p.rubble (Catacombs): every ground tile is rock pieces set in mortar.
  const rub = (c, k = 1) => () => rubble(hex(c), hex(p.mortar ?? 0x2b2622), k);
  const top = p.rubble ? rub(p.top, 1.05) : () => topped(hex(p.top), grain(hex(p.soil), 0.14, 0.06), p.topDepth ?? 7);
  const soil = p.rubble ? rub(p.soil) : () => grain(hex(p.soil), 0.14, 0.06);
  const rock = p.rubble ? rub(p.rock, 1.1) : () => stone(hex(p.rock), hex(p.crack));
  const sand = p.rubble ? rub(p.sand) : () => grain(hex(p.sand), 0.1, 0.06, hex(p.sandSpeck));
  const under = p.rubble ? rub(p.under, 0.9) : () => underside(hex(p.under), hex(p.roots));
  const deep = p.rubble ? rub(p.deep, 0.95)() : grain(hex(p.deep), 0.12, 0.08, hex(p.deepSpeck));
  const ice = () => iceTile(hex(p.ice ?? 0xa8dadc));
  return [
    top(),                                            // 1
    soil(),                                           // 2
    deep,                                             // 3
    sand(),                                           // 4
    planks(hex(p.plank), hex(p.plankGap)),            // 5
    under(),                                          // 6
    rock(),                                           // 7
    rounded(top(), ['tl']), rounded(top(), ['tr']), rounded(top(), ['tl', 'tr']),     // 8-10
    rounded(rock(), ['tl']), rounded(rock(), ['tr']), rounded(rock(), ['tl', 'tr']), // 11-13
    rounded(sand(), ['tl']), rounded(sand(), ['tr']), rounded(sand(), ['tl', 'tr']), // 14-16
    rounded(under(), ['bl']), rounded(under(), ['br']), rounded(under(), ['bl', 'br']), // 17-19
    ice(), rounded(ice(), ['tl']), rounded(ice(), ['tr']), rounded(ice(), ['tl', 'tr']), // 20-23
    thinIce(hex(p.ice ?? 0xcaf0f8)),                                                     // 24
  ];
}

// Rubble: irregular rock pieces set in dark mortar (Catacombs), each stone
// a slightly different shade, darker toward its edges.
function rubble(base, mortar, light = 1) {
  const pts = Array.from({ length: 7 }, () => [rand() * 32, rand() * 32, 0.82 + rand() * 0.32]);
  return (x, y) => {
    let d1 = 1e9;
    let d2 = 1e9;
    let k = 1;
    for (const [sx, sy, kk] of pts) {
      for (const ox of [-32, 0, 32]) {
        for (const oy of [-32, 0, 32]) {
          const d = Math.hypot(x - sx - ox, y - sy - oy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            k = kk;
          } else if (d < d2) d2 = d;
        }
      }
    }
    if (d2 - d1 < 1.5) return mortar;
    const edge = d2 - d1 < 3.5 ? 0.82 : 1;
    const lit = y < 10 && d2 - d1 > 3.5 ? 1.06 : 1; // a little highlight on top of each stone
    return shade(base, k * edge * lit * light * (0.95 + rand() * 0.08));
  };
}

// Ice: glossy, with diagonal shine streaks. (Slippery in game: Glacier.)
function iceTile(base) {
  const streaks = Array.from({ length: 3 }, () => Math.floor(rand() * 40) - 4);
  return (x, y) => {
    for (const s0 of streaks) if (Math.abs(x + y * 0.6 - s0) < 1.2) return shade(base, 1.25);
    return shade(base, 1.04 - (y / 32) * 0.12 + rand() * 0.05);
  };
}
// Thin ice: pale, see-through-ish, cracked (it breaks if you stand on it).
function thinIce(base) {
  const cracks = Array.from({ length: 3 }, () => [Math.floor(rand() * 28) + 2, rand() * 1.6 - 0.8]);
  return (x, y) => {
    if (y > 9) return [0, 0, 0, 0];                    // only a thin sheet on top
    for (const [cx, k] of cracks) if (Math.abs(x - cx - (y - 4) * k) < 0.7) return shade(base, 0.6);
    return [...shade(base, 1.08 + rand() * 0.05), 215];
  };
}

const FOREST_PALETTE = {
  top: 0x52b788, soil: 0x7f5539, deep: 0x6c757d, deepSpeck: 0x495057, sand: 0xe9c46a, sandSpeck: 0xd4a373,
  plank: 0xa47148, plankGap: 0x582f0e, under: 0x6f4518, roots: 0xb08968, rock: 0x8d99ae, crack: 0x4a4e69,
};
const HELL_PALETTE = {
  top: 0xff6b35, topDepth: 5, soil: 0x3d2b2b, deep: 0x1b1423, deepSpeck: 0x5a189a, sand: 0x6b5b55, sandSpeck: 0x4a3f3b,
  plank: 0x5c5c66, plankGap: 0x22222a, under: 0x2b1d1d, roots: 0xff7b00, rock: 0x4a2c2a, crack: 0xff7b00,
};

const GLACIER_PALETTE = {
  top: 0xf8f9fa, topDepth: 9, soil: 0x5c677d, deep: 0x33415c, deepSpeck: 0x0466c8, sand: 0xdee2e6, sandSpeck: 0xadb5bd,
  plank: 0x7f5539, plankGap: 0x432818, under: 0x3a506b, roots: 0xcaf0f8, rock: 0x7d8597, crack: 0x33415c, ice: 0xa8dadc,
};
const DESERT_PALETTE = {
  top: 0xf4d58d, topDepth: 8, soil: 0xd08c60, deep: 0x9c6644, deepSpeck: 0x7f5539, sand: 0xedc988, sandSpeck: 0xd4a373,
  plank: 0x8d5a2b, plankGap: 0x432818, under: 0xb5703f, roots: 0x7f4f24, rock: 0xc9743a, crack: 0x7f4f24,
};

const CATACOMBS_PALETTE = {
  rubble: true, mortar: 0x221e1b,
  top: 0x7d746a, soil: 0x6b6259, deep: 0x564f48, sand: 0x777069, under: 0x5e5650, rock: 0x8a8278,
  plank: 0x5c4033, plankGap: 0x2b1d14, crack: 0x2b2622,
};
const GRAVEYARD_PALETTE = {
  top: 0x3a5a40, topDepth: 7, soil: 0x4a3b2c, deep: 0x3b3a3f, deepSpeck: 0x2b2a2f, sand: 0x8a8580, sandSpeck: 0x6b6763,
  plank: 0x5c4033, plankGap: 0x2b1d14, under: 0x3b2f24, roots: 0x7f6a55, rock: 0x9aa0a6, crack: 0x5c6066,
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
      else if (m === 'ice') id = openTop ? pick(openL, openR, TILE.iceLR, TILE.iceL, TILE.iceR, TILE.ice) : TILE.ice;
      else if (m === 'thin') id = TILE.thin;
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


// ------------------------------------------------------------ Glacier ----
// 112 x 72 tiles. No void: the whole glacier floats on an endless icy sea
// (sea level row 54). Fall in and you can swim, but sink too deep and the
// cold dark takes you (the death line is deep under the surface).
function glacier() {
  W = 112;
  H = 72;
  seed = 4242;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];
  const SEA = 54;

  // West: a snowy peak with an ice cave through it (icicles), its foot in
  // the sea, and a half-flooded sea cave at the waterline.
  land(m, 2, 27, (x) => Math.min(36, 20 + Math.abs(x - 13) * 1.15), (x) => 58 + (x % 3 === 0 ? 1 : 0));
  carve(m, 2, 33, 24, 35);
  fill(m, 2, 36, 24, 36, 'ice');            // the cave floor is ice
  for (const x of [8, 13, 18, 22]) hz.push(point('icicle', px(x) + 16, px(33)));
  decor.push(rect('cave', px(2), px(33), px(23), px(3)));
  carve(m, 2, 49, 15, 55);                  // sea cave, open to the west
  fill(m, 2, 56, 15, 59, 'ice');
  for (const x of [6, 10]) hz.push(point('icicle', px(x) + 16, px(49)));
  decor.push(rect('cave', px(2), px(49), px(14), px(5)));

  // The frozen lake: solid ice with THIN SPOTS (traps: they break under
  // anyone, and blasts smash them) over freezing water. The shelf under it
  // goes down into the sea.
  fill(m, 28, 37, 56, 48, 'rock');
  carve(m, 29, 37, 55, 45);
  fill(m, 28, 36, 56, 36, 'ice');
  for (const [x0, x1] of [[31, 33], [40, 42], [51, 53]]) fill(m, x0, 36, x1, 36, 'thin');
  hz.push(rect('water', px(29), px(37), px(27), px(9)));
  land(m, 28, 56, () => 49, (x) => 57 + (x % 4 === 1 ? 1 : 0), 'ice');

  // A chasm straight down to the sea, with ice floes bobbing in it.
  island(m, 58, 62, SEA - 1, 2, 'ice');

  // East: a slippery glacier with crevasses down to the sea, a grotto at
  // the waterline, an icicle overhang, ice blocks and an igloo.
  land(m, 64, 100, (x) => 36 + (x < 66 ? 1 : 0) - (x > 94 ? 1 : 0), (x) => 57 + (x % 3 === 2 ? 1 : 0));
  fill(m, 66, 36, 94, 36, 'ice');
  carve(m, 70, 30, 72, 58);                 // crevasses: right down into the sea
  carve(m, 86, 30, 88, 58);
  carve(m, 73, 46, 85, 52);                 // the grotto (reach it from a crevasse)
  for (const x of [76, 80, 84]) hz.push(point('icicle', px(x) + 16, px(46)));
  decor.push(rect('cave', px(73), px(46), px(13), px(7)));
  fill(m, 67, 34, 68, 35, 'ice');
  fill(m, 90, 34, 91, 35, 'ice');
  fill(m, 74, 28, 84, 29, 'ice');           // the overhang
  for (const x of [76, 79, 82]) hz.push(point('icicle', px(x) + 16, px(30)));
  decor.push(rect('igloo', px(95), px(35) - 60, px(4), 60));

  // Open sea to the east with floes and a small berg.
  island(m, 103, 108, SEA - 1, 2, 'ice');
  fill(m, 104, SEA - 4, 106, SEA - 2, 'ice');

  // Sky: floating ice and a wooden bridge.
  island(m, 30, 37, 20, 3, 'ice');
  island(m, 60, 66, 16, 3, 'ice');
  island(m, 88, 95, 22, 3, 'ice');
  fill(m, 44, 26, 50, 26, 'plank');
  decor.push(rect('igloo', px(31), px(20) - 54, px(3), 54));

  // The sea itself: one big pool under everything.
  hz.push(rect('sea', 0, px(SEA), px(W), px(H - SEA)));

  const spawns = [
    point('player', px(80), px(12)),
    on(m, 'bot', 6, 20), on(m, 'bot', 26, 20), on(m, 'bot', 46, 30), on(m, 'bot', 76, 20), on(m, 'bot', 98, 20),
    on(m, 'bot', 33, 10), on(m, 'bot', 91, 10), point('bot', px(79) + 16, px(53)), point('bot', px(105) + 16, px(SEA - 4)),
  ];
  for (const x of [4, 9, 23, 65, 92, 99]) decor.push(on(m, 'pine', x, 10));
  for (const x of [17, 61, 75, 97]) decor.push(on(m, 'rock', x, 10, 8));
  for (const x of [36, 47, 68, 78, 82, 93, 107]) decor.push(on(m, 'penguin', x, x === 107 ? 40 : 30, 16));
  decor.push(on(m, 'penguin', 60, 40, 16));

  return tiledMap('glacier-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}

// ------------------------------------------------------------- Desert ----
// 112 x 80 tiles. Dunes, a mesa with an arch, an oasis, a buried temple.
function desert() {
  W = 112;
  H = 80;
  seed = 8080;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];

  // West: rolling dunes with a quicksand pit.
  land(m, 2, 34, (x) => (x >= 12 && x <= 22 ? 36 : 35 + Math.round(Math.sin(x / 4) * 1.6)), () => 46);
  hz.push(pool(m, 'quicksand', 14, 20, 36, 3, 'soil', 8));
  hang(m, 3, 33, 47, 6);

  // The mesa: tall flat-topped sandstone with an arch through its base.
  land(m, 36, 52, (x) => (x < 38 ? 30 : x > 50 ? 28 : 24), () => 46, 'rock');
  carve(m, 36, 33, 52, 35);                  // a natural arch: walk right under the mesa
  decor.push(rect('cave', px(36), px(33), px(17), px(3)));
  hang(m, 37, 51, 47, 6, 'rock');

  // The oasis: a dip with a pool (hide in it) and palms.
  land(m, 53, 67, () => 37, () => 45);
  hz.push(pool(m, 'water', 57, 63, 37, 4, 'soil', 10));
  hang(m, 53, 67, 46, 5);

  // The buried temple: a shaft down into a pillared chamber, a hole out the bottom.
  land(m, 68, 106, (x) => (x > 99 ? 35 : 35), () => 50);
  carve(m, 74, 39, 98, 45);                  // the chamber
  for (const x of [79, 85, 91]) fill(m, x, 39, x + 1, 45, 'rock'); // pillars
  for (const x of [79, 85, 91]) carve(m, x, 42, x + 1, 43);       // ...with gaps to walk through
  carve(m, 70, 35, 72, 45);                  // the way in
  carve(m, 73, 39, 73, 45);
  carve(m, 95, 46, 97, 50);                  // the way out the bottom
  hz.push(pool(m, 'quicksand', 101, 104, 35, 3, 'soil', 8));
  fill(m, 76, 33, 77, 34, 'rock');           // ruins on top
  fill(m, 88, 34, 89, 34, 'rock');
  fill(m, 82, 32, 82, 34, 'rock');
  decor.push(rect('cave', px(70), px(39), px(29), px(7)), rect('cave', px(70), px(35), px(3), px(4)), rect('cave', px(95), px(46), px(3), px(5)));
  hang(m, 68, 94, 51, 6);
  hang(m, 98, 106, 51, 5);

  // Sky: floating sandstone and wooden scaffolds.
  island(m, 20, 26, 20, 3, 'rock');
  island(m, 84, 92, 18, 3, 'rock');
  fill(m, 56, 26, 62, 26, 'plank');
  fill(m, 100, 24, 106, 24, 'plank');

  // Under the map.
  island(m, 6, 20, 58, 5);
  island(m, 36, 52, 60, 4, 'rock');
  island(m, 72, 88, 62, 5);
  island(m, 96, 108, 57, 4);

  const spawns = [
    point('player', px(60), px(14)),
    on(m, 'bot', 5, 20), on(m, 'bot', 30, 20), on(m, 'bot', 44, 10), on(m, 'bot', 66, 20),
    on(m, 'bot', 86, 40), on(m, 'bot', 108, 20), on(m, 'bot', 12, 50), on(m, 'bot', 80, 55), on(m, 'bot', 102, 50),
  ];
  for (const x of [8, 26, 39, 49, 75, 98, 107]) decor.push(on(m, 'cactus', x, 10, 16));
  decor.push(on(m, 'cactus', 15, 50, 16), on(m, 'cactus', 44, 50, 16));
  for (const x of [55, 66]) decor.push(on(m, 'palm', x, 20));
  for (const x of [4, 32, 69, 93, 109]) decor.push(on(m, 'rock', x, 10, 8));
  for (const x of [11, 83]) decor.push(on(m, 'bones', x, x === 83 ? 40 : 10, 14));
  for (const x of [6, 28, 58, 90, 104]) decor.push(on(m, 'scorpion', x, x === 90 ? 40 : 10, 16));
  // Dust devils wander along these stretches of open sand.
  hz.push(rect('dustdevil', px(2), px(28), px(32), px(8)), rect('dustdevil', px(68), px(27), px(38), px(8)));

  return tiledMap('desert-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}


// ---------------------------------------------------------- Catacombs ----
// 100 x 64 tiles. Enclosed: rock-piece roof above, rock-piece floor below,
// no void. Three levels of tunnels joined by shafts and two long sloping
// ramps that boulders roll down. A flooded crypt at the bottom.
function catacombs() {
  W = 100;
  H = 64;
  seed = 1313;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];
  fill(m, 0, 0, W - 1, H - 1, 'soil');      // solid rock everywhere, then dig

  // Upper gallery, with a few pillars holding the roof.
  carve(m, 3, 6, 96, 13);
  for (const x of [30, 52, 74]) fill(m, x, 6, x + 1, 13, 'rock');
  for (const x of [30, 52, 74]) carve(m, x, 11, x + 1, 13);       // you can pass under them
  // Ramp 1: from the gallery's west end, sloping down to the middle hall.
  for (let x = 6; x <= 50; x++) {
    const floor = 13 + Math.floor((x - 6) / 3);
    carve(m, x, floor - 5, x, floor);
  }
  // Middle hall.
  carve(m, 46, 22, 96, 28);
  // Ramp 2: from the middle hall's east end, sloping down west to the crypt.
  for (let x = 50; x <= 94; x++) {
    const floor = 28 + Math.floor((94 - x) / 3);
    carve(m, x, floor - 5, x, floor);
  }
  // Lower crypt hall (stone coffins along it).
  carve(m, 4, 37, 62, 43);
  // The flooded crypt at the bottom.
  carve(m, 64, 46, 96, 55);
  hz.push(rect('water', px(64), px(51), px(33), px(5)));
  carve(m, 60, 43, 66, 46);                 // the way down to it
  // Shafts between levels.
  carve(m, 18, 13, 20, 37);
  carve(m, 86, 13, 88, 22);
  carve(m, 38, 43, 40, 52);
  carve(m, 30, 50, 62, 55);                 // a low tunnel under the crypt hall
  carve(m, 20, 50, 30, 52);
  // Side chambers (ossuaries).
  carve(m, 3, 22, 14, 28);
  carve(m, 14, 25, 18, 28);
  // Rubble heaps and fallen stones on the floors (cover).
  for (const [x, y] of [[42, 13], [64, 13], [60, 28], [80, 28], [28, 43], [50, 43], [76, 55]]) fill(m, x, y - 1, x + 1, y - 1, 'rock');
  fill(m, 64, 12, 64, 12, 'rock');

  // Boulders: they start at the top of each ramp, roll down it and smash
  // against the far wall. A lever at each top shows a word: type it to
  // send the boulder early.
  hz.push(point('boulderR', px(8) + 16, px(13) - 30));
  hz.push(point('boulderL', px(92) + 16, px(28) - 30));

  const spawns = [
    point('player', px(48), px(13)),
    point('bot', px(8), px(13)), point('bot', px(90), px(13)), point('bot', px(70), px(28)),
    point('bot', px(10), px(43)), point('bot', px(50), px(43)), point('bot', px(80), px(55)),
    point('bot', px(8), px(28)), point('bot', px(25), px(52)),
  ];
  for (const [x, y] of [[5, 28], [9, 28], [12, 28], [22, 43], [46, 43], [58, 43], [40, 55]]) decor.push(point('bones', px(x) + 16, px(y)));
  for (const x of [9, 16, 25, 35, 44, 56]) decor.push(point('coffin', px(x) + 16, px(44)));
  for (const x of [5, 11]) decor.push(point('coffin', px(x) + 16, px(29)));
  for (const [x, y] of [[3, 6], [96, 6], [46, 22], [96, 22], [4, 37], [62, 37], [64, 46]]) decor.push(point('cobweb', px(x), px(y)));
  for (const [x, y] of [[22, 13], [60, 13], [84, 13], [70, 28], [14, 43], [52, 43], [90, 55]]) decor.push(point('candles', px(x) + 16, px(y)));
  for (const x of [10, 40, 70]) decor.push(rect('chain', px(x) + 13, px(6), 6, 96));

  return tiledMap('catacombs-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}

// ---------------------------------------------------------- Graveyard ----
// 110 x 62 tiles, at night. No void: solid ground to the bottom of the
// map. A hill of graves, a chapel with a bell tower, iron fences, dead
// trees, and a crypt under it all that open graves lead down into.
function graveyard() {
  W = 110;
  H = 62;
  seed = 1031;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];
  const S = 40; // the main ground level

  // The ground: rolling, a hill in the middle, solid down to the bottom.
  land(m, 0, W - 1, (x) => S - Math.round(Math.max(0, 7 - Math.abs(x - 55) / 4)) + Math.round(Math.sin(x / 5) * 0.8), () => H - 1);
  // The crypt under the hill, and its tunnels.
  carve(m, 22, 46, 70, 53);
  carve(m, 70, 49, 92, 53);
  for (const x of [30, 46, 60]) fill(m, x, 46, x + 1, 53, 'rock');   // crypt pillars
  for (const x of [30, 46, 60]) carve(m, x, 50, x + 1, 53);
  decor.push(rect('cave', px(22), px(46), px(49), px(8)), rect('cave', px(70), px(49), px(23), px(5)));
  // Open graves: holes down into the crypt.
  for (const x of [26, 40, 64]) {
    const top = topAt(m, x, 0);
    carve(m, x, top, x + 1, 46);
    decor.push(rect('cave', px(x), px(top), px(2), px(46 - top)));
  }

  // Tombstones: solid stone, they block bullets (rows of them on the hill).
  for (let x = 30; x <= 80; x += 3) {
    if ([40, 41, 64, 65].includes(x) || (x > 72 && x < 92)) continue;
    const top = topAt(m, x, 0);
    fill(m, x, top - (x % 2 ? 2 : 1), x, top - 1, 'rock');
  }
  for (const x of [8, 12, 16, 98, 102]) fill(m, x, topAt(m, x, 0) - 1, x, topAt(m, x, 0) - 1, 'rock');

  // The chapel: stone walls, a door each side, a wooden floor upstairs,
  // and the bell tower going up from its east end.
  const cTop = topAt(m, 80, 0);
  for (let x = 72; x <= 92; x++) {           // level ground for the chapel
    carve(m, x, 0, x, cTop - 1);
    fill(m, x, cTop, x, cTop + 6, 'soil');
  }
  fill(m, 74, cTop - 10, 74, cTop - 1, 'rock');
  fill(m, 90, cTop - 10, 90, cTop - 1, 'rock');
  carve(m, 74, cTop - 2, 74, cTop - 1);      // doors
  carve(m, 90, cTop - 2, 90, cTop - 1);
  fill(m, 74, cTop - 11, 90, cTop - 11, 'plank'); // roof
  fill(m, 75, cTop - 6, 82, cTop - 6, 'plank');   // the upstairs floor
  fill(m, 86, cTop - 24, 86, cTop - 12, 'rock');  // the tower
  fill(m, 89, cTop - 24, 89, cTop - 12, 'rock');
  fill(m, 86, cTop - 25, 89, cTop - 25, 'plank');
  carve(m, 89, cTop - 22, 89, cTop - 15);    // the belfry's open side (see and ring the bell)
  carve(m, 87, cTop - 11, 88, cTop - 11);    // a hole in the roof up into the tower
  decor.push(rect('cave', px(75), px(cTop - 10), px(15), px(10)), rect('cave', px(87), px(cTop - 24), px(2), px(13)));
  hz.push(point('bell', px(87) + 32, px(cTop - 20)));

  // Iron fences and grabbing hands.
  for (const [x0, x1] of [[2, 20], [94, 108]]) decor.push(rect('fence', px(x0), px(topAt(m, x0, 0)) - 40, px(x1 - x0), 40));
  hz.push(rect('hands', px(28), px(S - 8), px(44), px(8)), rect('hands', px(4), px(S - 2), px(18), px(3)), rect('hands', px(94), px(S - 2), px(14), px(3)));

  // Floating rubble from the old tower and a tree house of planks.
  island(m, 40, 46, 22, 2, 'rock');
  island(m, 60, 66, 20, 2, 'rock');
  fill(m, 10, 28, 15, 28, 'plank');
  fill(m, 96, 27, 101, 27, 'plank');

  const spawns = [
    point('player', px(55), px(18)),
    on(m, 'bot', 5), on(m, 'bot', 20), on(m, 'bot', 36), on(m, 'bot', 70), on(m, 'bot', 96), on(m, 'bot', 106),
    point('bot', px(35), px(53)), point('bot', px(80), px(53)), on(m, 'bot', 43, 10),
  ];
  for (const x of [6, 22, 49, 69, 100]) decor.push(on(m, 'deadtree', x, 0));
  for (const x of [11, 15, 28, 52, 58, 97]) decor.push(on(m, 'cross', x, 0, 12));
  for (const x of [4, 24, 72, 92, 108]) decor.push(on(m, 'lantern', x, 0, 16));
  for (const [x, y] of [[35, 53], [54, 53], [84, 53]]) decor.push(point('bones', px(x), px(y)), point('candles', px(x) + 40, px(y)));
  decor.push(rect('fog', 0, px(S - 6), px(W), px(6)));

  return tiledMap('graveyard-tiles', m, [
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
seed = 303;
out('public/assets/tilesets/glacier-tiles.png', tileset(paletteTiles(GLACIER_PALETTE)));
seed = 404;
out('public/assets/tilesets/desert-tiles.png', tileset(paletteTiles(DESERT_PALETTE)));
seed = 505;
out('public/assets/tilesets/catacombs-tiles.png', tileset(paletteTiles(CATACOMBS_PALETTE)));
seed = 606;
out('public/assets/tilesets/graveyard-tiles.png', tileset(paletteTiles(GRAVEYARD_PALETTE)));
out('public/assets/maps/forest.json', JSON.stringify(forest()));
out('public/assets/maps/hell.json', JSON.stringify(hell()));
out('public/assets/maps/glacier.json', JSON.stringify(glacier()));
out('public/assets/maps/desert.json', JSON.stringify(desert()));
out('public/assets/maps/catacombs.json', JSON.stringify(catacombs()));
out('public/assets/maps/graveyard.json', JSON.stringify(graveyard()));
