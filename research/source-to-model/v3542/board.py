"""v3.54.2 boards ŹRÓDŁO | ANALIZATOR PRZED | ANALIZATOR PO KONSULTACJI (private: they show publishers' pictures).

  /usr/bin/python3 -I board.py --pics <exported pictures dir> --title <house> --out <prefix>
      --before <run dir> --after <run dir or -> --note-before <text> --note-after <text> [--consult <consult.json>]

Two boards per house, readable on a phone:
  <prefix>-plan.png   : the source floor plan the analyzer read (the consulted labels outlined in red, numbered as
                        in the API interaction) | the plan overlay of the run before | the plan overlay after
  <prefix>-views.png  : the source elevations (as published, up to four; perspective pictures marked) | the model's
                        nine views before | after — the same cameras and tiles for both runs, never refitted
A run with no model shows its refusal in words, never an empty picture.
"""
import argparse, glob, json, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
for k in ('pics', 'title', 'out', 'before'):
    ap.add_argument(f'--{k}', required=True)
ap.add_argument('--after', default='-')
ap.add_argument('--note-before', default='')
ap.add_argument('--note-after', default='')
ap.add_argument('--consult', default=None)
a = ap.parse_args()

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f = lambda p, s: ImageFont.truetype(p, s) if os.path.exists(p) else ImageFont.load_default()
font, small, title = f(FONT, 22), f(FONT, 18), f(BOLD, 28)
W = 1800


def fit(im, w, h):
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)


def words(d, xy, text, fnt, width, fill='black'):
    x, y = xy
    line = ''
    for w in text.split():
        t = (line + ' ' + w).strip()
        if d.textlength(t, font=fnt) > width:
            d.text((x, y), line, font=fnt, fill=fill)
            y += fnt.size + 6
            line = w
        else:
            line = t
    if line:
        d.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + 6
    return y


def refusal(run, h):
    im = Image.new('RGB', (W, h), (250, 244, 240))
    d = ImageDraw.Draw(im)
    p = os.path.join(run, 'failure.json')
    msg = 'no run'
    if os.path.exists(p):
        fj = json.load(open(p))
        msg = f"ODMOWA: {fj.get('code')} / {fj.get('reasonCode') or (fj.get('diagnostics') or {}).get('firstFailure')} — {fj.get('message', '')[:600]}"
    words(d, (20, 20), msg, font, W - 40, fill=(140, 30, 20))
    return im


def band(label, note, h=70):
    im = Image.new('RGB', (W, h), (235, 238, 245))
    d = ImageDraw.Draw(im)
    d.text((16, 8), label, font=title, fill=(20, 30, 60))
    if note:
        words(d, (16, 42), note, small, W - 32, fill=(60, 60, 60))
    return im


def stack(parts):
    h = sum(p.height for p in parts)
    out = Image.new('RGB', (W, h), 'white')
    y = 0
    for p in parts:
        out.paste(p, (0, y))
        y += p.height
    return out


idx = json.load(open(os.path.join(a.pics, 'index.json')))
pics = [p for p in idx['pictures'] if p.get('file')]
plans = [p for p in pics if p.get('doc') == 'FLOOR_PLAN']
elev = [p for p in pics if p.get('doc') == 'ELEVATION']
persp = [p for p in pics if p.get('doc') == 'PERSPECTIVE_RENDER']


def run_plan(run, h):
    if run == '-' or not os.path.isdir(run):
        return None
    shots = sorted(glob.glob(os.path.join(run, 'plan-diagnostics', '*-all.png'))) or ([os.path.join(run, 'plan-overlay.png')] if os.path.exists(os.path.join(run, 'plan-overlay.png')) else [])
    if not shots:
        return None
    im = Image.new('RGB', (W, h), 'white')
    k = len(shots[:2])
    for i, s in enumerate(shots[:2]):
        im.paste(fit(Image.open(s).convert('RGB'), W // k - 8, h), (i * (W // k), 0))
    return im


# --- board 1: plans ---------------------------------------------------------------------------------------------
H = 620
src = Image.new('RGB', (W, H), 'white')
if plans:
    best = sorted(plans, key=lambda p: -p['origPx'][0] * p['origPx'][1])[:2]
    for i, p in enumerate(best):
        src.paste(fit(Image.open(os.path.join(a.pics, p['file'])).convert('RGB'), W // len(best) - 8, H), (i * (W // len(best)), 0))
consult_note = ''
if a.consult and os.path.exists(a.consult):
    c = json.load(open(a.consult))
    rows = []
    for r in c.get('rounds', []):
        for v in r.get('verdicts', []):
            rows.append(f"{v['targetId']}={v['literal']} {v['status']}")
        rows.append(f"[runda {r['round']}: {r['decision']}]")
    mc = c.get('modelCheck') or {}
    if mc.get('review'):
        rows.append(f"kontrola modelu: {mc['review']['status']}, {len(mc['review'].get('proposedCorrections', []))} propozycji (bez konsumenta)")
    consult_note = '; '.join(rows)
before_plan = run_plan(a.before, H) or refusal(a.before, 260)
after_plan = run_plan(a.after, H) if a.after != '-' else None
parts = [band(f"{a.title} — plansza 1/2: rzut", 'ŹRÓDŁO: rzut wydawcy (bez zmian).'), src, band('ANALIZATOR PRZED (LOCAL, konsultant wyłączony)', a.note_before), before_plan, band('ANALIZATOR PO KONSULTACJI', (a.note_after + (' — ' + consult_note if consult_note else '')).strip())]
parts.append(after_plan or (refusal(a.after, 260) if a.after != '-' else band('', 'brak zmian: wynik LOCAL zachowany', 60)))
stack(parts).save(a.out + '-plan.png')

# --- board 2: elevations and model views -----------------------------------------------------------------------
H2 = 560
src2 = Image.new('RGB', (W, H2), 'white')
show = elev[:4] if elev else persp[:2]
for i, p in enumerate(show):
    src2.paste(fit(Image.open(os.path.join(a.pics, p['file'])).convert('RGB'), W // max(1, len(show)) - 8, H2), (i * (W // max(1, len(show))), 0))
srcnote = 'ŹRÓDŁO: elewacje wydawcy, jak opublikowane' + ('' if elev else ' — brak elewacji ortogonalnych: wizualizacja perspektywiczna (nie ortografia)')


def views(run):
    p = os.path.join(run, 'scene-all-sides.png')
    return fit(Image.open(p).convert('RGB'), W, 720) if run != '-' and os.path.exists(p) else None


vb = views(a.before) or refusal(a.before, 200)
va = views(a.after) if a.after != '-' else None
parts = [band(f"{a.title} — plansza 2/2: elewacje i widoki modelu", srcnote), src2, band('ANALIZATOR PRZED — przód, prawa, tył, lewa, góra; aksonometrie: przód-prawo, przód-lewo, tył-lewo, tył-prawo', a.note_before), vb, band('ANALIZATOR PO KONSULTACJI — te same kamery', a.note_after)]
parts.append(va or (refusal(a.after, 200) if a.after != '-' else band('', 'brak zmian: wynik LOCAL zachowany', 60)))
stack(parts).save(a.out + '-views.png')
print(a.out)
