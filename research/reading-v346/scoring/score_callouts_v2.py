# v3.46 scorer for ground-plan opening callouts and their target openings (supersedes score_callouts.py v3.45 for
# reporting; that file and its tables stay as history).
#
# Why a new scorer (audit 1321, counter-probe A): v3.45 took the first predicted gap that ran along the annotated wall,
# overlapped half of the smaller extent and lay within ~90 px of the ring, and its `used` flag never excluded the gap from
# the next reference. One predicted gap spanning two annotated 100/210 openings passed both. Here:
#
#   * gaps are assigned one-to-one, by geometry only: same wall orientation, the gap within NEAR px of the ring across the
#     wall, and along-wall IoU >= MIN_IOU with the annotated gap; pairs are taken by IoU, highest first (ties by gap id).
#     No digits enter the assignment.
#   * a reference with no gap of its own that a single predicted gap covers by half or more, while that gap also covers
#     another annotated gap by half or more, is MERGED_GAP (one opening where the drawing has two or more);
#   * a reference with no gap of its own covered by half or more by the union of two or more predicted gaps is SPLIT_GAP;
#   * callout readings are assigned to annotated rings one-to-one by distance (RING px); two different readings on one
#     ring are a CONFLICT, never a pass;
#   * the binding must be THIS ring's callout: a gap carrying the right digits from another ring is WRONG_BINDING (the
#     number did not choose its object; the drawing did).
#
# Per reference: OK, MISSING_RUN (no evidence), NO_MODEL (evidence read, no openings built), MERGED_GAP, SPLIT_GAP, MISSING_OPENING, NOT_BOUND, WRONG_BINDING, WRONG_DIGITS,
# WRONG_KIND. Layers reported separately: ring found, raw text exact, digits exact (w and h), gap matched, bound to this
# ring, complete (OK). Additions: storey-0 gaps with a bound callout assigned to no reference and hosting no merged pair.
# Coordinates: the 853 px edition; frames of another width are scaled (same drawing, checked in v3.45).
#
# usage: score_callouts_v2.py <callouts.json>[,more] <views.json>[,more] <runs-dir> <trace-dir> [out.json]
import collections, json, os, sys

RING = 20
NEAR = 90
MIN_IOU = 0.5
OK_FAMILY = {'WINDOW': {'WINDOW', 'MULTI_PANEL_GLAZING'}, 'DOOR': {'DOOR', 'GLAZED_DOOR'}, 'GARAGE_DOOR': {'GARAGE_DOOR'},
             'GLAZING_TO_FLOOR': {'WINDOW', 'MULTI_PANEL_GLAZING', 'DOOR', 'GLAZED_DOOR'}}


def wh(text):
    try:
        a, b = (text or '').split('/')
        return int(a), int(b)
    except ValueError:
        return None


def horiz(c):
    return c['wall'] in ('TOP', 'BOTTOM')


def gap_horiz(g):
    return (g['x1'] - g['x0']) >= (g['y1'] - g['y0'])


def along(g, h):
    return (g['x0'], g['x1']) if h else (g['y0'], g['y1'])


def near_across(g, c):
    rx, ry = c['ring']
    return abs(((g['y0'] + g['y1']) / 2) - ry) <= NEAR if horiz(c) else abs(((g['x0'] + g['x1']) / 2) - rx) <= NEAR


def compatible(g, c):
    return gap_horiz(g) == horiz(c) and near_across(g, c)


def iou(g, c):
    lo, hi = along(g, horiz(c))
    a0, a1 = c['gap']
    inter = max(0.0, min(hi, a1) - max(lo, a0))
    union = max(hi, a1) - min(lo, a0)
    return inter / union if union > 0 else 0.0


def cover(g, c):
    lo, hi = along(g, horiz(c))
    a0, a1 = c['gap']
    return max(0.0, min(hi, a1) - max(lo, a0)) / max(1e-6, a1 - a0)


def score_project(refs, readings, gaps):
    """gaps None = the run built no openings (NO_MODEL for every reference; rings still scored).
    refs: annotated callouts; readings: callout evidence {id, cx, cy, raw, w, h}; gaps: storey-0 predicted gaps
    {id, x0, x1, y0, y1, family, bound: {evidenceId, widthCm, heightCm} | None}. Returns rows and additions."""
    # rings: each reading belongs to the nearest annotated ring within RING px
    on_ring = collections.defaultdict(list)
    for k in readings:
        best = None
        for i, c in enumerate(refs):
            d = ((k['cx'] - c['ring'][0]) ** 2 + (k['cy'] - c['ring'][1]) ** 2) ** 0.5
            if d <= RING and (best is None or d < best[0]):
                best = (d, i)
        if best:
            on_ring[best[1]].append(k)
    no_model = gaps is None
    gaps = gaps or []
    # gaps: one-to-one by IoU
    pairs = sorted(((iou(g, c), g['id'], j, i) for i, c in enumerate(refs) for j, g in enumerate(gaps) if compatible(g, c)), key=lambda p: (-p[0], p[1], p[3]))
    gap_of, ref_of = {}, {}
    for v, _, j, i in pairs:
        if v < MIN_IOU or i in gap_of or j in ref_of:
            continue
        gap_of[i] = j
        ref_of[j] = i
    # merged hosts: a gap covering half or more of two or more annotated gaps
    merged_host = {}
    for j, g in enumerate(gaps):
        covered = [i for i, c in enumerate(refs) if compatible(g, c) and cover(g, c) >= 0.5]
        if len(covered) >= 2:
            for i in covered:
                if i not in gap_of:
                    merged_host[i] = j
    rows = []
    for i, c in enumerate(refs):
        W, H = wh(c['text'])
        ks = on_ring.get(i, [])
        distinct = {(k['w'], k['h']) for k in ks}
        k = ks[0] if len(distinct) == 1 else None
        r = {'text': c['text'], 'kind': c['kind'], 'wall': c['wall'], 'ringFound': bool(ks), 'ringConflict': len(distinct) > 1,
             'readAs': [x['raw'] for x in ks], 'rawExact': bool(k) and k['raw'] == c['text'], 'digits': bool(k) and (k['w'], k['h']) == (W, H)}
        j = gap_of.get(i)
        g = gaps[j] if j is not None else None
        r['gap'] = g['id'] if g else None
        r['gapIoU'] = round(iou(g, c), 3) if g else None
        r['family'] = g['family'] if g else None
        b = g.get('bound') if g else None
        r['bound'] = f"{b.get('widthCm')}/{b.get('heightCm')}" if b else None
        this_ring = bool(b) and any(x['id'] == b.get('evidenceId') for x in ks)
        r['boundThisRing'] = this_ring
        if no_model:
            err = 'NO_MODEL'
        elif g is None:
            if i in merged_host:
                err = 'MERGED_GAP'
                r['mergedInto'] = gaps[merged_host[i]]['id']
            else:
                parts = [gg for gg in gaps if compatible(gg, c) and cover(gg, c) > 0]
                err = 'SPLIT_GAP' if len(parts) >= 2 and sum(cover(gg, c) for gg in parts) >= 0.5 else 'MISSING_OPENING'
        elif not b:
            err = 'NOT_BOUND'
        elif not this_ring:
            err = 'WRONG_BINDING'
        elif (b.get('widthCm'), b.get('heightCm')) != (W, H):
            err = 'WRONG_DIGITS'
        elif g['family'] not in OK_FAMILY[c['kind']]:
            err = 'WRONG_KIND'
        else:
            err = 'OK'
        r['result'] = err
        rows.append(r)
    hosts = set(merged_host.values())
    adds = [{'id': g['id'], 'bound': f"{g['bound'].get('widthCm')}/{g['bound'].get('heightCm')}", 'family': g['family']}
            for j, g in enumerate(gaps) if j not in ref_of and j not in hosts and g.get('bound')]
    return rows, adds


RESULTS = ('OK', 'MISSING_RUN', 'NO_MODEL', 'MERGED_GAP', 'SPLIT_GAP', 'MISSING_OPENING', 'NOT_BOUND', 'WRONG_BINDING', 'WRONG_DIGITS', 'WRONG_KIND')
LAYERS = ('ringFound', 'ringConflict', 'rawExact', 'digits', 'gapMatched', 'boundThisRing')


def load_project(h, runs, traces, ground):
    gp = os.path.join(runs, h, 'observation-graph.json')
    tf = os.path.join(traces, h, 'feature-trace.json')
    if not os.path.exists(gp) or not os.path.exists(os.path.join(runs, h, 'metric-evidence.json')):
        return None
    g = json.load(open(gp))
    frames = {f['id']: f for f in g['coordinateFrames'] if f.get('variantByteHash') in ground}
    scale = {fid: 853.0 / f['size']['width'] for fid, f in frames.items()}
    me = json.load(open(os.path.join(runs, h, 'metric-evidence.json')))
    readings = []
    for e in me['evidence']:
        if e['kind'] != 'OPENING_CALLOUT' or e['frameId'] not in frames:
            continue
        s = scale[e['frameId']]
        b = e.get('textBox') or {}
        p = wh(e.get('rawText')) or (e['value'], None)
        readings.append({'id': e['id'], 'cx': (b.get('x0', 0) + b.get('x1', 0)) / 2 * s, 'cy': (b.get('y0', 0) + b.get('y1', 0)) / 2 * s, 'raw': e.get('rawText'), 'w': p[0], 'h': p[1]})
    if not os.path.exists(tf):
        # the house stopped before openings were built: its readings are scored, its gaps are absent (NO_MODEL)
        return readings, None
    gaps = []
    for r in json.load(open(tf)):
        if r['kind'] != 'OPENING_GAP' or r.get('storey') != 0 or r['frameId'] not in frames:
            continue
        s = scale[r['frameId']]
        pr = r['pixelRect']
        gaps.append({'id': r['id'], 'x0': pr['x0'] * s, 'x1': pr['x1'] * s, 'y0': pr['y0'] * s, 'y1': pr['y1'] * s, 'family': r.get('family'), 'bound': r.get('callout')})
    return readings, gaps


def main(argv):
    projects = [P for f in argv[1].split(',') for P in json.load(open(f))['projects']]
    ground = collections.defaultdict(set)
    for f in argv[2].split(','):
        for r in json.load(open(f))['rows']:
            if r['view']['class'] == 'FLOOR_PLAN' and r['view']['storey'] == 'GROUND':
                ground[r['project']].add(r['sha256'])
    runs, traces = argv[3], argv[4]
    T = collections.Counter()
    per = []
    for P in projects:
        h = P['project']
        split = 'EVAL' if P.get('blind', True) else 'DEV'
        T[(split, 'illegible')] += P.get('illegibleCount', 0) or 0
        if not P['callouts']:
            per.append({'project': h, 'split': split, 'rows': [], 'additions': []})
            continue
        loaded = load_project(h, runs, traces, ground[h])
        if loaded is None:
            rows = [{'text': c['text'], 'kind': c['kind'], 'wall': c['wall'], 'result': 'MISSING_RUN'} for c in P['callouts']]
            adds = []
        else:
            rows, adds = score_project(P['callouts'], *loaded)
        for r in rows:
            r['gapMatched'] = bool(r.get('gap'))
            T[(split, 'n')] += 1
            T[(split, r['result'])] += 1
            for L in LAYERS:
                T[(split, L)] += bool(r.get(L))
        T[(split, 'additions')] += len(adds)
        per.append({'project': h, 'split': split, 'run': loaded is not None, 'rows': rows, 'additions': adds})
    out = {'params': {'RING': RING, 'NEAR': NEAR, 'MIN_IOU': MIN_IOU}, 'totals': {f'{a}|{b}': v for (a, b), v in sorted(T.items())}, 'projects': per}
    for split in ('EVAL', 'DEV'):
        n = T[(split, 'n')]
        if not n:
            continue
        print(f"{split}: callouts n={n} (+{T[(split, 'illegible')]} illegible, outside the legible set)")
        print('  ' + ' '.join(f'{L}={T[(split, L)]}' for L in LAYERS))
        print('  ' + ' '.join(f'{e}={T[(split, e)]}' for e in RESULTS) + f"  additions={T[(split, 'additions')]}")
    if len(argv) > 5:
        json.dump(out, open(argv[5], 'w'), indent=1)
    return out


if __name__ == '__main__':
    main(sys.argv)
