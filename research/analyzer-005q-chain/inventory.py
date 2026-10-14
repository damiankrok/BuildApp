#!/usr/bin/env python3
"""inventory.py - BUILDPLAN-ANALYZER-005Q-CHAIN frozen-input inventory (RESEARCH ONLY; never imported by production).

  python3 -I research/analyzer-005q-chain/inventory.py --out stage-reports/artifacts/analyzer-005q-chain/case-inventory/case-inventory.json

Per development row of research/analyzer-005q-chain/cases.json: SHA-256 of the sealed source package, observation
graph and sealed metric evidence; every asset variant the package names, with the cached publisher bytes found under
the row's cache (sha256(url)[:32].bin) and whether their SHA-256 equals the package's byteHash. Output: hashes, counts,
family and lineage only (no URL, no byte, no page text). A row whose input is missing is listed as MISSING, never
dropped.
"""
import argparse, hashlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def sha_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    cases_path = os.path.join(HERE, 'cases.json')
    cases = json.load(open(cases_path))['cases']
    rows = []
    for c in cases:
        r = {'case': c['case'], 'set': c['set'], 'family': c['family'], 'mode': c['mode'], 'dropFrames': len(c['dropFrames'])}
        missing = [k for k in ('package', 'graph', 'metrics') if not os.path.exists(c[k])]
        if missing:
            r['status'] = 'MISSING'
            r['missing'] = missing
            rows.append(r)
            continue
        r['packageSha256'] = sha_file(c['package'])
        r['graphSha256'] = sha_file(c['graph'])
        r['sealedMetricsSha256'] = sha_file(c['metrics'])
        pkg = json.load(open(c['package']))
        graph = json.load(open(c['graph']))
        r['packageContentHash'] = pkg.get('contentHash')
        r['graphContentHash'] = graph.get('contentHash')
        sealed = json.load(open(c['metrics']))
        r['sealedMetricsContentHash'] = sealed.get('contentHash')
        r['sealedMetricsSchemaVersion'] = sealed.get('schemaVersion')
        frames = graph.get('coordinateFrames', [])
        r['planFrames'] = sum(1 for f in frames if f['roles'].get('projection') == 'ORTHOGRAPHIC_PLAN')
        used = {f.get('variantByteHash') for f in frames}
        variants, ok, bad, absent = 0, 0, [], 0
        for asset in pkg['assets']:
            for v in asset['variants']:
                if v['byteHash'] not in used:
                    continue
                variants += 1
                p = os.path.join(c['cache'], hashlib.sha256(v['url'].encode()).hexdigest()[:32] + '.bin')
                if not os.path.exists(p):
                    absent += 1
                    continue
                if sha_file(p) == v['byteHash']:
                    ok += 1
                else:
                    bad.append(v['byteHash'][:12])
        r['frameVariants'] = variants
        r['cachedBytesMatching'] = ok
        r['cachedBytesAbsent'] = absent
        r['cachedBytesMismatching'] = bad
        r['status'] = 'COMPLETE' if variants == ok else 'INCOMPLETE_CACHE'
        rows.append(r)
    fams = {}
    for r in rows:
        fams.setdefault(r['family'], []).append(r['case'])
    out = {
        'schema': 'buildapp.005q-chain.case-inventory', 'version': 1,
        'casesJsonSha256': sha_file(cases_path),
        'rows': rows,
        'counts': {'rows': len(rows), 'complete': sum(1 for r in rows if r['status'] == 'COMPLETE'), 'extract': sum(1 for r in rows if r['mode'] == 'EXTRACT'), 'solveOnlyLegacy': sum(1 for r in rows if r['mode'] == 'SOLVE_ONLY_LEGACY'), 'families': len(fams)},
        'sameFamilyCopies': {f: cs for f, cs in sorted(fams.items()) if len(cs) > 1},
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, 'w'), indent=1, sort_keys=True)
    open(a.out, 'a').write('\n')
    print(json.dumps(out['counts']), [ (r['case'], r['status']) for r in rows if r['status'] != 'COMPLETE'])


if __name__ == '__main__':
    main()
