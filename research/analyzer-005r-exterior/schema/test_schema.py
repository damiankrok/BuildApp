#!/usr/bin/env python3
"""
test_schema.py — 005R-EXTERIOR contract tests on a SYNTHETIC fixture (no publisher data). B1 on the fixture must
validate clean; every preregistered mutation must be refused with its named code.

    python3 -I research/analyzer-005r-exterior/schema/test_schema.py
"""
import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import contenders  # noqa: E402
import validate  # noqa: E402

A, B = 'synthetic:ed-a', 'synthetic:ed-b'
HEX = lambda c: c * 64  # noqa: E731


def asset(byte, group, eds, role, memberships, frames=None, v1=None):
    return {'assetByteHash': HEX(byte), 'assetId': 'a-' + byte * 8, 'lineageGroup': group, 'editions': eds, 'family': 'synthetic:fam',
            'width': 800, 'height': 600, 'structureRole005r': role, 'structureBasis005r': 'STRUCTURE',
            'memberships': [{'editionKey': e, 'channel': c, 'captionClass': k} for e, c, k in memberships],
            'productionFrames': frames or {}, 'v1PixelRole': v1, 'purposes': [], 'selectedFor': eds}


def edition(key, cat, desc, sched, feats, frames):
    return {'editionKey': key, 'family': 'synthetic:fam', 'split005r': 'DEV', 'pageSha256': HEX('0'), 'n1vRow': 'syn',
            'publisherClaims': {'categoriesFound': 3, 'descriptionChars': 10, 'category': cat, 'descriptionKinds': desc, 'categoryCover': [],
                                'descriptionCover': [], 'naivePageWide': ['CARPORT']},
            'technicalSchedule': sched,
            'technical': {'modelSha256': HEX('1'), 'observationGraphHash': HEX('2'), 'frames': frames, 'features': feats,
                          'featureSource': 'FEATURE_GRAPH', 'garageDoorsInModel': 0} if feats is not None else None}


def fixture():
    elev_frame = {'frameId': 'frame-elev', 'byteHash': HEX('e'), 'document': 'ELEVATION', 'projection': 'ORTHOGRAPHIC_ELEVATION', 'view': 'FRONT'}
    terrace = {'anchorId': 'feat-terrace', 'productionFamily': 'TERRACE', 'featureClass': 'TERRACE', 'relation': 'UNKNOWN', 'technicalMeaning': 'x',
               'provenance': 'SOURCE_DERIVED', 'quality': 'L2', 'viewFamilies': ['ELEVATION', 'PLAN'],
               'frames': [{'frameId': 'frame-elev', 'byteHash': HEX('e'), 'projection': 'ORTHOGRAPHIC_ELEVATION'}], 'saysColumns': False, 'productionDeniesRecess': False}
    slab = dict(terrace, anchorId='feat-slab', productionFamily='ATTACHED_ROOF', featureClass='UNKNOWN_ASSEMBLY', relation='SOLID_COVER', provenance='SOURCE_EXACT', saysColumns=True)
    sched = {'roomsListed': 12, 'scheduleKinds': {'GARAGE_ENCLOSED': 1}, 'vestibuleEntries': 1, 'params': {'garageAreaPrinted': True, 'garageDoorSpecified': True}}
    nosched = {'roomsListed': 10, 'scheduleKinds': {}, 'vestibuleEntries': 1, 'params': {'garageAreaPrinted': False, 'garageDoorSpecified': False}}
    return {
        'schema': 'x', 'seed': 'x', 'families': ['synthetic:fam'], 'groups': {},
        'editions': {
            A: edition(A, {'GARAGE_ENCLOSED': 'POSITIVE', 'PERGOLA': 'POSITIVE'}, {'TERRACE': 'POSITIVE'}, sched, [terrace, slab], [elev_frame]),
            B: edition(B, {'GARAGE_ENCLOSED': 'NEGATIVE'}, {'TERRACE': 'POSITIVE'}, nosched, None, []),
        },
        'assets': [
            asset('e', 'lg-elev', [A], 'TECHNICAL_ELEVATION', [(A, 'PAGE:elevations-tab', 'N/A')], {A: elev_frame}),
            asset('f', 'lg-hero', [A], 'EXTERIOR_RENDER', [(A, 'PAGE:fancybox3ProdBigImg0', 'N/A')], v1={'role': 'INTERIOR_RENDER', 'resolved': True, 'paddedA1': None}),
            asset('a', 'lg-int', [A, B], 'INTERIOR_RENDER', [(A, 'CAROUSEL:fancybox3Interiors', 'INTERIOR_ZONE'), (B, 'CAROUSEL:fancybox3Interiors', 'INTERIOR_ZONE')]),
            asset('c', 'lg-conf', [B], 'INTERIOR_RENDER', [(B, 'CAROUSEL:fancybox3Interiors', 'EXTERIOR_NAMED')]),
        ],
        'extendedNegatives': [],
    }


def ctx_of(m):
    return validate.ctx_from(m)


class Contract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = fixture()
        cls.ctx = ctx_of(cls.m)
        cls.doc = contenders.run(cls.m, 'B1', {})
        cls.b0 = contenders.run(cls.m, 'B0', {})

    def find(self, **kw):
        return next(p for p in self.doc['proposals'] if all(p[k] == v for k, v in kw.items()))

    def refuse(self, p, code):
        errs = validate.check(p, 0, self.ctx)
        self.assertTrue(any(f'{code}:' in e for e in errs), errs)

    def test_b0_b1_valid(self):
        self.assertEqual(validate.validate(self.doc, self.ctx), [])
        self.assertEqual(validate.validate(self.b0, self.ctx), [])

    def test_b1_routing(self):
        roles = {(p['assetByteHash'][0], p['projectEditionId']): p['role'] for p in self.doc['proposals'] if p['proposalKind'] == 'SCENE_ROLE'}
        self.assertEqual(roles[('e', A)], 'TECHNICAL_ELEVATION')
        self.assertEqual(roles[('f', A)], 'EXTERIOR_PERSPECTIVE')
        self.assertEqual(roles[('a', A)], 'INTERIOR_PERSPECTIVE')
        self.assertEqual(roles[('c', B)], 'OTHER_UNKNOWN')  # interiors carousel with an exterior-named caption abstains
        st = {(p['projectEditionId'], p['featureClass']): p['verificationStatus'] for p in self.doc['proposals'] if p['scope'] == 'EDITION'}
        self.assertEqual(st[(A, 'TERRACE')], 'TECHNICALLY_CORROBORATED')
        self.assertEqual(st[(A, 'GARAGE_ENCLOSED')], 'TECHNICALLY_CORROBORATED')
        self.assertEqual(st[(A, 'PERGOLA')], 'PUBLISHER_CLAIM_ONLY')
        self.assertEqual(st[(A, 'UNKNOWN_ASSEMBLY')], 'TECHNICAL_ONLY')
        self.assertEqual(st[(B, 'GARAGE_ENCLOSED')], 'TECHNICAL_NEGATIVE_CORROBORATED')
        self.assertEqual(st[(B, 'TERRACE')], 'PUBLISHER_CLAIM_ONLY')
        self.assertNotIn((A, 'COLUMNS_SUPPORTS'), st)  # "columns" in a production sentence are scan columns
        self.assertNotIn((A, 'CARPORT'), st)  # a vestibule is not a carport

    def test_m1_edition_mix(self):
        p = copy.deepcopy(self.find(projectEditionId=A, featureClass='TERRACE', scope='EDITION'))
        p['projectEditionId'] = B
        p['correlationGroup'] = 'edition:' + B
        self.refuse(p, 'EDITION_MIX')
        for a in p['sourceEvidence']:
            a['editionKey'] = B
        self.refuse(p, 'EDITION_MIX')  # relabelled anchors still cite frame bytes edition B never published

    def test_m1b_laundered_production_feature(self):
        # a production feature relabelled to an edition whose own run never solved it, with or without frame bytes
        p = copy.deepcopy(self.find(projectEditionId=A, featureClass='TERRACE', scope='EDITION'))
        p['projectEditionId'] = B
        p['correlationGroup'] = 'edition:' + B
        for a in p['sourceEvidence']:
            a['editionKey'] = B
            a['byteHashes'] = []
        self.refuse(p, 'EDITION_MIX')
        q = copy.deepcopy(self.find(projectEditionId=A, featureClass='TERRACE', scope='EDITION'))
        for a in q['sourceEvidence']:
            a['byteHashes'] = [HEX('9')] if a['anchorKind'] == 'PRODUCTION_TECHNICAL_FEATURE' else a['byteHashes']
        self.refuse(q, 'EDITION_MIX')  # bytes the edition never published, in no asset and no frame of its run

    def test_m2_perspective_source_exact(self):
        p = copy.deepcopy(self.find(assetByteHash=HEX('f'), proposalKind='SCENE_ROLE'))
        p['metricAuthority'] = 'SOURCE_EXACT'
        self.refuse(p, 'PERSPECTIVE_AUTHORITY')
        p['metricAuthority'] = 'SOURCE_DERIVED'
        self.refuse(p, 'PERSPECTIVE_AUTHORITY')

    def test_m3_interior_to_exterior(self):
        p = copy.deepcopy(self.find(assetByteHash=HEX('a'), projectEditionId=A, proposalKind='SCENE_ROLE'))
        p['proposalKind'] = 'FEATURE'
        p['featureClass'] = 'TERRACE'
        self.refuse(p, 'INTERIOR_TO_EXTERIOR')

    def test_m4_visibility_promoted(self):
        p = copy.deepcopy(self.find(assetByteHash=HEX('f'), proposalKind='FEATURE_VISIBILITY', featureClass='TERRACE'))
        p['confidenceOrAbstain'] = {'confidence': 0.9}
        p['refusalReason'] = None
        p['verificationStatus'] = 'PUBLISHER_CLAIM_ONLY'
        self.refuse(p, 'VISIBILITY')

    def test_m5_corroboration_from_render_or_claim(self):
        p = copy.deepcopy(self.find(projectEditionId=A, featureClass='PERGOLA', scope='EDITION'))
        p['verificationStatus'] = 'TECHNICALLY_CORROBORATED'
        p['channels']['orthographicTechnicalConfirmation'] = 'CONFIRMED'
        self.refuse(p, 'EVIDENCE_VALIDITY')  # a claim alone
        p['sourceEvidence'].append(contenders.anchor('PRODUCTION_TECHNICAL_FEATURE', A, 'production:X:render', 'PERGOLA', 'NONE', [HEX('f')], 'g', 'SOURCE_DERIVED'))
        self.refuse(p, 'EVIDENCE_VALIDITY')  # a "technical" anchor citing a render's bytes
        p['sourceEvidence'][-1] = contenders.anchor('PRODUCTION_TECHNICAL_FEATURE', A, 'production:ATTACHED_ROOF:feat-slab', 'UNKNOWN_ASSEMBLY', 'ORTHOGRAPHIC_SECTION', [], 'g', 'SOURCE_EXACT')
        self.refuse(p, 'EVIDENCE_VALIDITY')  # a slab of another class never corroborates a pergola

    def test_m6_pergola_solid(self):
        p = copy.deepcopy(self.find(projectEditionId=A, featureClass='PERGOLA', scope='EDITION'))
        p['featureRelation'] = 'SOLID_COVER'
        p['featureRelationBasis'] = 'TECHNICAL'
        self.refuse(p, 'LOOKALIKE')

    def test_m7_closed_keys_and_metres(self):
        p = copy.deepcopy(self.find(assetByteHash=HEX('f'), proposalKind='SCENE_ROLE'))
        p['worldMetres'] = {'width': 4.2}
        self.refuse(p, 'KEYS')
        q = copy.deepcopy(self.find(projectEditionId=A, featureClass='TERRACE', scope='EDITION'))
        q['sourceEvidence'][0]['caption'] = 'x'
        self.refuse(q, 'KEYS')
        r = copy.deepcopy(self.find(assetByteHash=HEX('f'), proposalKind='SCENE_ROLE'))
        r['channels']['reviewerAdjudication'] = 'HUMAN_TRUTH'
        self.refuse(r, 'CHANNEL')

    def test_m8_pixel_region_and_confidence(self):
        p = copy.deepcopy(self.find(assetByteHash=HEX('f'), proposalKind='SCENE_ROLE'))
        p['pixelRegion'] = {'x0': 0, 'y0': 0, 'x1': 1, 'y1': 1}
        self.refuse(p, 'PIXEL_REGION')
        q = copy.deepcopy(self.find(assetByteHash=HEX('f'), proposalKind='SCENE_ROLE'))
        q['confidenceOrAbstain'] = {'confidence': 1.5}
        self.refuse(q, 'CONFIDENCE')
        r = copy.deepcopy(self.find(assetByteHash=HEX('c'), proposalKind='SCENE_ROLE'))
        r['refusalReason'] = None
        self.refuse(r, 'ABSTENTION')

    def test_m9_correlation_and_asset(self):
        p = copy.deepcopy(self.find(assetByteHash=HEX('a'), projectEditionId=B, proposalKind='SCENE_ROLE'))
        p['correlationGroup'] = 'lg-other'
        self.refuse(p, 'CORRELATION')
        q = copy.deepcopy(self.find(assetByteHash=HEX('c'), proposalKind='SCENE_ROLE'))
        q['projectEditionId'] = A
        self.refuse(q, 'ASSET_NOT_IN_EDITION')

    def test_m10_source_exact_needs_printed_value(self):
        p = copy.deepcopy(self.find(projectEditionId=A, featureClass='TERRACE', scope='EDITION'))
        p['metricAuthority'] = 'SOURCE_EXACT'
        self.refuse(p, 'PERSPECTIVE_AUTHORITY')

    def test_m11_status_without_anchor(self):
        p = copy.deepcopy(self.find(projectEditionId=B, featureClass='TERRACE', scope='EDITION'))
        p['verificationStatus'] = 'TECHNICAL_ONLY'
        self.refuse(p, 'EVIDENCE_VALIDITY')

    def test_m12_duplicate_id(self):
        d = copy.deepcopy(self.doc)
        d['proposals'].append(copy.deepcopy(d['proposals'][0]))
        self.assertTrue(any('DUPLICATE_ID' in e for e in validate.validate(d, self.ctx)))

    def test_order_and_duplicate_stability(self):
        base = json.dumps(self.doc, sort_keys=True)
        for s in range(5):
            self.assertEqual(json.dumps(contenders.run(contenders.shuffled(self.m, s), 'B1', {}), sort_keys=True), base)
        m2 = copy.deepcopy(self.m)
        m2['assets'] += copy.deepcopy(self.m['assets'])
        self.assertEqual(json.dumps(contenders.run(m2, 'B1', {}), sort_keys=True), base)


if __name__ == '__main__':
    unittest.main()
