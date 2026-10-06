#!/usr/bin/env python3
"""wallnet.py - bounded wall-evidence training proof (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J). Not a production model.

    python -I -B wallnet.py train --arch unet|segformer --data <train dir> --out <ckpt.pt> [--steps 1500] [--threads 2]
    python -I -B wallnet.py eval  --ckpt <ckpt.pt> --data <test dir> --real <real-eval.json> --out <result.json>

Commercial-clean by construction: both networks are written here from their papers (U-Net, Ronneberger et al. 2015;
SegFormer / Mix Transformer, Xie et al. 2021) - no NVIDIA SegFormer code, no smp encoder code - and trained FROM
SCRATCH (no ImageNet or other pretrained weights) on BuildPlan's own synthetic drawings only. Input: one grey channel,
inverted (ink = 1). Output: 3 classes - background, wall, opening.
"""
import argparse
import glob
import json
import math
import os
import random
import resource
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

CLASSES = ['BACKGROUND', 'WALL', 'OPENING']


# ----------------------------------------------------------------------------------------------------------------------
class ConvBlock(nn.Sequential):
    def __init__(self, i, o):
        super().__init__(nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True),
                         nn.Conv2d(o, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))


class UNetLite(nn.Module):
    """A small U-Net: a stride-2 stem (walls are several pixels thick, so half resolution keeps them), then five
    levels of 16..192 channels, and a bilinear return to full resolution."""

    def __init__(self, ch=(16, 32, 64, 128, 192), n_cls=3):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(1, 16, 3, 2, 1, bias=False), nn.BatchNorm2d(16), nn.ReLU(inplace=True))
        self.enc = nn.ModuleList()
        prev = 16
        for c in ch:
            self.enc.append(ConvBlock(prev, c))
            prev = c
        self.dec = nn.ModuleList()
        for c_skip, c_in in zip(reversed(ch[:-1]), reversed(ch[1:])):
            self.dec.append(ConvBlock(c_in + c_skip, c_skip))
        self.head = nn.Conv2d(ch[0], n_cls, 1)

    def forward(self, x):
        H, W = x.shape[-2:]
        x = self.stem(x)
        skips = []
        for i, e in enumerate(self.enc):
            x = e(x)
            if i < len(self.enc) - 1:
                skips.append(x)
                x = F.max_pool2d(x, 2)
        for d, s in zip(self.dec, reversed(skips)):
            x = F.interpolate(x, size=s.shape[-2:], mode='bilinear', align_corners=False)
            x = d(torch.cat([x, s], 1))
        return F.interpolate(self.head(x), size=(H, W), mode='bilinear', align_corners=False)


class OverlapPatchEmbed(nn.Module):
    def __init__(self, i, o, k, s):
        super().__init__()
        self.proj = nn.Conv2d(i, o, k, s, k // 2)
        self.norm = nn.LayerNorm(o)

    def forward(self, x):
        x = self.proj(x)
        h, w = x.shape[-2:]
        return self.norm(x.flatten(2).transpose(1, 2)), h, w


class EfficientAttention(nn.Module):
    """Multi-head self-attention whose keys/values are spatially reduced by a strided conv (sequence reduction)."""

    def __init__(self, dim, heads, sr):
        super().__init__()
        self.heads, self.sr = heads, sr
        self.q = nn.Linear(dim, dim)
        self.kv = nn.Linear(dim, dim * 2)
        self.proj = nn.Linear(dim, dim)
        if sr > 1:
            self.red = nn.Conv2d(dim, dim, sr, sr)
            self.norm = nn.LayerNorm(dim)

    def forward(self, x, h, w):
        b, n, c = x.shape
        q = self.q(x).reshape(b, n, self.heads, c // self.heads).transpose(1, 2)
        if self.sr > 1:
            y = x.transpose(1, 2).reshape(b, c, h, w)
            y = self.norm(self.red(y).flatten(2).transpose(1, 2))
        else:
            y = x
        k, v = self.kv(y).reshape(b, -1, 2, self.heads, c // self.heads).permute(2, 0, 3, 1, 4)
        a = F.scaled_dot_product_attention(q, k, v)
        return self.proj(a.transpose(1, 2).reshape(b, n, c))


class MixFFN(nn.Module):
    def __init__(self, dim, ratio=4):
        super().__init__()
        hid = dim * ratio
        self.fc1 = nn.Linear(dim, hid)
        self.dw = nn.Conv2d(hid, hid, 3, 1, 1, groups=hid)
        self.fc2 = nn.Linear(hid, dim)

    def forward(self, x, h, w):
        x = self.fc1(x)
        b, n, c = x.shape
        x = self.dw(x.transpose(1, 2).reshape(b, c, h, w)).flatten(2).transpose(1, 2)
        return self.fc2(F.gelu(x))


class MiTBlock(nn.Module):
    def __init__(self, dim, heads, sr):
        super().__init__()
        self.n1, self.n2 = nn.LayerNorm(dim), nn.LayerNorm(dim)
        self.attn = EfficientAttention(dim, heads, sr)
        self.ffn = MixFFN(dim)

    def forward(self, x, h, w):
        x = x + self.attn(self.n1(x), h, w)
        return x + self.ffn(self.n2(x), h, w)


class SegFormerB0(nn.Module):
    """Mix Transformer B0 sizes (dims 32/64/160/256, depths 2/2/2/2, heads 1/2/5/8, reductions 8/4/2/1) and the
    all-MLP decoder (256), re-implemented from the paper's description, single grey input channel."""

    def __init__(self, dims=(32, 64, 160, 256), depths=(2, 2, 2, 2), heads=(1, 2, 5, 8), srs=(8, 4, 2, 1), dec=256, n_cls=3):
        super().__init__()
        self.embeds = nn.ModuleList([OverlapPatchEmbed(1 if i == 0 else dims[i - 1], dims[i], 7 if i == 0 else 3, 4 if i == 0 else 2) for i in range(4)])
        self.stages = nn.ModuleList([nn.ModuleList([MiTBlock(dims[i], heads[i], srs[i]) for _ in range(depths[i])]) for i in range(4)])
        self.norms = nn.ModuleList([nn.LayerNorm(d) for d in dims])
        self.lin = nn.ModuleList([nn.Linear(d, dec) for d in dims])
        self.fuse = nn.Sequential(nn.Conv2d(dec * 4, dec, 1, bias=False), nn.BatchNorm2d(dec), nn.ReLU(inplace=True))
        self.head = nn.Conv2d(dec, n_cls, 1)

    def forward(self, x):
        H, W = x.shape[-2:]
        feats = []
        for emb, blocks, norm in zip(self.embeds, self.stages, self.norms):
            x, h, w = emb(x)
            for blk in blocks:
                x = blk(x, h, w)
            x = norm(x)
            x = x.transpose(1, 2).reshape(x.shape[0], -1, h, w)
            feats.append(x)
        size = feats[0].shape[-2:]
        ups = []
        for f, lin in zip(feats, self.lin):
            b, c, h, w = f.shape
            y = lin(f.flatten(2).transpose(1, 2)).transpose(1, 2).reshape(b, -1, h, w)
            ups.append(F.interpolate(y, size=size, mode='bilinear', align_corners=False))
        y = self.head(self.fuse(torch.cat(ups[::-1], 1)))
        return F.interpolate(y, size=(H, W), mode='bilinear', align_corners=False)


def build(arch):
    return UNetLite() if arch == 'unet' else SegFormerB0()


# ----------------------------------------------------------------------------------------------------------------------
def to_input(gray_u8):
    return torch.from_numpy(1.0 - gray_u8.astype(np.float32) / 255.0)[None, None]


def load_set(d):
    items = []
    for npz in sorted(glob.glob(os.path.join(d, '*.npz'))):
        img = np.array(Image.open(npz[:-4] + '.png').convert('L'))
        m = np.load(npz)
        items.append((img, m['label'].astype(np.int64), m['external'], m['dim'], m['text']))
    return items


def sample_batch(items, rng, bs, size):
    xs, ys = [], []
    for _ in range(bs):
        img, lab = items[rng.randrange(len(items))][:2]
        s = rng.uniform(0.75, 1.3)
        if abs(s - 1) > 0.02:
            h, w = img.shape
            nh, nw = max(size, int(h * s)), max(size, int(w * s))
            img = np.array(Image.fromarray(img).resize((nw, nh), Image.BILINEAR))
            lab = np.array(Image.fromarray(lab.astype(np.uint8)).resize((nw, nh), Image.NEAREST)).astype(np.int64)
        h, w = img.shape
        if h < size or w < size:
            pi = np.full((max(h, size), max(w, size)), 255, np.uint8)
            pl = np.zeros_like(pi, dtype=np.int64)
            pi[:h, :w], pl[:h, :w] = img, lab
            img, lab, (h, w) = pi, pl, pi.shape
        # bias crops towards walls so most tiles hold some structure
        for _ in range(5):
            y0, x0 = rng.randrange(h - size + 1), rng.randrange(w - size + 1)
            if (lab[y0:y0 + size, x0:x0 + size] > 0).mean() > 0.02:
                break
        ci, cl = img[y0:y0 + size, x0:x0 + size], lab[y0:y0 + size, x0:x0 + size]
        k = rng.randrange(4)
        ci, cl = np.rot90(ci, k).copy(), np.rot90(cl, k).copy()
        if rng.random() < 0.5:
            ci, cl = ci[:, ::-1].copy(), cl[:, ::-1].copy()
        if rng.random() < 0.3:     # contrast jitter
            lo = rng.uniform(0, 80)
            ci = (lo + ci.astype(np.float32) * (255 - lo) / 255).astype(np.uint8)
        xs.append(to_input(ci)[0])
        ys.append(torch.from_numpy(cl))
    return torch.stack(xs), torch.stack(ys)


def train(a):
    torch.manual_seed(5005)
    torch.set_num_threads(a.threads)
    rng = random.Random(5005)
    items = load_set(a.data)
    model = build(a.arch)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=a.lr, total_steps=a.steps, pct_start=0.1)
    w = torch.tensor([1.0, 3.0, 6.0])
    log = []
    t0 = time.time()
    model.train()
    for step in range(a.steps):
        x, y = sample_batch(items, rng, a.batch, a.size)
        out = model(x)
        loss = F.cross_entropy(out, y, weight=w)
        p = out.softmax(1)[:, 1]
        t = (y == 1).float()
        loss = loss + (1 - (2 * (p * t).sum() + 1) / (p.sum() + t.sum() + 1))
        opt.zero_grad()
        loss.backward()
        opt.step()
        sched.step()
        if step % 50 == 0 or step == a.steps - 1:
            log.append({'step': step, 'loss': round(float(loss), 4), 'sec': round(time.time() - t0, 1)})
            print(log[-1], flush=True)
    torch.save({'arch': a.arch, 'state': model.state_dict(), 'params': n_params, 'steps': a.steps, 'batch': a.batch, 'size': a.size, 'lr': a.lr, 'trainSec': round(time.time() - t0, 1),
                'log': log, 'data': os.path.abspath(a.data), 'trainItems': len(items)}, a.out)


# ----------------------------------------------------------------------------------------------------------------------
def predict(model, gray):
    h, w = gray.shape
    H, W = int(math.ceil(h / 32) * 32), int(math.ceil(w / 32) * 32)
    pad = np.full((H, W), 255, np.uint8)
    pad[:h, :w] = gray
    with torch.no_grad():
        out = model(to_input(pad))
    return out.argmax(1)[0, :h, :w].numpy()


def boundary(mask):
    m = mask.astype(bool)
    e = np.zeros_like(m)
    e[1:-1, 1:-1] = m[1:-1, 1:-1] & ~(m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:])
    return e


def dilate(m, r):
    t = torch.from_numpy(m.astype(np.float32))[None, None]
    return (F.max_pool2d(t, 2 * r + 1, 1, r)[0, 0].numpy() > 0)


def prf(pred, truth):
    tp = float((pred & truth).sum())
    fp = float((pred & ~truth).sum())
    fn = float((~pred & truth).sum())
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {'iou': round(tp / (tp + fp + fn), 4) if tp + fp + fn else None, 'precision': round(p, 4), 'recall': round(r, 4), 'f1': round(2 * p * r / (p + r), 4) if p + r else 0.0}


def evaluate(a):
    ck = torch.load(a.ckpt, weights_only=False)
    model = build(ck['arch'])
    model.load_state_dict(ck['state'])
    model.eval()
    torch.set_num_threads(1)
    res = {'arch': ck['arch'], 'params': ck['params'], 'fp32MB': round(ck['params'] * 4 / 2 ** 20, 2), 'int8MBEstimate': round(ck['params'] / 2 ** 20, 2), 'trainSec': ck['trainSec'],
           'steps': ck['steps'], 'batch': ck['batch'], 'tile': ck['size'], 'trainItems': ck['trainItems'], 'pretrained': 'NONE (trained from scratch)'}
    # synthetic held-out set
    agg = {k: [] for k in ('wall', 'opening', 'envelope')}
    tp_fp = {'wallPred': 0, 'wallTrue': 0, 'wallTP': 0, 'bTP': 0, 'bPred': 0, 'bTrue': 0, 'openTrue': 0, 'openPred': 0, 'openTP': 0, 'contTrue': 0, 'contHit': 0,
             'extPx': 0, 'extWall': 0, 'dimPx': 0, 'dimWall': 0, 'txtPx': 0, 'txtWall': 0}
    times = []
    for img, lab, ext, dim, txt in load_set(a.data):
        t = time.perf_counter()
        pr = predict(model, img)
        times.append((time.perf_counter() - t) * 1e3 / (img.size / 1e6))
        pw, tw = pr == 1, lab == 1
        tp_fp['wallPred'] += int(pw.sum()); tp_fp['wallTrue'] += int(tw.sum()); tp_fp['wallTP'] += int((pw & tw).sum())
        pb, tb = boundary(pw), boundary(tw)
        tp_fp['bPred'] += int(pb.sum()); tp_fp['bTrue'] += int(tb.sum())
        tp_fp['bTP'] += int((pb & dilate(tb, 2)).sum())
        tp_fp['bTrueHit'] = tp_fp.get('bTrueHit', 0) + int((tb & dilate(pb, 2)).sum())
        po, to = pr == 2, lab == 2
        tp_fp['openPred'] += int(po.sum()); tp_fp['openTrue'] += int(to.sum()); tp_fp['openTP'] += int((po & to).sum())
        tp_fp['contTrue'] += int(to.sum()); tp_fp['contHit'] += int((to & (pr > 0)).sum())
        outside = (ext > 0) & ~dilate(lab > 0, 3)
        tp_fp['extPx'] += int(outside.sum()); tp_fp['extWall'] += int((outside & pw).sum())
        dm = (dim > 0) & ~dilate(lab > 0, 3)
        tp_fp['dimPx'] += int(dm.sum()); tp_fp['dimWall'] += int((dm & pw).sum())
        tx = (txt > 0) & ~dilate(lab > 0, 3)
        tp_fp['txtPx'] += int(tx.sum()); tp_fp['txtWall'] += int((tx & pw).sum())
    q = tp_fp
    P = q['wallTP'] / max(1, q['wallPred']); R = q['wallTP'] / max(1, q['wallTrue'])
    bP = q['bTP'] / max(1, q['bPred']); bR = q['bTrueHit'] / max(1, q['bTrue'])
    oP = q['openTP'] / max(1, q['openPred']); oR = q['openTP'] / max(1, q['openTrue'])
    res['synthetic'] = {
        'renders': len(times),
        'wallIoU': round(q['wallTP'] / max(1, q['wallPred'] + q['wallTrue'] - q['wallTP']), 4), 'wallF1': round(2 * P * R / max(1e-9, P + R), 4), 'wallPrecision': round(P, 4), 'wallRecall': round(R, 4),
        'boundaryF1_2px': round(2 * bP * bR / max(1e-9, bP + bR), 4),
        'openingIoU': round(q['openTP'] / max(1, q['openPred'] + q['openTrue'] - q['openTP']), 4), 'openingPrecision': round(oP, 4), 'openingRecall': round(oR, 4),
        'continuityThroughOpenings': round(q['contHit'] / max(1, q['contTrue']), 4),
        'falseWallOnTerracesEtc': round(q['extWall'] / max(1, q['extPx']), 4), 'falseWallOnDimensionLines': round(q['dimWall'] / max(1, q['dimPx']), 4),
        'falseWallOnText': round(q['txtWall'] / max(1, q['txtPx']), 4),
        'msPerMegapixel1Thread': round(float(np.median(times)), 1),
    }
    # real development plans: exterior walls only (005I manual truth), against source-cv's wall bands
    if a.real:
        spec = json.load(open(a.real))
        rows = []
        for h in spec['houses']:
            img = np.array(Image.open(h['frame']).convert('L'))
            t = time.perf_counter()
            pr = predict(model, img)
            ms = (time.perf_counter() - t) * 1e3
            ext_wall = np.array(Image.open(h['extWallMask'])) > 0
            openings = np.array(Image.open(h['openingMask'])) > 0
            excl = np.array(Image.open(h['exclusionMask'])) > 0
            scv = np.array(Image.open(h['scvMask'])) > 0
            scv_b = dilate(np.array(Image.open(h['scvBandsMask'])) > 0, 2)
            pw = pr == 1
            pe = pr > 0
            scv_d = dilate(scv, 2)
            truth_px = int(ext_wall.sum())
            rows.append({'house': h['house'], 'msPerFrame1Thread': round(ms, 1), 'frame': list(img.shape),
                         'exteriorWallRecall': round(float((pw & ext_wall).sum()) / max(1, truth_px), 4),
                         'exteriorWallRecallSourceCv': round(float((scv_d & ext_wall).sum()) / max(1, truth_px), 4),
                         'ADDITIONAL_USEFUL_WALL_EVIDENCE_OVER_SOURCE_CV': round(float((pw & ext_wall & ~scv_d).sum()) / max(1, truth_px), 4),
                         'exteriorWallRecallSourceCvBandsOnly': round(float((scv_b & ext_wall).sum()) / max(1, truth_px), 4),
                         'additionalOverBandsOnly': round(float((pw & ext_wall & ~scv_b).sum()) / max(1, truth_px), 4),
                         'truthPx': truth_px,
                         'openingAsOpening': round(float(((pr == 2) & openings).sum()) / max(1, int(openings.sum())), 4),
                         'envelopeContinuityThroughOpenings': round(float((pe & openings).sum()) / max(1, int(openings.sum())), 4),
                         'falseWallInExclusions': round(float((pw & excl).sum()) / max(1, int(excl.sum())), 4),
                         'falseWallInExclusionsSourceCv': round(float((scv & excl).sum()) / max(1, int(excl.sum())), 4)})
        res['real'] = rows
    # peak memory of this evaluation process (inference on the largest frame dominates)
    res['peakRssMB_evalProcess'] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
    json.dump(res, open(a.out, 'w'), indent=1)
    print(json.dumps(res, indent=1))


def export(a):
    """ONNX export (opset 17) for the WASM latency probe; a fixed 864 x 864 input (a real frame padded to /32)."""
    ck = torch.load(a.ckpt, weights_only=False)
    model = build(ck['arch'])
    model.load_state_dict(ck['state'])
    model.eval()
    x = torch.zeros(1, 1, 864, 864)
    torch.onnx.export(model, x, a.out, input_names=['image'], output_names=['logits'], opset_version=17, dynamo=False)
    print('exported', a.out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['train', 'eval', 'export'])
    ap.add_argument('--arch', default='unet')
    ap.add_argument('--data', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--ckpt')
    ap.add_argument('--real')
    ap.add_argument('--steps', type=int, default=1500)
    ap.add_argument('--batch', type=int, default=8)
    ap.add_argument('--size', type=int, default=256)
    ap.add_argument('--lr', type=float, default=2e-3)
    ap.add_argument('--threads', type=int, default=2)
    a = ap.parse_args()
    {'train': train, 'eval': evaluate, 'export': export}[a.cmd](a)


if __name__ == '__main__':
    main()
