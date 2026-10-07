#!/usr/bin/env python3
"""teacher_rationale.py - short teacher rationales on TRAIN items (RESEARCH ONLY; brief section 13: never a label).

    python -I -B research/analyzer-005m/teacher_rationale.py --items <W>/items-train/items-48.jsonl --img <W>/items-train/img \
        --teacher-run <W>/runs/teacher-train-qwen3-vl-8b.jsonl --out <W>/runs/teacher-rationale-qwen3-vl-8b.jsonl \
        --server http://127.0.0.1:8090 [--max-disagree 8 --max-agree 4]

The teacher's constrained run decides which items get a rationale. Taken in item order, up to --max-disagree items
where its answer differs from the generator's truth, and up to --max-agree items where it matches. Each item is asked
again, mode D only, without the grammar: the same images and question, then one or two sentences on what in the
drawing decides it, then the same JSON. The record keeps the free text, the parsed JSON and whether the generator
agrees. It is inspection material for hard-example mining. It is never a target, and nothing here enters
student_dataset.py.
"""
import argparse
import json
import os
import re
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bench import content_parts  # noqa: E402

ASK = ('\n\nBefore the JSON, write one or two sentences (at most 40 words) saying what in the drawing decides the '
       'question. Then give the JSON on its own line.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--items', required=True)
    ap.add_argument('--img', required=True)
    ap.add_argument('--teacher-run', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--server', default='http://127.0.0.1:8090')
    ap.add_argument('--mode', default='D_MARKED_ROI_PLUS_CROP')
    ap.add_argument('--max-disagree', type=int, default=8)
    ap.add_argument('--max-agree', type=int, default=4)
    a = ap.parse_args()
    items = {json.loads(l)['key']: json.loads(l) for l in open(a.items)}
    run = [json.loads(l) for l in open(a.teacher_run)]
    pick, nd, na = [], 0, 0
    for r in run:
        it = items.get(r['key'])
        if not it or it['mode'] != a.mode or r.get('answer') is None:
            continue
        agrees = r['answer'] == it['expectedLetter']
        if not agrees and nd < a.max_disagree:
            pick.append((it, r, agrees))
            nd += 1
        elif agrees and na < a.max_agree:
            pick.append((it, r, agrees))
            na += 1
    with open(a.out, 'w') as fh:
        for it, r, agrees in pick:
            it2 = dict(it, prompt=it['prompt'] + ASK)
            body = {'messages': [{'role': 'user', 'content': content_parts(it2, a.img)}], 'temperature': 0, 'seed': 0,
                    'max_tokens': 120, 'cache_prompt': True}
            t0 = time.time()
            resp = requests.post(f'{a.server}/v1/chat/completions', json=body, timeout=3600)
            rec = {'key': it['key'], 'qid': it['qid'], 'mode': it['mode'], 'group': it.get('group'), 'cls': it['cls'],
                   'expectedLetter': it['expectedLetter'], 'constrainedAnswer': r['answer'],
                   'constrainedAgreesWithGenerator': agrees, 'wallMs': round((time.time() - t0) * 1000)}
            if resp.status_code != 200:
                rec['error'] = f'HTTP {resp.status_code}'
            else:
                text = resp.json()['choices'][0]['message']['content']
                rec['text'] = text
                m = re.search(r'\{[^{}]*"answer"[^{}]*\}', text)
                try:
                    parsed = json.loads(m.group(0)) if m else {}
                except json.JSONDecodeError:
                    parsed = {}
                rec['freeAnswer'], rec['freeConfidence'] = parsed.get('answer'), parsed.get('confidence')
            fh.write(json.dumps(rec) + '\n')
            fh.flush()
            print(rec['qid'], rec.get('freeAnswer'), agrees, flush=True)


if __name__ == '__main__':
    main()
