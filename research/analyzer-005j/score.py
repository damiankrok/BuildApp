#!/usr/bin/env python3
"""score.py - Visual Referee bake-off scorer (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B score.py --items <items-all.jsonl> --runs <a.jsonl,b.jsonl,...> [--oracle <dir>] --out <vlm-bakeoff.json>

Pre-registered before any model output was read (and not tuned afterwards):
  * CONFIDENT = confidence >= 0.80. ENUM_SCORE confidence is the model's normalised probability of its argmax answer.
    GEN_JSON confidence is the model's self-reported number; a valid answer WITHOUT a number counts as confident
    (worst case: it would be used as stated). STRUCTURED answers carry no score and count as confident.
  * UNRESOLVED, an invalid / missing answer and an answer outside the enum are all "unresolved" (never wrong).
  * The red metric is CONFIDENT_WRONG_RATE = confident wrong / total. USEFUL_COVERAGE = confident correct / total.
  * Modes are never pooled. Sets (SYNTHETIC, REAL_DEV, REAL_BLIND8) are reported apart and together.
  * Consistency: the same base question and mode on NORMAL vs MIRROR (mirror) and NORMAL vs ROT90/ROT180 (rotation);
    a pair is consistent when the two answers are equal (for OUTER_BOUNDARY the candidates move with the drawing, so
    the letters keep their meaning).
  * Majority baseline and minority answers: per set and class, the most frequent expected answer and the share a constant
    guesser would get; and the tally on the questions whose truth is NOT that answer (where a constant guesser is always wrong).
  * Counterfactual sensitivity (synthetic): the two members of a pair differ by one semantic fact and, where their
    expected answers differ, a model that gives the same answer to both has not seen the fact.
Expected answers come from the generator's semantics (synthetic), the 005I manual truth (REAL_DEV) or the accepted
005I diagnosis (REAL_BLIND8) - never from a published area.
"""
import argparse
import json
import math
import os
from collections import defaultdict

CONF = 0.80
SWEEP = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 0.99, 0.995, 0.999]


def readouts(rec, enum):
    """Every read-out a run record carries: name -> (answer or None, confidence or None)."""
    out = {}
    if 'score' in rec:
        out['ENUM_SCORE'] = (rec['score']['answer'], rec['score']['confidence'])
    if 'gen' in rec:
        g = rec['gen']
        c = g.get('selfConfidence')
        out['GEN_STRICT'] = (g.get('strict'), 1.0 if (g.get('strict') and c is None) else c)
        out['GEN_LENIENT'] = (g.get('lenient'), 1.0 if (g.get('lenient') and c is None) else c)
    if 'structured' in rec:
        c = rec['structured'].get('confidence')
        out['STRUCTURED'] = (rec['structured']['answer'], 1.0 if c is None else c)
    return out


def tally(rows, thr=CONF):
    n = len(rows)
    c = sum(1 for r in rows if r['answered'] and r['correct'])
    w = sum(1 for r in rows if r['answered'] and not r['correct'])
    cc = sum(1 for r in rows if r['answered'] and r['correct'] and (r['conf'] is not None and r['conf'] >= thr))
    wc = sum(1 for r in rows if r['answered'] and not r['correct'] and (r['conf'] is not None and r['conf'] >= thr))
    ans = c + w
    return {'total': n, 'correct': c, 'wrong': w, 'unresolved': n - ans, 'correctConfident': cc, 'wrongConfident': wc,
            'coverage': round(ans / n, 4) if n else None, 'accuracyAnswered': round(c / ans, 4) if ans else None,
            'confidentWrongRate': round(wc / n, 4) if n else None, 'usefulCoverage': round(cc / n, 4) if n else None,
            'confidentPrecision': round(cc / (cc + wc), 4) if (cc + wc) else None}


def calibration(rows):
    """Expected calibration error and Brier score over answered rows with a probability (10 bins)."""
    pts = [(r['conf'], 1.0 if r['correct'] else 0.0) for r in rows if r['answered'] and r['conf'] is not None]
    if not pts:
        return None
    bins = defaultdict(list)
    for p, y in pts:
        bins[min(9, int(p * 10))].append((p, y))
    ece = sum(len(b) / len(pts) * abs(sum(p for p, _ in b) / len(b) - sum(y for _, y in b) / len(b)) for b in bins.values())
    brier = sum((p - y) ** 2 for p, y in pts) / len(pts)
    return {'n': len(pts), 'ece': round(ece, 4), 'brier': round(brier, 4), 'meanConfidence': round(sum(p for p, _ in pts) / len(pts), 4), 'accuracy': round(sum(y for _, y in pts) / len(pts), 4)}


def consistency(rows, other_tfs):
    by = defaultdict(dict)
    for r in rows:
        by[(r['baseQid'], r['mode'])][r['transform']] = r['answer'] if r['answered'] else 'UNRESOLVED'
    agree = n = 0
    agree_answered = n_answered = 0
    for k, d in by.items():
        if 'NORMAL' not in d:
            continue
        for t in other_tfs:
            if t in d:
                n += 1
                agree += d['NORMAL'] == d[t]
                if d['NORMAL'] != 'UNRESOLVED' or d[t] != 'UNRESOLVED':
                    n_answered += 1
                    agree_answered += d['NORMAL'] == d[t]
    return {'pairs': n, 'consistent': agree, 'rate': round(agree / n, 4) if n else None, 'pairsWithAnAnswer': n_answered, 'rateWithAnAnswer': round(agree_answered / n_answered, 4) if n_answered else None}


def counterfactual(rows):
    by = defaultdict(dict)
    for r in rows:
        if r['set'] != 'SYNTHETIC' or not r.get('pair'):
            continue
        qi = r['baseQid'].split('-')[-1]
        by[(r['pair'], qi, r['transform'], r['mode'])][r['variant']] = r
    pairs = both = insensitive = 0
    for k, d in by.items():
        if 'A' in d and 'B' in d and d['A']['expected'] != d['B']['expected']:
            pairs += 1
            a, b = d['A'], d['B']
            if a['answered'] and b['answered'] and a['correct'] and b['correct']:
                both += 1
            aa = a['answer'] if a['answered'] else 'UNRESOLVED'
            bb = b['answer'] if b['answered'] else 'UNRESOLVED'
            if aa == bb and aa != 'UNRESOLVED':
                insensitive += 1
    return {'pairsWithDifferentTruth': pairs, 'bothCorrect': both, 'sameAnswerToBoth': insensitive, 'bothCorrectRate': round(both / pairs, 4) if pairs else None, 'insensitiveRate': round(insensitive / pairs, 4) if pairs else None}


def ab_bias(rows):
    ab = [r for r in rows if r['cls'] == 'OUTER_BOUNDARY_A_OR_B' and r['answered']]
    if not ab:
        return None
    return {'answered': len(ab), 'answeredA': sum(1 for r in ab if r['answer'] == 'A'), 'answeredB': sum(1 for r in ab if r['answer'] == 'B'), 'answeredNEITHER': sum(1 for r in ab if r['answer'] == 'NEITHER')}


def majority_baseline(rows):
    """The answer a constant guesser would pick per class (most frequent expected answer), as a floor for accuracy."""
    out = {}
    by = defaultdict(list)
    for r in rows:
        by[r['cls']].append(r['expected'])
    for c, ex in by.items():
        counts = sorted(((ex.count(e), e) for e in set(ex)), key=lambda t: (-t[0], t[1]))   # deterministic (post-review C9)
        top = counts[0][1]
        tied = len(counts) > 1 and counts[1][0] == counts[0][0]
        out[c] = {'answer': top, 'accuracy': round(ex.count(top) / len(ex), 4), 'n': len(ex), 'tied': tied}
    return out


PRIMARY = {'server-oracle': 'ORACLE_JSON'}


def primary_readout(model):
    return PRIMARY.get(model, 'STRUCTURED' if model.startswith('wall-') else 'ENUM_SCORE')


def matched(rows_by):
    """Post-review B1 / B7: the arms were cut at a declared time and cover different subsets of the pool, so pooled rows
    compare different question mixes. This scores each pair of arms on the questions BOTH were asked (primary read-out,
    CANDIDATE_OVERLAY), each small VLM's modes on the questions it has in all three modes, the majority floor on the
    answered subset, and counterfactual pairs that both members answered. It adds read-outs; it changes no number above."""
    cand = {}
    for (model, ro), rows in rows_by.items():
        if ro == primary_readout(model):
            cand[model] = {x['qid']: x for x in rows if x['mode'] == 'CANDIDATE_OVERLAY'}
    out = {'pairs': [], 'modesMatched': {}, 'answeredFloor': {}, 'counterfactualAnswered': {}}
    names = sorted(cand)
    for i, m1 in enumerate(names):
        for m2 in names[i + 1:]:
            common = sorted(set(cand[m1]) & set(cand[m2]))
            if not common:
                continue
            sets = defaultdict(int)
            for q in common:
                sets[cand[m1][q]['set']] += 1
            out['pairs'].append({'arms': [m1, m2], 'n': len(common), 'bySet': dict(sorted(sets.items())),
                                 m1: tally([cand[m1][q] for q in common]), m2: tally([cand[m2][q] for q in common])})
    for (model, ro), rows in rows_by.items():
        if ro != 'ENUM_SCORE':
            continue
        by = defaultdict(dict)
        for x in rows:
            by[x['qid']][x['mode']] = x
        full = [d for d in by.values() if len(d) == 3]
        if full:
            sets = defaultdict(int)
            for d in full:
                sets[d['RAW']['set']] += 1
            out['modesMatched'][model] = {'n': len(full), 'bySet': dict(sorted(sets.items())),
                                          **{mode: tally([d[mode] for d in full]) for mode in ('RAW', 'CANDIDATE_OVERLAY', 'SEMANTIC_OVERLAY')}}
    for model, qs in cand.items():
        ans = [x for x in qs.values() if x['answered']]
        if ans:
            mb = majority_baseline(ans)
            out['answeredFloor'][model] = {'answered': len(ans), 'floor': round(sum(v['accuracy'] * v['n'] for v in mb.values()) / len(ans), 4),
                                           'accuracyAnswered': round(sum(1 for x in ans if x['correct']) / len(ans), 4)}
        by = defaultdict(dict)
        for x in qs.values():
            if x['set'] == 'SYNTHETIC' and x.get('pair'):
                by[(x['pair'], x['baseQid'].split('-')[-1], x['transform'])][x['variant']] = x
        both = [(d['A'], d['B']) for d in by.values() if 'A' in d and 'B' in d and d['A']['expected'] != d['B']['expected'] and d['A']['answered'] and d['B']['answered']]
        if both:
            out['counterfactualAnswered'][model] = {'pairsBothAnswered': len(both), 'bothRight': sum(1 for a, b in both if a['correct'] and b['correct']),
                                                    'sameAnswer': sum(1 for a, b in both if a['answer'] == b['answer'])}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--items', required=True)
    ap.add_argument('--runs', required=True)
    ap.add_argument('--oracle', default=None)
    ap.add_argument('--exclude', default=None, help='exclusions.json: base question ids excluded for every arm, with reasons')
    ap.add_argument('--pins', default=None, help='models.json: revisions and SHA-256 of the model files that produced the runs')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    items = {(it['qid'], it['mode']): it for it in (json.loads(l) for l in open(a.items))}
    excluded = json.load(open(a.exclude))['excluded'] if a.exclude else {}
    items = {k: it for k, it in items.items() if it['baseQid'] not in excluded}
    rows_by = defaultdict(list)          # (model, readout) -> rows
    lat = defaultdict(list)
    for path in a.runs.split(','):
        for l in open(path):
            rec = json.loads(l)
            it = items.get((rec['qid'], rec['mode']))
            if not it:
                continue
            assert rec['imageSha256'] == it['imageSha256'], 'a model saw different bytes'
            for ro, (ans, conf) in readouts(rec, it['enum']).items():
                answered = ans is not None and ans != 'UNRESOLVED' and ans in it['enum']
                rows_by[(rec['model'], ro)].append({'qid': it['qid'], 'baseQid': it['baseQid'], 'mode': it['mode'], 'set': it['set'], 'cls': it['cls'], 'transform': it['transform'],
                                                    'pair': it.get('pair'), 'variant': it.get('variant'), 'expected': it['expected'], 'answer': ans, 'answered': answered,
                                                    'correct': answered and ans == it['expected'], 'conf': conf, 'house': it.get('house')})
            for k in ('gen', 'score'):
                if k in rec:
                    lat[(rec['model'], k)].append(rec[k]['ms'])
    if a.oracle:
        key = json.load(open(os.path.join(a.oracle, 'key-DO-NOT-SHOW.json')))
        for part in sorted(f for f in os.listdir(a.oracle) if f.startswith('answers-part')):
            for l in open(os.path.join(a.oracle, part)):
                if not l.strip():
                    continue
                o = json.loads(l)
                k = key[o['id']]
                it = items.get((k['qid'], k['mode']))
                if it is None:
                    continue
                ans = str(o.get('answer', '')).upper()
                c = o.get('confidence')
                answered = ans in it['enum'] and ans != 'UNRESOLVED'
                rows_by[('server-oracle', 'ORACLE_JSON')].append({'qid': it['qid'], 'baseQid': it['baseQid'], 'mode': it['mode'], 'set': it['set'], 'cls': it['cls'], 'transform': it['transform'],
                                                                  'pair': it.get('pair'), 'variant': it.get('variant'), 'expected': it['expected'], 'answer': ans, 'answered': answered,
                                                                  'correct': answered and ans == it['expected'], 'conf': c if isinstance(c, (int, float)) else 1.0, 'house': it.get('house')})
    result = {'preregistered': {'confident': CONF, 'sweep': SWEEP}, 'models': {}}
    if a.pins:
        result['pins'] = json.load(open(a.pins))
    if a.exclude:
        result['excluded'] = json.load(open(a.exclude))
    for (model, ro), rows in sorted(rows_by.items()):
        m = result['models'].setdefault(model, {})
        r = {}
        for mode in ('RAW', 'CANDIDATE_OVERLAY', 'SEMANTIC_OVERLAY'):
            mr = [x for x in rows if x['mode'] == mode]
            if not mr:
                continue
            block = {'all': tally(mr), 'calibration': calibration(mr), 'mirror': consistency(mr, ['MIRROR']), 'rotation': consistency(mr, ['ROT90', 'ROT180']),
                     'counterfactual': counterfactual(mr), 'abAnswers': ab_bias(mr), 'sweep': {str(t): tally(mr, t) for t in SWEEP}}
            for s in ('SYNTHETIC', 'REAL_DEV', 'REAL_BLIND8'):
                sr = [x for x in mr if x['set'] == s]
                if sr:
                    mb = majority_baseline(sr)
                    # a balanced class has no majority to beat, so it contributes no 'minority' questions (post-review C9)
                    minority = [x for x in sr if not mb[x['cls']]['tied'] and x['expected'] != mb[x['cls']]['answer']]
                    block[s] = {'all': tally(sr), 'byClass': {c: tally([x for x in sr if x['cls'] == c]) for c in sorted({x['cls'] for x in sr})},
                                'sweepConfidentWrong': {str(t): tally(sr, t)['confidentWrongRate'] for t in SWEEP}, 'majorityBaseline': mb,
                                # the questions whose truth is NOT the class's most frequent answer: a constant guesser gets all of them wrong,
                                # so these are where a model shows it reads the drawing (added after the first wall-model run showed the
                                # real gap classes are almost one-sided; it changes no threshold and no other number)
                                'minority': {'all': tally(minority), 'byClass': {c: tally([x for x in minority if x['cls'] == c]) for c in sorted({x['cls'] for x in minority})}}}
            block['blind8Answers'] = [{k: x[k] for k in ('qid', 'cls', 'transform', 'expected', 'answer', 'conf')} for x in mr if x['set'] == 'REAL_BLIND8']
            r[mode] = block
        m[ro] = r
    result['matched'] = matched(rows_by)
    result['latencyMs'] = {f'{m}|{k}': {'n': len(v), 'median': round(sorted(v)[len(v) // 2], 1), 'p95': round(sorted(v)[int(len(v) * 0.95)], 1)} for (m, k), v in lat.items()}
    json.dump(result, open(a.out, 'w'), indent=1)
    # a compact console view
    for model, ros in result['models'].items():
        for ro, modes in ros.items():
            for mode, b in modes.items():
                t = b['all']
                print(f"{model:28s} {ro:12s} {mode:18s} n={t['total']:5d} acc|ans={t['accuracyAnswered']} cov={t['coverage']} confWrong={t['confidentWrongRate']} useful={t['usefulCoverage']} mirror={b['mirror']['rate']} rot={b['rotation']['rate']}")


if __name__ == '__main__':
    main()
