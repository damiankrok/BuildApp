# v3.46 scorer for the printed numbers on sections, per SIGN (supersedes score_levels.py v3.45 for reporting; that file and
# its tables stay as history).
#
# Why a new scorer: v3.45 matched the multiset of normalised values on one image and merged ridge/eaves/floor/terrain into
# one LEVEL group, so a prediction that swaps the values between two marks, with a wrong raw text at each, still scored
# 3/3 (audit 1321, counter-probe B). Here each reference is one printed sign at one place, and it is scored only by what
# the reader emitted AT that sign.
#
# Reference (annotations/section-signs.txt): value, kind (R ridge, E eaves, F storey floor, f other floor, T terrain,
# O other level, A angle deg, H vertical dimension cm), the centre of the printed text in image px, and the printed raw
# text. Positions were placed by eye on the original image (50 px grid), after the v3.45 values were frozen.
#
# Matching (geometry only, never the value): every metric-evidence item of the section frame whose text box, grown by
# GATE px, contains the sign's centre is a candidate; pairs are assigned one-to-one, nearest first (distance from the
# centre to the box), ties by evidence id. A sign with no partner is MISSING; an evidence item with no sign is an ADDITION.
#
# Layers reported separately for each sign:
#   located       - an evidence item was emitted at the sign;
#   kind          - its measure kind is the sign's (LEVEL_DATUM for R/E/F/f/T/O, ANGLE for A, LINEAR_DIMENSION for H);
#   rawExact      - its raw text equals the printed text character for character;
#   rawValue      - the value parsed from its raw text (before any correction) equals the printed value;
#   value         - its final value (after normalisation/correction) equals the printed value;
#   read          - kind and value right AND origin READ (a DERIVED value that happens to agree is not a reading);
#   ocrRaw        - diagnostic, independent of evidence: some OCR token (any reader) whose box holds the centre reads the
#                   printed numerals exactly (so a miss with ocrRaw=true is a promotion/binding failure, not OCR);
#   modelRole     - R: the solver's ridge datum, T: its terrain datum, F: a model storey elevation, equals the value.
#                   E/f/O have no model datum to compare with: NOT_MEASURED, counted.
# Exact match of a legible number = `read`. Coverage = located / n. Missing runs keep their signs in the denominator.
#
# usage: score_section_signs.py <section-signs.txt> <views-annotations.json>[,more] <runs-root> [out.json]
import collections, glob, json, os, re, sys

GATE = 10
READ_ORIGINS = ('READ', 'CHAIN_CORRECTED')
TOL = {'LEVEL': 0.005, 'ANGLE': 0.5, 'HEIGHT': 0.5}
GROUP = {'R': 'LEVEL', 'E': 'LEVEL', 'F': 'LEVEL', 'f': 'LEVEL', 'T': 'LEVEL', 'O': 'LEVEL', 'A': 'ANGLE', 'H': 'HEIGHT'}
EVKIND = {'LEVEL': 'LEVEL_DATUM', 'ANGLE': 'ANGLE', 'HEIGHT': 'LINEAR_DIMENSION'}
ALIAS = {'przed-1316': 'bakopy', 'przed-1318': 'zefiranty'}


def parse_signs(path):
    out = {}
    for line in open(path, encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        p = line.split()
        items = []
        for t in p[1:]:
            vk, rest = t.split('@', 1)
            xy, raw = rest.split(':', 1)
            v, k = vk.rsplit(':', 1)
            x, y = (float(c) for c in xy.split(','))
            items.append({'value': float(v), 'kind': k, 'group': GROUP[k], 'x': x, 'y': y, 'raw': raw})
        out[p[0]] = items
    return out


def numerals(s):
    """The printed numeral string: sign, digits and separator; the unit symbol (°) dropped."""
    return re.sub(r'[^0-9,.+\-±]', '', (s or '').replace('−', '-'))


def raw_value(s, group):
    t = (s or '').replace('±', '').replace('−', '-').replace(',', '.').replace('°', '').strip()
    t = re.sub(r'[^0-9.+\-]', '', t)
    try:
        return float(t)
    except ValueError:
        return None


def pred_value(e):
    if e['kind'] == 'LINEAR_DIMENSION':
        return round(e['value'] * 100, 1) if e.get('unit') == 'm' else e['value']
    return e['value']


def box_dist(b, x, y):
    dx = max(b['x0'] - x, 0, x - b['x1'])
    dy = max(b['y0'] - y, 0, y - b['y1'])
    return (dx * dx + dy * dy) ** 0.5


def claims_by_sign(signs, preds):
    """Geometry only. Each evidence item belongs to the one sign nearest to it among those whose centre its grown text box
    holds (its "home"); an item with no such sign is an addition. A sign then has 0, 1 or several claims. Several claims
    of different kind or value on one sign are a CONFLICT (the reader said two things about one printed number): never a
    pass, whichever of them is right. Several identical claims are one claim and counted duplicates."""
    home = {}
    for j, q in enumerate(preds):
        b = q.get('textBox')
        if not b:
            continue
        best = None
        for i, s in enumerate(signs):
            d = box_dist(b, s['x'], s['y'])
            if d <= GATE and (best is None or d < best[0]):
                best = (d, i)
        if best is not None:
            home[j] = best[1]
    claims = collections.defaultdict(list)
    for j, i in sorted(home.items()):
        claims[i].append(j)
    return claims, set(home)


def score_project(signs, evidence, tokens, model_levels, datums):
    """signs: list of reference items; evidence: metric-evidence items of the section frame; tokens: OCR tokens of the
    frame; model_levels: storey elevations; datums: {'ridgeY','terrainY'} or {}. Returns per-sign rows and additions."""
    preds = [e for e in evidence if e['kind'] in ('LEVEL_DATUM', 'ANGLE', 'LINEAR_DIMENSION')]
    claims, homed = claims_by_sign(signs, preds)
    rows = []
    for i, s in enumerate(signs):
        js = claims.get(i, [])
        distinct = {(preds[j]['kind'], pred_value(preds[j])) for j in js}
        q = preds[js[0]] if len(distinct) == 1 else None
        g = s['group']
        r = {'kind': s['kind'], 'value': s['value'], 'raw': s['raw'], 'at': [s['x'], s['y']]}
        r['claims'] = [{'kind': preds[j]['kind'], 'raw': preds[j].get('rawText'), 'value': pred_value(preds[j]), 'origin': preds[j].get('origin')} for j in js]
        r['conflict'] = len(distinct) > 1
        r['duplicates'] = len(js) - 1 if len(distinct) == 1 else 0
        r['located'] = bool(js)
        r['predKind'] = q['kind'] if q else None
        r['predRaw'] = q.get('rawText') if q else None
        r['predValue'] = pred_value(q) if q else None
        r['origin'] = q.get('origin') if q else None
        r['kindOk'] = bool(q) and q['kind'] == EVKIND[g]
        r['rawExact'] = bool(q) and (q.get('rawText') or '') == s['raw']
        rv = raw_value(q.get('rawText'), g) if q else None
        r['rawValue'] = rv is not None and r['kindOk'] and abs(rv - s['value']) <= TOL[g]
        r['valueOk'] = r['kindOk'] and r['predValue'] is not None and abs(r['predValue'] - s['value']) <= TOL[g]
        # the number as the drawing gives it: read, or corrected by the drawing's own arithmetic; never derived/assumed
        r['read'] = r['valueOk'] and q.get('origin') in READ_ORIGINS
        r['origin'] = q.get('origin') if q else None
        # independent of the evidence: OCR tokens on the sign
        on = [t for t in tokens if box_dist(t['box'], s['x'], s['y']) <= 4 and (t['box']['y1'] - t['box']['y0']) >= 6]
        r['ocrRaw'] = any(numerals(t['text']).replace('.', ',') == numerals(s['raw']) for t in on)
        if s['kind'] in 'RT' and datums is None:
            r['modelRole'] = 'NO_ASSESSMENT'
        elif s['kind'] == 'R':
            r['modelRole'] = 'OK' if datums.get('ridgeY') is not None and abs(datums['ridgeY'] - s['value']) <= TOL['LEVEL'] else 'WRONG'
        elif s['kind'] == 'T':
            r['modelRole'] = 'OK' if datums.get('terrainY') is not None and abs(datums['terrainY'] - s['value']) <= TOL['LEVEL'] else 'WRONG'
        elif s['kind'] == 'F':
            r['modelRole'] = 'OK' if any(abs(l - s['value']) <= TOL['LEVEL'] for l in model_levels) else 'WRONG'
        else:
            r['modelRole'] = 'NOT_MEASURED'
        rows.append(r)
    adds = [{'kind': q['kind'], 'raw': q.get('rawText'), 'value': pred_value(q), 'origin': q.get('origin'), 'box': q.get('textBox')}
            for j, q in enumerate(preds) if j not in homed]
    return rows, adds


def load_runs(root):
    runs = {}
    for p in glob.glob(os.path.join(root, '**', 'metric-evidence.json'), recursive=True):
        h = os.path.basename(os.path.dirname(p))
        runs[ALIAS.get(h, h)] = os.path.dirname(p)
    return runs


def section_shas(view_files):
    out = {}
    for f in view_files:
        for r in json.load(open(f))['rows']:
            if r['view']['class'] == 'TECHNICAL_SECTION':
                out.setdefault(r['project'], set()).add(r['sha256'])
    return out


def run_inputs(d, shas):
    me = json.load(open(os.path.join(d, 'metric-evidence.json')))
    ev = [e for e in me['evidence'] if e.get('variantByteHash') in shas]
    toks = [t for t in me.get('ocrTokens', []) if t.get('variantByteHash') in shas]
    levels, datums = [], None
    mp = os.path.join(d, 'model.json')
    if os.path.exists(mp):
        levels = [l['elevation'] for l in json.load(open(mp))['levels']]
    rp = os.path.join(d, 'result-summary.json')
    if os.path.exists(rp):
        a = json.load(open(rp)).get('assessment')
        # a solver-only replay writes a minimal summary without the assessment: the datums are then not available
        datums = ((a.get('elevationRegistration') or {}).get('datums') or {}) if a else None
    return ev, toks, levels, datums


LAYERS = ('located', 'conflict', 'kindOk', 'rawExact', 'rawValue', 'valueOk', 'read', 'ocrRaw')


def totals(per, split_of):
    T = collections.Counter()
    for p in per:
        sp = split_of(p['project'])
        for r in p['rows']:
            for key in (r['kind'], GROUP[r['kind']], 'ALL'):
                T[(sp, key, 'n')] += 1
                for L in LAYERS:
                    T[(sp, key, L)] += bool(r.get(L))
                if r.get('modelRole') == 'NO_ASSESSMENT':
                    T[(sp, key, 'roleNoAssessment')] += 1
                elif r.get('modelRole') != 'NOT_MEASURED':
                    T[(sp, key, 'roleN')] += 1
                    T[(sp, key, 'roleOk')] += r.get('modelRole') == 'OK'
        for a in p['additions']:
            T[(sp, {'LEVEL_DATUM': 'LEVEL', 'ANGLE': 'ANGLE', 'LINEAR_DIMENSION': 'HEIGHT'}[a['kind']], 'additions')] += 1
            T[(sp, 'ALL', 'additions')] += 1
    return T


def main(argv):
    signs = parse_signs(argv[1])
    shas = section_shas(argv[2].split(','))
    runs = load_runs(argv[3])
    split = json.load(open(os.path.join(os.path.dirname(argv[1]), '..', '..', 'reading-v345', 'annotations', 'split.json')))
    dev = set(split.get('DEV', split.get('dev', [])))
    split_of = lambda h: 'DEV' if h in dev else 'EVAL'
    per = []
    for h, items in sorted(signs.items()):
        if h not in runs:
            per.append({'project': h, 'run': False, 'rows': [dict(kind=s['kind'], value=s['value'], raw=s['raw'], located=False, modelRole='WRONG' if s['kind'] in 'RTF' else 'NOT_MEASURED') for s in items], 'additions': []})
            continue
        ev, toks, levels, datums = run_inputs(runs[h], shas.get(h, set()))
        rows, adds = score_project(items, ev, toks, levels, datums)
        per.append({'project': h, 'run': True, 'rows': rows, 'additions': adds})
    T = totals(per, split_of)
    out = {'gate_px': GATE, 'totals': {'|'.join(k): v for k, v in sorted(T.items())}, 'projects': per}
    for sp in ('DEV', 'EVAL'):
        print(f'{sp}:')
        for key in ('LEVEL', 'R', 'E', 'F', 'f', 'T', 'O', 'ANGLE', 'HEIGHT'):
            n = T[(sp, key, 'n')]
            if not n:
                continue
            line = f'  {key:6s} n={n:3d} ' + ' '.join(f'{L}={T[(sp, key, L)]:3d}' for L in LAYERS)
            if T[(sp, key, 'roleN')] or T[(sp, key, 'roleNoAssessment')]:
                line += f"  modelRole={T[(sp, key, 'roleOk')]}/{T[(sp, key, 'roleN')]} (no assessment {T[(sp, key, 'roleNoAssessment')]})"
            if key in ('LEVEL', 'ANGLE', 'HEIGHT'):
                line += f"  additions={T[(sp, key, 'additions')]}"
            print(line)
    if len(argv) > 4:
        json.dump(out, open(argv[4], 'w'), indent=1, ensure_ascii=False)
    return out


if __name__ == '__main__':
    main(sys.argv)
