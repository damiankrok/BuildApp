#!/usr/bin/env python3
"""Build research/marcowki-v2/source-atlas.json from a sealed SourcePackage and its byte cache.

Evaluation tooling, not production. It reads the package the production acquisition path sealed
(`npm run source:acquire`), decodes every variant from the cached bytes, computes a perceptual hash
(64-bit dHash on a 9x8 greyscale) and groups variants by visual identity: two encodings of one
drawing at different sizes are one VIEW, whatever their URL or asset id says. Then every view is
classified into the atlas vocabulary. Nothing here is consumed by the reconstruction.

usage: python3 atlas.py <package.json> <cache-dir> <out.json>
"""
import hashlib, json, os, sys
from PIL import Image

pkg_path, cache_dir, out_path = sys.argv[1:4]
pkg = json.load(open(pkg_path))

def cache_key(url):
    return hashlib.md5(url.encode()).hexdigest()

def bytes_for(url):
    # the file cache names entries by md5(url); fall back to a sha256 scan of the directory
    for name in os.listdir(cache_dir):
        if not name.endswith('.bin'):
            continue
        p = os.path.join(cache_dir, name)
        yield p

by_hash = {}
for name in os.listdir(cache_dir):
    if name.endswith('.bin'):
        p = os.path.join(cache_dir, name)
        b = open(p, 'rb').read()
        by_hash[hashlib.sha256(b).hexdigest()] = p

def dhash(path):
    im = Image.open(path).convert('L').resize((9, 8), Image.LANCZOS)
    px = im.load()
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (1 if px[x, y] > px[x + 1, y] else 0)
    return bits

def hamming(a, b):
    return bin(a ^ b).count('1')

variants = []
for asset in pkg['assets']:
    for v in asset['variants']:
        p = by_hash.get(v['byteHash'])
        if not p:
            continue
        variants.append({'assetId': asset['id'], 'variantId': v['id'], 'url': v['url'], 'byteHash': v['byteHash'],
                         'decoded': v['decoded'], 'byteLength': v['byteLength'], 'mediaType': v['mediaType'],
                         'roles': asset['roles'], 'caption': asset.get('caption'), 'dhash': dhash(p), 'aspect': v['aspect']})

# group by visual identity: dHash distance <= 10 AND aspect within 3% AND the same annotation role.
# The annotation role is a grouping KEY on purpose: the dimensioned and the area-labelled copies of one
# storey look alike at 9x8 pixels and are different sources with different authority (§3 of the brief).
def annotation_key(v):
    a = v['roles']['annotation']
    return a if a in ('DIMENSIONED', 'AREA_TABLE') else 'NONE'
groups = []
for v in sorted(variants, key=lambda v: -v['decoded']['width'] * v['decoded']['height']):
    placed = False
    for g in groups:
        lead = g[0]
        if annotation_key(lead) != annotation_key(v):
            continue
        if hamming(lead['dhash'], v['dhash']) <= 10 and abs(lead['aspect'] - v['aspect']) / lead['aspect'] <= 0.03:
            g.append(v); placed = True; break
    if not placed:
        groups.append([v])

# ---- classify each view ---------------------------------------------------------------------
def classify(lead):
    r = lead['roles']
    w, h = lead['decoded']['width'], lead['decoded']['height']
    doc = r['document']
    fam = {'FLOOR_PLAN': 'TECHNICAL_PLAN', 'SECTION': 'TECHNICAL_SECTION', 'ELEVATION': 'RENDERED_ELEVATION', 'SITE_PLAN': 'SITE_PLAN', 'PERSPECTIVE_RENDER': 'PERSPECTIVE_RENDER'}.get(doc, 'UNKNOWN')
    proj = r['projection']
    character = 'LINE_DRAWING' if doc in ('FLOOR_PLAN', 'SECTION') else 'RENDERED'
    if doc == 'SITE_PLAN':
        character = 'RENDERED'
    if doc == 'UNKNOWN' and w >= 1600:
        fam, proj, character = 'PERSPECTIVE_RENDER', 'PERSPECTIVE', 'RENDERED'
    if doc == 'UNKNOWN' and w == 400 and h == 300:
        fam, proj, character = 'PERSPECTIVE_RENDER', 'PERSPECTIVE', 'RENDERED'
    annotation = {'DIMENSIONED': 'DIMENSIONED', 'AREA_TABLE': 'AREA_LABELS'}.get(r['annotation'], 'NONE')
    storey = r['storey'] if r['storey'] not in ('NOT_APPLICABLE', 'UNKNOWN') else ('ALL' if doc in ('SECTION', 'ELEVATION', 'PERSPECTIVE_RENDER', 'UNKNOWN') else 'ROOF' if doc == 'SITE_PLAN' else 'UNKNOWN')
    return fam, proj, character, annotation, storey

def orientation(lead, fam):
    doc = lead['roles']['document']; view = lead['roles']['view']
    url = lead['url']
    if doc == 'FLOOR_PLAN':
        return 'north up is not stated; the entrance callout 105/210 and the garage door 275/225 lie along the bottom edge, so the FRONT facade is at the bottom of the sheet and x grows to the right (east when looking at the front)'
    if doc == 'SECTION':
        return 'a cross-section through the main body looking from the front towards the rear: the garage lies on the right, so east is on the right; +7.95 ridge at the top'
    if doc == 'SITE_PLAN':
        return 'roof plan with the entrance arrow at the bottom: front at the bottom, rear terrace at the top, garage on the right (east)'
    if doc == 'ELEVATION':
        if view == 'FRONT':
            return 'seen from the front (south side of the plan): west on the left, east (garage) on the right'
        if view == 'REAR':
            return 'seen from the garden: mirrored, east (garage) on the left, west on the right'
        if '11265' in url or '__265' in url:
            return 'HYPOTHESIS: the EAST side, seen from the east: the garage (low, dark, flat roof) on the left means the front is on the left; z grows to the right'
        if '11266' in url or '__266' in url:
            return 'HYPOTHESIS: the WEST side, seen from the west: two rooflights on the slope and the 90/230 + 140/140 windows in the dark band; the front is on the right, z grows to the left'
    if fam == 'PERSPECTIVE_RENDER':
        if 'widok-2' in url:
            return 'garden (rear) three-quarter view from the north-east: the garage block on the left, the rear gable and loggia in the middle'
        return 'hero front three-quarter view from the south-west: the west return and gable on the left, the garage portal on the right'
    return 'UNKNOWN'

views = []
for g in groups:
    lead = g[0]
    fam, proj, character, annotation, storey = classify(lead)
    views.append({
        'viewId': f"view-{lead['byteHash'][:10]}",
        'sourceFamily': fam,
        'projectionModel': proj,
        'renderingCharacter': character,
        'annotationMode': annotation,
        'storeyRelevance': storey,
        'canonicalUrl': lead['url'],
        'selectedVariant': {'variantId': lead['variantId'], 'assetId': lead['assetId'], 'decoded': lead['decoded'], 'byteHash': lead['byteHash'], 'byteLength': lead['byteLength'], 'mediaType': lead['mediaType']},
        'siblingVariants': [{'variantId': v['variantId'], 'assetId': v['assetId'], 'url': v['url'], 'decoded': v['decoded'], 'byteHash': v['byteHash'], 'dhashDistance': hamming(lead['dhash'], v['dhash'])} for v in g[1:]],
        'packageAssetIds': sorted({v['assetId'] for v in g}),
        'packageSplitsThisView': len({v['assetId'] for v in g}) > 1,
        'dhash': f"{lead['dhash']:016x}",
        'orientationHypothesis': orientation(lead, fam),
        'caption': lead['caption'],
        'packageRoles': lead['roles'],
    })

# the page itself is a view of structured facts
views.append({
    'viewId': 'view-page-facts',
    'sourceFamily': 'PAGE_STRUCTURED_FACTS',
    'projectionModel': 'NONE',
    'renderingCharacter': 'TEXT',
    'annotationMode': 'PUBLISHED_FIGURES',
    'storeyRelevance': 'ALL',
    'canonicalUrl': pkg['canonicalUrl'],
    'selectedVariant': {'pageHash': pkg['pageHash']},
    'siblingVariants': [],
    'packageAssetIds': [],
    'packageSplitsThisView': False,
    'facts': pkg['publishedFacts'],
    'specifications': pkg['publishedSpecifications'],
    'rooms': pkg['publishedRooms'],
    'orientationHypothesis': 'not applicable',
})

order = {'PAGE_STRUCTURED_FACTS': 0, 'TECHNICAL_PLAN': 1, 'TECHNICAL_SECTION': 2, 'RENDERED_ELEVATION': 3, 'PERSPECTIVE_RENDER': 4, 'SITE_PLAN': 5, 'UNKNOWN': 9}
views.sort(key=lambda v: (order.get(v['sourceFamily'], 9), v.get('storeyRelevance', ''), v.get('annotationMode', ''), -v['selectedVariant'].get('decoded', {}).get('width', 0) if isinstance(v['selectedVariant'], dict) else 0, v['viewId']))

atlas = {
    'schema': 'buildapp.research.source-atlas',
    'schemaVersion': '2.0.0',
    'sourcePackageId': pkg['id'],
    'sourcePackageContentHash': pkg['contentHash'],
    'pageHash': pkg['pageHash'],
    'canonicalUrl': pkg['canonicalUrl'],
    'adapter': pkg['adapter'],
    'method': 'variants decoded from the cached bytes and grouped by a 64-bit dHash (distance <= 10) plus aspect (3%) plus the same annotation role; never by filename, aspect or id alone. Projection model and rendering character are independent axes.',
    'variantCount': len(variants),
    'viewCount': len(views),
    'views': views,
}
json.dump(atlas, open(out_path, 'w'), indent=2, ensure_ascii=False)
print(f"{len(variants)} variants -> {len(views)} views")
for v in views:
    sv = v['selectedVariant']
    size = f"{sv['decoded']['width']}x{sv['decoded']['height']}" if 'decoded' in sv else 'page'
    print(f"  {v['sourceFamily']:22} {v['projectionModel']:22} {v['renderingCharacter']:12} {v['annotationMode']:18} {v['storeyRelevance']:7} {size:10} +{len(v['siblingVariants'])} siblings {'SPLIT' if v['packageSplitsThisView'] else ''} {v['packageAssetIds']}")
