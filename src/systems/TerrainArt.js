import { TERRAIN_LOOK, EARTH_TILES } from '../data/terrainLook.js';
import { TILE_FAMILY } from '../data/maps.js';

// Draws a map's ground the readable 2D way (closer to Mini Militia): the
// square tiles become soft organic shapes, every edge gets a rim of small
// stones, the tops get their surface (grass, snow, sand, volcanic crust...),
// and the map's caves get dark, rounded back walls you can see are open.
//
// It's only a picture laid over the tile layer: the tiles stay exactly as
// they are underneath (hidden), so collisions, spawn points, hazards and
// everything that reads the tiles work as before. Tiles that change during
// a match (thin ice, crumbling rock, planks, gates) are left as tiles.
//
// How: a small mask of the solid tiles (8 px per tile) is blurred and cut
// again, which rounds every corner; it shapes the ground, coloured by each
// tile's material and speckled with stones, drawn in 1024 px chunks
// (chunks with no ground are skipped). Made once when the map loads.
const Q = 8;          // mask pixels per tile
const CHUNK = 1024;   // world px per picture chunk
const PAD = 2;        // tiles of padding round the mask (so map edges stay square)

// A small random generator with a seed, so a map always looks the same.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const css = (c, a = 1) => {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
};
const shade = (c, k) => {
  const [r, g, b] = rgb(c).map((v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))));
  return (r << 16) | (g << 8) | b;
};

// Box blur of a single channel (w x h), radius r, in place (two passes).
function boxBlur(a, w, h, r) {
  const tmp = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / (2 * r + 1);
        sum += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / (2 * r + 1);
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
}

export default class TerrainArt {
  constructor(scene, map, tilemap, layer) {
    this.scene = scene;
    const look = TERRAIN_LOOK[map.key];
    this.enabled = look !== false;
    this.caves = false;
    this.keys = [];
    if (!this.enabled) return;
    const t0 = performance.now();
    const P = map.palette ?? {};
    this.look = { ...TERRAIN_LOOK.defaults, ...(look ?? {}) };
    this.look.stone ??= shade(P.rock ?? 0x8a8578, 0.15);
    this.look.grass ??= P.top ?? 0x52b788;
    this.palette = P;
    this.layer = layer;
    this.W = tilemap.width;
    this.H = tilemap.height;
    this.T = tilemap.tileWidth;
    this.rand = rng(hashStr(map.key));

    this.buildMasks();
    this.buildCaves(tilemap);
    this.drawChunks();
    // The earth tiles are now drawn by us: hide them (they still collide).
    layer.forEachTile((t) => {
      if (EARTH_TILES.has(t.index)) t.setVisible(false);
    });
    scene.events.once('shutdown', () => this.destroy());
    this.ms = Math.round(performance.now() - t0);
  }

  // ---- Masks ----

  // The colour each earth tile is drawn in (by material).
  colorOf(index) {
    const P = this.palette;
    const fam = TILE_FAMILY[index];
    // One ground colour per map (like Mini Militia), so no square patches
    // of material show; only ice is its own colour.
    if (fam === 'ice') return P.ice ?? 0xa8dadc;
    if (this.look.ground) return this.look.ground;
    return P.soil ?? 0x7f5539;
    if (fam === 'top' || fam === 'soil') return P.soil ?? 0x7f5539;
    if (fam === 'under') return P.under ?? P.soil ?? 0x6f4518;
    if (fam === 'deep') return P.deep ?? 0x5c5c5c;
    if (fam === 'sand') return P.sand ?? 0xe9c46a;
    if (fam === 'rock') return P.rock ?? 0x8d99ae;
    if (fam === 'ice') return P.ice ?? 0xa8dadc;
    return P.soil ?? 0x7f5539;
  }

  buildMasks() {
    const { W, H } = this;
    const mw = (W + PAD * 2) * Q;
    const mh = (H + PAD * 2) * Q;
    this.mw = mw;
    this.mh = mh;
    const solid = new Float32Array(mw * mh);
    const col = [new Float32Array(mw * mh), new Float32Array(mw * mh), new Float32Array(mw * mh)];
    const earthAt = (x, y) => {
      const t = this.layer.getTileAt(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y))); // edges extend into the padding
      return t && EARTH_TILES.has(t.index) ? t : null;
    };
    for (let ty = -PAD; ty < H + PAD; ty++) {
      for (let tx = -PAD; tx < W + PAD; tx++) {
        const t = earthAt(tx, ty);
        if (!t) continue;
        const c = rgb(this.colorOf(t.index));
        const x0 = (tx + PAD) * Q;
        const y0 = (ty + PAD) * Q;
        for (let y = y0; y < y0 + Q; y++) {
          for (let x = x0; x < x0 + Q; x++) {
            const i = y * mw + x;
            solid[i] = 1;
            col[0][i] = c[0];
            col[1][i] = c[1];
            col[2][i] = c[2];
          }
        }
      }
    }
    // Colours bleed a little into the air (so edges don't pick up black),
    // then blend softly between materials.
    for (const ch of col) boxBlur(ch, mw, mh, 1);
    const weight = Float32Array.from(solid);
    boxBlur(weight, mw, mh, 1);
    boxBlur(solid, mw, mh, 3); // rounds every corner
    this.solid = solid;

    // The shape (alpha) and colour, as small canvases scaled up per chunk.
    const shape = document.createElement('canvas');
    shape.width = mw;
    shape.height = mh;
    const sctx = shape.getContext('2d');
    const simg = sctx.createImageData(mw, mh);
    const fill = document.createElement('canvas');
    fill.width = mw;
    fill.height = mh;
    const fctx = fill.getContext('2d');
    const fimg = fctx.createImageData(mw, mh);
    for (let i = 0; i < mw * mh; i++) {
      const a = Math.max(0, Math.min(1, (solid[i] - 0.42) * 6));
      simg.data[i * 4] = 255;
      simg.data[i * 4 + 1] = 255;
      simg.data[i * 4 + 2] = 255;
      simg.data[i * 4 + 3] = Math.round(a * 255);
      const w = weight[i] || 1;
      for (let k = 0; k < 3; k++) fimg.data[i * 4 + k] = Math.min(255, col[k][i] / (weight[i] > 0.001 ? w : 1));
      fimg.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(simg, 0, 0);
    fctx.putImageData(fimg, 0, 0);
    this.shape = shape;
    this.fill = fill;
    this.edges = this.findEdges();
  }

  // Points along the ground's outline (world px), with which way is out.
  findEdges() {
    const { mw, mh, solid } = this;
    const on = (x, y) => x >= 0 && y >= 0 && x < mw && y < mh && solid[y * mw + x] > 0.5;
    const pts = [];
    const taken = new Set();
    const s = this.T / Q;
    for (let y = 1; y < mh - 1; y++) {
      for (let x = 1; x < mw - 1; x++) {
        if (!on(x, y)) continue;
        const up = !on(x, y - 1);
        const down = !on(x, y + 1);
        const left = !on(x - 1, y);
        const right = !on(x + 1, y);
        if (!(up || down || left || right)) continue;
        const wx = (x - PAD * Q) * s;
        const wy = (y - PAD * Q) * s;
        if (wx < -8 || wy < -8 || wx > this.W * this.T + 8 || wy > this.H * this.T + 8) continue;
        // keep them a few px apart
        const cell = `${Math.floor(wx / 7)},${Math.floor(wy / 7)}`;
        if (taken.has(cell)) continue;
        taken.add(cell);
        pts.push({ x: wx, y: wy, up, down, left, right });
      }
    }
    return pts;
  }

  // Caves: the map's "cave" decor (dark back walls) as soft round shapes.
  buildCaves(tilemap) {
    const caves = (tilemap.getObjectLayer('decor')?.objects ?? []).filter((o) => o.name === 'cave' && o.width && o.height);
    if (!caves.length) return;
    this.caves = true;
    const { mw, mh } = this;
    const s = this.T / Q;
    const a = new Float32Array(mw * mh);
    for (const o of caves) {
      const x0 = Math.max(0, Math.floor(o.x / s) + PAD * Q);
      const y0 = Math.max(0, Math.floor(o.y / s) + PAD * Q);
      const x1 = Math.min(mw, Math.ceil((o.x + o.width) / s) + PAD * Q);
      const y1 = Math.min(mh, Math.ceil((o.y + o.height) / s) + PAD * Q);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * mw + x] = 1;
    }
    boxBlur(a, mw, mh, 4);
    const c = document.createElement('canvas');
    c.width = mw;
    c.height = mh;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(mw, mh);
    for (let i = 0; i < mw * mh; i++) {
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 255;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (a[i] - 0.4) * 5)) * 255);
    }
    ctx.putImageData(img, 0, 0);
    this.caveShape = c;
    this.caveRects = caves;
  }

  // ---- Drawing ----

  // A tile of small stones and pits, laid over the ground's colour.
  speckle() {
    if (this.speckleCanvas) return this.speckleCanvas;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    const r = rng(99);
    const k = this.look.speckle;
    // big soft patches first (light and shade), then the small stones
    for (let i = 0; i < 14; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${k * 0.16})` : `rgba(255,255,255,${k * 0.1})`;
      g.beginPath();
      g.ellipse(r() * 256, r() * 256, 18 + r() * 30, 10 + r() * 18, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 90; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const rx = 1.5 + r() * 4;
      const ry = rx * (0.6 + r() * 0.4);
      g.fillStyle = `rgba(0,0,0,${k * (0.5 + r())})`;
      g.beginPath();
      g.ellipse(x, y, rx, ry, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(255,255,255,${k * 0.6 * r()})`;
      g.beginPath();
      g.ellipse(x - rx * 0.3, y - ry * 0.4, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
    this.speckleCanvas = c;
    return c;
  }

  drawChunks() {
    const scene = this.scene;
    const WW = this.W * this.T;
    const HH = this.H * this.T;
    const s = this.T / Q;
    const pad = PAD * Q;
    for (let cy = 0; cy < HH; cy += CHUNK) {
      for (let cx = 0; cx < WW; cx += CHUNK) {
        const w = Math.min(CHUNK, WW - cx);
        const h = Math.min(CHUNK, HH - cy);
        const sx = cx / s + pad;
        const sy = cy / s + pad;
        const sw = w / s;
        const sh = h / s;
        if (this.caves && this.anyIn(this.caveShape, sx, sy, sw, sh)) this.drawCaveChunk(cx, cy, w, h, sx, sy, sw, sh);
        if (!this.anySolid(sx, sy, sw, sh)) continue;
        const key = `terrain-${scene.map.key}-${cx}-${cy}-${Math.round(scene.time.now)}`;
        const tex = scene.textures.createCanvas(key, w, h);
        this.keys.push(key);
        const g = tex.getContext();
        g.imageSmoothingEnabled = true;
        // 1. colour by material, 2. stones and pits, 3. cut to the shape
        g.drawImage(this.fill, sx, sy, sw, sh, 0, 0, w, h);
        g.fillStyle = g.createPattern(this.speckle(), 'repeat');
        g.save();
        g.translate(-cx % 256, -cy % 256);
        g.fillRect(cx % 256, cy % 256, w, h);
        g.restore();
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(this.shape, sx, sy, sw, sh, 0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        this.innerShade(g, sx, sy, sw, sh, w, h);
        // 4. the rim of stones, 5. the surface on the tops
        this.drawRim(g, cx, cy, w, h);
        this.drawSurface(g, cx, cy, w, h);
        tex.refresh();
        scene.add.image(cx, cy, key).setOrigin(0, 0).setDepth(0.5);
      }
    }
  }

  // A darker band just inside the bottom edges and a lighter one under the
  // tops, so the ground reads as solid and lit from above.
  innerShade(g, sx, sy, sw, sh, w, h) {
    // (worked out with a margin round the chunk, so no band shows at a chunk's edge)
    const M = 16;
    const k = sw / w; // mask px per world px
    const band = (color, alpha, shift) => {
      const c = document.createElement('canvas');
      c.width = w + M * 2;
      c.height = h + M * 2;
      const o = c.getContext('2d');
      o.fillStyle = color;
      o.fillRect(0, 0, c.width, c.height);
      o.globalCompositeOperation = 'destination-in';
      o.drawImage(this.shape, sx - M * k, sy - M * k, sw + 2 * M * k, sh + 2 * M * k, 0, 0, c.width, c.height);
      o.globalCompositeOperation = 'destination-out';
      o.drawImage(this.shape, sx - M * k, sy - M * k, sw + 2 * M * k, sh + 2 * M * k, 0, shift, c.width, c.height); // the shape moved: what's left is a band along one side
      g.globalAlpha = alpha;
      g.drawImage(c, M, M, w, h, 0, 0, w, h);
      g.globalAlpha = 1;
    };
    band('#000000', 0.3, -7); // bottoms
    band('#ffffff', 0.12, 6); // tops
  }

  anySolid(sx, sy, sw, sh) {
    const { mw, solid } = this;
    for (let y = Math.floor(sy); y < sy + sh; y += 2) for (let x = Math.floor(sx); x < sx + sw; x += 2) if (solid[y * mw + x] > 0.5) return true;
    return false;
  }

  anyIn(canvas, sx, sy, sw, sh) {
    const d = canvas.getContext('2d').getImageData(Math.floor(sx), Math.floor(sy), Math.ceil(sw), Math.ceil(sh)).data;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 40) return true;
    return false;
  }

  // Stones along every edge, like a dry-stone rim: mixed sizes, ink outlines.
  drawRim(g, cx, cy, w, h) {
    const L = this.look;
    const ink = css(L.ink, 0.85);
    for (const p of this.edges) {
      if (p.x < cx - 12 || p.y < cy - 12 || p.x > cx + w + 12 || p.y > cy + h + 12) continue;
      const r = this.rand;
      const rad = 3 + r() * 4;
      const inX = (p.left ? 1 : p.right ? -1 : 0) * rad * 0.35;
      const inY = (p.up ? 1 : p.down ? -1 : 0) * rad * 0.35;
      const x = p.x - cx + inX;
      const y = p.y - cy + inY;
      const tone = shade(L.stone, (r() - 0.5) * 0.35);
      g.fillStyle = css(tone);
      g.strokeStyle = ink;
      g.lineWidth = 1.3;
      g.beginPath();
      g.ellipse(x, y, rad, rad * (0.65 + r() * 0.3), r() * Math.PI, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(x - rad * 0.3, y - rad * 0.3, rad * 0.35, rad * 0.25, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The tops: grass tufts, snow caps, sand lips, volcanic crust...
  drawSurface(g, cx, cy, w, h) {
    const L = this.look;
    const r = this.rand;
    const base = L.grass;
    const dark = shade(base, -0.35);
    const light = shade(base, 0.25);
    for (const p of this.edges) {
      if (!p.up) continue;
      if (p.x < cx - 12 || p.y < cy - 12 || p.x > cx + w + 12 || p.y > cy + h + 12) continue;
      const x = p.x - cx;
      const y = p.y - cy + 1;
      switch (L.surface) {
        case 'snow':
          g.fillStyle = css(base);
          g.strokeStyle = css(shade(base, -0.4), 0.6);
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(x, y - 1, 5 + r() * 3, 3 + r() * 1.5, 0, 0, Math.PI * 2);
          g.fill();
          if (r() < 0.25) g.stroke();
          break;
        case 'sand':
          g.fillStyle = css(r() < 0.5 ? base : light);
          g.beginPath();
          g.ellipse(x, y, 5 + r() * 2, 2 + r(), 0, 0, Math.PI * 2);
          g.fill();
          break;
        case 'crust':
          g.fillStyle = css(0x2a1a1a);
          g.beginPath();
          g.ellipse(x, y, 4 + r() * 2, 2.2, 0, 0, Math.PI * 2);
          g.fill();
          if (r() < 0.18) {
            g.fillStyle = css(base, 0.9);
            g.fillRect(x - 1, y - 1, 2, 2); // an ember glint
          }
          break;
        case 'dust':
          g.fillStyle = css(base, 0.9);
          g.beginPath();
          g.ellipse(x, y, 4 + r() * 2, 1.8, 0, 0, Math.PI * 2);
          g.fill();
          break;
        case 'rubble':
          if (r() < 0.5) {
            g.fillStyle = css(shade(base, (r() - 0.5) * 0.4));
            g.strokeStyle = css(L.ink, 0.7);
            g.lineWidth = 1;
            g.save();
            g.translate(x, y - 1);
            g.rotate((r() - 0.5) * 0.8);
            g.fillRect(-3, -2, 6, 4);
            g.strokeRect(-3, -2, 6, 4);
            g.restore();
          }
          break;
        default: {
          // grass / dead grass / moss: a few blades leaning a little
          const blades = L.surface === 'moss' ? 2 : 4;
          for (let b = 0; b < blades; b++) {
            const bx = x + (r() - 0.5) * 6;
            const hgt = (L.surface === 'moss' ? 4 : 6) + r() * (L.surface === 'dead' ? 6 : 8);
            const lean = (r() - 0.5) * 4;
            g.fillStyle = css(r() < 0.3 ? dark : r() < 0.7 ? base : light);
            g.beginPath();
            g.moveTo(bx - 2, y + 2);
            g.lineTo(bx + lean, y - hgt);
            g.lineTo(bx + 2, y + 2);
            g.closePath();
            g.fill();
          }
        }
      }
    }
  }

  // A cave's back wall: dark, soft-edged, a little stony, behind everything.
  drawCaveChunk(cx, cy, w, h, sx, sy, sw, sh) {
    const scene = this.scene;
    const key = `terrain-cave-${scene.map.key}-${cx}-${cy}-${Math.round(scene.time.now)}`;
    const tex = scene.textures.createCanvas(key, w, h);
    this.keys.push(key);
    const g = tex.getContext();
    const P = this.palette;
    const base = P.cave ?? shade(P.soil ?? 0x4a3b2c, -this.look.caveDark);
    g.fillStyle = css(base);
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.6;
    g.fillStyle = g.createPattern(this.speckle(), 'repeat');
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(this.caveShape, sx, sy, sw, sh, 0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    tex.refresh();
    scene.add.image(cx, cy, key).setOrigin(0, 0).setDepth(-7);
  }

  destroy() {
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.keys = [];
  }
}
