"""IU-01 one-time preparation (ONLINE). Thumbnails are requested at 500 px, a width Commons pre-renders (other
widths are refused with 429).

Fetch a small, freely licensed out-of-distribution image set from Wikimedia
Commons, for testing only (never trained on). Writes pixels OUTSIDE the repository; prints a manifest of text facts
(title, licence, author credit, source URL, sha256) which is the only thing that may be committed.

The query term is a search hint, never a label: every image is labelled afterwards by looking at it.
Only Public Domain, CC0, CC BY and CC BY-SA files are kept.
"""
import argparse, hashlib, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = 'https://commons.wikimedia.org/w/api.php'
UA = 'BuildPlan-IU01-research/0.1 (offline image-role research; contact via repository owner)'
OK_LICENCES = ('public domain', 'pd', 'cc0', 'cc by', 'cc-by', 'cc by-sa', 'cc-by-sa')

def fetch(url):
    """GET with polite backoff: Commons answers bursts with 429, which is a request to wait, not a failure."""
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            time.sleep(30 * (attempt + 1))

def get(params):
    return json.loads(fetch(f'{API}?{urllib.parse.urlencode({**params, "format": "json"})}'))

def licence_ok(name):
    n = (name or '').lower()
    return any(n.startswith(p) for p in OK_LICENCES) and 'nc' not in n.split() and '-nc' not in n and ' nc' not in n and 'nd' not in n.replace('and', '')

def search(term, limit):
    d = get({'action': 'query', 'generator': 'search', 'gsrsearch': f'filetype:bitmap {term}', 'gsrnamespace': 6, 'gsrlimit': limit,
             'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': 500})
    return list(d.get('query', {}).get('pages', {}).values())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--queries', required=True, help='JSON list of [term, limit]')
    a = ap.parse_args()
    repo = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    if os.path.realpath(a.out).startswith(repo):
        sys.exit('REFUSED: third-party pixels stay outside the repository')
    os.makedirs(a.out, exist_ok=True)
    rows, seen = [], set()
    mpath = os.path.join(a.out, 'commons-manifest.json')
    if os.path.exists(mpath):  # resumable: a refused query can be re-run later without refetching the rest
        rows = json.load(open(mpath)); seen = {r['title'] for r in rows}
    for term, limit in json.loads(a.queries):
        try:
            found = search(term, limit)
        except urllib.error.HTTPError as e:
            print('query refused', term, e.code, file=sys.stderr); continue
        for p in found:
            ii = (p.get('imageinfo') or [{}])[0]
            meta = ii.get('extmetadata', {})
            lic = meta.get('LicenseShortName', {}).get('value', '')
            if not licence_ok(lic) or ii.get('mime') not in ('image/jpeg', 'image/png') or p['title'] in seen:
                continue
            seen.add(p['title'])
            url = ii.get('thumburl') or ii.get('url')
            try:
                b = fetch(url)
            except urllib.error.URLError as e:
                print('skip', p['title'], e, file=sys.stderr); continue
            sha = hashlib.sha256(b).hexdigest()
            ext = '.png' if b[:4] == b'\x89PNG' else '.jpg'
            open(os.path.join(a.out, sha + ext), 'wb').write(b)
            artist = meta.get('Artist', {}).get('value', '')
            rows.append({'sha256': sha, 'file': sha + ext, 'title': p['title'], 'licence': lic, 'credit': artist[:200],
                         'descriptionUrl': ii.get('descriptionurl'), 'fetchedUrl': url, 'searchHint': term})
            time.sleep(6)
        json.dump(rows, open(mpath, 'w'), indent=1)
        time.sleep(60)
    print(len(rows), 'files')

if __name__ == '__main__':
    main()
