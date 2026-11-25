#!/usr/bin/env python3
"""v3.54.20 — the delivery manifest: per house the model of the APK 1352 code (af7db0e) beside the final code's, on the
same source bytes. DEV = the 20 houses of v3.54.19: the 1352 variant is that stage's final run; the final variant replays
the same recorded elevation sketches and metric read, with the structure read and the new plan-gap lists read live once.
NEW-G (newg/houses.json): baseline and freeze 1 live, once each; the delivered code (freeze 2) replayed on freeze 1's recorded reads. Private work dirs, not in Git.
    manifest.py <final code commit> <DEV final run root> > manifest.json"""
import json, os, sys
C, FIN = sys.argv[1], sys.argv[2]
R9, R0 = '/home/user/rd/v35419', '/home/user/rd/v35420'
BASE = 'af7db0e'
old = json.load(open(f'{R9}/manifest.json'))
houses = []
for h in old['houses']:
    b = [v for v in h['variants'] if v['key'] == 'final'][0]
    vs = [{'key': 'baseline1352', 'label': 'kod APK 1352 (baseline)', 'kind': b['kind'], 'run': b['run'], 'commit': BASE}]
    new = f"{FIN}/{h['house']}"
    if os.path.isdir(new): vs.append({'key': 'final', 'label': 'kod końcowy v3.54.20 — te same nagrane szkice i odczyt metryczny; odczyt struktury i listy otworów na żywo', 'kind': 'REPLAY', 'run': new, 'commit': C})
    sk = next((v['run'] for v in reversed(vs) if os.path.isdir(os.path.join(v['run'], 'sketches'))), vs[-1]['run'])
    pkg = next((os.path.join(v['run'], 'source-package.json') for v in reversed(vs) if os.path.exists(os.path.join(v['run'], 'source-package.json'))), h['package'])
    houses.append({'house': h['house'], 'title': h['title'], 'publisher': h['publisher'], 'set': 'DEV', 'was': h['set'], 'url': h['url'], 'package': pkg, 'cache': h['cache'], 'sketchRun': sk, 'variants': vs})
if os.path.exists(f'{R0}/newg/houses.json'):
    for q in json.load(open(f'{R0}/newg/houses.json')):
        vs = []
        F1 = '024e2b7'
        for key, label, kind, d, c in (
                ('baseline1352', 'kod APK 1352 (baseline) — na żywo, jedyny bieg', 'LIVE', f"{R0}/newg/base/{q['house']}", BASE),
                ('final', 'kod oddawany (zamrożenie 2) — odtworzony na nagranych odczytach biegu F', 'REPLAY', f"{R0}/newg/final2/{q['house']}", C),
                ('frozen1', 'zamrożenie 1 — na żywo, jedyny bieg (pierwszy wynik odłożony, F)', 'LIVE', f"{R0}/newg/final/{q['house']}", F1),
                ('finalOnBase', 'kod oddawany na nagranych odczytach biegu baseline (F2@B, pomocnicze)', 'REPLAY', f"{R0}/newg/fonb2/{q['house']}", C)):
            if os.path.exists(d + '/result.json') and not (key == 'finalOnBase' and os.environ.get('NO_AUX')): vs.append({'key': key, 'label': label, 'kind': kind, 'run': d, 'commit': c})
        if not vs: continue
        fin = [v for v in vs if v['key'] == 'final'] or vs
        sk = next((v['run'] for v in reversed(fin) if os.path.isdir(os.path.join(v['run'], 'sketches'))), vs[-1]['run'])
        pkg = next((os.path.join(v['run'], 'source-package.json') for v in reversed(vs) if os.path.exists(os.path.join(v['run'], 'source-package.json'))), q.get('package'))
        houses.append({'house': q['house'], 'title': q['title'], 'publisher': q['publisher'], 'set': 'NEW-G', 'url': q['url'], 'package': pkg, 'cache': f'{R0}/newg/trial/cache', 'sketchRun': sk, 'variants': vs})
print(json.dumps({'commit': C, 'title': 'BuildPlan v3.54.20 — opis struktury z API steruje budową bryły: 1352 obok kodu końcowego', 'houses': houses, 'extras': {}}, ensure_ascii=False, indent=1))
