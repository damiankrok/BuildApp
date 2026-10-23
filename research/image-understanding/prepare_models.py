"""IU-01 one-time ONLINE preparation: download the pretrained weights into $IU_WEIGHTS (outside the repository) and
record their sha256. This is the ONLY step that touches the network; every later step runs under offline_guard().

  IU_WEIGHTS=/home/user/workiu01/weights python prepare_models.py
"""
import hashlib, json, os
from huggingface_hub import hf_hub_download

W = os.environ.get('IU_WEIGHTS', '/home/user/workiu01/weights')
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo
refuse_inside_repo(W, 'weights')
FILES = [
    ('timm/mobilenetv3_large_100.ra_in1k', 'model.safetensors', 'mobilenetv3_large_100.ra_in1k'),
    ('timm/vit_small_patch14_dinov2.lvd142m', 'model.safetensors', 'vit_small_patch14_dinov2.lvd142m'),
    ('laion/CLIP-ViT-B-32-laion2B-s34B-b79K', 'open_clip_model.safetensors', 'ViT-B-32-laion2b_s34b_b79k'),
]
out = []
for repo, fn, local in FILES:
    d = os.path.join(W, local)
    os.makedirs(d, exist_ok=True)
    p = hf_hub_download(repo, fn, local_dir=d)
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    out.append({'repo': repo, 'file': fn, 'sha256': h, 'bytes': os.path.getsize(p)})
    print(repo, h, os.path.getsize(p))
json.dump(out, open(os.path.join(W, 'weights-manifest.json'), 'w'), indent=1)
