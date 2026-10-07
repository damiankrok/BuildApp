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
import hashlib
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
    ap.add_argument('--sg-v21', default=None)
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

    def corpus_summary(corpora, splits, list_splits):
        """Counts at every level (independent seeds, drawings, transformed renders, questions), split disjointness by
        render hash, a digest of each split's render hashes, and the full hash list of the evaluation splits."""
        scenes = [sc for c in corpora for sc in c['scenes']]
        qq = [q for c in corpora for q in c['questions']]
        h = {sp: sorted({sc['pngSha256'] for sc in scenes if sc['split'] == sp}) for sp in splits}
        seeds = {sp: sorted({sc['seed'] for sc in scenes if sc['split'] == sp}) for sp in splits}
        return {'generator': corpora[0]['generator'], 'version': corpora[0]['version'], 'rasteriser': corpora[0]['rasteriser'],
                'splitSeedBase': corpora[0]['splitSeedBase'], 'families': corpora[0]['families'], 'transforms': corpora[0]['transforms'],
                'independentSeedsBySplit': {sp: len(seeds[sp]) for sp in splits},
                'drawingsBySplit': {sp: 2 * len(seeds[sp]) for sp in splits},
                'renderCountBySplit': {sp: len(h[sp]) for sp in splits},
                'questionsBySplit': Counter(q['split'] for q in qq),
                'bySplitFamily': {sp: Counter(q['family'] for q in qq if q['split'] == sp) for sp in splits},
                'bySplitClass': {sp: Counter(q['cls'] for q in qq if q['split'] == sp) for sp in splits},
                'contextDependentBySplit': Counter(q['split'] for q in qq if q['contextDependent']),
                'splitsDisjointByRenderHashAndSeed': all(not (set(h[x]) & set(h[y])) and not (set(seeds[x]) & set(seeds[y])) for i, x in enumerate(splits) for y in splits[i + 1:]),
                'renderSha256DigestBySplit': {sp: hashlib.sha256('\n'.join(h[sp]).encode()).hexdigest() for sp in splits},
                'renderSha256BySplit': {sp: h[sp] for sp in list_splits}}

    synth = corpus_summary([sgt, sgv], ('TRAIN', 'VAL', 'TEST'), ('TEST',))
    synth['use'] = 'vrgen2 2.0.0: TEST is the benchmark split (SYNTH_GLOBAL); TRAIN feeds the teacher-mining items only'
    synth21 = None
    if a.sg_v21:
        v21 = json.load(open(a.sg_v21))
        synth21 = corpus_summary([v21], ('TRAIN', 'VAL', 'SEALED'), ('SEALED',))
        synth21['use'] = ('vrgen2 2.1.0 (post-review): TRAIN / VAL for any student; SEALED shown to no model; garage and inset_upper '
                          'questions fixed (B-2, D-1, D-8)')
        synth21['disjointFrom2_0_TEST'] = not (set(synth['renderSha256BySplit']['TEST']) & {sc['pngSha256'] for sc in v21['scenes']})
    out = {'researchOnly': 'BUILDPLAN-ANALYZER-005M', 'note': 'Text facts only: ids, coordinates, expected answers, hashes. Publisher pictures, crops and composed question images stay outside the repository.',
           'benchmarkQuestions': len(qs), 'phase1Questions': sum(q['phase1'] for q in qs), 'bySet': Counter(q['set'] for q in qs), 'byClass': Counter(q['cls'] for q in qs),
           'poolBySet': Counter(q['set'] for q in pool.values()), 'synthetic005M': synth, 'synthetic005M_v2_1': synth21,
           'questions': sorted(qs, key=lambda q: q['qid'])}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, 'w'), indent=1)
    print(out['benchmarkQuestions'], out['phase1Questions'], dict(out['bySet']))


if __name__ == '__main__':
    main()
