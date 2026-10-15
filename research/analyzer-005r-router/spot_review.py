#!/usr/bin/env python3
"""
spot_review.py — 005R-ROUTER local OWNER spot-review task (RESEARCH ONLY; never imported by production).

    python3 -I research/analyzer-005r-router/spot_review.py <005R corpus-private.json> <role-truth.json> <005R images dir> \
        <private-task-dir outside Git> <committed-manifest.json>

Builds the brief's §4 manual spot-review set WITHOUT showing any pixel to anyone remote and without Claude labelling
anything: Claude never opens these images, and no OCR/VLM run substitutes for the reviewer (brief §4). Strata:

  S1  every item of the interiors carousel whose caption names a styling variant / all segments (005R C1: 15)
  S2  every page image named "widok-<n>" with no structural truth (005R C2: 150), deduplicated by lineage group
  S3  structural interiors (carousel position), stratified: at most 2 lineage groups per family, seeded draw
  S4  page-tab elevations (technical or photo-real orthographic), at most 2 lineage groups per family, seeded draw
  S5  every asset of OWNER's anchor edition m3ea28300f9b3e and of Rarytasy 5 (G2E) m84f2903cb8e14 — DEV only, never blind

Per task: assetSha, editionIds, lineageGroup, stratum, sourceBox (the whole decoded image), the labels that already
exist (005R structural truth class and basis — NOT shown as an answer), and the questions requested (scene scope,
projection, drawing kind, edition match). The private task file points at the local image path; the committed
manifest holds hashes, ids, strata and counts only. The draw is seeded and recorded so it cannot be re-rolled.
"""
import hashlib
import json
import os
import sys

SEED = 'BUILDPLAN-005R-ROUTER-SPOT-REVIEW'
OWNER_EDITIONS = ('archon:m3ea28300f9b3e', 'archon:m84f2903cb8e14')
QUESTIONS = {
    'sceneScope': ['INTERIOR', 'EXTERIOR', 'BOTH_VISIBLE', 'NOT_A_SCENE', 'CANNOT_TELL'],
    'projection': ['ORTHOGRAPHIC_FACADE', 'PERSPECTIVE', 'PLAN_OR_SECTION', 'CANNOT_TELL'],
    'drawingKind': ['TECHNICAL_LINE_DRAWING', 'PHOTO_REAL_RENDER', 'PHOTOGRAPH', 'CANNOT_TELL'],
    'sameHouseAsEdition': ['YES', 'NO', 'CANNOT_TELL'],
}


def rank(key):
    return hashlib.sha256(f'{SEED}:{key}'.encode()).hexdigest()


def per_family(rows, k=2):
    picked, seen = [], {}
    by_group = {}
    for r in rows:
        by_group.setdefault(r['lineageGroup'], r)
    for r in sorted(by_group.values(), key=lambda r: rank(r['lineageGroup'])):
        if seen.get(r['family'], 0) >= k:
            continue
        seen[r['family']] = seen.get(r['family'], 0) + 1
        picked.append(r)
    return picked


def main(corpus_p, truth_p, images_dir, private_dir, manifest_p):
    import re
    corpus = {a['assetId']: a for a in json.load(open(corpus_p))['assets']}
    truth = {r['assetId']: r for r in json.load(open(truth_p))['rows']}
    styling = re.compile(r'stylizacj|wszystkich segment', re.I)
    view_slug = re.compile(r'^widok-\d')
    rows = []
    for aid, a in corpus.items():
        t = truth.get(aid, {})
        rows.append({'assetId': aid, 'sha256': a['variantSha256'], 'editions': a['editions'], 'family': a['family'], 'lineageGroup': a['lineageGroup'],
                     'split': a['split'], 'width': a['width'], 'height': a['height'], 'file': a['file'], 'truth': t.get('roleTruth'), 'basis': t.get('basis'),
                     'm': a['memberships']})
    s1 = [r for r in rows if any(m['channel'] == 'CAROUSEL:fancybox3Interiors' and styling.search(m.get('caption') or '') for m in r['m'])]
    s2_all = [r for r in rows if r['truth'] == 'UNKNOWN' and any(view_slug.match(m['url'].rsplit('/', 1)[-1].lower()) for m in r['m'])]
    s2 = list({r['lineageGroup']: r for r in sorted(s2_all, key=lambda r: rank(r['assetId']))}.values())
    s3 = per_family([r for r in rows if r['truth'] == 'INTERIOR_RENDER' and r not in s1])
    s4 = per_family([r for r in rows if r['truth'] == 'TECHNICAL_ELEVATION'])
    s5 = [r for r in rows if any(e in OWNER_EDITIONS for e in r['editions'])]
    strata = {'S1': s1, 'S2': s2, 'S3': s3, 'S4': s4, 'S5': s5}
    os.makedirs(private_dir, exist_ok=True)
    tasks, manifest_rows = [], []
    for name, items in strata.items():
        for r in sorted(items, key=lambda r: r['sha256']):
            tasks.append({'stratum': name, 'assetSha': r['sha256'], 'editionIds': r['editions'], 'lineageGroup': r['lineageGroup'], 'split': r['split'],
                          'sourceBox': [0, 0, r['width'], r['height']], 'localPath': os.path.join(images_dir, r['file']),
                          'existingLabels': {'truth005R': r['truth'], 'basis': r['basis'], 'shownToReviewer': False},
                          'requested': QUESTIONS, 'answer': None, 'reviewer': None, 'reviewedAt': None})
            manifest_rows.append({'stratum': name, 'assetSha': r['sha256'], 'editionIds': r['editions'], 'lineageGroup': r['lineageGroup'], 'split': r['split']})
    json.dump({'schema': 'research.005r-router.spot-review-task.0.1', 'protocol': 'stage-reports/artifacts/analyzer-005r-router/truth/owner-spot-review-request.md', 'tasks': tasks},
              open(os.path.join(private_dir, 'spot-review-tasks.json'), 'w'), indent=1, sort_keys=True)
    manifest = {'schema': 'research.005r-router.spot-review-manifest.0.1', 'seed': SEED, 'status': 'NOT_RUN_HUMAN_TRUTH',
                'counts': {k: len(v) for k, v in strata.items()}, 'c2AssetsBeforeLineageDedup': len(s2_all), 'questions': QUESTIONS,
                'rows': manifest_rows}
    json.dump(manifest, open(manifest_p, 'w'), indent=1, sort_keys=True)
    print(json.dumps(manifest['counts']), len(s2_all))


if __name__ == '__main__':
    main(*sys.argv[1:6])
