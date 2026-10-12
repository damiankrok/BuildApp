#!/usr/bin/env python3
"""glyph_corpus.py - BUILDPLAN-ANALYZER-005O adversarial numeric glyph corpus (RESEARCH ONLY).

  python3 -I research/analyzer-005o/glyph_corpus.py --out /home/user/work005o/glyphs --seed 5050 --per-family 60

005O-owned synthetic renderings (no publisher pixel): dimension labels printed in rights-cleared fonts installed on
this machine, one FAMILY per typeface (the split unit for statistics), each label on its own 420 x 140 page (white,
RGB) with an optional dimension line under it, a cap height of 10-16 px, condensation, blur and JPEG loss, upright or
turned a quarter. Values: a fixed lookalike set (541/501, 870/810, 346/432, 224/220, 302/102, 472/171, 190/140,
350/150, 280/180, 1930/1630, 949/904 ...) and seeded random 2-4 digit dimensions. Pages are written OUTSIDE the
repository; the manifest (ids, family, value, style, seed, page SHA-256) is what may be committed.

Fonts and licences (files under /usr/share/fonts): DejaVu Sans (Bitstream Vera / DejaVu licence), Liberation Sans
and Liberation Sans Italic (SIL OFL 1.1), FreeSans Oblique (GPLv3 with font exception), DejaVu Sans Mono (DejaVu
licence), Courier 10 Pitch and Bitstream Charter (Bitstream donated X11 Type 1, free redistribution).
"""
import argparse, hashlib, io, json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FAMILIES = {
    'F1-dejavu-sans': ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 1.0),
    'F2-liberation-sans': ('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 1.0),
    'F3-freesans-oblique': ('/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf', 1.0),
    'F4-liberation-italic-condensed': ('/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf', 0.78),
    'F5-dejavu-mono': ('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 1.0),
    'F6-courier10': ('/usr/share/fonts/X11/Type1/c0419bt_.pfb', 1.0),
    'F7-charter': ('/usr/share/fonts/X11/Type1/c0648bt_.pfb', 1.0),
}
LOOKALIKES = ['541', '501', '870', '810', '346', '432', '224', '220', '302', '102', '472', '171', '190', '140', '350', '150', '280', '180', '1930', '1630', '949', '904', '410', '740', '1020', '582', '115', '252', '240', '160']


def render(text, font_path, condense, cap, blur, jpeg, gray, line, turn, rng):
    # draw large, then reduce to the target cap height (antialiased, as a plan export is)
    big = 64
    f = ImageFont.truetype(font_path, big)
    x0, y0, x1, y1 = f.getbbox(text)
    w, h = x1 - x0 + 16, y1 - y0 + 16
    im = Image.new('L', (w, h), 255)
    ImageDraw.Draw(im).text((8 - x0, 8 - y0), text, fill=gray, font=f)
    cap_big = y1 - y0
    s = cap / cap_big
    im = im.resize((max(4, round(w * s * condense)), max(4, round(h * s))), Image.LANCZOS)
    page = Image.new('L', (420, 140), 255)
    px, py = (420 - im.width) // 2, (140 - im.height) // 2
    page.paste(im, (px, py))
    if line:
        d = ImageDraw.Draw(page)
        ly = py + im.height + 2
        d.line((px - 30, ly, px + im.width + 30, ly), fill=90, width=1)
        for tx in (px - 30, px + im.width + 30):
            d.line((tx - 3, ly + 3, tx + 3, ly - 3), fill=60, width=1)
    if blur > 0:
        page = page.filter(ImageFilter.GaussianBlur(blur))
    if jpeg:
        b = io.BytesIO()
        page.save(b, 'JPEG', quality=jpeg)
        page = Image.open(io.BytesIO(b.getvalue())).convert('L')
    if turn == 'CW':
        page = page.rotate(-90, expand=True)
    elif turn == 'CCW':
        page = page.rotate(90, expand=True)
    return page.convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--seed', type=int, default=5050)
    ap.add_argument('--per-family', type=int, default=60)
    ap.add_argument('--manifest', default='stage-reports/artifacts/analyzer-005o/glyph-corpus-manifest.json')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rng = random.Random(a.seed)
    rows = []
    for fam, (path, condense0) in sorted(FAMILIES.items()):
        for i in range(a.per_family):
            text = LOOKALIKES[i % len(LOOKALIKES)] if i < len(LOOKALIKES) else str(rng.choice([rng.randint(10, 99), rng.randint(100, 999), rng.randint(100, 999), rng.randint(1000, 2400)]))
            style = {'cap': rng.choice([10, 11, 12, 13, 14, 16]), 'condense': round(condense0 * rng.choice([1.0, 0.92, 0.85]), 3), 'blur': rng.choice([0.0, 0.0, 0.35, 0.6]),
                     'jpeg': rng.choice([None, 85, 70]), 'gray': rng.choice([0, 30, 70]), 'line': rng.random() < 0.6, 'turn': rng.choice(['UPRIGHT', 'UPRIGHT', 'CW', 'CCW'])}
            page = render(text, path, style['condense'], style['cap'], style['blur'], style['jpeg'], style['gray'], style['line'], style['turn'], rng)
            rid = f'{fam}-{i:03d}'
            fn = os.path.join(a.out, rid + '.png')
            page.save(fn)
            rows.append({'id': rid, 'family': fam, 'text': text, 'lookalike': i < len(LOOKALIKES), **style, 'sha256': hashlib.sha256(open(fn, 'rb').read()).hexdigest()})
    doc = {'schema': 'buildapp.005o.glyph-corpus', 'seed': a.seed, 'perFamily': a.per_family, 'families': {k: os.path.basename(v[0]) for k, v in FAMILIES.items()}, 'page': [420, 140], 'rows': rows}
    os.makedirs(os.path.dirname(a.manifest), exist_ok=True)
    json.dump(doc, open(a.manifest, 'w'), indent=0, sort_keys=True)
    json.dump(doc, open(os.path.join(a.out, 'manifest.json'), 'w'), indent=0, sort_keys=True)
    print(len(rows), 'labels in', len(FAMILIES), 'families')


if __name__ == '__main__':
    main()
