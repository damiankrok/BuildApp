#!/usr/bin/env python3
"""v3.54.17 R2 §5 — per house a board (rows: the four sides; columns: source | sketch | before | final host) and one
offline gallery.html (relative links, no script), from the files `sketch-delivery.ts` wrote. A missing cell says why.
Then every local href/src of the gallery is checked against the files (run it again on the unpacked ZIP).
   /usr/bin/python3 -I boards-gallery.py <delivery dir>            build boards + gallery, then check
   /usr/bin/python3 -I boards-gallery.py --check <unpacked dir>    only check every href/src resolves"""
import html, json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

_TTF = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT = ImageFont.truetype(_TTF, 12) if os.path.exists(_TTF) else ImageFont.load_default()

SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
ORDER = [('alaska', 'Alaska — DEV (host revision f0c3b54b as final)'), ('layla', 'Layla — DEV (no model: BUILD_MASSING not built, 10-corner outline)'), ('aurora-maxi', 'Aurora-maxi-ii-bis-sz — trial, first result kept'), ('aurora-midi', 'Aurora-midi-ii — trial, first result FAILED (kept)')]
H = 230


def check(root):
    g = open(os.path.join(root, 'gallery.html'), encoding='utf-8').read()
    refs = sorted(set(re.findall(r'(?:src|href)="([^"#]+)"', g)))
    bad = [r for r in refs if not re.match(r'^[a-z]+:', r) and not os.path.exists(os.path.join(root, r))]
    rep = {'gallery': 'gallery.html', 'references': len(refs), 'missing': bad}
    json.dump(rep, open(os.path.join(root, 'gallery-link-check.json'), 'w'), indent=1)
    print(json.dumps(rep))
    return not bad


def cell(path, text, w=None):
    if path and os.path.exists(path):
        im = Image.open(path).convert('RGB')
        k = H / im.height
        im = im.resize((max(1, int(im.width * k)), H))
        if w and im.width > w:
            k = w / im.width
            im = im.resize((w, max(1, int(im.height * k))))
        return im
    im = Image.new('RGB', (w or 300, H), (236, 236, 236))
    d = ImageDraw.Draw(im)
    words, line, y = (text or 'brak').split(), '', 8
    for wd in words:
        if len(line) + len(wd) > 44:
            d.text((8, y), line, fill=(60, 60, 60), font=FONT); y += 15; line = ''
        line += wd + ' '
    d.text((8, y), line, fill=(60, 60, 60), font=FONT)
    return im


def tile(path, i):
    if not path or not os.path.exists(path):
        return None
    im = Image.open(path).convert('RGB')
    t = im.width // 4
    out = path.replace('-SIDES.png', f'-{SIDES[i]}.png')
    im.crop((i * t, 0, (i + 1) * t, im.height)).save(out)
    return out


def board(d, house, idx):
    rows = []
    for i, s in enumerate(idx['sides']):
        hd = os.path.join(d, house)
        before = tile(os.path.join(hd, idx['before']) if idx.get('before') else None, i)
        final = tile(os.path.join(hd, idx['final']) if idx.get('final') else None, i)
        why_b = 'brak modelu przed korektą (LOCAL nie zbudował modelu)' if not idx.get('before') else ''
        why_f = ('finalny host: zadanie FAILED — brak dostarczonego modelu' if idx.get('failedJob') else 'brak finalnego modelu hosta (DEV bez dostawy hosta)') if not idx.get('final') else ''
        rows.append([cell(os.path.join(hd, s['source']) if s.get('source') else None, f"{s['side']}: brak źródła", 420),
                     cell(os.path.join(hd, s['sketch']) if s.get('sketch') else None, f"{s['side']}: {s['status']} — {s['why'][:200]}", 420),
                     cell(before, why_b, 300), cell(final, why_f, 300)])
    widths = [max(r[c].width for r in rows) for c in range(4)]
    W = sum(widths) + 50
    Ht = 30 + len(rows) * (H + 24)
    out = Image.new('RGB', (W, Ht), (255, 255, 255))
    dr = ImageDraw.Draw(out)
    x = 10
    for c, t in enumerate(['źródło', 'szkic (prawdziwy odczyt)', 'przed korektą', 'finalny host']):
        dr.text((x, 8), t, fill=(0, 0, 0), font=FONT); x += widths[c] + 10
    y = 30
    for i, r in enumerate(rows):
        dr.text((10, y), f"{idx['sides'][i]['side']} · {idx['sides'][i]['status']}", fill=(0, 0, 0), font=FONT)
        x = 10
        for c in range(4):
            out.paste(r[c], (x, y + 14)); x += widths[c] + 10
        y += H + 24
    p = os.path.join(d, house, f'{house}-board.png')
    out.save(p, optimize=True)
    return f'{house}/{house}-board.png'


def main(d):
    hs = ['<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BuildPlan v3.54.17 R2 — szkice</title>',
          '<style>body{font:14px system-ui,sans-serif;margin:16px;background:#fff;color:#222}h2{margin-top:28px}.g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}figure{margin:0;border:1px solid #ddd;padding:6px}img{width:100%;height:auto;display:block}figcaption{font-size:12px}small{color:#555}.s{font-weight:600}@media(max-width:700px){.g{grid-template-columns:repeat(2,minmax(0,1fr))}}</style></head><body>',
          '<h1>BuildPlan v3.54.17 R2 — cztery strony każdego ocenianego domu</h1><p>Oryginał elewacji obok szkicu narysowanego z <b>prawdziwego</b> odczytu API (z zachowanej odpowiedzi; 0 nowych żądań). Brak szkicu ma zawsze nazwany powód: NOT_REQUESTED (o tę stronę nie pytano), MISSING_SOURCE (źródło nie ma tej elewacji), FAILED. Nic nie jest domalowane. Pod spodem plansza: źródło | szkic | przed korektą | finalny host.</p>']
    for house, title in ORDER:
        ip = os.path.join(d, house, 'index.json')
        if not os.path.exists(ip):
            continue
        idx = json.load(open(ip))
        b = board(d, house, idx)
        hs.append(f'<h2>{html.escape(title)}</h2><div class="g">')
        for s in idx['sides']:
            hs.append(f'<figure><figcaption><b>{s["side"]}</b> · <span class="s">{html.escape(s["status"])}</span></figcaption>')
            if s.get('source'):
                hs.append(f'<img src="{house}/{s["source"]}" alt="{house} {s["side"]} — oryginał">')
            if s.get('sketch'):
                base = s['sketch'][:-len('sketch.png')]
                hs.append(f'<img src="{house}/{s["sketch"]}" alt="{house} {s["side"]} — szkic"><small><a href="{house}/{base}sketch.svg">SVG</a> · <a href="{house}/{base}sketch.json">JSON</a> · <a href="{house}/{base}raw.json">raw</a></small>')
            hs.append(f'<br><small>{html.escape(s["why"][:500])}</small></figure>')
        hs.append(f'</div><p><a href="{b}"><img src="{b}" alt="{house} — plansza"></a></p>')
    hs.append('</body></html>')
    open(os.path.join(d, 'gallery.html'), 'w', encoding='utf-8').write('\n'.join(hs))
    return check(d)


if __name__ == '__main__':
    ok = check(sys.argv[2]) if sys.argv[1] == '--check' else main(sys.argv[1])
    sys.exit(0 if ok else 1)
