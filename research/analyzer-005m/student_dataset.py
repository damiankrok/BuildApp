#!/usr/bin/env python3
"""student_dataset.py - the exact BuildPlan student training format (RESEARCH ONLY; images are composed on the fly).

    python -I -B research/analyzer-005m/student_dataset.py --pool <W>/corpus/pool-with-train.json --sg-trainval <W>/sg-trainval/corpus.json \
        --sg-test <W>/sg-test/corpus.json --sg-sealed <W>/sg-v21/corpus.json --out <W>/student/ \
        [--teacher <teacher run.jsonl> --teacher-pool <the pool the teacher's items were composed from>] [--allow-class-shortcut]

Writes <out>/train.jsonl and <out>/val.jsonl, one line per (question, mode):

  {"id": "<qid>|<mode>", "split": "TRAIN|VAL", "qid": ..., "mode": "A_CROP_ONLY|...", "cls": ..., "images": [<recipe>, ...],
   "promptTemplate": "common.prompt_for ...", "target": {"answer": "A|B|C|UNRESOLVED", "confidence": "HIGH|LOW"},
   "targetSource": "GENERATOR" | "GENERATOR_ABSTAIN", "teacher": {"probs": {...} | null, "agrees": bool, "hardExample": bool} | null}

No prompt text is stored. The collator recomputes it with common.prompt_for from the composed plan size, the target in
plan pixels and whether the analyzer overlay found bands on that render (mode E says "no purple marks" when it found
none). Here prompt_for is called only for the letter order, which depends on none of those.

Rules (brief sections 12-13):
  * the target is the generator's semantic truth, mapped to the question's letter order - never a teacher answer;
  * a context-dependent question in A_CROP_ONLY gets target UNRESOLVED / LOW: its crop is pixel-identical to its
    counterfactual twin's, so the crop cannot decide it (GENERATOR_ABSTAIN). This teaches abstention where the crop
    provably lacks the information; whether that carries over to real sheets is untested, and a student could also
    learn it from the class, the mode or the drawing style (student-training.md);
  * every other target is the truth with confidence HIGH;
  * a teacher contributes soft option probabilities only where its arg-max equals the target letter (agrees); a
    disagreeing teacher output keeps no probabilities and is only a hard-example flag, never a target;
  * a teacher output is joined on (qid, mode, render SHA-256): --teacher needs --teacher-pool, and an output computed on
    another drawing (a qid redrawn between generator versions) is dropped and counted, never attached (post-review D-15);
  * images are recipes for compose5.py (render path + SHA-256 + mode), so the set needs no pixel storage;
  * only generator questions from TRAIN / VAL renders are accepted: every render's SHA-256 is checked against the
    TEST and SEALED corpora (--sg-test, --sg-sealed, both required), and a hit stops the run (post-review D-16);
  * the abstention target must not be predictable from the class alone: if a class has A_CROP_ONLY abstention targets
    and no crop-decidable A_CROP_ONLY line, the run stops (post-review D-13). vrgen2 2.1 fails this check for BAY_BACK_CLOSED_VS_DRIVE_THROUGH,
    BODY_REGION and STOREY_COVERAGE (100 % context-dependent), so a student needs a generator revision with crop-decidable
    members in those classes first; --allow-class-shortcut writes the set anyway, for inspection only;
  * the generator corpus must be vrgen2 >= 2.1.0 (the 2.0.0 garage and inset_upper labels are ill-posed, post-review
    B-2 / D-1 / D-8); --allow-v2.0 is for reproducing the first dataset only.
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
    ap.add_argument('--teacher-pool', default=None)
    ap.add_argument('--sg-test', required=True)
    ap.add_argument('--sg-sealed', required=True)
    ap.add_argument('--allow-class-shortcut', action='store_true')
    ap.add_argument('--allow-v2.0', dest='allow_v20', action='store_true')
    a = ap.parse_args()
    if os.path.realpath(a.out).startswith(os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..'))):
        raise SystemExit('the dataset stays outside the repository')
    pool = json.load(open(a.pool))['questions']
    sg = json.load(open(a.sg_trainval))
    if sg.get('version') == '2.0.0' and not a.allow_v20:
        raise SystemExit('regenerate TRAIN/VAL with vrgen2 >= 2.1.0 (post-review B-2 / D-1 / D-8), or pass --allow-v2.0')
    forbidden = set()
    for path, split in ((a.sg_test, 'TEST'), (a.sg_sealed, 'SEALED')):
        hashes = {s['pngSha256'] for s in json.load(open(path))['scenes'] if s['split'] == split}
        if not hashes:
            raise SystemExit(f'{path} holds no {split} render: pass the corpus that contains the {split} split')
        forbidden |= hashes
    val = [q for q in sg['questions'] if q['split'] == 'VAL']
    teacher = {}
    if a.teacher:
        if not a.teacher_pool:
            raise SystemExit('--teacher needs --teacher-pool: teacher outputs are joined on the render hash they were computed on')
        tsha = {q['qid']: q['sources'][0]['sha256'] for q in json.load(open(a.teacher_pool))['questions']}
        for l in open(a.teacher):
            r = json.loads(l)
            teacher[(r['qid'], r['mode'], tsha.get(r['qid']))] = r
    dropped = 0
    abstain_by_cls = {}
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
                qs.append({'qid': '005m:' + q['qid'], 'set': 'SYNTH_VAL', 'cls': q['cls'], 'targetKind': kind, 'target': target, 'expected': q['expected'], 'transform': q['transform'],
                           'orderKey': q['baseQid'].replace('-A-q', '-q').replace('-B-q', '-q'), 'contextDependent': q['contextDependent'],
                           'sources': [{'path': os.path.join(os.path.dirname(a.sg_trainval), 'renders', q['sceneId'] + '.png'), 'sha256': sc['pngSha256']}],
                           'ppm': sc['style']['pxPerM'], 'cropPanel': q.get('cropPanel')})
        n = 0
        with open(os.path.join(a.out, split.lower() + '.jsonl'), 'w') as fh:
            for q in qs:
                if q['set'] not in ('SYNTH_TRAIN', 'SYNTH_VAL') or q['sources'][0]['sha256'] in forbidden:
                    raise SystemExit(f"{q['qid']}: not a TRAIN/VAL generator render - only those may become training data")
                for mode in TRAIN_MODES:
                    # only the letter order is used here; the collator recomputes the prompt from the composed image
                    _, shown = prompt_for(q, mode, (1000, 1000), q['target'], True)
                    abstain = q.get('contextDependent') and mode == 'A_CROP_ONLY'
                    tgt = {'answer': 'UNRESOLVED', 'confidence': 'LOW'} if abstain else {'answer': letter_of(shown, q['expected']), 'confidence': 'HIGH'}
                    if mode == 'A_CROP_ONLY':
                        abstain_by_cls.setdefault(q['cls'], [0, 0])[bool(abstain)] += 1
                    t = teacher.get((q['qid'], mode, q['sources'][0]['sha256']))
                    if t is None and a.teacher and any(k[0] == q['qid'] and k[1] == mode for k in teacher):
                        dropped += 1   # the teacher saw another drawing under this qid
                    tinfo = None
                    if t and t.get('enumProbs'):
                        top = max(t['enumProbs'], key=t['enumProbs'].get)
                        agrees = top == tgt['answer']
                        tinfo = {'probs': t['enumProbs'] if agrees else None, 'agrees': agrees, 'hardExample': not agrees}
                    fh.write(json.dumps({'id': f"{q['qid']}|{mode}", 'split': split, 'qid': q['qid'], 'mode': mode, 'cls': q['cls'],
                                         'images': [{'compose': 'compose5.py', 'render': os.path.basename(q['sources'][0]['path']), 'renderSha256': q['sources'][0]['sha256'], 'mode': mode}],
                                         'promptTemplate': 'common.prompt_for(question, mode, composed plan size, target in plan px, bands found on this render)', 'target': tgt,
                                         'targetSource': 'GENERATOR_ABSTAIN' if abstain else 'GENERATOR', 'teacher': tinfo}) + '\n')
                    n += 1
        counts[split] = n
    counts['teacherOutputsDroppedOtherRender'] = dropped
    counts['cropOnlyAbstainByClass'] = {c: {'answer': v[0], 'abstain': v[1]} for c, v in sorted(abstain_by_cls.items())}
    counts['abstentionDeterminedByClass'] = sorted(c for c, v in abstain_by_cls.items() if v[1] and not v[0])
    json.dump(counts, open(os.path.join(a.out, 'counts.json'), 'w'))
    print(json.dumps(counts))
    if counts['abstentionDeterminedByClass'] and not a.allow_class_shortcut:
        for split in ('train', 'val'):
            os.remove(os.path.join(a.out, split + '.jsonl'))
        raise SystemExit('the crop-only abstention target is a function of the class for ' + ', '.join(counts['abstentionDeterminedByClass']) +
                         ': a student could learn abstention without reading a pixel (post-review D-13). Regenerate with crop-decidable '
                         'members in these classes; --allow-class-shortcut writes the set for inspection only, never for training')


if __name__ == '__main__':
    main()
