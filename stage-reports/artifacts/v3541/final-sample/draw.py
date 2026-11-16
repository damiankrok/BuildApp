"""v3.54.1 final sample: seeded draw, written and run before any candidate development.
Order per publisher = sha256(seed:publisher:k) over the family list; the first families whose page passes the
availability check (acquire.py, source metadata only) are taken. No analyzer output is read at any point.
Usage: python3 -I draw.py  -> writes final-draw.json (the ordered candidate lists; acceptance comes from acquire.py)."""
import hashlib, json, re

SEED_BASIS = "sha256('fca6dad'+'BUILDPLAN-V3541-FINAL')"
SEED = hashlib.sha256(b'fca6dad' + b'BUILDPLAN-V3541-FINAL').hexdigest()
P = '/home/user/rd/v3541/pools/'
WANT = {'archon': 3, 'domywstylu': 3, 'monsterhouseplans': 3, 'houseplans': 3}
CANDIDATES_PER_PUBLISHER = 12  # drawn in order; the first WANT available are taken
# Amendment (after acquisition only, no analyzer output): monsterhouseplans gave 2 available pages in 12 (the product's
# acquisition gets no picture from most of its pages); its order is continued with the same seed up to 30 candidates.
CAP = {'monsterhouseplans': 30}

PREP = {'w', 'we', 'na', 'nad', 'pod', 'przy', 'z', 'ze', 'u', 'za', 'o', 'po', 'od', 'do', 'dla', 'bez'}
def archon_family(slug):
    t = re.sub(r'^projekt-', '', slug).split('-')
    return '-'.join(t[:3] if len(t) > 2 and t[1] in PREP else t[:2])

def locs(path):
    return re.findall(r'<loc>([^<]+)</loc>', open(path, errors='ignore').read())

# --- seen: every family any earlier version analysed, drew or used as regression
seen_archon = set(json.load(open('/home/user/rd/v354/analysed-families.json')))
seen_archon |= {'dom-w-bluszczu', 'dom-w-araliach', 'dom-w-saponariach', 'dom-w-piwoniach',
                'dom-w-supertuniach', 'dom-nad-rzeczka', 'dom-w-nigellach', 'dom-w-toreniach', 'dom-w-nolanach'}
for line in open('/home/user/rd/v354/regress-list.txt'):
    parts = line.split()
    if len(parts) >= 4 and parts[3].startswith('projekt-'):
        seen_archon.add(archon_family(re.sub(r'-m[0-9a-f]{13}$', '', parts[3])))
seen_us_ids = set()
for u in ['sp350881', 'sp365069', 'sp364600']:  # houseplans pages of the v3.54 set
    seen_us_ids.add(u)

pools = {}
# archon: current sitemap, project pages only
au = sorted({u for u in locs(P + 'archon-sitemap.xml') if re.search(r'/projekty-domow/projekt-.+-m[0-9a-f]{13}$', u)})
fam = {}
for u in au:
    f = archon_family(re.search(r'/projekty-domow/(projekt-.+)-m[0-9a-f]{13}$', u).group(1))
    if f not in seen_archon: fam.setdefault(f, []).append(u)
pools['archon'] = fam
# domywstylu: every project page on the 26 listing pages; family = name before the variant suffix
fam = {}
for p in sorted(set(l.strip() for l in open(P + 'dws-projects.txt') if l.strip())):
    f = re.sub(r'_.*$', '', re.sub(r'^projekt-domu-|\.php$', '', p))
    fam.setdefault(f, []).append('https://www.domywstylu.pl/' + p)
pools['domywstylu'] = fam
# monsterhouseplans: one family per plan id (designer-plan); dwellings only (>0 sq ft, >0 bedrooms)
fam = {}
for u in locs(P + 'monster-sitemap.xml'):
    m = re.search(r'/house-plans/[^/]+/((\d+)-sq-ft-home-.*?-(\d+)-bedroom-.*?-plan(\d+-\d+))/?$', u)
    if not m or int(m.group(2)) == 0 or int(m.group(3)) == 0: continue
    fam.setdefault('plan' + m.group(4), set()).add(u.rstrip('/') + '/')
pools['monsterhouseplans'] = {k: sorted(v)[:1] for k, v in fam.items()}
# houseplans: plan pages from the image sitemaps; dwellings only; the v3.54 pages excluded
fam = {}
for u in open(P + 'hp-plans.txt'):
    u = u.strip()
    m = re.search(r'/plan/(\d+)-square-feet-(\d+)-bedroom-.*-(sp\d+)$', u)
    if not m or int(m.group(1)) == 0 or int(m.group(2)) == 0 or m.group(3) in seen_us_ids: continue
    fam.setdefault(m.group(3), []).append(u)
pools['houseplans'] = fam

out = {'seed': SEED, 'seedBasis': SEED_BASIS, 'want': WANT, 'availabilityRule':
       'package acquired by the product path; >=3 decoded pictures with short side >=200 px; >=1 published numeric figure '
       '(amended from "area figure" before its first application: US pages publish building dimensions, not areas). '
       'Source metadata only, fixed before the draw; no analyzer output is read.',
       'seenArchonFamilies': len(seen_archon), 'publishers': {}}
for pub, fams in pools.items():
    names = sorted(fams)
    order, k = [], 0
    while len(order) < min(CAP.get(pub, CANDIDATES_PER_PUBLISHER), len(names)):
        h = int(hashlib.sha256(f'{SEED}:{pub}:{k}'.encode()).hexdigest(), 16); k += 1
        f = names[h % len(names)]
        if f in [o['family'] for o in order]: continue
        us = sorted(fams[f])
        order.append({'family': f, 'url': us[(h // len(names)) % len(us)]})
    out['publishers'][pub] = {'poolFamilies': len(names), 'order': order}
json.dump(out, open('/home/user/rd/v3541/final-draw.json', 'w'), indent=1)
print(json.dumps({p: {'pool': v['poolFamilies'], 'first': [o['family'] for o in v['order'][:5]]} for p, v in out['publishers'].items()}, indent=1))
