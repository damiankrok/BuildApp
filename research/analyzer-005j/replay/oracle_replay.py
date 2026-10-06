#!/usr/bin/env python3
"""oracle_replay.py - would a perfect gap witness move the outcome? (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J)

    python3 oracle_replay.py setup  --repo <BuildApp> --work <dir>
    python3 oracle_replay.py run    --repo <BuildApp> --work <dir> --runs <sealed run dirs, comma-separated>
                                    --cache <byte cache> --modes OFF,ALL_DRAWN [--ids <gap ids>] [--tag <name>]
    python3 oracle_replay.py report --repo <BuildApp> --work <dir> --runs <sealed run dirs> --out <json>

Post-review (A1, E4): the 005J recommendation must not claim that a gap witness moves a house without a replay. This
re-solves sealed runs with the FROZEN production code, except that `boundary-evidence.ts` is replaced - inside the
replay process only, through a Vite alias, never in the repository - by a copy whose `classifyGap` is wrapped:

  ORACLE_WITNESS=OFF        the copy behaves exactly like production (the OFF run must reproduce the sealed model hash)
  ORACLE_WITNESS=ALL_DRAWN  every WEAK gap between two WALL jambs whose signature is not BLANK becomes STRONG
                            (OPENING_SUPPORTED): the upper bound of an upgrade-only, two-signal witness (drawn evidence
                            plus a model reading OPENING). BLANK gaps and wide OPEN_SIDE gaps are never touched.
  ORACLE_WITNESS=ONLY       only the gap ids in ORACLE_IDS are upgraded (a targeted, truth-checked oracle)
  ORACLE_WITNESS=EXCLUDE    every eligible gap except ORACLE_IDS (e.g. a gap the 005I diagnosis says is open)

Each run re-solves from the sealed source package, observation graph and metric evidence
(`second-house.ts --package --graph --metrics --cache`), so OCR and metric are held fixed. The holdout verdict comes from
`holdout/verdict.mjs`. Nothing here writes to the repository.
"""
import argparse
import json
import os
import subprocess
import time

WRAP = '''// ---- 005J RESEARCH REPLAY ONLY (generated outside the repository by oracle_replay.py) ----
function classifyGap(mask: Mask, axis: 'X' | 'Y', linePx: number, left: LinePiece, right: LinePiece, options: WallLineOptions, ends?: { left: boolean; right: boolean }): BoundaryGap {
  const g = classifyGapBase(mask, axis, linePx, left, right, options, ends)
  const mode = process.env.ORACLE_WITNESS ?? 'OFF'
  if (mode === 'OFF' || g.boundary !== 'WEAK' || g.jambs[0] !== 'WALL' || g.jambs[1] !== 'WALL' || g.signature === 'BLANK') return g
  const ids = (process.env.ORACLE_IDS ?? '').split(',').filter(Boolean)
  const upgrade = mode === 'ALL_DRAWN' || (mode === 'ONLY' && ids.includes(g.id)) || (mode === 'EXCLUDE' && !ids.includes(g.id))
  if (!upgrade) return g
  process.stderr.write(`ORACLE_UPGRADE ${g.id} ${g.signature} ${g.widthM}\\n`)
  return { ...g, cls: 'OPENING_SUPPORTED', boundary: 'STRONG', occupancy: 'OPENING', why: `${g.why}; ORACLE witness (005J replay): an opening` }
}

function classifyGapBase('''
SIG = "function classifyGap(mask: Mask, axis: 'X' | 'Y', linePx: number, left: LinePiece, right: LinePiece, options: WallLineOptions, ends?: { left: boolean; right: boolean }): BoundaryGap {"


def setup(a):
    src = open(os.path.join(a.repo, 'packages/reconstruction/src/boundary-evidence.ts')).read()
    assert src.count(SIG) == 1, 'classifyGap signature changed - update the replay'
    os.makedirs(a.work, exist_ok=True)
    patched = src.replace(SIG, WRAP + SIG[len('function classifyGap('):])
    open(os.path.join(a.work, 'boundary-evidence.oracle.ts'), 'w').write(patched)
    pk = lambda p: os.path.join(a.repo, 'packages', p, 'src/index.ts')
    open(os.path.join(a.work, 'vite.config.mjs'), 'w').write(
        "export default { resolve: { alias: [\n"
        f"  {{ find: /^\\.\\/boundary-evidence\\.js$/, replacement: '{os.path.join(a.work, 'boundary-evidence.oracle.ts')}' }},\n"
        f"  {{ find: /^@buildapp\\/source-common$/, replacement: '{pk('source-common')}' }},\n"
        f"  {{ find: /^@buildapp\\/source-cv$/, replacement: '{pk('source-cv')}' }},\n"
        "] } }\n")
    print('wrote', a.work)


def run(a):
    out_dir = os.path.join(a.work, a.tag)
    os.makedirs(out_dir, exist_ok=True)
    for d in a.runs.split(','):
        h = os.path.basename(d.rstrip('/'))
        if not all(os.path.exists(os.path.join(d, f)) for f in ('source-package.json', 'observation-graph.json', 'metric-evidence.json')):
            continue
        for mode in a.modes.split(','):
            out = os.path.join(out_dir, f'{h}-{mode}')
            env = dict(os.environ, ORACLE_WITNESS=mode, ORACLE_IDS=a.ids or '')
            t0 = time.time()
            with open(out + '.log', 'w') as log:
                subprocess.run(['npx', 'vite-node', '--config', os.path.join(a.work, 'vite.config.mjs'), 'packages/analysis-service/scripts/second-house.ts', '--',
                                '--package', os.path.join(d, 'source-package.json'), '--graph', os.path.join(d, 'observation-graph.json'),
                                '--metrics', os.path.join(d, 'metric-evidence.json'), '--cache', a.cache, '--out', out], cwd=a.repo, env=env, stdout=log, stderr=subprocess.STDOUT)
            print(h, mode, round(time.time() - t0, 1), 's')


def verdict(repo, run_dir):
    p = subprocess.run(['node', 'holdout/verdict.mjs', run_dir], cwd=repo, capture_output=True, text=True)
    try:
        v = json.loads(p.stdout)
    except ValueError:
        return None
    c = v.get('conditions') or {}
    return {'verdict': v.get('verdict'), 'completed': v.get('completed'), 'footprint': (c.get('footprint') or {}).get('residualPct'),
            'failing': sorted(k for k, x in c.items() if isinstance(x, dict) and x.get('holds') is False)}


def summary(run_dir):
    f = os.path.join(run_dir, 'result-summary.json')
    if os.path.exists(f):
        s = json.load(open(f))
        return {'outcome': s.get('outcome'), 'modelHash': s.get('modelHash')}
    return {'outcome': 'FAILED', 'modelHash': None}


def report(a):
    rows = []
    for d in a.runs.split(','):
        h = os.path.basename(d.rstrip('/'))
        sealed = summary(d)
        row = {'house': h, 'sealed': {**sealed, **(verdict(a.repo, d) or {})}}
        for tag in sorted(os.listdir(a.work)):
            base = os.path.join(a.work, tag)
            if not os.path.isdir(base):
                continue
            for name in sorted(os.listdir(base)):
                if name.startswith(h + '-') and os.path.isdir(os.path.join(base, name)):
                    mode = name[len(h) + 1:]
                    log = os.path.join(base, name + '.log')
                    ups = sum(1 for l in open(log) if l.startswith('ORACLE_UPGRADE')) if os.path.exists(log) else None
                    row[f'{tag}/{mode}'] = {**summary(os.path.join(base, name)), **(verdict(a.repo, os.path.join(base, name)) or {}), 'upgrades': ups}
        rows.append(row)
    json.dump({'stage': 'BUILDPLAN-ANALYZER-005J', 'kind': 'research replay - production unchanged', 'rows': rows}, open(a.out, 'w'), indent=1)
    print('wrote', a.out, len(rows), 'rows')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['setup', 'run', 'report'])
    ap.add_argument('--repo', required=True)
    ap.add_argument('--work', required=True)
    ap.add_argument('--runs', default='')
    ap.add_argument('--cache', default=None)
    ap.add_argument('--modes', default='OFF,ALL_DRAWN')
    ap.add_argument('--ids', default=None)
    ap.add_argument('--tag', default='replay')
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    {'setup': setup, 'run': run, 'report': report}[a.cmd](a)


if __name__ == '__main__':
    main()
