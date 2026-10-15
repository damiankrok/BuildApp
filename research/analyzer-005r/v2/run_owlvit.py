#!/usr/bin/env python3
"""
run_owlvit.py — 005R V2 challenger: ONE compact, locally run, open-vocabulary detector (RESEARCH ONLY; never imported
by production; never a production dependency).

Model: google/owlvit-base-patch32 at revision cbc355fb364588351c5d51c7f74465e8e7ec6f72, weights model.safetensors
sha256 4dbe0399f0b7d7c8dddf1535a98769cc30743bebc877aea681998c8d984ce52b (Apache-2.0 weights; training data only
partly documented — see licensing.md). Weights live OUTSIDE the repository (OWLVIT_DIR). Nothing is sent anywhere.

What it is and is not:
  * Task A (routing) uses the CLIP-style image/text embedding of the same network: a softmax over class prompts. That is
    an IMAGE CLASSIFIER — it produces no box, and its routing output never carries one.
  * Task B (exterior assemblies) uses the detection head: per-patch boxes scored against text queries. That is a
    LOCALIZER, so its observations may carry pixel boxes. Its scores are UNVALIDATED_SCOREs, not probabilities.
  * Prompts and queries are fixed in PROMPTS below and hashed in the preregistration. They name classes only: never a
    project, a slug, a caption, a published area or an expected feature.

Pre-processing: the image is letterboxed (padded right/bottom with mid-grey) to a square before the processor resizes
it to 768×768, so elevations (≈2.5:1) are not squashed; boxes come back in original pixel coordinates.

    $VENV_PY research/analyzer-005r/v2/run_owlvit.py <inputs.json> <out.jsonl> [--threads 4]
inputs.json: [{"assetId": ..., "path": ...}, ...]
"""
import hashlib
import json
import os
import resource
import sys
import time

import numpy as np
import torch
from PIL import Image
from transformers import OwlViTForObjectDetection, OwlViTProcessor

MODEL_DIR = os.environ.get('OWLVIT_DIR', '/home/user/work005r/models/owlvit-base-patch32')
WEIGHTS_SHA256 = '4dbe0399f0b7d7c8dddf1535a98769cc30743bebc877aea681998c8d984ce52b'
REVISION = 'cbc355fb364588351c5d51c7f74465e8e7ec6f72'
V2_VERSION = 'v2-owlvit-b32@1'
BOX_FLOOR = 0.05   # raw boxes below this score are not even recorded (they are recorded as an absence of a record)
NMS_IOU = 0.3
MAX_BOXES_PER_KIND = 8

PROMPTS = {
    'routing': {
        'FLOOR_PLAN': ['an architectural floor plan drawing', 'a black and white floor plan of a house with rooms and walls',
                       'a technical drawing of a building layout seen from above'],
        'TECHNICAL_ELEVATION': ['an architectural elevation drawing of a house facade', 'a flat orthographic technical drawing of a building facade',
                                'a two-dimensional side view drawing of a house'],
        'SECTION': ['an architectural cross-section drawing of a house', 'a technical section drawing showing floors and roof structure cut through'],
        'SITE_PLAN': ['a site plan drawing of a building plot', 'a plot plan showing a house footprint, boundaries and driveway'],
        'EXTERIOR_RENDER': ['a 3D rendering of a house exterior', 'a computer generated visualisation of a house with garden'],
        'INTERIOR_RENDER': ['a 3D rendering of a room interior', 'a computer generated visualisation of a living room or kitchen'],
        'EXTERIOR_PHOTO': ['a photograph of a house exterior', 'a real photo of a built family house'],
        'INTERIOR_PHOTO': ['a photograph of a room interior', 'a real photo inside a house'],
        'DETAIL': ['a construction detail drawing', 'a close-up technical drawing of a building detail'],
    },
    'detection': {
        'TERRACE_AT_GRADE': ['a terrace', 'a paved patio'],
        'COVERED_TERRACE': ['a covered terrace', 'a roofed patio'],
        'PERGOLA_OPEN': ['a pergola', 'an open wooden pergola'],
        'CANOPY_ENTRANCE': ['an entrance canopy', 'a small roof over a front door'],
        'CARPORT': ['a carport', 'a roof on posts for a car'],
        'BALCONY': ['a balcony'],
        'LOGGIA': ['a loggia', 'a recessed balcony'],
        'RAILING': ['a railing', 'a balustrade'],
        'COLUMN_POST': ['a column', 'a post'],
        'EXTERIOR_STEPS': ['outdoor steps', 'entrance stairs'],
        'GARAGE_DOOR': ['a garage door'],
        'WINDOW': ['a window'],
        'EXTERIOR_DOOR': ['a front door', 'an entrance door'],
    },
}


def prompts_sha256():
    return hashlib.sha256(json.dumps(PROMPTS, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def letterbox(img):
    w, h = img.size
    s = max(w, h)
    canvas = Image.new('RGB', (s, s), (128, 128, 128))
    canvas.paste(img, (0, 0))
    return canvas, s


def iou(a, b):
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u > 0 else 0.0


class V2:
    def __init__(self, threads=4):
        torch.set_num_threads(threads)
        torch.use_deterministic_algorithms(True)
        t0 = time.time()
        with open(os.path.join(MODEL_DIR, 'model.safetensors'), 'rb') as f:
            h = hashlib.sha256()
            for chunk in iter(lambda: f.read(1 << 22), b''):
                h.update(chunk)
        if h.hexdigest() != WEIGHTS_SHA256:
            raise SystemExit('WEIGHTS_HASH_MISMATCH: refusing to run an unpinned model')
        self.proc = OwlViTProcessor.from_pretrained(MODEL_DIR)
        self.model = OwlViTForObjectDetection.from_pretrained(MODEL_DIR).eval()
        self.load_s = time.time() - t0
        with torch.no_grad():
            self.route_classes = list(PROMPTS['routing'])
            embs = []
            for c in self.route_classes:
                t = self.proc(text=PROMPTS['routing'][c], return_tensors='pt', padding=True)
                e = self.model.owlvit.get_text_features(input_ids=t['input_ids'], attention_mask=t['attention_mask'])
                e = e / e.norm(dim=-1, keepdim=True)
                m = e.mean(0)
                embs.append(m / m.norm())
            self.route_text = torch.stack(embs)
            self.det_kinds = list(PROMPTS['detection'])
            self.det_queries = [(k, q) for k in self.det_kinds for q in PROMPTS['detection'][k]]
            self.det_tok = self.proc(text=[[q for _, q in self.det_queries]], return_tensors='pt', padding=True)

    @torch.no_grad()
    def run(self, path):
        img = Image.open(path).convert('RGB')
        w, h = img.size
        boxed, s = letterbox(img)
        t0 = time.time()
        pix = self.proc(images=boxed, return_tensors='pt')['pixel_values']
        # Task A: classifier over prompt classes (image embedding of the CLIP backbone)
        ie = self.model.owlvit.get_image_features(pixel_values=pix)
        ie = ie / ie.norm(dim=-1, keepdim=True)
        logits = (self.model.owlvit.logit_scale.exp() * ie @ self.route_text.T)[0]
        probs = torch.softmax(logits, dim=-1).tolist()
        route_s = time.time() - t0
        # Task B: localizer
        t1 = time.time()
        out = self.model(input_ids=self.det_tok['input_ids'], attention_mask=self.det_tok['attention_mask'], pixel_values=pix)
        scores = torch.sigmoid(out.logits[0]).numpy()           # [patches, queries]
        boxes = out.pred_boxes[0].numpy()                       # cx, cy, bw, bh in [0,1] of the padded square
        det_s = time.time() - t1
        per_kind = {}
        for k in self.det_kinds:
            qi = [i for i, (kk, _) in enumerate(self.det_queries) if kk == k]
            sk = scores[:, qi].max(axis=1)
            cand = []
            for p in np.argsort(-sk, kind='stable'):
                sc = float(sk[p])
                if sc < BOX_FLOOR:
                    break
                cx, cy, bw, bh = (float(v) for v in boxes[p])
                x0, y0, x1, y1 = (cx - bw / 2) * s, (cy - bh / 2) * s, (cx + bw / 2) * s, (cy + bh / 2) * s
                x0, y0, x1, y1 = max(0, int(np.floor(x0))), max(0, int(np.floor(y0))), min(w, int(np.ceil(x1))), min(h, int(np.ceil(y1)))
                if x1 <= x0 or y1 <= y0:
                    continue  # the box lies in the letterbox padding: no pixels of the source image
                b = (x0, y0, x1, y1)
                if any(iou(b, c['box']) > NMS_IOU for c in cand):
                    continue
                cand.append({'box': b, 'score': round(sc, 6), 'patch': int(p)})
                if len(cand) >= MAX_BOXES_PER_KIND:
                    break
            per_kind[k] = [{'box': list(c['box']), 'score': c['score']} for c in cand]
        return {
            'width': w, 'height': h,
            'routing': {c: round(p, 6) for c, p in zip(self.route_classes, probs)},
            'detections': per_kind,
            'timing': {'route_s': round(route_s, 4), 'detect_s': round(det_s, 4)},
        }


def main(argv):
    inputs = json.load(open(argv[0]))
    out_path = argv[1]
    threads = int(argv[argv.index('--threads') + 1]) if '--threads' in argv else 4
    t0 = time.time()
    v2 = V2(threads)
    meta = {'meta': True, 'version': V2_VERSION, 'revision': REVISION, 'weightsSha256': WEIGHTS_SHA256, 'promptsSha256': prompts_sha256(),
            'torch': torch.__version__, 'threads': threads, 'loadSeconds': round(v2.load_s, 3)}
    with open(out_path, 'w') as f:
        f.write(json.dumps(meta, sort_keys=True) + '\n')
        for i, item in enumerate(inputs):
            try:
                r = v2.run(item['path'])
                r['assetId'] = item['assetId']
            except Exception as e:  # a failed decode is a recorded outcome, never a silent skip
                r = {'assetId': item['assetId'], 'error': f'{type(e).__name__}: {e}'}
            f.write(json.dumps(r, sort_keys=True) + '\n')
            if i % 50 == 0:
                print(f'{i}/{len(inputs)}', flush=True)
        f.write(json.dumps({'meta': True, 'end': True, 'wallSeconds': round(time.time() - t0, 2),
                            'peakRssMB': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)}, sort_keys=True) + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
