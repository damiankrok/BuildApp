"""IU-03A TEST inputs for iu3/evaluate.py test (written after the freeze; it only assembles rows, it decides nothing).

    $PY iu3/test_inputs.py synth  --dir <test-synth> --tag iu3tsynth --out <dir outside the repo>
    $PY iu3/test_inputs.py archon --runs <dir with t1..tN> --labels data/labels-archon-iu03a.json --images <dir> --tag iu3tarchon --out <dir>

synth:  rows + ADVERSE legacy input (every image captioned "elewacja"); no REAL captions exist for synthetic houses.
archon: rows from the labels, REAL legacy input = the exact roles of the production SourcePackage of each house
        (`legacy_roles.ts` routes them as given), ADVERSE as above.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
from iu2 import data
from iu3.dev_inputs import ADVERSE_URL


def main():
    mode, out, tag = sys.argv[1], arg_value('--out'), arg_value('--tag')
    refuse_inside_repo(out, 'IU-03A test inputs'); os.makedirs(out, exist_ok=True)
    real = []
    if mode == 'synth':
        rows = [dict(r, set='TEST_SYNTH') for r in data.synth(arg_value('--dir'), 'TEST', tag)]
    else:
        labels = json.load(open(arg_value('--labels')))['rows']
        rows = [data._row(key=l['sha256'], tag=tag, source='ARCHON', split='TEST', project=l['project'], label=l['label'], multiView=l.get('multiView', False),
                          hard=l.get('hard', False), path=os.path.join(arg_value('--images'), l['file']), set='TEST_ARCHON') for l in labels]
        roles = {}
        for h in sorted(os.listdir(arg_value('--runs'))):
            p = os.path.join(arg_value('--runs'), h, 'source-package.json')
            if not os.path.exists(p):
                continue
            for a in json.load(open(p))['assets']:
                for v in a['variants']:
                    roles[v['byteHash']] = a['roles']
        for r in rows:
            if r['key'] in roles:
                real.append({'key': r['key'], 'roles': roles[r['key']]})
    adverse = [{'key': r['key'], 'url': ADVERSE_URL.format(h=r['key'][:32].ljust(32, '0'))} for r in rows]
    for name, obj in (('rows', rows), ('legacy-in-real', real), ('legacy-in-adverse', adverse)):
        json.dump(obj, open(os.path.join(out, f'{mode}-{name}.json'), 'w'))
    print(mode, 'rows', len(rows), 'real', len(real))


if __name__ == '__main__':
    main()
