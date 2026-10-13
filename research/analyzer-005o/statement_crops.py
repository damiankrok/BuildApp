#!/usr/bin/env python3
"""statement_crops.py - BUILDPLAN-ANALYZER-005O (RESEARCH ONLY; never imported by production).

  python3 -I research/analyzer-005o/statement_crops.py --cases research/analyzer-005o/cases.json --work /home/user/work005o

For every dimension STATEMENT the incumbent's plan resolution reads (a LINEAR_DIMENSION metric evidence item with
origin READ or CHAIN_CORRECTED, one OCR token), cut the token's box out of the sealed raster it was read from, upright,
and write it OUTSIDE the repository (<work>/labels/crops/<statement key>.png) with a manifest of hashes. These crops
are publisher pixels: they are never committed. The manifest the repository may keep holds only ids, boxes and hashes.

The raster is found by the evidence's variantByteHash (SHA-256 of the cached bytes), never by URL or house name.
"""
import argparse, hashlib, json, os, sys
from PIL import Image

ROT = {'HORIZONTAL': 0, 'ROTATED_CW': -90, 'ROTATED_CCW': 90, 'INVERTED': 180}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def byte_index(cache_dirs, index_path):
    idx = json.load(open(index_path)) if os.path.exists(index_path) else {}
    for d in sorted(set(cache_dirs)):
        if not os.path.isdir(d):
            continue
        for n in sorted(os.listdir(d)):
            if n.endswith('.bin'):
                p = os.path.join(d, n)
                if p not in idx.values():
                    idx.setdefault(sha256(p), p)
    json.dump(idx, open(index_path, 'w'), indent=0, sort_keys=True)
    return idx


def statements(metrics):
    toks = {t['id']: t for t in metrics['ocrTokens']}
    out = []
    for e in metrics['evidence']:
        if e['kind'] != 'LINEAR_DIMENSION' or e['origin'] not in ('READ', 'CHAIN_CORRECTED') or len(e['ocrTokenIds']) != 1:
            continue
        t = toks.get(e['ocrTokenIds'][0])
        if t:
            out.append((e, t))
    return out


def refuse_inside_repo(path):
    """Publisher pixels and rendered pages never land in the repository (post-review LMP-4): refuse an output there."""
    repo = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
    real = os.path.realpath(path)
    if real == repo or real.startswith(repo + os.sep):
        sys.exit(f'refusing to write pixels inside the repository: {real}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cases', required=True)
    ap.add_argument('--work', required=True)
    a = ap.parse_args()
    refuse_inside_repo(a.work)
    cases = json.load(open(a.cases))['cases']
    os.makedirs(os.path.join(a.work, 'labels', 'crops'), exist_ok=True)
    idx = byte_index([c['cache'] for c in cases], os.path.join(a.work, 'byte-index.json'))
    manifest = []
    seen_metrics = {}
    for c in cases:
        mpath = c['metrics']
        mh = sha256(mpath)
        if mh in seen_metrics:  # the same sealed evidence under two rows (kosacce-clean / -tracked): one set of crops
            manifest.append({'case': c['case'], 'sameEvidenceAs': seen_metrics[mh]})
            continue
        seen_metrics[mh] = c['case']
        m = json.load(open(mpath))
        for e, t in statements(m):
            src = idx.get(e['variantByteHash'])
            key = f"{c['case']}__{e['id']}"
            rec = {'case': c['case'], 'family': c['family'], 'evidenceId': e['id'], 'frameId': e['frameId'], 'tokenId': t['id'], 'orientation': t.get('orientation', 'UNRECORDED'), 'box': t['box'], 'variantByteHash': e['variantByteHash'], 'key': key}
            if not src:
                rec['crop'] = 'RASTER_MISSING'
                manifest.append(rec)
                continue
            im = Image.open(src).convert('L')
            b = t['box']
            pad = max(3, round(0.35 * min(b['y1'] - b['y0'], b['x1'] - b['x0'])))
            crop = im.crop((int(b['x0']) - pad, int(b['y0']) - pad, int(round(b['x1'])) + pad, int(round(b['y1'])) + pad)).rotate(ROT.get(t.get('orientation'), 0), expand=True, fillcolor=255)
            out = os.path.join(a.work, 'labels', 'crops', key + '.png')
            crop.save(out)
            rec['crop'] = sha256(out)
            rec['size'] = list(crop.size)
            manifest.append(rec)
    json.dump({'schema': 'buildapp.005o.statement-crops', 'version': 1, 'crops': manifest}, open(os.path.join(a.work, 'labels', 'manifest.json'), 'w'), indent=1, sort_keys=True)
    print(f"{sum(1 for r in manifest if r.get('crop') not in (None, 'RASTER_MISSING'))} crops, {sum(1 for r in manifest if r.get('crop') == 'RASTER_MISSING')} missing rasters")


if __name__ == '__main__':
    sys.exit(main())
