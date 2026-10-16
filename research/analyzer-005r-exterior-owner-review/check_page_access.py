#!/usr/bin/env python3
"""
check_page_access.py — can the OWNER still reach each queued image on the public project page? (RESEARCH ONLY)

    python3 -I research/analyzer-005r-exterior-owner-review/check_page_access.py <page-text cache dir OUTSIDE the repo>

Per edition: one GET of the public project page (HTML text, kept outside the repository, never committed) and, only
for an anchor the page still references by its publisher image number, one GET of that image's fancybox page (HTML
text). Per question: one HTTP HEAD of the anchor's 005R-recorded image address — headers only, **no image byte is
downloaded, stored, decoded or shown to anyone**. The committed result holds booleans, status codes and counts, no URL.

Byte identity is NOT proven here: an unchanged length at an unchanged address is a strong hint only. The proof is the
SHA-256 the review page computes on the OWNER's machine.
"""
import datetime
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.realpath(os.path.join(HERE, '..', '..'))
M005R = os.path.join(REPO, 'stage-reports', 'artifacts', 'analyzer-005r', 'corpus', 'corpus-manifest.json')
ALLOWED_HOSTS = ('https://www.archon.pl/', 'https://cdn1.archon.pl/', 'https://assets.archon.pl/')


def refuse_inside_repo(p):
    real = os.path.realpath(p)
    if real == REPO or real.startswith(REPO + os.sep):
        sys.exit(f'REFUSED: publisher pages stay outside the repository ({p})')


def curl(args, url):
    if not url.startswith(ALLOWED_HOSTS):
        raise SystemExit(f'host not allowed: {url}')
    r = subprocess.run(['curl', '-sS', '--max-time', '40', *args, url], capture_output=True, text=True)
    return r.stdout


def head(url):
    out = curl(['-I'], url)  # no redirect following: a redirect is reported, never followed to another host
    status = [int(m.group(1)) for m in re.finditer(r'^HTTP/[\d.]+ (\d{3})', out, re.M)]  # last one is the final response
    final = status[-1] if status else 0
    lens = re.findall(r'^content-length:\s*(\d+)', out, re.M | re.I)
    ctype = re.findall(r'^content-type:\s*([^\s;]+)', out, re.M | re.I)
    return final, int(lens[-1]) if lens else None, ctype[-1] if ctype else None


def main(cache_dir):
    refuse_inside_repo(cache_dir)
    os.makedirs(cache_dir, exist_ok=True)
    queue = json.load(open(os.path.join(HERE, 'pack', 'queue.json')))
    m5 = json.load(open(M005R))
    m5a = {a['variantSha256']: a for a in m5['assets']}
    requests = {'GET_page': 0, 'GET_fancybox_page': 0, 'HEAD_image': 0, 'imageBytesDownloaded': 0}
    pages = {}
    for edition in sorted({q['projectEditionId'] for q in queue['questions']}):
        url = m5['editions'][edition]['canonicalUrls'][0]
        p = os.path.join(cache_dir, edition.split(':')[1] + '.html')
        code = curl(['-o', p, '-w', '%{http_code}'], url)
        requests['GET_page'] += 1
        pages[edition] = (int(code or 0), open(p, encoding='utf-8', errors='replace').read() if os.path.exists(p) else '')
    rows, heads = [], {}
    for q in queue['questions']:
        edition = q['projectEditionId']
        status, html = pages[edition]
        urls = sorted(x['url'] for x in m5a[q['anchorByteHash']]['memberships'] if x['editionKey'] == edition)
        size = m5a[q['anchorByteHash']]['bytes']
        referenced, via = False, None
        for u in urls:
            base = u.rsplit('/', 1)[-1]
            num = re.search(r'__(\d+)\.', base)
            if base in html:
                referenced, via = True, 'PAGE_HTML'
            elif num and re.search(r'/product_fancybox_hotspot/' + edition.split(':')[1] + r'/image/' + num.group(1) + r'\b', html):
                fb = os.path.join(cache_dir, f"fb-{edition.split(':')[1]}-{num.group(1)}.html")
                if not os.path.exists(fb):
                    curl(['-o', fb], f"https://www.archon.pl/product_fancybox_hotspot/{edition.split(':')[1]}/image/{num.group(1)}?showHotspots=false")
                    requests['GET_fancybox_page'] += 1
                if base in open(fb, encoding='utf-8', errors='replace').read():
                    referenced, via = True, 'HERO_FANCYBOX'
        same = False
        hs = []
        for u in urls:
            if u not in heads:
                heads[u] = head(u)
                requests['HEAD_image'] += 1
            code, length, ctype = heads[u]
            hs.append(code)
            same = same or (code == 200 and length == size)
        access = ('REFERENCED_SAME_LENGTH' if referenced and same else
                  'UNLINKED_URL_SAME_LENGTH' if same else
                  'REFERENCED_LENGTH_CHANGED' if referenced else 'CHANGED_OR_GONE')
        rows.append({'questionId': q['questionId'], 'access': {'class': access, 'pageStatus': status, 'referencedOnCurrentPage': referenced,
                                                               'referencedVia': via, 'headStatus': sorted(set(hs)), 'sameLengthAsCached': same}})
    by_class = {}
    for r in rows:
        by_class[r['access']['class']] = by_class.get(r['access']['class'], 0) + 1
    img_class = {}
    for q, r in zip(queue['questions'], rows):
        img_class[q['imageId']] = r['access']['class']
    out = {'schema': 'research.005r-exterior.owner-review-page-access.0.1', 'packId': queue['packId'],
           'checkedOn': datetime.date.today().isoformat(), 'requests': requests,
           'byteIdentity': 'NOT_PROVEN_HERE: same address and same length only; the review page proves it by SHA-256 on the reviewer machine',
           'questionsByClass': dict(sorted(by_class.items())),
           'imagesByClass': {k: sum(1 for v in img_class.values() if v == k) for k in sorted(set(img_class.values()))},
           'rows': rows}
    with open(os.path.join(HERE, 'results', 'page-access.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(out, sort_keys=True, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({k: out[k] for k in ['requests', 'questionsByClass', 'imagesByClass']}, indent=1))


if __name__ == '__main__':
    main(sys.argv[1])
