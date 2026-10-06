#!/usr/bin/env python3
"""realq.py - the REAL development part of the Visual Referee question corpus (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B realq.py --work /home/user/work005j --repo /home/user/BuildApp

Questions come from two sources, both development evidence (no blind family is read):
  * the 005I bake-off's manual truth for seven development plans (research/analyzer-005i-boundary-bakeoff/truth/real):
    bodies, exclusions (terrace, pergola, porch, recess, paving, planting) and exterior openings, in frame pixels;
  * the accepted 005I diagnosis of the two blind-8 houses (now development evidence), as localized questions whose
    coordinates were read from the drawing and whose expected answers are the source-supported diagnosis (005I report
    section P), never the published area.

Frames are publisher pixels and stay outside the repository (`$WORK/real/renders`). The question record keeps only
coordinates, hashes, questions and answers. Transforms (MIRROR, ROT90, ROT180) are applied to the frame and to every
target the same way, so consistency can be measured on real drawings too (a mirrored real sheet also mirrors its text).
"""
import argparse
import glob
import hashlib
import json
import os

from PIL import Image
from shapely.geometry import Polygon, box, Point, LineString
from shapely.ops import unary_union

ENUMS = {
    'BODY_REGION': ['YES', 'NO', 'UNRESOLVED'],
    'WALL_CONTINUATION': ['CONTINUES', 'TERMINATES', 'NOT_SAME_WALL', 'UNRESOLVED'],
    'GARAGE_BODY': ['YES', 'NO', 'UNRESOLVED'],
    'TERRACE_VS_BODY': ['ENCLOSED', 'EXTERNAL', 'UNRESOLVED'],
    'CANOPY_PERGOLA_VS_WALL': ['WALL', 'NOT_WALL', 'UNRESOLVED'],
    'OUTER_BOUNDARY_A_OR_B': ['A', 'B', 'NEITHER', 'UNRESOLVED'],
    'OPENING_VS_PATTERN': ['OPENING', 'PATTERN', 'UNRESOLVED'],
    'OPEN_SIDE_VS_OPENINGS': ['ONE_OPEN_SIDE', 'SEVERAL_OPENINGS', 'UNRESOLVED'],
    'BAY_OR_RISALIT': ['YES', 'NO', 'UNRESOLVED'],
}
KIND = {'BODY_REGION': 'REGION', 'WALL_CONTINUATION': 'AB_SEGMENTS', 'GARAGE_BODY': 'REGION', 'TERRACE_VS_BODY': 'REGION', 'CANOPY_PERGOLA_VS_WALL': 'SEGMENT',
        'OUTER_BOUNDARY_A_OR_B': 'AB_REGIONS', 'OPENING_VS_PATTERN': 'SEGMENT', 'OPEN_SIDE_VS_OPENINGS': 'SEGMENT', 'BAY_OR_RISALIT': 'REGION'}
TRANSFORMS = ['NORMAL', 'MIRROR', 'ROT90', 'ROT180']


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def coords(poly):
    return [(round(x, 1), round(y, 1)) for x, y in list(poly.exterior.coords)[:-1]]


# ----------------------------------------------------------------------------------------------------------------------
# Blind-8 houses: localized questions from the accepted 005I diagnosis (section P), coordinates read from the frame.
BLIND8 = {
    'dom-w-gozdzikowcach': {
        'mpp': 0.02527,
        'diagnosis': '005I section P #1: BODY_RELATION - the recessed entrance porch mouth and the garage door were read as one 7.76 m OPEN_SIDE; the hall and stair column behind the porch, closed by an inner front wall with the 105/210 entrance door, became a 71 m2 pocket left out of the bodies',
        'questions': [
            {'cls': 'BODY_REGION', 'target': rect(311, 268.5, 434, 550), 'answer': 'YES', 'fact': 'hall and stair column behind the porch (analyzer completion-0, decision QUESTION)'},
            {'cls': 'OPEN_SIDE_VS_OPENINGS', 'target': [(284, 588), (590, 588)], 'answer': 'SEVERAL_OPENINGS', 'fact': 'the analyzer opening-1 stretch (OPEN_SIDE, 7.76 m): porch mouth + pier + garage door'},
            {'cls': 'WALL_CONTINUATION', 'target': {'A': [(436, 583), (465, 583)], 'B': [(590, 583), (620, 583)]}, 'answer': 'CONTINUES', 'fact': 'garage door 325/225 in the continuing garage front'},
            {'cls': 'WALL_CONTINUATION', 'target': {'A': [(285, 588), (312, 588)], 'B': [(417, 588), (436, 588)]}, 'answer': 'TERMINATES', 'fact': 'recessed porch mouth: the enclosure steps back to the vestibule wall'},
            {'cls': 'TERRACE_VS_BODY', 'target': rect(312, 557, 417, 598), 'answer': 'EXTERNAL', 'fact': 'the recessed entrance porch itself'},
            {'cls': 'GARAGE_BODY', 'target': rect(452, 420, 640, 583), 'answer': 'YES', 'fact': 'garage 8 inside the right wing'},
            {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {
                'A': 'SELECTED',  # the analyzer's selected masses (U shape with the pocket)
                'B': 'SELECTED+HALL'}, 'answer': 'B', 'fact': 'selected U-shape vs U-shape with the hall column closed to the vestibule wall'},
        ],
        'selected': [rect(96, 221, 311, 598), rect(434, 221, 639, 598), rect(311, 221, 434, 268.5)],
        'hall': rect(311, 268.5, 434, 557),
    },
    'dom-w-cyklamenach': {
        'mpp': 0.02028,
        'diagnosis': '005I section P #2: BOUNDARY - the living-room window gap was read as a pattern (DASHED) against the textured terrace, its double door LEAF_FACE, and the 40 m2 living-room block completion REJECTED NO_CONTINUATION although its outer sides are 75 % wall',
        'questions': [
            {'cls': 'BODY_REGION', 'target': rect(131, 195.5, 406.5, 576), 'answer': 'YES', 'fact': 'living-room block (analyzer completion-0, REJECTED NO_CONTINUATION)'},
            {'cls': 'OPENING_VS_PATTERN', 'target': [(165, 206), (255, 206)], 'answer': 'OPENING', 'fact': 'window 180/160 beside the textured terrace (analyzer: DASHED)'},
            {'cls': 'OPENING_VS_PATTERN', 'target': [(310, 206), (397, 206)], 'answer': 'OPENING', 'fact': 'double door 180/230 (analyzer: LEAF_FACE, weak)'},
            {'cls': 'WALL_CONTINUATION', 'target': {'A': [(140, 206), (165, 206)], 'B': [(255, 206), (285, 206)]}, 'answer': 'CONTINUES', 'fact': 'north wall across the window'},
            {'cls': 'WALL_CONTINUATION', 'target': {'A': [(285, 206), (310, 206)], 'B': [(397, 206), (425, 206)]}, 'answer': 'CONTINUES', 'fact': 'north wall across the double door'},
            {'cls': 'TERRACE_VS_BODY', 'target': rect(140, 130, 560, 190), 'answer': 'EXTERNAL', 'fact': 'textured terrace north of the house'},
            {'cls': 'TERRACE_VS_BODY', 'target': rect(131, 195.5, 406.5, 576), 'answer': 'ENCLOSED', 'fact': 'living room'},
            {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {'A': 'FULL', 'B': 'SELECTED'}, 'answer': 'A', 'fact': 'full rectangle vs the selected L-shape without the living block'},
        ],
        'selected': [rect(406.5, 195.5, 580, 694), rect(131, 576, 406.5, 694)],
        'full': rect(131, 195.5, 580, 694),
    },
}


def blind8_questions():
    out = []
    for house, spec in BLIND8.items():
        sel = unary_union([Polygon(r) for r in spec['selected']])
        for i, q in enumerate(spec['questions']):
            q = dict(q)
            if q['cls'] == 'OUTER_BOUNDARY_A_OR_B':
                named = {'SELECTED': coords(sel)}
                if 'hall' in spec:
                    named['SELECTED+HALL'] = coords(unary_union([sel, Polygon(spec['hall'])]))
                if 'full' in spec:
                    named['FULL'] = spec['full']
                t = {k: named[v] for k, v in q['target'].items()}
                out.append(dict(q, target=t, house=house, src='BLIND8_DIAGNOSIS', diagnosis=spec['diagnosis']))
                swapped = {'A': t['B'], 'B': t['A']}
                out.append(dict(q, target=swapped, answer={'A': 'B', 'B': 'A'}[q['answer']], fact=q['fact'] + ' (letters swapped)', house=house, src='BLIND8_DIAGNOSIS', diagnosis=spec['diagnosis']))
            else:
                out.append(dict(q, house=house, src='BLIND8_DIAGNOSIS', diagnosis=spec['diagnosis']))
    return out


# ----------------------------------------------------------------------------------------------------------------------
# 005I manual truth houses
def truth_questions(truth, selected_masses, mpp):
    house = truth['house']
    ext = Polygon(truth['exterior']).buffer(0)
    out = []
    ppm = 1.0 / mpp
    seg_len = 0.8 * ppm

    def add(cls, target, answer, fact):
        out.append({'cls': cls, 'target': target, 'answer': answer, 'fact': fact, 'house': house, 'src': 'TRUTH_005I'})

    for b in truth['bodies']:
        poly = Polygon(b['polygon']).buffer(0)
        if b['kind'] == 'MAIN':
            x0, y0, x1, y1 = poly.bounds
            xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
            for qx0, qy0, qx1, qy1 in ((x0, y0, xm, ym), (xm, y0, x1, ym), (x0, ym, xm, y1), (xm, ym, x1, y1)):
                q = box(qx0, qy0, qx1, qy1)
                inter = q.intersection(poly)
                if inter.area >= 0.85 * q.area and inter.geom_type == 'Polygon':
                    add('BODY_REGION', coords(box(*inter.bounds)), 'YES', 'quadrant of the main body')
                    add('TERRACE_VS_BODY', coords(box(*inter.bounds)), 'ENCLOSED', 'quadrant of the main body')
        elif b['kind'] == 'GARAGE':
            add('GARAGE_BODY', coords(poly), 'YES', 'attached garage body')
            add('BODY_REGION', coords(poly), 'YES', 'garage body')
        elif b['kind'] in ('BAY',):
            add('BAY_OR_RISALIT', coords(poly), 'YES', 'walled bay')
        elif b['kind'] in ('WING',):
            add('BODY_REGION', coords(poly), 'YES', 'wing body')
    for e in truth.get('exclusions', []):
        poly = Polygon(e['polygon']).buffer(0).difference(ext)
        if poly.is_empty:
            continue
        if poly.geom_type != 'Polygon':
            poly = max(poly.geoms, key=lambda g: g.area)
        if poly.area < (1.5 * ppm) ** 2:
            continue
        rb = box(*poly.bounds)
        add('BODY_REGION', coords(rb), 'NO', f"exclusion {e['kind']}: {e.get('note', '')}")
        if e['kind'] in ('TERRACE', 'PORCH', 'PAVING', 'PERGOLA'):
            add('TERRACE_VS_BODY', coords(rb), 'EXTERNAL', f"exclusion {e['kind']}")
        if e['kind'] == 'PERGOLA':
            # the pergola's far edge, away from the house: roof/support geometry, not a wall
            edges = list(zip(list(rb.exterior.coords)[:-1], list(rb.exterior.coords)[1:]))
            far = max(edges, key=lambda ab: LineString(ab).centroid.distance(ext))
            mid = LineString(far).interpolate(0.5, normalized=True)
            (ax, ay), (bx, by) = far
            L = LineString(far).length
            ux, uy = (bx - ax) / L, (by - ay) / L
            add('CANOPY_PERGOLA_VS_WALL', [(mid.x - ux * seg_len, mid.y - uy * seg_len), (mid.x + ux * seg_len, mid.y + uy * seg_len)], 'NOT_WALL', 'pergola outer edge')
        if e['kind'] == 'RECESS':
            edges = list(zip(list(Polygon(e['polygon']).exterior.coords)[:-1], list(Polygon(e['polygon']).exterior.coords)[1:]))
            mouth = max(edges, key=lambda ab: LineString(ab).centroid.distance(ext.boundary))
            (ax, ay), (bx, by) = mouth
            L = LineString(mouth).length
            ux, uy = (bx - ax) / L, (by - ay) / L
            A = [(ax - ux * seg_len, ay - uy * seg_len), (ax, ay)]
            B = [(bx, by), (bx + ux * seg_len, by + uy * seg_len)]
            add('WALL_CONTINUATION', {'A': A, 'B': B}, 'TERMINATES', f"recess mouth: {e.get('note', '')}")
    # exterior openings: a real opening, and the exterior wall continues across it
    for o in truth.get('openings', []):
        (ax, ay), (bx, by) = o['a'], o['b']
        L = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        if L < 4:
            continue
        ux, uy = (bx - ax) / L, (by - ay) / L
        add('OPENING_VS_PATTERN', [(ax, ay), (bx, by)], 'OPENING', f"{o['kind']} {o.get('note', '')}")
        A = [(ax - ux * seg_len, ay - uy * seg_len), (ax, ay)]
        B = [(bx, by), (bx + ux * seg_len, by + uy * seg_len)]
        add('WALL_CONTINUATION', {'A': A, 'B': B}, 'CONTINUES', f"{o['kind']} {o.get('note', '')}")
    # solid exterior wall stretches: the middle of each exterior edge clear of openings
    open_lines = [LineString([o['a'], o['b']]).buffer(4) for o in truth.get('openings', [])]
    walls_added = 0
    for a, b in zip(list(ext.exterior.coords)[:-1], list(ext.exterior.coords)[1:]):
        L = LineString([a, b]).length
        if L < 3 * seg_len or walls_added >= 3:
            continue
        for t in (0.25, 0.5, 0.75):
            p = LineString([a, b]).interpolate(t, normalized=True)
            ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
            s = LineString([(p.x - ux * seg_len, p.y - uy * seg_len), (p.x + ux * seg_len, p.y + uy * seg_len)])
            if not any(s.intersects(ol) for ol in open_lines):
                add('CANOPY_PERGOLA_VS_WALL', list(s.coords), 'WALL', 'solid exterior wall stretch')
                walls_added += 1
                break
    # outline candidates: truth exterior vs exterior + the largest terrace; vs the analyzer's own selection when it differs
    terr = [Polygon(e['polygon']).buffer(0) for e in truth.get('exclusions', []) if e['kind'] in ('TERRACE', 'PORCH')]
    if terr:
        big = max(terr, key=lambda p: p.area)
        wrong = unary_union([ext, big])
        if wrong.geom_type == 'Polygon':
            add('OUTER_BOUNDARY_A_OR_B', {'A': coords(ext), 'B': coords(wrong)}, 'A', 'exterior vs exterior + terrace')
            add('OUTER_BOUNDARY_A_OR_B', {'A': coords(wrong), 'B': coords(ext)}, 'B', 'exterior vs exterior + terrace (letters swapped)')
    if selected_masses:
        sel = unary_union([Polygon(r) for r in selected_masses]).buffer(0)
        if sel.geom_type == 'Polygon':
            iou = sel.intersection(ext).area / sel.union(ext).area
            if iou < 0.92:
                add('OUTER_BOUNDARY_A_OR_B', {'A': coords(ext), 'B': coords(sel)}, 'A', f'exterior vs the analyzer selection (IoU {iou:.2f})')
                add('OUTER_BOUNDARY_A_OR_B', {'A': coords(sel), 'B': coords(ext)}, 'B', f'exterior vs the analyzer selection (letters swapped, IoU {iou:.2f})')
    return out


def tf_point(p, name, W, H):
    x, y = p
    if name == 'MIRROR':
        return (W - x, y)
    if name == 'ROT90':      # PIL rotate(-90) expand: clockwise
        return (H - y, x)
    if name == 'ROT180':
        return (W - x, H - y)
    return (x, y)


def tf_image(im, name):
    if name == 'MIRROR':
        return im.transpose(Image.FLIP_LEFT_RIGHT)
    if name == 'ROT90':
        return im.transpose(Image.ROTATE_270)
    if name == 'ROT180':
        return im.transpose(Image.ROTATE_180)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', default='/home/user/work005j')
    ap.add_argument('--repo', default='/home/user/BuildApp')
    ap.add_argument('--transforms', default='NORMAL,MIRROR,ROT90,ROT180')
    a = ap.parse_args()
    out_dir = os.path.join(a.work, 'real')
    os.makedirs(os.path.join(out_dir, 'renders'), exist_ok=True)
    tfs = a.transforms.split(',')
    truth_dir = os.path.join(a.repo, 'research/analyzer-005i-boundary-bakeoff/truth/real')
    sources = {}
    raw_qs = []
    for f in sorted(glob.glob(os.path.join(truth_dir, '*.json'))):
        t = json.load(open(f))
        h = t['house']
        meta = json.load(open(f'/home/user/work005i/frames/real/{h}.meta.json'))
        frame = f'/home/user/work005i/frames/real/{h}.rgb.png'
        im = Image.open(frame).convert('RGBA')
        rgba_sha = hashlib.sha256(im.tobytes()).hexdigest()
        assert rgba_sha == meta['decoded']['rgbaSha256'], f'{h}: decoded RGBA differs from the 005I record'
        sel = None
        for run in (f'/home/user/work005h/m-on/{h}', f'/home/user/work005h/blind7/{h}'):
            p = os.path.join(run, 'evidence-pack', '14-selected-layout.json')
            if os.path.exists(p):
                d = json.load(open(p))
                if d.get('frameId') == t['frameId']:
                    sel = [rect(m['rect']['x0'], m['rect']['y0'], m['rect']['x1'], m['rect']['y1']) for m in d.get('masses', [])]
                    break
        sources[h] = {'frame': frame, 'frameId': t['frameId'], 'byteSha256': meta['variant']['byteSha256'], 'rgbaSha256': rgba_sha, 'mpp': t['metresPerPx'], 'truth': os.path.relpath(f, a.repo),
                      'bands': ('005I_OBS', f'/home/user/work005i/obs/source-cv/real/{h}.json')}
        raw_qs += truth_questions(t, sel, t['metresPerPx'])
    facts = {x['house']: x for x in json.load(open(os.path.join(a.work, 'frames', 'frames-005j.json')))}
    for h, spec in BLIND8.items():
        frame = os.path.join(a.work, 'frames', f'{h}.rgb.png')
        im = Image.open(frame).convert('RGBA')
        rgba_sha = hashlib.sha256(im.tobytes()).hexdigest()
        assert rgba_sha == facts[h]['decoded']['rgbaSha256']
        run = f'/home/user/work005i-a/blind8/{"h1" if "gozdz" in h else "h2"}-{h}'
        sources[h] = {'frame': frame, 'frameId': facts[h]['frameId'], 'byteSha256': facts[h]['byteSha256'], 'rgbaSha256': rgba_sha, 'mpp': spec['mpp'],
                      'bands': ('EVIDENCE_PACK', os.path.join(run, 'evidence-pack', '04-wall-bands.json'))}
    raw_qs += blind8_questions()

    # wall bands per house, as the analyzer derived them (for SEMANTIC_OVERLAY)
    def bands_of(h):
        kind, path = sources[h]['bands']
        d = json.load(open(path))
        if kind == 'EVIDENCE_PACK':
            return [{'bounds': b['bounds']} for b in d['bands'] if b.get('decision') == 'ACCEPTED']
        res = []
        for o in d['observations']:
            if o.get('configId') == 'SCV-WALL':
                (ax, ay), (bx, by) = o['geometry']['a'], o['geometry']['b']
                th = o['geometry'].get('thicknessPx', 6) / 2
                res.append({'bounds': {'x0': min(ax, bx) - (th if ax == bx else 0), 'x1': max(ax, bx) + (th if ax == bx else 0), 'y0': min(ay, by) - (th if ay == by else 0), 'y1': max(ay, by) + (th if ay == by else 0)}})
        return res

    scenes, questions, bands_out = [], [], {}
    counter = {}
    for h, src in sources.items():
        im = Image.open(src['frame']).convert('RGB')
        W, H = im.size
        hb = bands_of(h)
        for tf in tfs:
            sid = f'real-{h}-{tf}'
            out_png = os.path.join(out_dir, 'renders', f'{sid}.png')
            img = tf_image(im, tf)
            img.save(out_png)
            T = lambda p: tf_point(p, tf, W, H)
            def tb(b):
                pts = [T((b['x0'], b['y0'])), T((b['x1'], b['y1']))]
                return {'bounds': {'x0': min(p[0] for p in pts), 'x1': max(p[0] for p in pts), 'y0': min(p[1] for p in pts), 'y1': max(p[1] for p in pts)}}
            bands_out[f'{sid}.png'] = {'bands': [tb(b['bounds']) for b in hb]}
            scenes.append({'sceneId': sid, 'house': h, 'transform': tf, 'size': list(img.size), 'pxPerM': 1.0 / src['mpp'], 'style': {'pxPerM': 1.0 / src['mpp'], 'paper': 255},
                           'frameId': src['frameId'], 'byteSha256': src['byteSha256'], 'rgbaSha256': src['rgbaSha256']})
            for q in [q for q in raw_qs if q['house'] == h]:
                key = (h, q['cls'])
                n = counter.setdefault((key, tf), 0)
                counter[(key, tf)] = n + 1
                base = f'real-{h}-{q["cls"]}-{n}'
                t = q['target']
                tpx = {k: [T(p) for p in v] for k, v in t.items()} if isinstance(t, dict) else [T(p) for p in t]
                questions.append({'qid': f'{base}-{tf}', 'baseQid': base, 'pairQid': None, 'sceneId': sid, 'set': 'REAL_BLIND8' if q['src'] == 'BLIND8_DIAGNOSIS' else 'REAL_DEV', 'house': h,
                                  'family': f'real:{h}', 'pair': None, 'variant': None, 'transform': tf, 'cls': q['cls'], 'enum': ENUMS[q['cls']], 'targetKind': KIND[q['cls']],
                                  'targetPx': tpx, 'targetFramePx': t, 'expected': q['answer'], 'fact': q['fact'], 'src': q['src'], 'diagnosis': q.get('diagnosis')})
    json.dump({'researchOnly': 'BUILDPLAN-ANALYZER-005J', 'sources': sources, 'scenes': scenes, 'questions': questions}, open(os.path.join(out_dir, 'corpus.json'), 'w'), indent=0)
    json.dump({'files': bands_out}, open(os.path.join(out_dir, 'bands.json'), 'w'))
    by = {}
    for q in questions:
        if q['transform'] == 'NORMAL':
            by.setdefault(q['set'], {}).setdefault(q['cls'], 0)
            by[q['set']][q['cls']] += 1
    print(json.dumps({'houses': len(sources), 'questionsPerTransform': sum(1 for q in questions if q['transform'] == 'NORMAL'), 'total': len(questions), 'bySet': by}, indent=1))


if __name__ == '__main__':
    main()
