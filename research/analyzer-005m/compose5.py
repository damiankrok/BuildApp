#!/usr/bin/env python3
"""compose5.py - the five input modes of BUILDPLAN-ANALYZER-005M (RESEARCH ONLY; pictures stay outside the repository).

    python -I -B research/analyzer-005m/compose5.py --pool <W>/corpus/pool.json --selection <W>/corpus/selection.json \
        --bands <W>/bands/bands.json --out <W>/items

For every selected question, the SAME question text and options in five modes (brief section 5):

  A_CROP_ONLY                         one image: a square close-up (CROP_SIDE px) around the target, ROI marked in cyan
  B_FULL_PLAN                         one image: the whole plan (longest side PLAN_MAX_SIDE, downscale only), nothing
                                      drawn; the ROI is given as 0..1000 coordinates in the text
  C_FULL_PLAN_MARKED_ROI              one image: the whole plan with the ROI marked in cyan
  D_MARKED_ROI_PLUS_CROP              two images: C's plan, then A's crop (native multi-image; no composite)
  E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY two images: C's plan plus the analyzer's own wall-band axes in neutral purple, then
                                      A's crop

The overlay carries only what the production analyzer observed (planSheet wall bands, read-only, research/analyzer-005j/
bands.ts): no expected answer, no published area, no verdict, no house name, no green/red. Cyan marks the question; it is
never red (publishers draw dimensions in red). D reuses C's plan bytes and A's crop bytes, so a mode differs from
another only by what the mode adds.

Crop: centred on the target, side = 2 x (half extent + max(3 m, 0.6 x half extent)), padded with paper, clipped to the
question's panel (STOREY: the ground plan only, so a crop cannot see the upper floor).
"""
import argparse
import hashlib
import json
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CROP_SIDE, MODES, OVERLAY, PLAN_MAX_SIDE, ROI, ROI_FILL, answer_schema, letter_of, prompt_for  # noqa: E402

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def pts_of(target, kind):
    if kind == 'AB_REGIONS':
        return target['A'] + target['B']
    return target


def bbox(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def crop_box(q):
    x0, y0, x1, y1 = bbox(pts_of(q['target'], q['targetKind']))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(x1 - x0, y1 - y0) / 2
    s = half + max(3.0 * q['ppm'], 0.6 * half)
    return cx - s, cy - s, cx + s, cy + s


def wall_px(q):
    return q.get('wallPx') or 0.3 * q['ppm']


def dashed(d, a, b, width, on=10, off=7, fill=ROI):
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    s = 0.0
    while s < L:
        e = min(L, s + on)
        d.line([(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L), (a[0] + (b[0] - a[0]) * e / L, a[1] + (b[1] - a[1]) * e / L)], fill=fill, width=width)
        s = e + off


def draw_marker(img, q, M, k):
    """The question's own geometry in cyan. M maps source px -> image px; k is the scale (image px per source px)."""
    over = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    kind, t = q['targetKind'], q['target']
    w = 3
    if kind == 'REGION':
        poly = [M(p) for p in t]
        d.polygon(poly, fill=ROI_FILL)
        d.line(poly + [poly[0]], fill=ROI + (255,), width=w)
    elif kind == 'SEGMENT':
        (ax, ay), (bx, by) = M(t[0]), M(t[1])
        L = math.hypot(bx - ax, by - ay) or 1.0
        ux, uy = (bx - ax) / L, (by - ay) / L
        nx, ny = -uy, ux
        off = wall_px(q) * k / 2 + 5
        tick = max(6, wall_px(q) * k * 0.6)
        for side in (-1, 1):
            p0 = (ax + nx * off * side, ay + ny * off * side)
            p1 = (bx + nx * off * side, by + ny * off * side)
            d.line([p0, p1], fill=ROI + (255,), width=w)
            for p in (p0, p1):
                d.line([p, (p[0] + nx * tick * side, p[1] + ny * tick * side)], fill=ROI + (255,), width=w)
    elif kind == 'AB_REGIONS':
        font = ImageFont.truetype(FONT, 18)
        for key, label, dash in (('A', '1', False), ('B', '2', True)):
            poly = [M(p) for p in t[key]]
            ring = poly + [poly[0]]
            for a, b in zip(ring[:-1], ring[1:]):
                if dash:
                    dashed(d, a, b, w, fill=ROI + (255,))
                else:
                    d.line([a, b], fill=ROI + (255,), width=w)
            lx, ly = min(p[0] for p in poly), min(p[1] for p in poly)
            lx, ly = max(2, min(img.size[0] - 24, lx + (4 if key == 'A' else 26))), max(2, min(img.size[1] - 24, ly + 4))
            d.rectangle([lx - 2, ly - 1, lx + 16, ly + 21], fill=(255, 255, 255, 235))
            d.text((lx + 1, ly), label, font=font, fill=ROI + (255,))
    return Image.alpha_composite(img.convert('RGBA'), over).convert('RGB')


def draw_bands(img, bands, k):
    d = ImageDraw.Draw(img)
    for b in bands:
        bb = b['bounds']
        if b.get('axis') in ('H', 'HORIZONTAL'):
            y = (bb['y0'] + bb['y1']) / 2 * k
            d.line([(bb['x0'] * k, y), (bb['x1'] * k, y)], fill=OVERLAY, width=2)
        else:
            x = (bb['x0'] + bb['x1']) / 2 * k
            d.line([(x, bb['y0'] * k), (x, bb['y1'] * k)], fill=OVERLAY, width=2)
    return img


def save(img, out, name):
    path = os.path.join(out, 'img', name)
    img.save(path)
    return name, hashlib.sha256(open(path, 'rb').read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pool', required=True)
    ap.add_argument('--selection', required=True)
    ap.add_argument('--bands', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    if os.path.abspath(a.out).startswith(REPO):
        raise SystemExit('pictures stay outside the repository')
    pool = {q['qid']: q for q in json.load(open(a.pool))['questions']}
    sel = json.load(open(a.selection))
    bands = json.load(open(a.bands))['files']
    os.makedirs(os.path.join(a.out, 'img'), exist_ok=True)
    items, crops = [], {}
    for qid in sel['phase2']:
        q = pool[qid]
        src = Image.open(q['sources'][0]['path']).convert('RGB')
        assert hashlib.sha256(open(q['sources'][0]['path'], 'rb').read()).hexdigest() == q['sources'][0]['sha256'], qid
        W, H = src.size
        kp = min(1.0, PLAN_MAX_SIDE / max(W, H))
        plan = src.resize((round(W * kp), round(H * kp)), Image.LANCZOS) if kp < 1 else src.copy()
        Mp = lambda p: (p[0] * kp, p[1] * kp)
        # crop, clipped to the question's panel
        x0, y0, x1, y1 = crop_box(q)
        side = x1 - x0
        paper = Image.new('RGB', (max(1, round(side)), max(1, round(side))), (255, 255, 255))
        clip = src
        if q.get('cropPanel'):
            px0, py0, px1, py1 = [int(round(v)) for v in q['cropPanel']]
            clip = Image.new('RGB', src.size, (255, 255, 255))
            clip.paste(src.crop((max(0, px0), max(0, py0), min(W, px1), min(H, py1))), (max(0, px0), max(0, py0)))
        ix0, iy0 = int(round(x0)), int(round(y0))
        paper.paste(clip, (-ix0, -iy0))
        kc = CROP_SIDE / side
        crop = paper.resize((CROP_SIDE, CROP_SIDE), Image.LANCZOS if kc < 1 else Image.BICUBIC)
        Mc = lambda p: ((p[0] - ix0) * kc, (p[1] - iy0) * kc)
        base = qid.replace(':', '_')
        crop_m = draw_marker(crop, q, Mc, kc)
        plan_m = draw_marker(plan, q, Mp, kp)
        b = bands.get(q['sources'][0]['sha256'], {}).get('bands', [])
        plan_o = draw_marker(draw_bands(plan.copy(), b, kp), q, Mp, kp)
        names = {}
        for tag, im in (('crop', crop_m), ('plan', plan), ('planm', plan_m), ('plano', plan_o)):
            names[tag] = save(im, a.out, f'{base}__{tag}.png')
        crops[qid] = names['crop'][1]
        tp = q['target'] if q['targetKind'] != 'AB_REGIONS' else q['target']
        target_plan = {'A': [Mp(p) for p in tp['A']], 'B': [Mp(p) for p in tp['B']]} if q['targetKind'] == 'AB_REGIONS' else [Mp(p) for p in tp]
        imgs = {'A_CROP_ONLY': ['crop'], 'B_FULL_PLAN': ['plan'], 'C_FULL_PLAN_MARKED_ROI': ['planm'],
                'D_MARKED_ROI_PLUS_CROP': ['planm', 'crop'], 'E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY': ['plano', 'crop']}
        for mode in MODES:
            prompt, shown = prompt_for(q, mode, plan.size, target_plan, bool(b))
            items.append({'key': f'{qid}|{mode}', 'qid': qid, 'mode': mode, 'images': [names[t][0] for t in imgs[mode]],
                          'imageSha256': [names[t][1] for t in imgs[mode]], 'imageSizes': [list((crop_m if t == 'crop' else plan).size) for t in imgs[mode]],
                          'prompt': prompt, 'schema': answer_schema(shown), 'shown': shown, 'expected': q['expected'],
                          'expectedLetter': letter_of(shown, q['expected']), 'set': q['set'], 'cls': q['cls'], 'group': q['group'],
                          'transform': q['transform'], 'baseQid': q['baseQid'], 'pairQid': q['pairQid'], 'variant': q.get('variant'),
                          'contextDependent': q.get('contextDependent', False), 'truthSource': q['truthSource'],
                          'phase1': qid in sel['phase1'], 'bandsShown': len(b) if mode.startswith('E') else 0})
    # the counterfactual twin of a question is the same question id with the other variant (same transform)
    for it in items:
        v = it.get('variant')
        if v in ('A', 'B'):
            other = it['qid'].replace(f'-{v}-{it["transform"]}-', f'-{"B" if v == "A" else "A"}-{it["transform"]}-')
            it['pairItemQid'] = other if other in crops else None
        # context-dependent pairs: are the two crops really the same pixels?
        if it['contextDependent'] and it.get('pairItemQid'):
            a_img = Image.open(os.path.join(a.out, 'img', it['qid'].replace(':', '_') + '__crop.png')).convert('L')
            b_img = Image.open(os.path.join(a.out, 'img', it['pairItemQid'].replace(':', '_') + '__crop.png')).convert('L')
            diff = ImageChops.difference(a_img, b_img)
            it['cropMaxAbsDiffToPair'] = diff.getextrema()[1]
            it['cropIdenticalToPair'] = crops[it['qid']] == crops[it['pairItemQid']]
    with open(os.path.join(a.out, 'items.jsonl'), 'w') as fh:
        for it in items:
            fh.write(json.dumps(it) + '\n')
    cd = [it for it in items if it['mode'] == 'A_CROP_ONLY' and 'cropIdenticalToPair' in it]
    print(json.dumps({'items': len(items), 'questions': len(sel['phase2']), 'contextPairsCropIdentical': sum(it['cropIdenticalToPair'] for it in cd), 'contextItemsWithPair': len(cd)}))


if __name__ == '__main__':
    main()
