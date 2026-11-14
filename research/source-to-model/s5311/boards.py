"""v3.53.11 boards: SOURCE / BEFORE / AFTER on one image.

Top row: the plan sheet and the two plan overlays in the same pixels (the analysis frame of the selected plan).
Second row: the scene views of the two models (the renderer's fixed four-view layout: front, side, top, perspective).
Optional zoom rows: the same rectangle of the sheet and of both overlays, enlarged.
A refused run shows its refusal code and reason in its column. The boards hold publisher drawings and stay private:
write them outside the repository. Run with python3.12 -I (Pillow).

  python3.12 -I boards.py --source <sheet.png> --before <run dir> --after <run dir> --asset <asset prefix> \
      --title "<house>" --out <board.png> [--zoom x0,y0,x1,y1:label ...]
"""
import argparse
import json
import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

W = 520  # column width for the plan row


def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def refusal(run):
    f = os.path.join(run, 'failure.json')
    if not os.path.exists(f):
        return None
    d = json.load(open(f))
    return f"{d.get('code')} — {str(d.get('message'))[:300]}"


def summary(run):
    f = os.path.join(run, 'result-summary.json')
    if not os.path.exists(f):
        return 'no model'
    r = json.load(open(f))
    m = r.get('measurement') or {}
    c = m.get('coverage') or {}
    s = m.get('scale') or {}
    return f"{r.get('outcome')} · {c.get('status')} {c.get('builtM2')}/{c.get('publishedM2')} m² · scale {s.get('status')} · {m.get('quantities')} · {str(r.get('modelHash'))[:12]}"


def tile(img, size, text_lines=None):
    t = Image.new('RGB', size, 'white')
    if img is not None:
        im = img.copy()
        im.thumbnail(size)
        t.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    if text_lines:
        d = ImageDraw.Draw(t)
        y = 10
        for line in text_lines:
            for part in textwrap.wrap(line, 60):
                d.text((10, y), part, fill=(160, 0, 0), font=font(14))
                y += 18
    return t


def overlay(run, asset):
    p = os.path.join(run, 'plan-diagnostics', f'{asset}-all.png')
    return Image.open(p).convert('RGB') if os.path.exists(p) else None


def scene(run):
    p = os.path.join(run, 'scene-views.png')
    return Image.open(p).convert('RGB') if os.path.exists(p) else None


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--source', required=True)
    a.add_argument('--before', required=True)
    a.add_argument('--after', required=True)
    a.add_argument('--asset', required=True)
    a.add_argument('--title', required=True)
    a.add_argument('--out', required=True)
    a.add_argument('--zoom', action='append', default=[])
    o = a.parse_args()
    src = Image.open(o.source).convert('RGB')
    cols = [('ŹRÓDŁO', src, None), ('PRZED (1336)', overlay(o.before, o.asset), o.before), ('PO (v3.53.11)', overlay(o.after, o.asset), o.after)]
    rows = []
    head = Image.new('RGB', (W * 3, 96), 'white')
    d = ImageDraw.Draw(head)
    d.text((10, 6), o.title, fill='black', font=font(22))
    for i, (name, _, run) in enumerate(cols):
        d.text((i * W + 10, 38), name, fill='black', font=font(14))
        if run is not None:
            for k, part in enumerate(textwrap.wrap(summary(run), 70)[:2]):
                d.text((i * W + 10, 58 + 16 * k), part, fill='black', font=font(11))
    rows.append(head)
    plan = Image.new('RGB', (W * 3, W), 'white')
    for i, (name, img, run) in enumerate(cols):
        plan.paste(tile(img, (W, W), [refusal(run)] if run and img is None and refusal(run) else None), (i * W, 0))
    rows.append(plan)
    sc = Image.new('RGB', (W * 3, W), 'white')
    sc.paste(tile(None, (W, W), ['scene views: front, side, top, perspective (renderer fits each model)']), (0, 0))
    for i, (_, _, run) in enumerate(cols[1:], start=1):
        img = scene(run)
        sc.paste(tile(img, (W, W), None if img is not None else [refusal(run) or 'no scene']), (i * W, 0))
    rows.append(sc)
    for z in o.zoom:
        rect, _, label = z.partition(':')
        x0, y0, x1, y1 = [int(v) for v in rect.split(',')]
        zr = Image.new('RGB', (W * 3, W // 2 + 24), 'white')
        ImageDraw.Draw(zr).text((10, 4), f'zoom: {label}  ({x0},{y0})–({x1},{y1})', fill='black', font=font(14))
        for i, (_, img, run) in enumerate(cols):
            if img is None:
                continue
            crop = img.crop((x0, y0, x1, y1))
            zr.paste(tile(crop, (W, W // 2)), (i * W, 24))
        rows.append(zr)
    board = Image.new('RGB', (W * 3, sum(r.height for r in rows)), 'white')
    y = 0
    for r in rows:
        board.paste(r, (0, y))
        y += r.height
    board.save(o.out)
    print(o.out, board.size)


if __name__ == '__main__':
    main()
