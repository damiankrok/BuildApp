"""
common.py — shared constants and helpers for BUILDPLAN-ANALYZER-005R-EXTERIOR (RESEARCH ONLY; never imported by
production). Publisher pixels, pages, captions and private ledgers live OUTSIDE the repository; every writer here
refuses an output path inside it.
"""
import hashlib
import json
import os
import re

SEED = 'BUILDPLAN-005R-EXTERIOR-V1'
SCHEMA = 'research.exterior-proposals.0.1'
REPO = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))

FEATURE_CLASSES = ['TERRACE', 'BALCONY', 'RAILING', 'PERGOLA', 'CARPORT', 'GARAGE_ENCLOSED', 'ENTRANCE_CANOPY',
                   'COLUMNS_SUPPORTS', 'LOGGIA', 'LARGE_GLAZING', 'UNKNOWN_ASSEMBLY']

# product categories — the dropdown labelled "należy do kategorii", never the site-wide navigation
CATEGORY_POS = {
    'PERGOLA': r'^projekty-domow-z-pergola$',
    'TERRACE': r'^projekty-domow-z-(zadaszonym-)?tarasem(-w-podcieniu)?$',
    'GARAGE_ENCLOSED': r'^projekty-domow-z-garazem-',
    'ENTRANCE_CANOPY': r'^projekty-domow-z-weranda$',
}
CATEGORY_COVER = {  # categories that state a cover relation, not only presence
    'projekty-domow-z-zadaszonym-tarasem': ('TERRACE', 'SOLID_COVER'),
    'projekty-domow-z-tarasem-w-podcieniu': ('TERRACE', 'SOLID_COVER'),
    'projekty-domow-z-pergola': ('PERGOLA', 'OPEN_COVER'),
}
CATEGORY_NEG = {'GARAGE_ENCLOSED': r'^projekty-domow-bez-garazu$'}

# product description keywords (the bottom-description block only); word-bounded so "wiatrołap" (vestibule)
# never reads as "wiata" (carport) — an enumerated look-alike
DESCRIPTION_POS = {
    'PERGOLA': r'\bpergol',
    'TERRACE': r'\btaras',
    'BALCONY': r'\bbalkon',
    'LOGGIA': r'\blogi[ia]',
    'CARPORT': r'\bwiat(a|y|ą|ę|cie)\b(?! ?rołap)|\bcarport',
    'GARAGE_ENCLOSED': r'\bgara[zż]',
    'ENTRANCE_CANOPY': r'zadaszon\w* wej[sś]ci|\bdaszek|\bdaszkiem|\bwerand',
    'COLUMNS_SUPPORTS': r'\bsłup|\bkolumn',
    'LARGE_GLAZING': r'przeszkle|du[zż]e okn|wielkoformatow|panoramiczn',
    'RAILING': r'\bbalustrad',
}
DESCRIPTION_COVER = {'TERRACE': r'zadaszon\w* taras|taras\w* zadaszon|taras\w* w podcieni|podcie[nń]'}
DESCRIPTION_NEG = {'GARAGE_ENCLOSED': r'\bbez gara[zż]'}

# interiors-carousel caption token classes (a CLASS is committed, the caption never is)
CAPTION_INTERIOR = r'strefa|łazien|lazien|kuchni|salon|sypial|jadal|pok[oó]j|wn[eę]trz|garderob|\bhol\b|gabinet'
CAPTION_EXTERIOR = r'stylizacj|segment|elewacj|ogrod|bry[łl]'


def refuse_inside_repo(*paths):
    for p in paths:
        real = os.path.realpath(p)
        if real == REPO or real.startswith(REPO + os.sep):
            results = os.path.join(REPO, 'research', 'analyzer-005r-exterior', 'results')
            if not (real == results or real.startswith(results + os.sep)):
                raise SystemExit(f'REFUSED: private ledgers and publisher-derived files stay outside the repository ({p})')


def refuse_private_inside_repo(*paths):
    for p in paths:
        real = os.path.realpath(p)
        if real == REPO or real.startswith(REPO + os.sep):
            raise SystemExit(f'REFUSED: private ledgers and publisher-derived files stay outside the repository ({p})')


def h(*parts):
    return hashlib.sha256(':'.join(parts).encode()).hexdigest()


def file_sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def canon(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


def dump(obj, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=1, sort_keys=True, ensure_ascii=False)
        f.write('\n')


def caption_class(caption):
    c = re.sub(r'^gotowy projekt .*?\)\s*', '', (caption or '').lower())
    if re.search(CAPTION_EXTERIOR, c):
        return 'EXTERIOR_NAMED'
    if re.search(CAPTION_INTERIOR, c):
        return 'INTERIOR_ZONE'
    return 'GENERIC' if c.strip() else 'EMPTY'
