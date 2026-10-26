"""IU-03A mandatory negatives, generated with exact truth (no publisher pixels). Each case is a deliberately hard
picture for one rule, written with its truth and the behaviour the brief requires of it:

  N1_WHITE_ON_WHITE       white plaster on a white sheet                  outline/ground may be unsure; no invented opening
  N2_TREE_BEFORE_WINDOW   a tree standing in front of a window            that window is never "independently detected"
  N3_TREE_REFLECTION      a tree mirrored in a glazing                    one opening, not split, not a wall
  N4_GARAGE_GATE          a garage gate down to the ground                found as a grounded gate/door, not as glass
  N5_DARK_ON_DARK         dark roof over a dark facade                    eaves/ridge still found; openings not lost
  N6_BALCONY_RAIL         a balcony with a (glass or bar) balustrade      the rail is not counted as a window
  N7_NEAR_FRONTAL         a near-frontal perspective, captioned elevation must not reach the orthographic extractor
  N8_SECTION_PLUS_ELEV    one sheet with a section and an elevation       must not reach the extractor as one facade
  N9_GROUND_MISSING       sheet cut above the ground / base hidden by a hedge    ground not OBSERVED -> the adapter adds nothing

    $PY iu3/negatives.py --out <dir outside the repo> [--seed 3301]
"""
import json, os, random, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
from iu2 import synth3d as S


def params(rnd, **over):
    for _ in range(500):
        p = S.house_params(rnd)
        if over.get('need_gate') and not any(o['kind'] == 'GATE' for o in p['openings']):
            continue
        if over.get('need_balcony') and not p['balcony']:
            continue
        for k, v in over.items():
            if k in p:
                p[k] = v
        if over.get('balcony_glass') is not None and p['balcony']:
            p['balcony']['glassRail'] = over['balcony_glass']
        return p
    raise RuntimeError('no house satisfies the case')


def window_boxes(p, cam):
    out = []
    for o in p['openings']:
        u0, u1 = cam.u0 + o['x0'] * cam.s, cam.u0 + o['x1'] * cam.s
        v0, v1 = cam.v0 - o['y1'] * cam.s, cam.v0 - o['y0'] * cam.s
        out.append({'kind': o['kind'], 'rect': [int(round(u0)), int(round(v0)), int(round(u1)), int(round(v1))]})
    return out


def foliage(rnd, h, w):
    t = S._noise(rnd, h, w, 6)
    g = np.stack([40 + 50 * t, 90 + 80 * t, 35 + 40 * t], -1)
    return g


def main():
    out = arg_value('--out'); refuse_inside_repo(out, 'IU-03A negatives'); os.makedirs(out, exist_ok=True)
    seed = int(arg_value('--seed', '3301'))
    rows = []

    def save(case, k, im, truth, expect, labels=None):
        name = f'neg-{case.lower()}-{k}'
        im.save(os.path.join(out, name + '.png'))
        if labels is not None:
            Image.fromarray(labels.astype(np.uint8)).save(os.path.join(out, name + '.labels.png'))
        rows.append({'id': name, 'file': name + '.png', 'case': case, 'label': truth, 'expect': expect, **extra})

    for k in range(2):
        rnd = random.Random(seed + k)
        extra = {}
        # N1 white plaster on a white sheet
        p = params(rnd, wallColor=(248, 248, 248)); im, lab, occ, cam, pts = S.render_elevation(p, rnd, 'FLAT')
        extra = {'openings': window_boxes(p, cam)}
        save('N1_WHITE_ON_WHITE', k, im, 'ORTHOGRAPHIC_ELEVATION', 'NO_INVENTED_OPENING', lab)
        # N2 a tree in front of a window
        p = params(rnd); im, lab, occ, cam, pts = S.render_elevation(p, rnd, 'FLAT')
        rgb = np.array(im).astype(np.float32); boxes = window_boxes(p, cam)
        win = [b for b in boxes if b['kind'] == 'WINDOW'][0]
        x0, y0, x1, y1 = win['rect']; cx = (x0 + x1) / 2
        lab = lab.copy()
        occm = S._trees(rnd, rgb, lab, y1 + (y1 - y0) * 0.2, (cx, cx), (y1 - y0) * 2.6, 1)
        extra = {'openings': boxes, 'occludedWindow': win['rect']}
        save('N2_TREE_BEFORE_WINDOW', k, Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)), 'ORTHOGRAPHIC_ELEVATION', 'OCCLUDED_WINDOW_NOT_DETECTED', lab)
        # N3 a tree reflected in a glazing (the window stays a window in the truth)
        p = params(rnd); im, lab, occ, cam, pts = S.render_elevation(p, rnd, 'FLAT')
        rgb = np.array(im).astype(np.float32); boxes = window_boxes(p, cam)
        win = max([b for b in boxes if b['kind'] == 'WINDOW'], key=lambda b: (b['rect'][2] - b['rect'][0]) * (b['rect'][3] - b['rect'][1]))
        x0, y0, x1, y1 = win['rect']; f = foliage(rnd, y1 - y0, x1 - x0)
        rgb[y0:y1, x0:x1] = 0.45 * rgb[y0:y1, x0:x1] + 0.55 * f
        extra = {'openings': boxes, 'reflectedWindow': win['rect']}
        save('N3_TREE_REFLECTION', k, Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)), 'ORTHOGRAPHIC_ELEVATION', 'ONE_OPENING_NOT_SPLIT', lab)
        # N4 a garage gate down to the ground
        p = params(rnd, need_gate=True); im, lab, occ, cam, pts = S.render_elevation(p, rnd, k and 'RENDER' or 'FLAT')
        extra = {'openings': window_boxes(p, cam)}
        save('N4_GARAGE_GATE', k, im.convert('RGB'), 'ORTHOGRAPHIC_ELEVATION', 'GATE_GROUNDED_NOT_GLASS', lab)
        # N5 dark roof over a dark facade
        p = params(rnd, wallColor=(62, 62, 66), roofColor=(42, 42, 46)); im, lab, occ, cam, pts = S.render_elevation(p, rnd, k and 'RENDER' or 'FLAT')
        import math
        eave_y = p['H'] - (p['overhang'] * math.tan(math.radians(p['pitchDeg'])) if p['ridgeAlongFront'] else 0.0)  # the roof's lowest edge
        extra = {'openings': window_boxes(p, cam), 'eaveRow': int(round(cam.v0 - eave_y * cam.s)), 'ridgeRow': int(round(cam.v0 - p['ridgeH'] * cam.s))}
        save('N5_DARK_ON_DARK', k, im.convert('RGB'), 'ORTHOGRAPHIC_ELEVATION', 'EAVES_AND_OPENINGS_KEPT', lab)
        # N6 a balcony with a balustrade
        p = params(rnd, need_balcony=True, balcony_glass=bool(k == 0)); im, lab, occ, cam, pts = S.render_elevation(p, rnd, 'FLAT')
        b = p['balcony']
        extra = {'openings': window_boxes(p, cam), 'railBand': [int(cam.u0 + b['x0'] * cam.s), int(cam.v0 - (b['y'] + b['rail']) * cam.s), int(cam.u0 + b['x1'] * cam.s), int(cam.v0 - b['y'] * cam.s)]}
        save('N6_BALCONY_RAIL', k, im, 'ORTHOGRAPHIC_ELEVATION', 'RAIL_NOT_A_WINDOW', lab)
        # N7 a near-frontal perspective (the caption will say elevation)
        p = params(rnd); im, lab, cam, meta = S.render_perspective(p, rnd, k and 'RENDER' or 'FLAT', 'NEAR_FRONTAL')
        extra = {'yawDeg': meta.get('yawDeg')}
        save('N7_NEAR_FRONTAL', k, im.convert('RGB'), 'EXTERIOR_PERSPECTIVE', 'NOT_ROUTED', lab)
        # N8 a section and an elevation on one sheet
        p = params(rnd)
        sec, _, _ = S.render_section(p, rnd, rnd.choice(['POCHE', 'HATCH']))
        el, _, _, _, _ = S.render_elevation(p, rnd, 'FLAT')
        sec.thumbnail((700, 700)); el.thumbnail((700, 700))
        sheet = Image.new('RGB', (sec.width + el.width + 60, max(sec.height, el.height) + 40), 'white')
        sheet.paste(sec.convert('RGB'), (20, 20)); sheet.paste(el.convert('RGB'), (sec.width + 40, 20))
        extra = {}
        save('N8_SECTION_PLUS_ELEV', k, sheet, 'OTHER', 'NOT_ROUTED_AS_ONE_FACADE')
        # N9 no ground line (line drawing with the terrain line erased) / base hidden by a hedge (render)
        p = params(rnd)
        if k == 0:
            im, lab, occ, cam, pts = S.render_elevation(p, rnd, 'FLAT')
            g = int(cam.v0 - 0.4 * cam.s)     # the sheet is cut through the walls: no ground in the picture at all
            im = im.crop((0, 0, im.width, g))
        else:
            im, lab, occ, cam, pts = S.render_elevation(p, rnd, 'RENDER')
            rgb = np.array(im.convert('RGB')).astype(np.float32); g = int(cam.v0)
            hh = int(0.9 * cam.s)
            f = foliage(rnd, hh, rgb.shape[1])
            rgb[g - hh:g] = f; im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
        extra = {'openings': window_boxes(p, cam), 'groundRow': int(cam.v0)}
        save('N9_GROUND_MISSING', k, im.convert('RGB'), 'ORTHOGRAPHIC_ELEVATION', 'GROUND_NOT_OBSERVED')
    json.dump({'seed': seed, 'rows': rows}, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    print(len(rows), 'negatives')


if __name__ == '__main__':
    main()
