"""IU-02: geometry features (projection + section cues) for every image of one or more folders, OFFLINE.
Writes $IU_WORK2/geo/<tag>.json: {sha-or-stem: {"f": [...], "rec": {...}}}. Resumable (skips what is there).

    python3 geo_features.py --tag <tag> --images <dir> [<dir> ...]
"""
import json, os, sys, time
from concurrent.futures import ProcessPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo, arg_value

WORK2 = os.environ.get('IU_WORK2', '/home/user/workiu02')


def one(path):
    from iu2 import features, pipeline
    try:
        rgb, meta = pipeline.load(path)
        f, rec = features.compute(rgb)
        return os.path.basename(path).split('.')[0], {'f': f, 'rec': rec, 'sha256': meta['sha256']}
    except Exception as e:  # recorded per image; a broken file must not silently vanish from the set
        return os.path.basename(path).split('.')[0], {'error': repr(e)}


def main():
    refuse_inside_repo(WORK2, 'geometry features')
    tag = arg_value('--tag')
    dirs = sys.argv[sys.argv.index('--images') + 1:]
    os.makedirs(os.path.join(WORK2, 'geo'), exist_ok=True)
    out = os.path.join(WORK2, 'geo', f'{tag}.json')
    done = json.load(open(out)) if os.path.exists(out) else {}
    files = [os.path.join(d, f) for d in dirs for f in sorted(os.listdir(d)) if f.split('.')[-1].lower() in ('jpg', 'jpeg', 'png', 'webp', 'gif') and f.count('.') == 1]
    todo = [f for f in files if os.path.basename(f).split('.')[0] not in done]
    t0 = time.time()
    with ProcessPoolExecutor(4) as ex:
        for k, (key, rec) in enumerate(ex.map(one, todo, chunksize=4)):
            done[key] = rec
            if k % 100 == 99:
                json.dump(done, open(out, 'w'))
                print(k + 1, 'of', len(todo), round(time.time() - t0, 1), 's', flush=True)
    json.dump(done, open(out, 'w'))
    print(tag, len(done), 'records', round(time.time() - t0, 1), 's')


if __name__ == '__main__':
    main()
