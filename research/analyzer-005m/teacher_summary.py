#!/usr/bin/env python3
"""teacher_summary.py - what the teacher lane measured (RESEARCH ONLY; brief section 13: the teacher is never truth).

    python -I -B research/analyzer-005m/teacher_summary.py --train-items <W>/items-train/items-48.jsonl \
        --train-run <W>/runs/teacher-train-qwen3-vl-8b.jsonl --rationale <W>/runs/teacher-rationale-qwen3-vl-8b.jsonl \
        --out stage-reports/artifacts/analyzer-005m-vr2/teacher-summary.json

On generator-labelled TRAIN items (mode D), it reports:
  * agreement with the generator's truth, overall and per family;
  * pair sensitivity: whether the teacher gives the two members of a counterfactual pair different answers;
  * how well its option probability separates agreeing from disagreeing answers (AUROC);
  * for the free-text rationales, whether their answers match the constrained ones.
The comparison with the students on the phase-1 questions comes from score.py (teacher-comparison/).
"""
import argparse
import json
from collections import Counter, defaultdict


def auroc(pos, neg):
    if not pos or not neg:
        return None
    return round(sum((p > q) + 0.5 * (p == q) for p in pos for q in neg) / (len(pos) * len(neg)), 4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--train-items', required=True)
    ap.add_argument('--train-run', required=True)
    ap.add_argument('--rationale', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    items = {json.loads(l)['key']: json.loads(l) for l in open(a.train_items)}
    rs = [json.loads(l) for l in open(a.train_run)]
    fam = defaultdict(Counter)
    probs = []
    by_pair = defaultdict(dict)
    for r in rs:
        it = items[r['key']]
        agree = r.get('answer') == it['expectedLetter']
        fam[it['group']]['n'] += 1
        fam[it['group']]['agree'] += agree
        fam[it['group']]['unresolved'] += r.get('answer') == 'UNRESOLVED'
        p = (r.get('enumProbs') or {}).get(r.get('answer'))
        if p is not None:
            probs.append((p, agree))
        pair = it['qid'].rsplit('-', 3)[0]
        by_pair[pair][it.get('variant') or it['qid'].split('-')[-3]] = (r.get('answer'), it['expectedLetter'])
    pairs = [v for v in by_pair.values() if len(v) == 2]
    same = sum(v['A'][0] == v['B'][0] for v in pairs)
    truth_differs = sum(v['A'][1] != v['B'][1] for v in pairs)
    both = sum(v['A'][0] == v['A'][1] and v['B'][0] == v['B'][1] for v in pairs)
    rat = [json.loads(l) for l in open(a.rationale)]
    out = {'researchOnly': 'BUILDPLAN-ANALYZER-005M', 'teacher': 'Qwen/Qwen3-VL-8B-Instruct (official Q4_K_M GGUF + F16 projector, CPU)',
           'trainItems': {'questions': len(rs), 'mode': 'D_MARKED_ROI_PLUS_CROP', 'split': 'TRAIN (vrgen2 2.0.0, garage family removed)',
                          'agreeWithGenerator': sum(c['agree'] for c in fam.values()), 'unresolved': sum(c['unresolved'] for c in fam.values()),
                          'byFamily': {f: dict(c) for f, c in sorted(fam.items())},
                          'counterfactualPairs': {'pairs': len(pairs), 'truthDiffers': truth_differs, 'sameAnswerToBoth': same, 'bothRight': both},
                          'optionProbability': {'meanWhenAgreeing': round(sum(p for p, g in probs if g) / max(1, sum(g for _, g in probs)), 4),
                                                'meanWhenDisagreeing': round(sum(p for p, g in probs if not g) / max(1, sum(not g for _, g in probs)), 4),
                                                'aurocAgreeVsDisagree': auroc([p for p, g in probs if g], [p for p, g in probs if not g])},
                          'medianWallSeconds': sorted(r['wallMs'] for r in rs)[len(rs) // 2] / 1000},
           'rationales': {'n': len(rat), 'freeAnswerEqualsConstrained': sum(r.get('freeAnswer') == r.get('constrainedAnswer') for r in rat),
                          'freeAnswerAgreesWithGenerator': sum(r.get('freeAnswer') == r.get('expectedLetter') for r in rat),
                          'note': 'free text is inspection material only; it never becomes a target'}}
    json.dump(out, open(a.out, 'w'), indent=1)
    print(json.dumps(out['trainItems']['counterfactualPairs']), out['trainItems']['agreeWithGenerator'], out['rationales'])


if __name__ == '__main__':
    main()
