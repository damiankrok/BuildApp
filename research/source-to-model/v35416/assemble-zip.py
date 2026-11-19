#!/usr/bin/env python3
"""v3.54.16 — the private ZIP: models and scenes, sketches (4 sides × 7 houses, raw/normalized/rejected), gallery, boards,
raw and canonical answers, sources (publisher pictures and pages: private), references, fact traces, test records,
ledger, reports and the APK. Files are written straight into the ZIP under their archive names (no staging copy), with
MANIFEST.sha256 listing every member. The caller scans for the key separately; nothing here reads it.
    /usr/bin/python3 -I assemble-zip.py <out.zip> <repo> <rd v35416 dir> <apk>
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
# runs: models, scenes, answers (raw + canonical), executor records, quality, traces
RUNS = {
    'ballina/sketch-channel-replay': 'ballina/LMS-sk', 'ballina/review-loop-DEV-live': 'ballina/LMSC-live',
    'bakopy/sketch-channel-replay': 'bakopy/LMS-sk', 'murcja/sketch-channel-replay': 'murcja/LMS-sk',
    'coastal/no-model-replay': 'coastal/nomodel', 'kardamon/no-model-replay': 'kardamon/nomodel',
    'trial/layla-first-result': 'trial/layla', 'trial/alaska-first-result': 'trial/alaska',
}
for arc, d in RUNS.items():
    add_tree(f'runs/{arc}', os.path.join(rd, d), skip=('observation-graph.json', 'events.json'))
add('runs/trial/selection.json', os.path.join(rd, 'trial', 'selection.json'))
for f in os.listdir(os.path.join(rd, 'trial')):
    if f.endswith('.package.json'): add(f'runs/trial/{f}', os.path.join(rd, 'trial', f))
add_tree('proofs/frozen', os.path.join(rd, 'proofs-frozen'))
add_tree('proofs/overlays', os.path.join(rd, 'overlays'))
add_tree('decisions', os.path.join(rd, 'delivery', 'decisions'))
# host E2E records (job records, books journal, summaries; no key anywhere)
for h in ('host-e2e-1', 'host-e2e'):
    add_tree(f'host/{h}', os.path.join(rd, h))
for h in ('host-data', 'host-data-2'):
    add(f'host/{h}/house-reader-spend.journal.jsonl', os.path.join(rd, h, 'house-reader-spend.journal.jsonl'))
R = os.path.join(repo, 'research', 'source-to-model')
add_tree('research-v35416', os.path.join(R, 'v35416'))
add('ledger/spend-ledger-v35416.json', os.path.join(repo, 'research', 'ai-assist', 'spend-ledger-v35416.json'))
for f in ('stage-reports/SOURCE_TO_MODEL_V35416.md', 'stage-reports/README_V35416.md', 'docs/ADR-V35416-CORRECTION-EXECUTOR.md', 'PROJECT_STATUS.md', 'docs/MASTER_PLAN.md'):
    add(f'reports/{os.path.basename(f)}', os.path.join(repo, f))
for f in os.listdir(os.path.join(repo, 'packages', 'candidates', 'src', 'owner-v35416')):
    add(f'models/sealed/{f}', os.path.join(repo, 'packages', 'candidates', 'src', 'owner-v35416', f))
    add(f'scenes/{f.replace(".model.json", ".scene.json")}', os.path.join(repo, 'apps', 'android', 'app', 'src', 'main', 'assets', 'scenes', f.replace('.model.json', '.scene.json')))
add('scenes/index.json', os.path.join(repo, 'apps', 'android', 'app', 'src', 'main', 'assets', 'scenes', 'index.json'))
for f in ('vitest-final.log', 'vitest-full2.log', 'gradle-test.log', 'gradle-apk.log', 'host-e2e-1.log', 'host-e2e.log', 'trial/alaska.log', 'trial/layla.log', 'ballina-LMSC-live.log'):
    add(f'tests/{os.path.basename(f)}', os.path.join(rd, f))
add('apk/BuildPlan-Model-Preview-1347-arm64-v8a.apk', apk)

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
    z.writestr('README.txt', 'BuildPlan v3.54.16 — private package (not for publication: publisher drawings and pages inside).\n'
               'Open gallery.html offline; sketches/<house>/{FRONT,RIGHT,REAR,LEFT}.png; boards/<house>/; runs/ (raw and canonical answers, models, scenes, traces);\n'
               'apk/ (versionCode 1347, built from f75d205); decisions/ and proofs/ (executor records, overlays); reports/; ledger/. Verify: sha256sum -c MANIFEST.sha256 after unpacking.\n')
print(len(uniq), 'members')
