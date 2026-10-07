#!/usr/bin/env python3
"""question_corpus.py - the committed, text-only record of the 005M question corpus (RESEARCH ONLY).

    python -I -B research/analyzer-005m/question_corpus.py --pool <W>/corpus/pool.json --items <W>/items/items.jsonl \
        --sg-test <W>/sg-test/corpus.json --sg-trainval <W>/sg-trainval/corpus.json --out stage-reports/artifacts/analyzer-005m-vr2/question-corpus.json

Per benchmark question: id, set, class, target kind and coordinates (source pixels), expected answer and its source,
the option letter order, the SHA-256 of the source image (and of the sealed publisher bytes where they exist) and of
every composed mode image. No pixel, crop, prompt image or path into a publisher cache is written. For the 005M
synthetic generator only counts per split, family and class (the scenes regenerate from the seeds).
"""
import argparse
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import options_for  # noqa: E402


def rnd(t):
    if isinstance(t, dict):
        return {k: rnd(v) for k, v in t.items()}
    if isinstance(t, (list, tuple)):
        return [rnd(v) for v in t]
    return round(t, 1) if isinstance(t, float) else t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pool', required=True)
    ap.add_argument('--items', required=True)
    ap.add_argument('--sg-test', required=True)
    ap.add_argument('--sg-trainval', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    pool = {q['qid']: q for q in json.load(open(a.pool))['questions']}
    items = [json.loads(l) for l in open(a.items)]
    by_q = {}
    for it in items:
        by_q.setdefault(it['qid'], {})[it['mode']] = it
    qs = []
    for qid, modes in by_q.items():
        q = pool[qid]
        any_it = next(iter(modes.values()))
        _, shown = options_for(q['cls'], q['orderKey'])
        src = q['sources'][0]
        qs.append({'qid': qid, 'set': q['set'], 'cls': q['cls'], 'group': q['group'], 'transform': q['transform'], 'variant': q.get('variant'),
                   'targetKind': q['targetKind'], 'targetSourcePx': rnd(q['target']), 'expected': q['expected'], 'truthSource': q['truthSource'],
                   'fact': q.get('fact'), 'optionOrder': [[l, k] for l, k, _ in shown], 'phase1': any_it['phase1'],
                   'contextDependent': q.get('contextDependent', False), 'cropIdenticalToPair': any_it.get('cropIdenticalToPair'),
                   'pairItemQid': any_it.get('pairItemQid'), 'sourceImageSha256': src['sha256'], 'publisherByteSha256': src.get('byteHash'),
                   'sourceSizePx': src.get('size'), 'pxPerM': round(q['ppm'], 3),
                   'modeImageSha256': {m: it['imageSha256'] for m, it in sorted(modes.items())}})
    sgt = json.load(open(a.sg_test))
    sgv = json.load(open(a.sg_trainval))
    allq = sgt['questions'] + sgv['questions']
    synth = {'generator': sgt['generator'], 'version': sgt['version'], 'rasteriser': sgt['rasteriser'], 'splitSeedBase': sgt['splitSeedBase'],
             'families': sgt['families'], 'transforms': sgt['transforms'],
             'questionsBySplit': Counter(q['split'] for q in allq), 'bySplitFamily': {s: Counter(q['family'] for q in allq if q['split'] == s) for s in ('TRAIN', 'VAL', 'TEST')},
             'bySplitClass': {s: Counter(q['cls'] for q in allq if q['split'] == s) for s in ('TRAIN', 'VAL', 'TEST')},
             'contextDependentBySplit': Counter(q['split'] for q in allq if q['contextDependent']),
             'scenePngSha256BySplit': {s: len([sc for sc in sgt['scenes'] + sgv['scenes'] if sc['split'] == s]) for s in ('TRAIN', 'VAL', 'TEST')}}
    out = {'researchOnly': 'BUILDPLAN-ANALYZER-005M', 'note': 'Text facts only: ids, coordinates, expected answers, hashes. Publisher pictures, crops and composed question images stay outside the repository.',
           'benchmarkQuestions': len(qs), 'phase1Questions': sum(q['phase1'] for q in qs), 'bySet': Counter(q['set'] for q in qs), 'byClass': Counter(q['cls'] for q in qs),
           'poolBySet': Counter(q['set'] for q in pool.values()), 'synthetic005M': synth, 'questions': sorted(qs, key=lambda q: q['qid'])}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, 'w'), indent=1)
    print(out['benchmarkQuestions'], out['phase1Questions'], dict(out['bySet']))


if __name__ == '__main__':
    main()
