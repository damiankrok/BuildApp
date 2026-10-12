#!/usr/bin/env python3
"""as_printed_views.py - BUILDPLAN-ANALYZER-005O challenger views (RESEARCH ONLY; never imported by production).

  python3 -I research/analyzer-005o/as_printed_views.py --cases research/analyzer-005o/cases.json \
      --variant M1 --out /home/user/work005o/views/M1 [--reread /home/user/work005o/reread.json] [--strip-external]

Implements preregistration.md section 3 exactly. Input: the sealed metric evidence of each case (and, for the
REREAD variants, the research re-read file of PP-OCRv6 readings keyed by case and evidence id). Output: one view per
case, `{view: {evidenceId: {zero: [...], asRead: [...]}}, records: [...]}`; `records` say for every statement which
rule decided it and from which candidates (provenance), and are what the scorer joins with truth. This script never
opens a truth file and never reads a published figure, a page or a file name of a house: a case id is only a key.
"""
import argparse, itertools, json, os, re, sys

VALUE = re.compile(r'^[1-9]\d{1,4}$')
CONFIDENT_LATTICE = {'CLEAR', 'SUPPORTED'}
VARIANTS = ('M0X', 'M1', 'M1P', 'M1b', 'M2', 'M3', 'M3b')


def val(text):
    return int(text) if isinstance(text, str) and VALUE.match(text) else None


def box_key(frame, box, orientation):
    return (frame, box['x0'], box['x1'], box['y0'], box['y1'], orientation)


def external_corroborating(lat):
    """The frozen ensemble rule's verdict, read off the sealed record: is the external value a confident candidate?"""
    ens = lat.get('ensemble') or {}
    ext = ens.get('external') or {}
    d = ens.get('decision')
    v = ext.get('valueCm')
    if v is None:
        v = val(ext.get('text'))
    if d in ('AGREES', 'LEADS'):
        return v
    if d == 'CONTESTS' and (ens.get('rival') or {}).get('witness') == 'EXTERNAL':
        return v
    return None


def lattice_confident(lat):
    ens = lat.get('ensemble') or {}
    cls = (ens.get('lattice') or {}).get('ocrClass') or lat.get('ocrClass')
    return lat.get('asReadValueCm') if cls in CONFIDENT_LATTICE and lat.get('asReadValueCm') is not None else None


def frozen_lists(e, token_text):
    """The frozen zeroSubstitution / asRead of a statement (plan-resolution.ts), re-implemented for the M0X control."""
    first = val(token_text)
    if e['origin'] == 'READ':
        zero = [] if re.match(r'^0\d', e.get('rawText') or '') else [e['value']]
    else:
        zero = [first] if first is not None and first != e['value'] else []
    as_read = [] if e['origin'] == 'READ' and (e.get('derivation') or {}).get('dependsOnScale') else list(zero)
    return zero, as_read


def statements(m):
    """plan-resolution's statementsOn, for every frame: one record per (chain segment carrying a READ/CHAIN_CORRECTED cm evidence)."""
    ev = {e['id']: e for e in m['evidence']}
    tok = {t['id']: t for t in m['ocrTokens']}
    lat = {box_key(l['frameId'], l['box'], l.get('orientation')): l for l in m.get('numericLattices', [])}
    out = []
    for c in m['chains']:
        for s in c['segments']:
            e = ev.get(s.get('evidenceId'))
            if not e or e.get('unit') != 'cm' or e['origin'] not in ('READ', 'CHAIN_CORRECTED'):
                continue
            t = tok.get(e['ocrTokenIds'][0]) if len(e['ocrTokenIds']) == 1 else None
            l = lat.get(box_key(t['frameId'], t['box'], t.get('orientation'))) if t else None
            out.append({'e': e, 'token': t, 'lattice': l, 'chain': c['id'], 'frame': c['frameId'], 'axis': 'X' if c['axis'] == 'HORIZONTAL' else 'Y',
                        'from': s['fromPx'], 'to': s['toPx'], 'px': s['pixelLength'], 'segIndex': s['index']})
    return out


def candidates(st, reread):
    e, t, l = st['e'], st['token'], st['lattice']
    token_v = e['value'] if e['origin'] == 'READ' else val(t['text']) if t else None
    alts = sorted({a['value'] for a in e.get('alternatives', []) if isinstance(a.get('value'), (int, float)) and a['value'] > 0 and float(a['value']).is_integer()})
    lat_v = lattice_confident(l) if l else None
    ext_v = external_corroborating(l) if l else None
    paths = sorted({v for v in (val(p.get('text')) for p in (l.get('paths') or [])) if v is not None}) if l else []
    rr = reread.get(e['id']) if reread is not None else None
    rr = rr.get('value') if isinstance(rr, dict) and rr.get('confident') and rr.get('stable') and rr.get('heard') else None
    return {'TOKEN': token_v, 'ALT': [int(a) for a in alts], 'LATTICE': lat_v, 'EXTERNAL': ext_v, 'LATTICE_PATHS': paths, 'REREAD': rr}


def agrees(cm, px, scale, tol_px=2.0):
    return abs(cm - px * scale) <= max(0.03 * cm, tol_px * scale)


class Frame:
    def __init__(self, sts, relations):
        self.sts = sts
        self.copy = set()
        for r in relations:
            if r.get('kind') == 'PARALLEL_COPY_OF':
                self.copy.add((r['fromChainId'], r['toChainId']))
                self.copy.add((r['toChainId'], r['fromChainId']))
        self.extent = {}
        for a in ('X', 'Y'):
            xs = [s for s in sts if s['axis'] == a]
            self.extent[a] = (max(s['to'] for s in xs) - min(s['from'] for s in xs)) if xs else 0


def equations(frame, all_segments):
    """Segment-sum-to-overall equations: O on chain A; consecutive statements S1..Sk (k >= 2) on chain B, endpoints aligned."""
    out = []
    by_chain = {}
    for s in frame.sts:
        by_chain.setdefault(s['chain'], []).append(s)
    for o in frame.sts:
        tol = max(3.0, 0.01 * o['px'])
        for b, segs in by_chain.items():
            if b == o['chain'] or segs[0]['axis'] != o['axis']:
                continue
            full = all_segments[b]  # every segment of chain B, read or not
            starts = [i for i, g in enumerate(full) if abs(g['fromPx'] - o['from']) <= tol]
            ends = [i for i, g in enumerate(full) if abs(g['toPx'] - o['to']) <= tol]
            for i0 in starts:
                for i1 in ends:
                    if i1 - i0 < 1:
                        continue
                    span = full[i0:i1 + 1]
                    stated = {x['segIndex']: x for x in segs}
                    if all(g['index'] in stated for g in span):
                        out.append((o, [stated[g['index']] for g in span]))
    return out


def solve_equations(frame, eqs, current, cand_sets, confident_sets, contested, variant):
    """Returns {evidenceId: ('RESOLVED', value) | ('ABSTAIN', why)} from the arithmetic, plus the equation log."""
    decided, log = {}, []
    for o, segs in eqs:
        members = [o] + segs
        ids = [m['e']['id'] for m in members]
        if variant == 'M2':
            vals = [current.get(i) for i in ids]
            if any(v is None for v in vals):
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'SKIPPED_UNSTATED'})
                continue
            if abs(sum(vals[1:]) - vals[0]) <= 1:
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'HOLDS', 'values': vals})
                continue
            fixes = []
            for j, i in enumerate(ids):
                for alt in cand_sets[i]:
                    if alt == vals[j]:
                        continue
                    trial = list(vals)
                    trial[j] = alt
                    if abs(sum(trial[1:]) - trial[0]) <= 1:
                        fixes.append((i, alt))
            if len(fixes) == 1:
                decided[fixes[0][0]] = ('RESOLVED', fixes[0][1])
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'ONE_SUBSTITUTION', 'values': vals, 'fix': list(fixes[0])})
            else:
                for i in ids:
                    decided.setdefault(i, ('ABSTAIN', f'arithmetic violated, {len(fixes)} single substitutions restore it'))
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'VIOLATED_UNRESOLVED', 'values': vals, 'fixes': len(fixes)})
        else:  # M3: assignments over candidate sets
            sets = [sorted(set(([current[i]] if current.get(i) is not None and i not in contested else []) + (list(cand_sets[i]) if (i in contested or current.get(i) is None) else []))) for i in ids]
            if any(len(x) == 0 for x in sets):
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'SKIPPED_EMPTY'})
                continue
            n = 1
            for x in sets:
                n *= len(x)
            if n > 10_000:
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'SKIPPED_TOO_MANY', 'assignments': n})
                continue
            sat = [a for a in itertools.product(*sets) if abs(sum(a[1:]) - a[0]) <= 1]
            if len(sat) == 0:
                for i in ids:
                    decided.setdefault(i, ('ABSTAIN', 'no assignment of the candidates satisfies the sum'))
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'NO_ASSIGNMENT'})
            elif len(sat) == 1:
                a = sat[0]
                ok = all((ids[j] not in contested) or (a[j] in confident_sets[ids[j]]) for j in range(len(ids)))
                if ok:
                    for j, i in enumerate(ids):
                        if i in contested or current.get(i) is None:
                            decided[i] = ('RESOLVED', a[j])
                    log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'UNIQUE_ASSIGNMENT', 'assignment': list(a)})
                else:
                    for i in ids:
                        if i in contested:
                            decided.setdefault(i, ('ABSTAIN', 'the unique assignment uses a value no confident reader read'))
                    log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'UNIQUE_UNCONFIDENT', 'assignment': list(a)})
            else:
                for i in ids:
                    if i in contested:
                        decided.setdefault(i, ('ABSTAIN', f'{len(sat)} assignments satisfy the sum'))
                log.append({'overall': ids[0], 'segments': ids[1:], 'status': 'SEVERAL_ASSIGNMENTS', 'count': len(sat)})
    return decided, log


def isotropy_contest(frame, current, cand_sets):
    """M2 step 2: a long statement disagreeing with an other-axis scale that >= 2 long statements on >= 2 unrelated chains agree on."""
    out = {}
    longs = [s for s in frame.sts if frame.extent[s['axis']] > 0 and s['px'] >= 0.15 * frame.extent[s['axis']] and current.get(s['e']['id']) is not None]
    for s in longs:
        other = [o for o in longs if o['axis'] != s['axis']]
        best = None
        for seed in other:
            k = current[seed['e']['id']] / seed['px']
            sup = [o for o in other if agrees(current[o['e']['id']], o['px'], k)]
            chains = {o['chain'] for o in sup}
            unrelated = any((a, b) not in frame.copy for a in chains for b in chains if a != b)
            if len(sup) >= 2 and len(chains) >= 2 and unrelated:
                best = k
                break
        if best is None:
            continue
        v = current[s['e']['id']]
        if not agrees(v, s['px'], best) and any(agrees(c, s['px'], best) for c in cand_sets[s['e']['id']]):
            out[s['e']['id']] = ('ABSTAIN', f'other-axis scale {best:.6f} cm/px stated by {len(other)} long statements; a candidate fits it, the as-printed value does not')
    return out


def build(m, variant, reread):
    sts = statements(m)
    ids_by_chain_segments = {c['id']: c['segments'] for c in m['chains']}
    frames = {}
    for s in sts:
        frames.setdefault(s['frame'], []).append(s)
    view, records = {}, []
    for fid, fsts in sorted(frames.items()):
        frame = Frame(fsts, [r for r in m.get('chainRelations', []) if r.get('frameId') == fid])
        current, cand_sets, confident_sets, contested, why = {}, {}, {}, set(), {}
        for s in fsts:
            e = s['e']
            i = e['id']
            c = candidates(s, reread if variant in ('M1b', 'M3b') else None)
            zero, as_read = frozen_lists(e, s['token']['text'] if s['token'] else '')
            K = {v for v in (c['TOKEN'], c['LATTICE'], c['EXTERNAL'], c['REREAD']) if v is not None}
            confident_sets[i] = K
            legacy = {v for v in [c['TOKEN']] + c['ALT'] + c['LATTICE_PATHS'] if v is not None}
            cand_sets[i] = legacy | K if variant in ('M3', 'M3b') else legacy
            current[i] = zero[0] if zero else None
            s['cand'] = c
            s['frozen'] = (zero, as_read)
            if variant in ('M1', 'M1b', 'M1P', 'M3', 'M3b') and len(K) >= 2:
                if variant == 'M1P' and c['EXTERNAL'] is not None and c['LATTICE'] is None and ((s['lattice'] or {}).get('ensemble') or {}).get('decision') == 'LEADS':
                    why[i] = ('PROMOTED', c['EXTERNAL'])
                else:
                    contested.add(i)
                    why[i] = ('ABSTAIN', 'its confident readers disagree: ' + ', '.join(f'{k} {v}' for k, v in c.items() if k in ('TOKEN', 'LATTICE', 'EXTERNAL', 'REREAD') and v is not None))
        if variant in ('M2', 'M3', 'M3b'):
            eq_current = {i: (None if i in contested else v) for i, v in current.items()}
            decided, eqlog = solve_equations(frame, equations(frame, ids_by_chain_segments), eq_current, cand_sets, confident_sets, contested, 'M2' if variant == 'M2' else 'M3')
            for i, d in decided.items():
                if d[0] == 'RESOLVED':
                    why[i] = ('RESOLVED', d[1])
                    contested.discard(i)
                elif i not in why or why[i][0] != 'RESOLVED':
                    why[i] = d
            iso_current = {}
            for s in fsts:
                i = s['e']['id']
                w = why.get(i)
                iso_current[i] = w[1] if w and w[0] in ('RESOLVED', 'PROMOTED') else (None if (w and w[0] == 'ABSTAIN') else current[i])
            for i, d in isotropy_contest(frame, iso_current, cand_sets).items():
                if not (why.get(i) and why[i][0] == 'RESOLVED'):
                    why[i] = d
            records.append({'frame': fid, 'equations': eqlog})
        for s in fsts:
            i = s['e']['id']
            zero, as_read = s['frozen']
            w = why.get(i)
            if variant == 'M0X':
                view[i] = {'zero': zero, 'asRead': as_read}
                rule = 'FROZEN'
            elif w is None:
                rule = 'FROZEN'
            elif w[0] == 'ABSTAIN':
                view[i] = {'zero': [], 'asRead': []}
                rule = 'ABSTAIN'
            else:  # RESOLVED (arithmetic, scale-free) or PROMOTED (M1P): one value as printed; the frozen READ/dependsOnScale rule kept
                blocked = s['e']['origin'] == 'READ' and (s['e'].get('derivation') or {}).get('dependsOnScale')
                view[i] = {'zero': [w[1]], 'asRead': [] if blocked else [w[1]]}
                rule = w[0]
            v = view.get(i, {'zero': zero, 'asRead': as_read})
            records.append({'evidenceId': i, 'frame': fid, 'chain': s['chain'], 'axis': s['axis'], 'px': s['px'], 'origin': s['e']['origin'], 'value': s['e']['value'],
                            'candidates': s['cand'], 'frozen': {'zero': zero, 'asRead': as_read}, 'rule': rule, 'why': (w[1] if w and w[0] == 'ABSTAIN' else None),
                            'zero': v['zero'], 'asRead': v['asRead']})
    return view, records


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cases', required=True)
    ap.add_argument('--variant', required=True, choices=VARIANTS)
    ap.add_argument('--out', required=True)
    ap.add_argument('--reread')
    ap.add_argument('--only')
    ap.add_argument('--strip-external', action='store_true', help='adversarial control: drop every external reading first')
    a = ap.parse_args()
    if a.variant in ('M1b', 'M3b') and not a.reread:
        sys.exit('M1b/M3b need --reread')
    reread_all = json.load(open(a.reread)) if a.reread else {}
    os.makedirs(a.out, exist_ok=True)
    for c in json.load(open(a.cases))['cases']:
        if a.only and c['case'] not in a.only.split(','):
            continue
        m = json.load(open(c['metrics']))
        if a.strip_external:
            for l in m.get('numericLattices', []):
                l.pop('external', None)
                l.pop('ensemble', None)
        view, records = build(m, a.variant, reread_all.get(c['case'], {}))
        json.dump({'variant': a.variant, 'case': c['case'], 'view': view, 'records': records}, open(os.path.join(a.out, c['case'] + '.json'), 'w'), sort_keys=True, indent=0)
        n = sum(1 for r in records if 'evidenceId' in r)
        k = {}
        for r in records:
            if 'rule' in r:
                k[r['rule']] = k.get(r['rule'], 0) + 1
        print(f"{a.variant} {c['case']:24s} statements {n:3d} {k}")


if __name__ == '__main__':
    main()
