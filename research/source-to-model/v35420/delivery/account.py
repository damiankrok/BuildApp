#!/usr/bin/env python3
"""v3.54.20 — the accounting tables of PROTOCOL §2.3–2.5 from the run directories (no grader, no hand-copied numbers).
  account.py <manifest.json> <form-facts.json> <form reference json>... [--json=<out>]
form-facts.json is `form-facts.ts` over every variant's run dir. Prints Markdown:
  A. the form of each delivered model against the four reference facts (bodies under their own roof, the main roof's
     kind, the ridge's direction, full storeys) — per variant;
  B. the data applied (final code): taken structure properties found in the model, exterior openings standing as bound;
  C. counts lower in the final code than in the baseline (interior walls, exterior openings, roof windows, chimneys)."""
import json, sys
args = [a for a in sys.argv[1:] if not a.startswith('--json=')]
out_json = next((a[7:] for a in sys.argv[1:] if a.startswith('--json=')), None)
man = json.load(open(args[0]))
ff = {r['run']: r for r in json.load(open(args[1]))}
ref = {}
for p in args[2:]: ref.update({k: v for k, v in json.load(open(p)).items() if k != '_'})
RIDGE = {'X': 'FRONT', 'Z': 'SIDE'}
PL = {'GABLE': 'dwuspadowy', 'HIP': 'czterospadowy', 'FLAT': 'płaski', 'NONE': 'brak dachu', 'FRONT': 'równoległa do frontu', 'SIDE': 'prostopadła do frontu', None: '—'}
def facts(r, want):
    """four verdicts: True / False / None (the source does not settle it)"""
    if not r or not r.get('model'): return None
    v = {}
    v['bodies'] = r['bodies'] in want['bodies']
    v['roof'] = r.get('mainRoof') == want['roof']
    v['ridge'] = None if want['ridge'] is None else (RIDGE.get(r.get('mainRidge')) == want['ridge'])
    v['storeys'] = r.get('fullStoreys') == want['storeys']
    return v
def cell(r, v):
    if not r: return 'nie uruchomiono'
    if not r.get('model'): return '**BRAK MODELU**'
    m = lambda k: '—' if v[k] is None else ('✓' if v[k] else '✗')
    top = r.get('mainWallTopM')
    return f"brył {r['bodies']} {m('bodies')}; {PL.get(r.get('mainRoof'), r.get('mainRoof'))} {m('roof')}; kalenica {PL.get(RIDGE.get(r.get('mainRidge')))} {m('ridge')}; ściany do {top if top is None else format(top, '.2f')} m = {r.get('fullStoreys')} kond. {m('storeys')}"
ok4 = lambda v: bool(v) and all(x is not False for x in v.values())
keys = []
for h in man['houses']:
    for x in h['variants']:
        if x['key'] not in keys: keys.append(x['key'])
LAB = {'baseline1352': 'Kod 1352 (baseline)', 'final': 'Kod końcowy', 'finalOnBase': 'Kod końcowy na odczytach biegu baseline (F@B)'}
print('### A. Forma oddanego modelu wobec czterech faktów ze źródeł\n')
print('| Dom | Zbiór | Źródło: bryły / dach / kalenica / kondygnacje | ' + ' | '.join(LAB.get(k, k) for k in keys) + ' |')
print('|---|---|---|' + '---|' * len(keys))
tot, rows = {}, []
for h in man['houses']:
    w = ref.get(h['house'])
    if not w: continue
    vs = {x['key']: ff.get(x['run']) for x in h['variants']}
    fs = {k: facts(vs.get(k), w) for k in keys}
    print(f"| {h['title']} | {h['set']} | {'/'.join(map(str, w['bodies']))} / {PL[w['roof']]} / {PL[w['ridge']]} / {w['storeys']} | " + ' | '.join((cell(vs.get(k), fs[k]) + (' **4/4**' if ok4(fs[k]) else '')) if k in vs else '—' for k in keys) + ' |')
    t = tot.setdefault(h['set'], {'n': 0, **{k: 0 for k in keys}, **{k + ':model': 0 for k in keys}})
    t['n'] += 1
    for k in keys: t[k] += ok4(fs[k]); t[k + ':model'] += bool(vs.get(k) and vs[k].get('model'))
    rows.append({'house': h['house'], 'set': h['set'], 'facts': fs, 'ok4': {k: ok4(fs[k]) for k in keys}})
print('\n| Zbiór | Domów | ' + ' | '.join(f'{LAB.get(k, k)}: forma zgodna 4/4 (modeli)' for k in keys) + ' |')
print('|---|---|' + '---|' * len(keys))
for s, t in tot.items(): print(f"| {s} | {t['n']} | " + ' | '.join(f"{t[k]} ({t[k + ':model']})" for k in keys) + ' |')
print('\n### B. Zastosowanie danych w kodzie końcowym (odczyt zwrotny z oddanego modelu)\n')
print('| Dom | Zbiór | Stan własności odczytu struktury | Przyjęte własności struktury w modelu | Otwory zewn.: zbudowane / związane / zgodne ≤ 5 mm / różne / błąd sumy / poza ścianą |')
print('|---|---|---|---|---|')
agg = {}
for h in man['houses']:
    v = {x['key']: x for x in h['variants']}
    r = ff.get(v['final']['run']) if 'final' in v else None
    if not r or not r.get('model'):
        print(f"| {h['title']} | {h['set']} | — | — | {'BRAK MODELU' if r else 'nie uruchomiono'} |"); continue
    st = r.get('standings') or {}
    sts = ', '.join(f"{k} {s}" for k, s in st.items()) or 'odczytu nie było'
    ch = r.get('structureChecks') or []
    okc = sum(1 for c in ch if c['agrees'])
    bad = '; '.join(f"{c['property']}: przyjęto {c['taken']}, zbudowano {c['built']}" for c in ch if not c['agrees'])
    oc = r.get('openingCounts') or {}
    print(f"| {h['title']} | {h['set']} | {sts} | {okc}/{len(ch)}{(' — ' + bad) if bad else ''} | {oc.get('built', '—')} / {oc.get('bound', '—')} / {oc.get('agree', '—')} / {oc.get('differ', '—')} / {oc.get('sumFailures', '—')} / {oc.get('outsideWall', '—')} |")
    a = agg.setdefault(h['set'], {'ok': 0, 'all': 0, 'built': 0, 'agree': 0, 'differ': 0, 'unbound': 0, 'sum': 0, 'out': 0})
    a['ok'] += okc; a['all'] += len(ch)
    for k, q in (('built', 'built'), ('agree', 'agree'), ('differ', 'differ'), ('unbound', 'unbound'), ('sum', 'sumFailures'), ('out', 'outsideWall')): a[k] += oc.get(q, 0)
print('\n| Zbiór | Własności struktury w modelu | Otwory zbudowane | zgodne ze związaniem | różne | bez związania | błąd sumy | poza ścianą |')
print('|---|---|---|---|---|---|---|---|')
for s, a in agg.items(): print(f"| {s} | {a['ok']}/{a['all']} ({(100 * a['ok'] / a['all']) if a['all'] else 0:.0f} %) | {a['built']} | {a['agree']} | {a['differ']} | {a['unbound']} | {a['sum']} | {a['out']} |")
print('\n### C. Liczby niższe w kodzie końcowym niż w baseline\n')
print('| Dom | Zbiór | Ściany wewn. | Otwory zewn. | Okna połaciowe | Kominy | Niższe |')
print('|---|---|---|---|---|---|---|')
losses = []
for h in man['houses']:
    v = {x['key']: x for x in h['variants']}
    if 'final' not in v or 'baseline1352' not in v: continue
    b, f = ff.get(v['baseline1352']['run']), ff.get(v['final']['run'])
    if not b or not f: continue
    if not b.get('model') and not f.get('model'): print(f"| {h['title']} | {h['set']} | — | — | — | — | brak modelu w obu |"); continue
    if not f.get('model'): print(f"| {h['title']} | {h['set']} | — | — | — | — | **MODEL UTRACONY** |"); losses.append({'house': h['house'], 'lost': ['MODEL']}); continue
    if not b.get('model'): print(f"| {h['title']} | {h['set']} | — → {f['counts']['interiorWalls']} | — → {f['counts']['exteriorOpenings']} | — → {f['counts']['roofWindows']} | — → {f['counts']['chimneys']} | (baseline bez modelu) |"); continue
    ks = ('interiorWalls', 'exteriorOpenings', 'roofWindows', 'chimneys')
    low = [k for k in ks if f['counts'][k] < b['counts'][k]]
    print(f"| {h['title']} | {h['set']} | " + ' | '.join(f"{b['counts'][k]} → {f['counts'][k]}" for k in ks) + f" | {', '.join(low) or '—'} |")
    if low: losses.append({'house': h['house'], 'lost': low})
if out_json: json.dump({'form': rows, 'totals': tot, 'applied': agg, 'losses': losses}, open(out_json, 'w'), indent=1, ensure_ascii=False, default=str)
