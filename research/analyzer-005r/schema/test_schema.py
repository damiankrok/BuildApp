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


if __name__ == '__main__':
    r = unittest.main(exit=False, verbosity=1).result
    sys.exit(0 if r.wasSuccessful() else 1)
