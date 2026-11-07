# v3.45 skill 1 pixel-only layer: the content classifier's top class per sheet (result-summary.sources.sheets[].content),
# i.e. the decision the pixels alone would make, independent of the caption. Same annotations, same bytes.
import json, sys, glob, os, collections
ann = json.load(open(sys.argv[1]))['rows']; root = sys.argv[2]
ALIAS = {'przed-1316': 'bakopy', 'przed-1318': 'zefiranty'}
sheets = {}
for p in glob.glob(os.path.join(root, '**', 'result-summary.json'), recursive=True):
    h = os.path.basename(os.path.dirname(p)); h = ALIAS.get(h, h)
    for s in json.load(open(p)).get('sources', {}).get('sheets', []): sheets[(h, s['byteHash'])] = s
MAP = {'EXTERIOR_PERSPECTIVE': 'EXTERIOR_PERSPECTIVE', 'INTERIOR': 'INTERIOR_PERSPECTIVE', 'FLOOR_PLAN': 'FLOOR_PLAN', 'ELEVATION': 'ORTHOGRAPHIC_ELEVATION', 'SECTION': 'TECHNICAL_SECTION', 'SITE_PLAN': 'SITE_PLAN'}
conf = collections.defaultdict(collections.Counter); miss = 0; errs = []
for r in ann:
    s = sheets.get((r['project'], r['sha256']))
    t = r['view']['class']
    if not s or not s.get('content') or 'top' not in s['content']: conf[t]['NOT_CLASSIFIED'] += 1; miss += 1; continue
    p = MAP[s['content']['top']]; conf[t][p] += 1
    if p != t: errs.append((r['project'][:24], r['assetId'][-40:], t, p, s['content'].get('probability')))
tc = sorted(conf)
def f1(c):
    tp = conf[c][c]; fp = sum(conf[t][c] for t in conf if t != c); fn = sum(v for k, v in conf[c].items() if k != c)
    p = tp / (tp + fp) if tp + fp else 0; rc = tp / (tp + fn) if tp + fn else 0
    return tp + fn, p, rc, (2 * p * rc / (p + rc) if p and rc else 0)
res = {c: f1(c) for c in tc}
macro = sum(v[3] for v in res.values()) / len(res)
print('N', sum(sum(v.values()) for v in conf.values()), 'not classified', miss, 'macroF1 %.4f' % macro)
for c in tc: print(' %-24s n=%3d P=%.3f R=%.3f F1=%.3f' % ((c,) + res[c]), dict(conf[c]))
for e in errs: print('  ERR', e)
if len(sys.argv) > 3: json.dump({'macroF1': macro, 'perClass': {c: dict(zip(('n', 'p', 'r', 'f1'), res[c])) for c in tc}, 'confusion': {c: dict(conf[c]) for c in tc}, 'errors': errs, 'notClassified': miss}, open(sys.argv[3], 'w'), indent=1)
