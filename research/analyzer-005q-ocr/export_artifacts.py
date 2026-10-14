#!/usr/bin/env python3
"""export_artifacts.py - BUILDPLAN-ANALYZER-005Q-OCR committed artifacts from the scorer's outputs (RESEARCH ONLY).

  python3 -I research/analyzer-005q-ocr/export_artifacts.py --work /home/user/work005q-ocr \
      --out stage-reports/artifacts/analyzer-005q-ocr

Writes numbers, printed values and page boxes only (source-linked by variant hash and frame id): no pixel, crop, page
text dump or room name. Deterministic for the same inputs.
"""
import argparse, json, os
from collections import Counter


def load(p):
    return json.load(open(p))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    W, O = a.work, a.out
    corpus = load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus.json'))['sheets']
    prim = load(f'{W}/label-records-primary.json')['records']
    sens = load(f'{W}/label-records-sensitivity.json')['records']
    sp = load(f'{O}/label-chain-score-primary.json')
    ss = load(f'{O}/label-chain-score-sensitivity.json')

    # corpus manifest with hashes and lineage
    man = []
    for s in corpus:
        m = load(f"{W}/manifest/{s['id']}.json")
        c = load(f"{W}/contenders/{s['id']}.json")
        man.append({'sheet': s['id'], 'case': s['case'], 'family': s['family'], 'role': s['role'], 'lineage': s['lineage'], 'smoke': bool(s.get('smoke')),
                    'frameId': s['frameId'], 'variantByteHash': m['variantByteHash'], 'bytesSha256': m['bytesSha256'], 'page': m['page'],
                    'orientationOfSheet': 'as published (north/up not asserted)', 'metricsSha256': m['metricsSha256'], 'sealedLattices': m['sealedLattices'],
                    'b0Reproduced': c['b0Reproduced'], 'frozenChains': len(c['chains']), 'tickedRuns': len(c['runs'])})
    json.dump({'schema': 'buildapp.005q-ocr.corpus-manifest', 'version': 1, 'independentFamilies': len({s['family'] for s in corpus}), 'sheets': man}, open(f'{O}/corpus-manifest.json', 'w'), indent=1, sort_keys=True)

    # missed-label catalogue (primary and sensitivity), with the incumbent's first loss
    def cat(rows):
        return [{k: r[k] for k in ('sheet', 'case', 'frameId', 'variantByteHash', 'value', 'truth', 'axis', 'box', 'origins', 'b0Loss', 'b0Detected', 'b0ClassicToken', 'b1Detected', 'b1Value', 'b2') if k in r}
                for r in rows if r['b0Loss'] in ('NEVER_PROPOSED', 'TOKEN_NOT_ON_A_CHAIN', 'READ_NOT_CORROBORATED', 'READ_WRONG')]
    json.dump({'schema': 'buildapp.005q-ocr.missed-labels', 'version': 1, 'primary': cat(prim), 'sensitivityOnly': [x for x in cat(sens) if x['truth'] == 'R1_CONFIDENT'],
               'murajachInventoryPrimary': next(s['murajachInventoryCheck'] for s in sp['sheets'] if 'murajachInventoryCheck' in s), 'murajachInventorySensitivity': next(s['murajachInventoryCheck'] for s in ss['sheets'] if 'murajachInventoryCheck' in s)},
              open(f'{O}/missed-label-catalogue.json', 'w'), indent=1, sort_keys=True)

    # false bindings / rewritten statements
    fb = {'b0StatementRewritten': [{k: r[k] for k in ('sheet', 'case', 'value', 'b0Statement', 'b0Binding', 'box')} for r in prim if r['b0Loss'] == 'STATEMENT_VALUE_REWRITTEN'],
          'b0BoundWrong': [{k: r[k] for k in ('sheet', 'case', 'value', 'b0Statement', 'box')} for r in prim if r['b0Binding'] == 'WRONG'],
          'b2Unresolved': [{k: r[k] for k in ('sheet', 'case', 'value', 'box')} for r in prim if r.get('b2') == 'UNRESOLVED'],
          'b2WrongOnTruth': [{k: r[k] for k in ('sheet', 'case', 'value', 'box')} for r in prim if r.get('b2') == 'WRONG']}
    json.dump({'schema': 'buildapp.005q-ocr.false-bindings', 'version': 1, **fb}, open(f'{O}/false-binding-examples.json', 'w'), indent=1, sort_keys=True)

    # >= 5 structured, source-linked observation records
    def pick(rows, pred, n=1):
        return [r for r in rows if pred(r)][:n]
    recs = []
    for label, rows, pred in [
        ('GROUNDED: read right, bound right, statement = ink', prim, lambda r: r['b0Loss'] == 'NONE' and r['b2'] == 'CORRECT'),
        ('GROUNDED_THEN_REWRITTEN: every reader right, chain correction replaced the printed value (gozdzikowcach 1385)', prim, lambda r: r['sheet'] == 'S4' and r['value'] == '1385'),
        ('AMBIGUOUS_ORIENTATION: two turns of one ink both corroborate (glogownikach 870 / 028)', prim, lambda r: r.get('b0RotationalTwin') and r['sheet'] == 'S1'),
        ('MISSED_BY_INCUMBENT_FOUND_BY_B1', prim, lambda r: r['b0Loss'] == 'NEVER_PROPOSED' and r['b1ValueCorrect']),
        ('MISSED_BY_BOTH: number in a line window only', prim, lambda r: r['b0Loss'] == 'NEVER_PROPOSED' and not r['b1Detected']),
        ('READ_RIGHT_NOT_BOUND: the incumbent read it and never bound it', prim, lambda r: r['b0Loss'] == 'READ_RIGHT_NOT_BOUND' and r['sheet'] == 'S2'),
        ('B1_WRONG_TURN', sens, lambda r: r['b1ValueCorrect'] is False),
    ]:
        for r in pick(rows, pred):
            recs.append({'kind': label, **{k: r[k] for k in sorted(r) if k not in ('frameId',)}, 'frameId': r['frameId']})
    # a false detection example: B1 corroborating integer off every line (counts only; the box is enough to find it)
    off = []
    for s in corpus:
        c = load(f"{W}/contenders/{s['id']}.json")
        t = load(f"{W}/truth/{s['id']}.json")
        off.append({'sheet': s['id'], 'b1Corroborating': sum(1 for b in c['b1'] if b['reads'] and max(b['reads'], key=lambda r: r['p'])['p'] >= 0.9)})
    json.dump({'schema': 'buildapp.005q-ocr.observation-records', 'version': 1, 'records': recs, 'falseDetectionCounts': {s['sheet']: s['b1FalseDetections'] for s in sp['sheets']}},
              open(f'{O}/observation-records.json', 'w'), indent=1, sort_keys=True)

    # spot review request for a human (OWNER): 20 labels incl. disagreements; boxes only
    want = [r for r in prim if r['b0Loss'] in ('READ_WRONG', 'NEVER_PROPOSED', 'STATEMENT_VALUE_REWRITTEN') or r.get('b0RotationalTwin') or r['b1ValueCorrect'] is False]
    want += [r for r in sens if r['truth'] == 'R1_CONFIDENT' and r['b1ValueCorrect'] and not r['b0Detected']]
    seen, spot = set(), []
    for r in want:
        k = (r['sheet'], round(r['box']['x0']), round(r['box']['y0']))
        if k in seen:
            continue
        seen.add(k)
        spot.append({'sheet': r['sheet'], 'case': r['case'], 'variantByteHash': r['variantByteHash'], 'pageBox': {kk: round(v, 1) for kk, v in r['box'].items()}, 'axis': r['axis'], 'localTruth': r['value'], 'truthTier': r['truth'], 'why': r['b0Loss'] if r['b0Loss'] != 'NONE' else 'B1_NEW'})
    json.dump({'schema': 'buildapp.005q-ocr.spot-review-request', 'version': 1, 'status': 'NOT_RUN_HUMAN — no human reviewer was available in this session; no image was shown to any remote model',
               'instruction': 'open the sheet (variantByteHash) locally, look at pageBox, write the printed value and whether it is a dimension label of the line beside it',
               'items': spot[:20]}, open(f'{O}/spot-review-request.json', 'w'), indent=1, sort_keys=True)

    # resources
    perf = load(f'{W}/perf-contenders-x1-S1_S2_S3_S4_S6_S7_S8_S9.json')['perf'] + load(f'{W}/perf-contenders-x1-S5.json')['perf']
    det = [p['detectorMs'] for p in perf]
    crop = [p['perCropMs'] for p in perf]
    json.dump({'schema': 'buildapp.005q-ocr.performance', 'version': 1,
               'environment': 'x86_64 container, 4 vCPU, Node 22.22.2, onnxruntime-web 1.30.0 WASM single thread (the shipped runtime); the S1–S4,S6–S9 batch overlapped the truth readers on S5 (CPU contention); S5 ran alone',
               'perSheet': perf,
               'detector': {'model': 'PP-OCRv6_tiny_det', 'bytes': 1780590, 'sha256': '193bab7a04fca699a6c82e6abb5b81bdb28177f0abd4062552b04908dafb19f8', 'msPerSheet': {'min': min(det), 'max': max(det), 'median': sorted(det)[len(det) // 2]}, 'firstSheetIncludesSessionCreate': True},
               'recogniserOnB1Boxes': {'msPerCrop4Variants': {'min': min(crop), 'max': max(crop), 'median': sorted(crop)[len(crop) // 2]}, 'cropsPerSheet': [p['b1Crops'] for p in perf], 'note': 'both turns of every box are read (2 crops per box)'},
               'peakRssMb': max(p['rssMb'] for p in perf),
               'androidOffline': 'ESTIMATED ONLY, not tested: +1.8 MB model in the APK beside the 4.5 MB recogniser; the same WASM runtime. On this x86 container B1 costs ~2 s detection + ~20–30 s recognition per 853 px plan sheet (all boxes, both turns); a phone is typically 2–4x slower. Reading only detector boxes that lie on a frozen dimension line would cut recognition several-fold — not measured.'},
              open(f'{O}/performance.json', 'w'), indent=1, sort_keys=True)
    print('artifacts written')


if __name__ == '__main__':
    main()
