"""IU-03A: the frozen IU-02 evidence for any row of iu2.data — class probabilities from the frozen head (IU-02 commit
d15abbe, SHA-256 checked), the unmasked projection state (cheap, no segmenter) and, where already computed, the
masked one. Fits nothing."""
import hashlib, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu2 import data
import iu2_train as T

HEAD_SHA = '016556687dff3d791e37028ddeebcd996d1c8a44360ad837e674091f87a77137'


def head():
    meta = json.load(open(os.path.join(data.WORK2, 'model', 'iu02-model.json')))
    path = os.path.join(data.WORK2, 'model', 'iu02-head.npz')
    assert hashlib.sha256(open(path, 'rb').read()).hexdigest() == HEAD_SHA, 'not the frozen IU-02 head'
    return meta, np.load(path)


def evidence(rows):
    """Returns (rows kept, P[n, 8], unmasked states, missing rows). A row without features is reported, never dropped silently."""
    meta, H = head()
    tags = sorted({r['tag'] for r in rows})
    embs = {(t, meta['backbone']): T.load_emb(t, meta['backbone']) for t in tags}
    geos = {t: T.load_geo(t) for t in tags}
    ok = lambda r: r['key'] in embs[(r['tag'], meta['backbone'])] and r['key'] in geos[r['tag']] and 'f' in geos[r['tag']][r['key']]
    keep, missing = [r for r in rows if ok(r)], [r for r in rows if not ok(r)]
    X = T.matrix(keep, meta['features'], meta['backbone'], embs, geos)
    P = T.softmax((X - H['mean']) / H['scale'] @ H['coef'].T + H['intercept'], meta['temperature'])
    unm = [(geos[r['tag']][r['key']]['rec']['projection'] or {}).get('state') for r in keep]
    return keep, P, unm, missing


def masked_cache():
    p = os.path.join(data.WORK2, 'geo', 'masked.json')
    return json.load(open(p)) if os.path.exists(p) else {}
