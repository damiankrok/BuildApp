#!/usr/bin/env python3
"""v3.54.15 — the private ZIP: models and scenes, sketches (4 sides × 6 houses, raw/normalized/rejected), gallery, boards,
raw and canonical answers, sources (publisher pictures and pages: private), references, fact traces, test records,
ledger, reports and the APK. Files are written straight into the ZIP under their archive names (no staging copy), with
MANIFEST.sha256 listing every member. The caller scans for the key separately; nothing here reads it.
    /usr/bin/python3 -I assemble-zip.py <out.zip> <repo> <rd v35415 dir> <apk>
"""
import hashlib, json, os, sys, zipfile

out, repo, rd, apk = sys.argv[1:]
members = []  # (arcname, path)
def add(arc, path):
    if os.path.isfile(path): members.append((arc, path))
def add_tree(arc, root, skip=()):
    if not os.path.isdir(root): return
    for d, _, fs in os.walk(root):
        for f in sorted(fs):
            p = os.path.join(d, f)
            if any(s in p for s in skip): continue
            members.append((os.path.join(arc, os.path.relpath(p, root)), p))

# deliverables already assembled
add(f'gallery.html', os.path.join(rd, 'delivery', 'gallery.html'))
add_tree('sketches', os.path.join(rd, 'delivery', 'sketches'))
add_tree('sources/elevations', os.path.join(rd, 'delivery', 'sources'))
add_tree('boards', os.path.join(rd, 'delivery', 'boards'))
# runs: models, scenes, answers (raw + canonical), traces, audits — the delivered and compared variants
RUNS = {
    'ballina/L-MS-delivered': 'ballina/LMS-r2', 'ballina/L-MS-live-cached': 'ballina/LMS-cache', 'ballina/L-MS-live-uncached': 'ballina/LMS-live',
    'ballina/L-M': 'ballina/LM2', 'ballina/L-M-fresh-strict': 'ballina/LM-fresh', 'ballina/L-M-fresh-nonstrict': 'ballina/LM-fresh-nostrict', 'ballina/loop-probe': 'ballina/loop-probe',
    'bakopy/L-MS-delivered': 'bakopy/LMS-live', 'bakopy/L-M': 'bakopy/LM-v15', 'bakopy/L-MS-final-replay': 'bakopy/LMS-final',
    'murcja/L-MS-first-result': 'control/LMS-live', 'murcja/L-M': 'control/LM-r', 'murcja/L-MS-final-replay': 'control/LMS-final',
    'coastal/L-MS-live': 'coastal/LMS-live', 'coastal/L-M-ftin-replay': 'coastal/LM-r', 'kardamon/L-MS-live': 'kardamon/LMS-live',
    'marcowki/appearance-regression': 'marcowki/C-fix',
}
for arc, d in RUNS.items():
    add_tree(f'runs/{arc}', os.path.join(rd, d), skip=('observation-graph.json', 'events.json'))
for h in ('coastal', 'kardamon', 'murcja', 'marcowki'):
    add_tree(f'runs/{h}/sketch-only', os.path.join(rd, h, 'sketch-only'))
add('runs/murcja/control-selection.json', os.path.join(rd, 'control', 'acq', 'selection.json'))
add('runs/murcja/murcja.package.json', os.path.join(rd, 'control', 'acq', 'murcja.package.json'))
# host E2E records (no data dir secrets: job records, books journal, summaries)
for h in ('host-e2e', 'host-e2e-final', 'host-e2e-final2'):
    add_tree(f'host/{h}', os.path.join(rd, h))
for h in ('host-data-final2',):
    add(f'host/{h}/house-reader-spend.journal.jsonl', os.path.join(rd, h, 'house-reader-spend.journal.jsonl'))
# references, cases, results, tests' records, ledger, reports (from the repository)
R = os.path.join(repo, 'research', 'source-to-model')
for f in ('refs/ballina.json', 'refs/bakopy.json', 'manual-ballina.json', 'manual-bakopy.json'):
    add(f'references/v35414/{f}', os.path.join(R, 'v35414', f))
add_tree('research-v35415', os.path.join(R, 'v35415'))
add('ledger/spend-ledger-v35415.json', os.path.join(repo, 'research', 'ai-assist', 'spend-ledger-v35415.json'))
for f in ('stage-reports/SOURCE_TO_MODEL_V35415.md', 'stage-reports/README_V35415.md', 'docs/ADR-V35415-RESPONSE-CONTRACT-LEVELS-CACHE.md', 'PROJECT_STATUS.md', 'docs/MASTER_PLAN.md'):
    add(f'reports/{os.path.basename(f)}', os.path.join(repo, f))
for f in ('ballina-v35415.model.json', 'murcja-v35415.model.json'):
    add(f'models/sealed/{f}', os.path.join(repo, 'packages', 'candidates', 'src', 'owner-v35415', f))
for f in ('ballina-v35415.scene.json', 'murcja-v35415.scene.json', 'index.json'):
    add(f'scenes/{f}', os.path.join(repo, 'apps', 'android', 'app', 'src', 'main', 'assets', 'scenes', f))
for f in ('vitest-full2.log', 'gradle-test2.log', 'gradle-apk2.log', 'recon-tests2.log', 'host-e2e-final2.log', 'host-e2e-final.log', 'host-e2e.log'):
    add(f'tests/{f}', os.path.join(rd, f))
add('apk/BuildPlan-Model-Preview-universal-debug-1346.apk', apk)

seen = set(); uniq = []
for a, p in members:
    if a in seen: continue
    seen.add(a); uniq.append((a, p))
manifest = []
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, allowZip64=True) as z:
    for a, p in uniq:
        data = open(p, 'rb').read()
        manifest.append(f'{hashlib.sha256(data).hexdigest()}  {a}')
        z.writestr(a, data, compress_type=zipfile.ZIP_STORED if a.endswith(('.apk', '.png', '.jpg', '.zip')) else zipfile.ZIP_DEFLATED)
    z.writestr('MANIFEST.sha256', '\n'.join(manifest) + '\n')
    z.writestr('README.txt', 'BuildPlan v3.54.15 — private package (not for publication: publisher drawings and pages inside).\n'
               'Open gallery.html offline; sketches/<house>/{FRONT,RIGHT,REAR,LEFT}.png; boards/<house>/; runs/ (raw and canonical answers, models, scenes, traces);\n'
               'apk/ (versionCode 1346, built from 5d4321c); reports/; ledger/. Verify: sha256sum -c MANIFEST.sha256 after unpacking.\n')
print(len(uniq), 'members')
