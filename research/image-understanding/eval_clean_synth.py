"""IU-02: segmentation, projection and clean-facade fidelity on synthetic elevations with exact truth (OFFLINE).

    $PY eval_clean_synth.py --synth <dir with manifest.json> --out <json outside the repo> [--limit N] [--segmenter UPERNET]

Per elevation: building IoU and boundary error, projection state, windows kept / missing / added / misclassified
(against the label map's WINDOW components; an opening more than 30 % hidden by a tree counts as occluded), and the
sub-pixel displacement of every visible architectural point between the source and the cleaned image.
"""
import json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo, arg_value
from iu.backbones import offline_guard
from iu2 import pipeline, fidelity, seg
from iu2.synth3d import LABELS

GLASSY = {'WINDOW'}


def gt_openings(labels, occ, p, cam):
    out = []
    for op in p['openings']:
        u0, u1 = cam['u0'] + op['x0'] * cam['s'], cam['u0'] + op['x1'] * cam['s']
        v0, v1 = cam['v0'] - op['y1'] * cam['s'], cam['v0'] - op['y0'] * cam['s']
        box = (int(round(u0)), int(round(v0)), int(round(u1)), int(round(v1)))
        region = occ[box[1]:box[3], box[0]:box[2]]
        out.append((box, op['kind'], bool(region.size and region.mean() > 0.3)))
    return out


def main():
    synth = arg_value('--synth'); out = arg_value('--out'); refuse_inside_repo(out, 'evaluation output')
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    limit = int(arg_value('--limit', '100000')); segmenter = arg_value('--segmenter', 'UPERNET')
    weights = os.environ.get('IU_WEIGHTS', '/home/user/workiu01/weights') + '/iu02'
    offline_guard()
    man = json.load(open(os.path.join(synth, 'manifest.json')))['rows']
    rows = [r for r in man if r['label'] == 'ORTHOGRAPHIC_ELEVATION'][:limit]
    B = [LABELS[k] for k in ('WALL', 'ROOF', 'CHIMNEY', 'WINDOW', 'DOOR', 'GATE', 'BALCONY')]
    res = []
    for r in rows:
        rgb, meta = pipeline.load(os.path.join(synth, r['file']))
        labels = np.asarray(Image.open(os.path.join(synth, r['id'] + '.labels.png')))
        occ = labels == LABELS['OCCLUDER']
        o = pipeline.run(rgb, meta, weights, segmenter)
        a = o['arrays']
        sc = seg.scores(o['seg'], np.isin(labels, B), occ)
        gt = gt_openings(labels, occ, r['house'], r['camera'])
        det = [(b, 'GLASS') for b in fidelity.components(a['glass'])] + [(b, 'DOOR') for b in fidelity.components(a['door'])]
        win = fidelity.match_openings(gt, det)
        pts = [(q['u'], q['v']) for q in r['points'] if not q['occluded']]
        ps = fidelity.point_shift(rgb, a['clean'], pts)
        bw = max(1.0, float(np.ptp([q['u'] for q in r['points']])))
        res.append({'id': r['id'], 'style': r['style'], 'segmenter': o['segmenter'], 'projection': o['projection']['state'],
                    'distortion95': max(o['projection'].get('horizontals', {}).get('distortionPx95', 99), o['projection'].get('verticals', {}).get('distortionPx95', 99)),
                    'seg': sc, 'windows': win, 'points': {k: v for k, v in ps.items() if k != 'shifts'},
                    'pointsShareOfWidthP95': round(ps.get('srcToCleanP95Px', 0) / bw, 5) if ps else None, 'timing': o['timing']})
        print(r['id'], res[-1]['projection'], sc.get('buildingIoU'), win, ps.get('srcToCleanMedianPx'), ps.get('srcToCleanP95Px'), flush=True)
    json.dump(res, open(out, 'w'), indent=1)


if __name__ == '__main__':
    main()
