#!/usr/bin/env python3
"""
build_pack.py — 005R-EXTERIOR OWNER truth pack: deterministic review queue (RESEARCH ONLY; never imported by
production).

    python3 -I research/analyzer-005r-exterior-owner-review/build_pack.py [--check]

Reads only committed JSON (preregistration.md §2) and writes `pack/` and `results/` next to this file. It decodes no
pixel, opens no publisher image and assigns no answer: the queue is built from ids, hashes and structure only. With
`--check` it rebuilds in memory and fails if a committed file differs (the pack is reproducible from the repository).
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.realpath(os.path.join(HERE, '..', '..'))
EXT = os.path.join(REPO, 'research', 'analyzer-005r-exterior', 'results')
M005R = os.path.join(REPO, 'stage-reports', 'artifacts', 'analyzer-005r', 'corpus', 'corpus-manifest.json')

SEED = 'BUILDPLAN-005R-EXTERIOR-OWNER-REVIEW-V1'
PACK_ID = 'archon-005r-exterior-owner-review-v1'
OWNER = 'archon:m3ea28300f9b3e'
G2E5 = 'archon:m84f2903cb8e14'
CAP = 60
DISTINCTIVE = ['PERGOLA', 'CARPORT', 'ENTRANCE_CANOPY', 'COLUMN', 'BALCONY', 'LOGGIA', 'RAILING']
TO_B1 = {'COLUMN': 'COLUMNS_SUPPORTS', 'GARAGE': 'GARAGE_ENCLOSED', 'OPENING_GLAZING': 'LARGE_GLAZING'}
FROM_B1 = {v: k for k, v in TO_B1.items()}
COVER_CLASSES = ['PERGOLA', 'CARPORT', 'ENTRANCE_CANOPY', 'TERRACE']
PARTNERS = [('GARAGE', 'CARPORT'), ('BALCONY', 'LOGGIA'), ('TERRACE', 'COLUMN'), ('ENTRANCE_CANOPY', 'COLUMN')]
URL_PAGE = re.compile(r'^https://www\.archon\.pl/projekty-domow/[a-z0-9-]+$')
VOCAB = {
    'featureAnswer': ['PRESENT', 'ABSENT', 'NOT_SHOWN', 'CANNOT_TELL'],
    'sceneAnswer': ['EXTERIOR', 'INTERIOR', 'BOTH_VISIBLE', 'NOT_A_SCENE', 'CANNOT_TELL'],
    'cover': ['OPEN_MEMBERS', 'CONTINUOUS_COVER', 'NO_COVER', 'UNKNOWN'],
    'assembly': ['GARAGE', 'COVERED_TERRACE', 'ENTRANCE_CANOPY', 'CARPORT', 'OTHER', 'UNKNOWN'],
    'side': ['FRONT', 'GARDEN', 'LEFT', 'RIGHT'],
    'mirrored': ['YES', 'NO'],
    'technicalEvidence': ['TECHNICAL_SHOWS', 'TECHNICAL_DOES_NOT_SHOW', 'NO_TECHNICAL_EVIDENCE', 'CANNOT_TELL'],
    'evidenceSource': ['ELEVATION_IN_PACK', 'PLAN_OR_SECTION_ON_PAGE', 'ELEVATION_ON_PAGE', 'OTHER'],
    'sourceContext': ['AGREES', 'DISAGREES', 'NO_CONTEXT'],
    'featureClasses': ['PERGOLA', 'CARPORT', 'ENTRANCE_CANOPY', 'COLUMN', 'BALCONY', 'LOGGIA', 'RAILING', 'TERRACE',
                       'GARAGE', 'ROOFCOVER', 'OPENING_GLAZING', 'UNKNOWN_ASSEMBLY'],
    'coverClasses': COVER_CLASSES,
}


def rank(k):
    return hashlib.sha256(f'{SEED}:{k}'.encode()).hexdigest()


def sha_file(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def canon(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, indent=1) + '\n'


def file_token(url):
    base = url.rsplit('/', 1)[-1]
    m = re.search(r'([0-9a-f]{32})__(\d+)', base)
    return f'{m.group(1)}__{m.group(2)}' if m else base


def channel_kind(channel):
    if channel == 'PAGE:fancybox3ProdBigImg0':
        return 'HERO_GALLERY'
    if channel == 'PAGE:elevations-tab':
        return 'ELEVATIONS_TAB'
    if channel == 'CAROUSEL:fancybox3Interiors':
        return 'INTERIORS_CAROUSEL'
    return 'OTHER_PAGE_POSITION'


def view_hint(urls):
    tokens = set()
    for u in urls:
        base = u.rsplit('/', 1)[-1].lower()
        for word, side in (('elewacja-frontowa', 'FRONT'), ('elewacja-ogrodowa', 'GARDEN'), ('elewacja-boczna', 'SIDE')):
            if base.startswith(word):
                tokens.add(side)
    return sorted(tokens)[0] if len(tokens) == 1 else ('AMBIGUOUS' if tokens else 'UNKNOWN')


def load_inputs(order_seed=None):
    man = json.load(open(os.path.join(EXT, 'corpus-manifest.json')))
    b1 = json.load(open(os.path.join(EXT, 'proposals-B1.json')))['proposals']
    strict = json.load(open(os.path.join(EXT, 'addendum-e-strict.json')))['rows']
    m5 = json.load(open(M005R))
    if order_seed is not None:  # T5: reordered inputs must give the same pack
        import random
        rnd = random.Random(order_seed)
        rnd.shuffle(man['assets'])
        rnd.shuffle(b1)
        rnd.shuffle(strict)
    return man, b1, strict, m5


def build(order_seed=None, page_access=None):
    man, b1, strict, m5 = load_inputs(order_seed)
    b1 = sorted(b1, key=lambda p: p['proposalId'])  # every later dict is then independent of input order (audit 7)
    strict = sorted(strict, key=canon)
    m5a = {a['variantSha256']: a for a in m5['assets']}
    assets = {a['assetByteHash']: a for a in man['assets']}
    by_group = {}
    for a in sorted(man['assets'], key=lambda a: a['assetByteHash']):
        by_group.setdefault(a['lineageGroup'], []).append(a)

    def urls_for(byte_hash, edition):
        return sorted(x['url'] for x in m5a[byte_hash]['memberships'] if x['editionKey'] == edition)

    def channels_for(a, edition):
        return sorted({channel_kind(x['channel']) for x in a['memberships'] if x['editionKey'] == edition})

    def accepted(anchor, edition):
        toks = {file_token(u) for u in urls_for(anchor['assetByteHash'], edition)}
        out = [anchor['assetByteHash']]
        for a in by_group[anchor['lineageGroup']]:
            if a is anchor or edition not in a['editions']:
                continue
            if toks & {file_token(u) for u in urls_for(a['assetByteHash'], edition)}:
                out.append(a['assetByteHash'])
        return sorted(out)

    def anchor_of(group, edition, purpose):
        cands = [a for a in by_group[group] if edition in a['editions']]
        if not cands:
            return None

        def key(a):
            ch = channels_for(a, edition)
            pref = {'STRUCTURE_CONFLICT_CONTROL': 'INTERIORS_CAROUSEL', 'TECHNICAL_ELEVATION': 'ELEVATIONS_TAB'}.get(purpose)
            role = {'EXTERIOR_RENDER': 'EXTERIOR_RENDER', 'TECHNICAL_ELEVATION': 'TECHNICAL_ELEVATION',
                    'INTERIOR_NEGATIVE': 'INTERIOR_RENDER'}.get(purpose)
            return (0 if pref and pref in ch else 1, 0 if role and a['structureRole005r'] == role else 1,
                    -(a['width'] * a['height']), a['assetByteHash'])
        return sorted(cands, key=key)[0]

    qs, seen, exclusions = [], {}, []

    def add(rule, edition, anchor, kind, cls, b1_ref=None):
        key = (edition, anchor['lineageGroup'], kind, cls)
        if key in seen:
            exclusions.append({'reason': 'DEDUP_SAME_KEY', 'rule': rule, 'keptRule': seen[key], 'projectEditionId': edition,
                               'lineageGroup': anchor['lineageGroup'], 'kind': kind, 'featureClass': cls, 'b1ProposalId': b1_ref})
            return
        seen[key] = rule
        qid = 'q-' + rank(f"{edition}:{anchor['assetByteHash']}:{kind}:{cls}")[:12]
        qs.append({'questionId': qid, 'rule': rule, 'projectEditionId': edition, 'anchor': anchor, 'kind': kind,
                   'featureClass': cls, 'b1ProposalId': b1_ref})

    # R1 — the 19 abstained B1 feature-visibility questions, on their own asset and edition
    fv = sorted((p for p in b1 if p['proposalKind'] == 'FEATURE_VISIBILITY'), key=lambda p: p['proposalId'])
    r1_frames = {}
    for p in fv:
        a = assets.get(p['assetByteHash'])
        if a is None or p['projectEditionId'] not in a['editions']:
            exclusions.append({'reason': 'B1_ANCHOR_NOT_TRACEABLE', 'b1ProposalId': p['proposalId']})
            continue
        cls = FROM_B1.get(p['featureClass'], p['featureClass'])
        add('R1', p['projectEditionId'], a, 'FEATURE_VISIBILITY', cls, p['proposalId'])
        r1_frames.setdefault((p['projectEditionId'], a['assetByteHash']), set()).add(cls)
    # R2 — look-alike partners on the same frames
    for (edition, h), asked in sorted(r1_frames.items()):
        for src, partner in PARTNERS:
            if src in asked and partner not in asked:
                add('R2', edition, assets[h], 'FEATURE_VISIBILITY', partner)
    # R3 — scene question for exterior-render groups whose B1 scene role abstained, plus OWNER's anchor frame
    role = {}
    for p in b1:
        if p['proposalKind'] == 'SCENE_ROLE':
            role[(p['projectEditionId'], p['assetByteHash'])] = p['role']
    conflict_groups = sorted(g for g, v in man['groups'].items() if 'STRUCTURE_CONFLICT_CONTROL' in v['purposes'])
    for g in sorted(man['groups']):
        v = man['groups'][g]
        if 'EXTERIOR_RENDER' not in v['purposes'] or g in conflict_groups:
            continue
        for edition in sorted(v['editions']):
            a = anchor_of(g, edition, 'EXTERIOR_RENDER')
            if a is None:
                continue
            if role.get((edition, a['assetByteHash'])) != 'EXTERIOR_PERSPECTIVE' or edition == OWNER:
                add('R3', edition, a, 'SCENE_SCOPE', None)
    # R4 — interiors and structure-conflict controls, one question per group, never propagated
    for g in sorted(man['groups']):
        v = man['groups'][g]
        purpose = 'STRUCTURE_CONFLICT_CONTROL' if g in conflict_groups else ('INTERIOR_NEGATIVE' if 'INTERIOR_NEGATIVE' in v['purposes'] else None)
        if purpose is None:
            continue
        eds = sorted(v['editions'])
        edition = OWNER if OWNER in eds else sorted(eds, key=lambda e: rank(f'{g}:{e}'))[0]
        a = anchor_of(g, edition, purpose)
        add('R4', edition, a, 'SCENE_SCOPE', None)
        for other in eds:
            if other != edition:
                exclusions.append({'reason': 'BYTE_SHARED_LINEAGE_NOT_PROPAGATED', 'projectEditionId': other, 'lineageGroup': g,
                                   'answeredUnder': edition})
    # R5 — one feature question per edition on its B1 elevation frame
    frame_feature = {(p['projectEditionId'], p['assetByteHash']): FROM_B1.get(p['featureClass'], p['featureClass'])
                     for p in b1 if p['proposalKind'] == 'FEATURE' and p['scope'] == 'FRAME'}
    r1_by_edition = {}  # addendum B: R1 classes plus their R2 partners, so the pool is not a list of claims
    for q in qs:
        if q['rule'] in ('R1', 'R2'):
            r1_by_edition.setdefault(q['projectEditionId'], set()).add(q['featureClass'])
    for edition in sorted(man['editions']):
        elev = sorted(h for (e, h), r in role.items() if e == edition and r == 'TECHNICAL_ELEVATION')
        if not elev:
            exclusions.append({'reason': 'NO_B1_ELEVATION_FRAME', 'projectEditionId': edition})
            continue
        a = assets[elev[0]]
        if (edition, a['assetByteHash']) in frame_feature:
            cls = frame_feature[(edition, a['assetByteHash'])]
        elif edition in r1_by_edition:
            pool = [c for c in r1_by_edition[edition] if c in DISTINCTIVE] or sorted(r1_by_edition[edition])
            cls = sorted(pool, key=lambda c: rank(f'{edition}:{c}'))[0]
        else:
            cls = sorted(DISTINCTIVE, key=lambda c: rank(f'{edition}:{c}'))[0]
        add('R5', edition, a, 'FEATURE_VISIBILITY', cls)

    # tiers, buckets, cap
    r1_images = {(q['projectEditionId'], q['anchor']['assetByteHash']) for q in qs if q['rule'] == 'R1'}

    def tier(q):
        # addendum B (audit P0): tier is a property of the IMAGE, so the claim-derived R1 questions and their
        # non-claim R2 partners on the same frame share it and the tier says nothing about publisher claims
        if (q['projectEditionId'], q['anchor']['assetByteHash']) in r1_images or q['projectEditionId'] == OWNER \
                or q['anchor']['lineageGroup'] in conflict_groups:
            return 'PRIORITY'
        return 'SECONDARY'
    bucket = {'R3': 1, 'R2': 2, 'R5': 3, 'R4': 4}
    pri = sorted((q for q in qs if tier(q) == 'PRIORITY'), key=lambda q: rank(q['questionId']))
    sec = sorted((q for q in qs if tier(q) == 'SECONDARY'), key=lambda q: (bucket[q['rule']], rank(q['questionId'])))
    kept = pri + sec[:max(0, CAP - len(pri))]
    for q in sec[max(0, CAP - len(pri)):]:
        exclusions.append({'reason': 'CAP_60', 'questionId': q['questionId'], 'rule': q['rule'], 'projectEditionId': q['projectEditionId'],
                           'lineageGroup': q['anchor']['lineageGroup'], 'kind': q['kind'], 'featureClass': q['featureClass']})

    images = {}
    for q in kept:
        a = q['anchor']
        q['tier'] = tier(q)
        q['imageId'] = 'img-' + rank(a['assetByteHash'])[:10]
        q['accepted'] = accepted(a, q['projectEditionId'])
        img = images.setdefault((q['imageId'], q['projectEditionId']), {'imageId': q['imageId'], 'acceptedByteHashes': q['accepted'],
                                                                          'width': a['width'], 'height': a['height']})
        if img['acceptedByteHashes'] != q['accepted']:
            raise SystemExit('internal: one image id with two accepted sets')
    if len({k[0] for k in images}) != len(images):
        raise SystemExit('internal: one image id serves two editions')
    tier_order = {'PRIORITY': 0, 'SECONDARY': 1}
    kept.sort(key=lambda q: (tier_order[q['tier']], rank(q['imageId']), rank(q['questionId'])))

    blind_q = []
    for i, q in enumerate(kept, 1):
        a = q['anchor']
        blind_q.append({'order': i, 'questionId': q['questionId'], 'tier': q['tier'], 'imageId': q['imageId'], 'kind': q['kind'],
                        'featureClass': q['featureClass'], 'projectEditionId': q['projectEditionId'],
                        'lineageGroup': a['lineageGroup'], 'correlationGroup': a['lineageGroup'],
                        'anchorByteHash': a['assetByteHash'], 'acceptedByteHashes': q['accepted'],
                        'subAnswer': 'COVER' if q['featureClass'] in COVER_CLASSES else ('ASSEMBLY' if q['featureClass'] == 'UNKNOWN_ASSEMBLY' else None)})
    prereg_sha = sha_file(os.path.join(HERE, 'preregistration.md'))
    inputs = {'corpusManifest': sha_file(os.path.join(EXT, 'corpus-manifest.json')),
              'proposalsB1': sha_file(os.path.join(EXT, 'proposals-B1.json')),
              'addendumE': sha_file(os.path.join(EXT, 'addendum-e-strict.json')),
              'manifest005r': sha_file(M005R)}
    queue = {'schema': 'research.005r-exterior.owner-review-queue.0.1', 'packId': PACK_ID, 'packKind': 'REAL', 'seed': SEED,
             'preregistrationSha256': prereg_sha, 'inputs': inputs, 'vocab': VOCAB,
             'images': sorted((v for v in images.values()), key=lambda v: v['imageId']), 'questions': blind_q}
    queue_sha = hashlib.sha256(canon(queue).encode()).hexdigest()

    # phase-2 cross-check (never loaded before the seal)
    strict_map = {(r['edition'], r['class']): r['strict'] for r in strict}
    edition_feat = {(p['projectEditionId'], p['featureClass']): p for p in b1 if p['scope'] == 'EDITION'}
    xq = []
    for q in kept:
        a, edition = q['anchor'], q['projectEditionId']
        cls_b1 = TO_B1.get(q['featureClass'], q['featureClass']) if q['featureClass'] else None
        ed = man['editions'][edition]
        claims = ed['publisherClaims']
        tech = (ed.get('technical') or {}).get('features', [])
        prod = sorted(({'productionFamily': f['productionFamily'], 'provenance': f['provenance'], 'viewFamilies': f['viewFamilies'],
                        'productionDeniesRecess': f['productionDeniesRecess']} for f in tech if cls_b1 and f['featureClass'] == cls_b1),
                      key=canon)
        ep = edition_feat.get((edition, cls_b1)) if cls_b1 else None
        urls = urls_for(a['assetByteHash'], edition)
        same = sorted(o['questionId'] for o in kept if o['projectEditionId'] == edition and o['questionId'] != q['questionId'])
        page = m5['editions'][edition]['canonicalUrls'][0]
        if not URL_PAGE.match(page):
            raise SystemExit(f'unexpected page URL shape for {edition}')
        sk = ('STRUCTURE_CONFLICT_FRAME' if a['lineageGroup'] in conflict_groups else
              {'EXTERIOR_RENDER': 'EXTERIOR_RENDER_FRAME', 'TECHNICAL_ELEVATION': 'TECHNICAL_ELEVATION_FRAME',
               'INTERIOR_NEGATIVE': 'INTERIOR_FRAME'}[a['purposes'][0]])
        xq.append({
            'questionId': q['questionId'], 'rule': q['rule'], 'b1ProposalId': q['b1ProposalId'], 'sourceKind': sk,
            'publisherChannels': channels_for(a, edition),
            'captionClasses': sorted({x['captionClass'] for x in a['memberships'] if x['editionKey'] == edition}),
            'viewHint': view_hint(sum((urls_for(o['assetByteHash'], edition) for o in by_group[a['lineageGroup']]
                                       if edition in o['editions']), [])) if sk == 'TECHNICAL_ELEVATION_FRAME' else 'NOT_APPLICABLE',
            'viewHintBasis': 'PUBLISHER_FILENAME_TOKEN_OF_LINEAGE_SIBLINGS' if sk == 'TECHNICAL_ELEVATION_FRAME' else None,
            'b1SceneRole': role.get((edition, a['assetByteHash']), 'NO_PROPOSAL'),
            'b1EditionStatus': ep['verificationStatus'] if ep else ('NO_PROPOSAL' if cls_b1 else 'NOT_APPLICABLE'),
            'b1EditionRelation': ep['featureRelation'] if ep else None,
            'strictRecount': strict_map.get((edition, cls_b1)) if cls_b1 else None,
            'publisherCategory': claims['category'].get(cls_b1) if cls_b1 else None,
            'publisherDescriptionKind': claims['descriptionKinds'].get(cls_b1) if cls_b1 else None,
            'publisherCover': sorted(c for c in claims['categoryCover'] + claims['descriptionCover'] if cls_b1 and c.startswith(cls_b1 + ':')),
            'scheduleKinds': ed['technicalSchedule']['scheduleKinds'] if ed.get('technicalSchedule') else {},
            'productionFeatures': prod, 'productionRun': ed.get('technical') is not None,
            'sameEditionQuestionIds': same, 'projectPageUrl': page,
            'pageLocator': {'section': channels_for(a, edition)[0] if channels_for(a, edition) else 'UNKNOWN',
                            'publisherImageNumber': next((re.search(r'__(\d+)\.', u).group(1) for u in urls if re.search(r'__(\d+)\.', u)), None)},
            'pageAccess': (page_access or {}).get(q['questionId'], 'NOT_CHECKED'),
            'acceptedBytesAlsoPublishedBy': sorted({e for h in q['accepted'] for e in assets[h]['editions']} - {edition}),
            'isolationNote': 'OWNER_ANCHOR_EDITION: no anchor, byte or feature of m84f2903cb8e14 (Rarytasy 5 G2E) applies' if edition == OWNER
                             else ('NOT_OWNER_HOUSE: Rarytasy 5 (G2E), a different edition from OWNER m3ea28300f9b3e' if edition == G2E5 else None),
        })
    cross = {'schema': 'research.005r-exterior.owner-review-crosscheck.0.1', 'packId': PACK_ID, 'queueSha256': queue_sha,
             'note': 'phase 2 only: publisher structure and claims are context for adjudication, never authority; metricAuthority is NONE everywhere',
             'questions': xq}
    template = template_of(queue, queue_sha)

    b1_ids = {p['proposalId'] for p in fv}
    covered = {q['b1ProposalId'] for q in kept if q['b1ProposalId']}
    excluded_b1 = {e.get('b1ProposalId') for e in exclusions if e.get('b1ProposalId')}
    lineage = {}
    for q in blind_q:
        lineage.setdefault(q['lineageGroup'], set()).add(q['projectEditionId'])
    coverage = {
        'schema': 'research.005r-exterior.owner-review-coverage.0.1', 'packId': PACK_ID, 'queueSha256': queue_sha,
        'humanTruth': 'NOT_RUN', 'classAccuracy': 'NOT_MEASURED',
        'questions': len(blind_q), 'priority': sum(q['tier'] == 'PRIORITY' for q in blind_q),
        'secondary': sum(q['tier'] == 'SECONDARY' for q in blind_q),
        'byRule': {r: sum(q['rule'] == r for q in kept) for r in ['R1', 'R2', 'R3', 'R4', 'R5']},
        'byKind': {k: sum(q['kind'] == k for q in blind_q) for k in ['FEATURE_VISIBILITY', 'SCENE_SCOPE']},
        'byClass': {c: sum(q['featureClass'] == c for q in blind_q) for c in VOCAB['featureClasses']},
        'byEdition': {e: sum(q['projectEditionId'] == e for q in blind_q) for e in sorted(man['editions'])},
        'bySourceKind': {k: sum(x['sourceKind'] == k for x in xq) for k in sorted({x['sourceKind'] for x in xq})},
        'images': len(images), 'lineageGroups': len(lineage), 'editions': len({q['projectEditionId'] for q in blind_q}),
        'lineageGroupsAnsweredUnderMoreThanOneEdition': sorted(g for g, e in lineage.items() if len(e) > 1),
        'b1FeatureVisibility': {'total': len(b1_ids), 'represented': len(covered & b1_ids), 'excluded': len(excluded_b1 & b1_ids)},
        'publisherClaimedClassQuestions': sum(1 for x in xq if x['publisherCategory'] == 'POSITIVE' or x['publisherDescriptionKind'] == 'POSITIVE'),
    }
    excl = {'schema': 'research.005r-exterior.owner-review-exclusions.0.1', 'packId': PACK_ID,
            'rows': sorted(exclusions, key=canon)}
    return queue, cross, template, coverage, excl


def template_of(queue, queue_sha):
    n = len(queue['questions'])
    return {'schema': 'research.005r-exterior.owner-review-labels.0.1', 'packId': queue['packId'], 'packKind': queue['packKind'],
            'queueSha256': queue_sha, 'phase1Seal': None,
            'counts': {'questions': n, 'UNREVIEWED': n, 'REVIEWED_VISUAL': 0, 'TECHNICALLY_CROSSCHECKED': 0, 'conflicts': 0, 'notBlind': 0},
            'labels': [empty_label(q) for q in queue['questions']]}


def empty_label(q):
    return {'questionId': q['questionId'], 'projectEditionId': q['projectEditionId'], 'lineageGroup': q['lineageGroup'],
            'anchorByteHash': q['anchorByteHash'], 'reviewedByteHash': None, 'kind': q['kind'], 'featureClass': q['featureClass'],
            'status': 'UNREVIEWED', 'metricAuthority': 'NONE', 'reviewerOrigin': None, 'viewingMode': None,
            'phase1': None, 'phase2': None, 'conflict': None}


def js_wrap(name, obj, generator='build_pack.py'):
    return f'/* generated by {generator} — do not edit */\nwindow.{name} = ' + json.dumps(obj, sort_keys=True, ensure_ascii=False, indent=1) + ';\n'


def locator_of(cross):
    return {'schema': 'research.005r-exterior.owner-review-manual-locator.0.1', 'packId': cross['packId'], 'queueSha256': cross['queueSha256'],
            'note': 'manual page fallback only: opening the page shows the publisher filing, so an answer given this way is recorded as not blind',
            'questions': [{'questionId': x['questionId'], 'projectPageUrl': x['projectPageUrl'], 'section': x['pageLocator']['section'],
                           'publisherImageNumber': x['pageLocator']['publisherImageNumber']} for x in cross['questions']]}


def pack_files(queue, cross, template, generator='build_pack.py'):
    qsha = hashlib.sha256(canon(queue).encode()).hexdigest()
    loc = locator_of(cross)
    return {
        'queue.json': canon(queue),
        'queue.js': js_wrap('OWNER_REVIEW_QUEUE', queue, generator) + f"window.OWNER_REVIEW_QUEUE_SHA256 = '{qsha}';\n",
        'crosscheck.json': canon(cross), 'crosscheck.js': js_wrap('OWNER_REVIEW_CROSSCHECK', cross, generator),
        'manual-locator.json': canon(loc), 'manual-locator.js': js_wrap('OWNER_REVIEW_LOCATOR', loc, generator),
        'labels-template-EMPTY.json': canon(template),
    }


def outputs(page_access=None, order_seed=None):
    queue, cross, template, coverage, excl = build(order_seed, page_access)
    out = {f'pack/{k}': v for k, v in pack_files(queue, cross, template).items()}
    out.update({'results/coverage.json': canon(coverage), 'results/exclusions.json': canon(excl)})
    return out


def main(argv):
    pa_p = os.path.join(HERE, 'results', 'page-access.json')
    page_access = {r['questionId']: r['access'] for r in json.load(open(pa_p))['rows']} if os.path.exists(pa_p) else None
    out = outputs(page_access)
    if '--check' in argv:
        bad = [k for k, v in out.items() if not os.path.exists(os.path.join(HERE, k)) or open(os.path.join(HERE, k), encoding='utf-8').read() != v]
        if bad:
            sys.exit('PACK DIFFERS: ' + ', '.join(bad))
        print('OK: pack reproducible,', len(out), 'files')
        return
    for k, v in out.items():
        p = os.path.join(HERE, k)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(v)
    print(json.dumps(json.loads(out['results/coverage.json']), indent=1))


if __name__ == '__main__':
    main(sys.argv[1:])
