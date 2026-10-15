#!/usr/bin/env python3
"""
seed_cache.py — fill the production SourceByteCache layout (packages/source-package/src/cache.ts: <dir>/<sha256(url)[:32]>
.bin/.type[/.url]) with the bytes the 005R survey already fetched, so the production acquirer reads the same bytes the
contenders see (RESEARCH ONLY). Existing cache entries are never overwritten: a replay must not change under itself.

    python3 -I seed_cache.py <work-dir> <cache-dir>
"""
import hashlib
import json
import os
import sys


def put(cache, url, data, mtype, final=None, link_from=None):
    base = os.path.join(cache, hashlib.sha256(url.encode('utf-8')).hexdigest()[:32])
    if os.path.exists(base + '.bin'):
        return 0
    if link_from:
        os.link(link_from, base + '.bin')  # same bytes, no second copy on a nearly full disk
    else:
        open(base + '.bin', 'wb').write(data)
    open(base + '.type', 'w').write(mtype)
    if final and final != url:
        open(base + '.url', 'w').write(final)
    return 1


def main(work, cache):
    os.makedirs(cache, exist_ok=True)
    survey = json.load(open(os.path.join(work, 'survey.json')))
    fetched = json.load(open(os.path.join(work, 'fetched.json'))) if os.path.exists(os.path.join(work, 'fetched.json')) else {}
    n = 0
    for e in survey:
        name = e['editionKey'].replace(':', '_') + ('_alt' if e['publisher'] == 'projektydomownowoczesnych.pl' else '')
        page = os.path.join(work, 'pages', name, 'page.html')
        if os.path.exists(page):
            n += put(cache, e['canonicalRequested'], open(page, 'rb').read(), 'text/html; charset=utf-8', e.get('finalUrl'))
        car = os.path.join(work, 'pages', name, 'carousel.html')
        if os.path.exists(car) and e['publisher'] == 'archon.pl':
            code = e['editionKey'].split(':')[1]
            n += put(cache, f'https://www.archon.pl/products/{code}/carousel_images', open(car, 'rb').read(), 'text/html; charset=utf-8')
    for url, f in fetched.items():
        if f.get('status') == 'OK':
            n += put(cache, url, None, f['mediaType'].split(';')[0].strip(), f.get('finalUrl'), link_from=os.path.join(work, 'images', f['file']))
    print(f'seeded {n} new cache entries into {cache}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
