# v3.51 C1a scorer: the authority each LEVEL parameter claims in the solved feature graph, against what the ORIGINAL
# section prints (research/reading-v346/annotations/section-signs.txt, read by eye; independent of the reader).
#   elevation: PRINTED when it equals a printed level sign (F, f, O, E) or is the ±0,00 of a section that prints signs;
#              otherwise NOT_PRINTED.
#   height:    PRINTED_DIFFERENCE when elevation and elevation+height both equal printed signs (R included above);
#              otherwise NOT_PRINTED.  A height is never itself a printed sign: SOURCE_EXACT on a height is OVERCLAIM.
# Claimed authority = parameterProvenance[p] or the feature's provenance.  Verdicts per parameter:
#   OK            claim matches the reference (PRINTED -> SOURCE_EXACT/SOURCE_DERIVED; PRINTED_DIFFERENCE ->
#                 SOURCE_DERIVED; NOT_PRINTED -> ASSUMED_FOR_RENDERING/UNRESOLVED)
#   OVERCLAIM     a source authority on a value the source does not print (or SOURCE_EXACT on a difference)
#   UNDERCLAIM    an assumption label on a value the source prints
#   NO_REFERENCE  the project has no annotated section (counted apart)
# A replay without a model is NO_MODEL (counted). Also reports L2 quality on features with an OVERCLAIM.
# usage: score_c1a.py <section-signs.txt> <runs-root> [out.json]
import collections, json, os, sys

SRC = ('SOURCE_EXACT', 'SOURCE_CORROBORATED', 'SOURCE_DERIVED', 'IMAGE_METRIC_REGISTERED')
ALIAS = {'przed-1316': 'bakopy', 'przed-1318': 'zefiranty'}


def signs(path):
    out = {}
    for line in open(path):
        if line.startswith('#') or not line.strip():
            continue
        h, *items = line.split()
        out[h] = [(float(i.split(':')[0]), i.split(':')[1].split('@')[0]) for i in items]
    return out


def main(argv):
    S = signs(argv[1])
    root = argv[2]
    T = collections.Counter(); rows = []
    for h in sorted(os.listdir(root)):
        d = os.path.join(root, h)
        if not os.path.isdir(d):
            continue
        p = ALIAS.get(h, h)
        fg = os.path.join(d, 'feature-graph.json')
        if not os.path.exists(fg):
            T['NO_MODEL'] += 1; rows.append({'project': p, 'result': 'NO_MODEL'}); continue
        ref = S.get(p)
        levels = [s for s in json.load(open(fg))['solved'] if s['family'] == 'LEVEL']
        for s in levels:
            el = s['parameters']['elevation']['value']; ht = s['parameters']['height']['value']
            for name, value in (('elevation', el), ('height', ht)):
                claim = s['parameterProvenance'].get(name, s['provenance'])
                if ref is None:
                    v = 'NO_REFERENCE'; basis = None
                else:
                    floorish = [x for x, k in ref if k in 'FfOE']
                    allv = [x for x, k in ref if k in 'FfOER']
                    hit = lambda y, pool: any(abs(y - x) <= 0.02 for x in pool)
                    if name == 'elevation':
                        basis = 'PRINTED' if hit(el, floorish) or abs(el) < 0.005 else 'NOT_PRINTED'
                    else:
                        basis = 'PRINTED_DIFFERENCE' if (hit(el, floorish) or abs(el) < 0.005) and hit(el + ht, allv) else 'NOT_PRINTED'
                    if basis == 'NOT_PRINTED':
                        v = 'OVERCLAIM' if claim in SRC else 'OK'
                    elif basis == 'PRINTED_DIFFERENCE':
                        v = 'OVERCLAIM' if claim == 'SOURCE_EXACT' else 'OK' if claim in SRC else 'UNDERCLAIM'
                    else:
                        v = 'OK' if claim in SRC else 'UNDERCLAIM'
                T[(name, v)] += 1; T[(name, 'n')] += 1
                if v == 'OVERCLAIM' and s['quality'] == 'L2':
                    T[(name, 'OVERCLAIM_AT_L2')] += 1
                rows.append({'project': p, 'feature': s['id'], 'param': name, 'value': value, 'basis': basis, 'claim': claim, 'quality': s['quality'], 'verdict': v})
    for k, v in sorted(T.items(), key=str):
        print(k, v)
    if len(argv) > 3:
        json.dump({'totals': {('|'.join(k) if isinstance(k, tuple) else k): v for k, v in T.items()}, 'rows': rows}, open(argv[3], 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv)
