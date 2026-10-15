#!/usr/bin/env python3
"""
test_schema.py — positive and negative tests of the 005R research observation contract (RESEARCH ONLY).

    python3 -I research/analyzer-005r/schema/test_schema.py

Each negative test is a mutation of the committed SYNTHETIC example that the brief names as a failure mode: source or
edition swap, fabricated box, class/name leakage, interior-to-exterior, false-confidence promotion, metric dimensions,
missing identity, absence without coverage, correlated witnesses counted twice. Every mutation must be rejected with
the expected violation code; the unmutated examples must pass.
"""
import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from validate import validate_document  # noqa: E402

load = lambda name: json.load(open(os.path.join(HERE, 'examples', name)))
ASSET = load('example-asset.json')
SUMMARY = load('example-edition-summary.json')
MANIFEST = load('example-manifest.json')


def codes(doc, manifest=MANIFEST, forbidden=()):
    return {e.split(' ')[0] for e in validate_document(doc, manifest, forbidden)}


class Positive(unittest.TestCase):
    def test_examples_valid(self):
        self.assertEqual(validate_document(ASSET, MANIFEST), [])
        self.assertEqual(validate_document(SUMMARY, MANIFEST), [])

    def test_empty_observations_allowed(self):
        d = copy.deepcopy(ASSET)
        d['observations'] = []
        self.assertEqual(validate_document(d, MANIFEST), [])

    def test_unknown_role_without_evidence_allowed(self):
        d = copy.deepcopy(ASSET)
        d['asset'].update(role='UNKNOWN', roleStatus='UNRESOLVED', roleEvidenceIds=[])
        d['observations'] = [o for o in d['observations'] if o['presence'] != 'FEATURE_PRESENT']
        self.assertEqual(validate_document(d, MANIFEST), [])


class Negative(unittest.TestCase):
    def test_missing_identity(self):
        for k in ('variantSha256', 'editionKey', 'assetId', 'publisher'):
            d = copy.deepcopy(ASSET)
            del d['asset'][k]
            self.assertIn('IDENTITY', codes(d), k)
        d = copy.deepcopy(ASSET)
        del d['asset']['decoded']
        self.assertIn('IDENTITY', codes(d))

    def test_source_swap(self):
        d = copy.deepcopy(ASSET)
        d['observations'][0]['evidenceVariantSha256'] = '3' * 64
        self.assertIn('IDENTITY', codes(d))
        d = copy.deepcopy(ASSET)
        d['observations'][0]['evidenceAssetId'] = 'another-asset'
        self.assertIn('IDENTITY', codes(d))

    def test_edition_swap(self):
        d = copy.deepcopy(ASSET)
        d['asset']['editionKey'] = 'example:edition-2'
        self.assertIn('EDITION_MIX', codes(d))
        s = copy.deepcopy(SUMMARY)
        s['editionKey'] = 'example:edition-2'
        self.assertIn('EDITION_MIX', codes(s))

    def test_fabricated_box_from_classifier(self):
        d = copy.deepcopy(ASSET)
        d['producer']['capabilities'] = ['CLASSIFIER']
        self.assertIn('FABRICATED_BOX', codes(d))

    def test_box_outside_image_or_inconsistent(self):
        d = copy.deepcopy(ASSET)
        d['observations'][0]['pixelBox']['x1'] = 5000
        self.assertIn('BOX', codes(d))
        d = copy.deepcopy(ASSET)
        d['observations'][0]['normBox']['x0'] = 0.5
        self.assertIn('BOX', codes(d))
        d = copy.deepcopy(ASSET)
        d['observations'][0]['pixelBox']['x0'] = 10.5
        self.assertIn('BOX', codes(d))

    def test_class_and_name_leakage(self):
        for field in ('prompt', 'caption', 'truth', 'publishedArea', 'projectName', 'label'):
            d = copy.deepcopy(ASSET)
            d['observations'][0][field] = 'x'
            self.assertIn('LEAKAGE_FIELD', codes(d), field)
        d = copy.deepcopy(ASSET)
        d['observations'][0]['reason'] = 'pergola as in Dom w Example Edition'
        self.assertIn('LEAKAGE_TOKEN', codes(d, forbidden=['dom w example']))

    def test_interior_to_exterior(self):
        for role in ('INTERIOR_RENDER', 'INTERIOR_PHOTO', 'FLOOR_PLAN', 'UNKNOWN', 'OTHER'):
            d = copy.deepcopy(ASSET)
            d['asset']['role'] = role
            self.assertIn('ROUTING', codes(d), role)
        d = copy.deepcopy(ASSET)
        d['asset']['roleStatus'] = 'UNRESOLVED'
        self.assertIn('ROUTING', codes(d))

    def test_false_confidence_promotion(self):
        d = copy.deepcopy(ASSET)
        d['observations'][0]['status'] = 'CONFIRMED'
        self.assertTrue({'OBS', 'AUTHORITY'} & codes(d))
        d = copy.deepcopy(ASSET)
        d['observations'][0]['confidence'] = {'type': 'CALIBRATED', 'value': 0.99}
        self.assertIn('CONFIDENCE', codes(d))
        d = copy.deepcopy(ASSET)
        d['observations'][0]['fidelity'] = 'SOURCE_EXACT'
        self.assertIn('AUTHORITY', codes(d))
        d = copy.deepcopy(ASSET)
        d['asset']['roleStatus'] = 'VERIFIED'
        self.assertTrue({'ROLE', 'AUTHORITY'} & codes(d))
        s = copy.deepcopy(SUMMARY)
        s['hypotheses'][0]['status'] = 'ACCEPTED'
        self.assertIn('HYP', codes(s))

    def test_metric_dimensions(self):
        d = copy.deepcopy(ASSET)
        d['observations'][0]['metricDimensions'] = {'widthM': 3.2}
        self.assertIn('METRIC', codes(d))
        d = copy.deepcopy(ASSET)
        del d['observations'][0]['metricDimensions']
        self.assertIn('METRIC', codes(d))

    def test_absence_needs_coverage(self):
        d = copy.deepcopy(ASSET)
        d['observations'][1]['presence'] = 'FEATURE_ABSENT_IF_VISIBLE'
        self.assertIn('ABSENCE', codes(d))
        d['observations'][1]['coverage'] = {'regionCovered': True, 'basis': 'whole rear facade inside the frame'}
        self.assertNotIn('ABSENCE', codes(d))

    def test_correlated_witnesses(self):
        s = copy.deepcopy(SUMMARY)
        s['hypotheses'][0]['independentWitnesses'] = 2
        self.assertIn('CORRELATION', codes(s))

    def test_derived_copy_needs_parent(self):
        d = copy.deepcopy(ASSET)
        d['asset']['lineage'] = {'op': 'CROP', 'parentSha256': None}
        self.assertIn('LINEAGE', codes(d))

    def test_role_evidence_must_be_claims(self):
        d = copy.deepcopy(ASSET)
        d['asset']['roleEvidenceIds'] = ['claim-9']
        self.assertIn('ROLE', codes(d))


def mut(f, base=ASSET):
    d = copy.deepcopy(base)
    f(d)
    return d


o0 = lambda d: d['observations'][0]


class ReviewerBypasses(unittest.TestCase):
    """Reviewer A (005R) wrote 25 documents that the first validator accepted. Each must now be rejected with the code
    named here. S3 (a support observationId that names no observation) is a documented residual: a standalone summary
    does not carry its observation documents, so the cross-check belongs to the assembler, not to this validator."""
    CASES = [
        ('B1 authority token inside a list', lambda d: o0(d).__setitem__('visibleEvidence', ['SOURCE_EXACT']), ASSET, {'AUTHORITY'}),
        ('B1b metric text inside a list', lambda d: o0(d).__setitem__('visibleEvidence', ['MEASURED width 3.20 m']), ASSET, {'METRIC', 'AUTHORITY', 'OBS'}),
        ('B2 authority inside alternatives', lambda d: o0(d).__setitem__('alternatives', ['USER_CONFIRMED']), ASSET, {'AUTHORITY', 'OBS'}),
        ('B3 lowercase authority value', lambda d: o0(d).__setitem__('fidelity', 'source_exact'), ASSET, {'AUTHORITY', 'SCHEMA_KEY'}),
        ('B4 metric under another key', lambda d: o0(d).update(widthMeters=3.2, dimensions={'w_m': 3.2}), ASSET, {'SCHEMA_KEY'}),
        ('B5 metric in reason text', lambda d: o0(d).__setitem__('reason', 'pergola 3.2 m x 4.0 m wide'), ASSET, {'METRIC'}),
        ('B6 box under another key from a classifier', lambda d: (d['producer'].__setitem__('capabilities', ['CLASSIFIER']), [o.update(pixelBox=None, normBox=None, bbox=[10, 20, 100, 120]) for o in d['observations']]), ASSET, {'SCHEMA_KEY'}),
        ('B7 box on the asset from a classifier', lambda d: d['asset'].update(pixelBox={'x0': 0, 'y0': 0, 'x1': 10, 'y1': 10}), ASSET, {'SCHEMA_KEY'}),
        ('B8 NONE confidence with a value', lambda d: o0(d).__setitem__('confidence', {'type': 'NONE', 'value': 0.99}), ASSET, {'CONFIDENCE'}),
        ('B9 roleConfidence value out of [0,1]', lambda d: d['asset'].__setitem__('roleConfidence', {'type': 'UNVALIDATED_SCORE', 'value': 7}), ASSET, {'CONFIDENCE'}),
        ('B10 absence claim on an interior', lambda d: (d['asset'].update(role='INTERIOR_RENDER'), o0(d).update(presence='FEATURE_ABSENT_IF_VISIBLE', coverage={'regionCovered': True, 'basis': 'x'})), ASSET, {'ROUTING'}),
        ('B11 presence claim on an interior, status UNRESOLVED', lambda d: (d['asset'].update(role='INTERIOR_RENDER'), o0(d).update(status='UNRESOLVED')), ASSET, {'ROUTING'}),
        ('B12 CROP with an unpublished parent', lambda d: (d['asset'].update(variantSha256='3' * 64, lineage={'op': 'CROP', 'parentSha256': '9' * 64}), [o.update(evidenceVariantSha256='3' * 64) for o in d['observations']]), ASSET, {'EDITION_MIX'}),
        ('B13 edition unknown to the manifest', lambda d: d['asset'].update(editionKey='example:edition-99', lineage={'op': 'DERIVED', 'parentSha256': '9' * 64}), ASSET, {'EDITION_MIX'}),
        ('B15 forbidden token in a key name', lambda d: o0(d).__setitem__('dom w example', 1), ASSET, {'LEAKAGE_TOKEN'}),
        ('B16 caption under a synonym key', lambda d: o0(d).update(altText='Dom w Example - widok'), ASSET, {'SCHEMA_KEY'}),
        ('B17 PROPOSED presence with no visible evidence', lambda d: o0(d).update(visibleEvidence=[]), ASSET, {'OBS'}),
        ('B18 role evidence contradicting the role', lambda d: d['asset']['roleClaims'][1].update(role='INTERIOR_RENDER'), ASSET, {'ROLE'}),
        ('B19 decoded size not that of the bytes', lambda d: d['asset'].update(decoded={'width': 99999, 'height': 99999}), ASSET, {'IDENTITY'}),
        ('S1 one lineage group relabelled as two witnesses', lambda s: (s['hypotheses'][0]['support'][1].update(lineageGroup='lineage-2'), s['hypotheses'][0].update(independentWitnesses=2)), SUMMARY, {'CORRELATION'}),
        ('S2 canonicalUrl of another edition', lambda s: s.update(canonicalUrl='https://example.invalid/projects/edition-2'), SUMMARY, {'IDENTITY'}),
        ('S4 negative witness count', lambda s: s['hypotheses'][0].update(independentWitnesses=-1), SUMMARY, {'CORRELATION'}),
        ('S5 PROPOSED hypothesis with no support', lambda s: s['hypotheses'][0].update(support=[], independentWitnesses=0), SUMMARY, {'HYP'}),
        ('S6 presence key not in the summary contract', lambda s: s['hypotheses'][0].update(presence='FEATURE_ABSENT_IF_VISIBLE'), SUMMARY, {'SCHEMA_KEY'}),
        ('S7 witness count given as a boolean', lambda s: s['hypotheses'][0].update(independentWitnesses=True), SUMMARY, {'CORRELATION'}),
        ('S8 identity across images asserted', lambda s: s['hypotheses'][0].update(structureIdentityAcrossImages='ESTABLISHED'), SUMMARY, {'HYP'}),
    ]

    def test_every_bypass_rejected(self):
        for name, f, base, expect in self.CASES:
            got = codes(mut(f, base), forbidden=['dom w example'])
            self.assertTrue(got & expect, f'{name}: got {sorted(got)}, expected one of {sorted(expect)}')

    def test_slug_in_list_value(self):
        self.assertIn('LEAKAGE_TOKEN', codes(mut(lambda d: o0(d).__setitem__('visibleEvidence', ['as in dom w example'])), forbidden=['dom w example']))


if __name__ == '__main__':
    r = unittest.main(exit=False, verbosity=1).result
    sys.exit(0 if r.wasSuccessful() else 1)
