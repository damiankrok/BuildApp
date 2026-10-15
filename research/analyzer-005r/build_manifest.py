#!/usr/bin/env python3
"""
build_manifest.py — 005R frozen corpus manifest (RESEARCH ONLY; never imported by production).

    python3 -I research/analyzer-005r/build_manifest.py <work-dir> <out-committed.json> <out-private.json>

Reads <work>/survey.json and <work>/fetched.json (acquire.py) and the image bytes in <work>/images, and writes:
  * a PRIVATE manifest (outside Git: keeps captions and channel details for the truth procedure), and
  * a COMMITTED manifest with no pixels, no captions and no page text: per asset its SHA-256, byte size, decoded size,
    format, perceptual hashes, the editions that publish those exact bytes (URL + structural channel names), its
    lineage group, family and split.

Identity rules (brief §2):
  edition  = publisher-origin project code: archon:<m-code> (a republishing host carrying the same ARCHON code is the
             same edition on another host — recorded, never an independent source), dobredomy:<project>.
  asset    = one exact byte string (SHA-256). The same bytes published by two editions are ONE asset with two
             memberships — a cross-edition shared picture can never support one edition independently of the other.
  lineage group = connected component of assets linked by perceptual near-duplication (64-bit dHash Hamming ≤ DH_MAX
             and aspect within 5 %). Thumbnails, re-encodings, crops and resolution variants of one picture fall into
             one group and count as ONE witness.
Family = the holdout README rule (first three slug tokens when the second is a preposition, else two; DobreDomy: the
project name without a trailing roman numeral). Split = DEV when int(sha256(SPLIT_SALT + family)[:8], 16) % 5 ∈ {0, 1},
else EVAL — fixed before any truth was derived.
"""
import hashlib
import json
import os
import re
import sys

from PIL import Image

SPLIT_SALT = '005R-family-split-v1:'
DH_MAX = 6
MIN_SIDE_SCORED = 256
NOT_USABLE_PUBLISHERS = {'dobredomy.pl': 'terms §7.2 require the seller\'s consent for copying and use (source-eligibility.json)'}
PREPOSITIONS = {'w', 'we', 'pod', 'na', 'nad', 'przy', 'z', 'ze', 'u', 'o', 'do'}


def family_of(edition_key, url):
    pub, code = edition_key.split(':', 1)
    if pub == 'dobredomy':
        return 'dobredomy:' + re.sub(r'(I|II|III|IV|V|VI|VII|VIII|IX|X)$', '', code).lower()
    m = re.search(r'/projekt-([a-z0-9-]+)-m[0-9a-f]{8,}', url) or re.search(r'/p,m[0-9a-f]+,([a-z0-9-]+)', url)
    toks = m.group(1).split('-') if m else [code]
    fam = toks[:3] if len(toks) >= 3 and toks[1] in PREPOSITIONS else toks[:2]
    return 'archon:' + '-'.join(fam)


def split_of(family):
    return 'DEV' if int(hashlib.sha256((SPLIT_SALT + family).encode()).hexdigest()[:8], 16) % 5 in (0, 1) else 'EVAL'


def dhash(img, size=8):
    g = img.convert('L').resize((size + 1, size), Image.Resampling.BOX)
    px = list(g.getdata())
    bits = 0
    for y in range(size):
        for x in range(size):
            bits = (bits << 1) | (1 if px[y * (size + 1) + x] > px[y * (size + 1) + x + 1] else 0)
    return f'{bits:016x}'


def ahash(img, size=8):
    g = img.convert('L').resize((size, size), Image.Resampling.BOX)
    px = list(g.getdata())
    m = sum(px) / len(px)
    bits = 0
    for p in px:
        bits = (bits << 1) | (1 if p > m else 0)
    return f'{bits:016x}'


def ham(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count('1')


def main(work, out_committed, out_private):
    survey = json.load(open(os.path.join(work, 'survey.json')))
    fetched = json.load(open(os.path.join(work, 'fetched.json')))
    assets = {}
    editions = {}
    failures = []
    excluded = []
    for e in survey:
        key = e['editionKey']
        host = e['publisher']
        if host in NOT_USABLE_PUBLISHERS:
            excluded.append({'editionKey': key, 'canonicalRequested': e['canonicalRequested'], 'status': 'SOURCE_NOT_USABLE', 'reason': NOT_USABLE_PUBLISHERS[host]})
            continue
        ed = editions.setdefault(key, {'editionKey': key, 'canonicalUrls': [], 'hosts': [], 'family': family_of(key, e['canonicalRequested']),
                                       'variantSha256': [], 'pageSha256': [], 'pageStatus': []})
        ed['canonicalUrls'].append(e.get('canonicalUrl') or e['canonicalRequested'])
        ed['hosts'].append(host)
        ed['pageSha256'].append(e.get('pageSha256'))
        ed['pageStatus'].append(e.get('pageStatus'))
        for c in e['candidates']:
            f = fetched.get(c['url'], {})
            if f.get('status') != 'OK':
                failures.append({'editionKey': key, 'url': c['url'], 'status': f.get('status', 'NOT_FETCHED')})
                continue
            h = f['sha256']
            a = assets.get(h)
            if a is None:
                path = os.path.join(work, 'images', f['file'])
                try:
                    with Image.open(path) as im:
                        im.load()
                        a = {'assetId': 'a-' + h[:16], 'variantSha256': h, 'bytes': f['bytes'], 'format': im.format, 'width': im.width, 'height': im.height,
                             'dhash': dhash(im), 'ahash': ahash(im), 'file': f['file'], 'memberships': []}
                except Exception as ex:  # an undecodable file is recorded, not dropped silently
                    failures.append({'editionKey': key, 'url': c['url'], 'status': f'UNDECODABLE {type(ex).__name__}'})
                    continue
                assets[h] = a
            mem = {'editionKey': key, 'host': host, 'url': c['url'], 'channel': c['channel'], 'via': c['via'], 'caption': c.get('caption', ''), 'modal': c.get('modal', '')}
            if mem not in a['memberships']:
                a['memberships'].append(mem)
            if h not in ed['variantSha256']:
                ed['variantSha256'].append(h)
    # lineage groups (union-find over near-duplicates; exact duplicates are already one asset)
    keys = sorted(assets)
    parent = {k: k for k in keys}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k
    for i, a in enumerate(keys):
        A = assets[a]
        for b in keys[i + 1:]:
            B = assets[b]
            if ham(A['dhash'], B['dhash']) <= DH_MAX and abs(A['width'] / A['height'] - B['width'] / B['height']) <= 0.05 * (A['width'] / A['height']):
                ra, rb = find(a), find(b)
                if ra != rb:
                    parent[max(ra, rb)] = min(ra, rb)
    for k in keys:
        a = assets[k]
        a['lineageGroup'] = 'lg-' + find(k)[:12]
        eds = sorted({m['editionKey'] for m in a['memberships']})
        a['editions'] = eds
        fams = sorted({editions[x]['family'] for x in eds})
        a['families'] = fams
        a['family'] = fams[0] if len(fams) == 1 else 'MULTI:' + '+'.join(fams)
        splits = sorted({split_of(f) for f in fams})
        a['split'] = splits[0] if len(splits) == 1 else 'CROSS_SPLIT'
        a['scoredSize'] = min(a['width'], a['height']) >= MIN_SIDE_SCORED
    for ed in editions.values():
        ed['split'] = split_of(ed['family'])
        ed['variantSha256'].sort()
    private = {'schema': 'research.005r.corpus-private.0.1', 'assets': [assets[k] for k in keys], 'editions': editions, 'failures': failures}
    json.dump(private, open(out_private, 'w'), indent=1, sort_keys=True)
    committed_assets = []
    for k in keys:
        a = assets[k]
        committed_assets.append({k2: a[k2] for k2 in ('assetId', 'variantSha256', 'bytes', 'format', 'width', 'height', 'dhash', 'ahash', 'lineageGroup',
                                                      'editions', 'family', 'families', 'split', 'scoredSize')}
                                | {'memberships': sorted([{'editionKey': m['editionKey'], 'host': m['host'], 'url': m['url'], 'channel': m['channel'], 'via': m['via']}
                                                          for m in a['memberships']], key=lambda m: (m['editionKey'], m['url'], m['channel']))})
    committed = {
        'schema': 'research.005r.corpus-manifest.0.1',
        'note': 'hashes, URLs, sizes and structural channel names only — no pixels, captions or page text (005R brief §4)',
        'splitSalt': SPLIT_SALT, 'dhashMax': DH_MAX, 'minSideScored': MIN_SIDE_SCORED,
        'editions': {k: {kk: v[kk] for kk in ('editionKey', 'canonicalUrls', 'hosts', 'family', 'split', 'variantSha256', 'pageSha256', 'pageStatus')} for k, v in sorted(editions.items())},
        'assets': committed_assets,
        'failures': sorted(failures, key=lambda f: (f['editionKey'], f['url'])),
        'excludedEditions': sorted(excluded, key=lambda e: e['editionKey']),
    }
    json.dump(committed, open(out_committed, 'w'), indent=1, sort_keys=True)
    lg = len({a['lineageGroup'] for a in assets.values()})
    print(f'editions {len(editions)} assets {len(assets)} lineage groups {lg} failures {len(failures)}')
    print('families', len({e["family"] for e in editions.values()}), 'DEV', sum(1 for e in editions.values() if e['split'] == 'DEV'), 'EVAL', sum(1 for e in editions.values() if e['split'] == 'EVAL'))


if __name__ == '__main__':
    main(*sys.argv[1:4])
