#!/usr/bin/env python3
"""
assemble.py — build and validate the 005R research JSON for every contender (RESEARCH ONLY).

    python3 -I assemble.py <corpus-private.json> <corpus-manifest.json> <truth.json> <runs-dir> <out-dir>

<runs-dir> holds the normalised routers (V0a.json, V0b.json, V1.json, V2.json, N1.json from contenders.py), the raw V2
run (v2.jsonl) and the V1 cue run (v1-cues.jsonl). For each contender and each scored asset it writes one
`research.visual-observations.0.1` document, and per edition one `research.visual-edition-summary.0.1`; every document
is validated (schema/validate.py) against the committed manifest and the forbidden-token list (edition slugs and page
titles). Output documents stay OUTSIDE Git (they name publisher URLs at full detail); only the aggregate gate table
(gates.json) is committed.

Task-B sources per contender:  V0a / V0b → none (the incumbent reads no render and its elevation readings are
geometry for the solver, not 005R observations — see current-pipeline-audit.md); V1 → v1 cues on assets V1 routes
TECHNICAL_ELEVATION; V2 → OWL-ViT boxes on assets V2 routes to exterior evidence; N1 → OWL-ViT boxes on assets N1
routes to exterior evidence. A detection on an asset the contender did NOT route to exterior evidence is kept as a
REJECTED record (never dropped, never FEATURE_PRESENT).

Edition summaries never merge observations from different images into one physical structure
(`structureIdentityAcrossImages: NOT_ESTABLISHED`); a hypothesis is "this edition shows ≥ 1 <kind>", its support are the
PROPOSED observations, and `independentWitnesses` counts distinct SOURCE KINDS (marketing render vs technical drawing)
capped by distinct lineage groups — renders of one publisher's 3D model are one correlated witness, however many.
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'schema'))
from validate import validate_document  # noqa: E402

V2_OPERATING = 0.20
EXT = {'EXTERIOR_RENDER', 'EXTERIOR_PHOTO', 'TECHNICAL_ELEVATION'}
STRUCT_PARENTS = {'PERGOLA_OPEN', 'CARPORT', 'COVERED_TERRACE', 'BALCONY', 'LOGGIA', 'CANOPY_ENTRANCE'}
STRUCT_PARTS = {'COLUMN_POST', 'RAILING'}
V0_TO_VIEW = {'FRONT': 'FRONT', 'REAR': 'REAR', 'SIDE_UNSPECIFIED': 'SIDE_UNSPECIFIED'}


def sha_file(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u else 0.0


def contained(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area = (a[2] - a[0]) * (a[3] - a[1])
    return ix * iy / area if area else 0.0


def boxes(b, w, h):
    x0, y0, x1, y1 = (int(v) for v in b)
    return {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1}, {'x0': x0 / w, 'y0': y0 / h, 'x1': x1 / w, 'y1': y1 / h}


def load_jsonl(p):
    out = {}
    if os.path.exists(p):
        for line in open(p):
            d = json.loads(line)
            if not d.get('meta'):
                out[d['assetId']] = d
    return out


def main(private_p, manifest_p, truth_p, runs, out_dir):
    corpus = json.load(open(private_p))
    manifest = json.load(open(manifest_p))
    truth = {r['assetId']: r for r in json.load(open(truth_p))['rows']}
    v2raw = load_jsonl(os.path.join(runs, 'v2.jsonl'))
    cues = load_jsonl(os.path.join(runs, 'v1-cues.jsonl'))
    v0 = {r['assetId']: r for r in json.load(open(os.path.join(runs, 'V0a.json')))['rows']}
    # forbidden tokens: slug words that name a project, and page titles' distinctive words (≥ 4 letters, not generic)
    generic = {'projekt', 'projekty', 'domu', 'dom', 'domow', 'dane', 'projektu', 'gotowy', 'archon', 'dobre', 'domy', 'ver', 'oze', 'g2e', 'g2', 'ge', 'e'}
    forbidden = set()
    for ed in corpus['editions'].values():
        for u in ed['canonicalUrls']:
            m = re.search(r'/projekt-([a-z0-9-]+)-m[0-9a-f]{8,}', u) or re.search(r'/projekt/([A-Za-z0-9]+)', u) or re.search(r'/p,m[0-9a-f]+,([a-z0-9-]+)', u)
            if m:
                forbidden.add(m.group(1).lower())
                forbidden.update(t for t in m.group(1).lower().split('-') if len(t) >= 4 and t not in generic)
    forbidden = sorted(forbidden)
    code_sha = {f: sha_file(os.path.join(HERE, f)) for f in ('assemble.py', 'schema/validate.py')}
    assets = {a['assetId']: a for a in corpus['assets']}
    gates = {'schema': 'research.005r.gates.0.1', 'forbiddenTokens': len(forbidden), 'contenders': {}}
    for cname in ('V0a', 'V0b', 'V1', 'V2', 'N1'):
        cp = os.path.join(runs, f'{cname}.json')
        if not os.path.exists(cp):
            continue
        routes = {r['assetId']: r for r in json.load(open(cp))['rows']}
        caps = {'V0a': ['RULES'], 'V0b': ['RULES'], 'V1': ['RULES', 'LOCALIZER'], 'V2': ['CLASSIFIER', 'LOCALIZER'], 'N1': ['RULES', 'LOCALIZER']}[cname]
        detector = {'V0a': 'production-source-package-roles', 'V0b': 'production-roles+v1-stump', 'V1': 'v1-features@1+v1-cart@1+v1-cues@1',
                    'V2': 'owlvit-base-patch32@cbc355fb', 'N1': 'n1-fusion(V0a,V1)+owlvit-base-patch32@cbc355fb'}[cname]
        cdir = os.path.join(out_dir, cname)
        os.makedirs(cdir, exist_ok=True)
        viol, counts = {}, {'documents': 0, 'observations': 0, 'proposedPresent': 0, 'rejected': 0, 'unresolved': 0,
                            'proposedPresentOnInteriorTruth': 0, 'proposedPresentOnTechnicalNonElevationTruth': 0, 'byKind': {}}
        per_edition = {}
        for aid in sorted(routes):
            if aid not in assets:
                continue  # synthetic rows of V1/V2 outputs are scored by score_features.py, not assembled here
            a = assets[aid]
            if not a['scoredSize']:
                continue
            r = routes[aid]
            t = truth.get(aid, {})
            role, status = (r['role'], 'PROPOSED') if r['resolved'] else ('UNKNOWN', 'UNRESOLVED')
            claims, ev = [], []
            v0r = v0.get(aid, {})
            if v0r.get('v0Document') not in (None, 'NOT_ACQUIRED'):
                claims.append({'claimId': 'claim-publisher', 'source': 'PUBLISHER_METADATA', 'basis': 'production adapter roles.document (URL slug / caption / channel)',
                               'role': v0r['v0Document']})
                if cname in ('V0a', 'V0b', 'N1'):
                    ev.append('claim-publisher')
            if cname in ('V0b', 'V1', 'V2', 'N1'):
                claims.append({'claimId': 'claim-pixels', 'source': 'PIXEL_ROUTER', 'basis': detector, 'role': role if r['resolved'] else 'UNKNOWN'})
                if r['resolved'] and cname != 'V0a':
                    ev.append('claim-pixels')
            if status == 'PROPOSED' and not ev:
                ev = [c['claimId'] for c in claims][:1]
            views = v0r.get('v0Views') or []
            vside = V0_TO_VIEW.get(views[0], 'UNKNOWN') if len(views) == 1 and role == 'TECHNICAL_ELEVATION' else ('NOT_APPLICABLE' if role in ('FLOOR_PLAN', 'SECTION', 'SITE_PLAN') else 'UNKNOWN')
            m0 = sorted(a['memberships'], key=lambda m: (m['editionKey'], m['url']))[0]
            doc = {
                'schemaVersion': 'research.visual-observations.0.1',
                'producer': {'stage': 'BUILDPLAN-ANALYZER-005R', 'contender': cname, 'detector': detector, 'capabilities': caps, 'codeSha256': code_sha['assemble.py']},
                'asset': {'publisher': m0['host'], 'editionKey': m0['editionKey'], 'canonicalUrl': corpus['editions'][m0['editionKey']]['canonicalUrls'][0],
                          'assetId': aid, 'variantSha256': a['variantSha256'], 'variantUrl': m0['url'], 'decoded': {'width': a['width'], 'height': a['height']},
                          'lineage': {'op': 'ORIGINAL', 'parentSha256': None, 'lineageGroup': a['lineageGroup']},
                          'editionsPublishingSameBytes': a['editions'], 'roleClaims': claims, 'role': role, 'roleStatus': status, 'roleEvidenceIds': ev if status == 'PROPOSED' else [],
                          'roleAlternatives': r.get('alternatives', []), 'roleConfidence': {'type': 'UNVALIDATED_SCORE', 'value': r['score']} if isinstance(r.get('score'), (int, float)) else {'type': 'NONE', 'value': None},
                          'viewSide': {'value': vside, 'basis': 'publisher slug via the production adapter; never inferred from pixels' if vside not in ('UNKNOWN', 'NOT_APPLICABLE') else 'no side is inferred from pixels in 005R',
                                       'mirrorAmbiguous': True}},
                'observations': [],
            }
            routed_ext = r['resolved'] and role in EXT
            raw = []
            if cname in ('V2', 'N1') and aid in v2raw and 'detections' in v2raw[aid]:
                for kind, lst in sorted(v2raw[aid]['detections'].items()):
                    for d in lst:
                        raw.append({'kind': kind, 'box': d['box'], 'score': d['score'], 'visible': ['OPEN_VOCABULARY_DETECTOR_MATCH']})
            if cname == 'V1' and aid in cues and role == 'TECHNICAL_ELEVATION' and r['resolved']:
                for c in cues[aid].get('cues', []):
                    raw.append({'kind': c['kind'], 'box': c['box'], 'score': c['score'], 'visible': c['visibleEvidence']})
            raw.sort(key=lambda d: (-d['score'], d['kind'], d['box']))
            parents = []
            for i, d in enumerate(raw):
                oid = f'{cname.lower()}-{aid}-{i}'
                proposed = routed_ext and d['score'] >= (V2_OPERATING if cname in ('V2', 'N1') else 0)
                status_o = 'PROPOSED' if proposed else ('REJECTED' if not routed_ext else 'UNRESOLVED')
                alts = sorted({o['kind'] for o in raw if o is not d and o['score'] >= 0.05 and iou(o['box'], d['box']) >= 0.5 and o['kind'] != d['kind']})
                cand = None
                if d['kind'] in STRUCT_PARENTS and proposed:
                    cand = f'assembly-candidate-{aid}-{len(parents)}'
                    parents.append((d['box'], cand))
                elif d['kind'] in STRUCT_PARTS and proposed:
                    for pb, pc in parents:
                        if contained(d['box'], pb) >= 0.7:
                            cand = pc
                            break
                pb, nb = boxes(d['box'], a['width'], a['height'])
                o = {'id': oid, 'kind': d['kind'], 'status': status_o, 'presence': 'FEATURE_PRESENT' if proposed else 'UNRESOLVED', 'viewSide': vside,
                     'pixelBox': pb, 'normBox': nb, 'evidenceAssetId': aid, 'evidenceVariantSha256': a['variantSha256'], 'detector': detector,
                     'confidence': {'type': 'UNVALIDATED_SCORE', 'value': d['score']}, 'alternatives': alts + ['UNKNOWN_ASSEMBLY'], 'visibleEvidence': d['visible'],
                     'reason': ('box above the preregistered operating score on an asset routed to exterior evidence; physical identity and cover not established'
                                if proposed else ('kept as a record: the asset is not routed to exterior evidence (role ' + role + ')' if not routed_ext else 'below the operating score')),
                     'assemblyCandidateId': cand, 'metricDimensions': None}
                doc['observations'].append(o)
                counts['observations'] += 1
                if proposed:
                    counts['proposedPresent'] += 1
                    counts['byKind'][d['kind']] = counts['byKind'].get(d['kind'], 0) + 1
                    if t.get('roleTruth') in ('INTERIOR_RENDER', 'INTERIOR_PHOTO'):
                        counts['proposedPresentOnInteriorTruth'] += 1
                    if t.get('roleTruth') in ('FLOOR_PLAN', 'SECTION', 'SITE_PLAN'):
                        counts['proposedPresentOnTechnicalNonElevationTruth'] += 1
                    for ek in a['editions']:
                        per_edition.setdefault(ek, {}).setdefault(d['kind'], []).append(
                            {'observationId': oid, 'variantSha256': a['variantSha256'], 'lineageGroup': a['lineageGroup'],
                             'sourceKind': 'TECHNICAL_DRAWING' if role == 'TECHNICAL_ELEVATION' else 'MARKETING_RENDER', 'sharedWithEditions': [x for x in a['editions'] if x != ek]})
                elif status_o == 'REJECTED':
                    counts['rejected'] += 1
                else:
                    counts['unresolved'] += 1
            errs = validate_document(doc, manifest, forbidden)
            for e in errs:
                viol[e.split(' ')[0]] = viol.get(e.split(' ')[0], 0) + 1
            counts['documents'] += 1
            json.dump(doc, open(os.path.join(cdir, f'{aid}.json'), 'w'), indent=1, sort_keys=True)
        sums = 0
        for ek, kinds in sorted(per_edition.items()):
            hyps = []
            for kind, sup in sorted(kinds.items()):
                groups = {s['lineageGroup'] for s in sup}
                kinds_src = {s['sourceKind'] for s in sup}
                hyps.append({'id': f'{ek}-{kind}', 'kind': kind, 'status': 'PROPOSED', 'independentWitnesses': min(len(kinds_src), len(groups)),
                             'structureIdentityAcrossImages': 'NOT_ESTABLISHED',
                             'support': [{k: s[k] for k in ('observationId', 'variantSha256', 'lineageGroup', 'sourceKind', 'sharedWithEditions')} for s in sup],
                             'reason': 'edition shows at least one such assembly in at least one routed image; renders of one publisher model are one correlated witness',
                             'metricDimensions': None})
            sdoc = {'schemaVersion': 'research.visual-edition-summary.0.1', 'producer': {'stage': 'BUILDPLAN-ANALYZER-005R', 'contender': cname, 'detector': detector},
                    'editionKey': ek, 'canonicalUrl': corpus['editions'][ek]['canonicalUrls'][0], 'hypotheses': hyps}
            errs = validate_document(sdoc, manifest, forbidden)
            for e in errs:
                viol[e.split(' ')[0]] = viol.get(e.split(' ')[0], 0) + 1
            json.dump(sdoc, open(os.path.join(cdir, f'edition-{ek.replace(":", "_")}.json'), 'w'), indent=1, sort_keys=True)
            sums += 1
        counts['editionSummaries'] = sums
        gates['contenders'][cname] = {'counts': counts, 'violations': viol,
                                      'hardGates': {'ungroundedAuthoritative': sum(viol.get(k, 0) for k in ('AUTHORITY', 'METRIC', 'CONFIDENCE', 'IDENTITY')),
                                                    'crossEditionMixing': viol.get('EDITION_MIX', 0),
                                                    'interiorToExteriorClaims_validator': viol.get('ROUTING', 0),
                                                    'interiorToExteriorClaims_truth': counts['proposedPresentOnInteriorTruth'],
                                                    'fabricatedBoxes': viol.get('FABRICATED_BOX', 0) + viol.get('BOX', 0),
                                                    'leakage': viol.get('LEAKAGE_FIELD', 0) + viol.get('LEAKAGE_TOKEN', 0)}}
        print(cname, json.dumps(gates['contenders'][cname]['hardGates']), 'docs', counts['documents'], 'proposed', counts['proposedPresent'])
    gates['codeSha256'] = code_sha
    json.dump(gates, open(os.path.join(out_dir, 'gates.json'), 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main(*sys.argv[1:6])
