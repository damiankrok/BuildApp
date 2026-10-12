#!/usr/bin/env python3
"""export_artifacts.py - BUILDPLAN-ANALYZER-005O: committed text/JSON artifacts from the outside-the-repo work dir.

  python3 -I research/analyzer-005o/export_artifacts.py --work /home/user/work005o --out stage-reports/artifacts/analyzer-005o

Writes (numbers, ids and hashes only - no pixel, no crop, no page text):
  source-inventory.json       every case: inputs, SHA-256 of the sealed metric evidence / package / graph, cache, family
  numeric-candidate-ledger.json  every statement with a transcription truth: its candidates by source, the readers'
                              values, the truth (scorer field), binding consistency, and each variant's as-printed list
  chain-constraints.json      every segment-sum equation M2/M3 formed, and its status
  performance.json            replay wall time / peak RSS per variant, the re-read's cold/warm timings (Node 22, 18)
"""
import argparse, glob, hashlib, json, os, re, statistics
from collections import Counter, defaultdict

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VARIANTS = ['M1', 'M2', 'M3', 'M1P', 'M1b', 'M3b']


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    cases = json.load(open(os.path.join(REPO, 'research/analyzer-005o/cases.json')))['cases']
    idx = json.load(open(os.path.join(a.work, 'byte-index.json')))
    # ---- source inventory ------------------------------------------------------------------------------------------
    inv = []
    for c in cases:
        pkg = json.load(open(c['package']))
        variants = [v['byteHash'] for asst in pkg['assets'] for v in asst['variants']]
        inv.append({'case': c['case'], 'set': c.get('set'), 'family': c['family'], 'canonicalUrl': pkg.get('canonicalUrl'),
                    'metricEvidenceSha256': sha(c['metrics']), 'sourcePackageSha256': sha(c['package']), 'observationGraphSha256': sha(c['graph']),
                    'metricSchemaVersion': json.load(open(c['metrics'])).get('schemaVersion'), 'cacheDir': c['cache'], 'rasterVariants': len(variants),
                    'rasterVariantsInCache': sum(1 for h in variants if h in idx), 'pdfAssets': sum(1 for asst in pkg['assets'] for v in asst['variants'] if 'pdf' in (v.get('mediaType') or '')),
                    'dropFrames': c.get('dropFrames', [])})
    json.dump({'schema': 'buildapp.005o.source-inventory', 'note': 'paths are outside the repository (sealed runs and byte caches with publisher bytes; never committed)', 'cases': inv},
              open(os.path.join(a.out, 'source-inventory.json'), 'w'), indent=1, sort_keys=True)
    # ---- ledger ----------------------------------------------------------------------------------------------------
    rows = json.load(open(os.path.join(a.work, 'label-rows.json')))
    rec = {v: {} for v in VARIANTS}
    eqs = defaultdict(list)
    for v in VARIANTS:
        for f in glob.glob(os.path.join(a.work, 'views', v, '*.json')):
            d = json.load(open(f))
            for r in d['records']:
                if 'evidenceId' in r:
                    rec[v][(d['case'], r['evidenceId'])] = r
                elif v in ('M2', 'M3') and r.get('equations'):
                    eqs[v].append({'case': d['case'], 'frame': r['frame'], 'equations': r['equations']})
    ledger = []
    for r in rows:
        k = (r['case'], r['evidenceId'])
        m1 = rec['M1'].get(k, {})
        ledger.append({**{x: r[x] for x in ('case', 'family', 'evidenceId', 'frame', 'axis', 'chain', 'px', 'origin', 'value', 'token', 'latticeAsRead', 'latticeConfident', 'externalTop', 'externalCorroborating', 'ensembleReading', 'ensembleDecision', 'hasLattice', 'topKRecall', 'boundConsistent')},
                       'candidates': m1.get('candidates'), 'frozenAsRead': m1.get('frozen', {}).get('asRead'),
                       'variants': {v: {'rule': rec[v].get(k, {}).get('rule'), 'asRead': rec[v].get(k, {}).get('asRead')} for v in VARIANTS},
                       'truthForScorerOnly': r['truth']})
    json.dump({'schema': 'buildapp.005o.numeric-candidate-ledger', 'statements': len(ledger), 'note': 'truthForScorerOnly is the blind double transcription; it never reached a view generator', 'ledger': ledger},
              open(os.path.join(a.out, 'numeric-candidate-ledger.json'), 'w'), indent=0, sort_keys=True)
    st = {v: Counter(e['status'] for blk in eqs[v] for e in blk['equations']) for v in ('M2', 'M3')}
    json.dump({'schema': 'buildapp.005o.chain-constraints', 'statusCounts': {v: dict(c) for v, c in st.items()}, 'frames': {v: eqs[v] for v in ('M2', 'M3')}},
              open(os.path.join(a.out, 'chain-constraints.json'), 'w'), indent=0, sort_keys=True)
    # ---- performance -----------------------------------------------------------------------------------------------
    perf = {}
    for d in sorted(glob.glob(os.path.join(a.work, 'runs', '*'))):
        label = os.path.basename(d)
        walls, rss = {}, {}
        for lg in glob.glob(os.path.join(d, '*.log')):
            t = open(lg).read().strip().splitlines()[-1]
            m = re.search(r'wall ([\d.]+) peakRssKb (\d+)', t)
            if m:
                walls[os.path.basename(lg)[:-4]] = float(m.group(1))
                rss[os.path.basename(lg)[:-4]] = int(m.group(2))
        if walls:
            w = sorted(walls.values())
            perf[label] = {'n': len(w), 'wallMedianS': round(statistics.median(w), 2), 'wallP95S': round(w[int(0.95 * (len(w) - 1))], 2), 'wallTotalS': round(sum(w), 1),
                           'peakRssMedianMb': round(statistics.median(rss.values()) / 1024, 1), 'peakRssMaxMb': round(max(rss.values()) / 1024, 1), 'perCase': walls}
    base = perf.get('M0H', {}).get('perCase', {})
    for label, p in perf.items():
        if label in ('M0-frozen', 'M0H') or not base:
            continue
        ratios = [p['perCase'][c] / base[c] for c in p['perCase'] if c in base and base[c] > 0]
        p['medianRatioVsM0H'] = round(statistics.median(ratios), 3) if ratios else None
    rr = {}
    for f, node in (('reread.json', 'node22'), ('reread-node18.json', 'node18')):
        p = os.path.join(a.work, f)
        if os.path.exists(p):
            d = json.load(open(p))
            rr[node] = {'node': d['node'], 'validation': {k: d['validation'][k] for k in ('asked', 'read', 'valid')}, 'mismatches': len(d['validation']['mismatches']), 'timing': d['timing'], 'jobs': d['jobs'], 'missing': len(d['missing'])}
    json.dump({'schema': 'buildapp.005o.performance', 'machine': 'x86_64 container, 4 cores (Intel Xeon 2.8 GHz), 15 GiB; NOT a phone - no Android or ARM64 figure is measured or implied',
               'replays': {k: {x: y for x, y in v.items() if x != 'perCase'} for k, v in perf.items()}, 'replayPerCase': {k: v['perCase'] for k, v in perf.items()}, 'reread': rr},
              open(os.path.join(a.out, 'performance.json'), 'w'), indent=1, sort_keys=True)
    print('wrote inventory', len(inv), 'ledger', len(ledger), 'equations', {v: sum(c.values()) for v, c in st.items()}, 'perf', list(perf))


if __name__ == '__main__':
    main()
