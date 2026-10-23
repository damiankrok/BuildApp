"""IU-01: compute the model-free geometric features for every image in the given directories (offline)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo
refuse_inside_repo(sys.argv[1], 'geometric features of source images')
from iu.backbones import offline_guard, open_image
from iu.geometry_check import features
offline_guard()
out = {}
dst = sys.argv[1]
for d in sys.argv[2:]:
    for f in sorted(os.listdir(d)):
        if f.split('.')[-1].lower() in ('jpg', 'jpeg', 'png', 'gif'):
            out[f.split('.')[0]] = features(open_image(os.path.join(d, f)))
json.dump(out, open(dst, 'w'))
print(len(out))
