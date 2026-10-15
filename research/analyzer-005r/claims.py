#!/usr/bin/env python3
"""
claims.py — 005R edition-level PUBLISHER CLAIMS of exterior assemblies (RESEARCH ONLY). Preregistration §4/§5.3.

    python3 -I claims.py <work-dir> <assembled-dir> <out.json>

From each ARCHON page (text only, read locally) two claim channels are reduced to kind sets — the product-category
breadcrumb (e.g. "Projekty domów z pergolą") and keyword hits in the product description — and compared, per edition,
with each contender's PROPOSED edition-level hypotheses. These are EDITION-LEVEL publisher claims, not visible-region
truth: a claim says the house has the feature, not that any given image shows it. So the comparison is CONSISTENCY,
never accuracy; absence of a claim is never treated as absence of the feature. Only kind sets and counts are written.
"""
import glob
import json
import os
import re
import sys

KEYWORDS = {
    'PERGOLA_OPEN': r'pergol',
    'COVERED_TERRACE': r'zadaszon\w* taras|taras\w* zadaszon|zadaszeni\w* (nad )?taras',
    'TERRACE_AT_GRADE': r'\btaras',
    'CANOPY_ENTRANCE': r'zadaszon\w* wej[sś]ci|daszek|podcie[nń]',
    'CARPORT': r'\bwiat\w* (gara[zż]ow|samochod)|\bcarport',
    'BALCONY': r'\bbalkon',
    'LOGGIA': r'\blogi[ia]',
    'GARAGE_DOOR': r'brama gara[zż]ow|\bbram[ay]\b',
}
CATEGORY = {'PERGOLA_OPEN': r'z-pergola', 'BALCONY': r'z-balkonem', 'TERRACE_AT_GRADE': r'z-tarasem', 'COVERED_TERRACE': r'zadaszon\w*-taras',
            'CARPORT': r'z-wiata', 'GARAGE_DOOR': r'z-garazem'}


def page_claims(html):
    # the product's own categories: the breadcrumb dropdown labelled "należy do kategorii" (belongs to categories)
    i = html.find('należy do kategorii')
    ul = re.search(r'<ul class="dropdown-menu dropdown-menu-center"[^>]*>(.*?)</ul>', html[i:], re.S) if i >= 0 else None
    cats = set(re.findall(r'href="/(projekty-[a-z0-9-]+-pc\d+)"', ul.group(1) if ul else ''))
    # the product description block (not the site-wide navigation, which names features of other projects)
    d = re.search(r'id="bottom-description">(.*?)</div>', html, re.S)
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', d.group(1) if d else '')).lower()
    kinds_kw = sorted(k for k, rx in KEYWORDS.items() if re.search(rx, text))
    kinds_cat = sorted(k for k, rx in CATEGORY.items() if any(re.search(rx, c) for c in cats))
    return kinds_cat, kinds_kw, len(cats), len(text)


def main(work, assembled, out):
    res = {'schema': 'research.005r.edition-claims.0.1', 'note': 'edition-level publisher claims vs PROPOSED hypotheses; consistency only, never accuracy', 'editions': {}, 'byContender': {}}
    for pdir in sorted(glob.glob(os.path.join(work, 'pages', 'archon_*'))):
        if pdir.endswith('_alt'):
            continue
        key = 'archon:' + os.path.basename(pdir).split('_', 1)[1]
        cat, kw, ncat, ntext = page_claims(open(os.path.join(pdir, 'page.html'), encoding='utf-8', errors='replace').read())
        res['editions'][key] = {'categoryClaims': cat, 'textClaims': kw, 'categoriesFound': ncat, 'descriptionChars': ntext}
    for cdir in sorted(glob.glob(os.path.join(assembled, '*'))):
        if not os.path.isdir(cdir):
            continue
        name = os.path.basename(cdir)
        stats = {}
        for key, cl in res['editions'].items():
            p = os.path.join(cdir, f"edition-{key.replace(':', '_')}.json")
            hyp = {h['kind'] for h in json.load(open(p))['hypotheses']} if os.path.exists(p) else set()
            claimed = set(cl['categoryClaims']) | set(cl['textClaims'])
            for k in sorted(set(KEYWORDS) | hyp):
                s = stats.setdefault(k, {'claimedEditions': 0, 'claimedAndProposed': 0, 'proposedWithoutClaim': 0})
                if k in claimed:
                    s['claimedEditions'] += 1
                    s['claimedAndProposed'] += k in hyp
                elif k in hyp:
                    s['proposedWithoutClaim'] += 1
        res['byContender'][name] = stats
    json.dump(res, open(out, 'w'), indent=1, sort_keys=True)
    anchor = res['editions'].get('archon:m3ea28300f9b3e')
    print('anchor claims', anchor)
    for n, st in res['byContender'].items():
        print(n, {k: v for k, v in st.items() if v['claimedEditions'] or v['proposedWithoutClaim']})


if __name__ == '__main__':
    main(*sys.argv[1:4])
