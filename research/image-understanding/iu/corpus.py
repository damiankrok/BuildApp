"""IU-01 corpus: the 005R ARCHON asset manifest (hashes only), the IU-01 visual labels, and a PROJECT-level split.

Split unit = publisher family (all editions, resolutions and re-publications of one house; the 005R manifest already
merges byte-identical copies and editions into one family). The rule is fixed before any model is run:
  * the Rarytasy family (17 editions, 426 assets) goes to TRAIN, because it is the OWNER's development family and
    every previous stage has looked at it — it can never be an honest test;
  * every other family: d = int(sha256("IU01-split-v1:" + family)[:8], 16) % 10; d<5 TRAIN, d<7 VAL, else TEST.
No image of one family can be in two parts.
"""
import hashlib, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.realpath(os.path.join(HERE, '..', '..', '..'))
MANIFEST_005R = os.path.join(REPO, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')
LABELS = os.path.join(HERE, '..', 'data', 'labels-archon.json')
COMMONS_LABELS = os.path.join(HERE, '..', 'data', 'labels-commons.json')
FORCED_TRAIN = {'archon:dom-w-rarytasach'}

def split_of(family: str) -> str:
    if family in FORCED_TRAIN:
        return 'TRAIN'
    d = int(hashlib.sha256(f'IU01-split-v1:{family}'.encode()).hexdigest()[:8], 16) % 10
    return 'TRAIN' if d < 5 else 'VAL' if d < 7 else 'TEST'

def load_archon(image_dir: str):
    """Rows with label, split and local path. Images live outside the repository; a missing file is reported, not skipped silently."""
    man = {a['variantSha256']: a for a in json.load(open(MANIFEST_005R))['assets']}
    labels = json.load(open(LABELS))['rows']
    files = {f.split('.')[0]: f for f in os.listdir(image_dir)} if os.path.isdir(image_dir) else {}
    rows = []
    for l in labels:
        a = man[l['sha256']]
        rows.append({**l, 'source': 'archon', 'project': a['family'], 'split': split_of(a['family']), 'width': a['width'],
                     'height': a['height'], 'lineageGroup': a['lineageGroup'], 'assetId': a['assetId'],
                     'path': os.path.join(image_dir, files[l['sha256']]) if l['sha256'] in files else None})
    return rows

def load_commons(image_dir: str):
    """Out-of-distribution rows (Wikimedia Commons, free licences): TEST_OOD only, never trained or tuned on."""
    if not os.path.exists(COMMONS_LABELS):
        return []
    rows = []
    for l in json.load(open(COMMONS_LABELS))['rows']:
        p = os.path.join(image_dir, l['file'])
        rows.append({**l, 'source': 'commons', 'project': 'commons:' + l['sha256'][:12], 'split': 'TEST_OOD', 'path': p if os.path.exists(p) else None})
    return rows

SYNTH_005R_CLASS = {'site': 'SITE_PLAN', 'section': 'TECHNICAL_SECTION', 'plan': 'FLOOR_PLAN', 'interior': 'INTERIOR_PERSPECTIVE',
                    'detail': 'ARCHITECTURAL_DETAIL', 'render': 'EXTERIOR_PERSPECTIVE', 'elev': 'ORTHOGRAPHIC_ELEVATION'}

def load_synth005r(image_dir: str):
    """The 005R synthetic corpus (research/analyzer-005r/synth.py, seed 5005): flat-shaded elevations close to the
    simplified drawings OWNER showed, plans, sections, site plans, perspective renders, interiors and two details.
    Truth by construction (file name), spot-checked visually. TEST_OOD only; project = synthetic house (f01..f12)."""
    import re
    if not os.path.isdir(image_dir):
        return []
    rows = []
    for f in sorted(os.listdir(image_dir)):
        m = re.match(r'synthetic-(f\d+)-(e\d+)-([a-z]+)', f)
        if not m:
            continue
        rows.append({'sha256': hashlib.sha256(open(os.path.join(image_dir, f), 'rb').read()).hexdigest(), 'file': f, 'label': SYNTH_005R_CLASS[m.group(3)],
                     'source': 'synth005r', 'project': f'synth005r:{m.group(1)}', 'split': 'TEST_OOD_SYNTH', 'path': os.path.join(image_dir, f),
                     'mirrored': 'mirror' in f, 'crop': 'crop' in f or 'half' in f, 'labelStatus': 'BY_CONSTRUCTION'})
    return rows
