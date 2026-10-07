#!/usr/bin/env python3
"""score.py - the pre-registered scorer of BUILDPLAN-ANALYZER-005M (RESEARCH ONLY).

    python -I -B research/analyzer-005m/score.py --items <W>/items/items.jsonl --runs <a.jsonl,b.jsonl,...> \
        --out-dir stage-reports/artifacts/analyzer-005m-vr2 [--old-smol <W005J>/bench/smolvlm2.jsonl --old-items <W005J>/bench/items-all.jsonl] \
        [--exclude stage-reports/artifacts/analyzer-005m-vr2/excluded-items.json]

Fixed before any result was read (brief sections 8-10):
  * a reply's semantic answer is the option its letter names; UNRESOLVED is never wrong; a parse failure, an HTTP
    error or a missing reply is a FAILURE (counted, never right, never confident-wrong)
  * CONFIDENT_WRONG (primary): a wrong semantic answer with stated confidence HIGH
    CONFIDENT_WRONG_P80 (secondary, 005J's rule): a wrong answer whose own option probability is >= 0.80
  * CONFIDENT_WRONG_RATE = confident-wrong / questions asked (every item in the matched set), Wilson 95 %
  * exact accuracy = right / asked; resolved accuracy = right / answered; coverage = answered / asked
  * only MATCHED sets are compared: the same question ids for every arm and mode in a table; nothing is pooled
    across different subsets
  * advancement after phase 1: lowest CONFIDENT_WRONG_RATE over all five modes of the phase-1 set, then the highest
    exact accuracy; the best three advance
  * context gain: for every question, A_CROP_ONLY against C, D and E: WRONG->RIGHT, RIGHT->WRONG, WRONG->UNRESOLVED,
    UNRESOLVED->RIGHT, OTHER (any other change), SAME (no change)
"""
import argparse
import json
import math
import os
import random
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CLASSES  # noqa: E402

MODES = ['A_CROP_ONLY', 'B_FULL_PLAN', 'C_FULL_PLAN_MARKED_ROI', 'D_MARKED_ROI_PLUS_CROP', 'E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY']
REAL_SETS = ['REAL_DEV', 'ROUND8_DEV', 'MURAJACH_DEV', 'STOREY_DEV', 'GAPSET_DEV']
SYN_SETS = ['SYNTH_CF', 'SYNTH_GLOBAL']
HUMAN_TRUTH = ('TRUTH_005I', 'BLIND8_DIAGNOSIS')
BOOT, BOOT_SEED = 2000, 5005
THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 0.999]
SYN_CLUSTER = re.compile(r'^(005[jm]:(?:test-|train-|val-)?[a-z_]+-s\d+)-')


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def rate(k, n):
    return {'k': k, 'n': n, 'rate': round(k / n, 4) if n else None, 'wilson95': wilson(k, n)}


def outcome(it, rec):
    """RIGHT / WRONG / UNRESOLVED / FAILURE, the semantic answer, and the two confident-wrong flags."""
    if rec is None or rec.get('error') or rec.get('answer') is None:
        return {'o': 'FAILURE', 'key': None, 'cw': False, 'cw80': False, 'p': None, 'conf': None}
    letter = rec['answer']
    if letter == 'UNRESOLVED':
        return {'o': 'UNRESOLVED', 'key': 'UNRESOLVED', 'cw': False, 'cw80': False, 'p': (rec.get('enumProbs') or {}).get('UNRESOLVED'), 'conf': rec.get('confidence')}
    key = next((k for l, k, _ in it['shown'] if l == letter), None)
    p = (rec.get('enumProbs') or {}).get(letter)
    right = key == it['expected']
    o = 'RIGHT' if right else 'WRONG'
    return {'o': o, 'key': key, 'cw': (not right) and rec.get('confidence') == 'HIGH', 'cw80': (not right) and p is not None and p >= 0.80, 'p': p, 'conf': rec.get('confidence')}


def summarize(rows):
    n = len(rows)
    c = Counter(r['o'] for r in rows)
    answered = c['RIGHT'] + c['WRONG']
    return {'n': n, 'right': c['RIGHT'], 'wrong': c['WRONG'], 'unresolved': c['UNRESOLVED'], 'failures': c['FAILURE'],
            'exactAccuracy': rate(c['RIGHT'], n), 'resolvedAccuracy': rate(c['RIGHT'], answered), 'coverage': rate(answered, n),
            'unresolvedRate': rate(c['UNRESOLVED'], n), 'failureRate': rate(c['FAILURE'], n),
            'CONFIDENT_WRONG_RATE': rate(sum(r['cw'] for r in rows), n), 'CONFIDENT_WRONG_P80_RATE': rate(sum(r['cw80'] for r in rows), n),
            'confidentWrongAmongAnswered': rate(sum(r['cw'] for r in rows), answered),
            'statedHighShareAmongAnswered': rate(sum(r['conf'] == 'HIGH' for r in rows if r['o'] in ('RIGHT', 'WRONG')), answered),
            'p80ShareAmongAnswered': rate(sum((r['p'] or 0) >= 0.80 for r in rows if r['o'] in ('RIGHT', 'WRONG')), answered)}


def consistency(items_by_q, res, model, mode, pair_of):
    """Share of matched twin pairs (both answered) that give the same semantic answer."""
    same = tot = 0
    for qa, qb in pair_of:
        ra, rb = res.get((model, qa, mode)), res.get((model, qb, mode))
        if not ra or not rb or ra['o'] not in ('RIGHT', 'WRONG') or rb['o'] not in ('RIGHT', 'WRONG'):
            continue
        tot += 1
        same += ra['key'] == rb['key']
    return rate(same, tot)


def consistency_005j(res, model, mode, pair_of):
    """005J's denominator: twin pairs where both replied (UNRESOLVED is an answer); same = same semantic answer."""
    same = tot = 0
    for qa, qb in pair_of:
        ra, rb = res.get((model, qa, mode)), res.get((model, qb, mode))
        if not ra or not rb or ra['o'] == 'FAILURE' or rb['o'] == 'FAILURE':
            continue
        tot += 1
        same += ra['key'] == rb['key']
    return rate(same, tot)


def cluster_of(meta):
    m = SYN_CLUSTER.match(meta['qid'])
    return m.group(1) if m else 'house:' + str(meta.get('group'))


def first_option(cls):
    return CLASSES[cls][1][0][0]


def boot(clusters, stats, seed=BOOT_SEED):
    """Paired cluster bootstrap: stats = {arm: {cluster: (n, k)}}; every arm sees the same resampled clusters."""
    rng = random.Random(seed)
    cl = sorted(clusters)
    draws = {arm: [] for arm in stats}
    for _ in range(BOOT):
        pick = [cl[rng.randrange(len(cl))] for _ in cl]
        for arm, st in stats.items():
            n = sum(st[c][0] for c in pick)
            k = sum(st[c][1] for c in pick)
            draws[arm].append(k / n if n else float('nan'))
    return draws


def ci(xs):
    xs = sorted(x for x in xs if x == x)
    return [round(xs[int(0.025 * (len(xs) - 1))], 4), round(xs[int(0.975 * (len(xs) - 1))], 4)] if xs else [None, None]


def risk_coverage(rows):
    """rows: answered outcomes with option probability; selective risk at fixed thresholds (in-sample)."""
    rows = [r for r in rows if r['p'] is not None]
    out = []
    for t in [0.0] + THRESHOLDS:
        cov = [r for r in rows if r['p'] >= t]
        k = sum(r['o'] == 'WRONG' for r in cov)
        out.append({'threshold': t, 'covered': len(cov), 'coverage': round(len(cov) / len(rows), 4) if rows else None,
                    'wrong': k, 'selectiveRisk': round(k / len(cov), 4) if cov else None, 'wilsonUpper': wilson(k, len(cov))[1]})
    wrong_p = [r['p'] for r in rows if r['o'] == 'WRONG']
    zero = max(wrong_p) if wrong_p else None
    above = [r for r in rows if zero is not None and r['p'] > zero]
    return {'curve': out, 'inSampleZeroErrorRegion': {'aboveP': zero, 'covered': len(above), 'coverage': round(len(above) / len(rows), 4) if rows else None,
                                                     'note': 'chosen on the same answers it is evaluated on; not a validated operating point'}}


def auroc(pairs):
    """pairs: (score, is_right). Probability a right answer outscores a wrong one."""
    pos = [s for s, y in pairs if y]
    neg = [s for s, y in pairs if not y]
    if not pos or not neg:
        return None
    wins = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
    return round(wins / (len(pos) * len(neg)), 4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--items', required=True)
    ap.add_argument('--runs', required=True)
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--old-smol', default=None)
    ap.add_argument('--old-items', default=None)
    ap.add_argument('--exclude', default=None)
    a = ap.parse_args()
    items = [json.loads(l) for l in open(a.items)]
    it_by = {(it['qid'], it['mode']): it for it in items}
    q_meta = {it['qid']: it for it in items}
    excluded = {}
    if a.exclude:
        excluded = {x['qid']: x['finding'] for x in json.load(open(a.exclude))['items']}
    raw = {}
    models = []
    for path in a.runs.split(','):
        for l in open(path):
            r = json.loads(l)
            raw[(r['model'], r['qid'], r['mode'])] = r
            if r['model'] not in models:
                models.append(r['model'])
    res = {}
    for (m, q, mode), r in raw.items():
        res[(m, q, mode)] = outcome(it_by[(q, mode)], r)
    phase1_pre = sorted({it['qid'] for it in items if it['phase1']})
    phase2_pre = sorted({it['qid'] for it in items})
    phase1 = [q for q in phase1_pre if q not in excluded]
    phase2 = [q for q in phase2_pre if q not in excluded]
    covered = {m: {q for (mm, q, mode) in res if mm == m} for m in models}

    def complete(m, qs):
        return all((m, q, mode) in res for q in qs for mode in MODES)

    out = {'researchOnly': 'BUILDPLAN-ANALYZER-005M', 'rules': __doc__.split('Fixed before any result was read (brief sections 8-10):')[1].strip(),
           'models': models, 'excluded': excluded, 'phase1Questions': len(phase1), 'phase2Questions': len(phase2),
           'phase1QuestionsPreRegistered': len(phase1_pre), 'phase2QuestionsPreRegistered': len(phase2_pre), 'tables': {}}

    def subset(qs, s):
        if s == 'REAL_ALL':
            return [q for q in qs if q_meta[q]['set'] in REAL_SETS]
        if s == 'SYNTH_ALL':
            return [q for q in qs if q_meta[q]['set'] in SYN_SETS]
        if s == 'REAL_HUMAN_TRUTH':
            return [q for q in qs if q_meta[q]['set'] in REAL_SETS and q_meta[q].get('truthSource') in HUMAN_TRUTH]
        if s == 'REAL_AI_AUTHORED_TRUTH':
            return [q for q in qs if q_meta[q]['set'] in REAL_SETS and q_meta[q].get('truthSource') not in HUMAN_TRUTH]
        if s == 'ALL':
            return list(qs)
        return [q for q in qs if q_meta[q]['set'] == s]

    SUBSETS = ['REAL_ALL', 'SYNTH_ALL', 'REAL_HUMAN_TRUTH', 'REAL_AI_AUTHORED_TRUTH']

    def table(name, qs, ms):
        t = {'questions': len(qs), 'models': ms, 'byModelMode': {}, 'bySet': {}, 'byClass': {}, 'consistency': {}, 'latency': {}, 'tokens': {}}
        mirror = [(q, q.replace('-NORMAL', '-MIRROR')) for q in qs if '-NORMAL' in q and q.replace('-NORMAL', '-MIRROR') in qs]
        rot = [(q, q.replace('-NORMAL', '-ROT90')) for q in qs if '-NORMAL' in q and q.replace('-NORMAL', '-ROT90') in qs]
        cf = [(q, q_meta[q]['pairItemQid']) for q in qs if q_meta[q].get('pairItemQid') in qs and q_meta[q].get('variant') == 'A']
        cf_control = [(qa, qb) for qa, qb in cf if q_meta[qa]['expected'] == q_meta[qb]['expected']]
        cf_ctx = [(qa, qb) for qa, qb in cf if (qa, qb) not in cf_control and it_by[(qa, 'A_CROP_ONLY')].get('cropIdenticalToPair')]
        cf_local = [(qa, qb) for qa, qb in cf if (qa, qb) not in cf_control and (qa, qb) not in cf_ctx]
        t['pairs'] = {'mirror': len(mirror), 'rotation90': len(rot), 'counterfactualContext': len(cf_ctx), 'counterfactualLocal': len(cf_local),
                      'counterfactualSameTruthControls': len(cf_control)}

        def pairstat(m, mode, pairs):
            st = {'pairs': 0, 'bothRight': 0, 'sameAnswer': 0}
            for qa, qb in pairs:
                ra, rb = res[(m, qa, mode)], res[(m, qb, mode)]
                if ra['o'] in ('RIGHT', 'WRONG') and rb['o'] in ('RIGHT', 'WRONG'):
                    st['pairs'] += 1
                    st['bothRight'] += ra['o'] == 'RIGHT' and rb['o'] == 'RIGHT'
                    st['sameAnswer'] += ra['key'] == rb['key']
            return {'pairsAnswered': st['pairs'], 'bothRight': rate(st['bothRight'], st['pairs']), 'sameAnswer': rate(st['sameAnswer'], st['pairs']),
                    'bothRightOfAllPairs': rate(st['bothRight'], len(pairs))}

        for m in ms:
            for mode in MODES:
                rows = [res[(m, q, mode)] for q in qs]
                key = f'{m}|{mode}'
                t['byModelMode'][key] = summarize(rows)
                t['bySet'][key] = {s: summarize([res[(m, q, mode)] for q in subset(qs, s)]) for s in REAL_SETS + SYN_SETS if subset(qs, s)}
                for s in SUBSETS:
                    t['bySet'][key][s] = summarize([res[(m, q, mode)] for q in subset(qs, s)])
                t['byClass'][key] = {c: summarize([res[(m, q, mode)] for q in qs if q_meta[q]['cls'] == c]) for c in sorted({q_meta[q]['cls'] for q in qs})}
                t['consistency'][key] = {'mirror': consistency(None, res, m, mode, mirror), 'rotation90': consistency(None, res, m, mode, rot),
                                         'mirror005jDenominator': consistency_005j(res, m, mode, mirror), 'rotation90_005jDenominator': consistency_005j(res, m, mode, rot),
                                         'counterfactualContextPairs': pairstat(m, mode, cf_ctx), 'counterfactualLocalPairs': pairstat(m, mode, cf_local),
                                         'pooledPreRegistered': pairstat(m, mode, cf)}
                walls = sorted(raw[(m, q, mode)]['wallMs'] for q in qs if 'wallMs' in raw[(m, q, mode)])
                toks = sorted(raw[(m, q, mode)].get('imageTokens') or 0 for q in qs)
                anon = [((raw[(m, q, mode)].get('rss') or {}).get('RssAnon') or 0) for q in qs]
                t['latency'][key] = {'medianWallMs': walls[len(walls) // 2] if walls else None, 'p90WallMs': walls[int(len(walls) * 0.9)] if walls else None,
                                     'maxRssAnonBytes': max(anon) if anon else None}
                t['tokens'][key] = {'medianImageTokens': toks[len(toks) // 2] if toks else None, 'maxImageTokens': max(toks) if toks else None}
            t['byModelMode'][f'{m}|ALL_MODES'] = summarize([res[(m, q, mode)] for q in qs for mode in MODES])
            for s in SUBSETS:
                t['bySet'][f'{m}|ALL_MODES'] = t['bySet'].get(f'{m}|ALL_MODES', {})
                t['bySet'][f'{m}|ALL_MODES'][s] = summarize([res[(m, q, mode)] for q in subset(qs, s) for mode in MODES])
        # baselines: no image, no model
        t['baselines'] = {}
        for s in REAL_SETS + SYN_SETS + SUBSETS + ['ALL']:
            sq = subset(qs, s)
            if not sq:
                continue
            by_cls = defaultdict(Counter)
            for q in sq:
                by_cls[q_meta[q]['cls']][q_meta[q]['expected']] += 1
            t['baselines'][s] = {'n': len(sq),
                                 'alwaysLetter': {L: rate(sum(it_by[(q, 'A_CROP_ONLY')]['expectedLetter'] == L for q in sq), len(sq)) for L in 'ABC'},
                                 'firstOptionRule': rate(sum(q_meta[q]['expected'] == first_option(q_meta[q]['cls']) for q in sq), len(sq)),
                                 'perClassMajorityFittedUpperBound': rate(sum(c.most_common(1)[0][1] for c in by_cls.values()), len(sq))}
        # cluster bootstrap: accuracy and CONFIDENT_WRONG_RATE per arm, model - prior, model - model
        clusters = sorted({cluster_of(q_meta[q]) for q in qs})
        t['clusters'] = {'n': len(clusters), 'rule': 'a real house, or a synthetic scene pair with all its transforms', 'resamples': BOOT, 'seed': BOOT_SEED}

        def per_cluster(fn, modes):
            st = {c: [0, 0] for c in clusters}
            for q in qs:
                for mode in modes:
                    c = cluster_of(q_meta[q])
                    st[c][0] += 1
                    st[c][1] += fn(q, mode)
            return {c: tuple(v) for c, v in st.items()}

        stats = {}
        for mode in MODES + ['ALL_MODES']:
            md = MODES if mode == 'ALL_MODES' else [mode]
            stats[f'PRIOR|{mode}'] = per_cluster(lambda q, _m: q_meta[q]['expected'] == first_option(q_meta[q]['cls']), md)
            for m in ms:
                stats[f'{m}|{mode}|acc'] = per_cluster(lambda q, mo, m=m: res[(m, q, mo)]['o'] == 'RIGHT', md)
                stats[f'{m}|{mode}|cwr'] = per_cluster(lambda q, mo, m=m: res[(m, q, mo)]['cw'], md)
        draws = boot(clusters, stats)
        cb = {'byArm': {}, 'modelMinusFirstOptionPrior': {}, 'pairwise': {}}
        for mode in MODES + ['ALL_MODES']:
            pr = draws[f'PRIOR|{mode}']
            for m in ms:
                acc, cwr = draws[f'{m}|{mode}|acc'], draws[f'{m}|{mode}|cwr']
                cb['byArm'][f'{m}|{mode}'] = {'exactAccuracy95': ci(acc), 'CONFIDENT_WRONG_RATE95': ci(cwr)}
                d = [x - y for x, y in zip(acc, pr)]
                cb['modelMinusFirstOptionPrior'][f'{m}|{mode}'] = {'ci95': ci(d), 'shareAboveZero': round(sum(x > 0 for x in d) / len(d), 4)}
            for i, m1 in enumerate(ms):
                for m2 in ms[i + 1:]:
                    dc = [x - y for x, y in zip(draws[f'{m1}|{mode}|cwr'], draws[f'{m2}|{mode}|cwr'])]
                    da = [x - y for x, y in zip(draws[f'{m1}|{mode}|acc'], draws[f'{m2}|{mode}|acc'])]
                    cb['pairwise'][f'{m1} - {m2}|{mode}'] = {'cwrDiff95': ci(dc), 'accDiff95': ci(da)}
        t['clusterBootstrap'] = cb
        return t

    def ranking(tab, ms):
        rk = sorted(ms, key=lambda m: (tab['byModelMode'][f'{m}|ALL_MODES']['CONFIDENT_WRONG_RATE']['rate'], -tab['byModelMode'][f'{m}|ALL_MODES']['exactAccuracy']['rate']))
        return [{'model': m, 'cwr': tab['byModelMode'][f'{m}|ALL_MODES']['CONFIDENT_WRONG_RATE']['rate'],
                 'exactAccuracy': tab['byModelMode'][f'{m}|ALL_MODES']['exactAccuracy']['rate']} for m in rk]

    p1_models = [m for m in models if complete(m, phase1_pre)]
    p2_models = [m for m in models if complete(m, phase2_pre)]
    out['tables']['PHASE1'] = table('PHASE1', phase1, p1_models)
    out['phase1Ranking'] = ranking(out['tables']['PHASE1'], p1_models)
    if p2_models:
        out['tables']['PHASE2'] = table('PHASE2', phase2, p2_models)
    # the pre-registered sets, every question: headline rows only
    out['preRegistered'] = {'PHASE1': {f'{m}|{mode}': summarize([res[(m, q, md)] for q in phase1_pre for md in (MODES if mode == 'ALL_MODES' else [mode])])
                                       for m in p1_models for mode in MODES + ['ALL_MODES']}}
    if p2_models:
        out['preRegistered']['PHASE2'] = {f'{m}|{mode}': summarize([res[(m, q, md)] for q in phase2_pre for md in (MODES if mode == 'ALL_MODES' else [mode])])
                                          for m in p2_models for mode in MODES + ['ALL_MODES']}
    out['phase1RankingPreRegistered'] = [{'model': m, 'cwr': out['preRegistered']['PHASE1'][f'{m}|ALL_MODES']['CONFIDENT_WRONG_RATE']['rate'],
                                          'exactAccuracy': out['preRegistered']['PHASE1'][f'{m}|ALL_MODES']['exactAccuracy']['rate']}
                                         for m in sorted(p1_models, key=lambda m: (out['preRegistered']['PHASE1'][f'{m}|ALL_MODES']['CONFIDENT_WRONG_RATE']['rate'],
                                                                                   -out['preRegistered']['PHASE1'][f'{m}|ALL_MODES']['exactAccuracy']['rate']))]
    out['coverage'] = {m: {'questionsWithAnyRecord': len(covered[m]), 'phase1Complete': m in p1_models, 'phase2Complete': m in p2_models} for m in models}

    # context gain: A against B..E per model, on matched sets
    gain = {'rules': 'per question, the outcome in A_CROP_ONLY against the same question in B, C, D and E; on the amended matched sets '
                     '(PHASE1: every phase-1 model; PHASE2: every phase-2 model). netRightChange = right in the mode - right in A',
            'tables': {}}
    for tname, qs, ms in (('PHASE1', phase1, p1_models), ('PHASE2', phase2, p2_models)):
        if not ms:
            continue
        gt = {}
        for m in ms:
            g = {'questions': len(qs)}
            for mode in MODES[1:]:
                tr, other = Counter(), Counter()
                per = []
                for q in qs:
                    ra, rx = res[(m, q, 'A_CROP_ONLY')], res[(m, q, mode)]
                    oa, ox = ra['o'], rx['o']
                    if oa == ox and ra['key'] == rx['key']:
                        kind = 'SAME'
                    elif (oa, ox) in (('WRONG', 'RIGHT'), ('RIGHT', 'WRONG'), ('WRONG', 'UNRESOLVED'), ('UNRESOLVED', 'RIGHT')):
                        kind = f'{oa}->{ox}'
                    else:
                        kind = 'OTHER'
                        other['involves FAILURE' if 'FAILURE' in (oa, ox) else ('WRONG->WRONG (other option)' if oa == ox else f'{oa}->{ox}')] += 1
                    tr[kind] += 1
                    if kind != 'SAME':
                        per.append({'qid': q, 'set': q_meta[q]['set'], 'cls': q_meta[q]['cls'], 'from': oa, 'to': ox, 'kind': kind,
                                    'contextDependent': q_meta[q].get('contextDependent', False)})
                ctx = [q for q in qs if q_meta[q].get('contextDependent')]
                g[f'A->{mode}'] = {'transitions': dict(tr), 'otherBreakdown': dict(other),
                                   'netRightChange': sum(res[(m, q, mode)]['o'] == 'RIGHT' for q in qs) - sum(res[(m, q, 'A_CROP_ONLY')]['o'] == 'RIGHT' for q in qs),
                                   'changes': per,
                                   'contextDependentOnly': {'n': len(ctx), 'rightInA': sum(res[(m, q, 'A_CROP_ONLY')]['o'] == 'RIGHT' for q in ctx),
                                                            'rightInMode': sum(res[(m, q, mode)]['o'] == 'RIGHT' for q in ctx),
                                                            'unresolvedInA': sum(res[(m, q, 'A_CROP_ONLY')]['o'] == 'UNRESOLVED' for q in ctx)}}
            gt[m] = g
        gain['tables'][tname] = gt

    # calibration: stated confidence and option probability against correctness, on matched sets
    cal = {'rules': 'answered items only; stated confidence levels and option-probability bins; AUROC of the option probability for being right; '
                    'ECE over 10 bins; risk-coverage at fixed thresholds (in-sample); agreement filters across modes', 'tables': {}}

    def calib(rows):
        by_conf = {lvl: rate(sum(r['o'] == 'RIGHT' for r in rows if r['conf'] == lvl), sum(1 for r in rows if r['conf'] == lvl)) for lvl in ('LOW', 'MEDIUM', 'HIGH')}
        bins = defaultdict(lambda: [0, 0, 0.0])
        for r in rows:
            if r['p'] is None:
                continue
            b = min(9, int(r['p'] * 10))
            bins[b][0] += 1
            bins[b][1] += r['o'] == 'RIGHT'
            bins[b][2] += r['p']
        nb = sum(v[0] for v in bins.values())
        ece = sum(abs(v[1] / v[0] - v[2] / v[0]) * v[0] / nb for v in bins.values()) if nb else None
        return {'answered': len(rows), 'statedConfidence': by_conf, 'highShare': rate(sum(r['conf'] == 'HIGH' for r in rows), len(rows)),
                'probBins': {f'{b / 10:.1f}-{(b + 1) / 10:.1f}': {'n': v[0], 'accuracy': round(v[1] / v[0], 4), 'meanP': round(v[2] / v[0], 4)} for b, v in sorted(bins.items())},
                'ECE': round(ece, 4) if ece is not None else None, 'AUROC': auroc([(r['p'], r['o'] == 'RIGHT') for r in rows if r['p'] is not None])}

    for tname, qs, ms in (('PHASE1', phase1, p1_models), ('PHASE2', phase2, p2_models)):
        if not ms:
            continue
        ct = {}
        for m in ms:
            cm = {}
            ans = lambda qq, mds: [res[(m, q, md)] for q in qq for md in mds if res[(m, q, md)]['o'] in ('RIGHT', 'WRONG')]
            for mode in MODES + ['ALL_MODES']:
                cm[mode] = calib(ans(qs, MODES if mode == 'ALL_MODES' else [mode]))
            cm['bySubset'] = {s: {mode: calib(ans(subset(qs, s), MODES if mode == 'ALL_MODES' else [mode])) for mode in ('ALL_MODES', 'D_MARKED_ROI_PLUS_CROP')}
                              for s in ('REAL_ALL', 'SYNTH_ALL')}
            cm['riskCoverage'] = {'ALL_MODES': risk_coverage(ans(qs, MODES)), 'D_MARKED_ROI_PLUS_CROP': risk_coverage(ans(qs, ['D_MARKED_ROI_PLUS_CROP'])),
                                  'REAL_ALL|D_MARKED_ROI_PLUS_CROP': risk_coverage(ans(subset(qs, 'REAL_ALL'), ['D_MARKED_ROI_PLUS_CROP']))}
            agree = {}
            for name, mds in (('C+D+E agree', MODES[2:]), ('all five agree', MODES)):
                kept = [q for q in qs if all(res[(m, q, md)]['o'] in ('RIGHT', 'WRONG') for md in mds) and len({res[(m, q, md)]['key'] for md in mds}) == 1]
                k = sum(res[(m, q, 'D_MARKED_ROI_PLUS_CROP')]['o'] == 'WRONG' for q in kept)
                agree[name] = {'questionsKept': len(kept), 'of': len(qs), 'wrongAmongKept': rate(k, len(kept))}
            cm['agreementFilter'] = agree
            enum_mass = [raw[(m, q, md)].get('enumMass') for q in qs for md in MODES if raw.get((m, q, md), {}).get('enumMass') is not None]
            cm['unconstrainedEnumMass'] = {'median': sorted(enum_mass)[len(enum_mass) // 2] if enum_mass else None,
                                           'shareBelow0.5': round(sum(x < 0.5 for x in enum_mass) / len(enum_mass), 4) if enum_mass else None}
            ct[m] = cm
        cal['tables'][tname] = ct

    # the old SmolVLM2-500M (005J) on the exact intersection, where the 005J item exists
    if a.old_smol and a.old_items:
        old_items = {}
        for l in open(a.old_items):
            it = json.loads(l)
            old_items[(it['qid'], it['mode'])] = it
        old = {}
        for l in open(a.old_smol):
            r = json.loads(l)
            if r.get('mode') == 'CANDIDATE_OVERLAY' and r.get('score'):
                old[r['qid']] = r
        inter = [q for q in phase2 if q.startswith('005j:') and q[5:] in old]
        rows_old = []
        for q in inter:
            r = old[q[5:]]
            pred, p = r['score']['answer'], r['score']['confidence']
            exp = old_items[(q[5:], 'CANDIDATE_OVERLAY')]['expected']
            rows_old.append({'qid': q, 'pred': pred, 'expected': exp, 'right': pred == exp, 'p': p})
        out['oldSmolVLM2_500M'] = {'note': '005J SmolVLM2-500M, ENUM_SCORE, CANDIDATE_OVERLAY (crop + red/blue candidates, one 512px tile, 64 image tokens); a different input contract - shown beside, not pooled. '
                                           'Like for like is P80 (005J has no stated confidence); its probability is the full answer-word sequence, 005M\'s the first answer token',
                                   'intersectionQuestions': len(inter), 'qids': inter,
                                   'right': sum(r['right'] for r in rows_old), 'unresolved': sum(r['pred'] == 'UNRESOLVED' for r in rows_old),
                                   'confidentWrongP80': sum((not r['right']) and r['pred'] != 'UNRESOLVED' and r['p'] >= 0.80 for r in rows_old),
                                   'newModelsOnIntersection': {f'{m}|{mode}': summarize([res[(m, q, mode)] for q in inter]) for m in (p2_models or p1_models) for mode in MODES if all((m, q, mode) in res for q in inter)}}
    os.makedirs(a.out_dir, exist_ok=True)
    json.dump(out, open(os.path.join(a.out_dir, 'matched-bakeoff.json'), 'w'), indent=1)
    json.dump(gain, open(os.path.join(a.out_dir, 'context-gain.json'), 'w'), indent=1)
    json.dump(cal, open(os.path.join(a.out_dir, 'calibration.json'), 'w'), indent=1)
    print(json.dumps({'amended': out['phase1Ranking'], 'preRegistered': out['phase1RankingPreRegistered']}, indent=1))


if __name__ == '__main__':
    main()
