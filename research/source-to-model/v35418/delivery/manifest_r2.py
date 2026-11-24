#!/usr/bin/env python3
"""v3.54.18 R2 — the delivery manifest of the continuation round: per house the model delivered with APK 1349 beside the
R2 result on the same source bytes and (where they exist) the same recorded readings. Private work dirs, not in Git.
  manifest_r2.py <R2 code commit> > manifest-r2.json"""
import json, os, sys
R = '/home/user/rd/v35418'
C = sys.argv[1]
OLD = 'e875ee0'
T = f'{R}/trial/cache'
H = [
 ('alaska', 'Alaska', 'Studio Atrium', 'DEV-K', 'https://www.studioatrium.pl/projekty-domow/Alaska,1612.html', '/home/user/rd/v35416/trial/cache', f'{R}/final/alaska', f'{R}/r2d/alaska'),
 ('aurora', 'Aurora maxi II bis sz', 'Studio Atrium', 'DEV-K', 'https://www.studioatrium.pl/projekty-domow/Aurora-maxi-ii-bis-sz,1795.html', '/home/user/rd/v35417/trial/cache', f'{R}/final/aurora', f'{R}/r2e/aurora'),
 ('ballina', 'Ballina', 'Lipińscy', 'DEV-K', 'https://lipinscy.pl/projekt/ballina', '/home/user/rd/v35414/ballina-cache', f'{R}/final/ballina', f'{R}/r2e/ballina'),
 ('alberto', 'Alberto', 'Studio Atrium', 'NEW-B', 'https://www.studioatrium.pl/projekty-domow/Alberto,1242.html', T, f'{R}/final2/alberto', f'{R}/r2e/alberto'),
 ('medulin', 'Medulin', 'Lipińscy', 'NEW-B', 'https://lipinscy.pl/projekt/medulin', T, f'{R}/final/medulin', f'{R}/r2e/medulin'),
 ('jeziorko', 'Domek letniskowy nad jeziorkiem', 'ARCHON', 'NEW-B', 'https://www.archon.pl/projekty-domow/projekt-domek-letniskowy-nad-jeziorkiem-mfb6250986574b', T, f'{R}/final/jeziorko', f'{R}/r2e/jeziorko'),
 ('mindelo', 'Mindelo', 'Lipińscy', 'NEW-C', 'https://lipinscy.pl/projekt/mindelo', T, f'{R}/newc/mindelo', f'{R}/r2e/mindelo'),
 ('sakura', 'Dom pod sakurą E', 'ARCHON', 'NEW-C', 'https://www.archon.pl/projekty-domow/projekt-dom-pod-sakura-e-m92728cdae273a', T, f'{R}/final2/sakura', f'{R}/r2e/sakura'),
 ('g6', 'G6', 'Dobre Domy', 'NEW-C', 'https://www.dobredomy.pl/projekt/G6', T, f'{R}/newc/g6', f'{R}/r2d/g6'),
]
houses = []
for house, title, pub, st, url, cache, old, new in H:
    vs = [{'key': 'delivered1349', 'label': 'oddany z APK 1349 (v3.54.18)', 'kind': 'REPLAY', 'run': old, 'commit': OLD}]
    if os.path.isdir(new): vs.append({'key': 'r2', 'label': 'R2 (odczyty elewacji nagrane, rzut i recenzja na żywo)', 'kind': 'REPLAY', 'run': new, 'commit': C})
    pkg = next((os.path.join(v['run'], 'source-package.json') for v in reversed(vs) if os.path.exists(os.path.join(v['run'], 'source-package.json'))), None)
    houses.append({'house': house, 'title': title, 'publisher': pub, 'set': st, 'url': url, 'package': pkg, 'cache': cache, 'sketchRun': vs[-1]['run'], 'variants': vs})
print(json.dumps({'commit': C, 'title': 'BuildPlan v3.54.18 R2 — galeria kontynuacji', 'houses': houses, 'extras': {}}, ensure_ascii=False, indent=1))
