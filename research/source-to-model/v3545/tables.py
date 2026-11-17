#!/usr/bin/env python3
"""v3.54.5 — the report's tables, from the saved runs (markdown; nothing is scored here).
  tables.py views      <list> <run root> [<score json> <run name>]
  tables.py openings   <list> <run root> [<score json> <run name>]      (one row per agreed opening)
  tables.py decisions  <list> <run root>
  tables.py corrections <list> <run root>
  tables.py costs      <ledger json>
"""
import json, os, sys
def houses(listp): return [l.split()[0] for l in open(listp) if l.strip()]
def load(p):
    return json.load(open(p)) if os.path.exists(p) else None
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
PL = {'FRONT': 'front', 'RIGHT': 'prawa', 'REAR': 'tył', 'LEFT': 'lewa'}

def views(listp, root, score=None, run=None):
    sc = load(score) if score else None
    print('| dom | elewacje w źródle | wysłane do pomiaru | odczytane (opis) | zarejestrowane | zbudowane (otwory+cechy / odczytane) | ocenione stron | powód braku |')
    print('|---|---|---|---|---|---|---|---|')
    for h in houses(listp):
        d = load(os.path.join(root, h, 'house.json')); s = load(os.path.join(root, h, 'summary.json')) or {}
        if not d:
            print(f"| {h} | — | — | — | — | — | — | {s.get('status')}: {(s.get('error') or '')[:120]} |"); continue
        v = d.get('verification', {}); sv = d.get('source', {}).get('views', [])
        el = [x for x in sv if x['role'] == 'ELEVATION']
        pics = [p for p in d['source']['pictures'] if p['role'] == 'ELEVATION' and p.get('thisHouse', True)]
        sent = [p for p in pics if p.get('sent') == 'DETAIL']
        vs = v.get('views', [])
        read = [x for x in vs if x['state'] in ('READ_COMPLETE', 'PARTIAL', 'UNREADABLE', 'ASSIGNMENT_UNRESOLVED')]
        built = ' '.join(f"{PL[x['side']]} {x['built']['openings'] + x['built']['features']}/{x['read']['openings'] + x['read']['features']}" for x in vs if x.get('elevation'))
        why = '; '.join(f"{PL[x['side']]}: {x['state']}" + (f" ({x['why'][:90]})" if x.get('why') else '') for x in vs if x['state'] != 'READ_COMPLETE' or not x.get('registered')) or '—'
        scored = ''
        if sc and h in sc['houses'] and run in sc['houses'][h]:
            x = sc['houses'][h][run]; scored = f"{x.get('sidesBuilt')}/{x.get('sidesPublished')} zbud." if x.get('model') else 'brak modelu'
        print(f"| {h} | {len(pics)} | {len(sent)} | {len(read)} ({sum(1 for e in el if e['answer'] == 'DESCRIBED')} opisów; dopytań {sum(max(0, e['asked'] - 1) for e in el)}) | {sum(1 for x in vs if x.get('registered'))} | {built or '—'} | {scored} | {why} |")

def openings(listp, root, score=None, run=None):
    sc = load(score) if score else None
    print('| dom | otwór | źródło / region [px] | ściana, poziom | odczyt (typ) | uzgodnione: od / szer. / wys. / parapet [m] | po kompilacji: szer. × wys., dół [m] | dopasowanie | błąd wobec referencji [m] | pochodzenie |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for h in houses(listp):
        d = load(os.path.join(root, h, 'house.json'))
        if not d or not d.get('geometry'): continue
        obs = {f"{e['id']}/{o['id']}": (e, o) for e in d['observations']['elevations'] for o in e['openings']}
        rows = {r['scene']: r for r in ((sc or {}).get('houses', {}).get(h, {}).get(run, {}).get('rows') or []) if r.get('scene')}
        geo = {o['id']: o for o in d['geometry']['openings']}
        for o in d['verification'].get('openings', []):
            e, x = obs.get(o.get('ref') or '', (None, None))
            b = x['box'] if x else None
            a = o['agreed']; c = o.get('cut')
            r = rows.get(o['id'])
            err = '—' if not r else r['result'] + (' ' + ', '.join(f"{k[1:].lower()} {r[k]:+.2f}" for k in ('dAlong', 'dWidth', 'dHeight', 'dBottom') if k in r) if r['result'] in ('OK', 'OFF') else '')
            g = geo.get(o['id'], {})
            prov = f"{g.get('widthM', {}).get('basis', '?')}, ±{g.get('widthM', {}).get('uncertainty', '?')} m; {(g.get('offsetM', {}).get('how') or '')[:50]}"
            print(f"| {h} | {o['id']} | {(e or {}).get('picture', '?')} {'[%d,%d–%d,%d]' % (b['x0'], b['y0'], b['x1'], b['y1']) if b else ''} | {o['hostWall']}, {o['level']} | {o['kind']} | {a['offsetM']:.2f} / {a['widthM']:.2f} / {a['heightM']:.2f} / {a['sillM']:.2f} | {('%.2f × %.2f, %.2f' % (c['widthM'], c['heightM'], c['bottomY'])) if c else 'nie wycięto'} | {o['fit']}{(': ' + o['why'][:110]) if o.get('why') and o['fit'] != 'EXACT' else ''} | {err} | {prov} |")

def decisions(listp, root):
    print('| dom | LOCAL | opis H | sprzeczności źródłowe LOCAL | sprzeczności źródłowe H | nieznane | wybrany | kod decyzji | skutek dla wnętrz |')
    print('|---|---|---|---|---|---|---|---|---|')
    for h in houses(listp):
        t = load(os.path.join(root, h, 'trace.json')); s = load(os.path.join(root, h, 'summary.json')) or {}
        if not t:
            print(f"| {h} | — | {s.get('status')} | — | — | — | — | — | — |"); continue
        a = t['arbitration']; loc = t.get('local')
        lb = '; '.join(f"{f['fact']}: {f['local']} wobec {f['source'][:70]}" for f in a['findings'] if not f['localOk']) or ('—' if loc else 'brak modelu')
        hb = '; '.join(f"{f['fact']}: {f['described']}" for f in a['findings'] if not f['describedOk']) or ('—' if s.get('status') == 'BUILT' and not s.get('failedChecks') else (a['why'][:160] if a.get('code', '').startswith('DESCRIBED_REJECTED') or a.get('code') == 'NO_MODEL' else '—'))
        print(f"| {h} | {'model %.2f × %.2f m, dach +%s' % (loc['widthM'], loc['depthM'], loc.get('topAboveGroundFloorM')) if loc else 'brak modelu'} | {s.get('status')} {s.get('widthM')} × {s.get('depthM')} m | {lb} | {hb} | {'; '.join(a.get('unknown') or [])[:160] or '—'} | {a['accepted']}{' (podgląd częściowy)' if a.get('partial') else ''} | {a.get('code', '—')} | {(a.get('interior') or '—')[:150]} |")

def corrections(listp, root):
    print('| dom | runda | korekta | przedmiot | grupa | wynik | powód / skutek | rewizja przed → po |')
    print('|---|---|---|---|---|---|---|---|')
    for h in houses(listp):
        for p in load(os.path.join(root, h, 'proposals.json')) or []:
            print(f"| {h} | {p['round']} | {p['op']} | {p['subject'][:40]} | {p.get('group') or '—'} | {p['state']}{' ' + p['code'] if p.get('code') else ''} | {p['effect'][:150]} | {p.get('baseRevision', '—')} → {p.get('revision', '—')} |")

def costs(ledger):
    L = load(ledger); by = {}
    def kind(note):
        n = note.lower()
        if 'probe' in n: return 'sondy schematu'
        if 'review' in n: return 'kontrola sceny i korekty (REVIEW)'
        if 'facades round' in n: return 'celowane uzupełnienia elewacji'
        if 'facades' in n: return 'odczyt elewacji i przekroju'
        if 'plan' in n: return 'odczyt rzutu'
        if 'inventory' in n: return 'inwentarz obrazów'
        return 'inne'
    for e in L['entries']:
        k = (e['phase'], kind(e['note'])); b = by.setdefault(k, [0, 0, 0, 0.0])
        b[0] += 1; b[1] += e['inputTokens']; b[2] += e['outputTokens']; b[3] += e['costUsd']
    print('| faza | rodzaj | zapytań | tokeny wej. | tokeny wyj. | koszt USD |'); print('|---|---|---|---|---|---|')
    tot = {}
    for (ph, kd), b in sorted(by.items()):
        print(f"| {ph} | {kd} | {b[0]} | {b[1]} | {b[2]} | {b[3]:.6f} |"); t = tot.setdefault(ph, [0, 0.0]); t[0] += b[0]; t[1] += b[3]
    for ph, t in tot.items(): print(f"| **{ph} razem** | | {t[0]} | | | {t[1]:.6f} |")
    print(f"| **kampania razem** | | {len(L['entries'])} | | | {sum(e['costUsd'] for e in L['entries']):.6f} |")

{'views': views, 'openings': openings, 'decisions': decisions, 'corrections': corrections, 'costs': costs}[sys.argv[1]](*sys.argv[2:])
