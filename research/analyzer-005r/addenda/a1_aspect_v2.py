#!/usr/bin/env python3
"""
a1_aspect_v2.py — 005R addendum A1 for V2 (POST-HOC diagnostic, RESEARCH ONLY).

    $VENV_PY a1_aspect_v2.py <inputs.json> <out.jsonl>

V2 already letterboxes every image with mid-grey (128) to a square before its processor, so a grey letterbox is the
identity for V2 by construction. The informative variant is WHITE padding: each image is letterboxed in memory with
white and passed to the same V2 (same weights, same prompts); routing probabilities only. No image is written.
"""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v2'))
import run_owlvit as V  # noqa: E402
import torch  # noqa: E402


def main(inp, out):
    v2 = V.V2(3)
    with open(out, 'w') as f, torch.no_grad():
        for it in json.load(open(inp)):
            img = Image.open(it['path']).convert('RGB')
            s = max(img.size)
            canvas = Image.new('RGB', (s, s), (255, 255, 255))
            canvas.paste(img, (0, 0))
            pix = v2.proc(images=canvas, return_tensors='pt')['pixel_values']
            ie = v2.model.owlvit.get_image_features(pixel_values=pix)
            ie = ie / ie.norm(dim=-1, keepdim=True)
            probs = torch.softmax((v2.model.owlvit.logit_scale.exp() * ie @ v2.route_text.T)[0], dim=-1).tolist()
            f.write(json.dumps({'assetId': it['assetId'], 'routingWhite': {c: round(p, 6) for c, p in zip(v2.route_classes, probs)}}, sort_keys=True) + '\n')


if __name__ == '__main__':
    main(*sys.argv[1:3])
