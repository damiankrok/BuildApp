#!/usr/bin/env python3
"""
acquire.py — BUILDPLAN-ANALYZER-005R corpus acquisition (RESEARCH ONLY; never imported by production).

Fetches public project pages of the publishers already used in development (archon.pl, dobredomy.pl and one
republishing host of an ARCHON project) and their project images into a work directory OUTSIDE the repository.
Pixels, page HTML and captions never enter Git; only the manifest of hashes, URLs and normalised structural labels
does (see build_manifest.py).

    python3 -I research/analyzer-005r/acquire.py survey <work-dir> <edition-universe.json>
    python3 -I research/analyzer-005r/acquire.py fetch  <work-dir>

Politeness and lawfulness:
  * robots.txt of every host is honoured (urllib.robotparser); DobreDomy disallows URLs with a query string, so only
    the clean originals (/dd_files/Image/projekty/<code>/<file>) are fetched there.
  * one request per REQUEST_GAP_S seconds, one connection, a descriptive User-Agent, a byte cap per response.
  * only hosts in HOST_ALLOW are contacted; nothing is uploaded anywhere.

Structural label channels (recorded per candidate; the scorer decides what counts as truth, see preregistration.md):
  ARCHON  carousel `data-fancybox-position` (fancybox3Interiors / Floor / CrossSection / Elevations / ...), the page's
          elevation tab, floor fragments, the hotspot endpoint that resolves a carousel id to the full-size original.
  DOBREDOMY  the page section (`<h4>` heading: Elewacje / Rzuty / Przekroje) and figcaption, and the slider.
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

UA = 'BuildApp-research-005R/0.1 (offline evaluation of publicly published house-project pages; contact: repository owner)'
REQUEST_GAP_S = 1.0
MAX_BYTES = 12 * 1024 * 1024
HOST_ALLOW = {'www.archon.pl', 'assets.archon.pl', 'cdn1.archon.pl', 'www.dobredomy.pl', 'www.projektydomownowoczesnych.pl'}
# Publisher terms that prohibit the intended local automated processing (brief §4 → SOURCE_NOT_USABLE). Recorded
# during the 005R survey, before any image of the publisher was fetched; its images are never fetched by 005R.
SOURCE_NOT_USABLE = {
    'www.dobredomy.pl': 'Regulamin §7.2: copying, modifying, electronic transmission, reproduction, use and distribution of '
                        'the site materials only with the Seller\'s consent — no consent is recorded for 005R',
}

_last = [0.0]
_robots = {}


def allowed(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != 'https' or p.hostname not in HOST_ALLOW:
        return False
    rp = _robots.get(p.hostname)
    if rp is None:
        rp = urllib.robotparser.RobotFileParser()
        try:
            raw = _get(f'https://{p.hostname}/robots.txt', check=False)[0]
            text = raw.decode('utf-8', 'replace') if raw else ''
            # cdn1.archon.pl answers "Not found" (no robots file): no restriction
            rp.parse(text.splitlines() if 'user-agent' in text.lower() else [])
        except Exception:
            rp.parse([])
        _robots[p.hostname] = rp
    return rp.can_fetch(UA, url) and rp.can_fetch('*', url)


def _get(url, check=True, xhr=False):
    if check and not allowed(url):
        return None, 'ROBOTS_OR_HOST_DISALLOWED', None
    wait = REQUEST_GAP_S - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.time()
    headers = {'User-Agent': UA}
    if xhr:
        headers['X-Requested-With'] = 'XMLHttpRequest'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            final = r.geturl()
            if urllib.parse.urlsplit(final).hostname not in HOST_ALLOW:
                return None, 'REDIRECT_OFF_ALLOWLIST', final
            data = r.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                return None, 'TOO_LARGE', final
            return data, r.headers.get('Content-Type', ''), final
    except urllib.error.HTTPError as e:
        return None, f'HTTP_{e.code}', url
    except Exception as e:  # network failure is recorded, never hidden
        return None, f'ERROR_{type(e).__name__}', url


def sha(b):
    return hashlib.sha256(b).hexdigest()


def edition_key(url):
    m = re.search(r'-(m[0-9a-f]{8,})(?:[/?#]|$)', url) or re.search(r'/p,(m[0-9a-f]{8,}),', url)
    if 'archon.pl' in url and m:
        return f'archon:{m.group(1)}'
    if 'projektydomownowoczesnych.pl' in url and m:
        return f'archon:{m.group(1)}'  # the republished page carries the ARCHON project code: same edition, other host
    m = re.search(r'dobredomy\.pl/projekt/([^/?#]+)', url)
    if m:
        return f'dobredomy:{m.group(1)}'
    raise ValueError(url)


def publisher_of(url):
    host = urllib.parse.urlsplit(url).hostname
    return {'www.archon.pl': 'archon.pl', 'www.dobredomy.pl': 'dobredomy.pl', 'www.projektydomownowoczesnych.pl': 'projektydomownowoczesnych.pl'}[host]


def attr(tag, name):
    m = re.search(name + r'\s*=\s*"([^"]*)"', tag)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------------------------------------- ARCHON
def archon_candidates(page_html, carousel_html, code, fetch_text):
    """Every product image of one ARCHON edition with its structural channel. Never classifies by filename alone."""
    cands = []
    prod = re.compile(r'https://(?:assets|cdn1)\.archon\.pl/images/products/' + code + r'/[^"\'\s<>)&]+\.(?:jpg|jpeg|png|gif|webp)', re.I)

    # carousel: each <a> carries a fancybox position (or none) and a modal id or a direct data-src
    for m in re.finditer(r'<a\s[^>]*data-fancybox="pg1"[^>]*>', carousel_html or '', re.S):
        a = m.group(0)
        pos = re.search(r'data-fancybox-position=\s*"?([A-Za-z0-9]+)', a)
        pos = pos.group(1) if pos else 'NONE'
        cap = attr(a, 'data-caption') or ''
        link = attr(a, 'data-images-modal-link') or ''
        src = attr(a, 'data-src') or ''
        if src.startswith('/product_fancybox_hotspot/'):
            body = fetch_text('https://www.archon.pl' + src.split('?')[0] + '?showHotspots=false', xhr=True)
            for u in prod.findall(body or ''):
                cands.append({'url': u, 'channel': f'CAROUSEL:{pos}', 'caption': cap, 'modal': link, 'via': 'hotspot'})
        elif src.startswith('/product_fancybox_floor/'):
            body = fetch_text('https://www.archon.pl' + src, xhr=True)
            for u in sorted(set(prod.findall(body or ''))):
                cands.append({'url': u, 'channel': f'CAROUSEL:{pos}', 'caption': cap, 'modal': link, 'via': 'floor-fragment'})
        elif src.startswith('/images/products/'):
            cands.append({'url': 'https://assets.archon.pl' + src, 'channel': f'CAROUSEL:{pos}', 'caption': cap, 'modal': link, 'via': 'data-src'})
    # further floors not in the carousel
    for path in sorted(set(re.findall(r'/product_fancybox_floor/' + code + r'/\d+', page_html))):
        if any(c['via'] == 'floor-fragment' and path in c.get('src', '') for c in cands):
            continue
        body = fetch_text('https://www.archon.pl' + path, xhr=True)
        for u in sorted(set(prod.findall(body or ''))):
            cands.append({'url': u, 'channel': 'PAGE:floor-fragment', 'caption': '', 'modal': path, 'via': 'floor-fragment'})
    # the page's elevation tab: anchors positioned fancybox3Elevations wrap the drawing
    for m in re.finditer(r'<a\s[^>]*data-fancybox-position="fancybox3Elevations"[^>]*>', page_html):
        a = m.group(0)
        for k in ('href', 'data-src'):
            v = attr(a, k)
            if v and re.search(r'\.(jpg|png|gif|webp)', v):
                cands.append({'url': v if v.startswith('http') else 'https://assets.archon.pl' + v, 'channel': 'PAGE:elevations-tab', 'caption': attr(a, 'title') or '', 'modal': '', 'via': 'page'})
    # main image(s) of the product header
    for m in re.finditer(r'<a\s[^>]*data-fancybox-position="(fancybox3ProdBigImg\d*)"[^>]*>', page_html):
        a = m.group(0)
        src = attr(a, 'data-src') or ''
        if src.startswith('/product_fancybox_hotspot/'):
            body = fetch_text('https://www.archon.pl' + src.split('?')[0] + '?showHotspots=false', xhr=True)
            for u in prod.findall(body or ''):
                cands.append({'url': u, 'channel': f'PAGE:{m.group(1)}', 'caption': attr(a, 'data-caption') or attr(a, 'title') or '', 'modal': '', 'via': 'hotspot'})
    # every other product image on the page (thumbnails, og:image, site plan) — channel PAGE:other, truth decided later
    for u in sorted(set(prod.findall(page_html))):
        cands.append({'url': u, 'channel': 'PAGE:other', 'caption': '', 'modal': '', 'via': 'page'})
    return cands


# ------------------------------------------------------------------------------------------------------ DOBREDOMY
def dobredomy_candidates(page_html, code):
    cands = []
    base = re.escape(f'https://www.dobredomy.pl/dd_files/Image/projekty/{code}/')
    for m in re.finditer(r'data-lightboxsource="(' + base + r'[^"?]+)"', page_html):
        cands.append({'url': m.group(1), 'channel': 'DD:slider', 'caption': '', 'modal': '', 'via': 'page'})
    # sections: <h4 ...>Heading</h4> ... <figure><img src=...><figcaption>...</figcaption>
    for sec in re.finditer(r'<h4[^>]*>\s*([^<]{2,40}?)\s*</h4>(.*?)(?=<h4|<footer|$)', page_html, re.S):
        head = sec.group(1).strip()
        for f in re.finditer(r'<figure>\s*<img[^>]+src="(' + base + r'[^"?]+)"[^>]*>\s*<figcaption>\s*([^<]*?)\s*</figcaption>', sec.group(2), re.S):
            cands.append({'url': f.group(1), 'channel': f'DD:section:{head}', 'caption': f.group(2), 'modal': '', 'via': 'page'})
    for u in sorted(set(re.findall(r'(' + base + r'[^"?\s]+\.(?:jpg|jpeg|png|webp))', page_html))):
        cands.append({'url': u, 'channel': 'DD:other', 'caption': '', 'modal': '', 'via': 'page'})
    return cands


def alt_candidates(page_html, code):
    cands = []
    for u in sorted(set(re.findall(r'https://[a-z0-9.]+/[^"\'\s<>]*' + code + r'[^"\'\s<>]*\.(?:jpg|jpeg|png|webp)', page_html, re.I))):
        if urllib.parse.urlsplit(u).hostname in HOST_ALLOW:
            cands.append({'url': u, 'channel': 'ALT:page', 'caption': '', 'modal': '', 'via': 'page'})
    return cands


def survey(work, universe_path):
    uni = json.load(open(universe_path))
    out = []
    os.makedirs(os.path.join(work, 'pages'), exist_ok=True)

    def fetch_text(url, xhr=False):
        data, ctype, final = _get(url, xhr=xhr)
        return data.decode('utf-8', 'replace') if data else None

    for url in uni['all']:
        key = edition_key(url)
        pdir = os.path.join(work, 'pages', key.replace(':', '_') + ('' if 'projektydomownowoczesnych' not in url else '_alt'))
        os.makedirs(pdir, exist_ok=True)
        data, ctype, final = _get(url)
        rec = {'editionKey': key, 'canonicalRequested': url, 'publisher': publisher_of(url), 'pageStatus': ctype if data is None else 'OK', 'finalUrl': final}
        if data is None:
            out.append({**rec, 'candidates': []})
            print('FAIL', url, ctype, flush=True)
            continue
        html = data.decode('utf-8', 'replace')
        open(os.path.join(pdir, 'page.html'), 'w').write(html)
        rec['pageSha256'] = sha(data)
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        rec['canonicalUrl'] = canon.group(1) if canon else final
        title = re.search(r'<title>\s*([^<]*?)\s*</title>', html, re.S)
        rec['title'] = title.group(1).strip() if title else None
        if rec['publisher'] == 'archon.pl':
            code = key.split(':')[1]
            car = fetch_text(f'https://www.archon.pl/products/{code}/carousel_images', xhr=True) or ''
            open(os.path.join(pdir, 'carousel.html'), 'w').write(car)
            cands = archon_candidates(html, car, code, fetch_text)
        elif rec['publisher'] == 'dobredomy.pl':
            code = key.split(':')[1]
            cands = dobredomy_candidates(html, code)
        else:
            cands = alt_candidates(html, key.split(':')[1])
        rec['candidates'] = cands
        out.append(rec)
        chans = {}
        for c in cands:
            chans[c['channel']] = chans.get(c['channel'], 0) + 1
        print(key, rec['publisher'], len(cands), json.dumps(chans), flush=True)
    json.dump(out, open(os.path.join(work, 'survey.json'), 'w'), indent=1)


def fetch(work):
    sv = json.load(open(os.path.join(work, 'survey.json')))
    imgdir = os.path.join(work, 'images')
    os.makedirs(imgdir, exist_ok=True)
    fetched = {}
    path = os.path.join(work, 'fetched.json')
    if os.path.exists(path):
        fetched = json.load(open(path))
    urls = sorted({c['url'] for e in sv for c in e['candidates']})
    for i, u in enumerate(urls):
        if u in fetched and fetched[u].get('sha256'):
            continue
        host = urllib.parse.urlsplit(u).hostname
        if host in SOURCE_NOT_USABLE:
            fetched[u] = {'status': 'SOURCE_NOT_USABLE', 'reason': SOURCE_NOT_USABLE[host]}
            continue
        data, ctype, final = _get(u)
        if data is None:
            fetched[u] = {'status': ctype}
        else:
            h = sha(data)
            ext = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp'}.get(ctype.split(';')[0].strip(), 'bin')
            p = os.path.join(imgdir, f'{h}.{ext}')
            if not os.path.exists(p):
                open(p, 'wb').write(data)
            fetched[u] = {'status': 'OK', 'sha256': h, 'bytes': len(data), 'mediaType': ctype, 'finalUrl': final, 'file': os.path.basename(p)}
        if i % 25 == 0:
            json.dump(fetched, open(path, 'w'), indent=1)
            print(f'{i}/{len(urls)}', flush=True)
    json.dump(fetched, open(path, 'w'), indent=1)
    print('done', len(urls), sum(1 for v in fetched.values() if v.get('status') == 'OK'))


REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def outside_repo(work):
    w = os.path.realpath(work)
    if w == REPO or w.startswith(REPO + os.sep):
        raise SystemExit('REFUSED: publisher bytes never go inside the repository (brief §4)')
    return w


if __name__ == '__main__':
    cmd = sys.argv[1]
    if len(sys.argv) > 2:
        outside_repo(sys.argv[2])
    if cmd == 'survey':
        survey(sys.argv[2], sys.argv[3])
    elif cmd == 'fetch':
        fetch(sys.argv[2])
    else:
        sys.exit('usage: acquire.py survey|fetch <work> [universe.json]')
