#!/usr/bin/env python3
"""v3.54.18 R3 — the delivery manifest of the second continuation round: per house the model delivered with APK 1350 (R2)
beside the R3 result on the same source bytes and the same recorded elevation readings. Private work dirs, not in Git.
  manifest_r3.py <R3 code commit> > manifest-r3.json"""
import json, os, sys
R = '/home/user/rd/v35418'
C = sys.argv[1]
OLD = '35f5ee1'
T = f'{R}/trial/cache'
H = [
 ('alaska', 'Alaska', 'Studio Atrium', 'DEV-K', 'https://www.studioatrium.pl/projekty-domow/Alaska,1612.html', '/home/user/rd/v35416/trial/cache', f'{R}/r2d/alaska', f'{R}/r4/alaska'),
 ('aurora', 'Aurora maxi II bis sz', 'Studio Atrium', 'DEV-K', 'https://www.studioatrium.pl/projekty-domow/Aurora-maxi-ii-bis-sz,1795.html', '/home/user/rd/v35417/trial/cache', f'{R}/r2e/aurora', f'{R}/r4/aurora'),
 ('ballina', 'Ballina', 'Lipińscy', 'DEV-K', 'https://lipinscy.pl/projekt/ballina', '/home/user/rd/v35414/ballina-cache', f'{R}/r2e/ballina', f'{R}/r4/ballina'),
 ('alberto', 'Alberto', 'Studio Atrium', 'NEW-B', 'https://www.studioatrium.pl/projekty-domow/Alberto,1242.html', T, f'{R}/r2e/alberto', f'{R}/r4/alberto'),
 ('medulin', 'Medulin', 'Lipińscy', 'NEW-B', 'https://lipinscy.pl/projekt/medulin', T, f'{R}/r2e/medulin', f'{R}/r4/medulin'),
 ('jeziorko', 'Domek letniskowy nad jeziorkiem', 'ARCHON', 'NEW-B', 'https://www.archon.pl/projekty-domow/projekt-domek-letniskowy-nad-jeziorkiem-mfb6250986574b', T, f'{R}/r2e/jeziorko', f'{R}/r4/jeziorko'),
 ('mindelo', 'Mindelo', 'Lipińscy', 'NEW-C', 'https://lipinscy.pl/projekt/mindelo', T, f'{R}/r2e/mindelo', f'{R}/r4/mindelo'),
 ('sakura', 'Dom pod sakurą E', 'ARCHON', 'NEW-C', 'https://www.archon.pl/projekty-domow/projekt-dom-pod-sakura-e-m92728cdae273a', T, f'{R}/r2e/sakura', f'{R}/r4/sakura'),
 ('g6', 'G6', 'Dobre Domy', 'NEW-C', 'https://www.dobredomy.pl/projekt/G6', T, f'{R}/r2d/g6', f'{R}/r4/g6'),
]
houses = []
for house, title, pub, st, url, cache, old, new in H:
    vs = [{'key': 'delivered1350', 'label': 'oddany z APK 1350 (R2)', 'kind': 'REPLAY', 'run': old, 'commit': OLD}]
    if os.path.isdir(new): vs.append({'key': 'r3', 'label': 'R3 (odczyty elewacji nagrane, rzut plan-outline/3, recenzja na żywo)', 'kind': 'REPLAY', 'run': new, 'commit': C})
    pkg = next((os.path.join(v['run'], 'source-package.json') for v in reversed(vs) if os.path.exists(os.path.join(v['run'], 'source-package.json'))), None)
    houses.append({'house': house, 'title': title, 'publisher': pub, 'set': st, 'url': url, 'package': pkg, 'cache': cache, 'sketchRun': vs[-1]['run'], 'variants': vs})
print(json.dumps({'commit': C, 'title': 'BuildPlan v3.54.18 R3 — galeria drugiej kontynuacji', 'houses': houses, 'extras': {}}, ensure_ascii=False, indent=1))
