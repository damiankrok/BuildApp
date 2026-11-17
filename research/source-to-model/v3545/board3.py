"""v3.54.5 boards ŹRÓDŁO | (LOCAL) | BAZA H | NOWY H (private: they show publishers' pictures; outputs stay outside Git).

  /usr/bin/python3 -I board3.py --title <text> --out <png> --src <picture> [--src ...]
      --row "<label>|<dir with views-SIDES.png, views-AROUND.png, views-frame.json, or ->|<score rows json or ->" [--row …]
      [--ref-height <m above ±0,00> --ref-label <text>] [--note <text> …]

Every model row is drawn by the same camera (v3544/views.ts) and scaled to ONE number of pixels per metre, on one ground
line, with a ruler in metres above ±0,00 beside every side — no row is fitted on its own. Where a row has the detailed
scorer's rows for it, each reference opening is marked on its side by the scorer's verdict and id:
  green ring = OK;  orange ring = matched, off in position or size;  red cross = MISSING (drawn where the SOURCE has it);
  magenta square = FALSE (a hole with no opening in the source);  grey ring = present, not measured (occluded / no scale).
Markers stand at the place of the MODEL's hole (or, for MISSING, of the source's opening), on the model's own picture."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

def arg(name, many=False):
    out = [sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == '--' + name and i + 1 < len(sys.argv)]
    return out if many else (out[0] if out else None)

W = 2300
def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
F, FS, FT, FX = font(22), font(15), font(30), font(12)
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
COL = {'OK': (0, 150, 60), 'OFF': (235, 130, 0), 'MISSING': (215, 20, 20), 'FALSE': (200, 0, 200), 'PRESENT': (120, 120, 120)}

def sources(paths):
    ims = []
    for p in paths:
        try: ims.append(Image.open(p).convert('RGB'))
        except Exception: pass
    if not ims: return None
    h = 400
    ims = [im.resize((max(1, int(im.width * h / im.height)), h)) for im in ims]
    total = sum(im.width for im in ims) + 12 * (len(ims) - 1)
    if total > W - 40:
        k = (W - 40) / total; h = int(h * k)
        ims = [im.resize((max(1, int(im.width * k)), h)) for im in ims]
    row = Image.new('RGB', (W, h + 10), 'white'); x = 20
    for im in ims: row.paste(im, (x, 5)); x += im.width + 12
    return row

def model_row(d, score, px_per_m, ref_height, ref_label):
    if not d or d == '-' or not os.path.exists(os.path.join(d, 'views-SIDES.png')):
        row = Image.new('RGB', (W, 70), 'white'); ImageDraw.Draw(row).text((30, 20), 'brak modelu', fill=(160, 0, 0), font=F); return row
    sides = Image.open(os.path.join(d, 'views-SIDES.png')).convert('RGB')
    frame = json.load(open(os.path.join(d, 'views-frame.json')))
    k = px_per_m / frame['pxPerM']
    sides = sides.resize((max(1, int(sides.width * k)), max(1, int(sides.height * k))))
    tile = frame['tile'] * k; zero = frame['rowOfZero'] * k
    top_m = int((frame.get('topM') or frame.get('roofTopM') or 8) + 1.5)
    pad = 46
    canvas = Image.new('RGB', (int(sides.width + 4 * pad + 20), sides.height + 8), 'white')
    dr = ImageDraw.Draw(canvas)
    wm, dm = frame.get('widthM') or 0, frame.get('depthM') or 0
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
        # the scorer's verdicts on this side: the tile is centred on the scene's extent along the side; the walls' left
        # end is half the walls' length left of that centre (the roof overhang is symmetric to within the marker's size)
        length = wm if SIDES[i] in ('FRONT', 'REAR') else dm
        left = x0 + tile / 2 - length / 2 * px_per_m
        for r in (score or {}).get('rows', []):
            if r.get('side') != SIDES[i] or 'markAlongM' not in r: continue
            cx = left + r['markAlongM'] * px_per_m; cy = 4 + zero - r['markY'] * px_per_m
            c = COL.get(r['result'], (0, 0, 0)); s = 9
            if r['result'] == 'MISSING':
                dr.line([(cx - s, cy - s), (cx + s, cy + s)], fill=c, width=3); dr.line([(cx - s, cy + s), (cx + s, cy - s)], fill=c, width=3)
            elif r['result'] == 'FALSE': dr.rectangle([cx - s, cy - s, cx + s, cy + s], outline=c, width=3)
            else: dr.ellipse([cx - s, cy - s, cx + s, cy + s], outline=c, width=3)
            dr.text((cx + s + 2, cy - 7), r.get('ref') or '+', fill=c, font=FX)
    around = Image.open(os.path.join(d, 'views-AROUND.png')).convert('RGB')
    ah = 240; around = around.resize((int(around.width * ah / around.height), ah))
    if canvas.width > W - 20:
        kk = (W - 20) / canvas.width; canvas = canvas.resize((W - 20, int(canvas.height * kk)))
    row = Image.new('RGB', (W, canvas.height + ah + 12), 'white')
    row.paste(canvas, (10, 2)); row.paste(around, (10, canvas.height + 6))
    o = (score or {}).get('openings')
    txt = f"[{wm and round(wm, 2)} × {dm and round(dm, 2)} m; dach do +{frame.get('roofTopM') and round(frame['roofTopM'], 2)} m]" + (f"   otwory: poprawne {o['ok']}, dopasowane {o['matched']}/{o['reference']}, fałszywe {o['false']}; strony zbudowane {score.get('sidesBuilt')}/{score.get('sidesPublished')}" if o else '')
    ImageDraw.Draw(row).text((around.width + 30, canvas.height + 12), txt, fill='black', font=FS)
    return row

rows_in = [r.split('|') for r in arg('row', True)]
frames = [json.load(open(os.path.join(d, 'views-frame.json'))) for _, d, _ in rows_in if d and d != '-' and os.path.exists(os.path.join(d, 'views-frame.json'))]
ppm = min([f['pxPerM'] for f in frames] or [40]) * 0.95   # one scale for every row: the largest model fills its tiles
ref = float(arg('ref-height')) if arg('ref-height') else None
rows = []
head = Image.new('RGB', (W, 52), 'white'); ImageDraw.Draw(head).text((20, 8), arg('title') or '', fill='black', font=FT); rows.append(head)
lab = lambda t, c=(0, 70, 140): (lambda im: (ImageDraw.Draw(im).text((20, 4), t, fill=c, font=F), im)[1])(Image.new('RGB', (W, 34), 'white'))
rows.append(lab('ŹRÓDŁO (rysunki wydawcy: rzut, elewacje, przekrój)'))
s = sources(arg('src', True))
if s: rows.append(s)
for label, d, sc in rows_in:
    score = json.load(open(sc)) if sc and sc != '-' and os.path.exists(sc) else None
    rows.append(lab(label))
    rows.append(model_row(d, score, ppm, ref, arg('ref-label')))
legend = Image.new('RGB', (W, 30 + 22 * len(arg('note', True))), 'white'); dl = ImageDraw.Draw(legend)
dl.text((20, 4), 'Znaczniki (oceniacz szczegółowy, referencja ze źródeł): zielony okrąg = otwór poprawny; pomarańczowy = dopasowany, poza tolerancją; czerwony krzyż = brak (w miejscu ze źródła); fioletowy kwadrat = fałszywy; szary = obecny, niemierzony. Linia przerywana: kalenica wg źródła. Wspólna skala i linia ±0,00 we wszystkich wierszach.', fill=(60, 60, 60), font=FX)
for i, n in enumerate(arg('note', True)): dl.text((20, 26 + 22 * i), n, fill=(0, 0, 0), font=FS)
rows.append(legend)
out = Image.new('RGB', (W, sum(r.height for r in rows)), 'white'); y = 0
for r in rows: out.paste(r, (0, y)); y += r.height
out.save(arg('out'))
print(arg('out'), out.size)
