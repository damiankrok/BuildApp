# v3.46 counter-probes of the scoring METHOD (test v3.46 §9): synthetic inputs with an independent truth, no house and no
# EVAL answer. Each probe states what a wrong prediction must do to the score; each has its opposite (the right
# prediction must pass), so a scorer that fails everything does not pass the suite. Where the v3.45 scorer is fooled,
# the test runs it too and asserts that it was (the audit's two findings, reproduced), so the gap is documented in code.
#
# run: python3 -m unittest -v research/reading-v346/scoring/test_counterprobes.py
import json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import score_callouts_v2 as C  # noqa: E402
import score_section_signs as L  # noqa: E402
import score_views_v2 as V  # noqa: E402

V345 = os.path.join(HERE, '..', '..', 'reading-v345', 'scoring')


# ---------------------------------------------------------------- callouts
def ref(text, ring, gap, wall='TOP', kind='WINDOW'):
    return {'text': text, 'ring': list(ring), 'wall': wall, 'gap': list(gap), 'kind': kind}


def reading(eid, ring, text):
    w, h = (int(v) for v in text.split('/'))
    return {'id': eid, 'cx': ring[0], 'cy': ring[1], 'raw': text, 'w': w, 'h': h}


def gap(gid, x0, x1, bound=None, family='WINDOW', y=(50, 64)):
    return {'id': gid, 'x0': x0, 'x1': x1, 'y0': y[0], 'y1': y[1], 'family': family, 'bound': bound}


def bind(eid, text):
    w, h = (int(v) for v in text.split('/'))
    return {'evidenceId': eid, 'widthCm': w, 'heightCm': h}


TWO = [ref('100/210', (120, 30), (100, 140), kind='DOOR'), ref('100/210', (220, 30), (200, 240), kind='DOOR')]
READS = [reading('c1', (120, 30), '100/210'), reading('c2', (220, 30), '100/210')]


class CalloutProbes(unittest.TestCase):
    def results(self, refs, reads, gaps):
        rows, adds = C.score_project(refs, reads, gaps)
        return [r['result'] for r in rows], adds

    def test_two_openings_right(self):
        res, adds = self.results(TWO, READS, [gap('g1', 100, 140, bind('c1', '100/210'), 'DOOR'), gap('g2', 200, 240, bind('c2', '100/210'), 'DOOR')])
        self.assertEqual(res, ['OK', 'OK'])
        self.assertEqual(adds, [])

    def test_one_merged_gap_never_passes_two(self):
        res, _ = self.results(TWO, READS, [gap('g', 100, 240, bind('c1', '100/210'), 'DOOR')])
        self.assertEqual(res, ['MERGED_GAP', 'MERGED_GAP'])

    def test_split_gap(self):
        res, _ = self.results(TWO[:1], READS[:1], [gap('a', 100, 118, None, 'DOOR'), gap('b', 122, 140, bind('c1', '100/210'), 'DOOR')])
        self.assertEqual(res, ['SPLIT_GAP'])

    def test_right_number_on_neighbouring_host(self):
        refs = [ref('100/210', (120, 30), (100, 140), kind='DOOR'), ref('150/210', (240, 30), (210, 270), kind='DOOR')]
        reads = [reading('c1', (120, 30), '100/210'), reading('c2', (240, 30), '150/210')]
        swapped = [gap('g1', 100, 140, bind('c2', '150/210'), 'DOOR'), gap('g2', 210, 270, bind('c1', '100/210'), 'DOOR')]
        self.assertEqual(self.results(refs, reads, swapped)[0], ['WRONG_BINDING', 'WRONG_BINDING'])
        right = [gap('g1', 100, 140, bind('c1', '100/210'), 'DOOR'), gap('g2', 210, 270, bind('c2', '150/210'), 'DOOR')]
        self.assertEqual(self.results(refs, reads, right)[0], ['OK', 'OK'])

    def test_same_digits_from_the_other_ring(self):
        # identical callouts, bound crosswise: the digits are right, the objects are not
        crossed = [gap('g1', 100, 140, bind('c2', '100/210'), 'DOOR'), gap('g2', 200, 240, bind('c1', '100/210'), 'DOOR')]
        self.assertEqual(self.results(TWO, READS, crossed)[0], ['WRONG_BINDING', 'WRONG_BINDING'])

    def test_one_callout_bound_to_two_gaps(self):
        both = [gap('g1', 100, 140, bind('c2', '100/210'), 'DOOR'), gap('g2', 200, 240, bind('c2', '100/210'), 'DOOR')]
        self.assertEqual(self.results(TWO, READS, both)[0], ['WRONG_BINDING', 'OK'])

    def test_two_readings_on_one_ring_are_a_conflict(self):
        rows, _ = C.score_project(TWO[:1], [reading('a', (120, 30), '100/210'), reading('b', (121, 31), '160/210')], [gap('g1', 100, 140, bind('a', '100/210'), 'DOOR')])
        self.assertTrue(rows[0]['ringConflict'])
        self.assertFalse(rows[0]['digits'])

    def test_gap_on_the_other_wall_is_not_the_opening(self):
        res, _ = self.results(TWO[:1], READS[:1], [{'id': 'v', 'x0': 112, 'x1': 126, 'y0': 0, 'y1': 60, 'family': 'DOOR', 'bound': bind('c1', '100/210')}])
        self.assertEqual(res, ['MISSING_OPENING'])

    def test_no_model_and_missing_run_stay_in_the_denominator(self):
        rows, _ = C.score_project(TWO, READS, None)
        self.assertEqual([r['result'] for r in rows], ['NO_MODEL', 'NO_MODEL'])
        self.assertTrue(all(r['digits'] for r in rows))

    def test_v345_scorer_passes_the_merged_gap(self):
        """Audit 1321 probe A reproduced: the historical scorer gives 2/2 OK to one gap spanning two openings."""
        with tempfile.TemporaryDirectory() as d:
            h = 'synthetic-merged'
            sha = 'f' * 64
            for sub in ('runs', 'traces'):
                os.makedirs(os.path.join(d, sub, h))
            json.dump({'projects': [{'project': h, 'blind': True, 'callouts': TWO}]}, open(os.path.join(d, 'c.json'), 'w'))
            json.dump({'rows': [{'project': h, 'sha256': sha, 'view': {'class': 'FLOOR_PLAN', 'storey': 'GROUND'}}]}, open(os.path.join(d, 'v.json'), 'w'))
            json.dump({'coordinateFrames': [{'id': 'f0', 'variantByteHash': sha, 'size': {'width': 853, 'height': 853}}]}, open(os.path.join(d, 'runs', h, 'observation-graph.json'), 'w'))
            ev = [{'kind': 'OPENING_CALLOUT', 'id': k['id'], 'frameId': 'f0', 'value': 100, 'rawText': '100/210', 'textBox': {'x0': k['cx'] - 8, 'x1': k['cx'] + 8, 'y0': k['cy'] - 6, 'y1': k['cy'] + 6}} for k in READS]
            json.dump({'evidence': ev}, open(os.path.join(d, 'runs', h, 'metric-evidence.json'), 'w'))
            json.dump([{'kind': 'OPENING_GAP', 'storey': 0, 'frameId': 'f0', 'id': 'g', 'pixelRect': {'x0': 100, 'x1': 240, 'y0': 50, 'y1': 64}, 'family': 'DOOR', 'callout': bind('c1', '100/210')}],
                      open(os.path.join(d, 'traces', h, 'feature-trace.json'), 'w'))
            out = os.path.join(d, 'o.json')
            subprocess.run([sys.executable, os.path.join(V345, 'score_callouts.py'), os.path.join(d, 'c.json'), os.path.join(d, 'v.json'), os.path.join(d, 'runs'), os.path.join(d, 'traces'), out], check=True, capture_output=True)
            old = json.load(open(out))
            self.assertEqual([r['result'] for r in old['projects'][0]['rows']], ['OK', 'OK'])
            self.assertEqual({r['opening'] for r in old['projects'][0]['rows']}, {'g'})
            out2 = os.path.join(d, 'o2.json')
            subprocess.run([sys.executable, os.path.join(HERE, 'score_callouts_v2.py'), os.path.join(d, 'c.json'), os.path.join(d, 'v.json'), os.path.join(d, 'runs'), os.path.join(d, 'traces'), out2], check=True, capture_output=True)
            new = json.load(open(out2))
            self.assertEqual([r['result'] for r in new['projects'][0]['rows']], ['MERGED_GAP', 'MERGED_GAP'])


# ---------------------------------------------------------------- section signs
SIGNS = [
    {'value': 0.0, 'kind': 'F', 'group': 'LEVEL', 'x': 100, 'y': 500, 'raw': '±0,00'},
    {'value': 3.0, 'kind': 'E', 'group': 'LEVEL', 'x': 100, 'y': 300, 'raw': '+3,00'},
    {'value': 8.0, 'kind': 'R', 'group': 'LEVEL', 'x': 300, 'y': 50, 'raw': '+8,00'},
]


def lev(eid, sign, value, raw, origin='READ', kind='LEVEL_DATUM'):
    return {'id': eid, 'kind': kind, 'value': value, 'rawText': raw, 'origin': origin, 'unit': 'm',
            'textBox': {'x0': sign['x'] - 25, 'x1': sign['x'] + 25, 'y0': sign['y'] - 10, 'y1': sign['y'] + 10}}


def reads(rows):
    return [r['read'] for r in rows]


class SignProbes(unittest.TestCase):
    def test_right_readings_pass(self):
        rows, adds = L.score_project(SIGNS, [lev('a', SIGNS[0], 0.0, '±0,00'), lev('b', SIGNS[1], 3.0, '+3,00'), lev('c', SIGNS[2], 8.0, '+8,00')], [], [0.0], {'ridgeY': 8.0, 'terrainY': -0.3})
        self.assertEqual(reads(rows), [True, True, True])
        self.assertTrue(all(r['rawExact'] for r in rows))
        self.assertEqual(adds, [])

    def test_values_swapped_between_marks_fail(self):
        # floor 0 / eaves 3 / ridge 8, each place carrying another mark's value and a wrong raw text
        rows, _ = L.score_project(SIGNS, [lev('a', SIGNS[0], 3.0, '+3.0O'), lev('b', SIGNS[1], 8.0, '+8.0O'), lev('c', SIGNS[2], 0.0, '0.0O')], [], [0.0], {})
        self.assertEqual(reads(rows), [False, False, False])
        self.assertFalse(any(r['rawExact'] for r in rows))

    def test_eaves_and_ridge_swapped_fail_in_their_kinds(self):
        rows, _ = L.score_project(SIGNS, [lev('a', SIGNS[0], 0.0, '±0,00'), lev('b', SIGNS[1], 8.0, '+8,00'), lev('c', SIGNS[2], 3.0, '+3,00')], [], [0.0], {'ridgeY': 3.0})
        by = {r['kind']: r for r in rows}
        self.assertTrue(by['F']['read'])
        self.assertFalse(by['E']['read'])
        self.assertFalse(by['R']['read'])
        self.assertEqual(by['R']['modelRole'], 'WRONG')

    def test_raw_misread_corrected_by_the_drawing_is_reported_apart(self):
        rows, _ = L.score_project(SIGNS[1:2], [lev('b', SIGNS[1], 3.0, '+5,00', origin='CHAIN_CORRECTED')], [], [], {})
        self.assertFalse(rows[0]['rawExact'])
        self.assertFalse(rows[0]['rawValue'])
        self.assertTrue(rows[0]['valueOk'])

    def test_derived_value_is_not_a_reading(self):
        rows, _ = L.score_project(SIGNS[1:2], [lev('b', SIGNS[1], 3.0, None, origin='DERIVED')], [], [], {})
        self.assertTrue(rows[0]['valueOk'])
        self.assertFalse(rows[0]['read'])

    def test_two_claims_on_one_sign_are_a_conflict(self):
        rows, adds = L.score_project(SIGNS[2:], [lev('c', SIGNS[2], 8.0, '+8,00'), lev('d', SIGNS[2], 52, '52', kind='LINEAR_DIMENSION')], [], [], {})
        self.assertTrue(rows[0]['conflict'])
        self.assertFalse(rows[0]['read'])
        self.assertEqual(adds, [])

    def test_a_reading_elsewhere_is_an_addition_not_a_pass(self):
        far = dict(SIGNS[1], x=600, y=600)
        rows, adds = L.score_project(SIGNS[1:2], [lev('x', far, 3.0, '+3,00')], [], [], {})
        self.assertFalse(rows[0]['located'])
        self.assertEqual(len(adds), 1)

    def test_v345_scorer_passes_the_swap(self):
        """Audit 1321 probe B reproduced: the historical scorer gives 3/3 to values swapped between marks."""
        with tempfile.TemporaryDirectory() as d:
            h, sha = 'synthetic-swap', 'e' * 64
            os.makedirs(os.path.join(d, 'runs', h))
            open(os.path.join(d, 'l.txt'), 'w').write(f'{h} +8.00:R +3.00:E 0.00:F\n')
            json.dump({'rows': [{'project': h, 'sha256': sha, 'view': {'class': 'TECHNICAL_SECTION'}}]}, open(os.path.join(d, 'v.json'), 'w'))
            ev = [dict(lev('a', SIGNS[0], 3.0, '+3.0O'), variantByteHash=sha), dict(lev('b', SIGNS[1], 8.0, '+8.0O'), variantByteHash=sha), dict(lev('c', SIGNS[2], 0.0, '0.0O'), variantByteHash=sha)]
            json.dump({'evidence': ev, 'ocrTokens': []}, open(os.path.join(d, 'runs', h, 'metric-evidence.json'), 'w'))
            out = os.path.join(d, 'o.json')
            subprocess.run([sys.executable, os.path.join(V345, 'score_levels.py'), os.path.join(d, 'l.txt'), os.path.join(d, 'v.json'), os.path.join(d, 'runs'), out], check=True, capture_output=True)
            old = json.load(open(out))
            self.assertEqual(sum(r['read'] for r in old['projects'][0]['items']), 3)


# ---------------------------------------------------------------- views
def vrow(cls, side=None, sha='a'):
    return {'project': 'p', 'sha256': sha, 'view': {'class': cls, 'storey': None, 'side': side}}


def vrun(frames, sheets):
    return {'p': {'graph': {'coordinateFrames': frames}, 'sheets': sheets}}


class ViewProbes(unittest.TestCase):
    def test_left_right_swap_fails_exact_side_but_not_coarse(self):
        rows = [vrow('ORTHOGRAPHIC_ELEVATION', 'LEFT', 'a'), vrow('ORTHOGRAPHIC_ELEVATION', 'RIGHT', 'b')]
        frames = [{'variantByteHash': s, 'roles': {'document': 'ELEVATION', 'view': 'SIDE_UNSPECIFIED'}} for s in 'ab']
        right = V.score(rows, vrun(frames, {'a': {'side': 'LEFT', 'content': {'top': 'ELEVATION'}}, 'b': {'side': 'RIGHT', 'content': {'top': 'ELEVATION'}}}))
        swap = V.score(rows, vrun(frames, {'a': {'side': 'RIGHT', 'content': {'top': 'ELEVATION'}}, 'b': {'side': 'LEFT', 'content': {'top': 'ELEVATION'}}}))
        self.assertEqual((right['side']['exactOk'], right['side']['exactN']), (2, 2))
        self.assertEqual((swap['side']['exactOk'], swap['side']['exactN']), (0, 2))
        self.assertEqual(swap['side']['coarseOk'], 2)

    def test_side_only_reference_does_not_score_left_right(self):
        o = V.score([vrow('ORTHOGRAPHIC_ELEVATION', 'SIDE')], vrun([{'variantByteHash': 'a', 'roles': {'document': 'ELEVATION', 'view': 'SIDE_UNSPECIFIED'}}], {'a': {'side': 'LEFT'}}))
        self.assertEqual(o['side'].get('exactN', 0), 0)
        self.assertEqual(o['side']['exactNotMeasured'], 1)

    def test_missing_run_and_unclassified_stay_in_the_denominator(self):
        rows = [vrow('FLOOR_PLAN', sha='a'), {'project': 'q', 'sha256': 'b', 'view': {'class': 'FLOOR_PLAN', 'storey': None, 'side': None}}]
        o = V.score(rows, vrun([{'variantByteHash': 'a', 'roles': {'document': 'FLOOR_PLAN'}}], None))
        self.assertEqual(o['graph']['confusion']['FLOOR_PLAN'], {'FLOOR_PLAN': 1, 'MISSING_RUN': 1})
        self.assertEqual(o['pixels']['coverage'], {'NO_SUMMARY': 2})


if __name__ == '__main__':
    unittest.main()
