#!/usr/bin/env python3
"""label_sheets.py - BUILDPLAN-ANALYZER-005O (RESEARCH ONLY).

  python3 -I research/analyzer-005o/label_sheets.py --work /home/user/work005o [--per 36] [--seed 5050]

Blind transcription sheets for the OFFLINE SCORER's truth (never an input to any challenger): every statement crop
(statement_crops.py) is shown enlarged with a sheet-local number and nothing else - no reader output, no value, no
case name. Each sheet also carries `controls` synthetic labels (rendered here from a free font with a known value) so
the transcribers' own error rate is measured. Sheets and the key are written OUTSIDE the repository.
"""
import argparse, json, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/freefont/FreeSans.ttf']


def control(rng):
    v = str(rng.choice([rng.randint(30, 999), rng.randint(100, 1999), rng.choice([541, 501, 870, 810, 346, 432, 120, 224, 180, 280])]))
    f = ImageFont.truetype(rng.choice(FONTS), rng.choice([13, 14, 15, 16]))
    w = int(f.getlength(v)) + 8
    im = Image.new('L', (w, 22), 255)
    ImageDraw.Draw(im).text((4, 2), v, fill=rng.choice([20, 60, 90]), font=f)
    im = im.filter(ImageFilter.GaussianBlur(rng.choice([0.0, 0.4, 0.6])))
    if rng.random() < 0.3:
        im = im.rotate(180)
    return v, im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--per', type=int, default=36)
    ap.add_argument('--controls', type=int, default=4)
    ap.add_argument('--seed', type=int, default=5050)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    man = json.load(open(os.path.join(a.work, 'labels', 'manifest.json')))['crops']
    items = [r for r in man if r.get('crop') and r['crop'] != 'RASTER_MISSING']
    rng.shuffle(items)  # sheets mix houses: a transcriber cannot carry one plan's scale or style into the next label
    out = os.path.join(a.work, 'labels', 'sheets')
    os.makedirs(out, exist_ok=True)
    key = []
    n_sheets = (len(items) + a.per - 1) // a.per
    for s in range(n_sheets):
        chunk = [('crop', r) for r in items[s * a.per:(s + 1) * a.per]] + [('control', control(rng)) for _ in range(a.controls)]
        rng.shuffle(chunk)
        tiles = []
        for i, (kind, x) in enumerate(chunk, 1):
            im = Image.open(os.path.join(a.work, 'labels', 'crops', x['key'] + '.png')) if kind == 'crop' else x[1]
            # the short side to ~72 px (every label at a legible size), the long side at most 320 px (a box that spans a
            # picture is shown whole, small: it is not a label, and the transcriber says so)
            z = min(max(1.0, min(8.0, 72 / max(1, min(im.size)))), 320 / max(im.size))
            tiles.append((i, kind, x, im.resize((max(1, round(im.width * z)), max(1, round(im.height * z))), Image.NEAREST if z >= 1 else Image.LANCZOS)))
        cols = 3
        cw = max(t[3].width for t in tiles) + 70
        rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
        rh = [max(t[3].height for t in r) + 16 for r in rows]
        sheet = Image.new('L', (cw * cols, sum(rh)), 255)
        d = ImageDraw.Draw(sheet)
        lab = ImageFont.truetype(FONTS[0], 20)
        y = 0
        for r, h in zip(rows, rh):
            for c, (i, kind, x, im) in enumerate(r):
                d.text((c * cw + 4, y + 4), f'#{i}', fill=0, font=lab)
                sheet.paste(im, (c * cw + 62, y + 4))
                d.rectangle((c * cw, y, c * cw + cw - 1, y + h - 1), outline=170)
                key.append({'sheet': s, 'n': i, 'kind': kind, 'key': x['key'] if kind == 'crop' else None, 'controlValue': x[0] if kind == 'control' else None})
            y += h
        sheet.save(os.path.join(out, f'sheet-{s:02d}.png'))
    json.dump({'seed': a.seed, 'per': a.per, 'controls': a.controls, 'sheets': n_sheets, 'key': key}, open(os.path.join(a.work, 'labels', 'sheet-key.json'), 'w'), indent=0)
    print(n_sheets, 'sheets')


if __name__ == '__main__':
    main()
