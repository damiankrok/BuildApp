#!/usr/bin/env python3
"""
c_truth_variants.py — 005R addendum C, truth sensitivity (POST-HOC, RESEARCH ONLY; written after the reviews).

    python3 -I c_truth_variants.py <corpus-private.json> <truth.json> <out-dir>

Two confirmed review findings say the structural truth itself is wrong in places. Neither is fixed in truth.json (the
preregistered truth stays the headline); instead each correction becomes a separate truth file and every contender is
re-scored on it, with V1 and V0b refitted on DEV under that truth (c_run.sh):

  C1x  reviewer B-1: items in the interiors carousel whose caption names a STYLING variant or ALL SEGMENTS are exterior
       views, not interiors. Marked TRUTH_CONFLICT (excluded from scoring).
  C1r  the same items relabelled EXTERIOR_RENDER (basis STRUCTURE+CAPTION_CORRECTION).
  C2   reviewer B-2: page images whose file name is "widok-<n>" (a view) and that have no structural truth are labelled
       EXTERIOR_RENDER (basis SLUG; independentOfV0 = false — the incumbent reads the same slug).
  C12  C1r and C2 together.

Captions and slugs are read only from the private corpus file outside Git; nothing here names a project.
"""
import copy
import json
import os
import re
import sys

STYLING = re.compile(r'stylizacj|wszystkich segment', re.I)
VIEW_SLUG = re.compile(r'^widok-\d')


def main(corpus_p, truth_p, out):
    corpus = json.load(open(corpus_p))
    truth = json.load(open(truth_p))
    styling = sorted({a['assetId'] for a in corpus['assets'] for m in a['memberships']
                      if m['channel'] == 'CAROUSEL:fancybox3Interiors' and STYLING.search(m.get('caption') or '')})
    views = sorted({a['assetId'] for a in corpus['assets'] if any(VIEW_SLUG.match(m['url'].rsplit('/', 1)[-1].lower()) for m in a['memberships'])})
    os.makedirs(out, exist_ok=True)
    report = {'stylingItems': len(styling), 'viewSlugAssets': len(views), 'variants': {}}

    def variant(name, relabel_styling, exclude_styling, view_slug):
        t = copy.deepcopy(truth)
        n = {'excluded': 0, 'relabelled': 0, 'slugLabelled': 0}
        for r in t['rows']:
            if r['assetId'] in styling and exclude_styling:
                r['roleTruth'] = 'TRUTH_CONFLICT'
                n['excluded'] += 1
            elif r['assetId'] in styling and relabel_styling:
                r['roleTruth'], r['basis'] = 'EXTERIOR_RENDER', 'STRUCTURE+CAPTION_CORRECTION'
                n['relabelled'] += 1
            elif view_slug and r['assetId'] in views and r['roleTruth'] == 'UNKNOWN':
                r['roleTruth'], r['basis'], r['independentOfV0'] = 'EXTERIOR_RENDER', 'SLUG', False
                n['slugLabelled'] += 1
        t['addendum'] = f'C {name} (post-hoc truth sensitivity)'
        json.dump(t, open(os.path.join(out, f'truth-{name}.json'), 'w'), indent=1, sort_keys=True)
        report['variants'][name] = n

    variant('C1x', False, True, False)
    variant('C1r', True, False, False)
    variant('C2', False, False, True)
    variant('C12', True, False, True)
    json.dump(report, open(os.path.join(out, 'truth-variants.json'), 'w'), indent=1, sort_keys=True)
    print(json.dumps(report))


if __name__ == '__main__':
    main(*sys.argv[1:4])
