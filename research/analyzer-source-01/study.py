"""SOURCE-01 (research): image-content classifier study on DEV only (grouped 5-fold by house family).
Candidates: A = hand-made pixel features (portable to TypeScript, no weights); B = frozen ImageNet trunks
(timm, Apache-2.0) + logistic regression. Writes embeddings/features to $WORK (outside the repository).
  $PY research/analyzer-source-01/study.py <dataset.json> <work-dir> [trunk ...]"""
import json, sys, os, time
import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

ds = json.load(open(sys.argv[1]))['rows']; work = sys.argv[2]; trunks = sys.argv[3:] or ['handmade']
CLASSES = ['FLOOR_PLAN', 'ORTHOGRAPHIC_ELEVATION', 'TECHNICAL_SECTION', 'SITE_PLAN', 'EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE']

def handmade(im):
    """The feature vector features.ts computes; keep the two in step (the parity test compares them)."""
    im = im.convert('RGB'); w, h = im.size; s = 192 / max(w, h)
    im = im.resize((max(8, round(w * s)), max(8, round(h * s))), Image.BILINEAR)
    a = np.asarray(im).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0); lum = 0.299 * r + 0.587 * g + 0.114 * b
    hue = np.zeros_like(mx); d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    col = sat > 0.25
    H = a.shape[0]; top = slice(0, H // 3); bot = slice(2 * H // 3, H)
    white = (mn > 0.92); dark = (mx < 0.25)
    green = col & (hue >= 70) & (hue < 170); blue = col & (hue >= 180) & (hue < 250); warm = col & ((hue < 50) | (hue >= 330))
    redink = (r > 0.6) & (g < 0.4) & (b < 0.4)
    gy, gx = np.gradient(lum); mag = np.hypot(gx, gy); strong = mag > 0.08
    ang = (np.degrees(np.arctan2(gy, gx)) + 180) % 180
    hv = strong & ((np.abs(ang - 0) < 8) | (np.abs(ang - 180) < 8) | (np.abs(ang - 90) < 8))
    obl = strong & ~((np.abs(ang - 0) < 15) | (np.abs(ang - 180) < 15) | (np.abs(ang - 90) < 15))
    n = float(strong.sum()) + 1
    hist = np.histogram(lum, bins=16, range=(0, 1))[0] / lum.size; ent = -(hist[hist > 0] * np.log2(hist[hist > 0])).sum()
    rg = r - g; yb = 0.5 * (r + g) - b; colorful = np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2)
    return np.array([
        lum.mean(), lum.std(), white.mean(), dark.mean(), sat.mean(), col.mean(), green.mean(), blue.mean(), warm.mean(), redink.mean(),
        white[top].mean(), blue[top].mean(), green[bot].mean(), lum[top].mean(), lum[bot].mean(), sat[top].mean(), sat[bot].mean(),
        strong.mean(), hv.sum() / n, obl.sum() / n, ent, colorful, np.log(w / h), (mx - mn)[strong].mean() if strong.any() else 0,
    ], dtype=np.float32)

def embed(trunk, paths):
    import torch, timm
    m = timm.create_model(trunk, pretrained=True, num_classes=0).eval()
    cfg = timm.data.resolve_data_config({}, model=m); tf = timm.data.create_transform(**cfg)
    out = []
    with torch.no_grad():
        for i in range(0, len(paths), 32):
            x = torch.stack([tf(Image.open(p).convert('RGB')) for p in paths[i:i + 32]])
            out.append(m(x).numpy())
    return np.concatenate(out)

dev = [r for r in ds if r['split'] == 'DEV']
y = np.array([CLASSES.index(r['label']) for r in dev]); groups = np.array([r['family'] for r in dev])
for trunk in trunks:
    cache = os.path.join(work, f'feat-{trunk}.npz')
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=True); feats = dict(zip(z['sha'], z['x']))
    else:
        t = time.time(); paths = [r['path'] for r in ds]
        X = np.stack([handmade(Image.open(p)) for p in paths]) if trunk == 'handmade' else embed(trunk, paths)
        np.savez(cache, sha=np.array([r['sha256'] for r in ds]), x=X); feats = dict(zip([r['sha256'] for r in ds], X))
        print(f'{trunk}: features for {len(paths)} images in {time.time() - t:.0f} s', flush=True)
    X = np.stack([feats[r['sha256']] for r in dev])
    pred = np.zeros(len(y), int); prob = np.zeros((len(y), len(CLASSES)))
    for tr, te in GroupKFold(5).split(X, y, groups):
        clf = make_pipeline(StandardScaler(), LogisticRegression(C=1.0 if trunk == 'handmade' else 0.5, max_iter=4000, class_weight='balanced'))
        clf.fit(X[tr], y[tr]); prob[te] = clf.predict_proba(X[te]); pred[te] = prob[te].argmax(1)
    acc = (pred == y).mean()
    conf = np.zeros((len(CLASSES), len(CLASSES)), int)
    for t, p in zip(y, pred): conf[t, p] += 1
    ii = CLASSES.index('INTERIOR_PERSPECTIVE'); ee = CLASSES.index('EXTERIOR_PERSPECTIVE')
    print(f'== {trunk}: DEV grouped-CV accuracy {acc:.3f} ({(pred != y).sum()} errors / {len(y)}); interior->exterior {conf[ii, ee]}, exterior->interior {conf[ee, ii]}')
    for i, c in enumerate(CLASSES): print('   ', c.ljust(24), ' '.join(f'{v:4d}' for v in conf[i]))
    np.save(os.path.join(work, f'oof-{trunk}.npy'), prob)
