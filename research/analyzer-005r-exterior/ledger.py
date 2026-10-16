#!/usr/bin/env python3
"""
ledger.py — 005R-EXTERIOR source/truth ledger and corpus selection (RESEARCH ONLY; never imported by production).

    python3 -I ledger.py <work005r> <n1v-runs> <n1v-fg> <private-out-dir outside Git> <committed-manifest.json>

Inputs are all ALREADY LOCAL and already eligible (005R §A: ARCHON USABLE_FOR_LOCAL_RESEARCH): the 005R corpus
(bytes hashed, captions private), the cached ARCHON product pages (text only), and the sealed N1v production runs
(canonical model, observation-graph frames, feature graph) of the 005R-ROUTER-N1 DEV rows. No network, no pixel is
decoded, no image is shown to anyone. Selection is a rule (preregistration §2), never a choice:

  families  = 005R families with an N1v canonical model whose modelled edition has >= 1 structural EXTERIOR_RENDER and
              >= 1 TECHNICAL_ELEVATION lineage group; dom-w-marcowkach and dom-w-rarytasach are forced (development
              anchors; the latter carries the edition-isolation test); the rest in sha256(SEED+family) order, to 12.
  editions  = the modelled edition of each family; in dom-w-rarytasach additionally OWNER's anchor m3ea28300f9b3e
              (no production run: an isolation control that must receive no technical evidence).
  groups    = per edition, by seeded lineage-group order: 1 structural exterior render, 1 technical elevation,
              1 interiors-carousel image (prefer a group byte-shared with another SELECTED edition, in family-level seeded order:
              the correlation control), and
              1 interiors-carousel image whose caption names an exterior styling/segment (the 005R B-1 conflict) when
              the edition has one.

The private ledger keeps local paths and per-membership channels; the committed manifest keeps hashes, ids, channel
NAMES, caption CLASSES and counts only — no caption, page text, description or URL path beyond what 005R already
committed.
"""
import glob
import gzip
import html as htmllib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (CATEGORY_COVER, CATEGORY_NEG, CATEGORY_POS, DESCRIPTION_COVER, DESCRIPTION_NEG, DESCRIPTION_POS,
                    SEED, caption_class, dump, file_sha, h, refuse_inside_repo, refuse_private_inside_repo)

FORCED = ['archon:dom-w-marcowkach', 'archon:dom-w-rarytasach']
OWNER_ANCHOR = 'archon:m3ea28300f9b3e'
MAX_FAMILIES = 12
MAX_GROUPS = 48


def page_text_lines(html):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', html, flags=re.S)
    t = htmllib.unescape(re.sub(r'<[^>]+>', '\n', t))
    return [l.strip() for l in t.split('\n') if l.strip()]


def publisher_claims(html):
    i = html.find('należy do kategorii')
    ul = re.search(r'<ul class="dropdown-menu dropdown-menu-center"[^>]*>(.*?)</ul>', html[i:], re.S) if i >= 0 else None
    cats = sorted({re.sub(r'-pc\d+$', '', c) for c in re.findall(r'href="/(projekty-[a-z0-9-]+-pc\d+)"', ul.group(1) if ul else '')})
    d = re.search(r'id="bottom-description">(.*?)</div>', html, re.S)
    text = re.sub(r'\s+', ' ', htmllib.unescape(re.sub(r'<[^>]+>', ' ', d.group(1) if d else ''))).lower()
    out = {'categoriesFound': len(cats), 'descriptionChars': len(text), 'category': {}, 'descriptionKinds': {}}
    for k, rx in CATEGORY_POS.items():
        if any(re.search(rx, c) for c in cats):
            out['category'][k] = 'POSITIVE'
    for k, rx in CATEGORY_NEG.items():
        if any(re.search(rx, c) for c in cats):
            out['category'][k] = 'CONFLICT' if out['category'].get(k) == 'POSITIVE' else 'NEGATIVE'
    out['categoryCover'] = sorted({f'{v[0]}:{v[1]}' for c, v in CATEGORY_COVER.items() if c in cats})
    for k, rx in DESCRIPTION_POS.items():
        if re.search(rx, text):
            out['descriptionKinds'][k] = 'POSITIVE'
    for k, rx in DESCRIPTION_NEG.items():
        if re.search(rx, text):
            out['descriptionKinds'][k] = 'NEGATIVE'  # "bez garażu" also matches the positive token; the negative wins
    out['descriptionCover'] = sorted(f'{k}:SOLID_COVER' for k, rx in DESCRIPTION_COVER.items() if re.search(rx, text))
    # adverse control: the naive page-wide reading 005R warned about (navigation names other projects' features)
    whole = ' '.join(page_text_lines(html)).lower()
    out['naivePageWide'] = sorted(k for k, rx in {'PERGOLA': r'pergol', 'CARPORT': r'wiat', 'GARAGE_ENCLOSED': r'gara[zż]', 'TERRACE': r'taras'}.items() if re.search(rx, whole))
    return out


def technical_schedule(html):
    L = page_text_lines(html)
    rooms = []
    for i, l in enumerate(L):
        m = re.match(r'^(\d+)\.\s+(.+)$', l)
        if m and i + 1 < len(L) and re.match(r'^\d+,\d+$', L[i + 1]):
            rooms.append((m.group(2), float(L[i + 1].replace(',', '.'))))
    kinds = {}
    for name, area in rooms:
        n = name.lower()
        if re.search(r'\bgara[zż]', n):
            kinds.setdefault('GARAGE_ENCLOSED', []).append(area)
        if re.search(r'\bwiat(a|y)\b', n) and 'wiatroł' not in n:
            kinds.setdefault('CARPORT', []).append(area)
        if re.search(r'\btaras', n):
            kinds.setdefault('TERRACE', []).append(area)
        if re.search(r'\bbalkon', n):
            kinds.setdefault('BALCONY', []).append(area)
        if re.search(r'\blogi', n):
            kinds.setdefault('LOGGIA', []).append(area)
    params = {
        'garageAreaPrinted': any(L[i] == 'Powierzchnia garażu' for i in range(len(L))),
        'garageDoorSpecified': any(L[i] == 'brama garażowa:' for i in range(len(L))),
    }
    return {'roomsListed': len(rooms), 'scheduleKinds': {k: len(v) for k, v in sorted(kinds.items())},
            'vestibuleEntries': sum(1 for n, _ in rooms if 'wiatroł' in n.lower()), 'params': params}


FG_MAP = {  # production solved family -> (feature class, relation, technical meaning)
    'TERRACE': ('TERRACE', 'UNKNOWN', 'a level surface at the threshold read from the plan'),
    'BALCONY': ('BALCONY', 'UNKNOWN', 'an elevated slab band read from an elevation registered to the plan'),
    'RAILING': ('RAILING', 'NONE', 'a guard band on a slab read from an elevation registered to the plan'),
    'RECESS': ('UNKNOWN_ASSEMBLY', 'UNKNOWN', 'return walls of a facade recess read from the plan (loggia, recessed entrance or covered terrace)'),
    'ATTACHED_ROOF': ('UNKNOWN_ASSEMBLY', 'SOLID_COVER', 'a roof slab over an attached body (garage, covered terrace, canopy or carport)'),
}
MODEL_MAP = {'terraces': 'TERRACE', 'balconies': 'BALCONY', 'railings': 'RAILING'}


def technical_features(row_dir, fg_path):
    """Production technical features of one sealed N1v row, with the frames (byte hashes) that sighted them."""
    obs = json.load(gzip.open(os.path.join(row_dir, 'observation-graph.json.gz')))
    frames = {f['id']: f for f in obs['coordinateFrames']}
    model_path = os.path.join(row_dir, 'model.json')
    out = {'modelSha256': file_sha(model_path) if os.path.exists(model_path) else None,
           'observationGraphHash': obs['contentHash'], 'frames': [], 'features': [], 'featureSource': None,
           'garageDoorsInModel': None}
    for f in obs['coordinateFrames']:
        out['frames'].append({'frameId': f['id'], 'byteHash': f['variantByteHash'], 'document': f['roles']['document'],
                              'projection': f['roles']['projection'], 'view': f['roles']['view']})
    if os.path.exists(model_path):
        m = json.load(open(model_path))
        out['garageDoorsInModel'] = sum(1 for d in m.get('doors', []) if d.get('usage') == 'GARAGE')
    if fg_path and os.path.exists(fg_path):
        out['featureSource'] = 'FEATURE_GRAPH'
        fg = json.load(gzip.open(fg_path))['featureGraphContent']
        hyp = {x['id']: x for x in fg['hypotheses']}
        sig = {x['id']: x for x in fg['sightings']}
        for s in fg['solved']:
            if s['family'] not in FG_MAP:
                continue
            cls, rel, meaning = FG_MAP[s['family']]
            hs = [sig[i] for i in hyp.get(s['hypothesisId'], {}).get('sightingIds', []) if i in sig]
            fids = sorted({x['frameId'] for x in hs if x.get('frameId') in frames})
            out['features'].append({
                'anchorId': s['id'], 'productionFamily': s['family'], 'featureClass': cls, 'relation': rel,
                'technicalMeaning': meaning, 'provenance': s['provenance'], 'quality': s.get('quality'),
                'viewFamilies': sorted({x['viewFamily'] for x in hs}),
                'frames': [{'frameId': i, 'byteHash': frames[i]['variantByteHash'], 'projection': frames[i]['roles']['projection']} for i in fids],
                'saysColumns': bool(re.search(r'\bcolumns?\b', s.get('why', ''))),
                # production's own words: "a zone, not a recess" — the solver kept the zone but denied the recess
                'productionDeniesRecess': bool(re.search(r'not a recess', s.get('why', ''))),
            })
    elif os.path.exists(model_path):
        out['featureSource'] = 'MODEL_ONLY'
        for key, cls in MODEL_MAP.items():
            for o in m.get(key, []):
                st = (o.get('evidence') or {}).get('status')
                out['features'].append({'anchorId': o['id'], 'productionFamily': key.upper(), 'featureClass': cls,
                                        'relation': 'UNKNOWN', 'technicalMeaning': 'a model element without frame sightings',
                                        'provenance': st, 'quality': None, 'viewFamilies': [], 'frames': [], 'saysColumns': False,
                                        'productionDeniesRecess': False})
    out['features'].sort(key=lambda x: x['anchorId'])
    return out


def main(work, runs, fgdir, outdir, committed):
    refuse_private_inside_repo(outdir)
    refuse_inside_repo(committed)
    os.makedirs(outdir, exist_ok=True)
    repo = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
    manifest = json.load(open(os.path.join(repo, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')))
    truth = {r['assetId']: r for r in json.load(open(os.path.join(repo, 'stage-reports/artifacts/analyzer-005r/roles/role-truth.json')))['rows']}
    private = {a['assetId']: a for a in json.load(open(os.path.join(work, 'run/corpus-private.json')))['assets']}
    v1 = {r['assetId']: r for r in json.load(open(os.path.join(work, 'run/V1.json')))['rows']}
    a1 = {}  # 005R addendum A1: the same V1 router on the same pixels padded to a square (white / grey); no re-run here
    for line in open(os.path.join(work, 'run/a1-v1.jsonl')):
        r = json.loads(line)
        a1[r['assetId']] = {'white': r['white']['label'] if r['white']['resolved'] else 'ABSTAIN', 'grey': r['grey']['label'] if r['grey']['resolved'] else 'ABSTAIN'}
    dev = json.load(open(os.path.join(work, 'dev-editions.json')))
    row_of = {}
    for url, rows in dev.items():
        m = re.search(r'archon\.pl/projekty-domow/.*-(m[0-9a-f]{13})$', url)
        if m:
            row_of.setdefault('archon:' + m.group(1), rows[0])
    modelled = {e: r for e, r in row_of.items() if os.path.exists(os.path.join(runs, r, 'model.json')) and e in manifest['editions']}

    def groups_of(ed, role):
        gs = {}
        for a in manifest['assets']:
            if ed in a['editions'] and a['scoredSize'] and truth[a['assetId']]['roleTruth'] == role:
                gs.setdefault(a['lineageGroup'], []).append(a)
        return gs

    fams = {}
    for ed in modelled:
        fam = manifest['editions'][ed]['family']
        if groups_of(ed, 'EXTERIOR_RENDER') and groups_of(ed, 'TECHNICAL_ELEVATION'):
            fams.setdefault(fam, []).append(ed)
    order = FORCED + sorted((f for f in fams if f not in FORCED), key=lambda f: h(SEED, f))
    chosen = [f for f in order if f in fams][:MAX_FAMILIES]

    editions = []
    for fam in chosen:
        eds = sorted(fams[fam])
        if fam == 'archon:dom-w-rarytasach':
            eds = sorted(set(eds) | {OWNER_ANCHOR})
        editions += eds

    sel_groups = {}  # lineageGroup -> {editions, purpose}
    for ed in editions:
        picks = []
        for role, purpose in [('EXTERIOR_RENDER', 'EXTERIOR_RENDER'), ('TECHNICAL_ELEVATION', 'TECHNICAL_ELEVATION')]:
            gs = groups_of(ed, role)
            if gs:
                picks.append((sorted(gs, key=lambda g: h(SEED, ed, g))[0], purpose))
        inter = groups_of(ed, 'INTERIOR_RENDER')

        def cls_of(g):
            return {caption_class(m['caption']) for a in inter[g] for m in private[a['assetId']]['memberships'] if m['channel'] == 'CAROUSEL:fancybox3Interiors'}
        plain = [g for g in inter if 'EXTERIOR_NAMED' not in cls_of(g)]
        others = set(editions) - {ed}
        shared = [g for g in plain if any(others & set(a['editions']) for a in inter[g])]
        pool = shared or plain
        if pool:  # family-level order, so editions of one family pick the same shared group when they have one
            fam = manifest['editions'][ed]['family']
            picks.append((sorted(pool, key=lambda g: h(SEED, fam, g))[0], 'INTERIOR_NEGATIVE'))
        conflict = [g for g in inter if 'EXTERIOR_NAMED' in cls_of(g)]
        if conflict:
            picks.append((sorted(conflict, key=lambda g: h(SEED, ed, g))[0], 'STRUCTURE_CONFLICT_CONTROL'))
        for g, purpose in picks:
            e = sel_groups.setdefault(g, {'editions': set(), 'purposes': set()})
            e['editions'].add(ed)
            e['purposes'].add(purpose)
    if len(sel_groups) > MAX_GROUPS:
        raise SystemExit(f'selection rule produced {len(sel_groups)} groups > {MAX_GROUPS}: the preregistered cap fails')

    # editions carry claims, schedule and technical evidence
    ed_rows = {}
    for ed in editions:
        pdir = os.path.join(work, 'corpus/pages', ed.replace(':', '_'))
        page = open(os.path.join(pdir, 'page.html'), encoding='utf-8', errors='replace').read()
        row = modelled.get(ed)
        tech = technical_features(os.path.join(runs, row), os.path.join(fgdir, f'N1v-{row}.json.gz')) if row else None
        ed_rows[ed] = {'editionKey': ed, 'family': manifest['editions'][ed]['family'], 'split005r': manifest['editions'][ed]['split'],
                       'pageSha256': file_sha(os.path.join(pdir, 'page.html')), 'n1vRow': row,
                       'publisherClaims': publisher_claims(page), 'technicalSchedule': technical_schedule(page), 'technical': tech}

    # assets of selected groups (every byte variant in the group; the group is the unit)
    assets = []
    for a in manifest['assets']:
        if a['lineageGroup'] not in sel_groups:
            continue
        p = private[a['assetId']]
        chans = sorted({(m['editionKey'], m['channel'], caption_class(m['caption']) if m['channel'] == 'CAROUSEL:fancybox3Interiors' else 'N/A') for m in p['memberships']})
        prod = {}
        for ed in a['editions']:
            t = (ed_rows.get(ed) or {}).get('technical')
            for f in (t or {}).get('frames', []):
                if f['byteHash'] == a['variantSha256']:
                    prod[ed] = f
        assets.append({'assetByteHash': a['variantSha256'], 'assetId': a['assetId'], 'lineageGroup': a['lineageGroup'],
                       'editions': a['editions'], 'family': a['family'], 'width': a['width'], 'height': a['height'],
                       'structureRole005r': truth[a['assetId']]['roleTruth'], 'structureBasis005r': truth[a['assetId']]['basis'],
                       'memberships': [{'editionKey': e, 'channel': c, 'captionClass': k} for e, c, k in chans],
                       'productionFrames': prod,
                       'v1PixelRole': {'role': v1[a['assetId']]['role'], 'resolved': v1[a['assetId']]['resolved'], 'paddedA1': a1.get(a['assetId'])} if a['assetId'] in v1 else None,
                       'purposes': sorted(sel_groups[a['lineageGroup']]['purposes']),
                       'selectedFor': sorted(sel_groups[a['lineageGroup']]['editions']),
                       'localFile': os.path.join(work, 'corpus/images', p['file'])})
    assets.sort(key=lambda x: (x['lineageGroup'], x['assetByteHash']))
    # extended interior negative set (gate 2): every other interiors-carousel asset of the selected editions, by
    # structure only; scored for scene role, never shown or decoded
    chosen_hashes = {a['assetByteHash'] for a in assets}
    ext = []
    neg_groups = {a['lineageGroup'] for a in manifest['assets'] if a['variantSha256'] not in chosen_hashes and set(a['editions']) & set(editions)
                  and any(m['channel'] == 'CAROUSEL:fancybox3Interiors' for m in private[a['assetId']]['memberships'])} - set(sel_groups)
    for a in manifest['assets']:  # every byte variant of those lineage groups, so a group's channels are complete
        if a['lineageGroup'] not in neg_groups:
            continue
        p = private[a['assetId']]
        chans = sorted({(m['editionKey'], m['channel'], caption_class(m['caption']) if m['channel'] == 'CAROUSEL:fancybox3Interiors' else 'N/A') for m in p['memberships']})
        ext.append({'assetByteHash': a['variantSha256'], 'lineageGroup': a['lineageGroup'], 'editions': a['editions'],
                    'structureRole005r': truth[a['assetId']]['roleTruth'], 'scoredSize': a['scoredSize'],
                    'memberships': [{'editionKey': e, 'channel': c, 'captionClass': k} for e, c, k in chans],
                    'selectedFor': sorted(set(a['editions']) & set(editions)), 'productionFrames': {}, 'v1PixelRole': None})
    ext.sort(key=lambda x: x['assetByteHash'])
    ledger = {'schema': 'research.005r-exterior.ledger.0.1', 'seed': SEED, 'families': chosen, 'editions': ed_rows,
              'assets': assets, 'extendedNegatives': ext, 'groups': {g: {'editions': sorted(v['editions']), 'purposes': sorted(v['purposes'])} for g, v in sorted(sel_groups.items())},
              'inputs': {'manifest005r': file_sha(os.path.join(repo, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')),
                         'roleTruth005r': file_sha(os.path.join(repo, 'stage-reports/artifacts/analyzer-005r/roles/role-truth.json')),
                         'corpusPrivate': file_sha(os.path.join(work, 'run/corpus-private.json')),
                         'v1Rows005r': file_sha(os.path.join(work, 'run/V1.json')),
                         'a1Rows005r': file_sha(os.path.join(work, 'run/a1-v1.jsonl'))}}
    dump(ledger, os.path.join(outdir, 'ledger-private.json'))
    # committed: strip local paths; keep hashes, ids, classes, counts
    pub = json.loads(json.dumps(ledger))
    for a in pub['assets']:
        del a['localFile']
    dump(pub, committed)
    print(f'families {len(chosen)} editions {len(editions)} groups {len(sel_groups)} assets {len(assets)} extended negatives {len(ext)}')


if __name__ == '__main__':
    if len(sys.argv) != 6:
        raise SystemExit(__doc__)
    main(*sys.argv[1:6])
