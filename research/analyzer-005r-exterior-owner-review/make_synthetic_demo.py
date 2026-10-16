#!/usr/bin/env python3
"""
make_synthetic_demo.py — the OWNER review pack's SYNTHETIC demo (RESEARCH ONLY; no publisher content anywhere).

    python3 -I research/analyzer-005r-exterior-owner-review/make_synthetic_demo.py <image dir OUTSIDE the repo> [--pack]

Writes six invented pictures (uncompressed 24-bit BMP, so their SHA-256 does not depend on any compressor) into the
given directory. With `--pack` it also regenerates the committed synthetic queue, cross-check, locator, empty template
and the example labels file (every answer `SYNTHETIC_EXAMPLE`, invented by this script, never by a person or a model).

The synthetic houses exercise the pack's edge cases: two editions with near-identical pictures (one byte apart), an
accepted re-encoding of the same picture, a technical-drawing-like frame, an interior, and a question whose image is
deliberately never written (SOURCE_IMAGE_UNAVAILABLE).
"""
import hashlib
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # -I drops the script directory; build_pack is a sibling
import build_pack as bp  # noqa: E402

REPO = bp.REPO
SEED = 'BUILDPLAN-005R-EXTERIOR-OWNER-REVIEW-SYNTHETIC-V1'
PACK_ID = 'synthetic-demo-owner-review-v1'
W, H = 320, 200


def refuse_inside_repo(p):
    real = os.path.realpath(p)
    if real == REPO or real.startswith(REPO + os.sep):
        sys.exit(f'REFUSED: no picture of any kind is written inside the repository ({p})')


def bmp(pixels, ppm=2835):
    row_pad = (4 - (W * 3) % 4) % 4
    body = bytearray()
    for y in range(H - 1, -1, -1):
        for x in range(W):
            r, g, b = pixels[y][x]
            body += bytes((b, g, r))
        body += b'\x00' * row_pad
    header = struct.pack('<2sIHHI', b'BM', 54 + len(body), 0, 0, 54)
    info = struct.pack('<IiiHHIIiiII', 40, W, H, 1, 24, 0, len(body), ppm, ppm, 0, 0)
    return header + info + bytes(body)


def canvas(sky, ground):
    return [[sky if y < 130 else ground for x in range(W)] for y in range(H)]


def rect(px, x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            px[y][x] = c


def marker(px):
    # magenta corner band: every synthetic picture says what it is
    for y in range(0, 22):
        for x in range(0, 22 - y):
            px[y][x] = (230, 0, 200)


def house(px, pergola=True, roof=(150, 60, 50)):
    rect(px, 60, 70, 200, 150, (235, 230, 215))
    for i in range(0, 50):
        rect(px, 60 + i * 140 // 100, 70 - i, 200 - i * 140 // 100, 71 - i, roof)
    rect(px, 120, 105, 145, 150, (90, 70, 50))      # door
    rect(px, 160, 95, 190, 120, (120, 170, 210))    # window
    if pergola:
        for x in (210, 240, 270):
            rect(px, x, 95, x + 5, 150, (110, 85, 60))  # posts
        for x in range(205, 280, 9):
            rect(px, x, 92, x + 4, 97, (110, 85, 60))   # open slats


def pictures():
    a1 = canvas((185, 215, 240), (120, 160, 90)); house(a1); marker(a1)
    b1 = canvas((185, 215, 240), (120, 160, 90)); house(b1); marker(b1)
    b1[199][319] = (121, 160, 90)                   # one pixel apart: still another edition
    elev = canvas((255, 255, 255), (255, 255, 255))
    for y in (70, 150):
        rect(elev, 60, y, 280, y + 1, (0, 0, 0))
    for x in (60, 200, 280):
        rect(elev, x, 70, x + 1, 150, (0, 0, 0))
    rect(elev, 200, 95, 280, 97, (0, 0, 0))          # attached flat roof over a side body
    marker(elev)
    inter = canvas((230, 220, 200), (160, 120, 90))
    rect(inter, 40, 30, 120, 110, (150, 190, 220))   # a window seen from inside
    rect(inter, 200, 20, 214, 130, (200, 200, 200))  # an interior column
    marker(inter)
    garage = canvas((185, 215, 240), (120, 160, 90)); house(garage, pergola=False, roof=(60, 60, 60)); marker(garage)
    out = {'a1': bmp(a1), 'a1-reencoded': bmp(a1, ppm=3780), 'b1': bmp(b1), 'elev': bmp(elev), 'interior': bmp(inter), 'missing': bmp(garage)}
    return out


def sha(b):
    return hashlib.sha256(b).hexdigest()


def rank(k):
    return hashlib.sha256(f'{SEED}:{k}'.encode()).hexdigest()


def build_pack(pics):
    E_A, E_B = 'synthetic:edition-a', 'synthetic:edition-b'
    spec = [  # (tier, edition, group, picture keys accepted (first = anchor), kind, class)
        ('PRIORITY', E_A, 'lg-syn-house', ['a1', 'a1-reencoded'], 'FEATURE_VISIBILITY', 'PERGOLA'),
        ('PRIORITY', E_A, 'lg-syn-house', ['a1', 'a1-reencoded'], 'FEATURE_VISIBILITY', 'CARPORT'),
        ('PRIORITY', E_A, 'lg-syn-house', ['a1', 'a1-reencoded'], 'SCENE_SCOPE', None),
        ('PRIORITY', E_B, 'lg-syn-house-b', ['b1'], 'FEATURE_VISIBILITY', 'PERGOLA'),
        ('SECONDARY', E_A, 'lg-syn-elev', ['elev'], 'FEATURE_VISIBILITY', 'UNKNOWN_ASSEMBLY'),
        ('SECONDARY', E_A, 'lg-syn-interior', ['interior'], 'SCENE_SCOPE', None),
        ('SECONDARY', E_A, 'lg-syn-interior', ['interior'], 'FEATURE_VISIBILITY', 'COLUMN'),
        ('SECONDARY', E_B, 'lg-syn-missing', ['missing'], 'FEATURE_VISIBILITY', 'GARAGE'),
    ]
    qs, images = [], {}
    for tier, ed, group, keys, kind, cls in spec:
        hashes = [sha(pics[k]) for k in keys]
        qid = 'q-' + rank(f'{ed}:{hashes[0]}:{kind}:{cls}')[:12]
        img = 'img-' + rank(hashes[0])[:10]
        images[img] = {'imageId': img, 'acceptedByteHashes': sorted(hashes), 'width': W, 'height': H}
        qs.append({'questionId': qid, 'tier': tier, 'imageId': img, 'kind': kind, 'featureClass': cls, 'projectEditionId': ed,
                   'lineageGroup': group, 'correlationGroup': group, 'anchorByteHash': hashes[0], 'acceptedByteHashes': sorted(hashes),
                   'subAnswer': 'COVER' if cls in bp.COVER_CLASSES else ('ASSEMBLY' if cls == 'UNKNOWN_ASSEMBLY' else None)})
    order = {'PRIORITY': 0, 'SECONDARY': 1}
    qs.sort(key=lambda q: (order[q['tier']], rank(q['imageId']), rank(q['questionId'])))
    for i, q in enumerate(qs, 1):
        q['order'] = i
    queue = {'schema': 'research.005r-exterior.owner-review-queue.0.1', 'packId': PACK_ID, 'packKind': 'SYNTHETIC', 'seed': SEED,
             'preregistrationSha256': bp.sha_file(os.path.join(HERE, 'preregistration.md')), 'inputs': {'synthetic': 'make_synthetic_demo.py'},
             'vocab': bp.VOCAB, 'images': sorted(images.values(), key=lambda v: v['imageId']), 'questions': qs}
    qsha = hashlib.sha256(bp.canon(queue).encode()).hexdigest()
    same = lambda q: sorted(o['questionId'] for o in qs if o['projectEditionId'] == q['projectEditionId'] and o is not q)
    cross = {'schema': 'research.005r-exterior.owner-review-crosscheck.0.1', 'packId': PACK_ID, 'queueSha256': qsha,
             'note': 'SYNTHETIC demo: every value below is invented', 'questions': [{
                 'questionId': q['questionId'], 'rule': 'SYNTHETIC', 'b1ProposalId': None,
                 'sourceKind': {'lg-syn-elev': 'TECHNICAL_ELEVATION_FRAME', 'lg-syn-interior': 'INTERIOR_FRAME'}.get(q['lineageGroup'], 'EXTERIOR_RENDER_FRAME'),
                 'publisherChannels': ['SYNTHETIC'], 'captionClasses': ['N/A'], 'viewHint': 'UNKNOWN', 'viewHintBasis': None,
                 'b1SceneRole': 'NO_PROPOSAL', 'b1EditionStatus': 'NOT_APPLICABLE', 'b1EditionRelation': None, 'strictRecount': None,
                 'publisherCategory': 'POSITIVE' if q['featureClass'] == 'PERGOLA' else None, 'publisherDescriptionKind': None, 'publisherCover': [],
                 'scheduleKinds': {}, 'productionFeatures': [], 'productionRun': False, 'sameEditionQuestionIds': same(q),
                 'projectPageUrl': None, 'pageLocator': {'section': 'SYNTHETIC', 'publisherImageNumber': None}, 'pageAccess': 'NOT_CHECKED',
                 'isolationNote': 'SYNTHETIC: edition-a and edition-b differ by one pixel and stay two editions'} for q in qs]}
    template = bp.template_of(queue, qsha)
    return queue, cross, template, qsha


def example_labels(queue, qsha, pics):
    """Invented answers for the demo only; every one says SYNTHETIC_EXAMPLE."""
    by = {(q['lineageGroup'], q['kind'], q['featureClass']): q for q in queue['questions']}
    labels = {q['questionId']: bp.empty_label(q) for q in queue['questions']}

    def ans(key, byte_key, p1, p2=None, mode='LOCAL_BYTES_HASH_MATCHED'):
        q = by[key]
        l = labels[q['questionId']]
        base = {'answer': None, 'cover': None, 'assembly': None, 'region': None, 'side': None, 'mirrored': None, 'notes': None, 'answeredAt': None}
        base.update(p1)
        l.update({'phase1': base, 'reviewerOrigin': 'SYNTHETIC_EXAMPLE', 'viewingMode': mode,
                  'reviewedByteHash': sha(pics[byte_key]) if byte_key else None, 'status': 'REVIEWED_VISUAL'})
        if p2:
            full = {'technicalEvidence': None, 'evidenceSource': None, 'sourceContext': None, 'notes': None}
            full.update(p2)
            l['phase2'] = full
            if q['kind'] == 'SCENE_SCOPE':
                l['conflict'] = full['sourceContext'] == 'DISAGREES'
            else:
                l['conflict'] = (base['answer'] == 'PRESENT' and full['technicalEvidence'] == 'TECHNICAL_DOES_NOT_SHOW') or \
                                (base['answer'] == 'ABSENT' and full['technicalEvidence'] == 'TECHNICAL_SHOWS')
                if full['technicalEvidence'] in ('TECHNICAL_SHOWS', 'TECHNICAL_DOES_NOT_SHOW'):
                    l['status'] = 'TECHNICALLY_CROSSCHECKED'

    ans(('lg-syn-house', 'FEATURE_VISIBILITY', 'PERGOLA'), 'a1-reencoded',
        {'answer': 'PRESENT', 'cover': 'OPEN_MEMBERS', 'region': [0.64, 0.46, 0.875, 0.75], 'notes': 'PRZYKŁAD SYNTETYCZNY'},
        {'technicalEvidence': 'TECHNICAL_DOES_NOT_SHOW', 'evidenceSource': 'ELEVATION_IN_PACK', 'notes': 'PRZYKŁAD SYNTETYCZNY: konflikt zostaje'})
    ans(('lg-syn-house', 'FEATURE_VISIBILITY', 'CARPORT'), 'a1', {'answer': 'ABSENT'},
        {'technicalEvidence': 'NO_TECHNICAL_EVIDENCE'})
    ans(('lg-syn-house', 'SCENE_SCOPE', None), 'a1', {'answer': 'EXTERIOR'}, {'sourceContext': 'AGREES'})
    ans(('lg-syn-house-b', 'FEATURE_VISIBILITY', 'PERGOLA'), 'b1', {'answer': 'CANNOT_TELL'})
    ans(('lg-syn-elev', 'FEATURE_VISIBILITY', 'UNKNOWN_ASSEMBLY'), 'elev', {'answer': 'PRESENT', 'assembly': 'UNKNOWN'},
        {'technicalEvidence': 'CANNOT_TELL'})
    ans(('lg-syn-interior', 'SCENE_SCOPE', None), 'interior', {'answer': 'INTERIOR'})
    ans(('lg-syn-interior', 'FEATURE_VISIBILITY', 'COLUMN'), 'interior', {'answer': 'ABSENT', 'notes': 'PRZYKŁAD SYNTETYCZNY: słup we wnętrzu to nie podpora zewnętrzna'})
    # the GARAGE question stays UNREVIEWED: its picture is never provided (SOURCE_IMAGE_UNAVAILABLE)
    ordered = [labels[q['questionId']] for q in queue['questions']]
    payload = [{'questionId': l['questionId'], 'reviewedByteHash': l['reviewedByteHash'], 'viewingMode': l['viewingMode'],
                'reviewerOrigin': l['reviewerOrigin'], 'phase1': l['phase1']} for l in ordered if l['phase1']]
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    c = {'questions': len(ordered), 'UNREVIEWED': 0, 'REVIEWED_VISUAL': 0, 'TECHNICALLY_CROSSCHECKED': 0, 'conflicts': 0, 'notBlind': 0}
    for l in ordered:
        c[l['status']] += 1
        c['conflicts'] += 1 if l['conflict'] else 0
        c['notBlind'] += 1 if l['viewingMode'] == 'MANUAL_PAGE_FALLBACK_NOT_BLIND' else 0
    return {'schema': 'research.005r-exterior.owner-review-labels.0.1', 'packId': PACK_ID, 'packKind': 'SYNTHETIC', 'queueSha256': qsha,
            'phase1Seal': {'digest': digest, 'sealedCount': len(payload)}, 'counts': c, 'labels': ordered}


def main(argv):
    if not argv:
        sys.exit(__doc__)
    out_dir = argv[0]
    refuse_inside_repo(out_dir)
    pics = pictures()
    os.makedirs(out_dir, exist_ok=True)
    for k, b in pics.items():
        if k == 'missing':
            continue  # deliberately never written
        with open(os.path.join(out_dir, f'synthetic-{k}.bmp'), 'wb') as f:
            f.write(b)
    if '--pack' in argv:
        queue, cross, template, qsha = build_pack(pics)
        files = {f'examples/synthetic/{k}': v for k, v in bp.pack_files(queue, cross, template, 'make_synthetic_demo.py').items()}
        files['examples/example-labels-SYNTHETIC.json'] = bp.canon(example_labels(queue, qsha, pics))
        for k, v in files.items():
            p = os.path.join(HERE, k)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w', encoding='utf-8', newline='\n') as f:
                f.write(v)
    print(json.dumps({k: sha(b) for k, b in sorted(pics.items())}, indent=1))


if __name__ == '__main__':
    main(sys.argv[1:])
