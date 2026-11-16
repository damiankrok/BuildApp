"""v3.54.3 boards ŹRÓDŁO | PRZED | PO (private: they show publishers' pictures; outputs stay outside Git).

  /usr/bin/python3 -I board.py --title <text> --out <png> --src <picture> [--src ...] --before <SIDES png or -> --after <SIDES png or ->
      [--note-before <text>] [--note-after <text>]
      [--detail-src <picture>:<x0>,<y0>,<x1>,<y1>] [--detail-tile <FRONT|RIGHT|REAR|LEFT>:<x0>,<y0>,<x1>,<y1>] [--detail-title <text>]

Rows: the source elevations as published (up to four) | the model's four sides before | after — the model pictures are
the neutral SIDES views the consultant itself was shown (model-views.ts: front, right, rear, left at one scale), never
refitted. A detail row enlarges one region of a source picture beside the same fractional region of one tile of the
model before and after (fractions 0..1 of the picture / of the tile). A run with no model says so in words.
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('--title', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--src', action='append', default=[])
ap.add_argument('--before', default='-')
ap.add_argument('--after', default='-')
ap.add_argument('--note-before', default='')
ap.add_argument('--note-after', default='')
ap.add_argument('--detail-src', action='append', default=[])
ap.add_argument('--detail-tile', action='append', default=[])
ap.add_argument('--detail-title', action='append', default=[])
a = ap.parse_args()

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = lambda s, b=False: ImageFont.truetype(BOLD if b else FONT, s)
W, PAD = 1680, 16
TILES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']


def fit(im, w, h):
    im = im.convert('RGB')
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)


def label(text, size=22, bold=True, colour=(30, 30, 30)):
    im = Image.new('RGB', (W, size + 18), (255, 255, 255))
    ImageDraw.Draw(im).text((PAD, 8), text, font=font(size, bold), fill=colour)
    return im


def words(text, h=120):
    im = Image.new('RGB', (W, h), (246, 244, 240))
    ImageDraw.Draw(im).text((PAD, h // 2 - 12), text, font=font(20), fill=(120, 40, 40))
    return im


def row_of(pics, h):
    im = Image.new('RGB', (W, h + 2 * PAD), (255, 255, 255))
    if not pics:
        return im
    w = (W - PAD * (len(pics) + 1)) // len(pics)
    for i, p in enumerate(pics):
        t = fit(p, w, h)
        im.paste(t, (PAD + i * (w + PAD) + (w - t.width) // 2, PAD + (h - t.height) // 2))
    return im


def sides(path, note):
    if path == '-' or not os.path.exists(path):
        return words(note or 'brak modelu')
    im = Image.open(path).convert('RGB')
    k = W / im.width
    return im.resize((W, int(im.height * k)), Image.LANCZOS)


def tile_crop(path, spec):
    name, box = spec.split(':')
    x0, y0, x1, y1 = [float(v) for v in box.split(',')]
    im = Image.open(path).convert('RGB')
    tw = im.width // 4
    t = im.crop((TILES.index(name) * tw, 0, (TILES.index(name) + 1) * tw, im.height))
    return t.crop((int(x0 * t.width), int(y0 * t.height), int(x1 * t.width), int(y1 * t.height)))


rows = [label(a.title, 28)]
rows.append(label('ŹRÓDŁO — elewacje wydawcy (jak opublikowane)'))
rows.append(row_of([Image.open(p) for p in a.src[:4]], 300))
rows.append(label('PRZED — model analizatora bez korekty (przód, prawa, tył, lewa; jedna skala)' + (f' — {a.note_before}' if a.note_before and a.before != '-' else '')))
rows.append(sides(a.before, a.note_before))
rows.append(label('PO — model po korekcie zastosowanej przez analizator' + (f' — {a.note_after}' if a.note_after and a.after != '-' else '')))
rows.append(sides(a.after, a.note_after))
for i, ds in enumerate(a.detail_src):
    path, box = ds.rsplit(':', 1)
    x0, y0, x1, y1 = [float(v) for v in box.split(',')]
    s = Image.open(path).convert('RGB')
    s = s.crop((int(x0 * s.width), int(y0 * s.height), int(x1 * s.width), int(y1 * s.height)))
    pics = [s]
    for p in (a.before, a.after):
        if p != '-' and os.path.exists(p) and i < len(a.detail_tile):
            pics.append(tile_crop(p, a.detail_tile[i]))
        else:
            pics.append(Image.new('RGB', (200, 150), (246, 244, 240)))
    rows.append(label((a.detail_title[i] if i < len(a.detail_title) else 'SZCZEGÓŁ') + '   —   ŹRÓDŁO | PRZED | PO'))
    rows.append(row_of(pics, 420))
H = sum(r.height for r in rows)
out = Image.new('RGB', (W, H), (255, 255, 255))
y = 0
for r in rows:
    out.paste(r, (0, y))
    y += r.height
out.save(a.out)
print(a.out, out.size)
