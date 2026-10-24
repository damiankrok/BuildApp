"""IU-02 one-time preparation (ONLINE). Images from the Library of Congress HABS/HAER/HALS collection (measured
drawings and survey photographs made by the U.S. Government: "No known restrictions"), 1024 px reference copies.

Pixels go OUTSIDE the repository; the manifest holds text facts only (title, survey id, rights statement, item URL,
sha256), which is what may be committed. The query is a search hint, never a label: every image is labelled afterwards
by looking at it. Each survey (`pk`) is assigned to DEV or FINAL here, by a hash of its id, so no survey crosses splits.
Items whose subjects say they are photocopies of other sources are skipped (their rights may differ).
"""
import argparse, hashlib, http.client, json, os, sys, time, urllib.error, urllib.parse, urllib.request

UA = 'BuildPlan-IU02-research/0.1 (offline image-role research)'
SEARCH = 'https://www.loc.gov/pictures/search/'
RIGHTS = 'No known restrictions on images made by the U.S. Government (HABS/HAER/HALS); http://www.loc.gov/rr/print/res/114_habs.html'


def fetch(url):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 4:
                raise
            time.sleep(20 * (attempt + 1))
        except (http.client.IncompleteRead, ConnectionError, TimeoutError, urllib.error.URLError) as e:
            # a transfer cut off by the proxy is retried, not mistaken for a missing file
            if attempt == 4:
                raise urllib.error.URLError(f'gave up after retries: {e!r}')
            time.sleep(5 * (attempt + 1))


def split_of(pk):
    return 'DEV' if int(hashlib.sha256(f'IU02-loc-split:{pk}'.encode()).hexdigest()[:8], 16) % 10 < 5 else 'FINAL'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--queries', required=True, help='JSON list of [term, count, page]')
    a = ap.parse_args()
    repo = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    if os.path.realpath(a.out).startswith(repo):
        sys.exit('REFUSED: third-party pixels stay outside the repository')
    os.makedirs(a.out, exist_ok=True)
    mpath = os.path.join(a.out, 'loc-manifest.json')
    rows = json.load(open(mpath)) if os.path.exists(mpath) else []
    seen = {r['fetchedUrl'] for r in rows}
    per_survey = {}
    for r in rows:
        per_survey[r['survey']] = per_survey.get(r['survey'], 0) + 1
    for term, count, page in json.loads(a.queries):
        q = urllib.parse.urlencode({'q': term, 'co': 'hh', 'fo': 'json', 'c': count, 'sp': page})
        try:
            res = json.loads(fetch(f'{SEARCH}?{q}'))['results']
        except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
            print('query failed', term, e, file=sys.stderr); continue
        for r in res:
            subj = ' '.join(r.get('subjects') or []).lower()
            full = (r.get('image') or {}).get('full') or ''
            if 'photocop' in subj or 'photocop' in (r.get('title') or '').lower() or not full.endswith('r.jpg'):
                continue
            url = full[:-5] + 'v.jpg'
            pk = r.get('pk') or ''
            if url in seen or per_survey.get(pk, 0) >= 3:  # a few images per survey: breadth over one building
                continue
            try:
                b = fetch(url)
            except urllib.error.URLError as e:
                print('skip', url, e, file=sys.stderr); continue
            sha = hashlib.sha256(b).hexdigest()
            open(os.path.join(a.out, sha + '.jpg'), 'wb').write(b)
            seen.add(url); per_survey[pk] = per_survey.get(pk, 0) + 1
            rows.append({'sha256': sha, 'file': sha + '.jpg', 'title': (r.get('title') or '')[:300], 'survey': pk, 'split': split_of(pk),
                         'callNumber': r.get('call_number'), 'medium': r.get('medium_brief'), 'itemUrl': (r.get('links') or {}).get('item'),
                         'fetchedUrl': url, 'rights': RIGHTS, 'searchHint': term})
            json.dump(rows, open(mpath, 'w'), indent=1)
            time.sleep(1.0)
        json.dump(rows, open(mpath, 'w'), indent=1)
        time.sleep(3)
    print(len(rows), 'files', {s: sum(r['split'] == s for r in rows) for s in ('DEV', 'FINAL')})


if __name__ == '__main__':
    main()
