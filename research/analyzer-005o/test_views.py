#!/usr/bin/env python3
"""test_views.py - BUILDPLAN-ANALYZER-005O: the challenger view generator against a logic-level adversarial corpus.

  python3 -I research/analyzer-005o/test_views.py            # the corpus, then every mutation must be caught

Synthetic metric evidence (no pixel, no house): one statement or one small chain set per case, each built to test
one rule of preregistration.md section 3 / 7 with its expected outcome written here, before the run:

  contested label (lattice CLEAR vs corroborating external), LEADS promotion, missing candidate (no conjured value),
  segment sum with exactly one / two restoring substitutions, missing overall, misaligned parallel chain, contradicting
  axes (isotropy contest), two readers agreeing on one crop (no added support), two frames (no cross-frame leakage),
  an inverted leading-zero reading, an empty sheet.

Then the deliberately broken generators (section 7) are run against the same corpus; each must fail at least one case.
"""
import copy, os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import as_printed_views as V  # noqa: E402

F = 'frame-A'


def box(i):
    return {'x0': 10 * i, 'x1': 10 * i + 8, 'y0': 0, 'y1': 6}


class Sheet:
    """A tiny metric evidence set built statement by statement."""

    def __init__(self):
        self.m = {'evidence': [], 'ocrTokens': [], 'numericLattices': [], 'chains': [], 'chainRelations': []}
        self.n = 0

    def chain(self, cid, axis, segs, frame=F):
        """segs: [(fromPx, toPx, statement-dict-or-None)]"""
        out = []
        for i, (a, b, st) in enumerate(segs):
            seg = {'index': i, 'fromPx': a, 'toPx': b, 'pixelLength': b - a}
            if st is not None:
                seg['evidenceId'] = self.statement(cid, frame, **st)
            out.append(seg)
        self.m['chains'].append({'id': cid, 'frameId': frame, 'axis': 'HORIZONTAL' if axis == 'X' else 'VERTICAL', 'segments': out})

    def statement(self, cid, frame, token, value=None, origin='CHAIN_CORRECTED', alts=(), lattice=None):
        self.n += 1
        eid, tid = f'ev-{self.n}', f'tok-{self.n}'
        b = box(self.n)
        self.m['ocrTokens'].append({'id': tid, 'frameId': frame, 'box': b, 'orientation': 'HORIZONTAL', 'text': token})
        self.m['evidence'].append({'id': eid, 'kind': 'LINEAR_DIMENSION', 'frameId': frame, 'unit': 'cm', 'origin': origin, 'value': value if value is not None else (int(token) if token.isdigit() else 0),
                                   'rawText': token, 'ocrTokenIds': [tid], 'alternatives': [{'value': x} for x in alts], 'chainId': cid})
        if lattice:
            self.m['numericLattices'].append({'frameId': frame, 'box': b, 'orientation': 'HORIZONTAL', **lattice})
        return eid


def lat(as_read, cls, decision=None, ext=None, rival=None, paths=()):
    d = {'asRead': str(as_read), 'asReadValueCm': as_read, 'ocrClass': cls, 'paths': [{'text': str(p)} for p in paths]}
    if decision:
        d['external'] = {'topK': [{'text': str(ext), 'p': 0.999}]}
        d['ensemble'] = {'decision': decision, 'external': {'text': str(ext), 'valueCm': ext}, 'lattice': {'ocrClass': cls}, **({'rival': rival} if rival else {})}
    return d


def views(m, variant, reread=None):
    view, records = V.build(copy.deepcopy(m), variant, reread or {})
    by = {r['evidenceId']: r for r in records if 'evidenceId' in r}
    return view, by


class Corpus(unittest.TestCase):
    def test_contested_label_abstains_and_is_never_promoted(self):
        s = Sheet()
        s.chain('c1', 'X', [(0, 206, {'token': '501', 'value': 541, 'lattice': lat(501, 'CLEAR', 'CONTESTS', 541, {'text': '541', 'valueCm': 541, 'witness': 'EXTERNAL'})})])
        for v in ('M1', 'M3', 'M1P'):
            view, by = views(s.m, v)
            self.assertEqual(view['ev-1'], {'zero': [], 'asRead': []}, v)
        _, by = views(s.m, 'M2')
        self.assertEqual(by['ev-1']['rule'], 'FROZEN')  # M2 has no external reader: 541 is not among its candidates

    def test_leads_is_promoted_only_by_the_exploratory_variant(self):
        s = Sheet()
        s.chain('c1', 'Y', [(0, 333, {'token': '810', 'value': 870, 'lattice': lat(810, 'AMBIGUOUS', 'LEADS', 870, {'text': '810', 'valueCm': 810, 'witness': 'LATTICE'})})])
        self.assertEqual(views(s.m, 'M1')[0]['ev-1'], {'zero': [], 'asRead': []})
        self.assertEqual(views(s.m, 'M1P')[0]['ev-1'], {'zero': [870], 'asRead': [870]})

    def test_missing_candidate_is_never_conjured(self):
        s = Sheet()
        s.chain('c1', 'X', [(0, 206, {'token': '501', 'value': 541, 'alts': (301, 101)})])
        for v in ('M1', 'M2', 'M3', 'M1P'):
            view, by = views(s.m, v)
            self.assertNotIn('ev-1', view, v)  # frozen behaviour: 501 as printed, nothing else
            self.assertEqual(by['ev-1']['frozen']['asRead'], [501])
            self.assertNotIn(541, by['ev-1']['zero'] + by['ev-1']['asRead'])

    def test_external_stripped_keeps_refusing(self):
        s = Sheet()
        s.chain('c1', 'X', [(0, 206, {'token': '501', 'value': 541, 'lattice': lat(501, 'CLEAR', 'CONTESTS', 541, {'text': '541', 'valueCm': 541, 'witness': 'EXTERNAL'})})])
        m = copy.deepcopy(s.m)
        for l in m['numericLattices']:
            l.pop('external'), l.pop('ensemble')
        view, by = views(m, 'M3')
        self.assertNotIn('ev-1', view)
        self.assertEqual(by['ev-1']['asRead'], [501])

    def _sum_sheet(self, alts_c=(250,), alts_b=()):
        s = Sheet()
        s.chain('A', 'X', [(0, 400, {'token': '1000', 'origin': 'READ'})])
        s.chain('B', 'X', [(0, 160, {'token': '400', 'origin': 'READ'}), (160, 300, {'token': '350', 'origin': 'READ', 'alts': alts_b}), (300, 400, {'token': '205', 'origin': 'READ', 'alts': alts_c})])
        return s

    def test_one_restoring_substitution_resolves_scale_free(self):
        view, by = views(self._sum_sheet().m, 'M2')
        self.assertEqual(view['ev-4'], {'zero': [250], 'asRead': [250]})
        self.assertEqual(by['ev-4']['rule'], 'RESOLVED')
        self.assertNotIn('ev-1', view)

    def test_two_restoring_substitutions_abstain(self):
        view, by = views(self._sum_sheet(alts_c=(250,), alts_b=(395,)).m, 'M2')
        for e in ('ev-1', 'ev-2', 'ev-3', 'ev-4'):
            self.assertEqual(view[e], {'zero': [], 'asRead': []}, e)

    def test_holding_sum_changes_nothing(self):
        s = Sheet()
        s.chain('A', 'X', [(0, 400, {'token': '1000', 'origin': 'READ'})])
        s.chain('B', 'X', [(0, 160, {'token': '400', 'origin': 'READ'}), (160, 300, {'token': '350', 'origin': 'READ'}), (300, 400, {'token': '250', 'origin': 'READ', 'alts': (205,)})])
        self.assertEqual(views(s.m, 'M2')[0], {})

    def test_missing_overall_forms_no_equation(self):
        s = Sheet()
        s.chain('B', 'X', [(0, 160, {'token': '400', 'origin': 'READ'}), (160, 300, {'token': '350', 'origin': 'READ'}), (300, 400, {'token': '205', 'origin': 'READ', 'alts': (250,)})])
        self.assertEqual(views(s.m, 'M2')[0], {})

    def test_misaligned_parallel_chain_forms_no_equation(self):
        s = Sheet()
        s.chain('A', 'X', [(0, 400, {'token': '1000', 'origin': 'READ'})])
        s.chain('B', 'X', [(40, 200, {'token': '400', 'origin': 'READ'}), (200, 340, {'token': '350', 'origin': 'READ'}), (340, 440, {'token': '205', 'origin': 'READ', 'alts': (250,)})])
        self.assertEqual(views(s.m, 'M2')[0], {})

    def test_contradicting_axes_contest_without_promotion(self):
        s = Sheet()
        s.chain('X1', 'X', [(0, 400, {'token': '1000', 'origin': 'READ'})])
        s.chain('X2', 'X', [(0, 320, {'token': '800', 'origin': 'READ'})])
        s.chain('Y1', 'Y', [(0, 300, {'token': '900', 'origin': 'READ', 'alts': (750,)})])
        view, by = views(s.m, 'M2')
        self.assertEqual(view.get('ev-3'), {'zero': [], 'asRead': []})
        self.assertNotIn(750, by['ev-3']['asRead'])
        # one other-axis statement is not enough
        s2 = Sheet()
        s2.chain('X1', 'X', [(0, 400, {'token': '1000', 'origin': 'READ'})])
        s2.chain('Y1', 'Y', [(0, 300, {'token': '900', 'origin': 'READ', 'alts': (750,)})])
        self.assertEqual(views(s2.m, 'M2')[0], {})

    def test_two_readers_agreeing_add_no_support(self):
        s = Sheet()
        s.chain('c1', 'X', [(0, 206, {'token': '541', 'origin': 'READ', 'lattice': lat(541, 'CLEAR', 'AGREES', 541)})])
        for v in ('M1', 'M2', 'M3', 'M1P'):
            view, by = views(s.m, v)
            self.assertNotIn('ev-1', view, v)
            self.assertEqual(by['ev-1']['rule'], 'FROZEN')

    def test_two_frames_do_not_leak(self):
        s = Sheet()
        s.chain('X1', 'X', [(0, 400, {'token': '1000', 'origin': 'READ'})], frame='frame-B')
        s.chain('X2', 'X', [(0, 320, {'token': '800', 'origin': 'READ'})], frame='frame-B')
        s.chain('Y1', 'Y', [(0, 300, {'token': '900', 'origin': 'READ', 'alts': (750,)})], frame='frame-A')
        self.assertEqual(views(s.m, 'M2')[0], {})

    def test_inverted_leading_zero_states_nothing(self):
        s = Sheet()
        s.chain('c1', 'X', [(0, 100, {'token': '019', 'value': 610})])
        view, by = views(s.m, 'M3')
        self.assertEqual(by['ev-1']['frozen'], {'zero': [], 'asRead': []})

    def test_empty_sheet(self):
        self.assertEqual(views(Sheet().m, 'M3')[0], {})

    def test_reread_only_counts_when_corroborating(self):
        s = Sheet()
        s.chain('c1', 'X', [(0, 206, {'token': '501', 'value': 541})])
        weak = {'ev-1': {'value': 541, 'confident': False, 'stable': True, 'heard': True}}
        strong = {'ev-1': {'value': 541, 'confident': True, 'stable': True, 'heard': True}}
        self.assertNotIn('ev-1', V.build(copy.deepcopy(s.m), 'M1b', weak)[0])
        self.assertEqual(V.build(copy.deepcopy(s.m), 'M1b', strong)[0]['ev-1'], {'zero': [], 'asRead': []})


# ---- deliberately broken generators (preregistration section 7): each must be caught ------------------------------
def mutate_promote_contests():
    orig = V.build

    def build(m, variant, reread):
        view, records = orig(m, variant, reread)
        for r in records:
            if 'evidenceId' in r and r['rule'] == 'ABSTAIN' and r['candidates'].get('EXTERNAL') is not None:
                view[r['evidenceId']] = {'zero': [r['candidates']['EXTERNAL']], 'asRead': [r['candidates']['EXTERNAL']]}
        return view, records
    return 'build', build


def mutate_scale_chosen_substitution():
    def solve(frame, eqs, current, cand_sets, confident_sets, contested, variant):
        out = {}
        for o, segs in eqs:
            for mbr in [o] + segs:
                for c in sorted(cand_sets[mbr['e']['id']]):
                    if abs(c / mbr['px'] - 2.5) <= 0.075 and c != current.get(mbr['e']['id']):
                        out[mbr['e']['id']] = ('RESOLVED', c)
        return out, []
    return 'solve_equations', solve


def mutate_readers_as_witnesses():
    orig = V.build

    def build(m, variant, reread):
        view, records = orig(m, variant, reread)
        for r in records:
            c = r.get('candidates') or {}
            if 'evidenceId' in r and c.get('TOKEN') is not None and c.get('TOKEN') == c.get('LATTICE') == c.get('EXTERNAL'):
                view[r['evidenceId']] = {'zero': [c['TOKEN'], c['TOKEN']], 'asRead': [c['TOKEN'], c['TOKEN']]}
        return view, records
    return 'build', build


def mutate_reads_truth():
    orig = V.candidates

    def candidates(st, reread):
        c = orig(st, reread)
        if st['e']['value'] and st['e']['value'] != c['TOKEN']:  # the "answer" leaks in as if it had been read
            c['EXTERNAL'] = st['e']['value']
        return c
    return 'candidates', candidates


MUTATIONS = {'promote-contests': mutate_promote_contests, 'scale-chosen-substitution': mutate_scale_chosen_substitution, 'readers-as-witnesses': mutate_readers_as_witnesses, 'reads-truth': mutate_reads_truth}


def run(quiet=False):
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Corpus)
    r = unittest.TextTestRunner(stream=open(os.devnull, 'w') if quiet else sys.stderr, verbosity=0 if quiet else 1).run(suite)
    return r.wasSuccessful(), len(r.failures) + len(r.errors), r.testsRun


if __name__ == '__main__':
    ok, bad, n = run()
    print(f'corpus: {n} cases, {"PASS" if ok else f"{bad} FAILED"}')
    caught = {}
    for name, mk in MUTATIONS.items():
        attr, fn = mk()
        saved = getattr(V, attr)
        setattr(V, attr, fn)
        try:
            mok, mbad, _ = run(quiet=True)
        finally:
            setattr(V, attr, saved)
        caught[name] = not mok
        print(f'mutation {name}: {"KILLED" if not mok else "SURVIVED"} ({mbad} cases fail)')
    sys.exit(0 if ok and all(caught.values()) else 1)
