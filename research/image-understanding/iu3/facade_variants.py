"""IU-03A part B driver: for every elevation of one house's SourcePackage, write (outside the repository)
  clean-facade.png      variant 2 (IU-02 clean.py, unchanged)
  anchored.png          variant 3 (clean + source-confirmed anchors drawn back as ink; iu3/evidence.anchored)
  evidence.json         FacadeGeometryEvidence
and three maps the extractor harness reads: <house>-clean.json, <house>-anchored.json ({assetId: png}) and
<house>-silhouettes.json ({assetId: polygon in original pixels | null}).

    $PY iu3/facade_variants.py --house <h> --assets <pkg-assets.json> --out <dir outside the repo>
"""
import json, os, sys, time
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
if __name__ == '__main__':
    refuse_inside_repo(arg_value('--out', ''), 'facade variants')  # before anything heavy is imported
from iu.backbones import offline_guard
from iu2 import pipeline
from iu3 import evidence as fge


def main():
    house, out = arg_value('--house'), arg_value('--out')
    refuse_inside_repo(out, 'facade variants'); offline_guard()
    weights = os.environ.get('IU_WEIGHTS', '/home/user/workiu01/weights') + '/iu02'
    assets = [a for a in json.load(open(arg_value('--assets'))) if a['house'] == house and a['roles']['document'] == 'ELEVATION']
    maps = {'clean': {}, 'anchored': {}, 'silhouettes': {}}
    for a in assets:
        d = os.path.join(out, house, a['assetId']); os.makedirs(d, exist_ok=True)
        rgb, meta = pipeline.load(a['cacheFile'])
        t0 = time.time()
        o = pipeline.run(rgb, meta, weights, 'UPERNET')
        ev = fge.evidence(rgb, o['seg'], o['projection'], o['arrays'], meta)
        ev['timingS'] = {**o['timing'], 'evidenceS': round(time.time() - t0 - sum(o['timing'].values()), 3)}
        anch = fge.anchored(o['arrays']['clean'], ev)
        Image.fromarray(o['arrays']['clean']).save(os.path.join(d, 'clean-facade.png'))
        Image.fromarray(anch).save(os.path.join(d, 'anchored.png'))
        json.dump(ev, open(os.path.join(d, 'evidence.json'), 'w'), indent=1)
        maps['clean'][a['assetId']] = os.path.join(d, 'clean-facade.png')
        maps['anchored'][a['assetId']] = os.path.join(d, 'anchored.png')
        maps['silhouettes'][a['assetId']] = fge.silhouette_polygon_for_solver(ev)
        it = ev['items']
        print(house, a['assetId'][-10:], o['projection']['state'], 'ground', it['groundLine']['state'], 'openings', it['counts'], 'chimneys', len(it['chimneys']), flush=True)
    for k, v in maps.items():
        json.dump(v, open(os.path.join(out, f'{house}-{k}.json'), 'w'))


if __name__ == '__main__':
    main()
