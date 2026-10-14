#!/usr/bin/env python3
"""test_binding.py - BUILDPLAN-ANALYZER-005Q-OCR deterministic tests of the scorer's geometry (RESEARCH ONLY).

  python3 -I research/analyzer-005q-ocr/test_binding.py

Synthetic boxes and lines only. Covers the rules the brief singles out: two readings of one ink are one witness, a
chain-corrected or scale-picked value never validates the scale, the blind binder never reads a value, and an ambiguous
binding is named, not resolved.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from binding import assign_blind, corroborating, on_line, same_segment, scale_cluster, segment_at, truth_binding  # noqa: E402


def box(cx, cy, w=24, h=12):
    return {'x0': cx - w / 2, 'x1': cx + w / 2, 'y0': cy - h / 2, 'y1': cy + h / 2}


H_LINE = {'id': 'L0', 'axis': 'HORIZONTAL', 'baselinePx': 100, 'ticks': [{'atPx': 0}, {'atPx': 200}, {'atPx': 300}, {'atPx': 500}]}
H_LINE2 = {'id': 'L1', 'axis': 'HORIZONTAL', 'baselinePx': 120, 'ticks': [{'atPx': 0}, {'atPx': 250}, {'atPx': 500}]}


def item(value, cx, cy, axis='HORIZONTAL'):
    b = box(cx, cy)
    return {'value': value, 'box': b, 'axis': axis, 'h': 12}


class Geometry(unittest.TestCase):
    def test_on_line_axis_and_span(self):
        self.assertTrue(on_line(H_LINE, box(100, 92), 'HORIZONTAL', 12))
        self.assertFalse(on_line(H_LINE, box(100, 92), 'VERTICAL', 12))
        self.assertFalse(on_line(H_LINE, box(600, 92), 'HORIZONTAL', 12))
        self.assertFalse(on_line(H_LINE, box(100, 40), 'HORIZONTAL', 12))

    def test_segment_at(self):
        s = segment_at(H_LINE, box(250, 92))
        self.assertEqual((s['fromPx'], s['toPx']), (200, 300))

    def test_corroborating_needs_all_three(self):
        ok = {'top': '541', 'p': 0.999, 'stable': True, 'greedy': {'text': '541', 'meanP': 0.99}}
        self.assertTrue(corroborating(ok))
        self.assertFalse(corroborating({**ok, 'stable': False}))
        self.assertFalse(corroborating({**ok, 'greedy': {'text': '5411', 'meanP': 0.99}}))
        self.assertFalse(corroborating({**ok, 'p': 0.8}))


class TruthBinding(unittest.TestCase):
    def test_proportional_peer_gives_truth(self):
        a, b = item('400', 100, 92), item('200', 250, 92)
        r = truth_binding(a, [a, b], [H_LINE])
        self.assertEqual(r['status'], 'TRUTH')
        self.assertEqual((r['segment']['fromPx'], r['segment']['toPx']), (0, 200))

    def test_truth_can_differ_from_the_centre_segment(self):
        # the label sits over [200, 300] (100 px) but 600 is proportional to the peer (200 over 100 px) only on [300, 600]
        a, b = item('600', 250, 92), item('200', 50, 92)
        line = {**H_LINE, 'ticks': [{'atPx': 0}, {'atPx': 100}, {'atPx': 200}, {'atPx': 300}, {'atPx': 600}]}
        r = truth_binding(a, [a, b], [line])
        self.assertEqual(r['status'], 'TRUTH')
        self.assertEqual((r['segment']['fromPx'], r['segment']['toPx']), (300, 600))

    def test_rejected_marks_do_not_split_segments(self):
        line = {**H_LINE, 'ticks': [{'atPx': 0, 'class': 'TICK'}, {'atPx': 120, 'class': 'REJECTED'}, {'atPx': 200, 'class': 'TICK'}]}
        s = segment_at(line, box(100, 92))
        self.assertEqual((s['fromPx'], s['toPx']), (0, 200))

    def test_no_peer_no_truth(self):
        a = item('400', 100, 92)
        self.assertEqual(truth_binding(a, [a], [H_LINE])['status'], 'NO_LINE_TRUTH')

    def test_misread_value_is_not_proportional(self):
        a, b = item('460', 100, 92), item('200', 250, 92)  # 460/200 vs 200/100: 15 % off
        self.assertEqual(truth_binding(a, [a, b], [H_LINE])['status'], 'NO_LINE_TRUTH')

    def test_two_lines_both_proportional_is_ambiguous(self):
        a = item('400', 100, 110)
        peer1, peer2 = item('200', 250, 92), item('400', 375, 128)
        lines = [H_LINE, {**H_LINE2, 'ticks': [{'atPx': 0}, {'atPx': 200}, {'atPx': 250}, {'atPx': 450}]}]
        r = truth_binding(a, [a, peer1, peer2], lines)
        self.assertEqual(r['status'], 'AMBIGUOUS_BINDING')


class BlindBinding(unittest.TestCase):
    def test_blind_to_values(self):
        c1 = [{'box': box(100, 92), 'axis': 'HORIZONTAL', 'values': {'400'}}]
        c2 = [{'box': box(100, 92), 'axis': 'HORIZONTAL', 'values': {'999'}}]
        self.assertEqual(assign_blind(c1, [H_LINE], 12), assign_blind(c2, [H_LINE], 12))

    def test_close_rival_is_unresolved(self):
        c = [{'box': box(100, 110), 'axis': 'HORIZONTAL', 'values': {'400'}}]  # 10 px from both lines
        self.assertEqual(assign_blind(c, [H_LINE, H_LINE2], 12)[0]['status'], 'UNRESOLVED')

    def test_one_label_per_segment(self):
        c = [{'box': box(100, 94), 'axis': 'HORIZONTAL', 'values': {'400'}}, {'box': box(100, 88), 'axis': 'HORIZONTAL', 'values': {'400'}}]
        st = sorted(r['status'] for r in assign_blind(c, [H_LINE], 12))
        self.assertEqual(st, ['BOUND', 'SEGMENT_TAKEN'])

    def test_parallel_copy_is_not_a_rival(self):
        copy = {**H_LINE, 'id': 'L0copy', 'baselinePx': 101}
        c = [{'box': box(100, 92), 'axis': 'HORIZONTAL', 'values': {'400'}}]
        self.assertEqual(assign_blind(c, [H_LINE, copy], 12)[0]['status'], 'BOUND')
        self.assertTrue(same_segment(segment_at(H_LINE, box(100, 92)), segment_at(copy, box(100, 92))))


class Scale(unittest.TestCase):
    def test_needs_three_labels_on_two_lines(self):
        one_line = [{'value': 200, 'px': 100, 'line': 1}, {'value': 400, 'px': 200, 'line': 1}, {'value': 300, 'px': 150, 'line': 1}]
        self.assertIsNone(scale_cluster(one_line))
        two = one_line[:2] + [{'value': 300, 'px': 150, 'line': 2}]
        self.assertAlmostEqual(scale_cluster(two)['scale'], 2.0)

    def test_one_ink_read_twice_is_one_witness(self):
        # the scorer merges B0 and B1 readings of the same ink into ONE candidate before any pair is formed
        cands = [{'box': box(100, 92), 'axis': 'HORIZONTAL', 'values': {'400'}, 'src': {'B0', 'B1'}}]
        self.assertEqual(sum(1 for r in assign_blind(cands, [H_LINE], 12) if r['status'] == 'BOUND'), 1)


if __name__ == '__main__':
    unittest.main(verbosity=1)
