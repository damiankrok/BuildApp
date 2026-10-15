#!/usr/bin/env python3
"""
mutations.py — 005R mutation suite (RESEARCH ONLY). Preregistration §9: every safeguard must catch a planted defect.

    python3 -I mutations.py <run-dir> <assembled-dir> <out.json>

Each mutation plants one defect into a COPY of real 005R outputs (never into the committed files, except M11, which edits
the corpus manifest in the working tree, runs the isolation test and restores the file byte for byte) and records
which safeguard caught it. A mutation that is not caught is a FAILED safeguard and is reported as such.

  M1  scorer: truth/output swap — an oracle contender must score risk 0 / coverage 1; a permuted one must score > 0
  M2  split leak: an EVAL row read by a fit — the refit model's training count no longer equals the DEV group count
  M3  source swap on a real assembled document (evidence variant of another asset)            → validator IDENTITY
  M4  edition swap on a real assembled document (edition that does not publish the bytes)      → validator EDITION_MIX
  M5  fabricated box on a classifier-only document                                              → validator FABRICATED_BOX
  M6  class/name leakage: the edition slug written into a reason                                → validator LEAKAGE_TOKEN
  M7  false-confidence promotion: UNVALIDATED_SCORE → CALIBRATED, status → CONFIRMED            → validator CONFIDENCE/OBS
  M8  metric dimension from a render                                                            → validator METRIC
  M9  interior → exterior: interiors routed EXTERIOR_RENDER by a mutated router                 → truth gate count > 0
  M10 correlated witnesses counted twice in an edition summary                                  → validator CORRELATION
  M11 a caption field in the committed corpus manifest                                          → isolation test fails
  M12 a project name in the V2 prompts                                                          → isolation test fails
"""
import copy
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, 'schema'))
from validate import validate_document  # noqa: E402


def codes(errs):
    return sorted({e.split(' ')[0] for e in errs})


def score(truth_p, cont):
    with tempfile.TemporaryDirectory() as d:
        cp, op = os.path.join(d, 'c.json'), os.path.join(d, 'o.json')
        json.dump(cont, open(cp, 'w'))
        subprocess.run([sys.executable, '-I', os.path.join(HERE, 'score_roles.py'), truth_p, op, cp], check=True, capture_output=True)
        return json.load(open(op))['contenders'][cont['meta']['contender']]['EVAL']['lineageGroup']


def isolation_test(pattern):
    r = subprocess.run(['npx', '--no-install', 'vitest', 'run', 'tests/architecture/research-isolation.test.ts', '-t', pattern], cwd=REPO, capture_output=True, text=True)
    return r.returncode


def main(run, assembled, out):
    res = {}
    truth_p = os.path.join(run, 'truth.json')
    truth = json.load(open(truth_p))
    rows = [r for r in truth['rows'] if r['scoredSize']]
    # M1
    oracle = {'meta': {'contender': 'ORACLE'}, 'rows': [{'assetId': r['assetId'], 'role': r['roleTruth'], 'resolved': r['roleTruth'] not in ('UNKNOWN', 'TRUTH_CONFLICT', 'PICTORIAL_UNSPECIFIED'), 'score': 1.0} for r in rows]}
    o = score(truth_p, oracle)
    roles = sorted({r['roleTruth'] for r in rows if r['roleTruth'] not in ('UNKNOWN', 'TRUTH_CONFLICT')})
    perm = {r: roles[(i + 1) % len(roles)] for i, r in enumerate(roles)}
    swapped = {'meta': {'contender': 'SWAPPED'}, 'rows': [dict(x, role=perm.get(x['role'], x['role'])) for x in oracle['rows']]}
    s = score(truth_p, swapped)
    res['M1_scorer_swap'] = {'oracleRisk': o['selectiveRisk'], 'oracleCoverage': o['coverage'], 'swappedRisk': s['selectiveRisk'],
                             'caught': o['selectiveRisk'] == 0 and o['coverage'] == 1 and s['selectiveRisk'] == 1}
    # M2
    model = json.load(open(os.path.join(run, 'v1-model.json')))
    dev_groups = {r['lineageGroup'] for r in rows if r['split'] == 'DEV' and r['roleTruth'] not in ('UNKNOWN', 'TRUTH_CONFLICT', 'PICTORIAL_UNSPECIFIED')}
    leaked = copy.deepcopy(truth)
    for r in leaked['rows']:
        if r['split'] == 'EVAL':
            r['split'] = 'DEV'
    with tempfile.TemporaryDirectory() as d:
        tp, mp = os.path.join(d, 't.json'), os.path.join(d, 'm.json')
        json.dump(leaked, open(tp, 'w'))
        subprocess.run(['node', os.path.join(HERE, 'v1', 'run.mjs'), 'fit-v1', os.path.join(run, 'v1-feat-n22-r1.jsonl'), tp, mp], check=True, capture_output=True)
        leaked_n = json.load(open(mp))['nTrain']
    res['M2_split_leak'] = {'devGroups': len(dev_groups), 'modelNTrain': model['nTrain'], 'leakedNTrain': leaked_n,
                            'caught': model['nTrain'] == len(dev_groups) and leaked_n != len(dev_groups)}
    manifest = json.load(open(os.path.join(REPO, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')))
    docs = sorted(glob.glob(os.path.join(assembled, 'V2', 'a-*.json')))
    with_obs = next(json.load(open(p)) for p in docs if json.load(open(p))['observations'] and json.load(open(p))['observations'][0]['pixelBox'])
    slug = 'rarytasach'

    def mut(name, f, expect):
        d = copy.deepcopy(with_obs)
        f(d)
        got = codes(validate_document(d, manifest, [slug]))
        res[name] = {'violations': got, 'expected': expect, 'caught': any(e in got for e in expect)}
    other = next(a for a in manifest['assets'] if a['variantSha256'] != with_obs['asset']['variantSha256'])
    mut('M3_source_swap', lambda d: d['observations'][0].update(evidenceVariantSha256=other['variantSha256']), ['IDENTITY'])
    foreign = next(k for k, v in manifest['editions'].items() if with_obs['asset']['variantSha256'] not in v['variantSha256'])
    mut('M4_edition_swap', lambda d: d['asset'].update(editionKey=foreign), ['EDITION_MIX'])
    mut('M5_fabricated_box', lambda d: d['producer'].update(capabilities=['CLASSIFIER']), ['FABRICATED_BOX'])
    mut('M6_name_leakage', lambda d: d['observations'][0].update(reason='pergola of Dom w Rarytasach'), ['LEAKAGE_TOKEN'])
    mut('M7_false_confidence', lambda d: (d['observations'][0].update(confidence={'type': 'CALIBRATED', 'value': 0.99}), d['observations'][0].update(status='CONFIRMED')), ['CONFIDENCE', 'OBS'])
    mut('M8_metric_from_render', lambda d: d['observations'][0].update(metricDimensions={'widthM': 4.0}), ['METRIC'])
    # M9: a router that flips interior-truth assets to EXTERIOR_RENDER; the assembler's truth gate must count claims
    v2 = json.load(open(os.path.join(run, 'V2.json')))
    tmap = {r['assetId']: r for r in truth['rows']}
    flipped = copy.deepcopy(v2)
    for r in flipped['rows']:
        if tmap.get(r['assetId'], {}).get('roleTruth') == 'INTERIOR_RENDER':
            r.update(role='EXTERIOR_RENDER', resolved=True)
    with tempfile.TemporaryDirectory() as d:
        runs = os.path.join(d, 'runs')
        os.makedirs(runs)
        for f in ('v2.jsonl', 'v1-cues.jsonl', 'V0a.json'):
            shutil.copy(os.path.join(run, f), runs)
        json.dump(flipped, open(os.path.join(runs, 'V2.json'), 'w'))
        outd = os.path.join(d, 'out')
        os.makedirs(outd)
        subprocess.run([sys.executable, '-I', os.path.join(HERE, 'assemble.py'), os.path.join(run, 'corpus-private.json'),
                        os.path.join(REPO, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json'), truth_p, runs, outd], check=True, capture_output=True)
        g = json.load(open(os.path.join(outd, 'gates.json')))['contenders']['V2']['hardGates']
    res['M9_interior_to_exterior'] = {'interiorToExteriorClaims_truth': g['interiorToExteriorClaims_truth'], 'caught': g['interiorToExteriorClaims_truth'] > 0}
    # M10
    sums = sorted(glob.glob(os.path.join(assembled, 'V2', 'edition-*.json')))
    sdoc = next((json.load(open(p)) for p in sums if json.load(open(p))['hypotheses']), None)
    if sdoc:
        sdoc['hypotheses'][0]['independentWitnesses'] = len({x['lineageGroup'] for x in sdoc['hypotheses'][0]['support']}) + 1
        got = codes(validate_document(sdoc, manifest, []))
        res['M10_correlated_witnesses'] = {'violations': got, 'caught': 'CORRELATION' in got}
    # M11 / M12: edit committed files in the working tree, run the isolation block, restore byte for byte
    for name, path, edit, pattern in (
        ('M11_caption_in_manifest', 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json',
         lambda s: s.replace('"channel": "', '"caption": "Strefa dzienna", "channel": "', 1), 'committed corpus manifest'),
        ('M12_name_in_prompts', 'research/analyzer-005r/v2/run_owlvit.py',
         lambda s: s.replace("'a terrace', 'a paved patio'", "'a terrace of Dom w Rarytasach', 'a paved patio'", 1), 'prompts name no project'),
    ):
        p = os.path.join(REPO, path)
        orig = open(p, 'rb').read()
        try:
            open(p, 'w').write(edit(orig.decode()))
            rc = isolation_test(pattern)
        finally:
            open(p, 'wb').write(orig)
        res[name] = {'isolationTestExit': rc, 'caught': rc != 0, 'restored': open(p, 'rb').read() == orig}
    res['_summary'] = {'mutations': len([k for k in res if not k.startswith('_')]), 'caught': sum(1 for k, v in res.items() if not k.startswith('_') and v['caught'])}
    json.dump(res, open(out, 'w'), indent=1, sort_keys=True)
    print(json.dumps(res['_summary']))
    for k, v in sorted(res.items()):
        if not k.startswith('_') and not v['caught']:
            print('NOT CAUGHT', k, v)


if __name__ == '__main__':
    main(*sys.argv[1:4])
