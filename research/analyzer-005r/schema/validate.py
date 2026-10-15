#!/usr/bin/env python3
"""
validate.py — validator for the 005R RESEARCH visual-observation JSON (never a shipping schema; never imported by
production). Standard library only, so CI and a reviewer can run it anywhere.

Two document kinds:
  research.visual-observations.0.1   one routed source image (one asset variant) and what was seen on it
  research.visual-edition-summary.0.1  the observations of ONE edition grouped into hypotheses

    python3 -I research/analyzer-005r/schema/validate.py <doc.json> [--manifest corpus-manifest.json] [--forbid tokens.json]

Exit 0 when valid, 1 with one line per violation otherwise. `validate_document(doc, manifest, forbidden)` returns the
violation list and is what the tests call.

What the validator enforces (each is a rule of the 005R brief, §3):
  identity     a document without grounded image identity (publisher, editionKey, assetId, 64-hex variantSha256,
               decoded size) is invalid; every observation's evidence must be that same asset and variant
  authority    no SOURCE_EXACT / MEASURED / USER_CONFIRMED / AUTHORITATIVE / CONFIRMED anywhere; metricDimensions must
               be null; a confidence is only ever an UNVALIDATED_SCORE (or NONE)
  boxes        a box only from a producer that declares the LOCALIZER capability; integer pixel box inside the decoded
               image; normalised box equal to pixel box / size; a classifier never carries a box
  routing      exterior-assembly presence only on an asset routed EXTERIOR_RENDER / EXTERIOR_PHOTO /
               TECHNICAL_ELEVATION with roleStatus PROPOSED — an interior view is never facade evidence
  absence      FEATURE_ABSENT_IF_VISIBLE needs an explicit covered region; without coverage only UNRESOLVED
  leakage      no prompt, caption, truth/label, published-area, project-name or raw-text fields; no forbidden token
               (edition slug, project name) inside any string
  lineage      (edition summary) every supporting variant hash must be published by that edition per the manifest;
               independentWitnesses ≤ distinct lineage groups; a hypothesis is at most PROPOSED

Addendum C (post-review A-2) hardened the contract: a CLOSED key allowlist at every level (an unknown key is invalid,
so a box, a dimension or a caption cannot hide under another name), list elements are walked, authority words are
matched case-insensitively outside prose, any distance with a unit in any string is METRIC, confidence values must agree
with their type, the routing gate covers every observation that is not UNRESOLVED/UNRESOLVED, the manifest check covers
every lineage op (a derived copy's parent must be published by the edition) and the decoded size, support lineage groups
must be the manifest's, witnesses are an int ≥ 1, structure identity across images is never ESTABLISHED. What it still
cannot see without the observation documents: whether a summary's observationId exists (the assembler builds both).
"""
import json
import math
import re
import sys

OBS_SCHEMA = 'research.visual-observations.0.1'
SUM_SCHEMA = 'research.visual-edition-summary.0.1'
ROLES = {'FLOOR_PLAN', 'TECHNICAL_ELEVATION', 'SECTION', 'SITE_PLAN', 'EXTERIOR_RENDER', 'INTERIOR_RENDER', 'EXTERIOR_PHOTO',
         'INTERIOR_PHOTO', 'DETAIL', 'OTHER', 'UNKNOWN'}
EXTERIOR_EVIDENCE_ROLES = {'EXTERIOR_RENDER', 'EXTERIOR_PHOTO', 'TECHNICAL_ELEVATION'}
KINDS = {'TERRACE_AT_GRADE', 'COVERED_TERRACE', 'PERGOLA_OPEN', 'CANOPY_ENTRANCE', 'CARPORT', 'BALCONY', 'LOGGIA', 'RAILING',
         'COLUMN_POST', 'EXTERIOR_STEPS', 'GARAGE_DOOR', 'WINDOW', 'EXTERIOR_DOOR', 'UNKNOWN_ASSEMBLY'}
STATUS = {'PROPOSED', 'UNRESOLVED', 'REJECTED'}
PRESENCE = {'FEATURE_PRESENT', 'FEATURE_ABSENT_IF_VISIBLE', 'UNRESOLVED'}
VIEW = {'FRONT', 'REAR', 'LEFT', 'RIGHT', 'SIDE_UNSPECIFIED', 'FRONT_OBLIQUE', 'REAR_OBLIQUE', 'OBLIQUE_UNSPECIFIED',
        'NOT_APPLICABLE', 'UNKNOWN'}
CONF_TYPES = {'UNVALIDATED_SCORE', 'NONE'}
LINEAGE_OPS = {'ORIGINAL', 'PUBLISHER_VARIANT', 'CROP', 'MIRROR', 'DOWNSCALE', 'DERIVED'}
CLAIM_SOURCES = {'PUBLISHER_METADATA', 'PIXEL_ROUTER', 'SYNTHETIC_GENERATOR'}
CAPABILITIES = {'CLASSIFIER', 'LOCALIZER', 'RULES'}
FORBIDDEN_VALUES = re.compile(r'\b(SOURCE_EXACT|SOURCE_CORROBORATED|MEASURED|USER_CONFIRMED|DERIVED_FROM_USER_CONFIRMED|AUTHORITATIVE|CONFIRMED|VERIFIED|CALIBRATED|ACCEPTED)\b', re.I)
FORBIDDEN_IN_PROSE = re.compile(r'\b(SOURCE_EXACT|SOURCE_CORROBORATED|USER_CONFIRMED|DERIVED_FROM_USER_CONFIRMED|AUTHORITATIVE)\b|source[ _-]exact|user[ _-]confirmed', re.I)
METRIC_TEXT = re.compile(r'\d+(?:[.,]\d+)?\s*(?:m|cm|mm|m2|m²|metres?|meters?)\b', re.I)
PROSE_KEYS = {'reason', 'note', 'basis', 'detail'}
CODE = re.compile(r'^[A-Z][A-Z0-9_]*$')
KEYS = {
    'obsdoc': {'schemaVersion', 'producer', 'asset', 'observations'},
    'producer': {'stage', 'contender', 'detector', 'capabilities', 'codeSha256'},
    'asset': {'publisher', 'editionKey', 'canonicalUrl', 'assetId', 'variantSha256', 'variantUrl', 'decoded', 'lineage', 'editionsPublishingSameBytes',
              'roleClaims', 'role', 'roleStatus', 'roleEvidenceIds', 'roleAlternatives', 'roleConfidence', 'viewSide'},
    'decoded': {'width', 'height'}, 'lineage': {'op', 'parentSha256', 'lineageGroup'}, 'claim': {'claimId', 'source', 'basis', 'role'},
    'conf': {'type', 'value'}, 'view': {'value', 'basis', 'mirrorAmbiguous'}, 'box': {'x0', 'y0', 'x1', 'y1'}, 'coverage': {'regionCovered', 'basis'},
    'obs': {'id', 'kind', 'status', 'presence', 'viewSide', 'pixelBox', 'normBox', 'evidenceAssetId', 'evidenceVariantSha256', 'detector', 'confidence',
            'alternatives', 'visibleEvidence', 'reason', 'assemblyCandidateId', 'metricDimensions', 'coverage'},
    'sumdoc': {'schemaVersion', 'producer', 'editionKey', 'canonicalUrl', 'hypotheses'}, 'sumproducer': {'stage', 'contender', 'detector'},
    'hyp': {'id', 'kind', 'status', 'independentWitnesses', 'structureIdentityAcrossImages', 'support', 'reason', 'metricDimensions'},
    'support': {'observationId', 'variantSha256', 'lineageGroup', 'sourceKind', 'sharedWithEditions'},
}
FORBIDDEN_KEYS = re.compile(r'^(prompt|prompts|caption|captions|truth|label|labels|groundTruth|expected|expectedFeatures|publishedArea|'
                            r'published_area|footprintArea|area|usableArea|projectName|projectTitle|title|slug|rawText|html|pageText|description)$', re.I)
HEX64 = re.compile(r'^[0-9a-f]{64}$')
EDITION = re.compile(r'^[a-z0-9.-]+:[A-Za-z0-9._-]+$')


def _walk(node, path='$', key=None):
    if isinstance(node, dict):
        for k, v in node.items():
            yield path, k, v, True
            yield from _walk(v, f'{path}.{k}', k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield f'{path}[{i}]', key, v, False   # list elements are checked under their list's key
            yield from _walk(v, f'{path}[{i}]', key)


def _keys(obj, allowed, where, errs):
    if isinstance(obj, dict):
        extra = sorted(set(obj) - allowed)
        if extra:
            errs.append(f'SCHEMA_KEY {where}: keys not in the contract: {extra}')


def _conf(c, where, errs):
    if c is None:
        return
    _keys(c, KEYS['conf'], where, errs)
    if c.get('type') == 'NONE' and c.get('value') is not None:
        errs.append(f'CONFIDENCE {where}: a NONE confidence carries no value')
    if c.get('type') == 'UNVALIDATED_SCORE' and not (isinstance(c.get('value'), (int, float)) and not isinstance(c.get('value'), bool) and 0 <= c['value'] <= 1):
        errs.append(f'CONFIDENCE {where}: an UNVALIDATED_SCORE is a number in [0, 1]')


def _common(doc, forbidden, errs):
    for path, k, v, is_key in _walk(doc):
        if is_key and isinstance(k, str) and FORBIDDEN_KEYS.match(k):
            errs.append(f'LEAKAGE_FIELD {path}.{k}: field not allowed in an observation document')
        for tok in forbidden:
            if tok and is_key and isinstance(k, str) and re.search(r'(?<![a-z0-9])' + re.escape(tok.lower()) + r'(?![a-z0-9])', k.lower()):
                errs.append(f'LEAKAGE_TOKEN {path}: a key contains forbidden token {tok!r}')
        if not isinstance(v, str):
            continue
        prose = k in PROSE_KEYS
        if (FORBIDDEN_IN_PROSE if prose else FORBIDDEN_VALUES).search(v) and k not in ('canonicalUrl', 'variantUrl'):
            errs.append(f'AUTHORITY {path}.{k}={v[:60]!r}: authoritative/verified status is never produced from an image')
        if METRIC_TEXT.search(v) and k not in ('canonicalUrl', 'variantUrl', 'detector', 'codeSha256'):
            errs.append(f'METRIC {path}.{k}: a dimension with a unit in text — no dimension originates from an image here')
        low = v.lower()
        for tok in forbidden:
            if tok and k not in ('canonicalUrl', 'variantUrl', 'editionKey') and re.search(r'(?<![a-z0-9])' + re.escape(tok.lower()) + r'(?![a-z0-9])', low):
                errs.append(f'LEAKAGE_TOKEN {path}.{k}: contains forbidden token {tok!r}')


def _box(o, w, h, can_localize, errs, where):
    pb, nb = o.get('pixelBox'), o.get('normBox')
    if pb is None and nb is None:
        return
    if not can_localize:
        errs.append(f'FABRICATED_BOX {where}: producer has no LOCALIZER capability but the observation carries a box')
        return
    if pb is None or nb is None:
        errs.append(f'BOX {where}: pixelBox and normBox must be given together')
        return
    try:
        x0, y0, x1, y1 = (pb[k] for k in ('x0', 'y0', 'x1', 'y1'))
    except (KeyError, TypeError):
        errs.append(f'BOX {where}: pixelBox needs x0,y0,x1,y1')
        return
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in (x0, y0, x1, y1)):
        errs.append(f'BOX {where}: pixel coordinates must be integers')
        return
    if not (0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h):
        errs.append(f'BOX {where}: pixelBox {pb} outside the decoded image {w}x{h} or empty')
        return
    exp = {'x0': x0 / w, 'y0': y0 / h, 'x1': x1 / w, 'y1': y1 / h}
    for k, v in exp.items():
        got = nb.get(k)
        if not isinstance(got, (int, float)) or not math.isfinite(got) or abs(got - v) > 1e-6:
            errs.append(f'BOX {where}: normBox.{k}={got} ≠ pixelBox/size {v:.6f}')


def _manifest_asset(manifest, sha):
    if manifest is None:
        return None
    return next((x for x in manifest.get('assets', []) if x.get('variantSha256') == sha), None)


def validate_observations(doc, manifest=None, forbidden=()):
    errs = []
    if doc.get('schemaVersion') != OBS_SCHEMA:
        return [f'SCHEMA schemaVersion must be {OBS_SCHEMA}']
    _keys(doc, KEYS['obsdoc'], '$', errs)
    prod = doc.get('producer') or {}
    _keys(prod, KEYS['producer'], 'producer', errs)
    caps = set(prod.get('capabilities') or [])
    if not prod.get('contender') or not prod.get('detector') or not caps or not caps <= CAPABILITIES:
        errs.append('PRODUCER producer.contender, producer.detector and producer.capabilities ⊆ {CLASSIFIER, LOCALIZER, RULES} are required')
    a = doc.get('asset')
    if not isinstance(a, dict):
        return errs + ['IDENTITY asset is required']
    _keys(a, KEYS['asset'], 'asset', errs)
    for k in ('publisher', 'editionKey', 'assetId', 'variantSha256'):
        if not isinstance(a.get(k), str) or not a.get(k):
            errs.append(f'IDENTITY asset.{k} is required: a document without grounded image identity is invalid')
    if isinstance(a.get('variantSha256'), str) and not HEX64.match(a['variantSha256']):
        errs.append('IDENTITY asset.variantSha256 must be 64 lowercase hex')
    if isinstance(a.get('editionKey'), str) and not EDITION.match(a['editionKey']):
        errs.append('IDENTITY asset.editionKey must look like <publisher>:<edition-id>')
    dec = a.get('decoded') or {}
    _keys(dec, KEYS['decoded'], 'asset.decoded', errs)
    w, h = dec.get('width'), dec.get('height')
    if not (isinstance(w, int) and isinstance(h, int) and not isinstance(w, bool) and w > 0 and h > 0):
        errs.append('IDENTITY asset.decoded.width/height (from the bytes) are required')
        w = h = None
    lin = a.get('lineage') or {}
    _keys(lin, KEYS['lineage'], 'asset.lineage', errs)
    if lin.get('op') not in LINEAGE_OPS:
        errs.append(f'LINEAGE asset.lineage.op must be one of {sorted(LINEAGE_OPS)}')
    if lin.get('op') in ('CROP', 'MIRROR', 'DOWNSCALE', 'DERIVED') and not HEX64.match(str(lin.get('parentSha256') or '')):
        errs.append('LINEAGE a derived copy must name its parentSha256: it is not independent source support')
    if a.get('role') not in ROLES:
        errs.append(f'ROLE asset.role must be one of {sorted(ROLES)}')
    if a.get('roleStatus') not in STATUS:
        errs.append('ROLE asset.roleStatus must be PROPOSED, UNRESOLVED or REJECTED')
    if not set(a.get('roleAlternatives') or []) <= ROLES:
        errs.append('ROLE asset.roleAlternatives must be research roles')
    claims = a.get('roleClaims') or []
    claim_ids = {}
    for i, c in enumerate(claims):
        _keys(c, KEYS['claim'], f'asset.roleClaims[{i}]', errs)
        if c.get('source') not in CLAIM_SOURCES or not c.get('claimId') or not c.get('basis'):
            errs.append(f'ROLE asset.roleClaims[{i}] needs claimId, source ∈ {sorted(CLAIM_SOURCES)} and basis')
        claim_ids[c.get('claimId')] = c
    if a.get('role') not in ('UNKNOWN', None) and a.get('roleStatus') == 'PROPOSED' and not a.get('roleEvidenceIds'):
        errs.append('ROLE a PROPOSED role needs roleEvidenceIds')
    for rid in a.get('roleEvidenceIds') or []:
        c = claim_ids.get(rid)
        if c is None:
            errs.append(f'ROLE roleEvidenceIds names {rid!r}, which is not a roleClaim of this asset')
        elif c.get('source') in ('PIXEL_ROUTER', 'SYNTHETIC_GENERATOR') and c.get('role') in ROLES and c.get('role') != a.get('role'):
            errs.append(f'ROLE evidence claim {rid!r} says {c.get("role")}, which contradicts the asset role {a.get("role")}')
    _conf(a.get('roleConfidence'), 'asset.roleConfidence', errs)
    if a.get('roleConfidence') is not None and a['roleConfidence'].get('type') not in CONF_TYPES:
        errs.append('CONFIDENCE asset.roleConfidence.type must be UNVALIDATED_SCORE or NONE')
    vs = a.get('viewSide') or {}
    _keys(vs, KEYS['view'], 'asset.viewSide', errs)
    if vs.get('value') not in VIEW or not isinstance(vs.get('mirrorAmbiguous'), bool) or not vs.get('basis'):
        errs.append('VIEW asset.viewSide needs value, basis and mirrorAmbiguous')
    if manifest is not None and isinstance(a.get('editionKey'), str):
        ed = manifest.get('editions', {}).get(a['editionKey'])
        if ed is None:
            errs.append('EDITION_MIX the edition is not in the corpus manifest')
        else:
            pub = set(ed.get('variantSha256', []))
            own = a.get('variantSha256') if lin.get('op') in ('ORIGINAL', 'PUBLISHER_VARIANT') else lin.get('parentSha256')
            if own not in pub:
                errs.append('EDITION_MIX the variant (or, for a derived copy, its parent) is not published by this edition according to the corpus manifest')
        ma = _manifest_asset(manifest, a.get('variantSha256'))
        if ma is not None and (ma.get('width'), ma.get('height')) != (w, h):
            errs.append('IDENTITY asset.decoded differs from the manifest size of these bytes')
        if ma is not None and lin.get('lineageGroup') not in (None, ma.get('lineageGroup')):
            errs.append('LINEAGE asset.lineage.lineageGroup differs from the manifest')
    exterior_ok = a.get('role') in EXTERIOR_EVIDENCE_ROLES and a.get('roleStatus') == 'PROPOSED'
    ids = set()
    for i, o in enumerate(doc.get('observations') or []):
        where = f'observations[{i}]'
        _keys(o, KEYS['obs'], where, errs)
        if not o.get('id') or o['id'] in ids:
            errs.append(f'OBS {where}: unique id required')
        ids.add(o.get('id'))
        if o.get('kind') not in KINDS:
            errs.append(f'OBS {where}: kind must be one of the 005R exterior kinds')
        if o.get('status') not in STATUS:
            errs.append(f'OBS {where}: status must be PROPOSED, UNRESOLVED or REJECTED')
        if o.get('presence') not in PRESENCE:
            errs.append(f'OBS {where}: presence must be FEATURE_PRESENT, FEATURE_ABSENT_IF_VISIBLE or UNRESOLVED')
        if o.get('evidenceAssetId') != a.get('assetId') or o.get('evidenceVariantSha256') != a.get('variantSha256'):
            errs.append(f'IDENTITY {where}: evidence must be this document\'s asset and variant (source swap)')
        if 'metricDimensions' not in o or o.get('metricDimensions') is not None:
            errs.append(f'METRIC {where}: metricDimensions must be present and null — no dimension originates from an image here')
        conf = o.get('confidence') or {}
        if conf.get('type') not in CONF_TYPES:
            errs.append(f'CONFIDENCE {where}: confidence.type must be UNVALIDATED_SCORE or NONE')
        _conf(conf, f'{where}.confidence', errs)
        if not o.get('detector') or not o.get('reason') or not isinstance(o.get('alternatives'), list):
            errs.append(f'OBS {where}: detector, reason and alternatives are required')
        if not set(o.get('alternatives') or []) <= KINDS:
            errs.append(f'OBS {where}: alternatives must be 005R exterior kinds')
        ve = o.get('visibleEvidence')
        if not isinstance(ve, list) or not all(isinstance(x, str) and CODE.match(x) for x in ve):
            errs.append(f'OBS {where}: visibleEvidence is a list of UPPER_SNAKE evidence codes (what was visible), possibly empty')
        if o.get('presence') == 'FEATURE_PRESENT' and o.get('status') == 'PROPOSED' and not ve:
            errs.append(f'OBS {where}: a PROPOSED presence must name what was visible')
        if (o.get('presence') != 'UNRESOLVED' or o.get('status') == 'PROPOSED') and not exterior_ok:
            errs.append(f'ROUTING {where}: an exterior-assembly claim (presence {o.get("presence")}, status {o.get("status")}) on an asset not routed to exterior evidence (role {a.get("role")}, {a.get("roleStatus")})')
        if o.get('presence') == 'FEATURE_ABSENT_IF_VISIBLE':
            cov = o.get('coverage') or {}
            _keys(cov, KEYS['coverage'], f'{where}.coverage', errs)
            if cov.get('regionCovered') is not True or not cov.get('basis'):
                errs.append(f'ABSENCE {where}: absence needs coverage.regionCovered=true with a basis; otherwise UNRESOLVED')
        for bk in ('pixelBox', 'normBox'):
            if isinstance(o.get(bk), dict):
                _keys(o[bk], KEYS['box'], f'{where}.{bk}', errs)
        if w and h:
            _box(o, w, h, 'LOCALIZER' in caps, errs, where)
    _common(doc, forbidden, errs)
    return errs


def validate_summary(doc, manifest=None, forbidden=()):
    errs = []
    if doc.get('schemaVersion') != SUM_SCHEMA:
        return [f'SCHEMA schemaVersion must be {SUM_SCHEMA}']
    _keys(doc, KEYS['sumdoc'], '$', errs)
    _keys(doc.get('producer') or {}, KEYS['sumproducer'], 'producer', errs)
    ed = doc.get('editionKey')
    if not isinstance(ed, str) or not EDITION.match(ed) or not doc.get('canonicalUrl'):
        errs.append('IDENTITY editionKey and canonicalUrl are required')
    published = None
    if manifest is not None:
        e = manifest.get('editions', {}).get(ed)
        if e is None:
            errs.append('EDITION_MIX the edition is not in the corpus manifest')
            published = set()
        else:
            published = set(e.get('variantSha256', []))
            if e.get('canonicalUrls') and doc.get('canonicalUrl') not in e['canonicalUrls']:
                errs.append('IDENTITY canonicalUrl is not a canonical URL of this edition in the manifest')
    for i, hyp in enumerate(doc.get('hypotheses') or []):
        where = f'hypotheses[{i}]'
        _keys(hyp, KEYS['hyp'], where, errs)
        if hyp.get('kind') not in KINDS:
            errs.append(f'HYP {where}: kind must be a 005R exterior kind')
        if hyp.get('status') not in STATUS:
            errs.append(f'HYP {where}: status is at most PROPOSED')
        if hyp.get('structureIdentityAcrossImages', 'NOT_ESTABLISHED') != 'NOT_ESTABLISHED':
            errs.append(f'HYP {where}: physical identity across images is never established from images here')
        sup = hyp.get('support') or []
        if hyp.get('status') == 'PROPOSED' and not sup:
            errs.append(f'HYP {where}: a PROPOSED hypothesis needs support')
        groups = {s.get('lineageGroup') for s in sup}
        iw = hyp.get('independentWitnesses')
        if not isinstance(iw, int) or isinstance(iw, bool) or iw < (1 if sup else 0) or iw > len(groups):
            errs.append(f'CORRELATION {where}: independentWitnesses must be an int between 1 and the distinct lineage groups ({len(groups)}); correlated images are one witness')
        for j, s_ in enumerate(sup):
            _keys(s_, KEYS['support'], f'{where}.support[{j}]', errs)
            if not HEX64.match(str(s_.get('variantSha256') or '')) or not s_.get('observationId') or not s_.get('lineageGroup'):
                errs.append(f'HYP {where}.support[{j}]: variantSha256, observationId and lineageGroup are required')
                continue
            if published is not None and s_['variantSha256'] not in published:
                errs.append(f'EDITION_MIX {where}.support[{j}]: variant {s_["variantSha256"][:12]} is not published by {ed}')
            ma = _manifest_asset(manifest, s_['variantSha256'])
            if ma is not None and ma.get('lineageGroup') != s_['lineageGroup']:
                errs.append(f'CORRELATION {where}.support[{j}]: lineageGroup differs from the manifest (a relabelled group is still one witness)')
        if 'metricDimensions' not in hyp or hyp.get('metricDimensions') is not None:
            errs.append(f'METRIC {where}: metricDimensions must be present and null')
    _common(doc, forbidden, errs)
    return errs


def validate_document(doc, manifest=None, forbidden=()):
    v = doc.get('schemaVersion') if isinstance(doc, dict) else None
    if v == OBS_SCHEMA:
        return validate_observations(doc, manifest, forbidden)
    if v == SUM_SCHEMA:
        return validate_summary(doc, manifest, forbidden)
    return [f'SCHEMA unknown schemaVersion {v!r}']


def main(argv):
    if not argv:
        sys.exit(__doc__)
    doc = json.load(open(argv[0]))
    manifest = json.load(open(argv[argv.index('--manifest') + 1])) if '--manifest' in argv else None
    forbidden = json.load(open(argv[argv.index('--forbid') + 1])) if '--forbid' in argv else ()
    errs = validate_document(doc, manifest, forbidden)
    for e in errs:
        print(e)
    print('VALID' if not errs else f'INVALID ({len(errs)})')
    return 0 if not errs else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
