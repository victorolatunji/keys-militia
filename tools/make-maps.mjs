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
  ice: 20, iceL: 21, iceR: 22, iceLR: 23, thin: 24, crumble: 25, hidden: 26,
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
    crumbleTile(hex(p.crumble ?? p.rock), hex(p.crack)),                                 // 25 cracked, crumbling stone
    () => [0, 0, 0, 0],                                                                  // 26 solid but invisible (a drawn roof sits on it)
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

// Crumbling stone (old stairs and bridges): a cracked slab with chips
// missing at the edges. It breaks if you stand on it (see THIN_ICE).
function crumbleTile(base, crack) {
  const cracks = Array.from({ length: 5 }, () => [Math.floor(rand() * 28) + 2, Math.floor(rand() * 10), rand() * 1.4 - 0.7]);
  const chips = Array.from({ length: 4 }, () => [Math.floor(rand() * 32), rand() < 0.5 ? 0 : 31]);
  return (x, y) => {
    for (const [cx, cy] of chips) if (Math.abs(x - cx) < 3 && Math.abs(y - cy) < 3) return [0, 0, 0, 0];
    if (y > 25) return [0, 0, 0, 0]; // a thin old slab, not a full block
    for (const [cx, cy, k] of cracks) if (y >= cy && Math.abs(x - cx - (y - cy) * k) < 0.8) return crack;
    return shade(base, (y < 3 ? 1.1 : 0.95) + rand() * 0.08 - y * 0.006);
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

const MONASTERY_PALETTE = {
  top: 0xb7a99a, topDepth: 6, soil: 0x8d8173, deep: 0x6f655b, deepSpeck: 0x5a524a, sand: 0xc2b6a3, sandSpeck: 0xa89d8b,
  plank: 0x8c2f1e, plankGap: 0x4a1a10, under: 0x7a6f63, roots: 0x5a6b3a, rock: 0x9c9287, crack: 0x4e463f, crumble: 0xa9a094,
};
const WASTELAND_PALETTE = {
  top: 0x4a4a4f, topDepth: 6, soil: 0x7d7a73, deep: 0x5e5b55, deepSpeck: 0x3d3b37, sand: 0x8c7b5e, sandSpeck: 0x6b5d45,
  plank: 0x6b4f2e, plankGap: 0x2b1d14, under: 0x5e5b55, roots: 0x8c5a2b, rock: 0x8a4b2a, crack: 0x3d2416, crumble: 0x8f8b82,
};

const SKY_PALETTE = {
  top: 0x70c26a, topDepth: 6, soil: 0x9c6b3f, deep: 0x7a5230, deepSpeck: 0x5e3e22, sand: 0xe0c98a, sandSpeck: 0xc4ab6c,
  plank: 0x8a5a2b, plankGap: 0x4a2f14, under: 0x6e4a2a, roots: 0x5a7a3a, rock: 0xa7a9ac, crack: 0x6b6d70, crumble: 0xb0a99a,
};
const CAMP_PALETTE = {
  top: 0x6a7f3a, topDepth: 7, soil: 0x6b5236, deep: 0x564330, deepSpeck: 0x3f3122, sand: 0xc2a878, sandSpeck: 0xa08a5e,
  plank: 0x8a6a42, plankGap: 0x3f2d18, under: 0x5a4430, roots: 0x7f6a55, rock: 0x8a8578, crack: 0x4a4740, crumble: 0x9a9488,
};
const SPACE_PALETTE = {
  top: 0xc9c9d6, topDepth: 5, soil: 0x8e8ea3, deep: 0x5f5f75, deepSpeck: 0x45455a, sand: 0xb8b8c8, sandSpeck: 0x9a9aac,
  plank: 0x6c7a89, plankGap: 0x2f3742, under: 0x55556a, roots: 0x3d3d52, rock: 0x6d5a7a, crack: 0x3f3248, crumble: 0x9a9aac,
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
// A slim floor: `thick` tiles of `mat` from row `row` (3-level maps).
function slab(mats, x0, x1, row, thick = 2, mat = 'soil') {
  fill(mats, x0, row, x1, row + thick - 1, mat);
}
// Slim stairs climbing from (x, rowBottom) up to rowTop, one step per
// column in direction dir (a diagonal band two tiles thick, air under it).
function stairs(mats, x, rowBottom, rowTop, dir, mat = 'soil') {
  for (let i = 0; i <= rowBottom - rowTop; i++) fill(mats, x + dir * i, rowBottom - i, x + dir * i, Math.min(rowBottom, rowBottom - i + 1), mat);
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
      else if (m === 'crumble') id = TILE.crumble;
      else if (m === 'hidden') id = TILE.hidden;
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
  carve(m, 2, 33, 22, 36);                  // the tunnel (4 tiles tall), open at both ends
  fill(m, 2, 37, 4, 37, 'rock');            // a lip at the west mouth
  fill(m, 23, 26, 26, 27, 'rock');          // rock lip the waterfall pours off
  hang(m, 3, 21, 45, 6);
  carve(m, 5, 24, 8, 33);                    // a well from the hilltop down into the tunnel (shortcut)
  // Beach under the tunnel's east mouth, then the lake in a stone bed.
  fill(m, 22, 37, 25, 49, 'rock');
  hz.push(pool(m, 'water', 26, 47, 38, 10, 'rock'));
  fill(m, 33, 45, 36, 47, 'rock');          // a sunken boulder in the lake
  fill(m, 41, 46, 44, 47, 'rock');          // uneven lake bed
  hz.push(rect('waterfall', px(26) + 4, px(28), 26, px(10) + 10));
  // A tunnel under the lake: a stone band below its bed with a passage
  // through it (4 tall), open at both ends.
  fill(m, 20, 49, 50, 56, 'rock');
  carve(m, 20, 51, 50, 54);
  decor.push(rect('cave', px(20), px(51), px(31), px(4)));
  hang(m, 22, 48, 57, 4, 'rock');

  // Meadow: rolling ground, boulders, a shaft down, a treehouse.
  land(m, 49, 70, (x) => 36 + Math.round(Math.sin((x - 49) / 3.2) * 1.3), () => 43);
  carve(m, 58, 30, 61, 43);                  // shaft
  hang(m, 49, 57, 44, 6);
  hang(m, 62, 70, 44, 7);
  fill(m, 50, 28, 56, 28, 'plank');         // treehouse floor
  fill(m, 63, 31, 67, 31, 'plank');
  // (gap 71-76: the chasm, open to the air below)

  // East highland: higher and rockier, a pond on top, a shaft, a rock pile.
  land(m, 77, 106, (x) => 34 - (x > 101 ? 1 : 0) + (x < 80 ? 1 : 0), () => 41);
  carve(m, 88, 30, 91, 41);                  // shaft
  hz.push(pool(m, 'water', 95, 100, 34, 3, 'sand', 8));

  hang(m, 77, 88, 42, 6);
  hang(m, 92, 106, 42, 6);

  // Sky: grassy islands and planks up high.
  island(m, 30, 38, 18, 3);
  island(m, 60, 67, 13, 3);
  island(m, 86, 93, 20, 3);
  fill(m, 12, 18, 17, 18, 'plank');
  fill(m, 100, 24, 105, 24, 'plank');

  // The lower floor: rolling forest ground to fight on (so you don't just
  // fall into the river gorge when the jetpack runs dry), a hill with a
  // tunnel through it, a pond, and two gaps down to the void.
  land(m, 2, W - 3, (x) => (x >= 18 && x <= 52 ? 64 : 62) + Math.round(Math.sin(x / 5) * 1.5 + Math.sin(x / 13) * 1.2), () => 69);
  land(m, 86, 100, (x) => 56 + Math.round(Math.abs(x - 93) * 0.6), () => 62);
  carve(m, 86, 58, 100, 61);                    // the tunnel through the hill
  decor.push(rect('cave', px(86), px(58), px(15), px(4)));
  hz.push(pool(m, 'water', 56, 62, topAt(m, 59, 57), 3, 'soil', 8));   // the pond (the meadow shaft drops into it)
  for (const [a, b] of [[30, 34], [73, 77]]) carve(m, a, 50, b, H - 1); // gaps down to the void

  const spawns = [
    point('player', px(64), px(9)),
    on(m, 'bot', 12), on(m, 'bot', 54, 20), on(m, 'bot', 80, 20), on(m, 'bot', 102, 26),
    on(m, 'bot', 13, 50), on(m, 'bot', 69, 50), on(m, 'bot', 106, 50), on(m, 'bot', 33, 10), on(m, 'bot', 90, 10),
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

  // War: the first outbreak. Sandbag lines, burnt trees, shell craters, a downed helicopter.
  decor.push(on(m, 'sandbags', 10, 22), on(m, 'sandbags', 81, 22), on(m, 'heliwreck', 52, 29), on(m, 'supplycrates', 22, 22));
  for (const x of [16, 50, 98]) decor.push(on(m, 'burnttree', x, 22));
  for (const x of [12, 68, 94]) decor.push(on(m, 'crater', x, 22));
  decor.push(on(m, 'barbed', 85, 22), on(m, 'helmetcross', 4, 22));
  // A little war on the lower floor too (not too much).
  decor.push(on(m, 'sandbags', 44, 50), on(m, 'crater', 66, 50), on(m, 'burnttree', 106, 50));
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
  carve(m, 22, 40, 25, 49);
  hang(m, 2, 22, 50, 9, 'rock');
  hang(m, 26, 28, 50, 4, 'rock');
  // (gap 29-33: open to the air below)

  // The volcano: slopes up to a crater full of lava, a tunnel through its base.
  land(m, 34, 64, (x) => 27 + Math.max(0, Math.abs(x - 49) - 5) * 1.1, (x) => 52 - Math.abs(x - 49) * 0.2);
  hz.push(pool(m, 'lava', 46, 52, 27, 4, 'rock', 10));
  carve(m, 46, 18, 52, 26);                 // nothing over the crater
  carve(m, 34, 39, 64, 42);                 // the tunnel
  hang(m, 37, 61, 53, 10, 'rock');

  // East: floating rock steps, an iron bridge, a hot spring up top.
  island(m, 66, 74, 44, 3);
  fill(m, 74, 41, 77, 41, 'plank');
  island(m, 77, 84, 38, 3);
  island(m, 87, 97, 32, 5);
  hz.push(pool(m, 'water', 89, 93, 32, 3, 'rock', 8));
  fill(m, 96, 29, 97, 31, 'rock');

  // Sky: floating rocks (on chains) and grates.
  island(m, 13, 19, 26, 2, 'rock');
  island(m, 70, 75, 22, 2, 'rock');
  island(m, 88, 93, 16, 2, 'rock');
  fill(m, 40, 15, 45, 15, 'plank');
  for (const [x0, x1, y] of [[13, 19, 26], [70, 75, 22], [88, 93, 16]]) {
    decor.push(rect('chain', px(x0) + 8, 0, 6, px(y)), rect('chain', px(x1) + 18, 0, 6, px(y)));
  }

  // The lower floor: broken basalt ground over the lava sea, uneven, with a
  // lava pit and two gaps down into the lava.
  land(m, 2, W - 3, (x) => (x >= 36 && x <= 62 ? 70 : 68) + Math.round(Math.sin(x / 6) * 1.4 + Math.sin(x / 15) * 1.2), () => 76, 'rock'); // lower under the volcano: room to fly
  hz.push(pool(m, 'lava', 40, 46, topAt(m, 43, 60), 3, 'rock', 10));
  for (const [a, b] of [[29, 33], [64, 68]]) carve(m, a, 60, b, H - 1);
  // The lavafall: it pours off the east ledge into a lava pool on the lower
  // floor (it used to pour straight through the floor).
  const fallTop = topAt(m, 86, 60);
  hz.push(pool(m, 'lava', 84, 90, fallTop, 3, 'rock', 10));
  hz.push(rect('lavafall', px(86) + 2, px(33), 26, px(fallTop) - px(33) + 10));

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

  // War: Syndicate machines melted in the heat, craters, a downed helicopter.
  decor.push(on(m, 'truckwreck', 8, 30), on(m, 'heliwreck', 92, 25), on(m, 'supplycrates', 70, 30), on(m, 'hedgehog', 26, 30));
  for (const x of [20, 40, 60]) decor.push(on(m, 'crater', x, 30));
  decor.push(on(m, 'truckwreck', 92, 60), on(m, 'crater', 18, 60));
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
  carve(m, 2, 32, 24, 35);
  fill(m, 2, 36, 24, 36, 'ice');            // the cave floor is ice
  for (const x of [8, 13, 18, 22]) hz.push(point('icicle', px(x) + 16, px(32)));
  decor.push(rect('cave', px(2), px(32), px(23), px(4)));
  carve(m, 2, 49, 15, 55);                  // sea cave, open to the west
  carve(m, 3, 36, 6, 48);                   // a crack from the ice cave down to it (no dead end)
  fill(m, 2, 56, 15, 59, 'ice');
  for (const x of [6, 10]) hz.push(point('icicle', px(x) + 16, px(40)));

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
  carve(m, 69, 30, 72, 58);                 // crevasses: right down into the sea (4 wide)
  carve(m, 85, 30, 88, 58);
  carve(m, 73, 46, 85, 52);                 // the grotto (reach it from a crevasse)
  for (const x of [76, 80, 84]) hz.push(point('icicle', px(x) + 16, px(40)));
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

  // The lower layer, between the ice sheets and the sea: its walls are ice
  // you pass through (pale and see-through). Under them, slabs of ice at
  // the waterline to stand and fight on, with open water between them.
  const passIce = (x0, x1, from) => {
    carve(m, x0, from, x1, H - 1);
    decor.push(rect('icewall', px(x0), px(from), px(x1 - x0 + 1), px(SEA - 2 - from)));
  };
  passIce(2, 27, 40);
  passIce(28, 56, 49);   // under the frozen lake's basin
  passIce(64, 100, 40);
  for (const [a, b] of [[2, 30], [35, 56], [64, 68], [73, 84], [89, 100]]) fill(m, a, SEA - 2, b, SEA - 1, 'ice');

  const spawns = [
    point('player', px(80), px(12)),
    on(m, 'bot', 6, 20), on(m, 'bot', 26, 20), on(m, 'bot', 46, 30), on(m, 'bot', 76, 20), on(m, 'bot', 98, 20),
    on(m, 'bot', 33, 10), on(m, 'bot', 91, 10), point('bot', px(79) + 16, px(SEA - 2)), point('bot', px(105) + 16, px(SEA - 4)),
  ];
  for (const x of [4, 9, 23, 65, 92, 99]) decor.push(on(m, 'pine', x, 10));
  for (const x of [17, 61, 75, 97]) decor.push(on(m, 'rock', x, 10, 8));
  for (const x of [36, 47, 68, 78, 82, 93, 107]) decor.push(on(m, 'penguin', x, x === 107 ? 40 : 30, 16));
  decor.push(on(m, 'penguin', 60, 40, 16));

  // War: the frozen research station after the fighting: a downed helicopter, abandoned gear.
  // (Nothing on the frozen lake: you need to see the ice crack.)
  decor.push(on(m, 'heliwreck', 66, 30), on(m, 'supplycrates', 90, 30), on(m, 'helmetcross', 101, 30), on(m, 'sandbags', 14, 46));
  decor.push(on(m, 'crater', 80, 30));
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
  carve(m, 32, 0, 35, 54);                   // the gap by the mesa: 4 wide, room for two
  carve(m, 36, 32, 52, 35);                  // a natural arch: walk right under the mesa
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
  for (const x of [79, 85, 91]) carve(m, x, 41, x + 1, 44);       // ...with gaps to walk through
  carve(m, 68, 35, 73, 45);                  // the way in (6 wide: room for two)
  carve(m, 73, 39, 73, 45);
  carve(m, 93, 46, 98, 50);                  // the way out the bottom (6 wide)
  hz.push(pool(m, 'quicksand', 101, 104, 35, 3, 'soil', 8));
  decor.push(rect('cave', px(70), px(39), px(29), px(7)), rect('cave', px(70), px(35), px(3), px(4)), rect('cave', px(95), px(46), px(3), px(5)));
  hang(m, 68, 94, 51, 6);
  hang(m, 98, 106, 51, 5);

  // Sky: floating sandstone and wooden scaffolds.
  island(m, 20, 26, 20, 3, 'rock');
  island(m, 84, 92, 18, 3, 'rock');
  fill(m, 56, 26, 62, 26, 'plank');
  fill(m, 100, 24, 106, 24, 'plank');

  // The lower floor: rolling dunes under the mesa and the temple (the
  // temple's way out drops you here), a quicksand pit, two gaps to the void.
  land(m, 2, W - 3, (x) => (x >= 66 && x <= 96 ? 64 : 62) + Math.round(Math.sin(x / 7) * 1.5 + Math.sin(x / 17) * 1.2), () => 71); // lower under the temple: room to fly
  hz.push(pool(m, 'quicksand', 50, 55, topAt(m, 52, 57), 3, 'soil', 8));
  for (const [a, b] of [[28, 32], [84, 88]]) carve(m, a, 55, b, H - 1);

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

  // War: the Syndicate convoy: burnt-out trucks, anti-tank hedgehogs, sandbags, craters.
  decor.push(on(m, 'truckwreck', 28, 27), on(m, 'truckwreck', 90, 27), on(m, 'sandbags', 54, 27), on(m, 'barbed', 74, 27));
  for (const x of [8, 64]) decor.push(on(m, 'hedgehog', x, 27));
  for (const x of [24, 82]) decor.push(on(m, 'crater', x, 27));
  decor.push(on(m, 'hedgehog', 40, 55), on(m, 'sandbags', 100, 55), on(m, 'crater', 72, 55));
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
  for (const x of [30, 52, 74]) carve(m, x, 10, x + 1, 13);       // you can pass under them
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
  carve(m, 17, 13, 20, 37);
  carve(m, 85, 13, 88, 22);
  carve(m, 37, 43, 40, 52);
  carve(m, 30, 50, 62, 55);                 // a low tunnel under the crypt hall
  carve(m, 20, 49, 30, 52);
  // Side chambers (ossuaries).
  carve(m, 3, 22, 14, 28);
  carve(m, 14, 25, 18, 28);
  // Rubble heaps and fallen stones on the floors (cover).
  // (No rubble heaps: the halls stay clear to run through.)

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
  for (const [x, row] of [[8, 6], [90, 6], [50, 22], [92, 22], [8, 37], [60, 37], [70, 46]]) decor.push(on(m, 'sconce', x, row));
  for (const [x, y] of [[22, 13], [60, 13], [84, 13], [70, 28], [14, 43], [52, 43], [90, 55]]) decor.push(point('candles', px(x) + 16, px(y)));
  for (const x of [10, 40, 70]) decor.push(rect('chain', px(x) + 13, px(6), 6, 96));

  // War: the militia hunting the source: supply crates, sandbags, spray-painted arrows.
  decor.push(on(m, 'supplycrates', 5, 6), on(m, 'sandbags', 80, 22), on(m, 'lantern', 44, 37), on(m, 'helmetcross', 60, 37));
  for (const [x, row] of [[36, 6], [70, 22], [20, 37], [56, 37]]) decor.push(on(m, 'skullniche', x, row));
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

  // The ground: a walkable floor with a low, gentle rise in the middle
  // (one step every few tiles), solid down to the bottom.
  land(m, 0, W - 1, (x) => S - Math.round(Math.max(0, 3 - Math.abs(x - 52) / 7)), () => H - 1);
  // The crypt under the hill, and its tunnels.
  carve(m, 22, 46, 70, 53);
  carve(m, 70, 49, 92, 53);
  // Sloping tunnels from both ends of the crypt up to the surface (west and
  // east), climbing a step every few tiles, 4 tiles tall.
  const slopeTunnel = (x0, floor0, dir, toRow) => {
    for (let i = 0; ; i++) {
      const x = x0 + dir * i;
      const floor = floor0 - Math.floor(i * 0.75);
      if (x < 1 || x > W - 2 || floor < toRow) break;
      carve(m, x, floor - 3, x, floor);
      decor.push(rect('cave', px(x), px(floor - 3), px(1), px(4)));
    }
  };
  slopeTunnel(21, 53, -1, S - 1);
  slopeTunnel(93, 53, 1, S - 1);
  for (const x of [30, 46, 60]) fill(m, x, 46, x + 1, 53, 'rock');   // crypt pillars
  for (const x of [30, 46, 60]) carve(m, x, 50, x + 1, 53);
  decor.push(rect('cave', px(22), px(46), px(49), px(8)), rect('cave', px(70), px(49), px(23), px(5)));
  // Open graves: holes down into the crypt.
  for (const x of [26, 40, 64]) {
    const top = topAt(m, x, 0);
    carve(m, x, top, x + 3, 46);
    decor.push(rect('cave', px(x), px(top), px(4), px(46 - top)));
  }

  // Hollow graves: open trenches dug into the ground (drop in for cover),
  // a wooden coffin lying in some of them.
  const trenches = [[9, true], [34, true], [57, false], [104, true]];
  for (const [x, coffin] of trenches) {
    const top = topAt(m, x, 0);
    carve(m, x, top, x + 3, top + 1);
    decor.push(rect('cave', px(x), px(top), px(4), px(2)));
    if (coffin) hz.push(point('coffin', px(x) + 64, px(top + 2)));
  }
  const inTrench = (x) => trenches.some(([t]) => x >= t - 1 && x <= t + 4) || [26, 40, 64].some((g) => x >= g - 1 && x <= g + 4);

  // Tombstones on the hill. Solid grey stone ones block bullets; every third
  // is a dark, see-through "shadow" grave you pass right through.
  for (let x = 30; x <= 72; x += 6) {
    if ([40, 41, 64, 65].includes(x) || inTrench(x)) continue;
    const top = topAt(m, x, 0);
    const tall = 1;
    if ((x / 6) % 2 === 1) decor.push(rect('ghoststone', px(x), px(top - tall), px(1), px(tall)));
    else fill(m, x, top - tall, x, top - 1, 'rock');
  }
  // Coffins lying about on the ground.
  for (const x of [20, 79, 104]) hz.push(point('coffin', px(x) + 16, px(topAt(m, x, 0))));
  for (const x of [14, 103]) decor.push(rect('ghoststone', px(x), px(topAt(m, x, 0) - 1), px(1), px(1)));

  // The chapel: stone walls, a door each side, a wooden floor upstairs,
  // and the bell tower going up from its east end.
  const cTop = topAt(m, 80, 0);
  for (let x = 72; x <= 92; x++) {           // level ground for the chapel
    carve(m, x, 0, x, cTop - 1);
    fill(m, x, cTop, x, cTop + 6, 'soil');
  }
  fill(m, 74, cTop - 10, 74, cTop - 1, 'rock');
  fill(m, 90, cTop - 10, 90, cTop - 1, 'rock');
  carve(m, 74, cTop - 4, 74, cTop - 1);      // doors (4 tall)
  carve(m, 90, cTop - 4, 90, cTop - 1);
  fill(m, 74, cTop - 11, 90, cTop - 11, 'plank'); // roof
  fill(m, 75, cTop - 6, 82, cTop - 6, 'plank');   // the upstairs floor
  // The tower's walls are drawn behind you (pass through them).
  decor.push(rect('stonewall', px(86), px(cTop - 24), px(1), px(13)), rect('stonewall', px(89), px(cTop - 24), px(1), px(13)));
  fill(m, 86, cTop - 25, 89, cTop - 25, 'plank');
  carve(m, 86, cTop - 11, 89, cTop - 11);    // a hole in the roof up into the tower
  decor.push(rect('cave', px(75), px(cTop - 10), px(15), px(10)), rect('cave', px(87), px(cTop - 24), px(2), px(13)));
  hz.push(point('bell', px(87) + 32, px(cTop - 20)));

  // Iron fences and grabbing hands.
  for (const [x0, x1] of [[2, 20], [94, 108]]) decor.push(rect('fence', px(x0), px(topAt(m, x0, 0)) - 40, px(x1 - x0), 40));
  hz.push(rect('hands', px(28), px(S - 8), px(44), px(8)), rect('hands', px(4), px(S - 2), px(18), px(3)), rect('hands', px(94), px(S - 2), px(14), px(3)));

  // The watch tower in the east: wooden legs standing on the ground (you
  // pass between them), two platforms with a hatch, a lookout roof. Nothing
  // floats: it all stands on the ground.
  const tTop = topAt(m, 98, 0);
  for (let x = 94; x <= 102; x++) {          // level ground under it
    carve(m, x, 0, x, tTop - 1);
    fill(m, x, tTop, x, tTop + 3, 'soil');
  }
  decor.push(rect('woodpost', px(94), px(tTop - 22), px(1), px(22)), rect('woodpost', px(102), px(tTop - 22), px(1), px(22)));
  fill(m, 94, tTop - 8, 102, tTop - 8, 'plank');  // lower platform...
  carve(m, 96, tTop - 8, 99, tTop - 8);          // ...with a hatch
  fill(m, 94, tTop - 16, 102, tTop - 16, 'plank'); // the lookout
  carve(m, 99, tTop - 16, 102, tTop - 16);      // a gap to climb through
  fill(m, 93, tTop - 23, 103, tTop - 23, 'plank'); // its roof

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

  // War: soldiers' graves (helmets on crosses), barbed wire, sandbags round the chapel, craters.
  for (const x of [20, 48, 66]) decor.push(on(m, 'helmetcross', x, 0, 16));
  decor.push(on(m, 'barbed', 24, 0), on(m, 'sandbags', 69, 0), on(m, 'supplycrates', 85, cTop - 9));
  for (const x of [30, 44]) decor.push(on(m, 'crater', x, 0));
  return tiledMap('graveyard-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}


// ---------------------------------------------------------- Monastery ----
// 110 x 66 tiles. A monastery built into a mountain, over a sea of cloud
// (the void). Three levels with plenty of air between them and slim floors:
//   level 1 (row 18): the temple halls' upper floors and a pagoda roof
//   level 2 (row 32): the courtyard, crumbling bridges over two gaps
//   level 3 (row 46): the lower terraces under the cliff
function monastery() {
  W = 110;
  H = 66;
  seed = 2020;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];
  const L1 = 18; // the temple roofs
  const L2 = 32; // the courtyard (and the temple floors)
  const L3 = 46; // the cloisters under the courtyard, the stupa terrace

  // The mountain: cliff walls at both edges.
  land(m, 0, 4, (x) => 8 + (x % 2), () => H - 1, 'rock');
  land(m, 105, 109, (x) => 7 + (x % 2), () => H - 1, 'rock');

  // Level 2: the stone courtyard, a built floor. Three openings in it drop
  // you down to the cloisters below (and you can fly back up through them).
  slab(m, 5, 104, L2, 4);
  for (const [a, b] of [[34, 37], [46, 49], [72, 75]]) carve(m, a, L2, b, L2 + 3);

  // Level 1: three temples standing on the courtyard, each a closed hall:
  // walls two tiles thick with a tall doorway at each end, a solid stepped
  // roof on top (it blocks you; walk and stand on it). One narrow shaft
  // through each roof is the shortcut between the hall and the roof.
  //   west: the scripture hall; middle: the Oracle's temple; east: the gong hall
  for (const [x0, x1] of [[9, 29], [44, 66], [81, 101]]) {
    slab(m, x0, x1, L1, 3);
    fill(m, x0, L1 + 3, x0 + 1, L2 - 1, 'rock');
    fill(m, x1 - 1, L1 + 3, x1, L2 - 1, 'rock');
    carve(m, x0, L2 - 4, x0 + 1, L2 - 1);       // doorways, 4 tiles tall
    carve(m, x1 - 1, L2 - 4, x1, L2 - 1);
    // The roof: the curved pagoda roof (drawn over a solid row, so it blocks
    // you and you can stand on it).
    fill(m, x0, L1 - 1, x1, L1 - 1, 'hidden');
    decor.push(rect('roof', px(x0) - 16, px(L1) - 34, px(x1 - x0 + 1) + 32, 34));
    // The shortcut shaft: off-centre, through the roof and the ceiling,
    // wide enough for two.
    const sx = x0 + 3;
    carve(m, sx, L1 - 1, sx + 3, L1 + 2);
    decor.push(rect('roofhatch', px(sx), px(L1 - 1), px(4), px(1)));
    decor.push(rect('cave', px(x0 + 2), px(L1 + 3), px(x1 - x0 - 3), px(L2 - L1 - 3)));
  }
  // The Oracle's pagoda: an upper tier on red posts over the middle temple,
  // a floor and its own solid stepped roof (a covered lookout, open sides).
  const P = L1 - 9;                           // its floor
  slab(m, 49, 61, P, 1, 'hidden');
  decor.push(rect('balcony', px(49), px(P), px(13), px(1)));
  fill(m, 49, P - 5, 61, P - 5, 'hidden');
  decor.push(rect('roof', px(49) - 16, px(P - 4) - 34, px(13) + 32, 34));
  for (const x of [49, 61]) {
    decor.push(rect('woodpost', px(x), px(P + 1), px(1), px(L1 - 1 - P - 1)));   // under the floor
    decor.push(rect('woodpost', px(x), px(P - 4), px(1), px(4)));                // under its roof
  }

  // Level 3: the cloisters, roofed by the courtyard (red columns you pass
  // through), and an open terrace with a stupa in the middle.
  slab(m, 5, 40, L3, 3);
  slab(m, 44, 64, L3, 3);
  slab(m, 69, 104, L3, 3);
  hang(m, 5, 40, L3 + 3, 5, 'rock');
  hang(m, 44, 64, L3 + 3, 4, 'rock');
  hang(m, 69, 104, L3 + 3, 5, 'rock');
  for (let x = 8; x <= 102; x += 8) {
    if ((x > 40 && x < 44) || (x > 64 && x < 69)) continue;
    decor.push(rect('woodpost', px(x), px(L2 + 4), px(1), px(L3 - L2 - 4)));
  }
  decor.push(rect('cave', px(5), px(L2 + 4), px(100), px(L3 - L2 - 4)));

  // Rockfall: rocks drop off the cliffs over the open courtyard between the
  // temples (a roof keeps you safe).
  hz.push(rect('rockfall', px(30), px(L2 - 13), px(14), px(13)), rect('rockfall', px(67), px(L2 - 13), px(14), px(13)));

  // Bamboo groves (hide in them; they rustle).
  for (const [x, w, row] of [[38, 4, L2], [76, 4, L2], [14, 5, L3], [92, 5, L3], [6, 3, L2], [102, 2, L2]]) {
    decor.push(rect('bamboo', px(x), px(row) - 88, px(w), 88));
  }
  // The temples' insides: scripture shelves... the Oracle on her dais with
  // braziers either side... the great gong.
  decor.push(point('scrolls', px(14) + 16, px(L2)), point('scrolls', px(22) + 16, px(L2)));
  decor.push(point('oracle', px(55) + 16, px(L2)));
  decor.push(point('brazier', px(50) + 16, px(L2)), point('brazier', px(60) + 16, px(L2)));
  decor.push(point('gong', px(91) + 16, px(L2)));
  decor.push(point('brazier', px(85) + 16, px(L2)), point('brazier', px(97) + 16, px(L2)));
  // The courtyard, the roofs and the cloisters.
  for (const [a, b, row] of [[9, 44, L1 - 6], [66, 101, L1 - 6], [30, 81, L2 - 10]]) decor.push(rect('flags', px(a), px(row), px(b - a), 30));
  for (const [x, row] of [[32, L2], [42, L2], [69, L2], [79, L2]]) decor.push(point('stonelantern', px(x) + 16, px(row)));
  decor.push(point('blossom', px(40) + 16, px(L2)), point('blossom', px(70) + 16, px(L2)));
  decor.push(on(m, 'statue', 18, 0), on(m, 'statue', 92, 0));
  decor.push(point('stupa', px(54) + 16, px(L3)));
  for (const x of [24, 32, 76, 84]) decor.push(point('prayerwheels', px(x) + 16, px(L3)));
  decor.push(point('brazier', px(48) + 16, px(L3)), point('brazier', px(61) + 16, px(L3)));

  const spawns = [
    point('player', px(55), px(L1 - 10)),
    on(m, 'bot', 20), on(m, 'bot', 90), point('bot', px(52), px(L1 - 9)),
    point('bot', px(7), px(L2)), point('bot', px(40), px(L2)), point('bot', px(103), px(L2)),
    point('bot', px(10), px(L3)), point('bot', px(56), px(L3)), point('bot', px(100), px(L3)),
  ];
  // War: bullet scars on the temple walls, smoke from a burning hall, a militia camp in the cloisters.
  for (const [x0, x1] of [[9, 29], [44, 66], [81, 101]]) decor.push(rect('scars', px(x0), px(L1 + 4), px(2), px(6)), rect('scars', px(x1 - 1), px(L1 + 5), px(2), px(5)));
  decor.push(point('smoke', px(95), px(L1 - 1)), point('smoke', px(20), px(L1 - 1)));
  decor.push(on(m, 'sandbags', 20, L2 + 4), on(m, 'supplycrates', 30, L2 + 4), on(m, 'sandbags', 86, L2 + 4));
  for (const x of [40, 77]) decor.push(on(m, 'crater', x, L1 + 3));
  return tiledMap('monastery-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}

// --------------------------------------------------------- Wastelands ----
// 112 x 66 tiles. A ruined city over a sea of toxic sludge (the void).
//   level 1 (row 18): the broken highway overpass on pillars
//   level 2 (row 32): the street, wrecked cars, a tank, toxic puddles
//   level 3 (row 46): the sewer under the street, a sludge channel
function wastelands() {
  W = 112;
  H = 56;
  seed = 9090;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];
  const L1 = 18;
  const L2 = 32;
  const L3 = 46;

  // Level 1: overpass segments, slim, on thin pillars down to the street.
  for (const [a, b] of [[4, 38], [50, 78], [88, 108]]) slab(m, a, b, L1, 3, 'sand');
  // Its pillars are drawn behind you: walk the street without bumping into them.
  for (const x of [10, 30, 56, 72, 94, 104]) decor.push(rect('pillar', px(x), px(L1 + 3), px(2), px(L2 - L1 - 3)));
  // Level 2: the street (asphalt), broken by two craters.
  slab(m, 0, W - 1, L2, 4);
  carve(m, 40, L2, 44, L2 + 3);               // craters down into the sewer
  carve(m, 82, L2, 85, L2 + 3);
  hz.push(pool(m, 'toxic', 22, 26, L2, 2, 'soil', 8));   // toxic puddles in the road
  hz.push(pool(m, 'toxic', 64, 67, L2, 2, 'soil', 8));
  // Wrecks on the street (solid cover): cars and a tank.
  for (const x of [14, 52, 96]) {
    fill(m, x, L2 - 1, x + 3, L2 - 1, 'rock');
    fill(m, x + 1, L2 - 2, x + 2, L2 - 2, 'rock');
    decor.push(rect('wreck', px(x), px(L2 - 2), px(4), px(2)));   // drawn as a burnt-out car
  }
  fill(m, 74, L2 - 2, 79, L2 - 1, 'rock');    // the tank
  fill(m, 76, L2 - 3, 77, L2 - 3, 'rock');
  decor.push(rect('wreck', px(72), px(L2 - 3), px(8), px(3)));   // drawn as a tank (its gun is just drawn)
  // Level 3: the sewer floor, with a sludge channel and a manhole up.
  // (No void here: the sewer floor is solid ground down to the bottom.)
  land(m, 0, W - 1, () => L3, () => H - 1);
  hz.push(pool(m, 'toxic', 46, 60, L3, 3, 'soil', 10));
  carve(m, 99, L2, 102, L2 + 3);             // a manhole
  for (const x of [20, 34, 68, 90]) decor.push(rect('pillar', px(x), px(L2 + 4), px(2), px(L3 - L2 - 4))); // sewer supports (pass through)
  decor.push(rect('cave', px(0), px(L2 + 4), px(W), px(L3 - L2 - 4)));

  // Radiation zones: around the crashed tanker and the reactor barrels.
  hz.push(rect('radiation', px(59), px(L2 - 8), px(14), px(10)), rect('radiation', px(27), px(L3 - 7), px(12), px(9)));

  for (const [x, row] of [[6, L1], [36, L1], [52, L1], [106, L1], [4, L2], [58, L2], [88, L2], [108, L2]]) decor.push(point('lamppost', px(x) + 16, px(row)));
  for (const [x, row] of [[30, L2], [70, L2], [104, L2]]) decor.push(point('deadtree', px(x) + 16, px(row)));
  for (const [x, row] of [[12, L3], [62, L3], [98, L3], [46, L2], [92, L2]]) decor.push(point('tires', px(x) + 16, px(row)));
  for (const [x, row] of [[36, L3], [70, L3], [8, L2]]) decor.push(point('bones', px(x) + 16, px(row)));

  const spawns = [
    point('player', px(64), px(L1 - 8)),
    point('bot', px(8), px(L1)), point('bot', px(66), px(L1)), point('bot', px(104), px(L1)),
    point('bot', px(4), px(L2)), point('bot', px(46), px(L2)), point('bot', px(106), px(L2)),
    point('bot', px(10), px(L3)), point('bot', px(64), px(L3)), point('bot', px(102), px(L3)),
  ];
  // War: barricades, a downed helicopter, propaganda posters, sandbags, the tank still smoking.
  for (const x of [36, 60]) decor.push(on(m, 'hedgehog', x, L1 + 3));
  for (const x of [30, 70]) decor.push(on(m, 'poster', x, L1 + 3));
  decor.push(on(m, 'heliwreck', 90, L1 + 3), on(m, 'sandbags', 47, L1 + 3), point('smoke', px(77), px(L2 - 3)), on(m, 'crater', 56, L1 + 3));
  return tiledMap('wastelands-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}


// -------------------------------------------------------- Sky Islands ----
// 112 x 66 tiles. Grassy islands floating high in the sky over a sea of
// cloud (the void). Three levels; updrafts between the islands lift you
// and gusts of wind push everyone sideways (ride them for long flights).
function skyislands() {
  W = 112;
  H = 66;
  seed = 1111;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];
  const L1 = 16;
  const L2 = 32;
  const L3 = 48;

  // Level 2: three big islands, a rope bridge between the first two.
  island(m, 4, 30, L2, 8);
  island(m, 42, 70, L2, 9);
  island(m, 82, 108, L2, 8);
  fill(m, 31, L2, 41, L2, 'plank');
  // Level 1: small high islands.
  island(m, 12, 24, L1, 5);
  island(m, 50, 62, L1, 5);
  island(m, 86, 98, L1, 5);
  // Level 3: low islands just over the clouds.
  island(m, 24, 38, L3, 5);
  island(m, 50, 62, L3, 5, 'rock');
  island(m, 88, 100, L3, 5);

  // More islands in between, so there's always somewhere to land.
  island(m, 32, 40, 24, 4);
  island(m, 72, 80, 22, 4);
  island(m, 4, 14, 48, 4);
  island(m, 66, 80, 46, 4);
  island(m, 102, 111, 46, 4);
  island(m, 100, 109, 10, 3);
  island(m, 28, 36, 8, 3);

  const spawns = [
    point('player', px(56), px(L1 - 8)),
    on(m, 'bot', 15, L1 - 4), on(m, 'bot', 90, L1 - 4), on(m, 'bot', 59, L1 - 4),
    on(m, 'bot', 6, L2 - 4), on(m, 'bot', 46, L2 - 4), on(m, 'bot', 104, L2 - 4),
    on(m, 'bot', 28, L3 - 4), on(m, 'bot', 54, L3 - 4), on(m, 'bot', 94, L3 - 4),
  ];
  for (const x of [8, 22, 48, 66, 86, 102]) decor.push(on(m, 'tree', x, L2 - 4));
  for (const x of [18, 94]) decor.push(on(m, 'tree', x, L1 - 4));
  for (const x of [30, 92]) decor.push(on(m, 'tree', x, L3 - 4));
  for (const x of [16, 52, 90, 105]) decor.push(on(m, 'rock', x, L2 - 4, 8));
  for (const x of [20, 58, 100]) decor.push(on(m, 'mushroom', x, L2 - 4, 20));
  for (const [x, w, row] of [[24, 3, L2], [64, 3, L2], [88, 3, L2], [33, 3, L3], [52, 3, L1]]) {
    decor.push(rect('bush', px(x), px(row) - 56, px(w) - 10, 56));
  }
  // War: a wrecked airship, a gun post of sandbags, supplies, craters.
  decor.push(on(m, 'airshipwreck', 95, L2 - 4), on(m, 'sandbags', 16, L1 - 4), on(m, 'hedgehog', 58, L1 - 4), on(m, 'supplycrates', 60, L2 - 4));
  decor.push(on(m, 'crater', 50, L2 - 4), on(m, 'burnttree', 100, L2 - 4));
  return tiledMap('skyislands-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}

// -------------------------------------------------------------- Space ----
// 112 x 66 tiles. Asteroids drifting in open space, very low gravity (big
// floaty jumps). A moon base on the middle asteroid. Meteor showers: a red
// ring shows where one will hit; get under a roof.
function space() {
  W = 112;
  H = 66;
  seed = 2222;
  objectId = 1;
  const m = grid();
  const hz = [];
  const decor = [];
  const L1 = 16;
  const L2 = 32;
  const L3 = 48;

  // Level 2: the base asteroid in the middle, two more either side.
  island(m, 36, 76, L2, 10);
  island(m, 4, 26, L2, 7, 'rock');
  island(m, 88, 108, L2, 7, 'rock');
  // The moon base: metal walls with doors, a roof to stand on.
  fill(m, 44, L2 - 8, 45, L2 - 1, 'plank');
  fill(m, 67, L2 - 8, 68, L2 - 1, 'plank');
  carve(m, 44, L2 - 4, 45, L2 - 1);         // doors (4 tall)
  carve(m, 67, L2 - 4, 68, L2 - 1);
  slab(m, 44, 68, L2 - 10, 2, 'plank');
  decor.push(rect('cave', px(46), px(L2 - 8), px(21), px(8)));
  // Level 1: small asteroids up high.
  island(m, 2, 12, L1, 4, 'rock');
  island(m, 26, 36, L1, 4);
  island(m, 76, 86, L1, 4);
  island(m, 98, 108, L1, 4, 'rock');
  // Level 3: low asteroids.
  island(m, 14, 30, L3, 5);
  island(m, 46, 60, L3, 4, 'rock');
  island(m, 80, 96, L3, 5);
  // More asteroids in between.
  island(m, 14, 22, 24, 3, 'rock');
  island(m, 88, 96, 22, 3);
  island(m, 2, 10, 44, 3, 'rock');
  island(m, 62, 74, 50, 3, 'rock');
  island(m, 100, 110, 46, 3);
  island(m, 40, 46, 8, 2, 'rock');
  // Meteor showers over the whole map.
  for (const [a, b] of [[0, 37], [37, 75], [75, 112]]) hz.push(rect('meteor', px(a), 0, px(b - a), px(L3 + 2)));

  const spawns = [
    point('player', px(56), px(L2 - 14)),
    on(m, 'bot', 6, L1 - 4), on(m, 'bot', 30, L1 - 4), on(m, 'bot', 102, L1 - 4),
    on(m, 'bot', 8, L2 - 4), on(m, 'bot', 50, L2 - 4), on(m, 'bot', 104, L2 - 4),
    on(m, 'bot', 18, L3 - 4), on(m, 'bot', 52, L3 - 4), on(m, 'bot', 92, L3 - 4),
  ];
  decor.push(point('dome', px(56) + 16, px(L2 - 10)));
  decor.push(point('antenna', px(46) + 16, px(L2 - 10)), point('antenna', px(82) + 16, px(L1)));
  for (const [x, row] of [[40, L2], [72, L2], [100, L2], [86, L3]]) decor.push(point('solar', px(x) + 16, px(row)));
  for (const [x, row] of [[14, L2], [96, L2], [24, L3], [6, L1]]) decor.push(on(m, 'rock', x, row - 4, 8));
  // War: a crashed Syndicate ship, bullet scars on the base, craters, supplies inside.
  decor.push(on(m, 'shipwreck', 96, L2 - 4), rect('scars', px(44), px(L2 - 8), px(2), px(4)), rect('scars', px(67), px(L2 - 8), px(2), px(4)));
  decor.push(on(m, 'crater', 12, L2 - 4), on(m, 'crater', 84, L3 - 4), on(m, 'supplycrates', 62, L2 - 8));
  return tiledMap('space-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: hz },
    { name: 'decor', objects: decor },
  ]);
}


// ------------------------------------------------------- Militia Camp ----
// Training only. 150 x 26 tiles, one flat parade ground (row 20) with a
// thick floor, no void, no hazards. Stations left to right, each closed
// off by a gate (a column of invisible solid tiles up to the sky that
// TrainingSystem draws as a fence and opens when a lesson is done):
//   move (flag) | fly (watchtower) | type + typos (firing range) | melee |
//   throw (sandbag wall) | airdrop (helipad) | live fire (yard)
function camp() {
  W = 150;
  H = 26;
  objectId = 1;
  const m = grid();
  const G = 20;
  const decor = [];
  const train = [];
  land(m, 0, W - 1, () => G, () => H - 1);
  // Gates: from the sky down to the ground.
  const gates = [27, 43, 69, 87, 109, 125];
  for (const x of gates) {
    fill(m, x, 0, x, G - 1, 'hidden');
    train.push(rect('gate', px(x), 0, px(1), px(G)));
  }
  // Watchtower: a plank platform up high (legs and railing are drawn).
  fill(m, 32, 12, 37, 12, 'plank');
  train.push(rect('tower', px(32), px(9), px(6), px(3)));
  decor.push(rect('watchtower', px(32), px(12), px(6), px(G - 12)));
  // Sandbag wall: solid, chest high, the target hides behind it.
  fill(m, 98, G - 3, 99, G - 1, 'hidden');
  decor.push(rect('sandbagwall', px(98), px(G - 3), px(2), px(3)));
  // Live-fire yard: a low wall of cover in the middle.
  fill(m, 136, G - 2, 137, G - 1, 'hidden');
  decor.push(rect('sandbagwall', px(136), px(G - 2), px(2), px(2)));

  // Where each lesson happens (coaches stand at these spots).
  const spot = (name, x) => train.push(point(name, px(x) + 16, px(G)));
  spot('move', 12); spot('fly', 30); spot('type', 47); spot('typos', 47); spot('melee', 72);
  spot('throw', 90); spot('airdrop', 112); spot('fight', 128);
  train.push(point('flag', px(22) + 16, px(G)));
  for (const x of [55, 60, 65]) train.push(point('target', px(x) + 16, px(G)));
  for (const x of [57, 63]) train.push(point('target2', px(x) + 16, px(G)));
  train.push(point('meleetarget', px(81) + 16, px(G)));
  train.push(point('blasttarget', px(103) + 16, px(G)));
  train.push(point('pad', px(117) + 16, px(G)));
  for (const x of [141, 146]) train.push(point('enemy', px(x) + 16, px(G)));

  // The camp
  for (const x of [4, 9, 15]) decor.push(point('tent', px(x) + 16, px(G)));
  decor.push(point('flagpole', px(22) + 16, px(G)));
  decor.push(point('supplycrates', px(19) + 16, px(G)), point('supplycrates', px(39) + 16, px(G)));
  for (const x of [52, 67]) decor.push(point('sandbags', px(x) + 16, px(G)));
  decor.push(rect('range', px(53), px(G - 4), px(15), px(4)));
  decor.push(point('helipad', px(117) + 16, px(G)));
  decor.push(point('barbed', px(1) + 16, px(G)), point('barbed', px(148) + 16, px(G)));
  for (const x of [131, 144]) decor.push(point('hedgehog', px(x) + 16, px(G)));
  decor.push(point('supplycrates', px(121) + 16, px(G)), point('sandbags', px(76) + 16, px(G)), point('sandbags', px(93) + 16, px(G)));
  for (const x of [24, 84, 106, 133]) decor.push(point('floodlight', px(x) + 16, px(G)));
  decor.push(point('smoke', px(70), px(4)), point('smoke', px(140), px(6)));

  const spawns = [point('player', px(6) + 16, px(G) - 30), point('bot', px(141) + 16, px(G) - 30), point('bot', px(146) + 16, px(G) - 30)];
  const map = tiledMap('camp-tiles', m, [
    { name: 'spawns', objects: spawns },
    { name: 'hazards', objects: [] },
    { name: 'decor', objects: decor },
    { name: 'training', objects: train },
  ]);
  // Under a gate the ground looks like the ground next to it (the gate's
  // invisible column above it would otherwise turn its grass to soil).
  const data = map.layers[0].data;
  for (const x of [...gates, 98, 99, 136, 137]) for (let y = G; y < H; y++) data[y * W + x] = data[y * W + 97 - (x > 120 ? -38 : 0)];
  return map;
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
seed = 707;
out('public/assets/tilesets/monastery-tiles.png', tileset(paletteTiles(MONASTERY_PALETTE)));
seed = 808;
out('public/assets/tilesets/wastelands-tiles.png', tileset(paletteTiles(WASTELAND_PALETTE)));
out('public/assets/maps/forest.json', JSON.stringify(forest()));
out('public/assets/maps/hell.json', JSON.stringify(hell()));
out('public/assets/maps/glacier.json', JSON.stringify(glacier()));
out('public/assets/maps/desert.json', JSON.stringify(desert()));
out('public/assets/maps/catacombs.json', JSON.stringify(catacombs()));
out('public/assets/maps/graveyard.json', JSON.stringify(graveyard()));
out('public/assets/maps/monastery.json', JSON.stringify(monastery()));
out('public/assets/maps/wastelands.json', JSON.stringify(wastelands()));
seed = 909;
out('public/assets/tilesets/skyislands-tiles.png', tileset(paletteTiles(SKY_PALETTE)));
seed = 1010;
out('public/assets/tilesets/space-tiles.png', tileset(paletteTiles(SPACE_PALETTE)));
out('public/assets/maps/skyislands.json', JSON.stringify(skyislands()));
out('public/assets/maps/space.json', JSON.stringify(space()));
seed = 1111;
out('public/assets/tilesets/camp-tiles.png', tileset(paletteTiles(CAMP_PALETTE)));
out('public/assets/maps/camp.json', JSON.stringify(camp()));
