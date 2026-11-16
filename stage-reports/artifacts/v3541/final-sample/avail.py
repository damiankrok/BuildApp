"""Availability rule of the v3.54.1 final sample (fixed before the draw; source metadata only, no analyzer output):
package acquired by the product path; >=3 decoded pictures with short side >=200 px; >=1 published numeric figure
(amended before its first application: US pages publish building dimensions, not areas)."""
import json, os, sys
D = '/home/user/rd/v3541'
LOG = D + '/acquire-log.jsonl'
AREA_KEYS = ('usable_area', 'footprint_area', 'living_area', 'total_area', 'floor_area', 'net_area', 'gross_area', 'heated_area')

def entries():
    if not os.path.exists(LOG): return []
    return [json.loads(l) for l in open(LOG) if l.strip()]

def judge(pub, i, fam, url, slug):
    pkg_path = f'{D}/final/{slug}/source-package.json'
    if not os.path.exists(pkg_path):
        return {'publisher': pub, 'order': int(i), 'family': fam, 'url': url, 'slug': slug, 'available': False, 'why': 'NOT_ACQUIRED'}
    p = json.load(open(pkg_path))
    big = 0
    for a in p['assets']:
        v = next((x for x in a['variants'] if x['id'] == a.get('selectedVariantId')), a['variants'][0] if a['variants'] else None)
        d = (v or {}).get('decoded') or {}
        if min(d.get('width', 0), d.get('height', 0)) >= 200: big += 1
    areas = [f['key'] for f in p['publishedFacts'] if isinstance(f.get('value'), (int, float))]
    ok = big >= 3 and len(areas) >= 1
    why = 'OK' if ok else ('FEWER_THAN_3_PICTURES' if big < 3 else 'NO_PUBLISHED_FIGURE')
    return {'publisher': pub, 'order': int(i), 'family': fam, 'url': url, 'slug': slug, 'available': ok, 'why': why, 'pictures200': big, 'figures': areas, 'contentHash': p['contentHash'], 'assets': len(p['assets']), 'failures': len(p['failures'])}

cmd = sys.argv[1]
if cmd == 'count':
    print(sum(1 for e in entries() if e['publisher'] == sys.argv[2] and e['available']))
elif cmd == 'judge':
    print(json.dumps(judge(*sys.argv[2:7])))
elif cmd == 'list':
    for e in entries():
        if e['available']: print(f"FINAL {e['publisher']} {D}/final {D}/final/cache {e['slug']} {e['url']}")
