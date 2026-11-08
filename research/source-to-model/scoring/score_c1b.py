# v3.51 C1b scorer: the GROUND_CLEAR_HEIGHT relation in the FINAL model, per frozen item (FROZEN-C1.json).
# Checks, separately:
#   reading   - the replay's evidence holds a section dimension of the annotated value (cm) on a section frame
#   consumed  - the ground LEVEL feature carries clearHeight with SOURCE_EXACT and slabBand with SOURCE_DERIVED
#   applied   - every non-top storey-0 partition is H tall (±0.01) and every storey-1 slab is floor1 − H thick (±0.01),
#               and those properties carry SOURCE_DERIVED in the model's own evidence
# Verdicts: PASS (expectation met), FAIL, NOT_READ (CONSUMED_IF_READ items whose reading is absent), NO_MODEL.
# usage: score_c1b.py <FROZEN-C1.json> <runs-root> [out.json]
import json, os, sys

def main(argv):
    fz = json.load(open(argv[1])); root = argv[2]; rows = []
    for it in fz['items']:
        d = os.path.join(root, it['project'])
        mp, fg = os.path.join(d, 'model.json'), os.path.join(d, 'feature-graph.json')
        if not os.path.exists(mp):
            rows.append({**it, 'verdict': 'NO_MODEL'}); continue
        m = json.load(open(mp)); g = json.load(open(fg))
        H = it['groundClearCm'] / 100
        ev = json.load(open(os.path.join(d, 'metric-evidence.json')))['evidence']
        secs = {f['id'] for f in json.load(open(os.path.join('/home/user/rd/final/full', it['project'], 'observation-graph.json')))['coordinateFrames'] if f['roles'].get('projection') == 'ORTHOGRAPHIC_SECTION'}
        read = [e['id'] for e in ev if e['kind'] == 'LINEAR_DIMENSION' and e['frameId'] in secs and abs((e['value'] / 100 if e.get('unit') == 'cm' else e['value']) - H) < 0.005]
        lvl0 = next((s for s in g['solved'] if s['id'] == 'feat-level-0'), None)
        pp = (lvl0 or {}).get('parameterProvenance', {})
        ch = (lvl0 or {}).get('parameters', {}).get('clearHeight', {}).get('value')
        consumed = pp.get('clearHeight') == 'SOURCE_EXACT' and pp.get('slabBand') == 'SOURCE_DERIVED' and ch is not None and abs(ch - H) <= 0.01
        top0 = len(m['levels']) == 1
        parts = [w for w in m['walls'] if w.get('levelId') == 'lvl-0' and w.get('kind') == 'INTERIOR']
        slabs = [s for s in m['slabs'] if s.get('levelId') == 'lvl-1']
        f1 = m['levels'][1]['elevation'] if len(m['levels']) > 1 else None
        wallsOk = bool(parts) and all(abs(w['height'] - H) <= 0.01 and (w.get('evidence') or {}).get('properties', {}).get('height') == 'SOURCE_DERIVED' for w in parts)
        slabsOk = f1 is not None and bool(slabs) and all(abs(s['thickness'] - (f1 - H)) <= 0.01 and (s.get('evidence') or {}).get('properties', {}).get('thickness') == 'SOURCE_DERIVED' for s in slabs)
        applied = wallsOk and slabsOk
        exp = it['expect']
        if exp == 'CONSUMED' or (exp == 'CONSUMED_IF_READ' and read):
            v = 'PASS' if consumed and applied else 'FAIL'
        elif exp == 'CONSUMED_IF_READ':
            v = 'NOT_READ' if not consumed else 'FAIL'
        else:
            v = 'PASS' if not consumed and pp.get('clearHeight') != 'SOURCE_EXACT' else 'FAIL'
        rows.append({'role': it['role'], 'project': it['project'], 'expect': exp, 'H': H, 'readings': read, 'consumed': consumed, 'clearHeightParam': ch, 'provenance': {k: pp.get(k) for k in ('clearHeight', 'slabBand', 'height')}, 'partitions': sorted({round(w['height'], 3) for w in parts}), 'slabs': sorted({round(s['thickness'], 3) for s in slabs}), 'floor1': f1, 'wallsOk': wallsOk, 'slabsOk': slabsOk, 'verdict': v})
    for r in rows:
        print(f"{r.get('role','')[:11]:11} {r['project'][:28]:28} {r.get('expect',''):17} {r['verdict']:9} H={r.get('H')} read={len(r.get('readings') or [])} consumed={r.get('consumed')} partitions={r.get('partitions')} slabs={r.get('slabs')} prov={r.get('provenance')}")
    if len(argv) > 3:
        json.dump(rows, open(argv[3], 'w'), indent=1)

if __name__ == '__main__':
    main(sys.argv)
