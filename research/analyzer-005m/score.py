#!/usr/bin/env python3
"""score.py - the pre-registered scorer of BUILDPLAN-ANALYZER-005M (RESEARCH ONLY).

    python -I -B research/analyzer-005m/score.py --items <W>/items/items.jsonl --runs <a.jsonl,b.jsonl,...> \
        --out-dir stage-reports/artifacts/analyzer-005m-vr2 [--old-smol <W005J>/bench/smolvlm2.jsonl --old-items <W005J>/bench/items-all.jsonl]

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
from collections import Counter, defaultdict

MODES = ['A_CROP_ONLY', 'B_FULL_PLAN', 'C_FULL_PLAN_MARKED_ROI', 'D_MARKED_ROI_PLUS_CROP', 'E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY']
REAL_SETS = ['REAL_DEV', 'ROUND8_DEV', 'MURAJACH_DEV', 'STOREY_DEV', 'GAPSET_DEV']
SYN_SETS = ['SYNTH_CF', 'SYNTH_GLOBAL']


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
            'confidentWrongAmongAnswered': rate(sum(r['cw'] for r in rows), answered)}


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
    a = ap.parse_args()
    items = [json.loads(l) for l in open(a.items)]
    it_by = {(it['qid'], it['mode']): it for it in items}
    q_meta = {it['qid']: it for it in items}
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
    phase1 = sorted({it['qid'] for it in items if it['phase1']})
    phase2 = sorted({it['qid'] for it in items})
    covered = {m: {q for (mm, q, mode) in res if mm == m} for m in models}

    def complete(m, qs):
        return all((m, q, mode) in res for q in qs for mode in MODES)

    out = {'researchOnly': 'BUILDPLAN-ANALYZER-005M', 'rules': __doc__.split('Fixed before any result was read (brief sections 8-10):')[1].strip(),
           'models': models, 'phase1Questions': len(phase1), 'phase2Questions': len(phase2), 'tables': {}}

    def table(name, qs, ms):
        t = {'questions': len(qs), 'models': ms, 'byModelMode': {}, 'bySet': {}, 'byClass': {}, 'consistency': {}, 'latency': {}, 'tokens': {}}
        mirror = [(q, q.replace('-NORMAL', '-MIRROR')) for q in qs if '-NORMAL' in q and q.replace('-NORMAL', '-MIRROR') in qs]
        rot = [(q, q.replace('-NORMAL', '-ROT90')) for q in qs if '-NORMAL' in q and q.replace('-NORMAL', '-ROT90') in qs]
        cf = [(q, q_meta[q]['pairItemQid']) for q in qs if q_meta[q].get('pairItemQid') in qs and q_meta[q].get('variant') == 'A']
        for m in ms:
            for mode in MODES:
                rows = [res[(m, q, mode)] for q in qs]
                key = f'{m}|{mode}'
                t['byModelMode'][key] = summarize(rows)
                t['bySet'][key] = {s: summarize([res[(m, q, mode)] for q in qs if q_meta[q]['set'] == s]) for s in REAL_SETS + SYN_SETS if any(q_meta[q]['set'] == s for q in qs)}
                t['bySet'][key]['REAL_ALL'] = summarize([res[(m, q, mode)] for q in qs if q_meta[q]['set'] in REAL_SETS])
                t['bySet'][key]['SYNTH_ALL'] = summarize([res[(m, q, mode)] for q in qs if q_meta[q]['set'] in SYN_SETS])
                t['byClass'][key] = {c: summarize([res[(m, q, mode)] for q in qs if q_meta[q]['cls'] == c]) for c in sorted({q_meta[q]['cls'] for q in qs})}
                cfp = {'pairs': 0, 'bothRight': 0, 'sameAnswer': 0}
                for qa, qb in cf:
                    ra, rb = res[(m, qa, mode)], res[(m, qb, mode)]
                    if ra['o'] in ('RIGHT', 'WRONG') and rb['o'] in ('RIGHT', 'WRONG'):
                        cfp['pairs'] += 1
                        cfp['bothRight'] += ra['o'] == 'RIGHT' and rb['o'] == 'RIGHT'
                        cfp['sameAnswer'] += ra['key'] == rb['key']
                t['consistency'][key] = {'mirror': consistency(None, res, m, mode, mirror), 'rotation90': consistency(None, res, m, mode, rot),
                                         'counterfactualPairsAnswered': cfp['pairs'], 'counterfactualBothRight': rate(cfp['bothRight'], cfp['pairs']),
                                         'counterfactualSameAnswer': rate(cfp['sameAnswer'], cfp['pairs'])}
                walls = sorted(raw[(m, q, mode)]['wallMs'] for q in qs if 'wallMs' in raw[(m, q, mode)])
                toks = sorted(raw[(m, q, mode)].get('imageTokens') or 0 for q in qs)
                anon = [((raw[(m, q, mode)].get('rss') or {}).get('RssAnon') or 0) for q in qs]
                t['latency'][key] = {'medianWallMs': walls[len(walls) // 2] if walls else None, 'p90WallMs': walls[int(len(walls) * 0.9)] if walls else None,
                                     'maxRssAnonBytes': max(anon) if anon else None}
                t['tokens'][key] = {'medianImageTokens': toks[len(toks) // 2] if toks else None, 'maxImageTokens': max(toks) if toks else None}
            t['byModelMode'][f'{m}|ALL_MODES'] = summarize([res[(m, q, mode)] for q in qs for mode in MODES])
        # baselines: a constant letter and the majority semantic answer, per set
        t['baselines'] = {}
        for s in REAL_SETS + SYN_SETS + ['ALL']:
            sq = [q for q in qs if s == 'ALL' or q_meta[q]['set'] == s]
            if not sq:
                continue
            exp = Counter(q_meta[q]['expected'] for q in sq)
            t['baselines'][s] = {'n': len(sq), 'majorityAnswer': exp.most_common(1)[0][0], 'majorityAccuracy': round(exp.most_common(1)[0][1] / len(sq), 4),
                                 'constantLetterA': round(sum(it_by[(q, 'A_CROP_ONLY')]['expectedLetter'] == 'A' for q in sq) / len(sq), 4)}
        return t

    p1_models = [m for m in models if complete(m, phase1)]
    out['tables']['PHASE1'] = table('PHASE1', phase1, p1_models)
    rank = sorted(p1_models, key=lambda m: (out['tables']['PHASE1']['byModelMode'][f'{m}|ALL_MODES']['CONFIDENT_WRONG_RATE']['rate'],
                                            -out['tables']['PHASE1']['byModelMode'][f'{m}|ALL_MODES']['exactAccuracy']['rate']))
    out['phase1Ranking'] = [{'model': m, 'cwr': out['tables']['PHASE1']['byModelMode'][f'{m}|ALL_MODES']['CONFIDENT_WRONG_RATE']['rate'],
                             'exactAccuracy': out['tables']['PHASE1']['byModelMode'][f'{m}|ALL_MODES']['exactAccuracy']['rate']} for m in rank]
    p2_models = [m for m in models if complete(m, phase2)]
    if p2_models:
        out['tables']['PHASE2'] = table('PHASE2', phase2, p2_models)
    out['coverage'] = {m: {'questionsWithAnyRecord': len(covered[m]), 'phase1Complete': m in p1_models, 'phase2Complete': m in p2_models} for m in models}

    # context gain: A against C, D, E, per model, on the largest matched set each model completed
    gain = {'rules': 'per question, the outcome in A_CROP_ONLY against the same question in C, D and E', 'byModel': {}}
    for m in models:
        qs = phase2 if m in p2_models else (phase1 if m in p1_models else [])
        g = {'set': 'PHASE2' if m in p2_models else 'PHASE1', 'questions': len(qs)}
        for mode in MODES[1:]:
            tr = Counter()
            per = []
            for q in qs:
                oa, ox = res[(m, q, 'A_CROP_ONLY')]['o'], res[(m, q, mode)]['o']
                if oa == ox and res[(m, q, 'A_CROP_ONLY')]['key'] == res[(m, q, mode)]['key']:
                    kind = 'SAME'
                elif oa == 'WRONG' and ox == 'RIGHT':
                    kind = 'WRONG->RIGHT'
                elif oa == 'RIGHT' and ox == 'WRONG':
                    kind = 'RIGHT->WRONG'
                elif oa == 'WRONG' and ox == 'UNRESOLVED':
                    kind = 'WRONG->UNRESOLVED'
                elif oa == 'UNRESOLVED' and ox == 'RIGHT':
                    kind = 'UNRESOLVED->RIGHT'
                else:
                    kind = 'OTHER'
                tr[kind] += 1
                if kind != 'SAME':
                    per.append({'qid': q, 'set': q_meta[q]['set'], 'cls': q_meta[q]['cls'], 'from': oa, 'to': ox, 'kind': kind,
                                'contextDependent': q_meta[q].get('contextDependent', False)})
            ctx = [q for q in qs if q_meta[q].get('contextDependent')]
            g[f'A->{mode}'] = {'transitions': dict(tr), 'netRightGain': (tr['WRONG->RIGHT'] + tr['UNRESOLVED->RIGHT']) - tr['RIGHT->WRONG'] - sum(1 for p in per if p['from'] == 'RIGHT' and p['to'] in ('UNRESOLVED', 'FAILURE')),
                               'changes': per,
                               'contextDependentOnly': {'n': len(ctx), 'rightInA': sum(res[(m, q, 'A_CROP_ONLY')]['o'] == 'RIGHT' for q in ctx),
                                                        'rightInMode': sum(res[(m, q, mode)]['o'] == 'RIGHT' for q in ctx),
                                                        'unresolvedInA': sum(res[(m, q, 'A_CROP_ONLY')]['o'] == 'UNRESOLVED' for q in ctx)}}
        gain['byModel'][m] = g

    # calibration: stated confidence and option probability against correctness, per model and mode
    cal = {'rules': 'answered items only; stated confidence levels and option-probability bins; AUROC of the option probability for being right; ECE over 10 bins', 'byModel': {}}
    for m in models:
        qs = phase2 if m in p2_models else (phase1 if m in p1_models else [])
        cm = {}
        for mode in MODES + ['ALL_MODES']:
            rows = [res[(m, q, md)] for q in qs for md in (MODES if mode == 'ALL_MODES' else [mode]) if res[(m, q, md)]['o'] in ('RIGHT', 'WRONG')]
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
            cm[mode] = {'answered': len(rows), 'statedConfidence': by_conf, 'highShare': rate(sum(r['conf'] == 'HIGH' for r in rows), len(rows)),
                        'probBins': {f'{b / 10:.1f}-{(b + 1) / 10:.1f}': {'n': v[0], 'accuracy': round(v[1] / v[0], 4), 'meanP': round(v[2] / v[0], 4)} for b, v in sorted(bins.items())},
                        'ECE': round(ece, 4) if ece is not None else None, 'AUROC': auroc([(r['p'], r['o'] == 'RIGHT') for r in rows if r['p'] is not None])}
        enum_mass = [raw[(m, q, md)].get('enumMass') for q in qs for md in MODES if raw.get((m, q, md), {}).get('enumMass') is not None]
        cm['unconstrainedEnumMass'] = {'median': sorted(enum_mass)[len(enum_mass) // 2] if enum_mass else None, 'shareBelow0.5': round(sum(x < 0.5 for x in enum_mass) / len(enum_mass), 4) if enum_mass else None}
        cal['byModel'][m] = cm

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
        out['oldSmolVLM2_500M'] = {'note': '005J SmolVLM2-500M, ENUM_SCORE, CANDIDATE_OVERLAY (crop + red/blue candidates, one 512px tile, 64 image tokens); a different input contract - shown beside, not pooled',
                                   'intersectionQuestions': len(inter), 'qids': inter,
                                   'right': sum(r['right'] for r in rows_old), 'unresolved': sum(r['pred'] == 'UNRESOLVED' for r in rows_old),
                                   'confidentWrongP80': sum((not r['right']) and r['pred'] != 'UNRESOLVED' and r['p'] >= 0.80 for r in rows_old),
                                   'newModelsOnIntersection': {f'{m}|{mode}': summarize([res[(m, q, mode)] for q in inter]) for m in (p2_models or p1_models) for mode in MODES if all((m, q, mode) in res for q in inter)}}
    os.makedirs(a.out_dir, exist_ok=True)
    json.dump(out, open(os.path.join(a.out_dir, 'matched-bakeoff.json'), 'w'), indent=1)
    json.dump(gain, open(os.path.join(a.out_dir, 'context-gain.json'), 'w'), indent=1)
    json.dump(cal, open(os.path.join(a.out_dir, 'calibration.json'), 'w'), indent=1)
    print(json.dumps(out['phase1Ranking'], indent=1))


if __name__ == '__main__':
    main()
