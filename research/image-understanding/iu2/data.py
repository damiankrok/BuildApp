"""IU-02 datasets, one loader for training and for the final evaluation (so both see the same rows).

Row: key (file stem = embedding/feature key), tag (embedding & feature file), source (style family), split, project
(the unit no split may cross), label (8 classes), multiView, hard, path, routeTruth (True only for a *single*
orthographic elevation — the only thing the facade extractor may receive).

Sources and splits (fixed before any IU-02 model was fitted):
  ARCHON   IU-01 labels; IU-01 TRAIN+VAL families → DEV; IU-01 TEST families → IU01_TEST (reported, never trained on,
           but not unseen: IU-01 was scored on them); fresh houses drawn after the freeze → FINAL.
  SYNTH    iu2/synth3d.py; DEV seed 7101; FINAL seed chosen and generated after the freeze.
  LOC      HABS/HAER/HALS; split by survey hash at fetch time (data/fetch_loc.py) → DEV / FINAL.
  COMMONS  IU-01's 170 Wikimedia Commons images → DEV (they were IU-01's blind set; for IU-02 they are seen).
A multi-view sheet (several drawings, a collage) is labelled OTHER: it is a document to split, not one view.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
CLASSES = ['FLOOR_PLAN', 'ORTHOGRAPHIC_ELEVATION', 'TECHNICAL_SECTION', 'EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE',
           'SITE_PLAN', 'ARCHITECTURAL_DETAIL', 'OTHER']
ELEV = 'ORTHOGRAPHIC_ELEVATION'
WORK1 = os.environ.get('IU_WORK', '/home/user/workiu01')
WORK2 = os.environ.get('IU_WORK2', '/home/user/workiu02')


def _row(**k):
    k['routeTruth'] = k['label'] == ELEV and not k.get('multiView', False)
    return k


def archon(corpus_dir='/home/user/work005r/corpus/images'):
    import sys
    sys.path.insert(0, ROOT)
    from iu.corpus import load_archon
    out = []
    for r in load_archon(corpus_dir):
        if not r['path']:
            continue
        split = {'TRAIN': 'DEV', 'VAL': 'DEV', 'TEST': 'IU01_TEST'}[r['split']]
        out.append(_row(key=r['sha256'], tag='corpus', source='ARCHON', split=split, project=r['project'], label=r['label'],
                        multiView=False, hard=bool(r.get('hard')), path=r['path']))
    return out


def synth(dir_, split, tag):
    man = json.load(open(os.path.join(dir_, 'manifest.json')))['rows']
    return [_row(key=r['id'], tag=tag, source='SYNTH', split=split, project='-'.join(r['id'].split('-')[:2]), label=r['label'],
                 multiView=r['label'] == 'OTHER', hard=r.get('perspectiveKind') == 'NEAR_FRONTAL' or r['label'] == 'TECHNICAL_SECTION',
                 path=os.path.join(dir_, r['file']), style=r.get('style'), kind=r.get('perspectiveKind')) for r in man]


def loc(dir_=os.path.join(WORK2, 'loc')):
    rows = json.load(open(os.path.join(ROOT, 'data', 'labels-loc.json')))['rows']
    return [_row(key=r['sha256'], tag='loc', source='LOC', split=r['split'], project='loc:' + r['survey'],
                 label='OTHER' if r['multiView'] else r['label'], originalLabel=r['label'], multiView=r['multiView'], hard=r['hard'],
                 labelStatus=r['labelStatus'], path=os.path.join(dir_, r['file'])) for r in rows]


def commons(dir_=os.path.join(WORK1, 'commons-img')):
    rows = json.load(open(os.path.join(ROOT, 'data', 'labels-commons.json')))['rows']
    return [_row(key=r['sha256'], tag='commons', source='COMMONS', split='DEV', project='commons:' + r['sha256'][:12],
                 label=r['label'] if r['label'] in CLASSES else 'OTHER', multiView=False, hard=bool(r.get('hard')),
                 labelStatus=r.get('labelStatus'), path=os.path.join(dir_, r['file'])) for r in rows]


def dev_rows():
    return ([r for r in archon() if r['split'] == 'DEV'] + synth(os.path.join(WORK2, 'synth-dev'), 'DEV', 'synthdev')
            + [r for r in loc() if r['split'] == 'DEV'] + commons())
