# v3.45 overlays on the ORIGINAL bytes (private evidence, never committed): what the analyzer read, where, and to what.
# usage: overlay.py section <image> <metric-evidence.json> <sha256> <levels-annotation-line> <out.png>
#        overlay.py plan <image> <metric-evidence.json> <feature-trace.json|-> <frameId> <callouts-project-json> <out.png>
import sys, json
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.load_default()
GREEN, RED, GREY, BLUE, ORANGE = (0, 150, 60), (210, 30, 30), (130, 130, 130), (30, 90, 220), (230, 130, 0)

def scaled(im, k):
    return im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)

def section(img, ev, sha, line, out):
    im = Image.open(img).convert('RGB'); k = 1.5; im = scaled(im, k); d = ImageDraw.Draw(im)
    m = json.load(open(ev))
    ann = []
    for t in line.split()[1:]:
        v, kind = t.rsplit(':', 1); ann.append((float(v), kind.rstrip('!')))
    used = set()
    rows = []
    for e in m['evidence']:
        if e.get('variantByteHash') != sha or e['kind'] not in ('LEVEL_DATUM', 'ANGLE'): continue
        grp = 'A' if e['kind'] == 'ANGLE' else 'L'
        hit = next((i for i, (v, kd) in enumerate(ann) if i not in used and ((grp == 'A' and kd == 'A') or (grp == 'L' and kd not in 'AH')) and abs(v - e['value']) < 0.005), None)
        if hit is not None: used.add(hit)
        b = e.get('textBox') or {}
        col = GREEN if hit is not None else RED
        if b:
            d.rectangle([b['x0'] * k - 2, b['y0'] * k - 2, b['x1'] * k + 2, b['y1'] * k + 2], outline=col, width=2)
            tag = f"{e['rawText'] or e['value']} [{e['provenance']['extractor'][:5]}]"
            d.text((b['x1'] * k + 4, b['y0'] * k), tag, fill=col, font=F)
        g = e.get('measuredGeometry')
        if g and g.get('type') == 'SEGMENT':
            d.line([g['a']['x'] * k, g['a']['y'] * k, g['b']['x'] * k, g['b']['y'] * k], fill=BLUE, width=2)
    missed = [f"{v:+.2f}:{kd}" if kd != 'A' else f"{int(v)}°" for i, (v, kd) in enumerate(ann) if i not in used and kd != 'H']
    d.rectangle([0, 0, im.width, 34], fill=(255, 255, 255))
    d.text((6, 4), f"green = read and equal to the annotation, red = read but not in it, blue = the row/edge it marks", fill=(0, 0, 0), font=F)
    d.text((6, 18), f"missed: {', '.join(missed) if missed else 'none'}  (vertical dimensions H not scored here)", fill=GREY if not missed else RED, font=F)
    im.save(out)

def plan(img, ev, tr, fid, proj, out):
    im = Image.open(img).convert('RGB'); k = 1.5; base = im.width; im = scaled(im, k); d = ImageDraw.Draw(im)
    P = json.loads(proj); s853 = 853.0 / base
    m = json.load(open(ev))
    trace = json.load(open(tr)) if tr != '-' else []
    gaps = [r for r in trace if r['kind'] == 'OPENING_GAP' and r['frameId'] == fid and r.get('storey') == 0]
    for r in gaps:
        pr = r['pixelRect']; cb = r.get('callout')
        col = BLUE if cb else GREY
        d.rectangle([pr['x0'] * k, pr['y0'] * k, pr['x1'] * k, pr['y1'] * k], outline=col, width=2)
        if cb: d.text((pr['x0'] * k, pr['y1'] * k + 2), f"{cb.get('widthCm')}/{cb.get('heightCm')} {r.get('family', '')[:6]}", fill=col, font=F)
    for rg in m.get('calloutRings', []):
        if rg['frameId'] != fid: continue
        c = rg['centrePx']; r = rg['radiusPx']
        col = GREEN if rg['accepted'] else ORANGE
        d.ellipse([(c['x'] - r) * k, (c['y'] - r) * k, (c['x'] + r) * k, (c['y'] + r) * k], outline=col, width=1)
    for c in P['callouts']:
        x, y = c['ring'][0] / s853, c['ring'][1] / s853
        d.text((x * k + 14, y * k - 18), c['text'], fill=(120, 0, 160), font=F)
    d.rectangle([0, 0, im.width, 20], fill=(255, 255, 255))
    d.text((6, 4), 'blue box = opening gap with the callout the solver bound (w/h, family); grey = gap, nothing bound; green ring = both halves read; orange = refused; purple = annotation', fill=(0, 0, 0), font=F)
    im.save(out)

if __name__ == '__main__':
    if sys.argv[1] == 'section': section(*sys.argv[2:7])
    else: plan(*sys.argv[2:8])
