"""IU-01: embed every corpus image with each frozen backbone, OFFLINE (socket creation disabled).
Writes $IU_WORK/emb/<backbone>-<pad>.npz : sha256 list + embeddings. Pixels and embeddings stay outside the repo.

  python embed_corpus.py --images /home/user/work005r/corpus/images [--extra-dir DIR ...]
"""
import argparse, os, sys, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo, arg_value
refuse_inside_repo(arg_value('--work', os.environ.get('IU_WORK', '/home/user/workiu01')), 'embeddings')
from iu.backbones import offline_guard, load, embed, open_image
offline_guard()
import numpy as np, torch

ap = argparse.ArgumentParser()
ap.add_argument('--images', nargs='+', required=True, help='directories of <sha256>.<ext> files')
ap.add_argument('--work', default=os.environ.get('IU_WORK', '/home/user/workiu01'))
ap.add_argument('--backbones', default='mobilenetv3_large_100,dinov2_vits14,clip_vitb32')
ap.add_argument('--pads', default='white,gray')
ap.add_argument('--tag', default='corpus')
a = ap.parse_args()
torch.set_num_threads(4)
PADS = {'white': (255, 255, 255), 'gray': (128, 128, 128)}
files = []
for d in a.images:
    files += [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.split('.')[-1].lower() in ('jpg', 'jpeg', 'png', 'gif', 'webp')]
shas = [os.path.basename(f).split('.')[0] for f in files]
ims = [open_image(f) for f in files]
os.makedirs(os.path.join(a.work, 'emb'), exist_ok=True)
timing = {}
for bid in a.backbones.split(','):
    model, meta = load(bid)
    for pad in a.pads.split(','):
        t0 = time.time()
        e = embed(model, meta, ims, PADS[pad])
        dt = time.time() - t0
        timing[f'{bid}-{pad}'] = {'images': len(ims), 'seconds': round(dt, 2), 'msPerImageBatch16x4threads': round(1000 * dt / max(1, len(ims)), 1)}
        np.savez(os.path.join(a.work, 'emb', f'{a.tag}-{bid}-{pad}.npz'), sha=np.array(shas), emb=e)
        print(bid, pad, e.shape, timing[f'{bid}-{pad}'], flush=True)
json.dump(timing, open(os.path.join(a.work, 'emb', f'{a.tag}-timing.json'), 'w'), indent=1)
