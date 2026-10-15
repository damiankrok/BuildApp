#!/usr/bin/env python3
"""
c3_v0a_lineage.py — 005R addendum C3 (POST-HOC sensitivity, RESEARCH ONLY), reviewer C-2.

    python3 -I c3_v0a_lineage.py <corpus-private.json> <truth.json> <V0a.json> <v0-packages-dir> <pages-dir> <out-V0a-lineage.json>

V0a matches the incumbent's output to 005R assets by exact byte hash. The incumbent fetches carousel THUMBNAILS while
005R scores the full-size hotspot ORIGINALS, so a full-size carousel image whose thumbnail the incumbent did type is
reported NOT_ACQUIRED. This addendum maps such an asset through the carousel anchor that links the original to its
thumbnail on the same page: if the incumbent gave every thumbnail behind that anchor exactly one document role, V0a is
credited with that role (detail LINEAGE). PERSPECTIVE_RENDER stays UNKNOWN for routing, exactly as in contenders.py.
Pages and packages are read from outside Git; nothing here names a project.
"""
import collections
import json
import os
import re
import sys

V0_MAP = {'FLOOR_PLAN': 'FLOOR_PLAN', 'SECTION': 'SECTION', 'SITE_PLAN': 'SITE_PLAN', 'ELEVATION': 'TECHNICAL_ELEVATION', 'DETAIL': 'DETAIL',
          'CHROME': 'OTHER', 'UNKNOWN': 'UNKNOWN', 'PERSPECTIVE_RENDER': 'UNKNOWN'}
ANCHOR = re.compile(r'<a\s[^>]*data-fancybox="pg1"[^>]*>', re.S)


def tail(u):
    return u.split('/images/products/')[-1]


def main(corpus_p, truth_p, v0_p, pkg_dir, pages_dir, out_p):
    corpus = {a['assetId']: a for a in json.load(open(corpus_p))['assets']}
    truth = {r['assetId']: r for r in json.load(open(truth_p))['rows']}
    v0 = json.load(open(v0_p))
    prod = collections.defaultdict(set)
    for n in sorted(os.listdir(pkg_dir)):
        if n.endswith('.json'):
            for a in json.load(open(os.path.join(pkg_dir, n)))['assets']:
                for v in a['variants']:
                    prod[(n[:-5], tail(v['url']))].add(a['roles']['document'])
    anchors = {}
    for d in sorted(os.listdir(pages_dir)):
        f = os.path.join(pages_dir, d, 'carousel.html')
        if d.endswith('_alt') or not os.path.exists(f):
            continue
        s = open(f, encoding='utf-8', errors='replace').read()
        for m in ANCHOR.finditer(s):
            inner = s[m.end():s.find('</a>', m.end())]
            ds = re.search(r'data-src="([^"]*)"', m.group(0))
            ds = ds.group(1) if ds else ''
            h = re.search(r'/image/(\d+)', ds) or re.search(r'__(\d+)\.\w+$', ds.split('?')[0])
            if h:
                anchors[(d, h.group(1))] = [tail(u) for u in re.findall(r'src="([^"]*)"', inner)]
    tally, changed = collections.Counter(), 0
    for r in v0['rows']:
        if r.get('v0Document') != 'NOT_ACQUIRED' or r['assetId'] not in corpus:
            continue
        docs = set()
        for m in corpus[r['assetId']]['memberships']:
            if not m['channel'].startswith('CAROUSEL') or m.get('via') == 'floor-fragment':
                continue
            h = re.search(r'__(\d+)\.\w+$', m['url'])
            key = m['editionKey'].split(':')[0].split('.')[0] + '_' + m['editionKey'].split(':')[1]
            for u in anchors.get((key, h.group(1)) if h else None, []):
                docs |= prod.get((key, u), set())
        t = truth.get(r['assetId'], {})
        tally[f"{t.get('roleTruth')}|{'+'.join(sorted(docs)) or 'none'}"] += 1
        if len(docs) == 1:
            doc = docs.pop()
            r.update(v0Document=doc, detail='LINEAGE(carousel anchor thumbnail)', role=V0_MAP[doc])
            r['resolved'] = r['role'] != 'UNKNOWN'
            changed += 1
    v0['meta'] = dict(v0['meta'], contender='V0a', addendum='C3 lineage-mapped (post-hoc)')
    json.dump(v0, open(out_p, 'w'), indent=1, sort_keys=True)
    print(json.dumps({'mapped': changed, 'byTruthAndIncumbentRole': dict(tally.most_common())}))


if __name__ == '__main__':
    main(*sys.argv[1:7])
