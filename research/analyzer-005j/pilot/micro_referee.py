#!/usr/bin/env python3
"""micro_referee.py - Route C feasibility pilot (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J). Not a candidate model.

    python -I -B micro_referee.py train --items <pilot items.jsonl> --img <dir> --out <ckpt.pt> [--steps 2000]
    python -I -B micro_referee.py predict --ckpt <ckpt.pt> --items <bench items.jsonl> --img <dir> --out <run.jsonl>

Question: can a tiny network, trained FROM SCRATCH only on BuildPlan's own synthetic question images (seeds disjoint
from the benchmark's), answer the narrow closed questions that generic small VLMs cannot - and how much of that
survives on real development drawings? One small CNN trunk shared by every class, one linear head per question class
over that class's answers (UNRESOLVED is never a training target: the network abstains only through its confidence).
Input: the CANDIDATE_OVERLAY image at 256 x 256 (the overlay colours carry the candidates). No pretrained weights, no
third-party data, no teacher labels: the generator's semantics are the only truth.
"""
import argparse
import json
import os
import random
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

SIDE = 256


def block(i, o, s):
    return nn.Sequential(nn.Conv2d(i, o, 3, s, 1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True),
                         nn.Conv2d(o, o, 3, 1, 1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))


class MicroReferee(nn.Module):
    def __init__(self, heads):
        super().__init__()
        self.trunk = nn.Sequential(block(3, 24, 2), block(24, 48, 2), block(48, 96, 2), block(96, 144, 2), block(144, 192, 2))
        self.heads = nn.ModuleDict({c: nn.Linear(192 * 2, n) for c, n in heads.items()})

    def forward(self, x, cls):
        f = self.trunk(x)
        f = torch.cat([F.adaptive_avg_pool2d(f, 1), F.adaptive_max_pool2d(f, 1)], 1).flatten(1)
        return self.heads[cls](f)


def load_img(path):
    im = Image.open(path).convert('RGB')
    if im.size != (SIDE, SIDE):
        im = im.resize((SIDE, SIDE), Image.BILINEAR)
    return torch.from_numpy(np.asarray(im, dtype=np.float32) / 255.0).permute(2, 0, 1)


def answers_of(it):
    return [e for e in it['enum'] if e != 'UNRESOLVED']


def train(a):
    torch.manual_seed(5007)
    torch.set_num_threads(a.threads)
    rng = random.Random(5007)
    items = [json.loads(l) for l in open(a.items)]
    heads = {}
    for it in items:
        heads[it['cls']] = len(answers_of(it))
    by_cls = {}
    for it in items:
        by_cls.setdefault(it['cls'], []).append(it)
    cache = {}
    model = MicroReferee(heads)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=a.lr, total_steps=a.steps, pct_start=0.1)
    classes = sorted(by_cls)
    log = []
    t0 = time.time()
    model.train()
    for step in range(a.steps):
        cls = classes[step % len(classes)]       # balanced over question classes
        batch = [by_cls[cls][rng.randrange(len(by_cls[cls]))] for _ in range(a.batch)]
        xs = []
        for it in batch:
            if it['image'] not in cache:
                cache[it['image']] = load_img(os.path.join(a.img, it['image']))
            x = cache[it['image']]
            if rng.random() < 0.3:     # photometric jitter only: geometry already varies through the corpus transforms
                x = (x * rng.uniform(0.8, 1.0) + rng.uniform(0, 0.15)).clamp(0, 1)
            xs.append(x)
        y = torch.tensor([answers_of(it).index(it['expected']) for it in batch])
        loss = F.cross_entropy(model(torch.stack(xs), cls), y)
        opt.zero_grad()
        loss.backward()
        opt.step()
        sched.step()
        if step % 100 == 0 or step == a.steps - 1:
            log.append({'step': step, 'cls': cls, 'loss': round(float(loss), 4), 'sec': round(time.time() - t0, 1)})
            print(log[-1], flush=True)
    torch.save({'state': model.state_dict(), 'heads': heads, 'params': n_params, 'steps': a.steps, 'batch': a.batch, 'trainSec': round(time.time() - t0, 1), 'log': log,
                'trainItems': len(items), 'trainSeedBase': 'pilot corpus (vrgen --seed-base 60060 --seeds 8), disjoint from the benchmark (50050, 3 seeds)'}, a.out)


def predict(a):
    ck = torch.load(a.ckpt, weights_only=False)
    model = MicroReferee(ck['heads'])
    model.load_state_dict(ck['state'])
    model.eval()
    torch.set_num_threads(a.threads)
    n = 0
    with open(a.out, 'w') as fh, torch.no_grad():
        for line in open(a.items):
            it = json.loads(line)
            if it['mode'] != 'CANDIDATE_OVERLAY' or it['cls'] not in ck['heads']:
                continue
            t = time.perf_counter()
            x = load_img(os.path.join(a.img, it['image']))[None]
            p = F.softmax(model(x, it['cls']), 1)[0].numpy()
            ans = answers_of(it)
            k = int(p.argmax())
            fh.write(json.dumps({'qid': it['qid'], 'mode': it['mode'], 'model': 'micro-referee-pilot', 'imageSha256': it['imageSha256'],
                                 'score': {'answer': ans[k], 'confidence': round(float(p[k]), 5), 'probs': {a_: round(float(v), 5) for a_, v in zip(ans, p)},
                                           'ms': round((time.perf_counter() - t) * 1e3, 2)}}) + '\n')
            n += 1
    print(n, 'predictions;', ck['params'], 'params')


def export(a):
    """ONNX export of the trunk + one head (BODY_REGION) at 256 x 256 RGB, for the WASM latency probe."""
    ck = torch.load(a.ckpt, weights_only=False)
    model = MicroReferee(ck['heads'])
    model.load_state_dict(ck['state'])
    model.eval()

    class One(nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, x):
            return F.softmax(self.m(x, 'BODY_REGION'), 1)
    torch.onnx.export(One(model), torch.zeros(1, 3, SIDE, SIDE), a.out, input_names=['image'], output_names=['probs'], opset_version=17, dynamo=False)
    print('exported', a.out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['train', 'predict', 'export'])
    ap.add_argument('--items', required=True)
    ap.add_argument('--img', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--ckpt')
    ap.add_argument('--steps', type=int, default=2000)
    ap.add_argument('--batch', type=int, default=24)
    ap.add_argument('--lr', type=float, default=2e-3)
    ap.add_argument('--threads', type=int, default=1)
    a = ap.parse_args()
    {'train': train, 'predict': predict, 'export': export}[a.cmd](a)


if __name__ == '__main__':
    main()
