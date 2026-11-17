"""v3.54.4: markdown tables for the report, from run roots (text only; no publisher picture is read).

  /usr/bin/python3 -I tables.py houses <list> <H root> <LOCAL root> [<score json>]   # dom | LOCAL | H | ... | koszt
  /usr/bin/python3 -I tables.py proposals <H root> <list>                             # propozycja | stan | kod | funkcja | skutek
  /usr/bin/python3 -I tables.py transfer <score json>                                 # per wydawca, wszystkie mianowniki
"""
import json, os, sys
from collections import Counter, defaultdict

LEDGER = []
try: LEDGER = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ai-assist', 'spend-ledger-v3544.json')))['entries']
except Exception: pass

def load(p):
    try: return json.load(open(p))
    except Exception: return None

def houses(lst, hroot, lroot, score=None):
    sc = {r['house']: r for r in (load(score) or {}).get('rows', [])} if score else {}
    print('| dom | LOCAL (A1) | H: wymiary × wys. | obrys i metryka | wysokości | dach | otwory zbudowane / odczytane | brakujące (kody) | przyjęty | koszt USD |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for line in open(lst):
        if not line.strip(): continue
        h = line.split()[0]
        s = load(os.path.join(hroot, h, 'summary.json')) or {}
        t = load(os.path.join(hroot, h, 'trace.json')) or {}
        doc = load(os.path.join(hroot, h, 'house.json')) or {}
        lf = load(os.path.join(lroot, h, 'failure.json'))
        lm = os.path.exists(os.path.join(lroot, h, 'model.json'))
        loc = (t.get('local') or {})
        local = f"{loc.get('widthM', 0):.2f} × {loc.get('depthM', 0):.2f} m, szczyt +{(loc.get('topAboveGroundFloorM') or 0):.2f}" if lm and loc else ('model' if lm else f"brak modelu ({(lf or {}).get('reasonCode') or (lf or {}).get('code') or 'odmowa'})")
        checks = t.get('checks', [])
        st = lambda scope: '/'.join(str(sum(1 for c in checks if c['scope'] in scope and c['status'] == x)) for x in ('PASS', 'FAIL'))
        obs = doc.get('observations', {})
        read = sum(len([o for o in e.get('openings', []) if o.get('kind') != 'ROOF_WINDOW']) for e in obs.get('elevations', []))
        c = s.get('counts') or {}
        built = (c.get('windows') or 0) + (c.get('doors') or 0)
        g = doc.get('geometry') or {}
        roofs = ', '.join(f"{b['id']}:{b['roof']['kind']}" for b in g.get('bodies', []))
        held = Counter(x['code'] for x in t.get('held', []))
        # what the campaign ledger booked for this house (every live request, smoke and repeats included)
        cost = sum((e.get('costUsd') or 0) for e in LEDGER if e.get('house') == h)
        dims = f"{s.get('widthM'):.2f} × {s.get('depthM'):.2f} m, {s.get('heightAboveTerrainM')} m n.t." if s.get('widthM') else s.get('status', '—')
        sco = sc.get(h)
        extra = f" · ocena LOCAL {sco['local']['passed']}/{sco['local']['applicable']} → H {sco['described']['passed']}/{sco['described']['applicable']}" if sco else ''
        print(f"| {h} | {local} | {dims} | {st(('METRIC', 'BODIES', 'IDENTITY'))} | {st(('LEVELS',))} | {roofs or '—'} | {built} / {read} | {', '.join(f'{k} {v}' for k, v in held.most_common()) or '—'} | {s.get('accepted', '—')}{extra} | {cost:.3f} |")

def proposals(hroot, lst):
    print('| dom | runda | propozycja | stan | kod | funkcja (konsument) | skutek |')
    print('|---|---|---|---|---|---|---|')
    n = Counter()
    for line in open(lst):
        if not line.strip(): continue
        h = line.split()[0]
        for p in load(os.path.join(hroot, h, 'proposals.json')) or []:
            n[(p['state'], p.get('code') or '')] += 1
            print(f"| {h[-28:]} | {p['round']} | {p['op']} {p['subject']} | {p['state']} | {p.get('code') or '—'} | {p['consumer']} | {p['effect'][:150].replace('|', '/')} |")
    print()
    print('Razem: ' + '; '.join(f'{k[0]} {k[1]}: {v}'.strip() for k, v in sorted(n.items())))

def transfer(score):
    rows = load(score)['rows']
    by = defaultdict(list)
    for r in rows: by[r['publisher']].append(r)
    print('| wydawca | domy | LOCAL bez modelu | przyjęty opis | poprawione | wierne zewnętrze | regresje krytyczne | METRIC | HEIGHT | ROOF | GARAGE | OPENINGS | DORMERS |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    def line(name, rs):
        g = lambda k: f"{sum(1 for r in rs if r['final']['groups'][k] == 'PASS')}/{sum(1 for r in rs if r['final']['groups'][k] != 'NA')}"
        print(f"| {name} | {len(rs)} | {sum(1 for r in rs if not r['localBuilt'])} | {sum(1 for r in rs if r['accepted'] == 'DESCRIBED')} | {sum(1 for r in rs if r['improved'])} | {sum(1 for r in rs if r['faithful'])} | {sum(1 for r in rs if r['criticalRegressions'])} | " + ' | '.join(g(k) for k in ('METRIC', 'HEIGHT', 'ROOF', 'GARAGE', 'OPENINGS', 'DORMERS')) + ' |')
    for p, rs in sorted(by.items()): line(p, rs)
    line('RAZEM', rows)

if __name__ == '__main__':
    {'houses': houses, 'proposals': proposals, 'transfer': transfer}[sys.argv[1]](*sys.argv[2:])
