#!/usr/bin/env python3
"""v3.54.19 — the report's tables from the run directories (no hand-copied numbers).
  tables.py <manifest.json> [<gap-coverage.json>] [<exterior-scores.json> <exterior key.json>] [<interior-scores.json> <interior key.json>]
Prints Markdown: per house the baseline 1352 beside the final code — body, roofs, exterior walls, interior walls and
doors, exterior openings, the plan-gap coverage, the review's quality state and the run's cost."""
import json, os, sys
man = json.load(open(sys.argv[1]))
def J(p, d=None):
    try: return json.load(open(p))
    except Exception: return d
gaps = {r['run']: r for r in (J(sys.argv[2], []) if len(sys.argv) > 2 else [])}
def stat(run):
    if not os.path.exists(run + '/result.json'): return None
    r = J(run + '/result.json', {})
    if not os.path.exists(run + '/model.json'): return {'model': False, 'usd': r.get('usd')}
    m = J(run + '/model.json'); m = m.get('model', m)
    ext = {w['id'] for w in m['walls'] if w['kind'] == 'EXTERIOR'}
    arb = (J(run + '/body-arbitration.json', {}) or {}).get('decision')
    ms = J(run + '/massing.json', {}) or {}
    body = 'ze źródeł' if (arb == 'REPLACED_BY_SOURCE_BODY' or (ms.get('decision') == 'BUILT' and arb is None and (ms.get('delivery') or {}).get('delivered'))) else 'LOCAL'
    roofs = ', '.join(f"{'dwusp.' if x['kind'] == 'GABLE' else 'płaski' if x['kind'] == 'FLAT' else x['kind']} {x.get('pitchDeg', '')}°".replace(' 0°', '') for x in m['roofs']) or (f"{len(m['roofPlanes'])} połaci" if m['roofPlanes'] else 'BRAK')
    q = J(run + '/quality.json', {}) or {}
    return {'model': True, 'body': body, 'bodies': len(m.get('wallRings', [])) or None, 'roofs': roofs, 'ext': len(ext), 'int': sum(1 for w in m['walls'] if w['kind'] == 'INTERIOR'), 'idoor': sum(1 for o in m['openings'] if o['wallId'] not in ext), 'extOp': sum(1 for o in m['openings'] if o['wallId'] in ext), 'rw': len(m.get('roofOpenings', [])), 'ch': len(m['chimneys']), 'quality': q.get('state'), 'usd': r.get('usd')}
def cell(s):
    if s is None: return 'nie uruchomiono'
    if not s['model']: return '**BRAK MODELU**'
    return f"{s['body']}; dach: {s['roofs']}; ściany wewn. {s['int']} (drzwi {s['idoor']}); otwory zewn. {s['extOp']}; okna poł. {s['rw']}; kominy {s['ch']}"
print('| Dom | Zbiór | Kod 1352 (baseline) | Kod końcowy | Przerwy rzutu pokryte otworem (1352 → końcowy) |')
print('|---|---|---|---|---|')
tot = {}
for h in man['houses']:
    v = {x['key']: x for x in h['variants']}
    b, f = stat(v['baseline1352']['run']), stat(v['final']['run']) if 'final' in v else None
    gb, gf = gaps.get(v['baseline1352']['run']), gaps.get(v['final']['run']) if 'final' in v else None
    g = lambda r: f"{r['covered']}/{r['gaps']}" + (f" (+{r['onWall']} na pełnej ścianie)" if r.get('onWall') else '') if r and 'gaps' in r else '—'
    print(f"| {h['title']} ({h['publisher']}) | {h['set']} | {cell(b)} | {cell(f)} | {g(gb)} → {g(gf)} |")
    t = tot.setdefault(h['set'], {'n': 0, 'bm': 0, 'fm': 0, 'bi': 0, 'fi': 0})
    t['n'] += 1; t['bm'] += bool(b and b['model']); t['fm'] += bool(f and f['model']); t['bi'] += bool(b and b['model'] and b['int'] > 0); t['fi'] += bool(f and f['model'] and f['int'] > 0)
print()
print('| Zbiór | Domów | Model (1352 → końcowy) | Model ze ścianami wewnętrznymi (1352 → końcowy) |')
print('|---|---|---|---|')
for k, t in tot.items(): print(f"| {k} | {t['n']} | {t['bm']} → {t['fm']} | {t['bi']} → {t['fi']} |")
def graded(scores_p, key_p, title, fmt):
    sc, key = J(scores_p), J(key_p)
    if not sc or not key: return
    print(f'\n{title}\n')
    for h in man['houses']:
        n = h['house']
        if n not in sc or n not in key: continue
        inv = {key[n]['X']: 'X', key[n]['Y']: 'Y'}
        print(fmt(h, sc[n], inv))
if len(sys.argv) > 4:
    print('\n| Dom | Zbiór | Użyteczna: 1352 | Użyteczna: końcowy | Bliżej źródła | Uwaga oceniającego |\n|---|---|---|---|---|---|', end='')
    def fx(h, s, inv):
        b, f = s.get(inv.get('baseline1352'), {}), s.get(inv.get('final'), {})
        c = s.get('closer'); who = 'REMIS' if c not in ('X', 'Y') else ('końcowy' if inv.get('final') == c else '1352')
        return f"| {h['title']} | {h['set']} | {'TAK' if b.get('useful') else 'NIE'} | {'TAK' if f.get('useful') else 'NIE'} | {who} | {(s.get('note') or '')[:260]} |"
    graded(sys.argv[3], sys.argv[4], '', fx)
if len(sys.argv) > 6:
    print('\n| Dom | Zbiór | 1352: ściany rzutu obecne / rysowane; zmyślone / ścian modelu; obrys | Końcowy: to samo | Wnętrze zgodne (1352 → końcowy) |\n|---|---|---|---|---|', end='')
    def fi(h, s, inv):
        b, f = s.get(inv.get('baseline1352'), {}), s.get(inv.get('final'), {})
        c = lambda q: f"{q.get('present', '?')}/{q.get('drawn', '?')}; {q.get('phantom', '?')}/{q.get('modelWalls', '?')}; {q.get('outline', '?')}"
        return f"| {h['title']} | {h['set']} | {c(b)} | {c(f)} | {'TAK' if b.get('interiorOk') else 'NIE'} → {'TAK' if f.get('interiorOk') else 'NIE'} |"
    graded(sys.argv[5], sys.argv[6], '', fi)
