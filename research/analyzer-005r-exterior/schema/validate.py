#!/usr/bin/env python3
"""
validate.py — the 005R-EXTERIOR research JSON contract `research.exterior-proposals.0.1` (RESEARCH ONLY; this is not
a shipping schema and is never imported by production; `packages/architecture/src/proposals.ts` is untouched).

    python3 -I validate.py <proposal-set.json> <corpus-manifest.json>

A proposal set is a list of proposals. A proposal is evidence about ONE project edition, either about one frame
(`scope: FRAME`, keyed by the asset's byte hash) or about the edition as a whole (`scope: EDITION`). It carries four
SEPARATE channels — publisher structure claim, pixel interpretation, orthographic technical confirmation and
reviewer adjudication — that are never interchangeable, and its verification status must be derivable from the
anchors it lists. Invalid proposals are refused by index, never repaired. Key sets are closed at every level, so
world-space metres, captions or any unlisted field cannot ride along.
"""
import json
import re
import sys

SCHEMA = 'research.exterior-proposals.0.1'
FEATURES = {'TERRACE', 'BALCONY', 'RAILING', 'PERGOLA', 'CARPORT', 'GARAGE_ENCLOSED', 'ENTRANCE_CANOPY',
            'COLUMNS_SUPPORTS', 'LOGGIA', 'LARGE_GLAZING', 'UNKNOWN_ASSEMBLY'}
ROLES = {'TECHNICAL_ELEVATION', 'EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE', 'OTHER_UNKNOWN', 'NOT_APPLICABLE'}
PROJECTIONS = {'ORTHOGRAPHIC_ELEVATION', 'PERSPECTIVE', 'UNKNOWN', 'NOT_APPLICABLE'}
VIEWS = {'FRONT', 'REAR', 'SIDE_UNSPECIFIED', 'SIDE_LEFT', 'SIDE_RIGHT', 'UNKNOWN', 'NOT_APPLICABLE'}
SOURCE_KINDS = {'TECHNICAL_ELEVATION_FRAME', 'PERSPECTIVE_FRAME', 'UNKNOWN_FRAME', 'EDITION_FUSION'}
PROPOSAL_KINDS = {'SCENE_ROLE', 'FEATURE', 'FEATURE_VISIBILITY'}
RELATIONS = {'OPEN_COVER', 'SOLID_COVER', 'NONE', 'UNKNOWN'}
RELATION_BASIS = {'PUBLISHER_CLAIM', 'TECHNICAL', 'NONE'}
METRIC = {'SOURCE_EXACT', 'SOURCE_DERIVED', 'NONE'}
STATUSES = {'TECHNICALLY_CORROBORATED', 'TECHNICAL_ONLY', 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED', 'PUBLISHER_CLAIM_ONLY',
            'PUBLISHER_NEGATIVE', 'TECHNICAL_NEGATIVE_CORROBORATED', 'CONFLICT', 'UNRESOLVED', 'ROLE_FROM_STRUCTURE',
            'ROLE_FROM_PRODUCTION'}
ANCHOR_KINDS = {'PUBLISHER_CATEGORY', 'PUBLISHER_DESCRIPTION', 'PUBLISHER_STRUCTURE', 'TECHNICAL_SCHEDULE', 'TECHNICAL_PARAM',
                'PRODUCTION_TECHNICAL_FEATURE', 'PRODUCTION_FRAME_ROLE', 'PIXEL_ROUTER_V1'}
TECHNICAL_ANCHORS = {'TECHNICAL_SCHEDULE', 'TECHNICAL_PARAM', 'PRODUCTION_TECHNICAL_FEATURE'}
PUBLISHER_ANCHORS = {'PUBLISHER_CATEGORY', 'PUBLISHER_DESCRIPTION', 'PUBLISHER_STRUCTURE'}
CLAIM_ANCHORS = {'PUBLISHER_CATEGORY', 'PUBLISHER_DESCRIPTION'}  # gallery membership is a scene claim, never a feature claim
STRONG_PROVENANCE = {'SOURCE_EXACT', 'SOURCE_CORROBORATED', 'SOURCE_DERIVED', 'PRINTED_SCHEDULE'}
VISUAL_PROVENANCE = {'IMAGE_METRIC_REGISTERED', 'VISUAL_INFERRED', 'VISUAL_SEMANTIC'}
CH_STRUCTURE = {'HERO_GALLERY', 'ELEVATIONS_TAB', 'INTERIORS_CAROUSEL_INTERIOR_ZONE', 'INTERIORS_CAROUSEL_GENERIC',
                'INTERIORS_CAROUSEL_EXTERIOR_NAMED', 'STRUCTURE_CONFLICT', 'OTHER_CHANNEL', 'CLAIM_POSITIVE',
                'CLAIM_NEGATIVE', 'CLAIM_CONFLICT', 'NONE'}
CH_PIXEL = {'NOT_ATTEMPTED', 'V1_NON_AUTHORITATIVE_AGREES', 'V1_NON_AUTHORITATIVE_DISAGREES', 'V1_ABSTAIN'}
CH_TECH = {'CONFIRMED', 'VISUAL_TONE_ONLY', 'DENIED_BY_PRODUCTION', 'NONE', 'NOT_APPLICABLE'}
CH_REVIEW = {'NOT_RUN'}

TOP_KEYS = {'schemaVersion', 'variant', 'proposals'}
KEYS = {'schemaVersion', 'proposalId', 'scope', 'projectEditionId', 'assetByteHash', 'frameId', 'role', 'projection',
        'viewSide', 'sourceKind', 'proposalKind', 'featureClass', 'pixelRegion', 'featureRelation', 'featureRelationBasis',
        'confidenceOrAbstain', 'sourceEvidence', 'correlationGroup', 'metricAuthority', 'verificationStatus',
        'refusalReason', 'alternatives', 'channels'}
ANCHOR_KEYS = {'anchorKind', 'editionKey', 'ref', 'featureClass', 'projection', 'byteHashes', 'correlationGroup',
               'provenance', 'polarity'}
CHANNEL_KEYS = {'publisherStructureClaim', 'pixelInterpretation', 'orthographicTechnicalConfirmation', 'reviewerAdjudication'}
HEX64 = re.compile(r'^[0-9a-f]{64}$')


def check(p, i, ctx):
    e = []

    def bad(code, msg):
        e.append(f'[{i}] {code}: {msg}')

    if not isinstance(p, dict):
        return [f'[{i}] SHAPE: not an object']
    if set(p) != KEYS:
        bad('KEYS', f'unknown {sorted(set(p) - KEYS)} missing {sorted(KEYS - set(p))}')
        return e
    if p['schemaVersion'] != SCHEMA:
        bad('SCHEMA', p['schemaVersion'])
    for k, allowed in [('role', ROLES), ('projection', PROJECTIONS), ('viewSide', VIEWS), ('sourceKind', SOURCE_KINDS),
                       ('proposalKind', PROPOSAL_KINDS), ('metricAuthority', METRIC), ('verificationStatus', STATUSES)]:
        if p[k] not in allowed:
            bad('ENUM', f'{k}={p[k]!r}')
    if p['scope'] not in ('FRAME', 'EDITION'):
        bad('ENUM', f"scope={p['scope']!r}")
    if p['featureClass'] is not None and p['featureClass'] not in FEATURES:
        bad('ENUM', f"featureClass={p['featureClass']!r}")
    if (p['proposalKind'] == 'SCENE_ROLE') != (p['featureClass'] is None):
        bad('KIND', 'a scene-role proposal has no feature class, and every feature proposal has one')
    if p['featureRelation'] is not None and p['featureRelation'] not in RELATIONS:
        bad('ENUM', f"featureRelation={p['featureRelation']!r}")
    if p['featureRelationBasis'] not in RELATION_BASIS:
        bad('ENUM', f"featureRelationBasis={p['featureRelationBasis']!r}")
    if (p['featureRelation'] in (None, 'UNKNOWN')) != (p['featureRelationBasis'] == 'NONE'):
        bad('RELATION_BASIS', 'a stated cover relation names its basis, and an unknown one names none')
    if not isinstance(p['alternatives'], list) or not all(isinstance(a, str) and a for a in p['alternatives']):
        bad('SHAPE', 'alternatives')
    if not isinstance(p['correlationGroup'], str) or not p['correlationGroup']:
        bad('CORRELATION', 'every proposal names its correlation group')
    ch = p['channels']
    if not isinstance(ch, dict) or set(ch) != CHANNEL_KEYS:
        bad('KEYS', 'channels')
        return e
    for k, allowed in [('publisherStructureClaim', CH_STRUCTURE), ('pixelInterpretation', CH_PIXEL),
                       ('orthographicTechnicalConfirmation', CH_TECH), ('reviewerAdjudication', CH_REVIEW)]:
        if ch[k] not in allowed:
            bad('CHANNEL', f'{k}={ch[k]!r}')
    # confidence or abstention, never both and never neither
    ca = p['confidenceOrAbstain']
    abstain = False
    if ca == {'abstain': True}:
        abstain = True
    elif isinstance(ca, dict) and set(ca) == {'confidence'} and isinstance(ca['confidence'], (int, float)) and not isinstance(ca['confidence'], bool) and 0 <= ca['confidence'] <= 1:
        pass
    else:
        bad('CONFIDENCE', f'{ca!r}')
    if abstain != bool(p['refusalReason']):
        bad('ABSTENTION', 'an abstention names its refusal reason, and only an abstention has one')
    if abstain and p['verificationStatus'] not in ('UNRESOLVED', 'CONFLICT'):
        bad('ABSTENTION', 'an abstention is UNRESOLVED or CONFLICT')
    if not abstain and p['verificationStatus'] in ('UNRESOLVED', 'CONFLICT'):
        bad('ABSTENTION', 'an UNRESOLVED or CONFLICT proposal abstains')
    # anchors
    anchors = p['sourceEvidence']
    if not isinstance(anchors, list):
        bad('SHAPE', 'sourceEvidence')
        return e
    for j, a in enumerate(anchors):
        if not isinstance(a, dict) or set(a) != ANCHOR_KEYS:
            bad('KEYS', f'anchor {j}')
            return e
        if a['anchorKind'] not in ANCHOR_KINDS:
            bad('ENUM', f"anchor {j} kind {a['anchorKind']!r}")
        if a['editionKey'] != p['projectEditionId']:
            bad('EDITION_MIX', f"anchor {j} is evidence of {a['editionKey']}, not {p['projectEditionId']}")
        if a['polarity'] not in ('POSITIVE', 'NEGATIVE', 'NEUTRAL'):
            bad('ENUM', f'anchor {j} polarity')
        if a['projection'] not in ('ORTHOGRAPHIC_ELEVATION', 'ORTHOGRAPHIC_PLAN', 'ORTHOGRAPHIC_SECTION', 'PERSPECTIVE', 'NONE'):
            bad('ENUM', f'anchor {j} projection')
        if not isinstance(a['byteHashes'], list) or not all(isinstance(x, str) and HEX64.match(x) for x in a['byteHashes']):
            bad('SHAPE', f'anchor {j} byteHashes')
        own = ctx['editionBytes'].get(a['editionKey'], set())
        for x in a['byteHashes']:
            m = ctx['assets'].get(x)
            if (m is not None and a['editionKey'] not in m['editions']) or (m is None and x not in own):
                bad('EDITION_MIX', f'anchor {j} cites bytes that edition {a["editionKey"]} never published')
        if 'editions' in ctx:
            ok, why = anchor_is_genuine(a, ctx)
            if not ok:
                bad('FORGED_ANCHOR', f'anchor {j}: {why}')
        if a['anchorKind'] == 'PRODUCTION_TECHNICAL_FEATURE' and a['ref'].split(':')[-1] not in ctx['editionFeatures'].get(a['editionKey'], set()):
            bad('EDITION_MIX', f'anchor {j} names a production feature that edition {a["editionKey"]}\'s own run never solved')
    # frame scope: the asset must exist, belong to the edition, and carry its lineage group
    if p['scope'] == 'FRAME':
        m = ctx['assets'].get(p['assetByteHash'])
        if m is None:
            bad('ASSET', 'a frame proposal names an asset of the manifest')
        else:
            if p['projectEditionId'] not in m['editions']:
                bad('ASSET_NOT_IN_EDITION', f"{p['projectEditionId']} never published these bytes")
            if p['correlationGroup'] != m['lineageGroup']:
                bad('CORRELATION', 'a frame proposal carries its lineage group as its correlation group')
        if p['sourceKind'] == 'EDITION_FUSION':
            bad('KIND', 'a frame proposal is not an edition fusion')
    else:
        if p['assetByteHash'] is not None or p['frameId'] is not None:
            bad('SCOPE', 'an edition proposal names no frame')
        if p['sourceKind'] != 'EDITION_FUSION' or p['role'] != 'NOT_APPLICABLE' or p['projection'] != 'NOT_APPLICABLE':
            bad('SCOPE', 'an edition proposal is an EDITION_FUSION with role and projection NOT_APPLICABLE')
    perspective = p['projection'] == 'PERSPECTIVE' or p['role'] in ('EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE') \
        or (p['scope'] == 'FRAME' and p['assetByteHash'] in ctx['perspectiveBytes'])  # by bytes, not only by label
    if p['scope'] == 'FRAME' and p['assetByteHash'] in ctx.get('interiorBytes', set()) and p['proposalKind'] != 'SCENE_ROLE' and not abstain:
        bad('INTERIOR_TO_EXTERIOR', 'bytes the page structure files as an interior carry no non-abstaining exterior proposal')
    # gate 3: no metric authority from a perspective; SOURCE_EXACT only from a printed technical value
    if p['metricAuthority'] == 'SOURCE_EXACT':
        if perspective or p['scope'] != 'EDITION' or not any(a['anchorKind'] in ('TECHNICAL_SCHEDULE', 'TECHNICAL_PARAM') for a in anchors):
            bad('PERSPECTIVE_AUTHORITY', 'SOURCE_EXACT needs a printed technical value and never comes from a perspective')
    if perspective and p['metricAuthority'] != 'NONE':
        bad('PERSPECTIVE_AUTHORITY', 'a perspective frame carries no metric authority')
    if any(a['anchorKind'] == 'PIXEL_ROUTER_V1' for a in anchors) and p['metricAuthority'] != 'NONE':
        bad('PERSPECTIVE_AUTHORITY', 'a pixel router reading carries no metric authority')
    # pixel regions exist only where a pixel reader located something (none qualifies in this study)
    if p['pixelRegion'] is not None:
        bad('PIXEL_REGION', 'no pixel reader qualifies in 005R-EXTERIOR, so no region may be stated')
    # gate 2: an interior frame carries a scene role and nothing exterior
    if p['role'] == 'INTERIOR_PERSPECTIVE' and p['proposalKind'] != 'SCENE_ROLE':
        bad('INTERIOR_TO_EXTERIOR', 'an interior frame carries no exterior feature')
    # a perspective frame can only abstain about feature visibility (no visibility reader qualifies)
    if perspective and p['proposalKind'] == 'FEATURE':
        bad('VISIBILITY', 'a perspective frame carries a scene role or an (abstaining) visibility question, never a feature')
    if perspective and p['proposalKind'] != 'SCENE_ROLE' and not abstain:
        bad('VISIBILITY', 'feature visibility on a perspective frame is not measurable here: abstain')
    # gate 6: corroboration is traceable to a distinct technical source of the same class
    tech = [a for a in anchors if a['anchorKind'] in TECHNICAL_ANCHORS and a['projection'] != 'PERSPECTIVE'
            and a['polarity'] == 'POSITIVE' and a['featureClass'] == p['featureClass'] and a['provenance'] in STRONG_PROVENANCE
            and not (set(a['byteHashes']) & ctx['perspectiveBytes']) and usable_production(a, ctx)]
    pub = [a for a in anchors if a['anchorKind'] in CLAIM_ANCHORS and a['polarity'] == 'POSITIVE' and a['featureClass'] == p['featureClass']]
    negs = [a for a in anchors if a['anchorKind'] in TECHNICAL_ANCHORS | CLAIM_ANCHORS and a['polarity'] in ('NEGATIVE', 'NEUTRAL') and a['featureClass'] == p['featureClass']]
    st = p['verificationStatus']
    if st in ('TECHNICALLY_CORROBORATED', 'TECHNICAL_ONLY', 'PUBLISHER_CLAIM_ONLY', 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED') and negs:
        bad('EVIDENCE_VALIDITY', 'a negative or conflicting anchor of the class makes the proposal a CONFLICT, not a presence')
    if st == 'VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED' and not any(a['anchorKind'] == 'PRODUCTION_TECHNICAL_FEATURE' and a['provenance'] in VISUAL_PROVENANCE and a['featureClass'] == p['featureClass'] for a in anchors):
        bad('EVIDENCE_VALIDITY', 'VISUAL_ONLY needs a tone-band production anchor of the class')
    if st == 'TECHNICALLY_CORROBORATED' and not (tech and pub):
        bad('EVIDENCE_VALIDITY', 'TECHNICALLY_CORROBORATED needs a publisher claim AND a distinct technical anchor of the same class')
    if st == 'TECHNICAL_ONLY' and not tech:
        bad('EVIDENCE_VALIDITY', 'TECHNICAL_ONLY needs a strong technical anchor of the same class')
    if st == 'TECHNICAL_NEGATIVE_CORROBORATED' and not any(a['anchorKind'] in TECHNICAL_ANCHORS and a['polarity'] == 'NEGATIVE' for a in anchors):
        bad('EVIDENCE_VALIDITY', 'a technical negative needs a technical anchor that says no')
    if st == 'PUBLISHER_CLAIM_ONLY' and (tech or not pub):
        bad('EVIDENCE_VALIDITY', 'PUBLISHER_CLAIM_ONLY is a positive claim without strong technical support')
    if st == 'TECHNICALLY_CORROBORATED' and ch['orthographicTechnicalConfirmation'] != 'CONFIRMED':
        bad('CHANNEL', 'a corroborated proposal says its technical confirmation channel CONFIRMED')
    if ch['orthographicTechnicalConfirmation'] == 'CONFIRMED' and not tech:
        bad('CHANNEL', 'CONFIRMED technical channel without a strong technical anchor of the class')
    # look-alike locks: a pergola is open; a slab never corroborates it
    if p['featureClass'] == 'PERGOLA' and p['featureRelation'] == 'SOLID_COVER':
        bad('LOOKALIKE', 'a pergola with a solid cover is not a pergola (PERGOLA_HAS_ROOF)')
    if p['featureClass'] == 'CARPORT' and st in ('TECHNICALLY_CORROBORATED', 'TECHNICAL_ONLY') and any(a['ref'].startswith('schedule:') and 'wiatroł' in a['ref'].lower() for a in anchors):
        bad('LOOKALIKE', 'a vestibule (wiatrołap) is not a carport')
    return e


def ctx_from(m):
    """What the manifest says each edition published: its assets, and its OWN production run's frames and features."""
    assets, persp, eb, ef, ed = {}, set(), {}, {}, {}
    for a in m['assets'] + m.get('extendedNegatives', []):
        assets[a['assetByteHash']] = {'editions': a['editions'], 'lineageGroup': a['lineageGroup']}
        if a['structureRole005r'] in ('EXTERIOR_RENDER', 'INTERIOR_RENDER'):
            persp.add(a['assetByteHash'])
    for k, e in m['editions'].items():
        t = e.get('technical') or {}
        eb[k] = {f['byteHash'] for f in t.get('frames', [])}
        ef[k] = {f['anchorId'] for f in t.get('features', [])}
        ed[k] = {'schedule': e['technicalSchedule'], 'claims': e['publisherClaims'],
                 'features': {f['anchorId']: f for f in t.get('features', [])}}
    interior = {a['assetByteHash'] for a in m['assets'] + m.get('extendedNegatives', []) if a['structureRole005r'] == 'INTERIOR_RENDER'}
    return {'assets': assets, 'perspectiveBytes': persp, 'interiorBytes': interior, 'editionBytes': eb, 'editionFeatures': ef, 'editions': ed}


def anchor_is_genuine(a, ctx):
    """Addendum E: every anchor is checked against what the manifest records for ITS edition, not taken at its word."""
    e = ctx.get('editions', {}).get(a['editionKey'])
    if e is None:
        return False, 'no such edition in the manifest'
    k, ref, cls, pol = a['anchorKind'], a['ref'], a['featureClass'], a['polarity']
    if k == 'TECHNICAL_SCHEDULE':
        sc = e['schedule']
        m = re.match(r'^schedule:no-garage-among-(\d+)$', ref)
        if m:
            ok = cls == 'GARAGE_ENCLOSED' and pol == 'NEGATIVE' and int(m.group(1)) == sc['roomsListed'] and not sc['scheduleKinds'].get('GARAGE_ENCLOSED') and not sc['params']['garageAreaPrinted']
            return ok, 'negative schedule anchor does not match the schedule'
        m = re.match(r'^schedule:([A-Z_]+):(\d+)$', ref)
        ok = bool(m) and m.group(1) == cls and pol == 'POSITIVE' and sc['scheduleKinds'].get(cls, 0) == int(m.group(2)) > 0 and a['provenance'] == 'PRINTED_SCHEDULE' and not a['byteHashes']
        return ok, 'schedule anchor does not match the plan schedule of its edition'
    if k == 'TECHNICAL_PARAM':
        m = re.match(r'^param:(garageAreaPrinted|garageDoorSpecified)$', ref)
        ok = bool(m) and cls == 'GARAGE_ENCLOSED' and pol == 'POSITIVE' and e['schedule']['params'][m.group(1)] and a['provenance'] == 'PRINTED_SCHEDULE' and not a['byteHashes']
        return ok, 'parameter anchor does not match the printed parameters of its edition'
    if k == 'PRODUCTION_TECHNICAL_FEATURE':
        f = e['features'].get(ref.split(':')[-1])
        ok = f is not None and ref == f"production:{f['productionFamily']}:{f['anchorId']}" and cls == f['featureClass'] and a['provenance'] == f['provenance'] \
            and sorted(a['byteHashes']) == sorted(x['byteHash'] for x in f['frames']) and pol == 'POSITIVE'
        return ok, 'production anchor does not match the feature its edition\'s run solved'
    if k in ('PUBLISHER_CATEGORY', 'PUBLISHER_DESCRIPTION'):
        chan = 'category' if k == 'PUBLISHER_CATEGORY' else 'descriptionKinds'
        m = re.match(r'^(category|description):([A-Z_]+)$', ref)
        want = {'POSITIVE': 'POSITIVE', 'NEGATIVE': 'NEGATIVE', 'CONFLICT': 'NEUTRAL'}.get(e['claims'][chan].get(cls))
        return bool(m) and m.group(2) == cls and want == pol, 'publisher anchor does not match the claims of its edition'
    return True, ''


def usable_production(a, ctx):
    """A production anchor is strong only if production itself stands behind it (not assumed, not a denied recess)."""
    if a['anchorKind'] != 'PRODUCTION_TECHNICAL_FEATURE' or 'editions' not in ctx:
        return True
    f = ctx['editions'].get(a['editionKey'], {}).get('features', {}).get(a['ref'].split(':')[-1])
    return bool(f) and f['provenance'] in STRONG_PROVENANCE and not f['productionDeniesRecess']


def load_ctx(manifest_path):
    return ctx_from(json.load(open(manifest_path)))


def validate(doc, ctx):
    if not isinstance(doc, dict) or set(doc) != TOP_KEYS or doc.get('schemaVersion') != SCHEMA or not isinstance(doc.get('proposals'), list):
        return ['[doc] SHAPE: {schemaVersion, variant, proposals[]}']
    errors = []
    ids = set()
    for i, p in enumerate(doc['proposals']):
        errors += check(p, i, ctx)
        pid = p.get('proposalId') if isinstance(p, dict) else None
        if pid in ids:
            errors.append(f'[{i}] DUPLICATE_ID: {pid}')
        ids.add(pid)
    return errors


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    errs = validate(json.load(open(sys.argv[1])), load_ctx(sys.argv[2]))
    print('\n'.join(errs) if errs else 'VALID')
    sys.exit(1 if errs else 0)
