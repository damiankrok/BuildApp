"""v3.54.3 plan board (private: shows a publisher's plan; outputs stay outside Git).

  /usr/bin/python3 -I board_plan.py --title <text> --out <png> --plan <plan picture> --consult <consult.json>
      [--zoom <x0>,<y0>,<x1>,<y1>] [--zoom-title <text>] [--around-before <AROUND png>] [--around-after <AROUND png>]

Left: the source plan with the outline the analyzer built (red rectangle: the plan's own envelope, `final.outline.*.envelopePx`)
and the printed dimensions that frame it (blue brackets: `spanPx`, with the printed length), all in the plan's own pixels as
the run recorded them. Right: an enlarged region of the same picture with the same marks (fractions 0..1). Below: the
model's top and four axonometrics before and after (the pictures the consultant was shown). Nothing is fitted or redrawn.
"""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
for k in ('title', 'out', 'plan', 'consult'):
    ap.add_argument(f'--{k}', required=True)
ap.add_argument('--zoom', default=None)
ap.add_argument('--zoom-title', default='SZCZEGÓŁ')
ap.add_argument('--around-before', default='-')
ap.add_argument('--around-after', default='-')
a = ap.parse_args()
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = lambda s, b=False: ImageFont.truetype(BOLD if b else FONT, s)
W, PAD = 1680, 16

c = json.load(open(a.consult))
o = (c.get('final') or {}).get('outline')
plan = Image.open(a.plan).convert('RGB')
# the run's plan pixels are the picture's own pixels when the frame is the whole picture; a recorded frame size says so
frame = next((p for g in c.get('geometry') or [] for p in g.get('pictures') or [] if p.get('n') == 1), None)
k = plan.width / frame['width'] if frame and frame.get('width') else 1.0
S = 2
big = plan.resize((plan.width * S, plan.height * S), Image.LANCZOS)
d = ImageDraw.Draw(big)
m = k * S
notes = []
if o:
    ex, ey = o['x'].get('envelopePx'), o['y'].get('envelopePx')
    if ex and ey:
        d.rectangle([ex[0] * m, ey[0] * m, ex[1] * m, ey[1] * m], outline=(220, 30, 30), width=5)
    for axis in ('x', 'y'):
        sp = o[axis].get('spanPx')
        if not sp:
            continue
        if axis == 'x':
            y = max(8, (ey[0] if ey else 20) * m - 26)
            d.line([sp[0] * m, y, sp[1] * m, y], fill=(30, 60, 220), width=5)
            for x in sp:
                d.line([x * m, y - 14, x * m, y + 14], fill=(30, 60, 220), width=5)
        else:
            x = max(8, (ex[0] if ex else 20) * m - 26)
            d.line([x, sp[0] * m, x, sp[1] * m], fill=(30, 60, 220), width=5)
            for y in sp:
                d.line([x - 14, y * m, x + 14, y * m], fill=(30, 60, 220), width=5)
        notes.append(f"oś {axis.upper()}: wymiar wydrukowany {o[axis].get('spanM')} m — {o[axis]['status']}" + (f", różnica {o[axis]['offM']} m" if o[axis].get('offM') else ''))


def fit(im, w, h):
    q = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * q)), max(1, int(im.height * q))), Image.LANCZOS)


def label(text, size=22, bold=True):
    im = Image.new('RGB', (W, size + 18), (255, 255, 255))
    ImageDraw.Draw(im).text((PAD, 8), text, font=font(size, bold), fill=(30, 30, 30))
    return im


rows = [label(a.title, 28), label('RZUT ŹRÓDŁOWY — czerwony: obrys zbudowany przez analizator; niebieski: wymiar wydrukowany, który go ramuje', 20)]
for n in notes:
    rows.append(label(n, 18, False))
half = (W - 3 * PAD) // 2
left = fit(big, half, 760)
row = Image.new('RGB', (W, 760 + 2 * PAD), (255, 255, 255))
row.paste(left, (PAD, PAD))
if a.zoom:
    x0, y0, x1, y1 = [float(v) for v in a.zoom.split(',')]
    z = fit(big.crop((int(x0 * big.width), int(y0 * big.height), int(x1 * big.width), int(y1 * big.height))), half, 760)
    row.paste(z, (2 * PAD + half, PAD))
    ImageDraw.Draw(row).text((2 * PAD + half + 8, PAD + 4), a.zoom_title, font=font(20, True), fill=(160, 20, 20))
rows.append(row)
for name, path in (('PRZED — góra i cztery aksonometrie modelu', a.around_before), ('PO — góra i cztery aksonometrie modelu', a.around_after)):
    if path != '-' and os.path.exists(path):
        im = Image.open(path).convert('RGB')
        rows.append(label(name))
        rows.append(im.resize((W, int(im.height * W / im.width)), Image.LANCZOS))
H = sum(r.height for r in rows)
out = Image.new('RGB', (W, H), (255, 255, 255))
y = 0
for r in rows:
    out.paste(r, (0, y))
    y += r.height
out.save(a.out)
print(a.out, out.size)
