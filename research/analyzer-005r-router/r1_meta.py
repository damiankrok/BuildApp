#!/usr/bin/env python3
"""
r1_meta.py — 005R-ROUTER variant R1 META-PROVENANCE (RESEARCH ONLY; never imported by production).

    python3 -I research/analyzer-005r-router/r1_meta.py <005R corpus-private.json> <role-truth.json> <private-out.json> <aggregate-out.json>

For every 005R corpus asset, the publisher's page signals are kept SEPARATE and typed, instead of being flattened into
one role (brief §2 axes a–e):

  witness                         class (independence)        what it hints
  carousel CAROUSEL:fancybox3Interiors   PUBLISHER_GALLERY    scene INTERIOR
  page header PAGE:fancybox3ProdBigImg*  PUBLISHER_GALLERY    scene EXTERIOR
  page tab PAGE:elevations-tab           PUBLISHER_PAGE       drawing ORTHOGRAPHIC_FACADE
  floor carousel / fragment              PUBLISHER_PAGE       drawing PLAN
  cross-section carousel                 PUBLISHER_PAGE       drawing SECTION
  caption with an interior room word     PUBLISHER_GALLERY    scene INTERIOR
  caption naming a styling / segment     PUBLISHER_GALLERY    scene EXTERIOR
  caption / file slug "widok"            PUBLISHER_GALLERY    a VIEW (not a scene: interiors are views too)

The carousel, its captions and the upload's file names are ONE publisher filing act, so they are ONE witness class
(PUBLISHER_GALLERY): agreement among them is not corroboration. The output per asset is a PROPOSAL:
INTERIOR_HINT | EXTERIOR_HINT | CONTESTED (gallery signals disagree) | UNKNOWN, never a truth and never a role.

Scoring is deliberately NOT accuracy. The 005R truth for INTERIOR_RENDER/EXTERIOR_RENDER is this same carousel
channel, so agreement with it is circular and is reported as CHANNEL_AGREEMENT. Edition identity: every count is
per edition key and per lineage group; a lineage group spanning editions is reported, never merged into a vote.

The private output (captions classes, URLs) stays outside Git; the aggregate holds counts only.
"""
import collections
import json
import re
import sys

INTERIOR_WORDS = re.compile(r'wn[eę]trz|kuchni|salon|strefa dzienna|[lł]azien|sypialn|pok[oó]j|jadalni|gabinet|garderob|hol\b|przedpok', re.I)
STYLING = re.compile(r'stylizacj|wszystkich segment', re.I)
VIEW = re.compile(r'\bwidok\b', re.I)
VIEW_SLUG = re.compile(r'^widok-\d')


def witnesses(asset):
    out = []
    for m in asset['memberships']:
        ch, cap = m['channel'], m.get('caption') or ''
        slug = m['url'].rsplit('/', 1)[-1].lower()
        if ch == 'CAROUSEL:fancybox3Interiors':
            out.append(('PUBLISHER_GALLERY', 'carousel-interiors', 'INTERIOR'))
        if ch.startswith('PAGE:fancybox3ProdBigImg'):
            out.append(('PUBLISHER_GALLERY', 'page-header', 'EXTERIOR'))
        if ch == 'PAGE:elevations-tab':
            out.append(('PUBLISHER_PAGE', 'elevations-tab', 'FACADE_DRAWING'))
        if ch in ('CAROUSEL:fancybox3Floor', 'PAGE:floor-fragment'):
            out.append(('PUBLISHER_PAGE', 'floor', 'PLAN_DRAWING'))
        if ch == 'CAROUSEL:fancybox3CrossSection':
            out.append(('PUBLISHER_PAGE', 'cross-section', 'SECTION_DRAWING'))
        if INTERIOR_WORDS.search(cap):
            out.append(('PUBLISHER_GALLERY', 'caption-interior-word', 'INTERIOR'))
        if STYLING.search(cap):
            out.append(('PUBLISHER_GALLERY', 'caption-styling', 'EXTERIOR'))
        if VIEW.search(cap) or VIEW_SLUG.match(slug):
            out.append(('PUBLISHER_GALLERY', 'view-word', 'VIEW'))
    return sorted(set(out))


def proposal(ws):
    scene = {w[2] for w in ws if w[2] in ('INTERIOR', 'EXTERIOR')}
    if len(scene) == 2:
        return 'CONTESTED'
    if scene == {'INTERIOR'}:
        return 'INTERIOR_HINT'
    if scene == {'EXTERIOR'}:
        return 'EXTERIOR_HINT'
    return 'UNKNOWN'


def main(corpus_p, truth_p, private_p, agg_p):
    corpus = json.load(open(corpus_p))
    truth = {r['assetId']: r for r in json.load(open(truth_p))['rows']}
    private, agg = [], collections.Counter()
    by_truth = collections.defaultdict(collections.Counter)
    classes_per_asset = collections.Counter()
    cross_edition_groups = collections.defaultdict(set)
    for a in corpus['assets']:
        ws = witnesses(a)
        p = proposal(ws)
        t = truth.get(a['assetId'], {})
        classes = sorted({w[0] for w in ws if w[2] in ('INTERIOR', 'EXTERIOR')})
        classes_per_asset[len(classes)] += 1
        private.append({'assetId': a['assetId'], 'sha256': a['variantSha256'], 'editions': a['editions'], 'lineageGroup': a['lineageGroup'],
                        'split': a['split'], 'witnesses': [list(w) for w in ws], 'proposal': p, 'truth005R': t.get('roleTruth'), 'truthBasis': t.get('basis')})
        agg[p] += 1
        by_truth[t.get('roleTruth', 'NONE')][p] += 1
        if p in ('INTERIOR_HINT', 'EXTERIOR_HINT', 'CONTESTED'):
            for e in a['editions']:
                cross_edition_groups[a['lineageGroup']].add(e)
    json.dump(private, open(private_p, 'w'), indent=1, sort_keys=True)
    aggregate = {
        'schema': 'research.005r-router.r1-meta.0.1',
        'note': 'PROPOSALS from one publisher filing act; CHANNEL_AGREEMENT with the 005R structural truth is circular for INTERIOR/EXTERIOR and is not accuracy. HUMAN_LABELS_NOT_RUN.',
        'assets': len(corpus['assets']),
        'proposals': dict(sorted(agg.items())),
        'proposalByTruth005R': {k: dict(sorted(v.items())) for k, v in sorted(by_truth.items())},
        'independentSceneWitnessClassesPerAsset': {str(k): v for k, v in sorted(classes_per_asset.items())},
        'assetsWithTwoIndependentSceneClasses': classes_per_asset.get(2, 0),
        'lineageGroupsWithSceneHintSpanningEditions': sum(1 for g in cross_edition_groups.values() if len(g) > 1),
    }
    json.dump(aggregate, open(agg_p, 'w'), indent=1, sort_keys=True)
    print(json.dumps(aggregate, sort_keys=True))


if __name__ == '__main__':
    main(*sys.argv[1:5])
