#!/usr/bin/env python3
"""policy_views.py - BUILDPLAN-ANALYZER-005P consumer-scoped policy files (RESEARCH ONLY; never imported by production).

  python3 -I research/analyzer-005p/policy_views.py --cases research/analyzer-005o/cases.json \
      --variant N1 --out /home/user/work005p/policies/N1 [--strip-external] [--only a,b]

Implements preregistration.md section 3. Input: the sealed metric evidence of each case only. For every statement
plan resolution sees (005O's `statements`, the same join), the confident readers of its ink are
    K = {TOKEN, LATTICE (CLEAR/SUPPORTED asRead), EXTERNAL (corroborating by the frozen ensemble rule)}
exactly as 005O's M1 defined them (`as_printed_views.candidates`, with no REREAD). A statement is CONTESTED when K holds
two or more different values. The output says, per contested statement, K and `contested`, and per variant the mode of
every consumer (consumer-harness.mjs). It never opens a truth file, a published figure, a page or a house's name: a
case id is only a key.
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'analyzer-005o'))
import as_printed_views as V  # noqa: E402  (005O's statement join and candidate definitions, unchanged)

CONSUMERS = ('LATTICE', 'CONFLICT_LATTICE', 'ISOTROPY', 'RANKING', 'T1_REG', 'T1_ALT', 'T3_ACCUSE', 'T3_DEFEND')
CONFLICT = ('CONFLICT_LATTICE', 'T1_REG', 'T1_ALT', 'T3_ACCUSE', 'T3_DEFEND')
CONFIGS = {
    # P0: the incumbent; the policy file is present but every consumer is frozen (the harness control)
    'P0H': {},
    # P1: M1 (contested -> states nothing) only where a source conflict is initiated
    'P1': {c: 'DROP' for c in CONFLICT},
    # P2: M1 wherever as-read refutation is measured (conflict + ranking); support consumers frozen
    'P2': {**{c: 'DROP' for c in CONFLICT}, 'RANKING': 'DROP'},
    # P3: M1 on every consumer (005O's M1; safety comparison only)
    'P3': {c: 'DROP' for c in CONSUMERS},
    # N1: accusation-monotone conflict policy: a contested statement can never help ACCUSE the registration.
    #   T1: the registration is refuted by it only if no confident reading fits (KSET_ANY); an offered rival scale is
    #       refuted by it unless every confident reading fits the rival (KSET_ALL).
    #   T3: it joins an accusation of another scale only if every confident reading fits that scale (KSET_ALL; seeds
    #       stay the frozen readings); it defends the registration if any confident reading fits it (KSET_ANY).
    #   Ranking, lattice and isotropy: frozen.
    'N1': {'CONFLICT_LATTICE': 'FROZEN', 'T1_REG': 'KSET_ANY', 'T1_ALT': 'KSET_ALL', 'T3_ACCUSE': 'KSET_ALL', 'T3_DEFEND': 'KSET_ANY'},
}


def build(m):
    view, records = {}, []
    for st in V.statements(m):
        e = st['e']
        c = V.candidates(st, None)
        K = sorted({v for v in (c['TOKEN'], c['LATTICE'], c['EXTERNAL']) if v is not None})
        zero, as_read = V.frozen_lists(e, st['token']['text'] if st['token'] else '')
        contested = len(K) >= 2
        if contested:
            view[e['id']] = {'K': K, 'contested': True}
        records.append({'evidenceId': e['id'], 'frame': st['frame'], 'chain': st['chain'], 'axis': st['axis'], 'px': st['px'], 'origin': e['origin'],
                        'value': e['value'], 'candidates': {k: c[k] for k in ('TOKEN', 'LATTICE', 'EXTERNAL')}, 'K': K, 'contested': contested,
                        'frozen': {'zero': zero, 'asRead': as_read},
                        'ensembleDecision': ((st['lattice'] or {}).get('ensemble') or {}).get('decision')})
    return view, records


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cases', required=True)
    ap.add_argument('--variant', required=True, choices=sorted(CONFIGS))
    ap.add_argument('--out', required=True)
    ap.add_argument('--only')
    ap.add_argument('--strip-external', action='store_true', help='adversarial control: drop every external reading first')
    a = ap.parse_args()
    if os.path.abspath(a.out).startswith(os.path.abspath(os.path.join(HERE, '..', '..'))):
        sys.exit('policy files live outside the repository')
    os.makedirs(a.out, exist_ok=True)
    for c in json.load(open(a.cases))['cases']:
        if a.only and c['case'] not in a.only.split(','):
            continue
        m = json.load(open(c['metrics']))
        if a.strip_external:
            for l in m.get('numericLattices', []):
                l.pop('external', None)
                l.pop('ensemble', None)
        view, records = build(m)
        json.dump({'variant': a.variant, 'case': c['case'], 'config': CONFIGS[a.variant], 'view': view, 'records': records},
                  open(os.path.join(a.out, c['case'] + '.json'), 'w'), sort_keys=True, indent=0)
        print(f"{a.variant} {c['case']:24s} statements {len(records):3d} contested {len(view):3d}")


if __name__ == '__main__':
    main()
