#!/usr/bin/env python3
"""student_dataset.py - the exact BuildPlan student training format (RESEARCH ONLY; images are composed on the fly).

    python -I -B research/analyzer-005m/student_dataset.py --pool <W>/corpus/pool-with-train.json --sg-trainval <W>/sg-trainval/corpus.json \
        --out <W>/student/  [--teacher <teacher run.jsonl>]

Writes <out>/train.jsonl and <out>/val.jsonl, one line per (question, mode):

  {"id": "<qid>|<mode>", "split": "TRAIN|VAL", "qid": ..., "mode": "A_CROP_ONLY|...", "images": [<recipe>, ...],
   "prompt": <the bake-off prompt for that mode, byte-identical>, "target": {"answer": "A|B|C|UNRESOLVED", "confidence": "HIGH|LOW"},
   "targetSource": "GENERATOR" | "GENERATOR_ABSTAIN", "teacher": {"probs": {...}, "agrees": bool} | null}

Rules (brief sections 12-13):
  * the target is the generator's semantic truth, mapped to the question's letter order - never a teacher answer;
  * a context-dependent question in A_CROP_ONLY gets target UNRESOLVED / LOW: its crop is pixel-identical to its
    counterfactual twin's, so the crop provably cannot decide it (GENERATOR_ABSTAIN) - the student is taught to abstain
    exactly where the information is absent, which is the confident-wrong safety property;
  * every other target is the truth with confidence HIGH (the scene settles it);
  * a teacher may contribute soft option probabilities only where its arg-max equals the generator truth
    (teacher.agrees); disagreeing teacher outputs are kept only as hard-example flags, never as targets;
  * images are recipes for compose5.py (render path + SHA-256 + mode), so the set needs no pixel storage and nothing
    from a real sheet can enter it: only SYNTH_TRAIN / SYNTH_VAL questions are accepted.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import MODES, letter_of, prompt_for  # noqa: E402

TRAIN_MODES = MODES   # every mode, so the student learns what each input contract can and cannot settle


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pool', required=True)
    ap.add_argument('--sg-trainval', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--teacher', default=None)
    a = ap.parse_args()
    if os.path.abspath(a.out).startswith(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))):
        raise SystemExit('the dataset stays outside the repository')
    pool = json.load(open(a.pool))['questions']
    sg = json.load(open(a.sg_trainval))
    val = [q for q in sg['questions'] if q['split'] == 'VAL']
    teacher = {}
    if a.teacher:
        for l in open(a.teacher):
            r = json.loads(l)
            teacher[(r['qid'], r['mode'])] = r
    os.makedirs(a.out, exist_ok=True)
    counts = {}
    for split, qs in (('TRAIN', [q for q in pool if q['set'] == 'SYNTH_TRAIN']), ('VAL', None)):
        if split == 'VAL':
            # VAL questions in the pool format (same fields corpus.py writes for TRAIN)
            scenes = {s['sceneId']: s for s in sg['scenes']}
            qs = []
            for q in val:
                sc = scenes[q['sceneId']]
                kind, target = q['targetKind'], q['targetPx']
                qs.append({'qid': '005m:' + q['qid'], 'set': 'SYNTH_VAL', 'cls': q['cls'], 'targetKind': kind, 'target': target, 'expected': q['expected'],
                           'orderKey': q['baseQid'].replace('-A-q', '-q').replace('-B-q', '-q'), 'contextDependent': q['contextDependent'],
                           'sources': [{'path': os.path.join(os.path.dirname(a.sg_trainval), 'renders', q['sceneId'] + '.png'), 'sha256': sc['pngSha256']}],
                           'ppm': sc['style']['pxPerM'], 'cropPanel': q.get('cropPanel')})
        n = 0
        with open(os.path.join(a.out, split.lower() + '.jsonl'), 'w') as fh:
            for q in qs:
                assert q['set'] in ('SYNTH_TRAIN', 'SYNTH_VAL'), 'only generator questions may become training data'
                for mode in TRAIN_MODES:
                    # the prompt needs the plan size and target in plan pixels; the recipe re-derives them identically
                    prompt, shown = prompt_for(q, mode, (1000, 1000), q['target'] if q['targetKind'] != 'AB_REGIONS' else q['target'], True)
                    abstain = q.get('contextDependent') and mode == 'A_CROP_ONLY'
                    tgt = {'answer': 'UNRESOLVED', 'confidence': 'LOW'} if abstain else {'answer': letter_of(shown, q['expected']), 'confidence': 'HIGH'}
                    t = teacher.get((q['qid'], mode))
                    tinfo = None
                    if t and t.get('enumProbs'):
                        top = max(t['enumProbs'], key=t['enumProbs'].get)
                        tinfo = {'probs': t['enumProbs'], 'agrees': top == tgt['answer']}
                    fh.write(json.dumps({'id': f"{q['qid']}|{mode}", 'split': split, 'qid': q['qid'], 'mode': mode, 'cls': q['cls'],
                                         'images': [{'compose': 'compose5.py', 'render': os.path.basename(q['sources'][0]['path']), 'renderSha256': q['sources'][0]['sha256'], 'mode': mode}],
                                         'promptTemplate': 'common.prompt_for (recomputed with the composed plan size)', 'target': tgt,
                                         'targetSource': 'GENERATOR_ABSTAIN' if abstain else 'GENERATOR', 'teacher': tinfo}) + '\n')
                    n += 1
        counts[split] = n
    json.dump(counts, open(os.path.join(a.out, 'counts.json'), 'w'))
    print(json.dumps(counts))


if __name__ == '__main__':
    main()
