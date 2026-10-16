#!/usr/bin/env python3
"""
contenders.py — 005R-EXTERIOR contenders B0 and B1 (RESEARCH ONLY; never imported by production).

    python3 -I contenders.py <corpus-manifest.json> <B0|B1> <out.json>

Both read ONLY the committed, hashed corpus manifest (ledger.py): page-structure channel names, caption classes,
publisher claim kind sets, plan-schedule kinds and the sealed production technical features with their frame byte
hashes. Neither decodes a pixel. The V1 pixel router reading of 005R is carried as a NON-AUTHORITATIVE channel only:
it never decides (005R A1: it reads the image format, not the content).

B0 — production as it is: scene role from the adapter's own frame roles (document / projection / view of the sealed
     N1v run), and features from the production technical features alone (production lineage = status). The adapter
     has no interior class, so a perspective frame's scope is unknown to it.
B1 — deterministic evidence router: B0 + the publisher's page structure (hero gallery / elevations tab / interiors
     carousel, with the carousel caption CLASS) for scene scope, + product categories and description keywords as
     weak claims, + the plan room schedule and technical parameters as printed technical facts, fused by the rules
     below (preregistration §4). Abstention is the default; every promotion names its anchors.
"""
import json
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import FEATURE_CLASSES, SCHEMA, canon, dump, h, refuse_inside_repo

STRONG = {'SOURCE_EXACT', 'SOURCE_CORROBORATED', 'SOURCE_DERIVED'}
VISUAL = {'IMAGE_METRIC_REGISTERED', 'VISUAL_INFERRED', 'VISUAL_SEMANTIC'}
VIEW_FROM_URL = [(r'elewacja-frontowa', 'FRONT'), (r'elewacja-ogrodowa', 'REAR'), (r'elewacja-tylna', 'REAR'), (r'elewacja-boczna', 'SIDE_UNSPECIFIED')]
UNKNOWN_ALTS = {'RECESS': ['LOGGIA', 'ENTRANCE_CANOPY', 'TERRACE'], 'ATTACHED_ROOF': ['GARAGE_ENCLOSED', 'TERRACE', 'ENTRANCE_CANOPY', 'CARPORT']}


def proposal(**kw):
    base = {'schemaVersion': SCHEMA, 'pixelRegion': None, 'featureRelation': None, 'featureRelationBasis': 'NONE',
            'alternatives': [], 'refusalReason': None, 'metricAuthority': 'NONE', 'assetByteHash': None, 'frameId': None,
            'featureClass': None}
    base.update(kw)
    base['sourceEvidence'] = sorted(base['sourceEvidence'], key=canon)  # evidence is a set: its order is not information
    base['proposalId'] = 'p-' + h(canon({k: v for k, v in base.items() if k != 'proposalId'}))[:16]
    return base


def channels(structure='NONE', pixel='NOT_ATTEMPTED', tech='NOT_APPLICABLE'):
    return {'publisherStructureClaim': structure, 'pixelInterpretation': pixel, 'orthographicTechnicalConfirmation': tech, 'reviewerAdjudication': 'NOT_RUN'}


def anchor(kind, ed, ref, cls=None, projection='NONE', byte_hashes=(), group='edition', provenance=None, polarity='POSITIVE'):
    return {'anchorKind': kind, 'editionKey': ed, 'ref': ref, 'featureClass': cls, 'projection': projection,
            'byteHashes': sorted(byte_hashes), 'correlationGroup': group, 'provenance': provenance, 'polarity': polarity}


def tech_anchor(ed, f):
    proj = 'ORTHOGRAPHIC_ELEVATION' if 'ELEVATION' in f['viewFamilies'] else 'ORTHOGRAPHIC_PLAN' if 'PLAN' in f['viewFamilies'] else 'ORTHOGRAPHIC_SECTION' if 'SECTION' in f['viewFamilies'] else 'NONE'
    return anchor('PRODUCTION_TECHNICAL_FEATURE', ed, f"production:{f['productionFamily']}:{f['anchorId']}", f['featureClass'], proj,
                  [x['byteHash'] for x in f['frames']], 'production:' + f['anchorId'], f['provenance'])


def usable(f):
    """A production feature counts as technical evidence only when production itself stands behind it."""
    if f['provenance'] == 'ASSUMED_FOR_RENDERING' or f['productionDeniesRecess']:
        return None
    if f['provenance'] in STRONG:
        return 'STRONG'
    if f['provenance'] in VISUAL:
        return 'VISUAL'
    return None


def view_of(asset, ed, urls):
    pf = asset['productionFrames'].get(ed)
    if pf and pf['view'] not in ('NOT_APPLICABLE',):
        return pf['view']
    for u in urls.get(asset['assetByteHash'], []):
        for rx, v in VIEW_FROM_URL:
            if re.search(rx, u):
                return v
    return 'UNKNOWN'


def b0_scene(asset, ed):
    pf = asset['productionFrames'].get(ed)
    if not pf:
        return 'OTHER_UNKNOWN', 'UNKNOWN', 'production never received these bytes for this edition', ['TECHNICAL_ELEVATION', 'EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE']
    if pf['document'] == 'ELEVATION' and pf['projection'] == 'ORTHOGRAPHIC_ELEVATION':
        return 'TECHNICAL_ELEVATION', 'ORTHOGRAPHIC_ELEVATION', None, []
    if pf['projection'] == 'PERSPECTIVE':
        return 'OTHER_UNKNOWN', 'PERSPECTIVE', 'the adapter has no interior/exterior class for a perspective render', ['EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE']
    return 'OTHER_UNKNOWN', 'UNKNOWN', f"production role {pf['document']} is not an exterior evidence role", []


def b1_scene(asset, ed, group_channels):
    """Scene scope from page structure. Any disagreement between structural channels inside the lineage group abstains."""
    own = {(m['channel'], m['captionClass']) for m in asset['memberships'] if m['editionKey'] == ed}
    grp = group_channels[asset['lineageGroup']]
    hero = any(c == 'PAGE:fancybox3ProdBigImg0' for c, _ in grp)
    elev = any(c == 'PAGE:elevations-tab' for c, _ in grp)
    inter = {k for c, k in grp if c == 'CAROUSEL:fancybox3Interiors'}
    pf = asset['productionFrames'].get(ed)
    alts = ['TECHNICAL_ELEVATION', 'EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE']
    if sum([hero, elev, bool(inter)]) > 1 or 'EXTERIOR_NAMED' in inter:
        return 'OTHER_UNKNOWN', 'UNKNOWN', 'STRUCTURE_CONFLICT', 'structural channels of this lineage group disagree (gallery / tab / interiors carousel / caption class)', alts
    if any(c == 'PAGE:elevations-tab' for c, _ in own):
        if pf and pf['projection'] != 'ORTHOGRAPHIC_ELEVATION':
            return 'OTHER_UNKNOWN', 'UNKNOWN', 'STRUCTURE_CONFLICT', 'the elevations tab and the adapter projection disagree', alts
        return 'TECHNICAL_ELEVATION', 'ORTHOGRAPHIC_ELEVATION', 'ELEVATIONS_TAB', None, []
    if any(c == 'PAGE:fancybox3ProdBigImg0' for c, _ in own):
        return 'EXTERIOR_PERSPECTIVE', 'PERSPECTIVE', 'HERO_GALLERY', None, []
    if any(c == 'CAROUSEL:fancybox3Interiors' for c, _ in own):
        k = 'INTERIOR_ZONE' if inter == {'INTERIOR_ZONE'} else 'GENERIC'
        return 'INTERIOR_PERSPECTIVE', 'PERSPECTIVE', f'INTERIORS_CAROUSEL_{k}', None, []
    return 'OTHER_UNKNOWN', 'UNKNOWN', 'OTHER_CHANNEL', 'no structural channel names this scene', alts


def pixel_channel(asset, role):
    v = asset.get('v1PixelRole')
    if not v or role in ('OTHER_UNKNOWN',):
        return 'NOT_ATTEMPTED'
    if not v['resolved']:
        return 'V1_ABSTAIN'
    want = {'TECHNICAL_ELEVATION': 'TECHNICAL_ELEVATION', 'EXTERIOR_PERSPECTIVE': 'EXTERIOR_RENDER', 'INTERIOR_PERSPECTIVE': 'INTERIOR_RENDER'}[role]
    return 'V1_NON_AUTHORITATIVE_AGREES' if v['role'] == want else 'V1_NON_AUTHORITATIVE_DISAGREES'


def edition_features(ed, e, variant):
    """Edition-scope fusion, one proposal per feature class that any channel speaks about."""
    out = []
    tech = (e['technical'] or {}).get('features', [])
    claims = e['publisherClaims']
    sched = e['technicalSchedule']
    for cls in FEATURE_CLASSES:
        anchors = []
        if variant == 'B1':
            for chan, key, kind in [('category', 'category', 'PUBLISHER_CATEGORY'), ('description', 'descriptionKinds', 'PUBLISHER_DESCRIPTION')]:
                pol = claims[key].get(cls)
                if pol:
                    anchors.append(anchor(kind, ed, f'{chan}:{cls}', cls, polarity='POSITIVE' if pol == 'POSITIVE' else 'NEGATIVE' if pol == 'NEGATIVE' else 'NEUTRAL', group='publisher:' + ed))
            n = sched['scheduleKinds'].get(cls, 0)
            if n:
                anchors.append(anchor('TECHNICAL_SCHEDULE', ed, f'schedule:{cls}:{n}', cls, 'ORTHOGRAPHIC_PLAN', group='schedule:' + ed, provenance='PRINTED_SCHEDULE'))
            if cls == 'GARAGE_ENCLOSED':
                for key in ('garageAreaPrinted', 'garageDoorSpecified'):
                    if sched['params'][key]:
                        anchors.append(anchor('TECHNICAL_PARAM', ed, f'param:{key}', cls, group='schedule:' + ed, provenance='PRINTED_SCHEDULE'))
                if sched['roomsListed'] and not n and not sched['params']['garageAreaPrinted']:
                    anchors.append(anchor('TECHNICAL_SCHEDULE', ed, f"schedule:no-garage-among-{sched['roomsListed']}", cls, 'ORTHOGRAPHIC_PLAN', group='schedule:' + ed, provenance='PRINTED_SCHEDULE', polarity='NEGATIVE'))
        feats = [f for f in tech if f['featureClass'] == cls and cls != 'UNKNOWN_ASSEMBLY']
        strong = [f for f in feats if usable(f) == 'STRONG']
        visual = [f for f in feats if usable(f) == 'VISUAL']
        anchors += [tech_anchor(ed, f) for f in strong + visual]
        if not anchors:
            continue
        pos_pub = any(a['anchorKind'].startswith('PUBLISHER') and a['polarity'] == 'POSITIVE' for a in anchors)
        neg_pub = any(a['anchorKind'].startswith('PUBLISHER') and a['polarity'] == 'NEGATIVE' for a in anchors)
        con_pub = any(a['anchorKind'].startswith('PUBLISHER') and a['polarity'] == 'NEUTRAL' for a in anchors)
        pos_tech = any(a['anchorKind'] in ('TECHNICAL_SCHEDULE', 'TECHNICAL_PARAM') and a['polarity'] == 'POSITIVE' for a in anchors) or bool(strong)
        neg_tech = any(a['anchorKind'] == 'TECHNICAL_SCHEDULE' and a['polarity'] == 'NEGATIVE' for a in anchors)
        abstain, reason, tch = False, None, 'NONE'
        if (pos_pub and neg_pub) or con_pub or (neg_pub and pos_tech) or (pos_pub and neg_tech):
            status, abstain, reason = 'CONFLICT', True, 'publisher and technical channels disagree about presence'
        elif pos_tech and pos_pub:
            status, tch = 'TECHNICALLY_CORROBORATED', 'CONFIRMED'
        elif pos_tech:
            status, tch = 'TECHNICAL_ONLY', 'CONFIRMED'
        elif visual:
            status, tch = 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED', 'VISUAL_TONE_ONLY'
        elif neg_pub and neg_tech:
            status, tch = 'TECHNICAL_NEGATIVE_CORROBORATED', 'NONE'
        elif neg_pub:
            status = 'PUBLISHER_NEGATIVE'
        elif pos_pub:
            status = 'PUBLISHER_CLAIM_ONLY'
        else:
            status, abstain, reason = 'UNRESOLVED', True, 'no channel states presence'
        rel, basis = None, 'NONE'
        if variant == 'B1':
            covers = {c.split(':')[1] for c in claims['categoryCover'] + claims['descriptionCover'] if c.split(':')[0] == cls}
            if cls == 'PERGOLA' and pos_pub:
                covers.add('OPEN_COVER')
            if cls == 'GARAGE_ENCLOSED' and pos_tech:
                rel, basis = 'SOLID_COVER', 'TECHNICAL'  # an enclosed room in the plan schedule, with a printed area
            elif len(covers) == 1 and not abstain:
                rel, basis = covers.pop(), 'PUBLISHER_CLAIM'
            elif covers:
                rel = 'UNKNOWN'
        presence = status in ('TECHNICALLY_CORROBORATED', 'TECHNICAL_ONLY', 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED', 'PUBLISHER_CLAIM_ONLY')
        if variant == 'B0' and not pos_tech and not visual:
            continue
        conf = None if abstain else {'TECHNICALLY_CORROBORATED': 0.8, 'TECHNICAL_ONLY': 0.6, 'TECHNICAL_NEGATIVE_CORROBORATED': 0.7,
                                     'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED': 0.3, 'PUBLISHER_CLAIM_ONLY': 0.3, 'PUBLISHER_NEGATIVE': 0.3}[status]
        out.append(proposal(scope='EDITION', projectEditionId=ed, role='NOT_APPLICABLE', projection='NOT_APPLICABLE', viewSide='NOT_APPLICABLE',
                            sourceKind='EDITION_FUSION', proposalKind='FEATURE', featureClass=cls, featureRelation=rel, featureRelationBasis=basis,
                            confidenceOrAbstain={'abstain': True} if abstain else {'confidence': conf}, sourceEvidence=anchors,
                            correlationGroup='edition:' + ed,
                            metricAuthority='NONE',  # addendum E: a printed label without its value carries no metric authority
                            verificationStatus=status, refusalReason=reason,
                            alternatives=[] if presence or abstain else ['PRESENT_BUT_UNCLAIMED'],
                            channels=channels('CLAIM_POSITIVE' if pos_pub and not neg_pub else 'CLAIM_NEGATIVE' if neg_pub and not pos_pub else 'CLAIM_CONFLICT' if pos_pub or neg_pub or con_pub else 'NONE',
                                              'NOT_ATTEMPTED', tch)))
    # production features production itself could not name: one UNKNOWN_ASSEMBLY each, with the alternatives
    for f in tech:
        if f['featureClass'] != 'UNKNOWN_ASSEMBLY':
            continue
        if usable(f) != 'STRONG':
            continue
        a = tech_anchor(ed, f)
        out.append(proposal(scope='EDITION', projectEditionId=ed, role='NOT_APPLICABLE', projection='NOT_APPLICABLE', viewSide='NOT_APPLICABLE',
                            sourceKind='EDITION_FUSION', proposalKind='FEATURE', featureClass='UNKNOWN_ASSEMBLY',
                            featureRelation='SOLID_COVER' if f['relation'] == 'SOLID_COVER' else None,
                            featureRelationBasis='TECHNICAL' if f['relation'] == 'SOLID_COVER' else 'NONE',
                            confidenceOrAbstain={'confidence': 0.6}, sourceEvidence=[a], correlationGroup='edition:' + ed,
                            metricAuthority='SOURCE_DERIVED', verificationStatus='TECHNICAL_ONLY', refusalReason=None,
                            alternatives=UNKNOWN_ALTS[f['productionFamily']], channels=channels('NONE', 'NOT_ATTEMPTED', 'CONFIRMED')))
    return out


def run(manifest, variant, urls):
    props = []
    group_channels = {}
    for a in manifest['assets'] + manifest.get('extendedNegatives', []):
        group_channels.setdefault(a['lineageGroup'], set()).update((m['channel'], m['captionClass']) for m in a['memberships'])
    edition_props = {}
    for ed in sorted(manifest['editions']):
        edition_props[ed] = edition_features(ed, manifest['editions'][ed], variant)
        props += edition_props[ed]
    seen = set()
    for a in sorted(manifest['assets'], key=lambda x: x['assetByteHash']):
        if a['assetByteHash'] in seen:  # the same bytes listed twice are one frame
            continue
        seen.add(a['assetByteHash'])
        for ed in sorted(set(a['selectedFor'])):
            if ed not in a['editions']:
                continue
            pf = a['productionFrames'].get(ed)
            frame_id = pf['frameId'] if pf else 'asset:' + a['assetByteHash'][:16]
            if variant == 'B0':
                role, proj, reason, alts = b0_scene(a, ed)
                struct, status = 'NONE', 'ROLE_FROM_PRODUCTION'
            else:
                role, proj, struct, reason, alts = b1_scene(a, ed, group_channels)
                status = 'ROLE_FROM_STRUCTURE'
            abstain = role == 'OTHER_UNKNOWN'
            view = view_of(a, ed, urls) if role == 'TECHNICAL_ELEVATION' else 'NOT_APPLICABLE' if role in ('EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE') else 'UNKNOWN'
            sk = 'TECHNICAL_ELEVATION_FRAME' if role == 'TECHNICAL_ELEVATION' else 'PERSPECTIVE_FRAME' if proj == 'PERSPECTIVE' else 'UNKNOWN_FRAME'
            anchors = []
            if pf:
                anchors.append(anchor('PRODUCTION_FRAME_ROLE', ed, f"frame:{pf['frameId']}:{pf['document']}", None,
                                      pf['projection'] if pf['projection'] in ('ORTHOGRAPHIC_ELEVATION', 'ORTHOGRAPHIC_PLAN', 'ORTHOGRAPHIC_SECTION', 'PERSPECTIVE') else 'NONE',
                                      [a['assetByteHash']], a['lineageGroup'], None, 'NEUTRAL'))
            if variant == 'B1':
                for m in a['memberships']:
                    if m['editionKey'] == ed:
                        anchors.append(anchor('PUBLISHER_STRUCTURE', ed, f"structure:{m['channel']}:{m['captionClass']}", None, 'NONE', [a['assetByteHash']], a['lineageGroup'], None, 'NEUTRAL'))
            pix = pixel_channel(a, role) if variant == 'B1' else 'NOT_ATTEMPTED'
            if variant == 'B1' and pix != 'NOT_ATTEMPTED':
                anchors.append(anchor('PIXEL_ROUTER_V1', ed, f"v1:{a['v1PixelRole']['role']}", None, 'NONE', [a['assetByteHash']], a['lineageGroup'], None, 'NEUTRAL'))
            base = dict(scope='FRAME', projectEditionId=ed, assetByteHash=a['assetByteHash'], frameId=frame_id, role=role, projection=proj,
                        viewSide=view, sourceKind=sk, correlationGroup=a['lineageGroup'])
            props.append(proposal(**base, proposalKind='SCENE_ROLE', confidenceOrAbstain={'abstain': True} if abstain else {'confidence': 0.7},
                                  sourceEvidence=anchors, verificationStatus='UNRESOLVED' if abstain else status,
                                  refusalReason=reason if abstain else None, alternatives=alts,
                                  channels=channels(struct if variant == 'B1' else 'NONE', pix, 'NOT_APPLICABLE')))
            if role == 'TECHNICAL_ELEVATION':
                # features production sighted on THIS frame (bound by byte hash), with the edition fusion's status
                fused = {p['featureClass']: p for p in edition_props[ed]}
                for f in (manifest['editions'][ed]['technical'] or {}).get('features', []):
                    if a['assetByteHash'] not in {x['byteHash'] for x in f['frames']} or not usable(f):
                        continue
                    fp = fused.get(f['featureClass']) if f['featureClass'] != 'UNKNOWN_ASSEMBLY' else None
                    st = fp['verificationStatus'] if fp and fp['verificationStatus'] in ('TECHNICALLY_CORROBORATED', 'TECHNICAL_ONLY', 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED') else ('TECHNICAL_ONLY' if usable(f) == 'STRONG' else 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED')
                    anch = [tech_anchor(ed, f)] + ([x for x in fp['sourceEvidence'] if x['anchorKind'].startswith('PUBLISHER')] if fp and st == 'TECHNICALLY_CORROBORATED' else [])
                    props.append(proposal(**base, proposalKind='FEATURE', featureClass=f['featureClass'],
                                          featureRelation='SOLID_COVER' if f['relation'] == 'SOLID_COVER' else None,
                                          featureRelationBasis='TECHNICAL' if f['relation'] == 'SOLID_COVER' else 'NONE',
                                          confidenceOrAbstain={'confidence': 0.6 if usable(f) == 'STRONG' else 0.3}, sourceEvidence=anch,
                                          metricAuthority='SOURCE_DERIVED' if usable(f) == 'STRONG' else 'NONE', verificationStatus=st,
                                          refusalReason=None, alternatives=UNKNOWN_ALTS.get(f['productionFamily'], []),
                                          channels=channels(struct if variant == 'B1' else 'NONE', 'NOT_ATTEMPTED', 'CONFIRMED' if usable(f) == 'STRONG' else 'VISUAL_TONE_ONLY')))
            elif role == 'EXTERIOR_PERSPECTIVE':
                # the edition's features MAY be visible here; no reader qualifies to say whether they are
                for p in edition_props[ed]:
                    if p['verificationStatus'] in ('TECHNICALLY_CORROBORATED', 'TECHNICAL_ONLY', 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED', 'PUBLISHER_CLAIM_ONLY') and p['featureClass'] != 'UNKNOWN_ASSEMBLY':
                        props.append(proposal(**base, proposalKind='FEATURE_VISIBILITY', featureClass=p['featureClass'],
                                              confidenceOrAbstain={'abstain': True}, sourceEvidence=[x for x in anchors if x['anchorKind'] == 'PUBLISHER_STRUCTURE'],
                                              verificationStatus='UNRESOLVED', refusalReason='FRAME_VISIBILITY_NOT_MEASURABLE: no pixel reader qualifies (005R V1/V2 negative baselines) and no reviewer adjudication ran',
                                              alternatives=['VISIBLE_IN_FRAME', 'NOT_VISIBLE_IN_FRAME'],
                                              channels=channels(struct, 'NOT_ATTEMPTED', 'NOT_APPLICABLE')))
    props.sort(key=lambda p: p['proposalId'])
    return {'schemaVersion': SCHEMA, 'variant': variant, 'proposals': props}


def urls_from_005r(repo):
    m = json.load(open(os.path.join(repo, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')))
    return {a['variantSha256']: sorted({x['url'] for x in a['memberships']}) for a in m['assets']}


def shuffled(manifest, seed):
    """Stability control: the same manifest with every list order permuted."""
    m = json.loads(json.dumps(manifest))
    r = random.Random(seed)
    r.shuffle(m['assets'])
    for a in m['assets']:
        r.shuffle(a['memberships'])
        r.shuffle(a['selectedFor'])
    for e in m['editions'].values():
        if e['technical']:
            r.shuffle(e['technical']['features'])
            r.shuffle(e['technical']['frames'])
    m['editions'] = dict(sorted(m['editions'].items(), key=lambda kv: r.random()))
    return m


if __name__ == '__main__':
    if len(sys.argv) != 4 or sys.argv[2] not in ('B0', 'B1'):
        raise SystemExit(__doc__)
    refuse_inside_repo(sys.argv[3])
    repo = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
    doc = run(json.load(open(sys.argv[1])), sys.argv[2], urls_from_005r(repo))
    dump(doc, sys.argv[3])
    print(sys.argv[2], len(doc['proposals']), 'proposals', h(canon(doc))[:16])
