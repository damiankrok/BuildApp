"""IU-03A dev inputs: the IU-02 FINAL images (now DEVELOPMENT data for IU-03A, never a blind set again) with the inputs
the LEGACY text path needs. Writes legacy-in-<scenario>.json for iu3/legacy_roles.ts, outside the repository.

  REAL      ARCHON only: the publisher's own address, channel and caption (IU-01 test images: the 005R production
            acquisition V0a routes, exact; IU-02 FINAL_ARCHON: the survey's address and caption through the production
            role rules, channel IMG_SRC — an approximation of the acquisition, said so in the report).
  ADVERSE   every image, whatever it shows, published under an ARCHON-shaped address whose slug says
            "elewacja-frontowa": the publisher is wrong on purpose and LEGACY sends everything to the facade extractor.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo
from iu2 import data
import iu2_final

W3 = os.environ.get('IU_WORK3', '/home/user/workiu03')
ADVERSE_URL = 'https://assets.archon.pl/images/products/m0123456789ab/elewacja-frontowa-projekt-dom-w-testach-{h}__265.jpg'


def main():
    refuse_inside_repo(W3, 'IU-03A work'); os.makedirs(W3, exist_ok=True)
    rows = iu2_final.final_rows(['FINAL_LOC', 'FINAL_SYNTH', 'FINAL_ARCHON', 'IU01_TEST'])
    man = {a['variantSha256']: a for a in json.load(open(os.path.join(data.ROOT, '..', '..', 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')))['assets']}
    v0a = {r['assetId']: r for r in json.load(open(os.path.join(data.ROOT, '..', '..', 'stage-reports/artifacts/analyzer-005r/contenders/V0a-routes.json')))['rows']}
    fetched = json.load(open('/home/user/workiu02/archon-final-acq/fetched.json'))
    survey = json.load(open('/home/user/workiu02/archon-final-acq/survey.json'))
    cap = {c['url']: (c.get('caption'), e['finalUrl']) for e in survey for c in e['candidates']}
    by_sha = {}
    for url, f in fetched.items():
        if f.get('status') == 'OK':
            by_sha.setdefault(f['sha256'], url)
    real, adverse = [], []
    for r in rows:
        adverse.append({'key': r['key'], 'url': ADVERSE_URL.format(h=r['key'][:32].ljust(32, '0'))})
        if r['set'] == 'IU01_TEST':
            doc = v0a[man[r['key']]['assetId']]['v0Document']
            roles = None if doc == 'NOT_ACQUIRED' else {'document': doc, 'projection': {'ELEVATION': 'ORTHOGRAPHIC_ELEVATION', 'PERSPECTIVE_RENDER': 'PERSPECTIVE'}.get(doc, 'NOT_APPLICABLE'),
                                                        'view': (v0a[man[r['key']]['assetId']]['v0Views'] or ['UNKNOWN'])[0], 'source': 'V0a production acquisition'}
            real.append({'key': r['key'], 'roles': roles} if roles else {'key': r['key'], 'notAcquired': True})
        elif r['set'] == 'FINAL_ARCHON':
            url = by_sha[r['key']]
            c, page = cap.get(url, (None, ''))
            real.append({'key': r['key'], 'url': url, 'caption': c, 'exposedBy': page})
    real_in = [x for x in real if not x.get('notAcquired')]
    json.dump(real_in, open(os.path.join(W3, 'legacy-in-real.json'), 'w'))
    json.dump([x['key'] for x in real if x.get('notAcquired')], open(os.path.join(W3, 'legacy-not-acquired.json'), 'w'))
    json.dump(adverse, open(os.path.join(W3, 'legacy-in-adverse.json'), 'w'))
    print('real', len(real_in), 'not acquired', len(real) - len(real_in), 'adverse', len(adverse))


if __name__ == '__main__':
    main()
