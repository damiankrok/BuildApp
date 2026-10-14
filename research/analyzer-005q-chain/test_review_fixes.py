#!/usr/bin/env python3
"""test_review_fixes.py - BUILDPLAN-ANALYZER-005Q-CHAIN negative tests for the post-review scorer and gate corrections
(addendum C). One test per fixed P0/P1: each builds the smallest synthetic input that the first-scored code got wrong and
asserts the corrected code catches it. Synthetic numbers only — no row, sheet, truth file or publisher figure.

  python3 -I research/analyzer-005q-chain/test_review_fixes.py
"""
import json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score_labels as SL  # noqa: E402
import score_houses as SH  # noqa: E402
import gates as G  # noqa: E402

FID = 'frame-synthetic'


def box(x0, y0, x1, y1):
    return {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1}


def metrics(segments, evidence=(), regs=(), tokens=(), lattices=(), chain_axis='HORIZONTAL', baseline=100.0):
    return {
        'ocrTokens': list(tokens), 'numericLattices': list(lattices), 'evidence': list(evidence), 'unresolved': [],
        'chains': [{'id': 'chain-1', 'frameId': FID, 'axis': chain_axis, 'baselinePx': baseline, 'segments': list(segments)}],
        'coordinateRegistrations': list(regs), 'dimensionTopology': [], 'metricSolutions': [],
    }


def label(value, x0=140.0, bt=None):
    return {'value': value, 'truth': value, 'axis': 'HORIZONTAL', 'box': box(x0, 90, x0 + 20, 98), 'bindingTruth': bt or {'status': 'NO_LINE_TRUTH'}}


def statement_case(value_cm, from_px, to_px, bt=None):
    tok = {'id': 'tok-1', 'frameId': FID, 'box': box(140, 90, 160, 98), 'orientation': 'HORIZONTAL', 'text': str(value_cm)}
    lat = {'frameId': FID, 'box': tok['box'], 'orientation': 'HORIZONTAL', 'ensemble': {'asRead': str(value_cm), 'ocrClass': 'CLEAR'}}
    ev = {'id': 'ev-1', 'frameId': FID, 'kind': 'LINEAR_DIMENSION', 'origin': 'READ', 'value': value_cm, 'ocrTokenIds': ['tok-1']}
    seg = {'index': 0, 'fromPx': from_px, 'toPx': to_px, 'evidenceId': 'ev-1', 'origin': 'READ', 'valueCm': value_cm}
    return metrics([seg], [ev], tokens=[tok], lattices=[lat]), [label(str(value_cm), bt=bt)]


class LabelScorer(unittest.TestCase):
    def test_B01_false_scale_on_the_Y_axis_is_caught(self):
        # X exact, Y 5 % off TRUE_SCALE at confidence 0.66: the first-scored X-only test passed it
        reg = {'frameId': FID, 'metresPerPixelX': 0.02, 'metresPerPixelY': 0.021, 'confidence': 0.66, 'anchors': []}
        _, frame = SL.score_sheet({'frameId': FID}, metrics([], regs=[reg]), [], 2.0)
        self.assertFalse(frame['falseConfidentScaleXOnly'])
        self.assertTrue(frame['falseConfidentScale'])

    def test_B01_anisotropy_without_true_scale_is_flagged(self):
        reg = {'frameId': FID, 'metresPerPixelX': 0.02, 'metresPerPixelY': 0.0228, 'confidence': 0.7, 'anchors': []}
        _, frame = SL.score_sheet({'frameId': FID}, metrics([], regs=[reg]), [], None)
        self.assertTrue(frame['anisotropicConfidentScale'])

    def test_B02_unverified_binding_is_not_counted_as_verified_and_a_wrong_span_is_audited(self):
        # value 300 cm printed right, stated on a 60 px span of a 2 cm/px sheet (ratio 2.5): no binding truth
        m, dims = statement_case(300, 120.0, 180.0)
        rows, _ = SL.score_sheet({'frameId': FID}, m, dims, 2.0)
        r = rows[0]
        self.assertTrue(r['correctPrintedBound'])  # the first-scored column, kept
        self.assertFalse(r['correctPrintedBoundVerified'])
        self.assertTrue(r['correctPrintedBoundUnverified'])
        self.assertTrue(r['spanImplausible'])
        self.assertTrue(r['spuriousCertaintyWithSpanAudit'])
        self.assertFalse(r['spuriousCertainty'])

    def test_B03_a_questionable_binding_truth_is_excluded(self):
        # the truth segment is 30 px for a 300 cm label on a 2 cm/px sheet (ratio 5): questionable
        bt = {'status': 'TRUTH', 'segment': {'axis': 'HORIZONTAL', 'baselinePx': 100.0, 'fromPx': 130.0, 'toPx': 160.0}}
        m, dims = statement_case(300, 0.0, 150.0, bt=bt)
        rows, _ = SL.score_sheet({'frameId': FID}, m, dims, 2.0)
        self.assertEqual(rows[0]['binding'], 'WRONG')
        self.assertTrue(rows[0]['bindingTruthQuestionable'])

    def test_B08_a_labelled_unresolved_segment_is_an_abstention(self):
        seg = {'index': 0, 'fromPx': 120.0, 'toPx': 180.0, 'labelled': True, 'confidence': 0}
        tok = {'id': 'tok-1', 'frameId': FID, 'box': box(140, 90, 160, 98), 'orientation': 'HORIZONTAL', 'text': '300'}
        rows, _ = SL.score_sheet({'frameId': FID}, metrics([seg], tokens=[tok]), [label('300')], 2.0)
        self.assertIsNone(rows[0]['statement'])
        self.assertTrue(rows[0]['abstention'])


class HouseScorerAndGates(unittest.TestCase):
    def test_B05_one_ink_stated_on_two_segments_is_counted(self):
        ev = [{'id': f'ev-{i}', 'frameId': FID, 'kind': 'LINEAR_DIMENSION', 'origin': 'READ', 'value': 370, 'ocrTokenIds': ['tok-1']} for i in (1, 2)]
        segs = [{'index': 0, 'fromPx': 0.0, 'toPx': 73.0, 'evidenceId': 'ev-1'}, {'index': 1, 'fromPx': 73.0, 'toPx': 120.0, 'evidenceId': 'ev-2'}]
        tok = {'id': 'tok-1', 'frameId': FID, 'box': box(60, 90, 80, 98), 'orientation': 'HORIZONTAL'}
        self.assertEqual(SH.evidence_gates(metrics(segs, ev, tokens=[tok]))['multiAssertedTokens'], 1)

    def _row(self, case, **kw):
        r = {'case': case, 'mode': 'EXTRACT', 'outcome': 'COMPLETED', 'code': None, 'verdict': 'FAIL', 'decisionPath': {}, 'semantics': {},
             'footprintResidualPct': 1.0, 'evidenceGates': {'scaleDependentAnchors': 0, 'scaleOrientedAnchors': 0, 'inkFirstMismatch': 0, 'multiAssertedTokens': 0},
             'model': {'storeys': 1, 'evidenceStatus': {'wallRings:SOURCE_EXACT': 1}, 'sourceExact': {'wallRings:ring-0': '6.48 x 3.70 m'}}}
        r.update(kw)
        return r

    def test_A1_a_changed_SOURCE_EXACT_with_the_same_count_fails_G2d(self):
        base = {'label': 'C0', 'rows': [self._row('row-x')]}
        var = {'label': 'X', 'rows': [self._row('row-x', model={'storeys': 1, 'evidenceStatus': {'wallRings:SOURCE_EXACT': 1}, 'sourceExact': {'wallRings:ring-0': '12.04 x 3.70 m'}})]}
        out = G.evaluate(base, var)
        self.assertEqual(out['G2']['d_sourceExactIncrease'], [])  # the first-scored count could not see it
        self.assertEqual(len(out['G2']['d_sourceExactChanged']), 1)
        self.assertFalse(out['G2']['pass'])

    def test_B05_gate_fails_on_a_new_multi_asserted_token(self):
        base = {'label': 'C0', 'rows': [self._row('row-x')]}
        eg = {'scaleDependentAnchors': 0, 'scaleOrientedAnchors': 0, 'inkFirstMismatch': 0, 'multiAssertedTokens': 1}
        out = G.evaluate(base, {'label': 'X', 'rows': [self._row('row-x', evidenceGates=eg)]})
        self.assertEqual(out['G2']['b2_multiAssertedTokens'], {'row-x': [0, 1]})
        self.assertFalse(out['G2']['pass'])

    def test_A5_scale_oriented_anchors_fail_G2_for_an_orientation_variant(self):
        base = {'label': 'C0', 'rows': [self._row('row-x')]}
        eg = {'scaleDependentAnchors': 0, 'scaleOrientedAnchors': 2, 'inkFirstMismatch': 0, 'multiAssertedTokens': 0}
        self.assertFalse(G.evaluate(base, {'label': 'C3', 'rows': [self._row('row-x', evidenceGates=eg)]})['G2']['pass'])
        self.assertTrue(G.evaluate(base, {'label': 'C1', 'rows': [self._row('row-x', evidenceGates=eg)]})['G2']['pass'])

    def test_B01_gate_counts_a_Y_axis_false_scale_new_against_C0(self):
        base = {'label': 'C0', 'rows': [self._row('row-x')]}
        sheet = lambda f: {'sheet': 'S-syn', 'frame': {'trueScale005O': 2.0, **f}}  # noqa: E731
        labels = {'sheets': [sheet({'falseConfidentScale': True, 'falseConfidentScaleXOnly': False, 'registrationErrVsTrueScaleY': 0.05})],
                  'baseline': {'sheets': [sheet({'falseConfidentScale': False})]}}
        out = G.evaluate(base, {'label': 'X', 'rows': [self._row('row-x')]}, labels)
        self.assertEqual([c.get('sheet') for c in out['G2']['c_newFalseConfident']], ['S-syn'])
        self.assertEqual(out['G2']['c_xOnlyFirstScored'], [])

    def test_C1_a_published_area_refusal_is_named(self):
        work = tempfile.mkdtemp(prefix='t005qc-')
        base = {'label': 'C0', 'rows': [self._row('row-x', gateBlocking=None)]}
        var = {'label': 'X', 'rows': [self._row('row-x', outcome='FAILED', gateBlocking='FOOTPRINT_AREA_WRONG')]}
        json.dump(base, open(os.path.join(work, 'score-C0.json'), 'w'))
        json.dump(var, open(os.path.join(work, 'score-X.json'), 'w'))
        json.dump(G.evaluate(base, var), open(os.path.join(work, 'gates-X.json'), 'w'))
        out = os.path.join(work, 'g5.json')
        subprocess.run([sys.executable, '-I', os.path.join(HERE, 'explain_g5.py'), '--work', work, '--labels', 'X', '--out', out], check=True, capture_output=True)
        self.assertEqual(json.load(open(out))['variants']['X'][0]['mechanism'], 'PUBLISHED_AREA_REFUSAL')


if __name__ == '__main__':
    unittest.main(verbosity=2)
