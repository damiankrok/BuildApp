#!/usr/bin/env python3
"""bench.py - one model, one item list, through a local llama-server (RESEARCH ONLY).

    python -I -B research/analyzer-005m/bench.py --items <W>/items/items.jsonl --img <W>/items/img --out <run.jsonl> \
        --model <label> --server http://127.0.0.1:8090 --phase 1|2 [--pid <server pid>]

Every request: the item's images (native multi-image, in order) then its prompt; temperature 0; JSON-schema decoding
(the reply can only be {"answer": <letter|UNRESOLVED>, "confidence": LOW|MEDIUM|HIGH}); top-20 log-probabilities.

Read-outs per item (the scorer decides what counts; nothing is scored here):
  answer / confidence  the constrained reply (the deployable read-out)
  enumProbs            the model's own probability of each option at the answer token, read from the UNCONSTRAINED
                       pre-sampling distribution and normalised over the options; enumMass is the share of that
                       distribution the options held before normalising (format adherence without the grammar)
  promptTokens, cachedTokens, textOnlyTokens -> imageTokens (prompt minus the same messages without images)
  promptMs, predictedMs, wallMs, server VmRSS / VmHWM after the call

Resumable: items already in --out are skipped. Modes of one question run A, B, C, D, E in a row, so D can reuse C's
prompt prefix (the marked plan) from the server's cache; cachedTokens records whether it did.
"""
import argparse
import base64
import json
import os
import re
import time

import requests

ORDER = ['A_CROP_ONLY', 'B_FULL_PLAN', 'C_FULL_PLAN_MARKED_ROI', 'D_MARKED_ROI_PLUS_CROP', 'E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY']
ANS_PREFIX = re.compile(r'"answer"\s*:\s*"$')


def rss(pid):
    if not pid:
        return None
    out = {}
    try:
        for line in open(f'/proc/{pid}/status'):
            if line.startswith(('VmRSS', 'VmHWM', 'RssAnon', 'RssFile', 'RssShmem')):
                out[line.split(':')[0]] = int(line.split()[1]) * 1024
    except OSError:
        return None
    return out


def option_of(tok, letters):
    t = tok.strip()
    if not t:
        return None
    for l in letters:
        if t == l or t.startswith(l + '"'):
            return l
    if t[0] == 'U' and ('UNRESOLVED'.startswith(t.rstrip('",')) or t.startswith('UNRESOLVED')):
        return 'UNRESOLVED'
    return None


def enum_probs(logprobs, letters):
    """At the first generated token after '"answer": "', the unconstrained probability of each option."""
    acc = ''
    for tok in logprobs:
        if ANS_PREFIX.search(acc):
            mass = {}
            for cand in tok['top_logprobs']:
                o = option_of(cand['token'], letters)
                if o:
                    mass[o] = mass.get(o, 0.0) + pow(2.718281828459045, cand['logprob'])
            total = sum(mass.values())
            if total <= 0:
                return None, 0.0
            return {o: mass.get(o, 0.0) / total for o in letters + ['UNRESOLVED']}, total
        acc += tok['token']
    return None, 0.0


def content_parts(it, img_dir, with_images=True):
    parts = []
    if with_images:
        for name in it['images']:
            b64 = base64.b64encode(open(os.path.join(img_dir, name), 'rb').read()).decode()
            parts.append({'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + b64}})
    parts.append({'type': 'text', 'text': it['prompt']})
    return parts


def text_only_tokens(server, it):
    """The same chat without its images, through the model's own template and tokenizer."""
    msgs = [{'role': 'user', 'content': it['prompt']}]
    tpl = requests.post(f'{server}/apply-template', json={'messages': msgs}, timeout=60).json()['prompt']
    return len(requests.post(f'{server}/tokenize', json={'content': tpl, 'add_special': False}, timeout=60).json()['tokens'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--items', required=True)
    ap.add_argument('--img', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--server', default='http://127.0.0.1:8090')
    ap.add_argument('--phase', type=int, choices=[1, 2], required=True)
    ap.add_argument('--pid', type=int, default=None)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--modes', default=','.join(ORDER), help='comma-separated subset of the five modes (the teacher lane)')
    a = ap.parse_args()
    items = [json.loads(l) for l in open(a.items)]
    if a.phase == 1:
        items = [it for it in items if it['phase1']]
    qorder = list(dict.fromkeys(it['qid'] for it in items))
    by = {(it['qid'], it['mode']): it for it in items}
    done = set()
    if os.path.exists(a.out):
        done = {json.loads(l)['key'] for l in open(a.out)}
    n = 0
    with open(a.out, 'a') as fh:
        modes = [m for m in ORDER if m in a.modes.split(',')]
        for qid in qorder:
            for mode in modes:
                it = by[(qid, mode)]
                if it['key'] in done:
                    continue
                letters = [l for l, _, _ in it['shown']]
                body = {'messages': [{'role': 'user', 'content': content_parts(it, a.img)}], 'temperature': 0, 'seed': 0, 'max_tokens': 40,
                        'logprobs': True, 'top_logprobs': 20, 'json_schema': it['schema'], 'cache_prompt': True}
                t0 = time.time()
                r = requests.post(f'{a.server}/v1/chat/completions', json=body, timeout=3600)
                wall = time.time() - t0
                rec = {'key': it['key'], 'qid': qid, 'mode': mode, 'model': a.model, 'wallMs': round(wall * 1000)}
                if r.status_code != 200:
                    rec.update({'error': f'HTTP {r.status_code}: {r.text[:300]}'})
                else:
                    j = r.json()
                    msg = j['choices'][0]['message']['content']
                    rec['raw'] = msg
                    try:
                        parsed = json.loads(msg)
                        rec['answer'], rec['confidence'] = parsed.get('answer'), parsed.get('confidence')
                    except json.JSONDecodeError:
                        rec['answer'], rec['confidence'] = None, None
                        rec['parseError'] = True
                    probs, mass = enum_probs(j['choices'][0].get('logprobs', {}).get('content', []), letters)
                    rec['enumProbs'], rec['enumMass'] = probs, round(mass, 4)
                    tm, us = j.get('timings', {}), j.get('usage', {})
                    rec.update({'promptTokens': us.get('prompt_tokens'), 'completionTokens': us.get('completion_tokens'),
                                'cachedTokens': tm.get('cache_n'), 'promptMs': round(tm.get('prompt_ms', 0)), 'predictedMs': round(tm.get('predicted_ms', 0))})
                    try:
                        rec['textOnlyTokens'] = text_only_tokens(a.server, it)
                        rec['imageTokens'] = rec['promptTokens'] - rec['textOnlyTokens']
                    except Exception as e:  # noqa: BLE001 - a tokenizer endpoint failure only loses the token split, recorded as such
                        rec['tokenSplitError'] = str(e)[:200]
                rec['rss'] = rss(a.pid)
                fh.write(json.dumps(rec) + '\n')
                fh.flush()
                n += 1
                if a.limit and n >= a.limit:
                    return


if __name__ == '__main__':
    main()
