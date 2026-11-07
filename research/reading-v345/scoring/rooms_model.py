# v3.45: room numbering in the emitted models (a proxy, not an annotation): how many rooms carry a number, and how many of
# those agree with the published area of the room that number names (within 15 %; over 40 % the label is withheld).
# The published areas are the publisher's text, independent of the image reading; they check, they never choose.
# usage: rooms_model.py <runs-dir> [<runs-dir> ...]  -> per house and totals, one line per run dir
import json, os, re, sys
NUM = re.compile(r'numbered (\d{1,2})(?: from an upright reading[^=]*)? = (.+?) ([\d.]+) m² published \((-?\d+) % off\)')
for runs in sys.argv[1:]:
    tot = {'houses': 0, 'rooms': 0, 'numbered': 0, 'agree15': 0, 'off40': 0}
    per = {}
    for h in sorted(os.listdir(runs)):
        f = os.path.join(runs, h, 'model.json')
        if not os.path.isfile(f): continue
        rooms = json.load(open(f)).get('rooms', [])
        n = a = o = 0
        for r in rooms:
            m = NUM.search(json.dumps(r.get('evidence', {}), ensure_ascii=False))
            if not m: continue
            n += 1; off = abs(int(m.group(4)))
            a += off <= 15; o += off > 40
        per[h] = (len(rooms), n, a, o)
        tot['houses'] += 1; tot['rooms'] += len(rooms); tot['numbered'] += n; tot['agree15'] += a; tot['off40'] += o
    print(runs, json.dumps(tot))
    for h, v in per.items(): print('  ', h[:40].ljust(40), 'rooms %d numbered %d agree15 %d off40 %d' % v)
