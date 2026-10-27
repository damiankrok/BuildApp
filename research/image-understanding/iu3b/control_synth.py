"""IU-03B control set, synthetic part: per house the three elevation styles and a near-frontal perspective in EACH of
the three styles (IU-02's generator draws one near-frontal per house in a random style), plus one corner view as a
sanity anchor. Same painter, same truth files as iu2/synth3d.py; only the mix differs, so near-frontal views are not
a 1-in-7 minority.

    $PY iu3b/control_synth.py --out <dir outside the repo> --prefix s3b --houses 30 --seed <from the freeze>
"""
import json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
if __name__ == '__main__':
    refuse_inside_repo(arg_value('--out', ''), 'IU-03B control images')  # before anything heavy is imported
import numpy as np
from PIL import Image
from iu2 import synth3d as S


def generate(out_dir, prefix, seed, n_houses):
    os.makedirs(out_dir, exist_ok=True)
    rnd = random.Random(seed)
    rows = []

    def save(name, im, row, labels, occ=None, jpeg=False):
        path = os.path.join(out_dir, name + ('.jpg' if jpeg else '.png'))
        im.save(path, **({'quality': rnd.randint(78, 92)} if jpeg else {}))
        Image.fromarray(labels.astype(np.uint8)).save(os.path.join(out_dir, name + '.labels.png'))
        if occ is not None:
            Image.fromarray((occ * 255).astype(np.uint8)).save(os.path.join(out_dir, name + '.occ.png'))
        rows.append({'file': os.path.basename(path), 'id': name, 'house': f'{prefix}-h{hk:03d}', **row})

    for hk in range(n_houses):
        p = S.house_params(rnd)
        for style in ('FLAT', 'RENDER', 'LINE'):
            width = rnd.choice([1200, 1200, 1200, 800, 1600])
            im, labels, occ, cam, pts = S.render_elevation(p, rnd, style, width)
            save(f'{prefix}-h{hk:03d}-elev-{style.lower()}', im, {'label': 'ORTHOGRAPHIC_ELEVATION', 'projection': 'ORTHOGRAPHIC', 'style': style,
                 'camera': cam.to_json()}, labels, occ, jpeg=style == 'RENDER')
        for style in ('FLAT', 'RENDER', 'LINE'):
            im, labels, cam, meta = S.render_perspective(p, rnd, style, 'NEAR_FRONTAL')
            save(f'{prefix}-h{hk:03d}-persp-near_frontal-{style.lower()}', im, {'label': 'EXTERIOR_PERSPECTIVE', 'projection': 'PERSPECTIVE', 'style': style,
                 'perspectiveKind': 'NEAR_FRONTAL', 'camera': cam.to_json(), **meta}, labels, jpeg=style == 'RENDER')
        style = rnd.choice(['FLAT', 'RENDER', 'LINE'])
        im, labels, cam, meta = S.render_perspective(p, rnd, style, 'CORNER')
        save(f'{prefix}-h{hk:03d}-persp-corner-{style.lower()}', im, {'label': 'EXTERIOR_PERSPECTIVE', 'projection': 'PERSPECTIVE', 'style': style,
             'perspectiveKind': 'CORNER', 'camera': cam.to_json(), **meta}, labels, jpeg=style == 'RENDER')
    with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
        json.dump({'prefix': prefix, 'seed': seed, 'houses': n_houses, 'labels': S.LABELS, 'rows': rows}, f, indent=0)
    return rows


if __name__ == '__main__':
    out = arg_value('--out'); refuse_inside_repo(out, 'IU-03B control images')
    rows = generate(out, arg_value('--prefix', 's3b'), int(arg_value('--seed')), int(arg_value('--houses', '30')))
    from collections import Counter
    print(len(rows), Counter((r['label'], r.get('perspectiveKind')) for r in rows))
