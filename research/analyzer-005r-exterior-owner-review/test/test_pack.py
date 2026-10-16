#!/usr/bin/env python3
"""
test_pack.py — T1, T2, T5 on the real queue builder (committed JSON only; no picture is read).

    python3 -I research/analyzer-005r-exterior-owner-review/test/test_pack.py
"""
import json
import os
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import build_pack as bp  # noqa: E402

OWNER, G2E5 = bp.OWNER, bp.G2E5


class Pack(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = bp.outputs()
        cls.queue = json.loads(cls.out['pack/queue.json'])
        cls.cross = json.loads(cls.out['pack/crosscheck.json'])
        cls.excl = json.loads(cls.out['results/exclusions.json'])['rows']
        cls.man = json.load(open(os.path.join(bp.EXT, 'corpus-manifest.json')))
        cls.b1 = json.load(open(os.path.join(bp.EXT, 'proposals-B1.json')))['proposals']

    def test_t1_every_b1_visibility_question_once_or_excluded(self):
        fv = {p['proposalId']: p for p in self.b1 if p['proposalKind'] == 'FEATURE_VISIBILITY'}
        self.assertEqual(len(fv), 19)
        rep = [x['b1ProposalId'] for x in self.cross['questions'] if x['b1ProposalId']]
        self.assertEqual(len(rep), len(set(rep)))
        excluded = {e.get('b1ProposalId') for e in self.excl}
        self.assertEqual(set(fv) - set(rep) - excluded, set())
        qs = {q['questionId']: q for q in self.queue['questions']}
        for x in self.cross['questions']:
            if x['b1ProposalId']:
                p, q = fv[x['b1ProposalId']], qs[x['questionId']]
                self.assertEqual((q['projectEditionId'], q['anchorByteHash']), (p['projectEditionId'], p['assetByteHash']))
                self.assertEqual(bp.TO_B1.get(q['featureClass'], q['featureClass']), p['featureClass'])
                self.assertEqual(q['tier'], 'PRIORITY')

    def test_counts_and_cap(self):
        qs = self.queue['questions']
        self.assertLessEqual(len(qs), bp.CAP)
        self.assertEqual(sum(q['tier'] == 'PRIORITY' for q in qs), 34)
        # addendum B: the tier is per image — every question on one image shares it
        tiers = {}
        for q in qs:
            self.assertEqual(tiers.setdefault(q['imageId'], q['tier']), q['tier'])
        self.assertEqual([q['order'] for q in qs], list(range(1, len(qs) + 1)))
        self.assertTrue(all(e['reason'] in {'CAP_60', 'DEDUP_SAME_KEY', 'BYTE_SHARED_LINEAGE_NOT_PROPAGATED'} for e in self.excl))

    def test_t2_isolation_owner_vs_rarytasy5(self):
        assets = {a['assetByteHash']: a for a in self.man['assets']}
        owner_bytes, g2e_bytes = set(), set()
        for q in self.queue['questions']:
            for h in q['acceptedByteHashes']:
                self.assertIn(q['projectEditionId'], assets[h]['editions'], 'accepted bytes must be published by the question edition')
                self.assertEqual(assets[h]['lineageGroup'], q['lineageGroup'])
            (owner_bytes if q['projectEditionId'] == OWNER else g2e_bytes if q['projectEditionId'] == G2E5 else set()).update(q['acceptedByteHashes'])
        self.assertEqual(owner_bytes & g2e_bytes, set())
        # the near-duplicate hero group: OWNER's question accepts only OWNER's own bytes
        hero = [q for q in self.queue['questions'] if q['lineageGroup'] == 'lg-0ec5494a5b15']
        self.assertTrue(hero and all(q['projectEditionId'] == OWNER and q['acceptedByteHashes'] == [q['anchorByteHash']] for q in hero))
        # one byte file -> one edition across the whole queue
        owner_of = {}
        for q in self.queue['questions']:
            for h in q['acceptedByteHashes']:
                self.assertEqual(owner_of.setdefault(h, q['projectEditionId']), q['projectEditionId'])
        # the byte-shared interior group is one question under OWNER, explicitly not propagated
        shared = [e for e in self.excl if e['reason'] == 'BYTE_SHARED_LINEAGE_NOT_PROPAGATED']
        self.assertEqual({e['projectEditionId'] for e in shared}, {G2E5, 'archon:m738275b7537b0'})
        # OWNER's cross-check carries no production feature (no production run) and G2E-5 is labelled not-OWNER
        for x in self.cross['questions']:
            q = next(q for q in self.queue['questions'] if q['questionId'] == x['questionId'])
            if q['projectEditionId'] == OWNER:
                self.assertEqual(x['productionFeatures'], [])
                self.assertFalse(x['productionRun'])

    def test_t5_reordered_inputs_give_identical_files(self):
        for seed in (1, 2, 3):
            self.assertEqual(bp.outputs(order_seed=seed), bp.outputs())

    def test_reproducible_from_repository(self):
        pa = json.load(open(os.path.join(os.path.dirname(HERE), 'results', 'page-access.json')))
        out = bp.outputs({r['questionId']: r['access'] for r in pa['rows']})
        for k, v in out.items():
            self.assertEqual(open(os.path.join(os.path.dirname(HERE), k), encoding='utf-8').read(), v, k)

    def test_t4_blind_queue_has_no_phase2_content(self):
        words = []

        def walk(x):
            if isinstance(x, dict):
                for k, v in x.items():
                    words.append(k)
                    walk(v)
            elif isinstance(x, list):
                for v in x:
                    walk(v)
            elif isinstance(x, str) and not re.fullmatch(r'((img|q|lg)-|archon:m)?[0-9a-f]+', x):
                words.append(x)
        q = json.loads(self.out['pack/queue.json'])
        walk({'images': q['images'], 'questions': q['questions']})  # vocab and input-file hashes are generic
        joined = '\n'.join(words).lower()
        for word in ('http', 'publisher', 'caption', 'b1', 'strict', 'viewhint', 'channel', 'claim', 'url', 'page'):
            self.assertNotIn(word, joined, word)

    def test_template_is_all_unreviewed(self):
        t = json.loads(self.out['pack/labels-template-EMPTY.json'])
        self.assertTrue(all(l['status'] == 'UNREVIEWED' and l['phase1'] is None and l['reviewerOrigin'] is None for l in t['labels']))
        self.assertEqual(len(t['labels']), len(self.queue['questions']))

    def test_cross_check_urls_are_project_pages_only(self):
        for x in self.cross['questions']:
            self.assertRegex(x['projectPageUrl'], bp.URL_PAGE)


if __name__ == '__main__':
    unittest.main()
