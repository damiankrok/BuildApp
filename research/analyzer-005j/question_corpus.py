#!/usr/bin/env python3
"""question_corpus.py - the committed BuildPlan Visual Referee question corpus (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B question_corpus.py --synth <synth/corpus.json> --real <real/corpus.json> --items <items jsonl...> --out <question-corpus.json>

Text facts only (brief section 20): for every question its set, class, closed enum, expected answer and why, the
candidate geometry in source pixels, the transform, the crop box, and per overlay mode the SHA-256 of the exact image
and the prompt every model saw. Real questions carry the source frame id, the source byte SHA-256 and the SHA-256 of the
variant URL - never a pixel. Synthetic questions carry the generator seed, style and the render's SHA-256.
"""
import argparse
import hashlib
import json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--synth', required=True)
    ap.add_argument('--real', required=True)
    ap.add_argument('--items', required=True, help='comma-separated items.jsonl files (composed images)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--frame-meta', required=True, help='comma-separated frame meta files (005I *.meta.json, 005J frames-005j.json)')
    a = ap.parse_args()
    synth = json.load(open(a.synth))
    real = json.load(open(a.real))
    images = {}
    prompts = {}
    for path in a.items.split(','):
        for l in open(path):
            it = json.loads(l)
            images.setdefault(it['qid'], {})[it['mode']] = {'imageSha256': it['imageSha256'], 'cropBoxPx': it['cropBoxPx'], 'promptSha256': hashlib.sha256(it['prompt'].encode()).hexdigest()}
            prompts[(it['cls'], it['mode'])] = it['prompt']
    scenes = {s['sceneId']: s for s in synth['scenes']}
    out = {'stage': 'BUILDPLAN-ANALYZER-005J', 'policy': 'no publisher pixel; real sources by frame id, byte SHA-256 and URL SHA-256 only',
           'synthetic': {'generator': synth['generator'], 'version': synth['version'], 'seedBase': synth['seedBase'], 'seeds': synth['seeds'], 'transforms': synth['transforms']},
           'real': {}, 'promptTemplates': {f'{c}|{m}': p for (c, m), p in sorted(prompts.items())}, 'questions': []}
    urls = {}
    for f in a.frame_meta.split(','):
        d = json.load(open(f))
        for rec in (d if isinstance(d, list) else [d]):
            urls[rec['house']] = rec.get('variantUrl') or rec.get('variant', {}).get('url')
    for h, s in real['sources'].items():
        u = urls.get(h)
        out['real'][h] = {'frameId': s['frameId'], 'sourceByteSha256': s['byteSha256'], 'variantUrlSha256': hashlib.sha256(u.encode()).hexdigest() if u else None,
                          'decodedRgbaSha256': s['rgbaSha256'], 'metresPerPx': s['mpp'],
                          'truth': s.get('truth', 'accepted 005I blind-8 diagnosis (report section P), coordinates read from the frame')}
    for q in synth['questions']:
        sc = scenes[q['sceneId']]
        out['questions'].append({'qid': q['qid'], 'set': 'SYNTHETIC', 'cls': q['cls'], 'enum': q['enum'], 'expected': q['expected'], 'why': q['fact'], 'family': q['family'], 'pair': q['pair'],
                                 'variant': q['variant'], 'counterfactualOf': q['pairQid'], 'transform': q['transform'], 'seed': sc['seed'], 'renderSha256': sc['pngSha256'],
                                 'targetKind': q['targetKind'], 'targetPx': q['targetPx'], 'images': images.get(q['qid'], {})})
    for q in real['questions']:
        out['questions'].append({'qid': q['qid'], 'set': q['set'], 'house': q['house'], 'cls': q['cls'], 'enum': q['enum'], 'expected': q['expected'], 'why': q['fact'],
                                 'source': q['src'], 'transform': q['transform'], 'targetKind': q['targetKind'], 'targetFramePx': q['targetFramePx'], 'images': images.get(q['qid'], {})})
    out['counts'] = {}
    for q in out['questions']:
        k = f"{q['set']}|{q['transform']}"
        out['counts'][k] = out['counts'].get(k, 0) + 1
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    print(len(out['questions']), out['counts'])


if __name__ == '__main__':
    main()
