"""IU-01 offline prototype: classify the images of a local folder, or of a sealed SourcePackage read from a local
byte cache, without any network access (offline_guard is installed before anything else runs).

  python iu_classify.py --folder DIR --out OUT
  python iu_classify.py --package source-package.json --cache CACHE_DIR --out OUT

Writes OUT/classification.json, OUT/classification.csv, OUT/set-checks.json and OUT/contact-sheet.jpg (thumbnails
with the decision, class, confidence and flags). With --package, approach A (the production roles sealed in the
package) is shown next to B (model alone) and C (fusion). Nothing is deleted or rewritten: an UNKNOWN image is listed
with its hash and its metadata like any other. The package and its hashes are only read.

Requires the model artifact made by evaluate.py ($IU_WORK/model) and the one-time weights (prepare_models.py).
"""
import argparse, csv, hashlib, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo, arg_value
refuse_inside_repo(arg_value('--out', '.'), 'classification output (contact sheet = source pixels)')
refuse_inside_repo(arg_value('--work', os.environ.get('IU_WORK', '/home/user/workiu01')), 'the model artifact directory')
from iu.backbones import offline_guard
offline_guard()
import numpy as np
from PIL import Image, ImageDraw
from iu.backbones import load, embed, open_image
from iu.classes import CLASSES, PROJECTION
from iu import probe, geometry_check, setcheck

ELEV = 'ORTHOGRAPHIC_ELEVATION'
META_COMPAT = {'ELEVATION': {ELEV}, 'FLOOR_PLAN': {'FLOOR_PLAN'}, 'SECTION': {'TECHNICAL_SECTION'}, 'SITE_PLAN': {'SITE_PLAN'},
               'PERSPECTIVE_RENDER': {'INTERIOR_PERSPECTIVE', 'EXTERIOR_PERSPECTIVE'}}
A_MAP = {'ELEVATION': ELEV, 'FLOOR_PLAN': 'FLOOR_PLAN', 'SECTION': 'TECHNICAL_SECTION', 'SITE_PLAN': 'SITE_PLAN', 'PERSPECTIVE_RENDER': 'EXTERIOR_PERSPECTIVE'}
COLOR = {'ACCEPT': (20, 140, 60), 'REVIEW': (220, 140, 0), 'UNKNOWN': (200, 30, 30)}


def load_inputs(a):
    """[(id, sha256, PIL image, metadata or None, source note)]"""
    items = []
    if a.folder:
        for f in sorted(os.listdir(a.folder)):
            if f.split('.')[-1].lower() not in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
                continue
            p = os.path.join(a.folder, f)
            b = open(p, 'rb').read()
            items.append((f, hashlib.sha256(b).hexdigest(), open_image(p), None, p))
    else:
        pkg = json.load(open(a.package))
        for asset in pkg['assets']:
            v = next(x for x in asset['variants'] if x['id'] == asset['selectedVariantId'])
            key = hashlib.sha256(v['url'].encode()).hexdigest()[:32]
            p = os.path.join(a.cache, key + '.bin')
            meta = {'document': asset['roles']['document'], 'storey': asset['roles']['storey'], 'view': asset['roles']['view'],
                    'annotation': asset['roles']['annotation'], 'projection': asset['roles']['projection'],
                    'evidence': [f"{e['dimension']}:{e['signal']}" for e in asset.get('roleEvidence', [])][:6]}
            if not os.path.exists(p):
                items.append((asset['id'], v.get('byteHash'), None, meta, 'BYTES_NOT_IN_CACHE'))
                continue
            try:
                im = open_image(p)
            except Exception as e:  # kept in the output with its reason, not dropped
                items.append((asset['id'], v.get('byteHash'), None, meta, f'UNDECODABLE: {e}'))
                continue
            items.append((asset['id'], hashlib.sha256(open(p, 'rb').read()).hexdigest(), im, meta, v['url']))
    return items


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--folder'); g.add_argument('--package')
    ap.add_argument('--cache')
    ap.add_argument('--out', required=True)
    ap.add_argument('--work', default=os.environ.get('IU_WORK', '/home/user/workiu01'))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    meta = json.load(open(os.path.join(a.work, 'model', 'iu01-model.json')))
    W = np.load(os.path.join(a.work, 'model', 'iu01-head.npz'))
    t0 = time.time()
    model, bmeta = load(meta['backbone'])
    t_load = time.time() - t0
    items = load_inputs(a)
    ok = [it for it in items if it[2] is not None]
    t1 = time.time()
    E = embed(model, bmeta, [it[2] for it in ok]) if ok else np.zeros((0, 1))
    t_inf = time.time() - t1

    def logits(e, coef, intercept, classes, order):
        z = e @ coef.T + intercept
        out = np.full((len(e), len(order)), -1e9)
        for j, c in enumerate(classes):
            out[:, order.index(c)] = z[:, j]
        return out
    P = probe.softmax(logits(E, W['coef'], W['intercept'], meta['classes'], CLASSES), meta['temperature']) if ok else np.zeros((0, len(CLASSES)))
    TR = np.load(os.path.join(a.work, 'model', 'iu01-train-emb.npy'))
    TYP = np.sort(E @ TR.T, 1)[:, -5:].mean(1) if ok else np.zeros(0)
    plan_attr = (E @ W['plan_coef'].T + W['plan_intercept']) if ok else None
    style_attr = (E @ W['style_coef'].T + W['style_intercept']) if ok else None
    G = meta['geometry']

    records, k = [], 0
    for iid, sha, im, m, src in items:
        rec = {'imageId': iid, 'inputSha256': sha, 'source': src, 'metadataEvidence': m,
               'model': {'id': meta['modelId'], 'version': meta['modelVersion'], 'artifactSha256': meta['sha256']}}
        if im is None:
            rec.update({'predicted': None, 'decision': 'UNKNOWN', 'reason': [src], 'routesToFacadeExtractor': False})
            records.append(rec); continue
        p = P[k]; e_plan = plan_attr[k]; e_style = style_attr[k]; typ = float(TYP[k]); k += 1
        order = np.argsort(-p); cls = CLASSES[int(order[0])]; conf = float(p[order[0]])
        f = geometry_check.features(im); gv = geometry_check.verdict(f, G['tOrtho'], G['tPersp'])
        # B: the model alone
        b_dec = 'UNKNOWN' if conf < (meta['tauElevation'] if cls == ELEV else meta['tau']) or cls == 'OTHER' else 'ACCEPT'
        # C: fusion, downgrade-only
        dec, reasons = b_dec, ['CONFIDENT' if b_dec == 'ACCEPT' else ('NOT_A_SINGLE_VIEW' if cls == 'OTHER' else 'LOW_CONFIDENCE')]
        if dec == 'ACCEPT' and cls in (ELEV, 'FLOOR_PLAN', 'TECHNICAL_SECTION', 'SITE_PLAN') and gv == 'PERSPECTIVE_EVIDENT':
            dec = 'REVIEW'; reasons.append('GEOMETRY_PERSPECTIVE_CONFLICT')
        if dec == 'ACCEPT' and m and m['document'] in META_COMPAT and cls not in META_COMPAT[m['document']]:
            dec = 'REVIEW'; reasons.append(f"METADATA_CONFLICT({m['document']})")
        if dec == 'UNKNOWN' and reasons[0] == 'LOW_CONFIDENCE' and m and m['document'] in META_COMPAT and cls in META_COMPAT[m['document']] and cls != ELEV and gv != 'PERSPECTIVE_EVIDENT':
            dec = 'REVIEW'; reasons.append('LOW_CONFIDENCE_METADATA_AGREES')
        if dec != 'UNKNOWN' and typ < meta['typicalityThreshold']:
            dec = 'UNKNOWN'; reasons.append(f"OUT_OF_DISTRIBUTION(typicality {typ:.3f} < {meta['typicalityThreshold']:.3f})")
        rec.update({
            'predicted': cls, 'typicality': round(typ, 4), 'scores': {CLASSES[j]: round(float(p[j]), 4) for j in order[:4]}, 'calibratedConfidence': round(conf, 4),
            'geometryCheck': {'verdict': gv, **{kk: round(v, 3) for kk, v in f.items()}},
            'projection': PROJECTION.get(cls, 'UNKNOWN') if dec == 'ACCEPT' else 'UNKNOWN',
            'decision': dec, 'reason': reasons, 'routesToFacadeExtractor': dec == 'ACCEPT' and cls == ELEV,
            'approachA': A_MAP.get((m or {}).get('document'), 'UNKNOWN'), 'approachB': f'{b_dec}:{cls}',
            # attributes are only stated for the class they belong to
            'planAnnotation': meta['planClasses'][int(e_plan.argmax())] if cls == 'FLOOR_PLAN' else None,
            'elevationStyle': meta['styleClasses'][int(e_style.argmax())] if cls == ELEV else None,
            # nothing in the pixels states a storey or a side; the publisher's claim is carried, marked unverified
            'storey': {'value': (m or {}).get('storey', 'UNKNOWN') if cls == 'FLOOR_PLAN' else 'NOT_APPLICABLE', 'status': 'CLAIMED_UNVERIFIED' if m else 'UNKNOWN'},
            'buildingSide': {'value': (m or {}).get('view', 'UNKNOWN') if cls == ELEV else 'NOT_APPLICABLE', 'status': 'CLAIMED_UNVERIFIED' if m else 'UNKNOWN'},
            'size': list(im.size),
        })
        records.append(rec)

    json.dump({'model': meta, 'timing': {'modelLoadS': round(t_load, 2), 'inferenceS': round(t_inf, 2), 'images': len(ok)}, 'records': records}, open(os.path.join(a.out, 'classification.json'), 'w'), indent=1)
    with open(os.path.join(a.out, 'classification.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['imageId', 'sha256', 'A', 'B', 'C_decision', 'C_class', 'confidence', 'geometry', 'reason', 'facadeRoute'])
        for r in records:
            w.writerow([r['imageId'], r['inputSha256'], r.get('approachA'), r.get('approachB'), r['decision'], r.get('predicted'), r.get('calibratedConfidence'), (r.get('geometryCheck') or {}).get('verdict'), '|'.join(r['reason']), r['routesToFacadeExtractor']])
    images = {it[0]: it[2] for it in ok}
    emb_fn = lambda ims: embed(model, bmeta, ims)
    json.dump(setcheck.check_project([r for r in records if r['imageId'] in images], images, emb_fn), open(os.path.join(a.out, 'set-checks.json'), 'w'), indent=1)
    contact_sheet(records, images, os.path.join(a.out, 'contact-sheet.jpg'))
    print(f"{len(records)} images, {sum(r['decision'] == 'ACCEPT' for r in records)} ACCEPT, {sum(r['decision'] == 'REVIEW' for r in records)} REVIEW, {sum(r['decision'] == 'UNKNOWN' for r in records)} UNKNOWN -> {a.out}")


def contact_sheet(records, images, path, T=260, cols=6):
    recs = [r for r in records if r['imageId'] in images]
    rows = (len(recs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * T, max(1, rows) * (T + 44)), 'white')
    d = ImageDraw.Draw(sheet)
    for i, r in enumerate(recs):
        im = images[r['imageId']].copy(); im.thumbnail((T - 8, T - 8))
        x, y = (i % cols) * T, (i // cols) * (T + 44)
        sheet.paste(im, (x + 4, y + 4 + (T - 8 - im.size[1]) // 2))
        c = COLOR[r['decision']]
        d.rectangle([x + 1, y + 1, x + T - 2, y + T + 42], outline=c, width=3)
        d.text((x + 6, y + T), f"{r['decision']} {(r['predicted'] or '-')[:22]} {r.get('calibratedConfidence', '')}", fill=c)
        flags = [x_ for x_ in r['reason'] if x_ not in ('CONFIDENT',)] + (['FACADE'] if r['routesToFacadeExtractor'] else [])
        d.text((x + 6, y + T + 14), (' '.join(flags))[:44], fill=(60, 60, 60))
        d.text((x + 6, y + T + 28), f"A={r.get('approachA')} geo={(r.get('geometryCheck') or {}).get('verdict', '')[:10]}"[:44], fill=(110, 110, 110))
    sheet.save(path, quality=85)


if __name__ == '__main__':
    main()
