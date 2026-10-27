"""IU-03B dev collection: per image, the projection evidence on the full image, inside the classical mask (B) and,
where asked, inside the UperNet mask (D, reference only). Writes JSON lines outside the repository; resumable.

    $PY iu3b/collect.py --rows <rows.json> --out <jsonl> [--upernet] [--procs 4]
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
if __name__ == '__main__':
    refuse_inside_repo(arg_value('--out', ''), 'IU-03B collection')

KEEP = ('state', 'why', 'segments')


def fam(f):
    return {k: f.get(k) for k in ('n', 'enough', 'z', 'distortionPx', 'distortionPx95')} if f else None


def summary(p):
    return {**{k: p.get(k) for k in KEEP}, 'h': fam(p.get('horizontals')), 'v': fam(p.get('verticals')),
            'radial': (p.get('radial') or {}).get('support'), 'quadrants': (p.get('radial') or {}).get('quadrants'),
            'planes': p.get('planes'), 'nonParallel': p.get('nonParallel')}


def one(args):
    r, upernet = args
    import numpy as np
    from iu2 import pipeline, projection as PJ
    from iu3b import masks
    rgb, meta = pipeline.load(r['path'])
    t = time.time(); full = PJ.analyse(rgb); tf = time.time() - t
    t = time.time(); m, info = masks.classic(rgb); cm = PJ.analyse(rgb, mask=m); tc = time.time() - t
    out = {'key': r['key'], 'full': summary(full), 'classic': summary(cm), 'classicInfo': info, 'seconds': {'full': round(tf, 3), 'classic': round(tc, 3)}}
    if upernet:
        from iu2 import clean
        t = time.time(); s = pipeline.segment(rgb, '/home/user/workiu01/weights/iu02'); f, _ = clean.building_support(s)
        out['upernet'] = summary(PJ.analyse(rgb, mask=f if f.any() else None)); out['seconds']['upernet'] = round(time.time() - t, 3)
    return out


def main():
    from iu.backbones import offline_guard
    offline_guard()
    rows = json.load(open(arg_value('--rows')))
    out = arg_value('--out'); up = '--upernet' in sys.argv
    done = set()
    if os.path.exists(out):
        done = {json.loads(l)['key'] for l in open(out)}
    todo = [(r, up) for r in rows if r['key'] not in done]
    procs = int(arg_value('--procs', '1' if up else '4'))
    with open(out, 'a') as f:
        if procs > 1:
            from multiprocessing import Pool
            with Pool(procs) as pool:
                for k, res in enumerate(pool.imap_unordered(one, todo, chunksize=4)):
                    f.write(json.dumps(res) + '\n')
                    if k % 100 == 99: f.flush(); print(k + 1, 'of', len(todo), flush=True)
        else:
            for k, a in enumerate(todo):
                f.write(json.dumps(one(a)) + '\n'); f.flush()
                if k % 20 == 19: print(k + 1, 'of', len(todo), flush=True)


if __name__ == '__main__':
    main()
