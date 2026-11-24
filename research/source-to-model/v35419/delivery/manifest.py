#!/usr/bin/env python3
"""v3.54.19 — the delivery manifest: per house the model of the frozen 1351 code beside the final code's, on the same source
bytes. DEV (nine known houses) and NEW-D replay their recorded elevation readings. NEW-E was live on the baseline and on
freeze 1, once each (the first held-out measurement, kept as its own variant); after it was opened it is developmental and
its final variant is freeze 2 on the freeze-1 recordings. NEW-F (newf/houses.json) is live on the baseline and on freeze 2,
once each. Private work dirs, not in Git.
    manifest.py <final code commit> <DEV/NEW-D final run root> [<NEW-E final run root>] > manifest.json"""
import json, os, sys
C, FIN = sys.argv[1], sys.argv[2]
FIN_E = sys.argv[3] if len(sys.argv) > 3 else None
FREEZE1 = '4c2c73e'
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
if os.path.exists(f'{R9}/newf/houses.json'):
    for q in json.load(open(f'{R9}/newf/houses.json')): H.append((q['house'], q['title'], q['publisher'], 'NEW-F', q['url'], f'{R9}/newf/trial/cache', f"{R9}/newf/base/{q['house']}"))
houses = []
for house, title, pub, st, url, cache, old in H:
    new = f'{R9}/newf/final/{house}' if st == 'NEW-F' else (f'{FIN_E}/{house}' if FIN_E else f'{R9}/newe/final/{house}') if st == 'NEW-E' else f'{FIN}/{house}'
    live = st == 'NEW-F' or (st == 'NEW-E' and not FIN_E)
    vs = [{'key': 'baseline1351', 'label': 'kod APK 1351 (baseline)', 'kind': 'LIVE' if st != 'DEV' else 'REPLAY', 'run': old, 'commit': BASE}]
    if st == 'NEW-E' and FIN_E and os.path.isdir(f'{R9}/newe/final/{house}'): vs.append({'key': 'freeze1', 'label': 'zamrożenie 1 (pierwszy pomiar odłożony, na żywo)', 'kind': 'LIVE', 'run': f'{R9}/newe/final/{house}', 'commit': FREEZE1})
    if os.path.isdir(new): vs.append({'key': 'final', 'label': 'kod końcowy v3.54.19 (zamrożenie 2)' + (' — na żywo, jedyny bieg' if live else ' — nagrania biegu zamrożenia 1, odczyty przerw rzutu i recenzja na żywo' if st == 'NEW-E' else ' — odczyty i recenzja nagrane'), 'kind': 'LIVE' if live else 'REPLAY', 'run': new, 'commit': C})
    pkg = next((os.path.join(v['run'], 'source-package.json') for v in reversed(vs) if os.path.exists(os.path.join(v['run'], 'source-package.json'))), None)
    if pkg is None: pkg = {'oban': f'{R9}/trial/lipinscy-oban.package.json', 'juliusz': f'{R9}/trial/dobredomy-juliusznowy.package.json', 'amarylis': f'{R9}/trial/studioatrium-amarylis.package.json', 'eliza': f'{R9}/trial/archon-projekt-willa-eliza.package.json'}.get(house)  # a house without a model in any variant: the package of the selection step (the same source bytes)
    sk = next((v['run'] for v in reversed(vs) if os.path.isdir(os.path.join(v['run'], 'sketches'))), vs[-1]['run'])
    houses.append({'house': house, 'title': title, 'publisher': pub, 'set': st, 'url': url, 'package': pkg, 'cache': cache, 'sketchRun': sk, 'variants': vs})
print(json.dumps({'commit': C, 'title': 'BuildPlan v3.54.19 — bryła, otwory i wnętrze z rzutu: 1351 obok kodu końcowego', 'houses': houses, 'extras': {}}, ensure_ascii=False, indent=1))
