#!/usr/bin/env python3
"""
gates.py — 005R-EXTERIOR preregistered hard gates, look-alike negatives, stability, confusion/abstention tables and
the targeted falsification (RESEARCH ONLY; never imported by production).

    python3 -I gates.py <corpus-manifest.json> <ledger-private.json> <private-scratch-dir outside Git> <results-dir>

Runs B0 and B1 (contenders.py) on the committed manifest, validates both with the research contract, and writes
aggregate tables to <results-dir> (hashes, ids, classes, counts — no caption, page text or pixel). The resize/pad
control writes transformed copies of selected publisher images to <private-scratch-dir> (outside Git), hashes them
and never shows them to anyone; no pixel is interpreted.
"""
import collections
import io
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schema'))
from common import FEATURE_CLASSES, REPO, canon, dump, file_sha, h, refuse_inside_repo, refuse_private_inside_repo
import contenders
import validate

BASE = 'bfaf286e95105c2cdb32df2d298d3cd93bd43449'
PREREG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preregistration.md')
SEALED = ['common.py', 'ledger.py', 'contenders.py', 'gates.py', 'schema/validate.py', 'schema/test_schema.py']
ALLOWED = ('research/analyzer-005r-exterior/', 'stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_EXTERIOR_TRUTH_JSON.md',
           'PROJECT_STATUS.md', 'tests/architecture/research-isolation.test.ts')
FROZEN = ('packages/', 'apps/', 'android/', '.github/', 'holdout/', 'package-lock.json', 'package.json')


def seal_check():
    """Refuse to run unless every sealed script hashes to what the preregistration recorded."""
    text = open(PREREG, encoding='utf-8').read()
    here = os.path.dirname(os.path.abspath(__file__))
    bad = [f for f in SEALED if f'`{file_sha(os.path.join(here, f))}`  {f}' not in text]
    if bad:
        raise SystemExit(f'REFUSED: sealed scripts changed since the preregistration: {bad}')
    return {f: file_sha(os.path.join(here, f)) for f in SEALED}


def frame_props(doc, kind=None):
    return [p for p in doc['proposals'] if p['scope'] == 'FRAME' and (kind is None or p['proposalKind'] == kind)]


def ctx_with(manifest):
    return validate.ctx_from(manifest)


def scene_table(doc, manifest):
    """Scene role vs the 005R structural role (CONSISTENCY with page structure, not accuracy) and vs V1 pixels."""
    by_hash = {a['assetByteHash']: a for a in manifest['assets']}
    t = collections.Counter()
    groups = collections.defaultdict(set)
    for p in frame_props(doc, 'SCENE_ROLE'):
        a = by_hash[p['assetByteHash']]
        t[(a['structureRole005r'], p['role'])] += 1
        groups[(a['structureRole005r'], p['role'])].add(a['lineageGroup'])
    return {'byAsset': {f'{k[0]} -> {k[1]}': v for k, v in sorted(t.items())},
            'byLineageGroup': {f'{k[0]} -> {k[1]}': len(v) for k, v in sorted(groups.items())}}


def feature_table(doc):
    t = collections.defaultdict(collections.Counter)
    fams = collections.defaultdict(set)
    for p in doc['proposals']:
        if p['scope'] == 'EDITION':
            t[p['featureClass']][p['verificationStatus']] += 1
            fams[(p['featureClass'], p['verificationStatus'])].add(p['projectEditionId'])
    return {c: dict(sorted(t[c].items())) for c in FEATURE_CLASSES if c in t}


def interior_gate(manifest, doc):
    """Gate 2 on the selected interiors AND the extended interior set (every interiors-carousel asset of the editions)."""
    group_channels = {}
    for a in manifest['assets'] + manifest['extendedNegatives']:
        group_channels.setdefault(a['lineageGroup'], set()).update((m['channel'], m['captionClass']) for m in a['memberships'])
    res = {'selected': collections.Counter(), 'extended': collections.Counter(), 'extendedExteriorNamed': collections.Counter()}
    by_hash = {a['assetByteHash']: a for a in manifest['assets']}
    promoted = 0
    for p in frame_props(doc):
        a = by_hash[p['assetByteHash']]
        if a['structureRole005r'] == 'INTERIOR_RENDER':
            if p['proposalKind'] == 'SCENE_ROLE':
                res['selected'][p['role']] += 1
            if p['role'] == 'EXTERIOR_PERSPECTIVE' or (p['proposalKind'] != 'SCENE_ROLE' and 'abstain' not in p['confidenceOrAbstain']):
                promoted += 1
    for a in manifest['extendedNegatives']:
        if not a['scoredSize']:
            continue
        for ed in a['selectedFor']:
            if ed not in a['editions']:
                continue
            role = contenders.b1_scene(a, ed, group_channels)[0]
            named = any(m['captionClass'] == 'EXTERIOR_NAMED' for m in a['memberships'])
            if a['structureRole005r'] == 'INTERIOR_RENDER' and not named:
                res['extended'][role] += 1
                promoted += role == 'EXTERIOR_PERSPECTIVE'
            elif named:
                res['extendedExteriorNamed'][role] += 1
    return {k: dict(v) for k, v in res.items()}, promoted


def lookalikes(manifest, b1):
    eds = manifest['editions']
    E = [p for p in b1['proposals'] if p['scope'] == 'EDITION']
    out = {}
    naive = collections.Counter(k for e in eds.values() for k in e['publisherClaims']['naivePageWide'])
    claimed = collections.Counter(k for e in eds.values() for k in set(e['publisherClaims']['category']) | set(e['publisherClaims']['descriptionKinds'])
                                  if (e['publisherClaims']['category'].get(k) == 'POSITIVE' or e['publisherClaims']['descriptionKinds'].get(k) == 'POSITIVE'))
    out['LA1_vestibule_is_not_carport'] = {
        'editionsNaivePageWideWiat': naive['CARPORT'], 'vestibuleScheduleEntries': sum(e['technicalSchedule']['vestibuleEntries'] for e in eds.values()),
        'carportClaims': claimed['CARPORT'], 'carportScheduleEntries': sum(e['technicalSchedule']['scheduleKinds'].get('CARPORT', 0) for e in eds.values()),
        'carportProposalsPresent': sum(1 for p in E if p['featureClass'] == 'CARPORT' and p['verificationStatus'] not in ('PUBLISHER_NEGATIVE', 'UNRESOLVED', 'CONFLICT')),
        'pass': True}
    out['LA1_vestibule_is_not_carport']['pass'] = out['LA1_vestibule_is_not_carport']['carportProposalsPresent'] == claimed['CARPORT'] + 0 and not any(
        a['ref'].startswith('schedule:CARPORT') for p in E for a in p['sourceEvidence'])
    out['LA2_site_navigation_is_not_a_claim'] = {k: {'naivePageWide': naive[k], 'productClaim': claimed[k]} for k in ('PERGOLA', 'GARAGE_ENCLOSED', 'TERRACE', 'CARPORT')}
    out['LA2_site_navigation_is_not_a_claim']['pass'] = True  # descriptive: B1 never reads the navigation
    perg = [p for p in E if p['featureClass'] == 'PERGOLA']
    solid_eds = {p['projectEditionId'] for p in E if p['featureClass'] == 'UNKNOWN_ASSEMBLY' and p['featureRelation'] == 'SOLID_COVER'}
    out['LA3_open_pergola_vs_solid_cover'] = {
        'pergolaProposals': len(perg), 'pergolaWithSolidCover': sum(1 for p in perg if p['featureRelation'] == 'SOLID_COVER'),
        'pergolaCorroborated': sum(1 for p in perg if p['verificationStatus'] == 'TECHNICALLY_CORROBORATED'),
        'pergolaClaimEditionsWithATechnicalSolidSlab': sorted({p['projectEditionId'] for p in perg} & solid_eds),
        'note': 'a technical slab in the same edition is a different object until localized; it never corroborates nor refutes the pergola'}
    out['LA3_open_pergola_vs_solid_cover']['pass'] = out['LA3_open_pergola_vs_solid_cover']['pergolaWithSolidCover'] == 0 and out['LA3_open_pergola_vs_solid_cover']['pergolaCorroborated'] == 0
    terr = [p for p in E if p['featureClass'] == 'TERRACE']
    out['LA4_uncovered_vs_covered_terrace'] = {
        'terraceProposals': len(terr), 'relation': dict(collections.Counter(f"{p['featureRelation']}/{p['featureRelationBasis']}" for p in terr)),
        'technicalSolidCoverOnTerrace': sum(1 for p in terr if p['featureRelation'] == 'SOLID_COVER' and p['featureRelationBasis'] == 'TECHNICAL')}
    out['LA4_uncovered_vs_covered_terrace']['pass'] = out['LA4_uncovered_vs_covered_terrace']['technicalSolidCoverOnTerrace'] == 0
    says_cols = sum(1 for e in eds.values() for f in ((e['technical'] or {}).get('features') or []) if f['saysColumns'])
    col_from_prod = sum(1 for p in E if p['featureClass'] == 'COLUMNS_SUPPORTS' for a in p['sourceEvidence'] if a['anchorKind'] == 'PRODUCTION_TECHNICAL_FEATURE')
    out['LA5_scan_columns_are_not_columns'] = {'productionWhyMentionsColumns': says_cols, 'columnsProposalsFromProduction': col_from_prod,
                                               'columnsProposals': dict(collections.Counter(p['verificationStatus'] for p in E if p['featureClass'] == 'COLUMNS_SUPPORTS')),
                                               'pass': col_from_prod == 0}
    cross = sum(1 for p in E if p['featureClass'] in ('ENTRANCE_CANOPY', 'BALCONY') for a in p['sourceEvidence'] if a['featureClass'] not in (None, p['featureClass']))
    out['LA6_canopy_vs_balcony'] = {'crossClassAnchors': cross, 'balcony': dict(collections.Counter(p['verificationStatus'] for p in E if p['featureClass'] == 'BALCONY')),
                                    'canopy': dict(collections.Counter(p['verificationStatus'] for p in E if p['featureClass'] == 'ENTRANCE_CANOPY')), 'pass': cross == 0}
    gar = [p for p in E if p['featureClass'] == 'GARAGE_ENCLOSED']
    out['LA7_carport_vs_enclosed_garage'] = {'garage': dict(collections.Counter(p['verificationStatus'] for p in gar)),
                                             'carportCorroborated': sum(1 for p in E if p['featureClass'] == 'CARPORT' and p['verificationStatus'] == 'TECHNICALLY_CORROBORATED'),
                                             'garageDoorInProductionModel': 'NOT_MEASURED (production doors carry no usage field; addendum E)'}
    out['LA7_carport_vs_enclosed_garage']['pass'] = out['LA7_carport_vs_enclosed_garage']['carportCorroborated'] == 0
    terr_bad = sum(1 for p in terr for a in p['sourceEvidence'] if a['anchorKind'] == 'PRODUCTION_TECHNICAL_FEATURE' and not a['ref'].startswith(('production:TERRACE:', 'production:TERRACES:')))
    out['LA8_terrace_vs_building_mass'] = {'terraceAnchorsFromNonTerraceProduction': terr_bad, 'pass': terr_bad == 0}
    # addendum E (audit finding 4): say which controls can fail on real data and which hold by construction of B1
    kinds = {'LA1_vestibule_is_not_carport': 'NAIVE_READER_CONTROL (16 vestibule schedule entries vs a naive token)',
             'LA2_site_navigation_is_not_a_claim': 'DESCRIPTIVE (B1 never reads the navigation)',
             'LA3_open_pergola_vs_solid_cover': 'CODE_PATH_ASSERTION (no technical path maps to PERGOLA)',
             'LA4_uncovered_vs_covered_terrace': 'CODE_PATH_ASSERTION (terrace never gets a technical cover basis)',
             'LA5_scan_columns_are_not_columns': 'CODE_PATH_ASSERTION (no production family maps to COLUMNS_SUPPORTS)',
             'LA6_canopy_vs_balcony': 'CODE_PATH_ASSERTION (anchors carry their own class)',
             'LA7_carport_vs_enclosed_garage': 'CODE_PATH_ASSERTION (0 carport claims or entries in the corpus)',
             'LA8_terrace_vs_building_mass': 'CODE_PATH_ASSERTION (only production TERRACE maps to TERRACE)'}
    for k, v in kinds.items():
        out[k]['testKind'] = v
    return out


def stability(manifest, ledger, scratch, b1):
    base = h(canon(b1))
    res = {}
    urls = contenders.urls_from_005r(REPO)
    res['S1_order'] = {'runs': 10, 'identical': sum(h(canon(contenders.run(contenders.shuffled(manifest, s), 'B1', urls))) == base for s in range(10))}
    # S2 duplicated views: every asset listed twice + one near-duplicate per group (new bytes, same group, same channels)
    m2 = json.loads(json.dumps(manifest))
    m2['assets'] = m2['assets'] + json.loads(json.dumps(manifest['assets']))
    near = {}
    for a in manifest['assets']:
        if a['lineageGroup'] not in near:
            d = json.loads(json.dumps(a))
            d['assetByteHash'] = h('near-duplicate', a['assetByteHash'])
            d['productionFrames'] = {}
            near[a['lineageGroup']] = (d, a)
    m2['assets'] += [d for d, _ in near.values()]
    d2 = contenders.run(m2, 'B1', urls)
    ed_a = sorted(canon(p) for p in b1['proposals'] if p['scope'] == 'EDITION')
    ed_b = sorted(canon(p) for p in d2['proposals'] if p['scope'] == 'EDITION')
    role_of = {(p['assetByteHash'], p['projectEditionId']): p['role'] for p in frame_props(d2, 'SCENE_ROLE')}
    same_role = sum(role_of[(d['assetByteHash'], ed)] == role_of[(a['assetByteHash'], ed)] for d, a in near.values() for ed in a['selectedFor'] if ed in a['editions'])
    total = sum(1 for d, a in near.values() for ed in a['selectedFor'] if ed in a['editions'])
    res['S2_duplicates'] = {'exactDuplicatesAdded': len(manifest['assets']), 'nearDuplicatesAdded': len(near),
                            'editionProposalsIdentical': ed_a == ed_b,
                            'exactDuplicateFrameProposalsIdentical': sorted(canon(p) for p in frame_props(b1)) == sorted(canon(p) for p in frame_props(d2) if p['assetByteHash'] in {a['assetByteHash'] for a in manifest['assets']}),
                            'nearDuplicateSameRole': f'{same_role}/{total}'}
    # S3 resize / pad: real transformed bytes (outside Git), never displayed or interpreted
    from PIL import Image
    files = {a['assetByteHash']: a['localFile'] for a in ledger['assets']}
    variants = collections.Counter()
    m3 = json.loads(json.dumps(manifest))
    added = []
    for a in manifest['assets']:
        src = files.get(a['assetByteHash'])
        if not src or not os.path.exists(src):
            continue
        im = Image.open(src).convert('RGB')
        for kind in ('resize50', 'padWhiteSquare', 'padGreySquare'):
            if kind == 'resize50':
                t = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.BILINEAR)
            else:
                s = max(im.size)
                t = Image.new('RGB', (s, s), (255, 255, 255) if kind == 'padWhiteSquare' else (128, 128, 128))
                t.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
            buf = io.BytesIO()
            t.save(buf, 'PNG')
            data = buf.getvalue()
            path = os.path.join(scratch, f"{a['assetByteHash'][:16]}-{kind}.png")
            with open(path, 'wb') as f:
                f.write(data)
            import hashlib
            hv = hashlib.sha256(data).hexdigest()
            for attached in (True, False):
                d = json.loads(json.dumps(a))
                d['assetByteHash'] = hv if attached else h('unattached', hv)
                d['productionFrames'] = {}
                if not attached:
                    d['memberships'] = []
                    d['lineageGroup'] = 'lg-unattached-' + hv[:12]
                added.append((d, a, kind, attached))
                variants[kind] += 1
    m3['assets'] += [d for d, *_ in added]
    d3 = contenders.run(m3, 'B1', urls)
    role_of = {(p['assetByteHash'], p['projectEditionId']): p['role'] for p in frame_props(d3, 'SCENE_ROLE')}
    s3 = collections.Counter()
    for d, a, kind, attached in added:
        for ed in a['selectedFor']:
            if ed not in a['editions']:
                continue
            r0, r1 = role_of[(a['assetByteHash'], ed)], role_of[(d['assetByteHash'], ed)]
            if attached:
                s3[f'{kind}:attached:{"same" if r0 == r1 else "changed"}'] += 1
            else:
                s3[f'{kind}:unattached:{r1}'] += 1
    res['S3_resize_pad'] = {'transformedFiles': sum(variants.values()) // 2, 'outcomes': dict(sorted(s3.items())),
                            'editionProposalsIdentical': sorted(canon(p) for p in d3['proposals'] if p['scope'] == 'EDITION') == ed_a,
                            'note': 'B1 decodes no pixel: an attached copy keeps its structural role; an unattached copy abstains'}
    # pixel channel under padding (005R A1 readings of the same V1 router; no re-run)
    flips = collections.Counter()
    for a in manifest['assets']:
        v = a.get('v1PixelRole')
        if v and v.get('paddedA1') and v['resolved']:
            for bg in ('white', 'grey'):
                flips[f"{bg}:{'same' if v['paddedA1'][bg] == v['role'] else 'flipped'}"] += 1
    res['S4_pixel_channel_under_padding'] = dict(sorted(flips.items()))
    # S5: B1 decisions do not depend on the pixel channel (it is recorded, never decisive)
    m5 = json.loads(json.dumps(manifest))
    for a in m5['assets']:
        if a.get('v1PixelRole'):
            a['v1PixelRole']['role'] = 'SITE_PLAN'
    d5 = contenders.run(m5, 'B1', urls)
    key = lambda p: (p['assetByteHash'], p['projectEditionId'], p['proposalKind'], p['featureClass'], p['role'], p['verificationStatus'])
    res['S5_pixel_channel_not_decisive'] = {'decisionsIdentical': sorted(map(key, b1['proposals']), key=str) == sorted(map(key, d5['proposals']), key=str)}
    return res


def falsify(manifest, urls, ctx):
    """Targeted falsification: corroboration must come from technical evidence of the SAME edition."""
    out = {}
    m = json.loads(json.dumps(manifest))
    for e in m['editions'].values():
        e['technical'] = None
        e['technicalSchedule']['scheduleKinds'] = {}
        e['technicalSchedule']['params'] = {'garageAreaPrinted': False, 'garageDoorSpecified': False}
        e['technicalSchedule']['roomsListed'] = 0
    d = contenders.run(m, 'B1', urls)
    out['note'] = 'F1 and F2 are sanity checks (the status rule needs both inputs by construction); F3 is the falsification'
    out['F1_no_technical_inputs'] = {'technicallyCorroborated': sum(p['verificationStatus'] == 'TECHNICALLY_CORROBORATED' for p in d['proposals']),
                                     'technicalOnly': sum(p['verificationStatus'] == 'TECHNICAL_ONLY' for p in d['proposals'])}
    m = json.loads(json.dumps(manifest))
    for e in m['editions'].values():
        e['publisherClaims']['category'] = {}
        e['publisherClaims']['descriptionKinds'] = {}
    d = contenders.run(m, 'B1', urls)
    out['F2_no_publisher_claims'] = {'technicallyCorroborated': sum(p['verificationStatus'] == 'TECHNICALLY_CORROBORATED' for p in d['proposals'])}
    # F3: launder Rarytasy 5 (G2E) technical evidence into OWNER's anchor edition, (a) as is, (b) relabelled
    src, dst = 'archon:m84f2903cb8e14', 'archon:m3ea28300f9b3e'
    b1 = contenders.run(manifest, 'B1', urls)
    stolen = [p for p in b1['proposals'] if p['projectEditionId'] == src and p['scope'] == 'EDITION' and any(a['anchorKind'] == 'PRODUCTION_TECHNICAL_FEATURE' for a in p['sourceEvidence'])]
    a_errs, b_errs = 0, 0
    for p in stolen:
        q = json.loads(json.dumps(p))
        q['projectEditionId'] = dst
        q['correlationGroup'] = 'edition:' + dst
        a_errs += bool([x for x in validate.check(q, 0, ctx) if 'EDITION_MIX' in x])
        for a in q['sourceEvidence']:
            a['editionKey'] = dst
        b_errs += bool([x for x in validate.check(q, 0, ctx) if 'EDITION_MIX' in x])
    out['F3_launder_G2E5_into_owner_anchor'] = {'laundered': len(stolen), 'caughtAsIs': a_errs, 'caughtAfterRelabel': b_errs,
                                                'uncaughtAfterRelabel': len(stolen) - b_errs,
                                                'note': 'relabelled anchors are caught when they cite bytes, or name production features, that the target edition never published or solved (addendum C)'}
    return out


def freeze():
    changed = subprocess.run(['git', 'diff', '--name-only', BASE], cwd=REPO, capture_output=True, text=True, check=True).stdout.split()
    untracked = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'], cwd=REPO, capture_output=True, text=True, check=True).stdout.split()
    files = sorted(set(changed + untracked))
    outside = [f for f in files if not f.startswith(ALLOWED)]
    frozen = [f for f in files if f.startswith(FROZEN)]
    guard = subprocess.run(['git', 'diff', '--quiet', BASE, '--', 'packages/source-vision/src/tasks.ts', 'packages/source-vision/src/apply.ts'], cwd=REPO).returncode == 0
    return {'base': BASE, 'touched': files, 'outsideAllowlist': outside, 'frozenTouched': frozen, 'n1ProjectionGuardUnchanged': guard,
            'verdict': 'IDENTICAL' if not outside and not frozen and guard else 'VIOLATED'}


def main(manifest_path, ledger_path, scratch, results):
    refuse_private_inside_repo(scratch, ledger_path)
    refuse_inside_repo(results)
    os.makedirs(scratch, exist_ok=True)
    os.makedirs(results, exist_ok=True)
    sealed = seal_check()
    manifest = json.load(open(manifest_path))
    ledger = json.load(open(ledger_path))
    urls = contenders.urls_from_005r(REPO)
    ctx = ctx_with(manifest)
    docs = {v: contenders.run(manifest, v, urls) for v in ('B0', 'B1')}
    for v, d in docs.items():
        dump(d, os.path.join(results, f'proposals-{v}.json'))
    errors = {v: validate.validate(d, ctx) for v, d in docs.items()}
    b1 = docs['B1']
    E1 = [p for p in b1['proposals'] if p['scope'] == 'EDITION']
    gates = {}
    # G1 variant isolation
    owner = [p for p in b1['proposals'] if p['projectEditionId'] == 'archon:m3ea28300f9b3e']
    shared_groups = collections.defaultdict(set)
    for p in frame_props(b1):
        shared_groups[p['correlationGroup']].add(p['projectEditionId'])
    gates['G1_variant_isolation'] = {
        'editionMixErrors': sum('EDITION_MIX' in e for v in errors.values() for e in v),
        'ownerAnchorTechnicalAnchors': sum(1 for p in owner for a in p['sourceEvidence'] if a['anchorKind'] == 'PRODUCTION_TECHNICAL_FEATURE'),
        'ownerAnchorStatuses': dict(collections.Counter(p['verificationStatus'] for p in owner if p['scope'] == 'EDITION')),
        'correlationGroupsSpanningEditions': {g: sorted(e) for g, e in shared_groups.items() if len(e) > 1},
        'byteAssetsPublishedByMoreThanOneEdition': sum(1 for a in manifest['assets'] if len(a['editions']) > 1)}
    gates['G1_variant_isolation']['pass'] = gates['G1_variant_isolation']['editionMixErrors'] == 0 and gates['G1_variant_isolation']['ownerAnchorTechnicalAnchors'] == 0
    # G2 interiors
    tab, promoted = interior_gate(manifest, b1)
    gates['G2_interiors'] = {'B1': tab, 'promotedToExterior': promoted, 'B0_selectedInteriors': dict(collections.Counter(
        p['role'] for p in frame_props(docs['B0'], 'SCENE_ROLE') if {a['assetByteHash']: a for a in manifest['assets']}[p['assetByteHash']]['structureRole005r'] == 'INTERIOR_RENDER')),
        'pass': promoted == 0}
    # G3 perspective authority
    persp = [p for d in docs.values() for p in d['proposals'] if p['projection'] == 'PERSPECTIVE' or p['role'] in ('EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE')]
    fr = freeze()
    gates['G3_perspective_authority'] = {'perspectiveProposals': len(persp), 'withMetricAuthority': sum(p['metricAuthority'] != 'NONE' for p in persp),
                                         'sourceExactFromPerspectiveAnchor': sum(1 for d in docs.values() for p in d['proposals'] if p['metricAuthority'] == 'SOURCE_EXACT'
                                                                                 for a in p['sourceEvidence'] if a['projection'] == 'PERSPECTIVE'),
                                         'structuralWallOrRoofAssertions': 0, 'n1ProjectionGuardUnchanged': fr['n1ProjectionGuardUnchanged']}
    gates['G3_perspective_authority']['pass'] = gates['G3_perspective_authority']['withMetricAuthority'] == 0 and gates['G3_perspective_authority']['sourceExactFromPerspectiveAnchor'] == 0 and fr['n1ProjectionGuardUnchanged']
    # G4 look-alikes
    la = lookalikes(manifest, b1)
    gates['G4_lookalikes'] = {'controls': la, 'pass': all(v.get('pass', True) for v in la.values())}
    # G5 stability
    st = stability(manifest, ledger, scratch, b1)
    gates['G5_stability'] = {'controls': st, 'pass': st['S1_order']['identical'] == 10 and st['S2_duplicates']['editionProposalsIdentical']
                             and st['S2_duplicates']['exactDuplicateFrameProposalsIdentical'] and st['S3_resize_pad']['editionProposalsIdentical']
                             and not any(k.endswith(':changed') for k in st['S3_resize_pad']['outcomes'])
                             and not any(':unattached:' in k and not k.endswith('OTHER_UNKNOWN') for k in st['S3_resize_pad']['outcomes'])
                             and st['S5_pixel_channel_not_decisive']['decisionsIdentical']}
    # G6 evidence validity
    corr = [p for p in b1['proposals'] if p['verificationStatus'] == 'TECHNICALLY_CORROBORATED']
    trace = []
    for p in corr:
        t = [a for a in p['sourceEvidence'] if a['anchorKind'] in validate.TECHNICAL_ANCHORS and a['polarity'] == 'POSITIVE' and a['featureClass'] == p['featureClass']]
        trace.append({'edition': p['projectEditionId'], 'scope': p['scope'], 'class': p['featureClass'], 'technical': sorted(a['ref'].split(':')[0] + ':' + a['ref'].split(':')[1] for a in t),
                      'technicalBytesOverlapPerspective': any(set(a['byteHashes']) & ctx['perspectiveBytes'] for a in t)})
    gates['G6_evidence_validity'] = {'validatorErrors': {v: len(e) for v, e in errors.items()}, 'firstErrors': {v: e[:5] for v, e in errors.items()},
                                     'technicallyCorroborated': len(corr), 'trace': trace}
    gates['G6_evidence_validity']['pass'] = all(not e for e in errors.values()) and not any(t['technicalBytesOverlapPerspective'] or not t['technical'] for t in trace)
    gates['G7_scope_freeze'] = dict(fr, **{'pass': fr['verdict'] == 'IDENTICAL'})
    # tables
    tables = {'scene': {v: scene_table(d, manifest) for v, d in docs.items()},
              'features': {v: feature_table(d) for v, d in docs.items()},
              'frameFeatureVisibility': {v: dict(collections.Counter(f"{p['featureClass']}:{p['verificationStatus']}" for p in frame_props(d, 'FEATURE_VISIBILITY'))) for v, d in docs.items()},
              'elevationFrameFeatures': {v: dict(collections.Counter(f"{p['featureClass']}:{p['verificationStatus']}" for p in frame_props(d, 'FEATURE'))) for v, d in docs.items()},
              'abstention': {v: {'frameSceneAbstain': sum('abstain' in p['confidenceOrAbstain'] for p in frame_props(d, 'SCENE_ROLE')),
                                 'frameScene': len(frame_props(d, 'SCENE_ROLE')),
                                 'editionConflicts': sum(p['verificationStatus'] == 'CONFLICT' for p in d['proposals'] if p['scope'] == 'EDITION'),
                                 'refusals': dict(collections.Counter(p['refusalReason'].split(':')[0] for p in d['proposals'] if p['refusalReason']))} for v, d in docs.items()},
              'classesByFamily': {c: {s: len({manifest['editions'][p['projectEditionId']]['family'] for p in E1 if p['featureClass'] == c and p['verificationStatus'] == s})
                                      for s in sorted({p['verificationStatus'] for p in E1 if p['featureClass'] == c})} for c in FEATURE_CLASSES}}
    fal = falsify(manifest, urls, ctx)
    summary = {'schema': 'research.005r-exterior.gates.0.1', 'sealedScripts': sealed, 'preregistrationSha256': file_sha(PREREG),
               'manifestSha256': file_sha(manifest_path), 'proposalHashes': {v: h(canon(d)) for v, d in docs.items()},
               'proposalCounts': {v: len(d['proposals']) for v, d in docs.items()}, 'gates': gates, 'tables': tables, 'falsification': fal,
               'hardGatesPass': all(g['pass'] for g in gates.values())}
    dump(summary, os.path.join(results, 'gates.json'))
    for k, g in gates.items():
        print(k, 'PASS' if g['pass'] else 'FAIL')
    print('falsification', json.dumps(fal))


if __name__ == '__main__':
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*sys.argv[1:5])
