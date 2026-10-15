#!/usr/bin/env python3
"""
truth.py — 005R role truth from the publisher's PAGE STRUCTURE (RESEARCH ONLY; never imported by production).

    python3 -I research/analyzer-005r/truth.py <corpus-private.json> <out-truth.json>

Preregistered procedure (preregistration.md §4). Run only after the preregistration commit.

The truth of an asset's role is what the publisher's page STRUCTURE says it is, never its pixels and never a model:

  structural channel (ARCHON)                          → role                 basis
  carousel position fancybox3Interiors                 → INTERIOR_RENDER      STRUCTURE
  carousel position fancybox3Floor, floor fragment     → FLOOR_PLAN           STRUCTURE
  carousel position fancybox3CrossSection              → SECTION              STRUCTURE
  page elevation tab (fancybox3Elevations)             → TECHNICAL_ELEVATION  STRUCTURE
  page header image (fancybox3ProdBigImg*)             → EXTERIOR_RENDER      STRUCTURE
  carousel item with NO position whose caption names
    a view ("widok N") and no interior word            → EXTERIOR_RENDER      STRUCTURE+CAPTION
  any other product image whose URL slug names
    "sytuacja"                                         → SITE_PLAN            SLUG
  structural channel (DobreDomy)
  section "Elewacje"                                   → TECHNICAL_ELEVATION  STRUCTURE
  section "Rzuty", figcaption "Rzut działki"           → SITE_PLAN            STRUCTURE
  section "Rzuty", other figcaption                    → FLOOR_PLAN           STRUCTURE
  section "Przekroje"                                  → SECTION              STRUCTURE
  the project slider                                   → PICTORIAL_UNSPECIFIED STRUCTURE (the slider carries up to 12
                                                       "_wN" visualisations with no structural interior/exterior split,
                                                       so it is truth only for technical-vs-pictorial, never for
                                                       interior-vs-exterior)
  everything else (thumbnails, og:image, unknown)      → UNKNOWN (excluded from role scoring)

Two channels that disagree make the asset TRUTH_CONFLICT (excluded and counted). Interior words in a caption
("wnętrz", "kuchni", "salon", "strefa dzienna", "łazien", "sypialn", "pokój") veto EXTERIOR_RENDER from a captioned
carousel item and make it TRUTH_CONFLICT.

Independence (brief §4): V0 (the production adapter) reads URL slugs and captions. Truth with basis SLUG or
STRUCTURE+CAPTION is therefore NOT independent of V0; V0 role scores on those assets are reported as metadata
agreement, never as accuracy. V1, V2 and the pixel half of N1 see no metadata, so every basis is independent of them.
No human reviewed any label: HUMAN_LABELS_NOT_RUN.

View side truth is NOT derived here: no pixel router in 005R infers a side, and the only side signal is the slug.
"""
import json
import re
import sys

INTERIOR_WORDS = re.compile(r'wn[eę]trz|kuchni|salon|strefa dzienna|[lł]azien|sypialn|pok[oó]j|jadalni|gabinet', re.I)
VIEW_WORDS = re.compile(r'\bwidok\b', re.I)


def role_from_membership(m, url_slug):
    ch, cap = m['channel'], m.get('caption') or ''
    if ch == 'CAROUSEL:fancybox3Interiors':
        return 'INTERIOR_RENDER', 'STRUCTURE'
    if ch in ('CAROUSEL:fancybox3Floor', 'PAGE:floor-fragment'):
        return 'FLOOR_PLAN', 'STRUCTURE'
    if ch == 'CAROUSEL:fancybox3CrossSection':
        return 'SECTION', 'STRUCTURE'
    if ch == 'PAGE:elevations-tab':
        return 'TECHNICAL_ELEVATION', 'STRUCTURE'
    if ch.startswith('PAGE:fancybox3ProdBigImg'):
        return 'EXTERIOR_RENDER', 'STRUCTURE'
    if ch == 'CAROUSEL:NONE':
        if INTERIOR_WORDS.search(cap):
            return 'TRUTH_CONFLICT', 'STRUCTURE+CAPTION'
        if VIEW_WORDS.search(cap):
            return 'EXTERIOR_RENDER', 'STRUCTURE+CAPTION'
        return None, None
    if ch == 'DD:slider':
        return 'PICTORIAL_UNSPECIFIED', 'STRUCTURE'
    if ch.startswith('DD:section:'):
        head = ch.split(':', 2)[2].lower()
        if head.startswith('elewac'):
            return 'TECHNICAL_ELEVATION', 'STRUCTURE'
        if head.startswith('rzut'):
            return ('SITE_PLAN', 'STRUCTURE') if re.search(r'dzia[lł]k|sytuac|zagospodar', cap, re.I) else ('FLOOR_PLAN', 'STRUCTURE')
        if head.startswith('przekr'):
            return 'SECTION', 'STRUCTURE'
        if head.startswith('wn') or 'wnętrz' in head:
            return 'INTERIOR_RENDER', 'STRUCTURE'
        return None, None
    if re.search(r'(^|[/-])sytuacja', url_slug):
        return 'SITE_PLAN', 'SLUG'
    return None, None


def main(private_path, out_path):
    corpus = json.load(open(private_path))
    rows = []
    for a in corpus['assets']:
        votes = {}
        for m in a['memberships']:
            slug = m['url'].rsplit('/', 1)[-1].lower()
            role, basis = role_from_membership(m, slug)
            if role:
                votes.setdefault(role, set()).add(basis)
        roles = sorted(votes)
        if not roles:
            truth, basis = 'UNKNOWN', 'NO_STRUCTURAL_CHANNEL'
        elif 'TRUTH_CONFLICT' in roles or len(roles) > 1:
            truth, basis = 'TRUTH_CONFLICT', '+'.join(roles)
        else:
            truth = roles[0]
            b = votes[truth]
            basis = 'STRUCTURE' if 'STRUCTURE' in b else sorted(b)[0]
        rows.append({'assetId': a['assetId'], 'variantSha256': a['variantSha256'], 'roleTruth': truth, 'basis': basis,
                     'independentOfV0': basis == 'STRUCTURE', 'lineageGroup': a['lineageGroup'], 'family': a['family'], 'split': a['split'],
                     'editions': a['editions'], 'scoredSize': a['scoredSize'], 'humanReviewed': False})
    rows.sort(key=lambda r: r['assetId'])
    json.dump({'schema': 'research.005r.role-truth.0.1', 'humanLabels': 'HUMAN_LABELS_NOT_RUN', 'rows': rows}, open(out_path, 'w'), indent=1, sort_keys=True)
    counts = {}
    for r in rows:
        counts[(r['roleTruth'], r['split'])] = counts.get((r['roleTruth'], r['split']), 0) + 1
    for k in sorted(counts):
        print(k, counts[k])


if __name__ == '__main__':
    main(*sys.argv[1:3])
