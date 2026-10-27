"""IU-03B control set inputs (assembles rows, decides nothing). One rows file for the whole control set, with the
LEGACY inputs of both caption scenarios.

    $PY iu3b/control_inputs.py --synth <dir> --neg <dir> --archon-runs <dir> --archon-images <dir> \
        --labels data/labels-archon-iu03b.json --out <dir outside the repo>

ADVERSE: every image published under an ARCHON-shaped address saying "elewacja-frontowa" (LEGACY routes all to the
facade extractor). REAL: the ARCHON images only, with the exact roles of their production SourcePackage.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
if __name__ == '__main__':
    refuse_inside_repo(arg_value('--out', ''), 'IU-03B control inputs')  # before anything heavy is imported
from iu2 import data
from iu3.dev_inputs import ADVERSE_URL


def main():
    out = arg_value('--out'); refuse_inside_repo(out, 'IU-03B control inputs'); os.makedirs(out, exist_ok=True)
    rows = [dict(r, set='CTRL_SYNTH') for r in data.synth(arg_value('--synth'), 'CTRL', 'iu3bsynth')]
    neg = arg_value('--neg')
    for r in json.load(open(os.path.join(neg, 'manifest.json')))['rows']:
        rows.append(data._row(key=r['id'], tag='iu3bneg', source='NEG', split='CTRL', project=r['id'], label=r['label'], multiView=r['label'] == 'OTHER',
                              hard=r['case'] == 'N7_NEAR_FRONTAL', kind='NEAR_FRONTAL' if r['case'] == 'N7_NEAR_FRONTAL' else None, case=r['case'],
                              path=os.path.join(neg, r['file']), set='CTRL_NEG'))
    labels = json.load(open(arg_value('--labels')))['rows']
    rows += [data._row(key=l['sha256'], tag='iu3barchon', source='ARCHON', split='CTRL', project=l['project'], label=l['label'], multiView=l.get('multiView', False),
                       hard=l.get('hard', False), kind='NEAR_FRONTAL' if l.get('nearFrontal') else None, path=os.path.join(arg_value('--archon-images'), l['file']),
                       set='CTRL_ARCHON') for l in labels]
    roles = {}
    runs = arg_value('--archon-runs')
    for h in sorted(os.listdir(runs)):
        p = os.path.join(runs, h, 'source-package.json')
        if os.path.exists(p):
            for a in json.load(open(p))['assets']:
                for v in a['variants']:
                    roles[v['byteHash']] = a['roles']
    real = [{'key': r['key'], 'roles': roles[r['key']]} for r in rows if r['set'] == 'CTRL_ARCHON' and r['key'] in roles]
    adverse = [{'key': r['key'], 'url': ADVERSE_URL.format(h=r['key'][:32].ljust(32, '0'))} for r in rows]
    assert len({r['key'] for r in rows}) == len(rows), 'duplicate keys in the control set'
    for name, obj in (('rows', rows), ('legacy-in-real', real), ('legacy-in-adverse', adverse)):
        json.dump(obj, open(os.path.join(out, f'ctrl-{name}.json'), 'w'))
    from collections import Counter
    print('rows', len(rows), Counter(r['set'] for r in rows), 'real', len(real))


if __name__ == '__main__':
    main()
