"""Runner lists from the committed index: python3 -I lists.py <cache dir> <pilot|s30|c12|final> > list.txt
Each line: "<house> <source-package.json> <cache dir>" (the format live-describe.ts reads)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
cache, which = sys.argv[1], sys.argv[2]
PILOT = ['projekt-dom-w-toreniach-3-e-me822857280738', 'lipinscy-pl-2', 'houseplans-com-2', 'domoweklimaty-pl-1']
C12 = PILOT + ['projekt-dom-w-nigellach-4-g2-ma7d265be828f4', 'fresh-piwonie-3-g', 'fresh-saponarie-g2e', 'fresh-sa-awans-ii',
               'fresh-sa-amber-xi', 'architecturaldesigns-com-2', 'extradom-pl-2', 'dobredomy-pl-2']
rows = json.load(open(os.path.join(HERE, 'sources', 'INDEX.json')))
pick = {'pilot': lambda r: r['house'] in PILOT, 'c12': lambda r: r['house'] in C12,
        's30': lambda r: r['set'] == 'S30', 'final': lambda r: r['set'] == 'FINAL12'}[which]
chosen = [r for r in rows if pick(r)]
if which in ('pilot', 'c12'):
    order = PILOT if which == 'pilot' else C12
    chosen.sort(key=lambda r: order.index(r['house']))
for r in chosen:
    print(r['house'], os.path.join(HERE, 'sources', r['house'] + '.source-package.json'), cache)
