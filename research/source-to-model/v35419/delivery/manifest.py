#!/usr/bin/env python3
"""v3.54.19 — the delivery manifest: per house the model of the frozen 1351 code beside the final code's, on the same source
bytes. DEV (nine known houses) and NEW-D replay their recorded elevation readings; NEW-E is live on both codes, once each.
Private work dirs, not in Git.   manifest.py <final code commit> <final run root> > manifest.json"""
import json, os, sys
C, FIN = sys.argv[1], sys.argv[2]
R8, R9 = '/home/user/rd/v35418', '/home/user/rd/v35419'
T8, T9 = f'{R8}/trial/cache', f'{R9}/trial/cache'
BASE = '58ff26a'
H = [
 ('alaska', 'Alaska', 'Studio Atrium', 'DEV', 'https://www.studioatrium.pl/projekty-domow/Alaska,1612.html', '/home/user/rd/v35416/trial/cache', f'{R8}/r4/alaska'),
 ('aurora', 'Aurora maxi II bis sz', 'Studio Atrium', 'DEV', 'https://www.studioatrium.pl/projekty-domow/Aurora-maxi-ii-bis-sz,1795.html', '/home/user/rd/v35417/trial/cache', f'{R8}/r4/aurora'),
 ('ballina', 'Ballina', 'Lipińscy', 'DEV', 'https://lipinscy.pl/projekt/ballina', '/home/user/rd/v35414/ballina-cache', f'{R8}/r4/ballina'),
 ('alberto', 'Alberto', 'Studio Atrium', 'DEV', 'https://www.studioatrium.pl/projekty-domow/Alberto,1242.html', T8, f'{R8}/r4/alberto'),
 ('medulin', 'Medulin', 'Lipińscy', 'DEV', 'https://lipinscy.pl/projekt/medulin', T8, f'{R8}/r4/medulin'),
 ('jeziorko', 'Domek letniskowy nad jeziorkiem', 'ARCHON', 'DEV', 'https://www.archon.pl/projekty-domow/projekt-domek-letniskowy-nad-jeziorkiem-mfb6250986574b', T8, f'{R8}/r4/jeziorko'),
 ('mindelo', 'Mindelo', 'Lipińscy', 'DEV', 'https://lipinscy.pl/projekt/mindelo', T8, f'{R8}/r4/mindelo'),
 ('sakura', 'Dom pod sakurą E', 'ARCHON', 'DEV', 'https://www.archon.pl/projekty-domow/projekt-dom-pod-sakura-e-m92728cdae273a', T8, f'{R8}/r4/sakura'),
 ('g6', 'G6 (garaż ze strychem — nie dom mieszkalny)', 'Dobre Domy', 'DEV', 'https://www.dobredomy.pl/projekt/G6', T8, f'{R8}/r4/g6'),
 ('aletta', 'Aletta New', 'Studio Atrium', 'NEW-D', 'https://www.studioatrium.pl/projekty-domow/Aletta-new,1765.html', T9, f'{R9}/base/aletta'),
 ('novara', 'Novara', 'Lipińscy', 'NEW-D', 'https://lipinscy.pl/projekt/novara', T9, f'{R9}/base/novara'),
 ('jarzebina', 'Jarzębina', 'Dobre Domy', 'NEW-D', 'https://www.dobredomy.pl/projekt/jarzebina', T9, f'{R9}/base/jarzebina'),
 ('eliza', 'Willa Eliza 5 G2', 'ARCHON', 'NEW-D', 'https://www.archon.pl/projekty-domow/projekt-willa-eliza-5-g2-ma4a24c40addc8', T9, f'{R9}/base/eliza'),
 ('amarylis', 'Amarylis', 'Studio Atrium', 'NEW-E', 'https://www.studioatrium.pl/projekty-domow/Amarylis,1216.html', T9, f'{R9}/newe/base/amarylis'),
 ('oban', 'Oban III', 'Lipińscy', 'NEW-E', 'https://lipinscy.pl/projekt/oban-iii', T9, f'{R9}/newe/base/oban'),
 ('juliusz', 'Juliusz Nowy', 'Dobre Domy', 'NEW-E', 'https://www.dobredomy.pl/projekt/juliuszNowy', T9, f'{R9}/newe/base/juliusz'),
]
houses = []
for house, title, pub, st, url, cache, old in H:
    new = f'{R9}/newe/final/{house}' if st == 'NEW-E' else f'{FIN}/{house}'
    live = st == 'NEW-E'
    vs = [{'key': 'baseline1351', 'label': 'kod APK 1351 (baseline)', 'kind': 'LIVE' if st != 'DEV' else 'REPLAY', 'run': old, 'commit': BASE}]
    if os.path.isdir(new): vs.append({'key': 'final', 'label': 'kod końcowy v3.54.19' + (' (na żywo, pierwszy bieg)' if live else ' (odczyty elewacji nagrane, recenzja na żywo)'), 'kind': 'LIVE' if live else 'REPLAY', 'run': new, 'commit': C})
    pkg = next((os.path.join(v['run'], 'source-package.json') for v in reversed(vs) if os.path.exists(os.path.join(v['run'], 'source-package.json'))), None)
    sk = next((v['run'] for v in reversed(vs) if os.path.isdir(os.path.join(v['run'], 'sketches'))), vs[-1]['run'])
    houses.append({'house': house, 'title': title, 'publisher': pub, 'set': st, 'url': url, 'package': pkg, 'cache': cache, 'sketchRun': sk, 'variants': vs})
print(json.dumps({'commit': C, 'title': 'BuildPlan v3.54.19 — bryła, otwory i wnętrze z rzutu: 1351 obok kodu końcowego', 'houses': houses, 'extras': {}}, ensure_ascii=False, indent=1))
