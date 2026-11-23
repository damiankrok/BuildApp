#!/usr/bin/env python3
"""Builds the delivery manifest for make_delivery.py from the run dirs that exist (private work dir, not in Git)."""
import json, os, sys
R = '/home/user/rd/v35418'
FINAL = sys.argv[1]
BASE = '37ad17c'
H = [
 ('alaska', 'Alaska', 'Studio Atrium', 'DEV-K', 'https://www.studioatrium.pl/projekty-domow/Alaska,1612.html', '/home/user/rd/v35416/trial/cache', [('baseline', 'baseline R3 (bieg na żywo R3)', 'LIVE', '/home/user/rd/v35417/r3/live/alaska-2', '3e395b7'), ('final', 'po zmianie (odczyty nagrane R3, recenzja na żywo)', 'REPLAY', f'{R}/final/alaska', FINAL)]),
 ('aurora', 'Aurora maxi II bis sz', 'Studio Atrium', 'DEV-K', 'https://www.studioatrium.pl/projekty-domow/Aurora-maxi-ii-bis-sz,1795.html', '/home/user/rd/v35417/trial/cache', [('baseline', 'baseline R3 (bieg na żywo R3)', 'LIVE', '/home/user/rd/v35417/r3/live/aurora-2', '3e395b7'), ('final', 'po zmianie (odczyty nagrane R3, recenzja na żywo)', 'REPLAY', f'{R}/final/aurora', FINAL)]),
 ('ballina', 'Ballina', 'Lipińscy', 'DEV-K', 'https://lipinscy.pl/projekt/ballina', '/home/user/rd/v35414/ballina-cache', [('baseline', 'baseline R3 (bieg na żywo R3)', 'LIVE', '/home/user/rd/v35417/r3/live/ballina-1', '3e395b7'), ('final', 'po zmianie (odczyty nagrane R3, recenzja na żywo)', 'REPLAY', f'{R}/final/ballina', FINAL)]),
 ('alberto', 'Alberto', 'Studio Atrium', 'NEW-B', 'https://www.studioatrium.pl/projekty-domow/Alberto,1242.html', f'{R}/trial/cache', [('baseline', 'pierwszy wynik: kod bazowy (na żywo)', 'LIVE', f'{R}/base/alberto', BASE), ('final', 'po zmianie (odczyty nagrane z baseline, recenzja na żywo)', 'REPLAY', f'{R}/final/alberto', FINAL)]),
 ('medulin', 'Medulin', 'Lipińscy', 'NEW-B', 'https://lipinscy.pl/projekt/medulin', f'{R}/trial/cache', [('baseline', 'pierwszy wynik: kod bazowy (na żywo)', 'LIVE', f'{R}/base/medulin', BASE), ('final', 'po zmianie (odczyty nagrane z baseline, recenzja na żywo)', 'REPLAY', f'{R}/final/medulin', FINAL)]),
 ('jeziorko', 'Domek letniskowy nad jeziorkiem', 'ARCHON', 'NEW-B', 'https://www.archon.pl/projekty-domow/projekt-domek-letniskowy-nad-jeziorkiem-mfb6250986574b', f'{R}/trial/cache', [('baseline', 'pierwszy wynik: kod bazowy (na żywo)', 'LIVE', f'{R}/base/jeziorko', BASE), ('final', 'po zmianie (odczyty nagrane z baseline, recenzja na żywo)', 'REPLAY', f'{R}/final/jeziorko', FINAL)]),
 ('mindelo', 'Mindelo', 'Lipińscy', 'NEW-C', 'https://lipinscy.pl/projekt/mindelo', f'{R}/trial/cache', [('final', 'PIERWSZY wynik: kod końcowy (na żywo, ślepy)', 'LIVE', f'{R}/newc/mindelo', FINAL), ('baseline', 'kod bazowy na tych samych bajtach (na żywo, liczony potem)', 'LIVE', f'{R}/newc-base/mindelo', BASE)]),
 ('sakura', 'Dom pod sakurą E', 'ARCHON', 'NEW-C', 'https://www.archon.pl/projekty-domow/projekt-dom-pod-sakura-e-m92728cdae273a', f'{R}/trial/cache', [('final', 'PIERWSZY wynik: kod końcowy (na żywo, ślepy)', 'LIVE', f'{R}/newc/sakura', FINAL), ('baseline', 'kod bazowy na tych samych bajtach (na żywo, liczony potem)', 'LIVE', f'{R}/newc-base/sakura', BASE)]),
 ('g6', 'G6', 'Dobre Domy', 'NEW-C', 'https://www.dobredomy.pl/projekt/G6', f'{R}/trial/cache', [('final', 'PIERWSZY wynik: kod końcowy (na żywo, ślepy)', 'LIVE', f'{R}/newc/g6', FINAL), ('baseline', 'kod bazowy na tych samych bajtach (na żywo, liczony potem)', 'LIVE', f'{R}/newc-base/g6', BASE)]),
]
extra = json.load(open(f'{R}/delivery/extra-variants.json')) if os.path.exists(f'{R}/delivery/extra-variants.json') else {}
houses = []
for house, title, pub, st, url, cache, vs in H:
    vs = [v for v in vs if os.path.isdir(v[3])] + [tuple(x) for x in extra.get(house, [])]
    if not vs: continue
    sketch_run = next((v[3] for v in vs if v[0] == 'final'), vs[0][3])
    pkg = next((os.path.join(v[3], 'source-package.json') for v in vs if os.path.exists(os.path.join(v[3], 'source-package.json'))), None)
    houses.append({'house': house, 'title': title, 'publisher': pub, 'set': st, 'url': url, 'package': pkg, 'cache': cache, 'sketchRun': sketch_run, 'variants': [{'key': k, 'label': l, 'kind': kind, 'run': run, 'commit': c} for k, l, kind, run, c in vs]})
H1, H2 = f'{R}/host/out', f'{R}/host2/out'
extras = {'host': [
  {'key': 'job-1-ballina', 'label': 'Ballina — świeży odczyt, token', 'url': 'https://lipinscy.pl/projekt/ballina', 'dir': f'{H1}/job-1'},
  {'key': 'job-2-sakura-FAILED', 'label': 'Dom pod sakurą E — świeży odczyt, token: FAILED (zachowane)', 'url': 'https://www.archon.pl/projekty-domow/projekt-dom-pod-sakura-e-m92728cdae273a', 'dir': f'{H1}/job-2'},
  {'key': 'job-1-repeat-ballina', 'label': 'Ballina — ten sam URL drugi raz (REUSED, 0 USD)', 'url': 'https://lipinscy.pl/projekt/ballina', 'dir': f'{H1}/job-1-repeat'},
  {'key': 'job-no-token-jeziorko', 'label': 'Domek letniskowy nad jeziorkiem — bez tokenu (0 żądań)', 'url': 'https://www.archon.pl/projekty-domow/projekt-domek-letniskowy-nad-jeziorkiem-mfb6250986574b', 'dir': f'{H1}/job-default-no-token'},
  {'key': 'job-3-layla', 'label': 'Willa Layla G2 A — organiczna odmowa LOCAL, bryła ze źródeł (poza próbą)', 'url': 'https://www.archon.pl/projekty-domow/projekt-willa-layla-g2ae-m6a929b0c79fda', 'dir': f'{H2}/job-1'}],
 'hostFiles': [{'from': f'{R}/host/e2e.log', 'to': 'e2e-run1.log'}, {'from': f'{H1}/host-books-journal.jsonl', 'to': 'host-books-journal-run1.jsonl'}, {'from': f'{H1}/health.json', 'to': 'health.json'}, {'from': f'{R}/host2/e2e.log', 'to': 'e2e-run2.log'}, {'from': f'{H2}/host-books-journal.jsonl', 'to': 'host-books-journal-run2.jsonl'}],
 'dirs': [{'from': f'{R}/grader/packs', 'to': 'grader-packs', 'label': 'Plansze ślepej oceny (X/Y) — alaska.png jako przykład; pozostałe w tym katalogu', 'index': 'alaska.png'}, {'from': '/home/user/BuildApp/research/source-to-model/v35418/scores', 'to': 'scores', 'label': 'Oceny: autor, ślepy oceniający, klucz X/Y, biegi (grader-decoded.json)', 'index': 'grader-decoded.json'}, {'from': '/home/user/BuildApp/research/source-to-model/v35418/references', 'to': 'references', 'label': 'Cechy referencyjne spisane przed oceną (NEW-C.md)', 'index': 'NEW-C.md'}]}
json.dump({'commit': FINAL, 'extras': extras, 'houses': houses}, open(f'{R}/delivery/manifest.json', 'w'), indent=1, ensure_ascii=False)
print(len(houses), 'houses', [(h['house'], [v['key'] for v in h['variants']]) for h in houses])
