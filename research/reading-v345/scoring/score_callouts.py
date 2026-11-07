# v3.45 skills 3+4+5 on ground plans: printed opening callouts (w/h) and their target opening.
# usage: score_callouts.py <callouts-eval.json> <views-annotations.json> <runs-dir> <trace-dir> [out.json]
# Per annotated callout:
#   digits   - the reader emitted a callout on a ground-plan frame of the project whose ring/text lies at the annotated
#              ring (within RING_R px at 853 px) and reads exactly w/h;
#   element  - an OPENING_GAP of storey 0 on a ground-plan frame lies at the annotated gap (along-wall overlap >= 50 %
#              of the smaller extent, centre within NEAR px of the ring);
#   complete - that gap carries a bound callout reading exactly w/h AND its family is compatible with the kind.
# A complete assignment needs all three; one right field never passes the element. Additions: a storey-0 gap with a
# bound callout that sits at no annotated gap. Annotation coordinates are in the 853 px edition; a frame of another
# size of the same drawing is scaled (the editions share their wall ink pixel for pixel, checked before scoring).
import json, sys, os, collections
ann, views, runs, traces = sys.argv[1:5]
RING_R, NEAR = 14, 90
OK_FAMILY = {'WINDOW': {'WINDOW', 'MULTI_PANEL_GLAZING'}, 'DOOR': {'DOOR', 'GLAZED_DOOR'}, 'GARAGE_DOOR': {'GARAGE_DOOR'},
             'GLAZING_TO_FLOOR': {'WINDOW', 'MULTI_PANEL_GLAZING', 'DOOR', 'GLAZED_DOOR'}}
A = json.load(open(ann))['projects']
ground = collections.defaultdict(set)
for r in json.load(open(views))['rows']:
    if r['view']['class'] == 'FLOOR_PLAN' and r['view']['storey'] == 'GROUND': ground[r['project']].add(r['sha256'])
tot = collections.Counter(); per = []
def wh(text):
    try:
        a, b = text.split('/'); return int(a), int(b)
    except Exception: return None
for P in A:
    h = P['project']; split = 'EVAL' if P.get('blind', True) else 'DEV'
    if not P['callouts']:
        tot[(split, 'illegible')] += P.get('illegibleCount', 0); per.append({'project': h, 'split': split, 'illegible': P.get('illegibleCount', 0)}); continue
    g = json.load(open(f'{runs}/{h}/observation-graph.json'))
    frames = {f['id']: f for f in g['coordinateFrames'] if f.get('variantByteHash') in ground[h]}
    scale = {fid: 853.0 / f['size']['width'] for fid, f in frames.items()}
    me = json.load(open(f'{runs}/{h}/metric-evidence.json'))
    cal = []
    for e in me['evidence']:
        if e['kind'] != 'OPENING_CALLOUT' or e['frameId'] not in frames: continue
        s = scale[e['frameId']]
        b = e.get('textBox') or {}
        g2 = e.get('measuredGeometry') or {}
        cx = ((b.get('x0', 0) + b.get('x1', 0)) / 2) * s; cy = ((b.get('y0', 0) + b.get('y1', 0)) / 2) * s
        prim = wh(e.get('rawText') or '') or (e['value'], None)
        cw = {e['value']} | {x['value'] for x in e.get('alternatives', []) if (x.get('why') or '').startswith('width')}
        ch = {x['value'] for x in e.get('alternatives', []) if (x.get('why') or '').startswith('height') or 'the height half' in (x.get('why') or '')}
        cal.append({'cx': cx, 'cy': cy, 'w': prim[0], 'h': prim[1], 'cw': cw, 'ch': ch | ({prim[1]} if prim[1] else set()), 'raw': e.get('rawText'), 'frame': e['frameId']})
    tf = f'{traces}/{h}/feature-trace.json'
    gaps = []
    if os.path.exists(tf):
        for r in json.load(open(tf)):
            if r['kind'] != 'OPENING_GAP' or r.get('storey') != 0 or r['frameId'] not in frames: continue
            s = scale[r['frameId']]; pr = r['pixelRect']
            gaps.append({'x0': pr['x0'] * s, 'x1': pr['x1'] * s, 'y0': pr['y0'] * s, 'y1': pr['y1'] * s, 'family': r.get('family'),
                         'callout': r.get('callout'), 'id': r['id'], 'used': False})
    rows = []
    for c in P['callouts']:
        W, H = wh(c['text']); rx, ry = c['ring']; a0, a1 = c['gap']; horiz = c['wall'] in ('TOP', 'BOTTOM')
        read = [k for k in cal if abs(k['cx'] - rx) <= RING_R + 6 and abs(k['cy'] - ry) <= RING_R + 6]
        digits = any(k['w'] == W and k['h'] == H for k in read)
        among = any(W in k['cw'] and H in k['ch'] for k in read)
        def hit(gp):
            # the gap must run along the annotated wall: a gap in a horizontal wall is wider than deep, and vice versa
            # (fixed before the scorer was frozen: a side-wall callout matched a front gap at the corner)
            if horiz != ((gp['x1'] - gp['x0']) >= (gp['y1'] - gp['y0'])): return False
            lo, hi = (gp['x0'], gp['x1']) if horiz else (gp['y0'], gp['y1'])
            ov = min(hi, a1) - max(lo, a0); small = max(1e-6, min(hi - lo, a1 - a0))
            cx, cy = (gp['x0'] + gp['x1']) / 2, (gp['y0'] + gp['y1']) / 2
            return ov / small >= 0.5 and ((cx - rx) ** 2 + (cy - ry) ** 2) ** 0.5 <= NEAR + (a1 - a0) / 2
        cand = [gp for gp in gaps if hit(gp)]
        gp = cand[0] if cand else None
        if gp: gp['used'] = True
        bound = gp and gp.get('callout')
        bw, bh = (bound.get('widthCm'), bound.get('heightCm')) if bound else (None, None)
        values = bool(bound) and bw == W and bh == H
        family_ok = bool(gp) and gp['family'] in OK_FAMILY[c['kind']]
        if not gp: err = 'MISSING_OPENING'
        elif not bound: err = 'NOT_BOUND'
        elif not values: err = 'WRONG_DIGITS' if any(k['w'] == bw and k['h'] == bh for k in read) else 'WRONG_BINDING'
        elif not family_ok: err = 'WRONG_KIND'
        else: err = 'OK'
        rows.append({'text': c['text'], 'kind': c['kind'], 'wall': c['wall'], 'digitsRead': digits, 'readAs': [k['raw'] for k in read],
                     'opening': gp['id'] if gp else None, 'family': gp['family'] if gp else None, 'bound': f'{bw}/{bh}' if bound else None, 'result': err})
        tot[(split, 'n')] += 1; tot[(split, 'digits')] += digits; tot[(split, 'among')] += among; tot[(split, 'ringFound')] += bool(read); tot[(split, err)] += 1
    adds = [gp for gp in gaps if not gp['used'] and gp.get('callout')]
    tot[(split, 'additions')] += len(adds)
    per.append({'project': h, 'split': split, 'trace': os.path.exists(tf), 'rows': rows, 'additions': [{'id': a['id'], 'bound': f"{a['callout'].get('widthCm')}/{a['callout'].get('heightCm')}", 'family': a['family']} for a in adds]})
out = {'totals': {f'{a}|{b}': v for (a, b), v in sorted(tot.items())}, 'projects': per}
for split in ('EVAL', 'DEV'):
    n = tot[(split, 'n')]
    if not n: continue
    print(f"{split}: callouts n={n} (+{tot[(split, 'illegible')]} illegible, outside the legible set)")
    print(f"  ring found by the reader  {tot[(split, 'ringFound')]:3d}  {tot[(split, 'ringFound')] / n:.3f}")
    print(f"  digits read exactly       {tot[(split, 'digits')]:3d}  {tot[(split, 'digits')] / n:.3f}   (right value among candidates {tot[(split, 'among')]})")
    print(f"  complete assignment (OK)  {tot[(split, 'OK')]:3d}  {tot[(split, 'OK')] / n:.3f}")
    for e in ('MISSING_OPENING', 'NOT_BOUND', 'WRONG_DIGITS', 'WRONG_BINDING', 'WRONG_KIND'): print(f'  {e:24s} {tot[(split, e)]:3d}')
    print(f"  additions (bound gaps at no annotated callout) {tot[(split, 'additions')]}")
for p in per:
    if 'rows' in p:
        c = collections.Counter(r['result'] for r in p['rows'])
        print(' ', p['split'], p['project'][:34], 'trace' if p['trace'] else 'NO TRACE', dict(c), 'adds', len(p['additions']))
if len(sys.argv) > 5: json.dump(out, open(sys.argv[5], 'w'), indent=1)
