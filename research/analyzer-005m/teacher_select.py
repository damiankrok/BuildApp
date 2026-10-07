#!/usr/bin/env python3
"""teacher_select.py - the synthetic TRAIN items the teacher sees (RESEARCH ONLY).

    python -I -B research/analyzer-005m/teacher_select.py --pool <W>/corpus/pool-with-train.json --out <W>/corpus/selection-train.json [--pairs 6]

Hard-example mining and soft targets come from the TRAIN split only (brief section 13): the sealed TEST split and every
real development image stay out of the teacher's training-side use. Per family, the first --pairs pairs, both members,
NORMAL transform, question 0. Written as a composer selection (phase2 = these ids, phase1 = none).
"""
import argparse
import json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pool', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--pairs', type=int, default=6)
    a = ap.parse_args()
    pool = {q['qid']: q for q in json.load(open(a.pool))['questions'] if q['set'] == 'SYNTH_TRAIN'}
    fams = sorted({q['group'] for q in pool.values()})
    ids = []
    for f in fams:
        for k in range(a.pairs):
            for v in 'AB':
                qid = f'005m:train-{f}-s{k}-{v}-NORMAL-q0'
                assert qid in pool, qid
                ids.append(qid)
    json.dump({'phase1': [], 'phase2': ids, 'note': 'TRAIN split only; teacher mining'}, open(a.out, 'w'), indent=1)
    print(len(ids), 'TRAIN questions over', len(fams), 'families')


if __name__ == '__main__':
    main()
