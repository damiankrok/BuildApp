"""IU-01: build per-split synthetic derivatives (collages, simplified elevations) and TEST resolution copies.
Pixels go to $IU_WORK/derived (outside the repo); the manifest keeps hashes, labels and parent hashes only."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo
refuse_inside_repo(os.environ.get('IU_WORK', '/home/user/workiu01'), 'derived pixels')
from iu.corpus import load_archon
from iu.backbones import open_image
from iu import synth

WORK = os.environ.get('IU_WORK', '/home/user/workiu01')
IMG = os.environ.get('IU_ARCHON_IMAGES', '/home/user/work005r/corpus/images')
out_dir = os.path.join(WORK, 'derived'); os.makedirs(out_dir, exist_ok=True)
rows = load_archon(IMG)
manifest = []
for k, split in enumerate(['TRAIN', 'VAL', 'TEST']):
    part = [r for r in rows if r['split'] == split]
    for meta, im in synth.build(part, open_image, seed=1000 + k, n_collage={'TRAIN': 60, 'VAL': 24, 'TEST': 24}[split]):
        im.save(os.path.join(out_dir, meta['sha256'] + '.png'))
        manifest.append(meta)
# resolution copies of TEST images: same picture at 400 px and 1200 px on the long side
for r in rows:
    if r['split'] != 'TEST' or not r['path']:
        continue
    src = open_image(r['path'])
    for n in (400, 1200):
        im = synth.resize_long(src, n)
        h = synth._sha(im)
        im.save(os.path.join(out_dir, h + '.png'))
        manifest.append({'sha256': h, 'label': r['label'], 'derived': f'resize{n}', 'project': r['project'], 'split': 'TEST', 'parents': [r['sha256']]})
json.dump({'schema': 'iu01-derived-v1', 'rows': manifest}, open(os.path.join(WORK, 'derived-manifest.json'), 'w'), indent=0)
from collections import Counter
print(Counter((m['split'], m['derived']) for m in manifest))
