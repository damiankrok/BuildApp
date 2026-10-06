#!/usr/bin/env python3
"""compose.py - question images and prompts for the Visual Referee bake-off (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B compose.py --corpus <corpus.json> --bands <bands.json> --renders <dir> --out <dir> [--subset <ids.txt>]

For every question and every overlay mode it writes ONE image and ONE prompt; every model gets exactly these bytes
(brief section 25). Modes are scored separately (section 26):

  RAW               the source crop only, centred on the detail; the prompt points at "the centre of the image"
  CANDIDATE_OVERLAY the same crop with the question's candidates drawn on it (red target / red A, blue B)
  SEMANTIC_OVERLAY  CANDIDATE_OVERLAY plus what the analyzer already derived: the production plan sheet's wall bands
                    (green), which can be wrong - they are observations, not truth

The crop is square, centred on the target, sized from the target and a fixed context margin, padded with paper, and
scaled so its side is 512 px. Overlays are drawn after scaling (crisp, fixed widths). The prompt is identical across
models; it names the closed answer enum, requires JSON, and always allows UNRESOLVED (section 17-18).
"""
import argparse
import hashlib
import json
import os

from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SIDE = 512
MODES = ['RAW', 'CANDIDATE_OVERLAY', 'SEMANTIC_OVERLAY']

PREAMBLE = 'This image is a crop of an architectural floor plan drawing seen from above. Walls are drawn as thick dark bands; windows, doors and garage doors are gaps in the walls with thin symbols across them.'

LEGEND = {
    ('RAW', 'REGION'): 'The detail in question is the area at the centre of the image.',
    ('RAW', 'SEGMENT'): 'The detail in question is the line or gap at the centre of the image.',
    ('RAW', 'AB_SEGMENTS'): 'The detail in question is the gap at the centre of the image and the wall on either side of it.',
    ('OVERLAY', 'REGION'): 'The area in question is outlined in red.',
    ('OVERLAY', 'SEGMENT'): 'The line or gap in question is inside the red box.',
    ('OVERLAY', 'AB_SEGMENTS'): 'Wall piece A is inside the red box and wall piece B is inside the blue box; the gap in question lies between them.',
    ('OVERLAY', 'AB_REGIONS'): 'Candidate outline A is drawn in red and candidate outline B is drawn in blue.',
}
SEMANTIC_NOTE = 'Green strips mark wall-thick ink that an automatic analyzer already detected; they may be incomplete or wrong.'

QUESTION = {
    'BODY_REGION': 'Is this area part of the enclosed building body, that is inside the exterior walls of the house (rooms, hall, garage), rather than outside it (terrace, porch, patio, open space between buildings)?',
    'WALL_CONTINUATION': 'Does the exterior wall continue across the gap (the gap is only a window, door or garage door in one continuing wall: CONTINUES), or does the wall really end there so the building is open or steps back (TERMINATES)? Answer NOT_SAME_WALL if the two pieces are not parts of one wall line.',
    'GARAGE_BODY': 'Is this garage area part of the enclosed building footprint, that is attached to the house and closed by walls and a garage door?',
    'TERRACE_VS_BODY': 'Is this area enclosed building interior (ENCLOSED) or an external terrace, porch or patio (EXTERNAL)?',
    'CANOPY_PERGOLA_VS_WALL': 'Is this line an exterior wall of the building (WALL), or only roof, roof overhang, pergola or canopy geometry (NOT_WALL)?',
    'OUTER_BOUNDARY_A_OR_B': 'Which candidate outline better follows the exterior walls of the enclosed building (not terraces or open areas): A, B, or NEITHER?',
    'OPENING_VS_PATTERN': 'Is this gap a real window or door opening in a wall (OPENING), or only a break in hatching, texture or a decorative pattern (PATTERN)?',
    'OPEN_SIDE_VS_OPENINGS': 'Is this stretch of the facade one single place where the building is open (ONE_OPEN_SIDE), or several separate openings - doors, a garage door, a recessed entrance - within a continuing building front (SEVERAL_OPENINGS)?',
    'BAY_OR_RISALIT': 'Is this protrusion part of the enclosed building body (a walled bay or projection of the house)?',
    'STOREY_COVERAGE': 'The image shows two floor plans of the same house, the ground floor (PARTER) and the upper floor (PIETRO). Does the upper floor cover the area outlined in red on the ground floor?',
    'VOID_VS_OUTSIDE': 'Is this area an internal stair opening or void inside the building (VOID), or open-air space outside the building such as a courtyard or atrium (OUTSIDE)?',
    'DIMENSION_LINE_VS_BUILDING_LINE': 'Is this line part of the building drawing such as a wall, terrace edge or roof line (BUILDING), or annotation such as a dimension line (ANNOTATION)?',
    'COLUMN_VS_WALL': 'Is the dark element in question an isolated column or post (COLUMN), or part of a continuous wall (WALL)?',
}
RAW_ALLOWED = {'REGION', 'SEGMENT', 'AB_SEGMENTS'}


def prompt_for(q, mode):
    kind = q['targetKind']
    leg = LEGEND[('RAW' if mode == 'RAW' else 'OVERLAY', kind)]
    parts = [PREAMBLE, leg]
    if mode == 'SEMANTIC_OVERLAY':
        parts.append(SEMANTIC_NOTE)
    parts.append(QUESTION[q['cls']])
    enum = ', '.join(q['enum'])
    parts.append(f'Reply with JSON only, exactly in this form: {{"answer": "<one of: {enum}>", "confidence": <a number from 0 to 1>}}. Answer UNRESOLVED if the drawing does not let you decide.')
    return ' '.join(parts)


def target_points(q):
    t = q['targetPx']
    if isinstance(t, dict):
        return [p for v in t.values() for p in v]
    return t


def crop_box(q, size, ppm):
    pts = target_points(q)
    if q.get('wholeImage'):
        w, h = size
        s = max(w, h)
        return (w / 2 - s / 2, h / 2 - s / 2, w / 2 + s / 2, h / 2 + s / 2)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    half = max(max(xs) - min(xs), max(ys) - min(ys)) / 2
    margin = max(3.0 * ppm, 0.6 * half)
    s = half + margin
    return (cx - s, cy - s, cx + s, cy + s)


def compose_one(src, q, box, mode, bands, paper):
    x0, y0, x1, y1 = box
    side = x1 - x0
    k = SIDE / side
    crop = Image.new('RGB', (int(round(side)), int(round(side))), (paper, paper, paper))
    ix0, iy0 = int(round(x0)), int(round(y0))
    crop.paste(src.convert('RGB'), (-ix0, -iy0))
    img = crop.resize((SIDE, SIDE), Image.LANCZOS if k < 1 else Image.BICUBIC)
    if mode == 'RAW':
        return img
    M = lambda p: ((p[0] - ix0) * k, (p[1] - iy0) * k)
    over = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    if mode == 'SEMANTIC_OVERLAY':
        for b in bands:
            bb = b['bounds']
            d.rectangle([M((bb['x0'], bb['y0'])), M((bb['x1'] + 1, bb['y1'] + 1))], fill=(0, 200, 0, 90))
    t = q['targetPx']
    kind = q['targetKind']
    red, blue = (230, 0, 0, 255), (0, 60, 255, 255)
    font = ImageFont.truetype(FONT, 22)

    def seg_box(pts, col, label=None):
        xs, ys = [M(p)[0] for p in pts], [M(p)[1] for p in pts]
        pad = 9
        d.rectangle([min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad], outline=col, width=3)
        if label:
            lx, ly = max(xs) + pad + 3, min(ys) - pad - 24
            lx, ly = min(max(lx, 2), SIDE - 22), min(max(ly, 2), SIDE - 26)
            d.rectangle([lx - 2, ly - 1, lx + 18, ly + 25], fill=(255, 255, 255, 230))
            d.text((lx, ly), label, font=font, fill=col)

    if kind in ('REGION',):
        poly = [M(p) for p in t]
        d.polygon(poly, fill=(230, 0, 0, 40))
        d.line(poly + [poly[0]], fill=red, width=3)
    elif kind == 'SEGMENT':
        seg_box(t, red)
    elif kind == 'AB_SEGMENTS':
        seg_box(t['A'], red, 'A')
        seg_box(t['B'], blue, 'B')
    elif kind == 'AB_REGIONS':
        for key, col, off in (('A', red, 0), ('B', blue, 4)):
            poly = [M(p) for p in t[key]]
            if off:
                cx = sum(p[0] for p in poly) / len(poly)
                cy = sum(p[1] for p in poly) / len(poly)
                poly = [(p[0] + (cx - p[0]) * off / max(1.0, abs(cx - p[0]) + 1e-9) * (1 if abs(cx - p[0]) > off else 0),
                         p[1] + (cy - p[1]) * off / max(1.0, abs(cy - p[1]) + 1e-9) * (1 if abs(cy - p[1]) > off else 0)) for p in poly]
            d.line(poly + [poly[0]], fill=col, width=3)
        d.rectangle([4, 4, 150, 34], fill=(255, 255, 255, 235))
        d.text((10, 6), 'A', font=font, fill=red)
        d.text((80, 6), 'B', font=font, fill=blue)
    return Image.alpha_composite(img.convert('RGBA'), over).convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', required=True)
    ap.add_argument('--bands', required=True)
    ap.add_argument('--renders', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--subset', default=None)
    ap.add_argument('--side', type=int, default=512)
    ap.add_argument('--modes', default=','.join(MODES))
    a = ap.parse_args()
    global SIDE
    SIDE = a.side
    modes = a.modes.split(',')
    corpus = json.load(open(a.corpus))
    bands = json.load(open(a.bands))['files']
    scenes = {s['sceneId']: s for s in corpus['scenes']}
    keep = None
    if a.subset:
        # lines 'qid MODE' (one mode) or 'qid' (every mode)
        keep = {}
        for line in open(a.subset):
            parts = line.split()
            if parts:
                keep.setdefault(parts[0], set()).update(parts[1:] or MODES)
    os.makedirs(os.path.join(a.out, 'img'), exist_ok=True)
    items = []
    for q in corpus['questions']:
        if keep is not None and q['qid'] not in keep:
            continue
        sc = scenes[q['sceneId']]
        src = Image.open(os.path.join(a.renders, f"{sc['sceneId']}.png"))
        ppm = sc['style']['pxPerM'] if 'style' in sc else sc.get('pxPerM', 30)
        paper = sc['style']['paper'] if 'style' in sc else 255
        box = crop_box(q, sc['size'], ppm)
        kk = SIDE / (box[2] - box[0])
        tp = target_points(q)
        tb512 = [round((min(p[0] for p in tp) - round(box[0])) * kk, 1), round((min(p[1] for p in tp) - round(box[1])) * kk, 1),
                 round((max(p[0] for p in tp) - round(box[0])) * kk, 1), round((max(p[1] for p in tp) - round(box[1])) * kk, 1)]
        for mode in modes:
            if mode == 'RAW' and (q['targetKind'] not in RAW_ALLOWED or q.get('wholeImage')):
                continue
            if keep is not None and mode not in keep[q['qid']]:
                continue
            img = compose_one(src, q, box, mode, bands.get(f"{sc['sceneId']}.png", {}).get('bands', []), paper)
            name = f"{q['qid']}__{mode}.png"
            path = os.path.join(a.out, 'img', name)
            img.save(path)
            with open(path, 'rb') as fh:
                sha = hashlib.sha256(fh.read()).hexdigest()
            items.append({'qid': q['qid'], 'mode': mode, 'image': name, 'imageSha256': sha, 'prompt': prompt_for(q, mode), 'enum': q['enum'], 'expected': q['expected'], 'cls': q['cls'],
                          'family': q.get('family'), 'pair': q.get('pair'), 'variant': q.get('variant'), 'transform': q.get('transform'), 'baseQid': q.get('baseQid'), 'pairQid': q.get('pairQid'),
                          'set': q.get('set', 'SYNTHETIC'), 'house': q.get('house'), 'cropBoxPx': [round(v, 1) for v in box], 'targetBox512': tb512})
    with open(os.path.join(a.out, 'items.jsonl'), 'w') as fh:
        for it in items:
            fh.write(json.dumps(it) + '\n')
    print(json.dumps({'items': len(items), 'byMode': {m: sum(1 for i in items if i['mode'] == m) for m in MODES}}))


if __name__ == '__main__':
    main()
