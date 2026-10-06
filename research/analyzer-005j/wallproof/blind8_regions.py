#!/usr/bin/env python3
"""blind8_regions.py - what the proof wall models say inside the blind-8 decision regions (RESEARCH ONLY, 005J).

    python -I -B blind8_regions.py --ckpt <model.pt> --work /home/user/work005j --out <json>

Runs a trained proof model on the two blind-8 frames (development evidence since 005J) and reports the share of
BACKGROUND / WALL / OPENING pixels inside the regions the 005I diagnosis names (coordinates read from the frames, the
same ones as the question corpus). This is an observation about pixels, not an interpretation: an OPENING share over a
window gap says "a wall with an opening runs here", which is the witness `classifyGap` lacked on cyklamenach.
"""
import argparse
import json
import os
import sys

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wallnet  # noqa: E402

REGIONS = {
    'dom-w-cyklamenach': {
        'window 180/160 gap (analyzer: DASHED, weak)': (165, 197, 255, 216),
        'double door 180/230 gap (analyzer: LEAF_FACE, weak)': (310, 197, 397, 216),
        'north wall pieces either side (wall)': (132, 197, 165, 216),
        'textured terrace north of the house (no wall)': (140, 130, 560, 188),
    },
    'dom-w-gozdzikowcach': {
        'garage door 325/225 gap (analyzer: part of one OPEN_SIDE)': (466, 576, 589, 592),
        'porch mouth on the front line (open, no wall)': (313, 560, 416, 597),
        'vestibule front wall left of the entrance door (wall)': (338, 541, 376, 556),
        'entrance door 105/210 in the vestibule wall (opening)': (378, 541, 416, 556),
        'pier between porch and garage (wall)': (418, 541, 434, 590),
    },
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ckpt', required=True)
    ap.add_argument('--work', default='/home/user/work005j')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    ck = torch.load(a.ckpt, weights_only=False)
    model = wallnet.build(ck['arch'])
    model.load_state_dict(ck['state'])
    model.eval()
    torch.set_num_threads(1)
    res = {'arch': ck['arch'], 'regions': {}}
    for house, regs in REGIONS.items():
        img = np.array(Image.open(os.path.join(a.work, 'frames', f'{house}.rgb.png')).convert('L'))
        pr = wallnet.predict(model, img)
        res['regions'][house] = {}
        for name, (x0, y0, x1, y1) in regs.items():
            r = pr[y0:y1 + 1, x0:x1 + 1]
            n = r.size
            res['regions'][house][name] = {'box': [x0, y0, x1, y1], 'background': round(float((r == 0).sum()) / n, 3), 'wall': round(float((r == 1).sum()) / n, 3), 'opening': round(float((r == 2).sum()) / n, 3)}
    json.dump(res, open(a.out, 'w'), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()
