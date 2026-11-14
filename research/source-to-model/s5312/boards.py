"""v3.53.12 boards: ŹRÓDŁO | PRZED | PO on one image.

Row 1: the plan sheet and both plan overlays in the same pixels (the analysis frame of the selected plan).
Row 2: the source elevation or section (when given) and both models from the SAME cameras at the SAME scale
       (`pair-views.ts`: one fit for both models, never a per-model auto-fit).
Row 3: notes — the line, its ticks, the literal read, the anchors used and the effect on the outline — and the legend
       of the overlay (detected ink vs built bodies).
Optional zoom rows: the same rectangle of the sheet and of both overlays, enlarged.
A refused run shows its refusal code and its whole reason, wrapped, never cut. The boards hold publisher drawings and
stay private: write them outside the repository. Run with python3.12 -I (Pillow).

  python3.12 -I boards.py --source <sheet.png> --before <run dir> --after <run dir> --asset <asset prefix> \
      --title "<house>" --out <board.png> --views <pair-views prefix> [--elevation <png>] \
      [--note "<line>" ...] [--zoom x0,y0,x1,y1:label ...] [--before-label "PRZED (1337)"] [--after-label "PO"]
"""
import argparse
import json
import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

W = 520

LEGEND = [
    ((30, 80, 220), 'niebieski: wykryty tusz ścian (pasma)'),
    ((30, 150, 60), 'zielony: komórka zbudowana (bryła)'),
    ((235, 160, 20), 'bursztyn: wnęka (otwarta, przy bryle)'),
    ((214, 40, 40), 'czerwony: na zewnątrz / otwarte'),
    ((200, 30, 200), 'magenta: linie siatki (ściany i wymiary)'),
    ((240, 110, 0), 'pomarańcz: łańcuchy wymiarów z kreskami; ramka obszaru dowodów'),
    ((0, 170, 200), 'cyjan: obwiednia'),
    ((20, 60, 30), 'ciemna ramka: bryły modelu'),
]


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
    return f"ODMOWA {d.get('code')}: {d.get('message')}"


def summary(run):
    f = os.path.join(run, 'result-summary.json')
    if not os.path.exists(f):
        full = refusal(run)
        if not full:
            return 'brak wyniku'
        head = full.split(':', 2)
        return (':'.join(head[:2]) if len(head) > 2 else full)[:200] + ' … (pełny tekst odmowy w wierszu 3D)'
    r = json.load(open(f))
    m = r.get('measurement') or {}
    c = m.get('coverage') or {}
    s = m.get('scale') or {}
    return f"MODEL · pokrycie {c.get('status')} {c.get('builtM2')}/{c.get('publishedM2')} m² · skala {s.get('status')} {s.get('builtCmPerPx')} cm/px · ilości {m.get('quantities')} · {str(r.get('modelHash'))[:12]}"


def text_block(lines, width, size=13, colour=(0, 0, 0), wrap=78):
    out = []
    for line in lines:
        out.extend(textwrap.wrap(line, wrap) or [''])
    img = Image.new('RGB', (width, 10 + (size + 5) * len(out)), 'white')
    d = ImageDraw.Draw(img)
    for i, line in enumerate(out):
        d.text((10, 5 + (size + 5) * i), line, fill=colour, font=font(size))
    return img


def fit(img, size):
    t = Image.new('RGB', size, 'white')
    if img is not None:
        k = min(size[0] / img.width, size[1] / img.height)
        im = img.resize((max(1, int(img.width * k)), max(1, int(img.height * k))), Image.NEAREST if k > 1 else Image.LANCZOS)
        t.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    return t


def load(p):
    return Image.open(p).convert('RGB') if p and os.path.exists(p) else None


def main():
    a = argparse.ArgumentParser()
    for k in ['source', 'before', 'after', 'asset', 'title', 'out', 'views']:
        a.add_argument('--' + k, required=True)
    a.add_argument('--elevation')
    a.add_argument('--note', action='append', default=[])
    a.add_argument('--zoom', action='append', default=[])
    a.add_argument('--before-label', default='PRZED (1337)')
    a.add_argument('--after-label', default='PO (v3.53.12)')
    o = a.parse_args()
    ov = lambda run: load(os.path.join(run, 'plan-diagnostics', f'{o.asset}-all.png'))
    cols = [('ŹRÓDŁO', load(o.source), None), (o.before_label, ov(o.before), o.before), (o.after_label, ov(o.after), o.after)]
    rows = [text_block([o.title], W * 3, 22)]
    heads = []
    for name, _, run in cols:
        heads.append(text_block([name] + ([summary(run)] if run else ['rzut źródłowy w ramie analizy']), W, 12, wrap=62))
    h = max(x.height for x in heads)
    head = Image.new('RGB', (W * 3, h), 'white')
    for i, x in enumerate(heads):
        head.paste(x, (i * W, 0))
    rows.append(head)
    plan = Image.new('RGB', (W * 3, W), 'white')
    for i, (_, img, run) in enumerate(cols):
        if img is None and run is not None:
            plan.paste(text_block([refusal(run) or 'brak nakładki'], W, 12, (160, 0, 0), 62), (i * W, 0))
        else:
            plan.paste(fit(img, (W, W)), (i * W, 0))
    rows.append(plan)
    sc = Image.new('RGB', (W * 3, W), 'white')
    elev = load(o.elevation)
    sc.paste(fit(elev, (W, W)) if elev else text_block(['elewacja / przekrój źródłowy: nie dołączono'], W, 12), (0, 0))
    for i, (side, run) in enumerate([('before', o.before), ('after', o.after)], start=1):
        img = load(f'{o.views}-{side}.png')
        has_model = os.path.exists(os.path.join(run, 'result-summary.json'))
        if has_model and img is not None:
            sc.paste(fit(img, (W, W)), (i * W, 0))
        else:
            sc.paste(text_block(['brak modelu — ' + (refusal(run) or 'brak wyniku')], W, 12, (160, 0, 0), 62), (i * W, 0))
    rows.append(sc)
    rows.append(text_block(['3D: te same kamery (przód, prawy bok, góra, aksonometria), ta sama skala dla PRZED i PO (wspólne dopasowanie obu modeli).'], W * 3, 12, wrap=200))
    if o.note:
        rows.append(text_block(o.note, W * 3, 13, wrap=200))
    leg = Image.new('RGB', (W * 3, 22 * ((len(LEGEND) + 1) // 2) + 30), 'white')
    d = ImageDraw.Draw(leg)
    d.text((10, 4), 'Legenda nakładki', fill='black', font=font(13))
    for k, (rgb, label) in enumerate(LEGEND):
        x = 10 + (k % 2) * (W * 3 // 2)
        y = 26 + 22 * (k // 2)
        d.rectangle([x, y, x + 16, y + 14], fill=rgb)
        d.text((x + 24, y), label, fill='black', font=font(12))
    rows.append(leg)
    for z in o.zoom:
        rect, _, label = z.partition(':')
        x0, y0, x1, y1 = [int(v) for v in rect.split(',')]
        zr = Image.new('RGB', (W * 3, W // 2 + 24), 'white')
        ImageDraw.Draw(zr).text((10, 4), f'powiększenie: {label}  ({x0},{y0})–({x1},{y1})', fill='black', font=font(13))
        for i, (_, img, _run) in enumerate(cols):
            if img is not None:
                zr.paste(fit(img.crop((x0, y0, x1, y1)), (W, W // 2)), (i * W, 24))
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
