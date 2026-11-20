#!/usr/bin/env python3
"""v3.54.17 — the private ZIP: frozen bytes of the cases (plans, sections, elevations, pages: the run caches), raw and
canonical answers, observations, hypotheses, commands and executor records, models and scenes before/after/delivered,
the trial's first results, host records, tests, ledger, reports, the APK, four-side sketches, gallery and boards.
Written straight into the ZIP with MANIFEST.sha256; the caller scans for the key separately; nothing here reads it.
    /usr/bin/python3 -I assemble-zip.py <out.zip> <repo> <rd v35417 dir> <apk>
"""
import hashlib, os, sys, zipfile

out, repo, rd, apk = sys.argv[1:]
RD = os.path.dirname(rd)
members = []
def add(arc, path):
    if os.path.isfile(path): members.append((arc, path))
def add_tree(arc, root, skip=()):
    if not os.path.isdir(root): return
    for d, _, fs in os.walk(root):
        for f in sorted(fs):
            p = os.path.join(d, f)
            if any(s in p for s in skip): continue
            members.append((os.path.join(arc, os.path.relpath(p, root)), p))

add('gallery.html', os.path.join(rd, 'delivery', 'gallery.html'))
add_tree('sketches', os.path.join(rd, 'delivery', 'sketches'))
add_tree('sources/elevations', os.path.join(rd, 'delivery', 'sources'))
add_tree('boards', os.path.join(rd, 'delivery', 'boards'))
# runs: answers (raw + canonical), executor records (hypotheses, commands, measures), models, scenes
RUNS = {
    'alaska/dev-replay-set-roof': 'dev/alaska', 'alaska/dev-live-reviewer': 'dev/alaska-check', 'layla/dev-no-model': 'dev/layla',
    'ballina/replay-10-decisions': 'replay/ballina-3', 'layla/local-diagnosis': 'diag/layla', 'alaska/local-diagnosis': 'diag/alaska',
    'trial/aurora-midi-ii/local-diagnosis': 'diag/aurora-midi', 'trial/aurora-midi-ii/consult-offline': 'diag/aurora-midi-consult',
}
for arc, d in RUNS.items():
    add_tree(f'runs/{arc}', os.path.join(rd, d), skip=('observation-graph.json',))
# frozen source bytes (pages, plans, sections, elevations) as the runs read them
add_tree('frozen-bytes/v35416-trial-alaska-layla', os.path.join(RD, 'v35416', 'trial', 'cache'))
add_tree('frozen-bytes/v35417-trial-aurora', os.path.join(rd, 'trial', 'cache'))
add_tree('frozen-bytes/ballina', os.path.join(RD, 'v35414', 'ballina-cache'))
for f in os.listdir(os.path.join(rd, 'trial')):
    if f.endswith(('.package.json', '.json', '.log')): add(f'runs/trial/{f}', os.path.join(rd, 'trial', f))
# the recorded answers the DEV replays consumed (v3.54.16 trial, v3.54.14/15 Ballina)
for f in ('turns.json', 'sketch-turns.json', 'check-turns.json', 'sketches.json', 'sketches-without-model.json'):
    add(f'answers/v35416-trial-alaska/{f}', os.path.join(RD, 'v35416', 'trial', 'alaska', f))
    add(f'answers/v35416-trial-layla/{f}', os.path.join(RD, 'v35416', 'trial', 'layla', f))
add('answers/ballina/metric-turns-v35414.json', os.path.join(RD, 'v35414', 'ballina', 'LM', 'turns.json'))
add('answers/ballina/sketch-turns-v35415.json', os.path.join(RD, 'v35415', 'ballina', 'LMS-live', 'sketch-turns.json'))
# host E2E (one commit): job records, served results, models, scenes, books journal
add_tree('host/out', os.path.join(rd, 'host', 'out'))
add('host/data/house-reader-spend.journal.jsonl', os.path.join(rd, 'host', 'data', 'house-reader-spend.journal.jsonl'))
add('host/data/house-reader-spend.json', os.path.join(rd, 'host', 'data', 'house-reader-spend.json'))
add_tree('research-v35417', os.path.join(repo, 'research', 'source-to-model', 'v35417'))
add('ledger/spend-ledger-v35417.json', os.path.join(repo, 'research', 'ai-assist', 'spend-ledger-v35417.json'))
for f in ('stage-reports/SOURCE_TO_MODEL_V35417.md', 'stage-reports/README_V35417.md', 'docs/ADR-V35417-MASSING-ROOF-WITNESS.md', 'PROJECT_STATUS.md', 'docs/MASTER_PLAN.md'):
    add(f'reports/{os.path.basename(f)}', os.path.join(repo, f))
S = os.path.join(repo, 'apps', 'android', 'app', 'src', 'main', 'assets', 'scenes')
for f in os.listdir(os.path.join(repo, 'packages', 'candidates', 'src', 'owner-v35417')):
    add(f'models/sealed/{f}', os.path.join(repo, 'packages', 'candidates', 'src', 'owner-v35417', f))
    add(f'scenes/{f.replace(".model.json", ".scene.json")}', os.path.join(S, f.replace('.model.json', '.scene.json')))
add('models/before/alaska-trial-v35416.model.json', os.path.join(repo, 'packages', 'candidates', 'src', 'owner-v35416', 'alaska-trial-v35416.model.json'))
add('scenes/index.json', os.path.join(S, 'index.json'))
for f in ('matrix/freeze.txt', 'matrix/final.txt', 'gradle-apk.log', 'gradle-test.log', 'alaska-check.log', 'layla.log', 'replay-ballina3.log', 'diag-aurora-midi.log', 'diag-aurora-midi-consult.log'):
    add(f'tests/{os.path.basename(f)}', os.path.join(rd, f if '/' in f else f))
for f in ('dev/alaska.log', 'dev/alaska-check.log', 'dev/layla.log'):
    add(f'tests/{f.replace("/", "-")}', os.path.join(rd, f))
add('apk/BuildPlan-Model-Preview-1348-arm64-v8a.apk', apk)

seen = set(); uniq = []
for a, p in members:
    if a in seen: continue
    seen.add(a); uniq.append((a, p))
manifest = []
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, allowZip64=True) as z:
    for a, p in uniq:
        data = open(p, 'rb').read()
        manifest.append(f'{hashlib.sha256(data).hexdigest()}  {a}')
        z.writestr(a, data, compress_type=zipfile.ZIP_STORED if a.endswith(('.apk', '.png', '.jpg', '.zip', '.bin')) else zipfile.ZIP_DEFLATED)
    z.writestr('MANIFEST.sha256', '\n'.join(manifest) + '\n')
    z.writestr('README.txt', 'BuildPlan v3.54.17 — private package (not for publication: publisher drawings and pages inside).\n'
               'gallery.html offline; sketches/<house>/{FRONT,RIGHT,REAR,LEFT}.{png,svg,json}; boards/alaska/ (before v3.54.16 | delivered v3.54.17);\n'
               'runs/ (raw and canonical answers, executor records with hypotheses/commands/measures, models, scenes); frozen-bytes/ (the caches the runs read);\n'
               'answers/ (recorded turns the replays consumed); host/ (one-commit E2E on 14a34bf); apk/ (versionCode 1348); reports/; ledger/.\n'
               'Verify after unpacking: sha256sum -c MANIFEST.sha256\n')
print(len(uniq), 'members')
