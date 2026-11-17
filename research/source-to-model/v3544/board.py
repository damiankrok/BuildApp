"""v3.54.4 boards ŹRÓDŁO | PRZED | PO (private: they show publishers' pictures; outputs stay outside Git).

  /usr/bin/python3 -I board.py --title <text> --out <png> --src <picture> [--src ...]
      --before <dir with views-SIDES.png, views-AROUND.png, views-frame.json | -> --after <dir | ->
      [--note-before <text>] [--note-after <text>] [--ref-height <m above ±0,00> --ref-label <text>]

Each model row is the four sides (FRONT, RIGHT, REAR, LEFT) at one scale on one ground line, with a ruler in metres
above ±0,00 beside every side, then the view from above and around. PRZED and PO are drawn by the same camera
(views.ts): both rows are scaled to the same pixels per metre so that heights compare by eye; --ref-height draws the
source's own height as a dashed line across both rows."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

def arg(name, many=False):
    out = [sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == '--' + name and i + 1 < len(sys.argv)]
    return out if many else (out[0] if out else None)

W = 2200
def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
F, FS, FT = font(22), font(15), font(30)

def sources(paths):
    ims = []
    for p in paths:
        try: ims.append(Image.open(p).convert('RGB'))
        except Exception: pass
    if not ims: return None
    h = 430
    ims = [im.resize((max(1, int(im.width * h / im.height)), h)) for im in ims]
    total = sum(im.width for im in ims) + 12 * (len(ims) - 1)
    if total > W - 40:
        k = (W - 40) / total; h = int(h * k)
        ims = [im.resize((max(1, int(im.width * k)), h)) for im in ims]
    row = Image.new('RGB', (W, h + 10), 'white'); x = 20
    for im in ims: row.paste(im, (x, 5)); x += im.width + 12
    return row

def model_row(d, note, px_per_m, ref_height, ref_label):
    if not d or d == '-' or not os.path.exists(os.path.join(d, 'views-SIDES.png')):
        row = Image.new('RGB', (W, 120), 'white'); ImageDraw.Draw(row).text((30, 40), note or 'brak modelu', fill=(160, 0, 0), font=F); return row
    sides = Image.open(os.path.join(d, 'views-SIDES.png')).convert('RGB')
    frame = json.load(open(os.path.join(d, 'views-frame.json')))
    k = px_per_m / frame['pxPerM']
    sides = sides.resize((max(1, int(sides.width * k)), max(1, int(sides.height * k))))
    tile = frame['tile'] * k; zero = frame['rowOfZero'] * k
    top_m = int((frame.get('topM') or frame.get('roofTopM') or 8) + 1.5)
    pad = 46
    canvas = Image.new('RGB', (int(sides.width + 4 * pad + 20), sides.height + 8), 'white')
    dr = ImageDraw.Draw(canvas)
    for i in range(4):
        x0 = int(i * (tile + pad)) + pad
        canvas.paste(sides.crop((int(i * tile), 0, int((i + 1) * tile), sides.height)), (x0, 4))
        rx = x0 - 8
        dr.line([(rx, 4 + zero), (rx, 4 + zero - top_m * px_per_m)], fill=(60, 60, 60), width=1)
        for m in range(0, top_m + 1):
            y = 4 + zero - m * px_per_m
            if y < 2: break
            dr.line([(rx - (7 if m % 5 == 0 else 4), y), (rx, y)], fill=(60, 60, 60), width=1)
            if m % 2 == 0: dr.text((rx - 34, y - 8), f'{m}', fill=(60, 60, 60), font=FS)
        if ref_height is not None:
            y = 4 + zero - ref_height * px_per_m
            for xx in range(x0, int(x0 + tile), 14): dr.line([(xx, y), (xx + 7, y)], fill=(200, 30, 30), width=2)
            if i == 0 and ref_label: dr.text((x0 + 6, y - 20), ref_label, fill=(200, 30, 30), font=FS)
    around = Image.open(os.path.join(d, 'views-AROUND.png')).convert('RGB')
    ah = 300; around = around.resize((int(around.width * ah / around.height), ah))
    row = Image.new('RGB', (W, canvas.height + ah + 44), 'white')
    if canvas.width > W - 20:
        kk = (W - 20) / canvas.width; canvas = canvas.resize((W - 20, int(canvas.height * kk)))
    row.paste(canvas, (10, 34)); row.paste(around, (10, 34 + canvas.height + 6))
    ImageDraw.Draw(row).text((14, 4), (note or '') + f"   [{frame.get('widthM') and round(frame['widthM'], 2)} × {frame.get('depthM') and round(frame['depthM'], 2)} m; dach do +{frame.get('roofTopM') and round(frame['roofTopM'], 2)} m]", fill='black', font=F)
    return row.crop((0, 0, W, 34 + canvas.height + 6 + ah + 4))

before, after = arg('before'), arg('after')
frames = [json.load(open(os.path.join(d, 'views-frame.json'))) for d in (before, after) if d and d != '-' and os.path.exists(os.path.join(d, 'views-frame.json'))]
# one scale for both rows: the larger model fills its tiles
ppm = min([f['pxPerM'] for f in frames] or [40]) * 0.95
ref = float(arg('ref-height')) if arg('ref-height') else None
rows = []
head = Image.new('RGB', (W, 52), 'white'); ImageDraw.Draw(head).text((20, 8), arg('title') or '', fill='black', font=FT); rows.append(head)
lab = lambda t: (lambda im: (ImageDraw.Draw(im).text((20, 2), t, fill=(0, 70, 140), font=F), im)[1])(Image.new('RGB', (W, 32), 'white'))
rows.append(lab('ŹRÓDŁO (rysunki wydawcy)'))
s = sources(arg('src', True))
if s: rows.append(s)
rows.append(lab('PRZED — ' + (arg('note-before') or 'LOCAL')))
rows.append(model_row(before, arg('note-before-detail') or '', ppm, ref, arg('ref-label')))
rows.append(lab('PO — ' + (arg('note-after') or 'model przyjęty')))
rows.append(model_row(after, arg('note-after-detail') or '', ppm, ref, arg('ref-label')))
out = Image.new('RGB', (W, sum(r.height for r in rows)), 'white'); y = 0
for r in rows: out.paste(r, (0, y)); y += r.height
out.save(arg('out'))
print(arg('out'), out.size)
