"""IU-01 set-level checks over the images of ONE project, after each image was classified on its own.

Every check reports; none edits an image's class. What a check cannot establish without segmentation (IU-02) is
returned as NOT_MEASURED with the reason, not approximated.
"""
from collections import defaultdict
import numpy as np
from PIL import Image, ImageOps

def dhash(im: Image.Image, n=8) -> int:
    g = ImageOps.grayscale(im).resize((n + 1, n), Image.BILINEAR)
    a = np.asarray(g, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return int(''.join('1' if b else '0' for b in bits), 2)

def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count('1')

def copy_groups(items):
    """items: [{id, dhash, aspect, size}] -> groups of the same picture (dHash <= 6 and aspect within 5 %)."""
    parent = {i['id']: i['id'] for i in items}
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for i, a in enumerate(items):
        for b in items[i + 1:]:
            if hamming(a['dhash'], b['dhash']) <= 6 and abs(a['aspect'] / b['aspect'] - 1) <= 0.05:
                parent[find(a['id'])] = find(b['id'])
    g = defaultdict(list)
    for i in items:
        g[find(i['id'])].append(i)
    return [sorted(v, key=lambda x: -x['size'][0] * x['size'][1]) for v in g.values() if len(v) > 1]

def check_project(records, images, embed_fn=None):
    """records: per-image decisions of one project (from the classifier); images: id -> PIL image.

    embed_fn(PIL list) -> L2-normalised embeddings, used for the mirror test; optional.
    """
    out = {'images': len(records)}
    items = [{'id': r['imageId'], 'dhash': dhash(images[r['imageId']]), 'aspect': images[r['imageId']].size[0] / images[r['imageId']].size[1], 'size': images[r['imageId']].size} for r in records]
    groups = copy_groups(items)
    cls = {r['imageId']: r for r in records}
    out['copyGroups'] = [{'members': [g['id'] for g in grp], 'sizes': [list(g['size']) for g in grp],
                          'classes': sorted({cls[g['id']]['predicted'] + ':' + cls[g['id']]['decision'] for g in grp}),
                          'consistent': len({cls[g['id']]['predicted'] for g in grp}) == 1} for grp in groups]
    # several plans: same drawing at several resolutions vs genuinely different plan variants (dimensioned / area)
    plans = [r for r in records if r['predicted'] == 'FLOOR_PLAN' and r['decision'] in ('ACCEPT', 'REVIEW')]
    in_group = {m for grp in groups for m in [g['id'] for g in grp]}
    out['plans'] = {'count': len(plans), 'inCopyGroups': sum(1 for p in plans if p['imageId'] in in_group),
                    'annotationVariants': sorted({p.get('planAnnotation', 'UNKNOWN') for p in plans})}
    elev = [r for r in records if r['predicted'] == 'ORTHOGRAPHIC_ELEVATION' and r['decision'] == 'ACCEPT']
    distinct = {}
    for e in elev:  # one per copy group
        key = next((grp[0]['id'] for grp in groups if e['imageId'] in [g['id'] for g in grp]), e['imageId'])
        distinct.setdefault(key, e)
    out['elevations'] = {'accepted': len(elev), 'distinctViews': len(distinct),
                         'missingViewsIfFourExpected': max(0, 4 - len(distinct)),
                         'note': 'missing views are reported, never created; fewer than four is not a reason to reject'}
    # perspective images the publisher filed as elevations
    out['perspectiveInElevationSlot'] = [r['imageId'] for r in records if (r.get('metadataEvidence') or {}).get('document') == 'ELEVATION' and r['predicted'] in ('EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE')]
    # mirror test: a pair of elevations that are (near) mirror images of each other cannot be told apart as
    # left/right from pixels; if the publisher labels both sides identically, the side stays UNKNOWN
    mirror = []
    if embed_fn and len(distinct) >= 2:
        ids = list(distinct)
        ims = [images[i] for i in ids]
        E = embed_fn(ims); M = embed_fn([ImageOps.mirror(i) for i in ims])
        for a in range(len(ids)):
            for b in range(a + 1, len(ids)):
                direct, mirrored = float(E[a] @ E[b]), float(E[a] @ M[b])
                if mirrored >= 0.9:
                    mirror.append({'pair': [ids[a], ids[b]], 'similarity': round(direct, 3), 'mirroredSimilarity': round(mirrored, 3),
                                   'meaning': 'one is (close to) the mirror image of the other — a swap of these two sides would not be visible in the pixels, so their sides need a label or the plan, never a guess'})
    out['mirrorPairs'] = mirror
    # same building across elevations: needs the facade silhouette, which is IU-02's segmentation
    out['sameBuildingAcrossElevations'] = {'status': 'NOT_MEASURED', 'why': 'needs a building mask separated from sky and trees (IU-02); an embedding similarity is not evidence of one building'}
    out['contourMatchesPlan'] = {'status': 'NOT_MEASURED', 'why': 'needs the elevation silhouette width in metres and the plan footprint; both require IU-02 segmentation and the existing metric layer'}
    return out
