#!/usr/bin/env python3
"""select_items.py - the fixed, matched question sets of the 005M bake-off (RESEARCH ONLY).

    python -I -B research/analyzer-005m/select_items.py --pool <W>/corpus/pool.json --out <W>/corpus

Chosen before any model runs, from the pool's own fields only (set, class, expected answer, house / family, transform)
- never from a model output. Deterministic: a stable hash orders candidates inside each stratum.

  PHASE2 (>= 150): every mandatory model that advances answers exactly these questions in all five modes.
  PHASE1 (>= 30) : a subset of PHASE2; every mandatory model answers it in all five modes.

Mirror / rotation twins and both members of counterfactual pairs are included on purpose, so consistency is measured
on matched items. The old SmolVLM2-500M intersection is computed by the scorer from the 005J item ids.
"""
import argparse
import hashlib
import json
import os
from collections import defaultdict


def h(s):
    return hashlib.sha256(('005m-select:' + s).encode()).hexdigest()


def round_robin(cands, n, key):
    """n candidates, spread over key(c) (house / family / project), each group ordered by the stable hash."""
    groups = defaultdict(list)
    for c in sorted(cands, key=lambda c: h(c['qid'])):
        groups[key(c)].append(c)
    order = sorted(groups, key=h)
    out = []
    while len(out) < n and any(groups.values()):
        for g in order:
            if groups[g] and len(out) < n:
                out.append(groups[g].pop(0))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pool', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    pool = json.load(open(a.pool))['questions']
    by = {q['qid']: q for q in pool}
    twin = lambda q, tf: by.get(q['qid'].replace('-NORMAL', '-' + tf))
    P2, P1 = [], []

    # REAL_DEV: NORMAL, per class and expected answer, spread over the houses
    rd = [q for q in pool if q['set'] == 'REAL_DEV' and q['transform'] == 'NORMAL']
    quota = {('BODY_REGION', 'YES'): 5, ('BODY_REGION', 'NO'): 5, ('TERRACE_VS_BODY', 'ENCLOSED'): 4, ('TERRACE_VS_BODY', 'EXTERNAL'): 4,
             ('OPENING_VS_PATTERN', 'OPENING'): 4, ('WALL_CONTINUATION', 'CONTINUES'): 3, ('WALL_CONTINUATION', 'TERMINATES'): 2,
             ('CANOPY_PERGOLA_VS_WALL', 'WALL'): 3, ('CANOPY_PERGOLA_VS_WALL', 'NOT_WALL'): 3, ('OUTER_BOUNDARY_A_OR_B', 'OUTLINE_1'): 3,
             ('OUTER_BOUNDARY_A_OR_B', 'OUTLINE_2'): 3, ('GARAGE_BODY', 'YES'): 2, ('BAY_OR_RISALIT', 'YES'): 1}
    real = []
    for (cls, exp), n in quota.items():
        real += round_robin([q for q in rd if q['cls'] == cls and q['expected'] == exp], n, lambda q: q['group'])
    P2 += real
    first_of_class = {}
    for q in real:
        first_of_class.setdefault(q['cls'], q)
    P2 += [twin(q, 'MIRROR') for q in first_of_class.values()]
    P1 += [first_of_class[c] for c in ['BODY_REGION', 'TERRACE_VS_BODY', 'OPENING_VS_PATTERN', 'WALL_CONTINUATION', 'CANOPY_PERGOLA_VS_WALL', 'OUTER_BOUNDARY_A_OR_B', 'GARAGE_BODY']]
    P1.append(next(q for q in real if q['cls'] == 'BODY_REGION' and q['expected'] == 'NO'))

    # ROUND8_DEV: every NORMAL question, and the MIRROR twin of four
    r8 = sorted([q for q in pool if q['set'] == 'ROUND8_DEV' and q['transform'] == 'NORMAL'], key=lambda q: h(q['qid']))
    P2 += r8 + [twin(q, 'MIRROR') for q in r8[:4]]
    P1 += [q for q in r8 if q['group'] == 'dom-w-gozdzikowcach'][:2] + [q for q in r8 if q['group'] == 'dom-w-cyklamenach'][:2]

    # MURAJACH_DEV and STOREY_DEV: all
    mj = [q for q in pool if q['set'] == 'MURAJACH_DEV']
    P2 += mj
    P1 += [q for q in mj if q['qid'].endswith(('M1', 'M3', 'M4'))]
    sd = [q for q in pool if q['set'] == 'STOREY_DEV']
    P2 += sd
    P1 += sd[:1]

    # GAPSET_DEV: balanced OPENING / NOT_A_WALL_LINE, spread over projects
    gs = [q for q in pool if q['set'] == 'GAPSET_DEV']
    g_open = round_robin([q for q in gs if q['expected'] == 'OPENING'], 8, lambda q: q['group'])
    g_not = round_robin([q for q in gs if q['expected'] == 'NOT_A_WALL_LINE'], 8, lambda q: q['group'])
    P2 += g_open + g_not
    P1 += g_open[:2] + g_not[:2]

    # SYNTH_CF (005J): both members of one pair per family, NORMAL, question 0
    fams = ['porch_plus_garage', 'garage_door_vs_open', 'porch_recess', 'terrace_vs_room', 'glazing_terrace', 'podcien', 'garage_link', 'canopy_roofline']
    for i, f in enumerate(fams):
        pair = [by[f'005j:{f}-s0-{v}-NORMAL-q0'] for v in 'AB']
        P2 += pair
        if i < 2:
            P1 += pair

    # SYNTH_GLOBAL (005M sealed TEST): context-dependent pairs, local pairs, transform twins, the both-YES storey control
    ctx = ['garage_vs_carport', 'corridor_vs_passage', 'wing_storey', 'inset_upper']
    loc = ['loggia_vs_room', 'compound_front', 'glazed_front', 'phantom_line']
    for f in ctx:
        for s in (0, 1, 2):
            pair = [by[f'005m:test-{f}-s{s}-{v}-NORMAL-q0'] for v in 'AB']
            P2 += pair
            if s == 0:
                P1 += pair
                P2 += [twin(q, 'MIRROR') for q in pair]
            if s == 1:
                P2 += [twin(pair[0], 'ROT90')]
    for f in loc:
        for s in (0, 1):
            P2 += [by[f'005m:test-{f}-s{s}-{v}-NORMAL-q0'] for v in 'AB']
    P2 += [by[f'005m:test-wing_storey-s0-{v}-NORMAL-q1'] for v in 'AB']

    assert all(q is not None for q in P2 + P1)
    ids2 = list(dict.fromkeys(q['qid'] for q in P2))
    ids1 = list(dict.fromkeys(q['qid'] for q in P1))
    assert set(ids1) <= set(ids2), 'PHASE1 must be a subset of PHASE2'
    os.makedirs(a.out, exist_ok=True)
    json.dump({'phase1': ids1, 'phase2': ids2}, open(os.path.join(a.out, 'selection.json'), 'w'), indent=1)
    from collections import Counter
    print(json.dumps({'phase1': len(ids1), 'phase2': len(ids2), 'phase2BySet': Counter(by[i]['set'] for i in ids2), 'phase1BySet': Counter(by[i]['set'] for i in ids1)}, indent=1))


if __name__ == '__main__':
    main()
