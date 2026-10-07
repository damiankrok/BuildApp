#!/usr/bin/env python3
"""corpus.py - the 005M question pool (RESEARCH ONLY; pixels stay outside the repository).

    python -I -B research/analyzer-005m/corpus.py --work <W> --repo . [--synth-global <W>/sg/corpus.json]

Development material only - never a fresh blind house (brief section 7):

  REAL_DEV       005J: 7 development houses, 005I manual truth, 4 transforms (renders of the frames)
  ROUND8_DEV     005J: gozdzikowcach and cyklamenach, the accepted 005I diagnosis (development since 005I)
  GAPSET_DEV     005K: the 60-gap fresh-sheet set, consumed by 005K and development since; labels are blind
                 AI-subagent majorities (NOT human ground truth); the 6 UNRESOLVED-labelled gaps are left out
  MURAJACH_DEV   005L blind-9 #1, failed and diagnosed (development since 005L): questions authored in 005M from
                 the 005L diagnosis and a reading of the ground plan (frame pixels below)
  STOREY_DEV     005L development rows A06 / A07: ground + upper plan side by side; coverage read from the 005L
                 registration (STACKED, wall pairs) and the two plans
  SYNTH_CF       005J synthetic counterfactual pairs (generator truth)
  SYNTH_GLOBAL   005M generator (synthetic/vrgen2.py), sealed test split only (generator truth)

Every record names its source image(s) by path and SHA-256 and its target in source pixels. The pool is written to
<W>/corpus/pool.json, outside the repository; question_corpus.py writes the committed text-only record.
"""
import argparse
import hashlib
import json
import os
import re
import sys
from io import BytesIO

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

J_CLS = {'OUTER_BOUNDARY_A_OR_B': {'A': 'OUTLINE_1', 'B': 'OUTLINE_2', 'NEITHER': 'NEITHER'}}

# 005M-authored development questions on dom-w-murajach's ground plan (frame frame-asset-rzut-36e1e5a39d-fb4609c5e2,
# 853 x 853, read at the pixel rulers outside the repository). The 005L diagnosis: the recessed entrance vestibule and
# the 250/225 garage door share the stepped-back front line (y ~ 609-634); the rooms' front is ~1 m further out (y ~ 685).
MURAJACH = [
    ('M1', 'WALL_CONTINUATION', 'SEGMENT', [[557, 621], [718, 621]], 'CONTINUES', 'garage door 250/225 in the continuing garage front'),
    ('M2', 'GAP_KIND', 'SEGMENT', [[410, 621], [477, 621]], 'OPENING', 'entrance door 105/210 in the vestibule front wall'),
    ('M3', 'OPEN_SIDE_VS_OPENINGS', 'SEGMENT', [[410, 621], [718, 621]], 'SEVERAL_OPENINGS', 'entrance door + pier + garage door on the stepped-back front'),
    ('M4', 'BODY_REGION', 'REGION', [[413, 530], [520, 530], [520, 604], [413, 604]], 'YES', 'vestibule 1 behind the entrance door'),
    ('M5', 'TERRACE_VS_BODY', 'REGION', [[413, 638], [553, 638], [553, 682], [413, 682]], 'EXTERNAL', 'covered porch in front of the entrance'),
    ('M6', 'GARAGE_BODY', 'REGION', [[562, 240], [712, 240], [712, 600], [562, 600]], 'YES', 'garage 7 behind the garage door'),
    ('M7', 'TERRACE_VS_BODY', 'REGION', [[185, 30], [355, 30], [355, 200], [185, 200]], 'EXTERNAL', 'garden terrace with loungers beyond the rear wall'),
    ('M8', 'CANOPY_PERGOLA_VS_WALL', 'SEGMENT', [[565, 685], [712, 685]], 'NOT_WALL', 'dashed overhang line in front of the garage door'),
]
MURAJACH_FRAME = ('h1-dom-w-murajach', 'frame-asset-rzut-36e1e5a39d-fb4609c5e2')

# STOREY_DEV: ground (left) and upper (right) frames side by side; region in ground-frame pixels.
# 005L registration (storey-registration.json): A06 attic placed at scale 1, offset (18, 37.9) px, decision STACKED;
# A07 upper at scale 1.001, offset (-11.6, 26.2), STACKED. The upper bodies cover the ground bodies; the open
# terraces beyond the ground bodies carry no storey.
STOREY = [
    ('A06', 'frame-asset-rzut-f08001e3c4-8b24c71f3f', 'frame-asset-rzut-eccabe6307-98a0db655a', 'S1', [[168, 300], [335, 300], [335, 455], [168, 455]], 'YES', 'living room 6 under the attic body'),
    ('A06', 'frame-asset-rzut-f08001e3c4-8b24c71f3f', 'frame-asset-rzut-eccabe6307-98a0db655a', 'S2', [[150, 95], [365, 95], [365, 200], [150, 200]], 'NO', 'open terrace beyond the ground body'),
    ('A07', 'frame-asset-rzut-dec884e019-46909f56cf', 'frame-asset-rzut-a46fd40284-47285d772c', 'S3', [[70, 240], [250, 240], [250, 395], [70, 395]], 'YES', 'living room 4 under the upper body'),
]
STOREY_GAP = 20


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def frame_bytes(run, cache, fid):
    pkg = json.load(open(os.path.join(run, 'source-package.json')))
    for a in pkg['assets']:
        if not fid.startswith('frame-' + a['id'] + '-'):
            continue
        sel = [v for v in a['variants'] if v.get('id') == a.get('selectedVariantId')] or a['variants']
        v = sel[0]
        data = open(os.path.join(cache, hashlib.sha256(v['url'].encode()).hexdigest()[:32] + '.bin'), 'rb').read()
        assert hashlib.sha256(data).hexdigest() == v['byteHash'], 'cached bytes are not the sealed frame'
        return v['byteHash'], data
    raise KeyError(fid)


def save_png(img, path):
    if not os.path.exists(path):
        img.save(path)
    return {'path': path, 'sha256': sha(path), 'size': list(Image.open(path).size)}


def gap_of(ab):
    """AB_SEGMENTS (wall piece A, wall piece B) -> the gap between their nearest ends."""
    best = None
    for a in ab['A']:
        for b in ab['B']:
            d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
            if best is None or d < best[0]:
                best = (d, a, b)
    return [list(best[1]), list(best[2])]


def j005(work, repo, real):
    path = os.path.join(work, 'real' if real else 'synth', 'corpus.json')
    c = json.load(open(path))
    scenes = {s['sceneId']: s for s in c['scenes']}
    excl = json.load(open(os.path.join(repo, 'research/analyzer-005j/exclusions.json')))['excluded']
    out = []
    for q in c['questions']:
        if q['baseQid'] in excl:
            continue
        sc = scenes[q['sceneId']]
        img = os.path.join(work, 'real' if real else 'synth', 'renders', f"{q['sceneId']}.png")
        kind = q['targetKind']
        target = q['targetPx']
        if kind == 'AB_SEGMENTS':
            target, kind = gap_of(target), 'SEGMENT'
        expected = J_CLS.get(q['cls'], {}).get(q['expected'], q['expected'])
        if real:
            st = 'ROUND8_DEV' if q['set'] == 'REAL_BLIND8' else 'REAL_DEV'
            order_key = q['baseQid']
        else:
            st = 'SYNTH_CF'
            order_key = re.sub(r'-[AB]-q', '-q', q['baseQid'])
        ppm = sc.get('pxPerM') or sc['style']['pxPerM']
        rec = {'qid': '005j:' + q['qid'], 'set': st, 'cls': q['cls'], 'targetKind': kind, 'target': target, 'expected': expected,
               'orderKey': order_key, 'baseQid': '005j:' + q['baseQid'], 'pairQid': ('005j:' + q['pairQid']) if q.get('pairQid') else None,
               'transform': q['transform'], 'group': q.get('house') or q.get('family'), 'variant': q.get('variant'),
               'sources': [{'path': img, 'sha256': sc.get('pngSha256') or None}], 'ppm': ppm,
               'truthSource': q.get('src') or 'GENERATOR_005J', 'fact': q.get('fact'), 'panels': sc.get('panels')}
        if rec['sources'][0]['sha256'] is None:
            rec['sources'][0]['sha256'] = sha(img)
        out.append(rec)
    return out


def gapset(work005k, repo, fdir):
    man = json.load(open(os.path.join(repo, 'stage-reports/artifacts/analyzer-005k/gap-set-manifest.json')))
    labels = {l['key']: l for l in json.load(open(os.path.join(repo, 'stage-reports/artifacts/analyzer-005k/gap-set-labels.json')))['labels']}
    out = []
    for g in man['gaps']:
        lab = labels[g['key']]
        if lab['label'] == 'UNRESOLVED':
            continue
        pkg = json.load(open(os.path.join(work005k, 'runs', g['project'], 'source-package.json')))
        v = next(v for a in pkg['assets'] for v in a['variants'] if v['byteHash'] == g['variantByteHash'])
        data = open(os.path.join(work005k, 'cache', hashlib.sha256(v['url'].encode()).hexdigest()[:32] + '.bin'), 'rb').read()
        assert hashlib.sha256(data).hexdigest() == g['variantByteHash']
        src = save_png(Image.open(BytesIO(data)).convert('RGB'), os.path.join(fdir, f"gapset-{g['project']}-{g['variantByteHash'][:12]}.png"))
        src['byteHash'] = g['variantByteHash']
        a, b = [g['start']['x'], g['start']['y']], [g['end']['x'], g['end']['y']]
        out.append({'qid': '005k:' + g['qid'], 'set': 'GAPSET_DEV', 'cls': 'GAP_KIND', 'targetKind': 'SEGMENT', 'target': [a, b],
                    'expected': lab['label'], 'orderKey': '005k:' + g['qid'], 'baseQid': '005k:' + g['qid'], 'pairQid': None,
                    'transform': 'NORMAL', 'group': g['project'], 'variant': None, 'sources': [src], 'ppm': 1.0 / g['mppAlong'],
                    'wallPx': g['wallPx'], 'truthSource': 'AI_SUBAGENT_MAJORITY_005K (' + lab['label_source'] + ')', 'fact': g['gapId']})
    return out


def murajach(work005l, fdir):
    run = os.path.join(work005l, 'blind', MURAJACH_FRAME[0])
    bh, data = frame_bytes(run, os.path.join(work005l, 'blind', 'cache'), MURAJACH_FRAME[1])
    src = save_png(Image.open(BytesIO(data)).convert('RGB'), os.path.join(fdir, f'murajach-ground-{bh[:12]}.png'))
    src['byteHash'] = bh
    # scale: 1020 cm overall over the walls' outer faces x 110..765 (the frame's own dimension), ~0.0156 m/px
    ppm = 655 / 10.2
    return [{'qid': f'005m:murajach-{i}', 'set': 'MURAJACH_DEV', 'cls': c, 'targetKind': k, 'target': t, 'expected': e,
             'orderKey': f'005m:murajach-{i}', 'baseQid': f'005m:murajach-{i}', 'pairQid': None, 'transform': 'NORMAL',
             'group': 'dom-w-murajach', 'variant': None, 'sources': [src], 'ppm': ppm, 'wallPx': 25,
             'truthSource': 'AUTHORED_005M_FROM_005L_DIAGNOSIS', 'fact': f} for i, c, k, t, e, f in MURAJACH]


def storey(work005k, fdir):
    out = []
    for row, gf, uf, i, poly, e, fact in STOREY:
        run = os.path.join(work005k, 'runs', row)
        cache = os.path.join(work005k, 'cache')
        gh, gd = frame_bytes(run, cache, gf)
        uh, ud = frame_bytes(run, cache, uf)
        g, u = Image.open(BytesIO(gd)).convert('RGB'), Image.open(BytesIO(ud)).convert('RGB')
        comp = Image.new('RGB', (g.size[0] + STOREY_GAP + u.size[0], max(g.size[1], u.size[1])), (255, 255, 255))
        comp.paste(g, (0, 0))
        comp.paste(u, (g.size[0] + STOREY_GAP, 0))
        src = save_png(comp, os.path.join(fdir, f'storey-{row}-{gh[:8]}-{uh[:8]}.png'))
        src['byteHash'] = [gh, uh]
        out.append({'qid': f'005m:storey-{row}-{i}', 'set': 'STOREY_DEV', 'cls': 'STOREY_COVERAGE', 'targetKind': 'REGION', 'target': poly,
                    'expected': e, 'orderKey': f'005m:storey-{row}-{i}', 'baseQid': f'005m:storey-{row}-{i}', 'pairQid': None,
                    'transform': 'NORMAL', 'group': row, 'variant': None, 'sources': [src], 'ppm': 853 / 13.0, 'wallPx': 22,
                    'truthSource': 'AUTHORED_005M_FROM_005L_REGISTRATION', 'fact': fact, 'panels': ['GROUND', 'UPPER'],
                    'cropPanel': [0, 0, g.size[0], g.size[1]]})
    return out


def synth_global(path):
    c = json.load(open(path))
    scenes = {s['sceneId']: s for s in c['scenes']}
    out = []
    for q in c['questions']:
        if q['split'] != 'TEST':
            continue
        sc = scenes[q['sceneId']]
        img = os.path.join(os.path.dirname(path), 'renders', f"{q['sceneId']}.png")
        kind, target = q['targetKind'], q['targetPx']
        if kind == 'AB_SEGMENTS':
            target, kind = gap_of(target), 'SEGMENT'
        out.append({'qid': '005m:' + q['qid'], 'set': 'SYNTH_GLOBAL', 'cls': q['cls'], 'targetKind': kind, 'target': target,
                    'expected': J_CLS.get(q['cls'], {}).get(q['expected'], q['expected']), 'orderKey': re.sub(r'-[AB]-q', '-q', q['baseQid']),
                    'baseQid': '005m:' + q['baseQid'], 'pairQid': ('005m:' + q['pairQid']) if q.get('pairQid') else None,
                    'transform': q['transform'], 'group': q['family'], 'variant': q.get('variant'),
                    'sources': [{'path': img, 'sha256': sc['pngSha256']}], 'ppm': sc['style']['pxPerM'],
                    'truthSource': 'GENERATOR_005M', 'fact': q.get('fact'), 'panels': sc.get('panels'),
                    'contextDependent': q.get('contextDependent', False), 'cropPanel': q.get('cropPanel')})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--repo', required=True)
    ap.add_argument('--j005', default='/home/user/work005j')
    ap.add_argument('--k005', default='/home/user/work005k/gapset')
    ap.add_argument('--l005', default='/home/user/work005l')
    ap.add_argument('--synth-global', default=None)
    a = ap.parse_args()
    fdir = os.path.join(a.work, 'frames')
    os.makedirs(fdir, exist_ok=True)
    os.makedirs(os.path.join(a.work, 'corpus'), exist_ok=True)
    pool = j005(a.j005, a.repo, True) + j005(a.j005, a.repo, False) + gapset(a.k005, a.repo, fdir) + murajach(a.l005, fdir) + storey(a.k005, fdir)
    if a.synth_global:
        pool += synth_global(a.synth_global)
    ids = [q['qid'] for q in pool]
    assert len(ids) == len(set(ids))
    json.dump({'researchOnly': 'BUILDPLAN-ANALYZER-005M', 'questions': pool}, open(os.path.join(a.work, 'corpus', 'pool.json'), 'w'))
    from collections import Counter
    print(json.dumps(Counter(q['set'] for q in pool)))


if __name__ == '__main__':
    main()
