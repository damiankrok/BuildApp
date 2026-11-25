#!/usr/bin/env python3
"""v3.54.21 — the omission trace of a set of runs, from their own records (no model is judged here, nothing is re-read):

  omissions.py <out dir> <name>=<run dir>[,<baseline run dir or model.json>] ...

Per house: (1) the pictures the structure read was actually sent (role, source px → sent px, factor) and every picture
left out with its reason; (2) each feature read from the sources → what was agreed → what the delivered model shows →
the cause where it is not there; (3) the roofs as one system: regions, relations, valleys, every taken property's fate;
(4) the numbers and joins measured back on the delivered model; (5) the elevation observations by fate, the not-built
ones with their codes; (6) the counts baseline → after, every drop named. Written as `<name>.json`, `<name>.md` and one
`OMISSIONS.md` / `omissions.json` over all houses. Run with `/usr/bin/python3 -I`.
"""
import collections
import json
import os
import sys


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def counts(model):
    if not model:
        return None
    ext = [w for w in model.get('walls', []) if w.get('kind') == 'EXTERIOR']
    ext_ids = {w['id'] for w in ext}
    edges = collections.Counter(e['kind'] for e in model.get('roofEdges', []))
    return {
        'exteriorWalls': len(ext), 'interiorWalls': len(model.get('walls', [])) - len(ext),
        'openings': len(model.get('openings', [])), 'exteriorOpenings': sum(1 for o in model.get('openings', []) if o.get('wallId') in ext_ids),
        'interiorOpenings': sum(1 for o in model.get('openings', []) if o.get('wallId') not in ext_ids),
        'windows': len(model.get('windows', [])), 'doors': len(model.get('doors', [])), 'chimneys': len(model.get('chimneys', [])),
        'roofWindows': len(model.get('roofOpenings', [])), 'parametricRoofs': len(model.get('roofs', [])), 'roofPlanes': len(model.get('roofPlanes', [])),
        'valleys': edges.get('VALLEY', 0), 'abutments': edges.get('ABUTMENT', 0), 'hips': edges.get('HIP', 0), 'ridges': edges.get('RIDGE', 0),
    }


def house(name, run, base):
    ev = load(os.path.join(run, 'events.json')) or []
    by = collections.defaultdict(list)
    for e in ev:
        by[e.get('kind')].append(e)
    last = lambda k: by[k][-1] if by.get(k) else None
    model = load(os.path.join(run, 'model.json'))
    bmodel = load(base if base and base.endswith('.json') else os.path.join(base, 'model.json')) if base else None
    out = {'house': name, 'run': os.path.basename(os.path.normpath(run))}
    # (1) pictures
    sr = last('STRUCTURE_READ')
    if sr:
        out['structureRead'] = {
            'promptVersion': sr.get('promptVersion'), 'sent': [{k: i.get(k) for k in ('role', 'n', 'caption', 'frameId', 'sourceByteHash', 'sourcePx', 'sentPx', 'factor', 'origin')} for i in sr.get('images', [])],
            'skipped': sr.get('skipped', []), 'missing': sr.get('missing', []), 'facts': (sr.get('sheets') or {}).get('facts', []),
            **({'refused': sr.get('why')} if sr.get('decision') in ('REFUSED', 'FAILED') or sr.get('refused') else {}),
        }
    else:
        out['structureRead'] = None
    sk = load(os.path.join(run, 'sketches.json')) or {}
    reading = (sk.get('reading') or {}).get('sketches', [])
    out['elevationSketches'] = [{'frameId': s.get('frameId'), 'facade': s.get('facade'), 'read': bool(s.get('sketch')), **({'why': s.get('why')} if not s.get('sketch') and s.get('why') else {})} for s in reading]
    # the pictures every OTHER stage sent, from each stage's own record (role, what it is, its pixels)
    inv = []
    for s in reading:
        src = (s.get('sketch') or {}).get('source') or {}
        inv.append({'stage': 'ELEVATION_SKETCH', 'role': f"ELEVATION {s.get('facade')}", 'frameId': s.get('frameId'), 'what': 'the publisher\'s original picture' + (f" (1:{src.get('scale')})" if src.get('scale', 1) != 1 else ''), 'px': [src.get('width'), src.get('height')] if src else None, 'outcome': 'read' if s.get('sketch') else f"no sketch: {s.get('why') or (s.get('raw') or {}).get('why') or 'refused or failed'}"})
    for e in by.get('METRIC_READ', []):
        inv.append({'stage': 'METRIC_READ', 'role': 'PLAN / DIMENSIONED SHEET', 'frameId': e.get('frameId'), 'what': 'the publisher\'s original picture, whole-factor downscale above the provider\'s size (pixel coordinates are returned)', 'px': None, 'outcome': f"{e.get('observations')} observation(s), {e.get('refused')} refused"})
    chk = last('SENT_MODEL_CHECK')
    for q in (chk or {}).get('pictures', []):
        inv.append({'stage': 'REVIEW', 'role': q.get('what'), 'frameId': q.get('frameId') or q.get('name'), 'what': 'a render of the model (derived)' if str(q.get('what', '')).startswith('MODEL') or not q.get('frameId') else 'the publisher\'s original picture' + (f" (1:{(q.get('transform') or {}).get('scale')})" if (q.get('transform') or {}).get('scale', 1) != 1 else ''), 'px': [q.get('width'), q.get('height')], 'outcome': (q.get('label') or '')[:120]})
    out['otherStagesPictures'] = inv
    out['reviewFeatureMapSent'] = bool((chk or {}).get('featureMap'))
    # (2) features
    ft = last('FEATURE_TRACE')
    out['features'] = None if not ft else {
        'byResult': ft.get('byResult'), 'byCause': ft.get('byCause'), 'keyOpen': ft.get('keyOpen'),
        'rows': [{'id': r['feature']['id'], 'kind': r['feature']['kind'], 'weight': r['feature'].get('weight'), 'stated': r['feature']['stated'], 'status': r['feature'].get('status'),
                  'agreed': (r.get('agreed') or {}).get('standing'), 'agreedWhy': (r.get('agreed') or {}).get('why'), 'result': r['result'], 'cause': r.get('cause'), 'why': r.get('why')} for r in ft.get('rows', [])],
    }
    # (3) roofs
    rs = last('ROOF_SYSTEM')
    out['roofSystem'] = None if not rs else {
        'regions': [{k: q.get(k) for k in ('id', 'kind', 'ridgeAxis', 'pitchDeg', 'eaveY', 'ridgeY', 'joined')} for q in rs.get('regions', [])],
        'relations': rs.get('relations', []), 'adjustments': rs.get('adjustments', []), 'violations': rs.get('violations', []),
        'valleys': [c for c in rs.get('creases', []) if c.get('kind') == 'VALLEY'], 'fates': rs.get('fates', []), 'crossRoofs': rs.get('crossRoofs', []), 'buildError': rs.get('buildError'),
    }
    arb = last('BODY_ARBITRATION')
    out['bodyArbitration'] = None if not arb else {'decision': arb.get('decision'), 'why': arb.get('why')}
    rej = load(os.path.join(run, 'massing-rejected.json'))
    if rej:
        out['sourceBodyNotDelivered'] = {'decision': rej.get('decision'), 'why': (rej.get('why') or '')[:600]}
    # (4) readback
    rb = last('STRUCTURE_READBACK')
    out['readback'] = None if not rb else {'checks': rb.get('checks', []), 'joins': rb.get('joins', []), 'agree': sum(1 for c in rb.get('checks', []) if c.get('agrees')), 'of': len(rb.get('checks', []))}
    ob = last('OPENINGS_READBACK')
    out['openingsReadback'] = ob.get('counts') if ob else None
    # (5) observations
    of = load(os.path.join(run, 'observation-fates.json'))
    if of:
        nb = [r for r in of.get('rows', []) if r.get('fate') not in ('BUILT', 'AGREES_WITH_MODEL')]
        out['observations'] = {'summary': of.get('summary'), 'notInModel': [{'id': r.get('id'), 'kind': r.get('kind'), 'side': r.get('side'), 'fate': r.get('fate'), 'code': r.get('code'), 'operation': r.get('operation'), 'why': (r.get('why') or '')[:300]} for r in nb]}
    # (6) counts
    out['counts'] = {'baseline': counts(bmodel), 'after': counts(model)}
    drops = []
    if bmodel and model:
        b, a = out['counts']['baseline'], out['counts']['after']
        for k in ('exteriorWalls', 'interiorWalls', 'exteriorOpenings', 'interiorOpenings', 'windows', 'doors', 'chimneys', 'roofWindows'):
            if a[k] < b[k]:
                drops.append({'what': k, 'baseline': b[k], 'after': a[k]})
    out['drops'] = drops
    fin = last('FINAL')
    out['final'] = None if not fin else {k: fin.get(k) for k in ('decision', 'status', 'why') if k in fin}
    return out


def md(h):
    L = [f"## {h['house']}", '']
    sr = h.get('structureRead')
    L += ['### 1. Obrazy wysłane do odczytu struktury', '']
    if not sr:
        L += ['Odczyt struktury nie został zapytany w tym biegu.', '']
    else:
        L += [f"Kontrakt: `{sr['promptVersion']}`. Wysłano {len(sr['sent'])} obraz(y/ów); pominięto {len(sr['skipped'])}.", '', '| rola | podpis | px źródła | px wysłane | skala | pochodzenie |', '|---|---|---|---|---|---|']
        for i in sr['sent']:
            L.append(f"| {i['role']}{' ' + str(i['n']) if i.get('n') else ''} | {i['caption']} | {i['sourcePx'][0]}×{i['sourcePx'][1]} | {i['sentPx'][0]}×{i['sentPx'][1]} | 1:{i['factor']} | {i['origin']} |")
        if sr['skipped']:
            L += ['', 'Pominięte (z przyczyną):', '']
            L += [f"- {s.get('role')} `{s.get('frameId', '')[-28:]}` {s.get('px')}: {s.get('why')}" for s in sr['skipped']]
        if sr['missing']:
            L += ['', 'Brak w pakiecie: ' + '; '.join(str(m) for m in sr['missing'])]
        L.append('')
    inv = h.get('otherStagesPictures') or []
    if inv:
        L += ['Obrazy wysłane w pozostałych etapach (z zapisów etapów):', '', '| etap | rola | obraz | px | wynik / opis |', '|---|---|---|---|---|']
        L += [f"| {q['stage']} | {q['role']} | {q['what']} `{str(q.get('frameId') or '')[-24:]}` | {'×'.join(str(x) for x in q['px']) if q.get('px') and q['px'][0] else '—'} | {q['outcome']} |" for q in inv]
        L += ['', f"Mapa cech wysłana recenzentowi przed oceną modelu: {'tak' if h.get('reviewFeatureMapSent') else 'nie (recenzja nie była pytana w tym biegu albo odtworzona z nagrania)'}.", '']
    f = h.get('features')
    L += ['### 2. Cecha → odczyt → uzgodnienie → model → wynik i przyczyna', '']
    if not f:
        L += ['Brak mapy cech (odczyt struktury nie powstał).', '']
    else:
        L += [f"Wynik: {f['byResult']}; przyczyny: {f['byCause']}; otwarte cechy kluczowe: {f['keyOpen'] or 'brak'}.", '', '| cecha | waga | odczytano | uzgodnienie | w modelu | przyczyna | opis |', '|---|---|---|---|---|---|---|']
        for r in f['rows']:
            L.append(f"| {r['id']} | {r['weight']} | {r['stated']}{' (' + r['status'] + ')' if r.get('status') else ''} | {r['agreed']} | {r['result']} | {r['cause'] or '—'} | {(r['why'] or '')[:220]} |")
        L.append('')
    rs = h.get('roofSystem')
    L += ['### 3. Dachy jako jeden układ', '']
    if not rs:
        a = h.get('bodyArbitration')
        L += [f"Bryła ze źródeł nie jest bryłą oddaną ({a['decision'] if a else 'brak arbitrażu'}: {(a or {}).get('why', '')[:400]})." if a else 'Brak zapisu układu dachów (bryła nie pochodzi z odczytu źródeł).', '']
    else:
        L += ['| dach | rodzaj | kalenica | kąt | okap m | kalenica m | w układzie |', '|---|---|---|---|---|---|---|']
        L += [f"| {q['id']} | {q['kind']} | {q['ridgeAxis']} | {q['pitchDeg']} | {q['eaveY']} | {q['ridgeY']} | {'tak' if q['joined'] else 'nie'} |" for q in rs['regions']]
        L += ['', 'Relacje: ' + ('; '.join(f"{q['a']} → {q['b']} **{q['kind']}** ({q.get('why', '')[:160]})" for q in rs['relations']) or 'żadne dwa dachy się nie stykają') + '.']
        L += [f"Kosze policzone z przecięcia połaci: {len(rs['valleys'])}" + (': ' + '; '.join(f"({v['start']['x']:.2f}, {v['start']['z']:.2f}) {v['startM']:.2f} m → ({v['end']['x']:.2f}, {v['end']['z']:.2f}) {v['endM']:.2f} m" for v in rs['valleys']) if rs['valleys'] else '') + '.']
        if rs['adjustments']:
            L += ['Korekty w tolerancji: ' + '; '.join(str(a.get('why', a))[:200] for a in rs['adjustments']) + '.']
        if rs.get('buildError'):
            L += ['**BŁĄD BUDOWY (BUILD_ERROR):** ' + str(rs['buildError'])[:400]]
        if rs['violations']:
            L += ['**Naruszenia:** ' + '; '.join(str(a.get('why', a))[:240] for a in rs['violations']) + '.']
        if rs['fates']:
            L += ['', '| bryła | własność | los | przyjęto | zbudowano | dlaczego |', '|---|---|---|---|---|---|']
            L += [f"| {q.get('bodyId')} | {q.get('property')} | {q.get('fate')} | {q.get('taken', '—')} | {q.get('built', '—')} | {(q.get('why') or '')[:200]} |" for q in rs['fates']]
        L.append('')
    rb = h.get('readback')
    L += ['### 4. Odczyt zwrotny z oddanego modelu', '']
    if rb:
        L += [f"Zgodnych {rb['agree']} z {rb['of']} sprawdzeń." + ('' if rb['agree'] == rb['of'] else ' Niezgodne: ' + '; '.join(f"{c['property']}: przyjęto {c['taken']}, zbudowano {c['built']}" for c in rb['checks'] if not c.get('agrees')) + '.')]
        if rb['joins']:
            L += ['Połączenia w modelu: ' + '; '.join(f"{j['kind']} {' ↔ '.join(j['roofs'])} ({j['startM']} → {j['endM']} m, {j['lengthM']} m)" for j in rb['joins']) + '.']
    if h.get('openingsReadback'):
        L += [f"Otwory zewnętrzne: {h['openingsReadback']}."]
    L.append('')
    ob = h.get('observations')
    L += ['### 5. Obserwacje elewacji według losu', '']
    if ob:
        L += [f"{ob['summary']}", '']
        if ob['notInModel']:
            L += ['| obserwacja | strona | los | kod | dlaczego |', '|---|---|---|---|---|']
            L += [f"| {r['kind']} `{(r['id'] or '')[-22:]}` | {r['side']} | {r['fate']} | {r.get('code') or '—'} | {r['why'][:200]} |" for r in ob['notInModel']]
    L.append('')
    c = h['counts']
    L += ['### 6. Liczby: baseline → po', '']
    if c['baseline'] and c['after']:
        L += ['| | baseline | po |', '|---|---|---|'] + [f"| {k} | {c['baseline'][k]} | {c['after'][k]} |" for k in c['after']]
        L += ['', ('Spadki: ' + '; '.join(f"**{d['what']} {d['baseline']} → {d['after']}**" for d in h['drops']) + ' — przyczyny w sekcji 5 i w raporcie etapu.') if h['drops'] else 'Żaden licznik ścian ani otworów nie spadł względem baseline.']
    elif c['after']:
        L += [f"Po: {c['after']} (brak modelu baseline do porównania)."]
    L.append('')
    return '\n'.join(L)


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    allh = []
    for arg in sys.argv[2:]:
        name, rest = arg.split('=', 1)
        run, _, base = rest.partition(',')
        h = house(name, run, base or None)
        allh.append(h)
        with open(os.path.join(out, f'{name}.json'), 'w', encoding='utf-8') as f:
            json.dump(h, f, ensure_ascii=False, indent=1, sort_keys=True)
        with open(os.path.join(out, f'{name}.md'), 'w', encoding='utf-8') as f:
            f.write(md(h))
    causes = collections.Counter()
    results = collections.Counter()
    for h in allh:
        for r in ((h.get('features') or {}).get('rows') or []):
            results[r['result']] += 1
            if r.get('cause'):
                causes[r['cause']] += 1
    head = ['# v3.54.21 — ślad pominięć (z zapisów biegów)', '', f"Domy: {len(allh)}. Cechy łącznie: {sum(results.values())} — {dict(results)}. Przyczyny: {dict(causes)}.", '',
            '| dom | obrazy wysłane / pominięte | cechy: jak podano / inaczej / brak / nie sprawdzono | kosze | dojścia | readback | spadki względem baseline |', '|---|---|---|---|---|---|---|']
    for h in allh:
        sr, f, rb, a = h.get('structureRead'), h.get('features'), h.get('readback'), h['counts']['after'] or {}
        br = (f or {}).get('byResult') or {}
        head.append(f"| {h['house']} | {len(sr['sent']) if sr else 0} / {len(sr['skipped']) if sr else 0} | {br.get('BUILT_AS_STATED', 0)} / {br.get('BUILT_DIFFERENT', 0)} / {br.get('NOT_BUILT', 0)} / {br.get('NOT_CHECKED', 0)} | {a.get('valleys', 0)} | {a.get('abutments', 0)} | {str(rb['agree']) + '/' + str(rb['of']) if rb else '—'} | {', '.join(d['what'] + ' ' + str(d['baseline']) + '→' + str(d['after']) for d in h['drops']) or '—'} |")
    with open(os.path.join(out, 'OMISSIONS.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(head) + '\n\n' + '\n'.join(md(h) for h in allh))
    with open(os.path.join(out, 'omissions.json'), 'w', encoding='utf-8') as f:
        json.dump({'houses': allh, 'featureResults': dict(results), 'featureCauses': dict(causes)}, f, ensure_ascii=False, indent=1, sort_keys=True)
    print('\n'.join(head))


if __name__ == '__main__':
    main()
