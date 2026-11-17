#!/usr/bin/env python3
"""v3.54.5 — the comparison of the confirmation: the house the NEW path delivers against the house the BASE path
delivers, feature by feature, by a rule frozen before any confirmation house was run (PROTOCOL_V3545.md §6).

  compare.py --detail <score-detail json> --base <run name> --new <run name> --hist-base <v3544 score json> --hist-new <v3544 score json> --out <md>

Features. Binary (PASS / FAIL / not assessable): EXTENTS, HEIGHT (detailed scorer); ROOF, GARAGE, DORMERS (the historical
scorer's groups). Counted: SIDES_BUILT (published sides with at least half their reference openings matched; a blind
side with nothing built on it), OPENINGS_OK (reference openings matched on the right side and storey with position and
size within tolerance), FALSE (holes with no reference opening).
  gain  = a binary feature FAIL→PASS (or no model → PASS), SIDES_BUILT +1 or more, OPENINGS_OK +2 or more
  loss  = a binary feature PASS→FAIL, SIDES_BUILT −1 or more, OPENINGS_OK −2 or more, FALSE +2 or more
  IMPROVED            = at least one gain and no loss
  CRITICAL REGRESSION = EXTENTS, HEIGHT, ROOF or GARAGE PASS→FAIL
"""
import json, sys
def arg(n):
    return sys.argv[sys.argv.index('--' + n) + 1] if '--' + n in sys.argv else None
D = json.load(open(arg('detail')))
HB = {r['house']: r for r in json.load(open(arg('hist-base')))['rows']} if arg('hist-base') else {}
HN = {r['house']: r for r in json.load(open(arg('hist-new')))['rows']} if arg('hist-new') else {}
base, new = arg('base'), arg('new')
def hist(row, g):
    if not row: return None
    v = ((row.get('final') or row.get('h') or {}).get('groups') or {}).get(g)
    v = v.get('verdict') if isinstance(v, dict) else v
    return True if v == 'PASS' else False if v == 'FAIL' else None
def feats(x, hrow):
    if not x or not x.get('model'): return None
    o = x['openings']
    return {'EXTENTS': (x.get('extents') or {}).get('ok'), 'HEIGHT': (x.get('height') or {}).get('ok'), 'ROOF': hist(hrow, 'ROOF'), 'GARAGE': hist(hrow, 'GARAGE'), 'DORMERS': hist(hrow, 'DORMERS'),
            'SIDES_BUILT': x.get('sidesBuilt', 0), 'OPENINGS_OK': o['ok'], 'FALSE': o['false'], 'MATCHED': o['matched'], 'REFERENCE': o['reference'], 'SIDES_PUBLISHED': x.get('sidesPublished')}
BIN = ['EXTENTS', 'HEIGHT', 'ROOF', 'GARAGE', 'DORMERS']
CRIT = ['EXTENTS', 'HEIGHT', 'ROOF', 'GARAGE']
rows = []
for house, runs in D['houses'].items():
    b = feats(runs.get(base), HB.get(house)); n = feats(runs.get(new), HN.get(house))
    gains, losses, crit = [], [], []
    if n is None:
        verdict = 'NO_MODEL' if b is None else 'LOST_MODEL'
        if b is not None: losses.append('model'); crit.append('model')
    elif b is None:
        gains = [k for k in BIN if n[k] is True] + (['SIDES_BUILT'] if n['SIDES_BUILT'] > 0 else []) + (['OPENINGS_OK'] if n['OPENINGS_OK'] >= 2 else [])
        verdict = 'IMPROVED' if n['EXTENTS'] is not False and gains else 'NOT_IMPROVED'
    else:
        for k in BIN:
            if b[k] is False and n[k] is True: gains.append(k)
            if b[k] is True and n[k] is False:
                losses.append(k)
                if k in CRIT: crit.append(k)
        if n['SIDES_BUILT'] - b['SIDES_BUILT'] >= 1: gains.append(f"SIDES_BUILT {b['SIDES_BUILT']}→{n['SIDES_BUILT']}")
        if n['SIDES_BUILT'] - b['SIDES_BUILT'] <= -1: losses.append(f"SIDES_BUILT {b['SIDES_BUILT']}→{n['SIDES_BUILT']}")
        if n['OPENINGS_OK'] - b['OPENINGS_OK'] >= 2: gains.append(f"OPENINGS_OK {b['OPENINGS_OK']}→{n['OPENINGS_OK']}")
        if n['OPENINGS_OK'] - b['OPENINGS_OK'] <= -2: losses.append(f"OPENINGS_OK {b['OPENINGS_OK']}→{n['OPENINGS_OK']}")
        if n['FALSE'] - b['FALSE'] >= 2: losses.append(f"FALSE {b['FALSE']}→{n['FALSE']}")
        verdict = 'IMPROVED' if gains and not losses else 'WORSE' if losses and not gains else 'MIXED' if gains and losses else 'SAME'
    rows.append({'house': house, 'base': b, 'new': n, 'gains': gains, 'losses': losses, 'critical': crit, 'verdict': verdict})
f = lambda v: 'tak' if v is True else 'NIE' if v is False else 'n/o'
cell = lambda x: 'brak modelu' if x is None else f"obrys {f(x['EXTENTS'])}, wys. {f(x['HEIGHT'])}, dach {f(x['ROOF'])}, garaż {f(x['GARAGE'])}, lukarny {f(x['DORMERS'])}, strony {x['SIDES_BUILT']}/{x['SIDES_PUBLISHED']}, otwory ok {x['OPENINGS_OK']} (dopas. {x['MATCHED']}/{x['REFERENCE']}, fałsz. {x['FALSE']})"
out = [f"| dom | {base} | {new} | zyski | straty | werdykt |", '|---|---|---|---|---|---|']
for r in rows:
    out.append(f"| {r['house']} | {cell(r['base'])} | {cell(r['new'])} | {'; '.join(r['gains']) or '—'} | {'; '.join(r['losses']) or '—'} | {r['verdict']}{' + REGRESJA KRYTYCZNA' if r['critical'] else ''} |")
imp = [r for r in rows if r['verdict'] == 'IMPROVED']
out.append('')
out.append(f"Poprawione: {len(imp)} z {len(rows)}; regresje krytyczne: {sum(1 for r in rows if r['critical'])}; pogorszone: {sum(1 for r in rows if r['verdict'] == 'WORSE')}; mieszane: {sum(1 for r in rows if r['verdict'] == 'MIXED')}; bez zmiany: {sum(1 for r in rows if r['verdict'] == 'SAME')}.")
open(arg('out'), 'w').write('\n'.join(out) + '\n')
json.dump(rows, open(arg('out') + '.json', 'w'), indent=1)
print('\n'.join(out[-1:]))
for r in rows: print(r['house'][:32].ljust(32), r['verdict'], '| gains', r['gains'], '| losses', r['losses'])
