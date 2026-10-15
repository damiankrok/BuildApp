#!/usr/bin/env python3
"""
b1_v2_faithfulness.py — 005R addendum B1 (POST-HOC implementation check, RESEARCH ONLY; synthetic images only).

V2 routing sent every real image to INTERIOR_RENDER. Before that is reported as a property of the model, this checks
that run_owlvit.py computes what the library computes: on synthetic images (no publisher pixel, no real truth), the
routing logits of V2.run are compared with the library's own OwlViTModel forward (`logits_per_image`, one prompt per
class = the first prompt), and the spread of the image embeddings is measured (a degenerate embedding would put every
image at cosine ≈ 1 to every other).

    $VENV_PY b1_v2_faithfulness.py <synth-dir> <out.json>
"""
import json
import os
import sys

import torch
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v2'))
import run_owlvit as V  # noqa: E402


def main(synth, out):
    v2 = V.V2(3)
    truth = json.load(open(os.path.join(synth, 'truth.json')))
    pick = {}
    for im in truth['images']:
        if not (im.get('lineage') or {}).get('op'):
            pick.setdefault(im['roleTruth'], []).append(im['syntheticId'])
    ids = [i for r in sorted(pick) for i in pick[r][:3]]
    first = [V.PROMPTS['routing'][c][0] for c in v2.route_classes]
    rows, embs = [], []
    with torch.no_grad():
        tok = v2.proc(text=first, return_tensors='pt', padding=True)
        for sid in ids:
            img, _ = V.letterbox(Image.open(os.path.join(synth, 'images', sid + '.png')).convert('RGB'))
            pix = v2.proc(images=img, return_tensors='pt')['pixel_values']
            lib = v2.model.owlvit(input_ids=tok['input_ids'], attention_mask=tok['attention_mask'], pixel_values=pix)
            ie = v2.model.owlvit.get_image_features(pixel_values=pix)
            ie = ie / ie.norm(dim=-1, keepdim=True)
            embs.append(ie[0])
            te = v2.model.owlvit.get_text_features(input_ids=tok['input_ids'], attention_mask=tok['attention_mask'])
            te = te / te.norm(dim=-1, keepdim=True)
            mine = (v2.model.owlvit.logit_scale.exp() * ie @ te.T)[0]
            libl = lib.logits_per_image[0]
            rows.append({'syntheticId': sid, 'role': next(i['roleTruth'] for i in truth['images'] if i['syntheticId'] == sid),
                         'maxAbsLogitDiff': round(float((mine - libl).abs().max()), 6),
                         'libTop': v2.route_classes[int(libl.argmax())], 'libTopProb': round(float(libl.softmax(-1).max()), 4)})
    E = torch.stack(embs)
    cos = (E @ E.T)[~torch.eye(len(embs), dtype=torch.bool)]
    res = {'images': len(rows), 'maxAbsLogitDiffOverAll': max(r['maxAbsLogitDiff'] for r in rows), 'logitScale': round(float(v2.model.owlvit.logit_scale.exp()), 3),
           'imageEmbeddingCosine': {'min': round(float(cos.min()), 4), 'mean': round(float(cos.mean()), 4), 'max': round(float(cos.max()), 4)}, 'rows': rows}
    json.dump(res, open(out, 'w'), indent=1, sort_keys=True)
    print(json.dumps({k: v for k, v in res.items() if k != 'rows'}, indent=1))
    for r in rows:
        print(r)


if __name__ == '__main__':
    main(*sys.argv[1:3])
