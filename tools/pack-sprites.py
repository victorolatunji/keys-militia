# Sprite packer: makes the web-size sprites from the source art.
#
#   python3 tools/pack-sprites.py            (needs Python 3 + Pillow)
#
# Reads the cut parts in assets-src/<folder>/ (full size, never edited here)
# and writes public/assets/sprites/<folder>/<part>.png, smaller, plus
# src/data/spriteManifest.js (sizes and joint points the rig uses).
#
# Rule from the art notes: never resize a part on its own. Every part of a
# character is scaled by the same factor, so they still fit together.
# Weapons all share one factor too, so a pistol stays smaller than an LMG.
#
# Joints: each limb is drawn upright with a round end at the top (shoulder,
# elbow, hip, knee) and its far end at the bottom (elbow, hand, knee, foot).
# The script finds the centre of each round end ("top" and "bot").
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets-src')
OUT = os.path.join(ROOT, 'public', 'assets', 'sprites')
MANIFEST = os.path.join(ROOT, 'src', 'data', 'spriteManifest.js')

# Humanoid characters with a rig (more get added as they're rigged).
CHARACTERS = sys.argv[1:] or ['player', 'soldier']
CHARACTER_HEIGHT = 230   # a character's assembled standing height in the packed art (px)
WEAPON_SCALE = 0.17      # every gun, melee weapon and throwable
# Shots and effects: packed a bit bigger than they're drawn (the game sizes them).
GROUP_SCALE = {'projectiles': 0.25, 'effects': 0.5, 'drops': 0.2, 'utility': 0.2}
# Heads whose art hangs below the neck (long hair): where the neck is, as a
# fraction of the head art's height (default: the bottom). Keep in step with
# OVERRIDES in src/data/rigs.js.
NECK = {'mercenary': 0.6}
# Not humanoids: scaled so one part ends up this size instead (part, 'w' or 'h', px).
CREATURES = {'drone': ('body', 'h', 110), 'k9': ('body', 'w', 160)}


def joints(a):
    """Centres of the round ends at the top and bottom of a limb (alpha mask a)."""
    ys = np.where(a.any(1))[0]
    top, bot = int(ys.min()), int(ys.max())
    h = bot - top

    def centre(rows):
        xs, ws = [], []
        for y in rows:
            row = np.where(a[y])[0]
            if len(row):
                xs.append((row.min() + row.max()) / 2)
                ws.append(row.max() - row.min())
        if not xs:  # a very flat part (a rotor): just its middle
            cols = np.where(a.any(0))[0]
            return float((cols.min() + cols.max()) / 2), 0.0
        return float(np.mean(xs)), float(np.median(ws))

    cx, w = centre(range(top + int(h * 0.04), top + int(h * 0.18) + 1))
    cx2, w2 = centre(range(bot - int(h * 0.18), bot - int(h * 0.04) + 1))
    return [cx, top + w * 0.45], [cx2, bot - w2 * 0.45]


def pack(path, scale, out_path):
    im = Image.open(path).convert('RGBA')
    box = im.getbbox()
    im = im.crop(box)  # drop the empty margin
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    small = im.resize((w, h), Image.LANCZOS)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    small.save(out_path, optimize=True)
    a = np.array(small)[:, :, 3] > 40
    top, bot = joints(a)
    return {'w': w, 'h': h, 'top': [round(v, 1) for v in top], 'bot': [round(v, 1) for v in bot]}


def character(folder):
    src = os.path.join(SRC, folder)
    parts = [f[:-4] for f in sorted(os.listdir(src)) if f.endswith('.png') and f != 'reference.png']
    # One factor for the whole character, from its standing height.
    size = {p: Image.open(os.path.join(src, p + '.png')).getbbox() for p in parts}
    tall = lambda p: size[p][3] - size[p][1]
    if folder in CREATURES:
        part, side, px = CREATURES[folder]
        b = size[part]
        scale = px / ((b[2] - b[0]) if side == 'w' else (b[3] - b[1]))
    else:
        standing = tall('head') * NECK.get(folder, 1) + tall('torso') * 0.86 + tall('front-thigh') * 0.82 + tall('front-shin') * 0.9
        scale = CHARACTER_HEIGHT / standing
    out = {}
    for p in parts:
        out[p] = pack(os.path.join(src, p + '.png'), scale, os.path.join(OUT, folder, p + '.png'))
    return {'scale': round(scale, 4), 'parts': out}


def muzzle(path):
    """Guns point right: the middle of the barrel's end (the right-most few
    columns of the art), as fractions of the packed width and height."""
    a = np.array(Image.open(path))[:, :, 3] > 40
    cols = np.where(a.any(0))[0]
    end = a[:, cols.max() - max(2, int(a.shape[1] * 0.03)):cols.max() + 1]
    rows = np.where(end.any(1))[0]
    return [1.0, round(float(rows.mean()) / a.shape[0], 3)]


def items(folder):
    src = os.path.join(SRC, folder)
    out = {}
    for f in sorted(os.listdir(src)):
        if f.endswith('.png'):
            dest = os.path.join(OUT, folder, f)
            info = pack(os.path.join(src, f), GROUP_SCALE.get(folder, WEAPON_SCALE), dest)
            out[f[:-4]] = {'w': info['w'], 'h': info['h']}
            if folder == 'weapons':
                out[f[:-4]]['muzzle'] = muzzle(dest)
    return out


def main():
    old = {}
    if os.path.exists(MANIFEST):  # keep characters packed earlier
        text = open(MANIFEST).read()
        old = json.loads(text[text.index('{'):text.rindex('}') + 1])
    manifest = {'characters': old.get('characters', {}), 'weapons': {}, 'melee': {}, 'throwables': {}, 'projectiles': {}, 'effects': {}, 'drops': {}, 'utility': {}}
    for c in CHARACTERS:
        manifest['characters'][c] = character(c)
        print('packed', c)
    for group in ['weapons', 'melee', 'throwables', 'projectiles', 'effects', 'drops', 'utility']:
        manifest[group] = items(group)
        print('packed', group, len(manifest[group]))
    with open(MANIFEST, 'w') as f:
        f.write('// Made by tools/pack-sprites.py: sizes and joint points of the packed sprites.\n')
        f.write('// Don\'t edit by hand; re-run the script after changing the art.\n')
        f.write('export const SPRITES = ' + json.dumps(manifest, indent=1) + ';\n')
    print('wrote', os.path.relpath(MANIFEST, ROOT))


if __name__ == '__main__':
    main()
