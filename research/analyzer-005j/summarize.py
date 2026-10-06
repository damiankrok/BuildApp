#!/usr/bin/env python3
"""summarize.py - markdown tables from vlm-bakeoff.json (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B summarize.py --bakeoff <vlm-bakeoff.json> --out <vlm-bakeoff.md>
"""
import argparse
import json

ORDER = ['server-oracle', 'wall-unet-structured', 'wall-segformer-structured', 'micro-referee-pilot', 'smolvlm2-500m-onnx-int8dec', 'moondream-0.5b-int8', 'florence2-base']


def primary_ro(m):
    """The read-out each model is compared on: the oracle's JSON, the wall models' structured rule, everyone else's enum score."""
    return 'ORACLE_JSON' if m == 'server-oracle' else 'STRUCTURED' if m.startswith('wall-') else 'ENUM_SCORE'


def lab(s):
    """Post-review F14: the data key REAL_BLIND8 is shown as ROUND8_DEV - its questions were authored from the accepted
    005I diagnosis of the two round-8 houses, so it is development evidence, not blind generalisation."""
    return 'ROUND8_DEV' if s == 'REAL_BLIND8' else s


def pct(x):
    return '—' if x is None else f'{100 * x:.1f} %'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bakeoff', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    d = json.load(open(a.bakeoff))
    M = d['models']
    L = ['# VLM / referee bake-off — results (BUILDPLAN-ANALYZER-005J)', '',
         f"Pre-registered: confident = confidence ≥ {d['preregistered']['confident']}; UNRESOLVED / invalid = unresolved (never wrong). "
         'Red metric: CONFIDENT_WRONG_RATE = confident wrong / total. USEFUL_COVERAGE = confident correct / total. Modes never pooled.', '']
    if d.get('excluded'):
        L += ['**Excluded for every arm:** ' + '; '.join(f"`{k}` — {v}" for k, v in d['excluded']['excluded'].items()), '']
    L += ['**Wall-model rows (`wall-*-structured`) on REAL_DEV are the first, face-placed run** (strips on the 005I truth outline, '
          'half outside the building). The post-review re-measurement on the wall axis is in `wall-model-proof.json` → `*.axisRemeasure` '
          '(UNet: 61/63 openings OPENING, 47 at ≥ 0.8, none wrong). Pixel shares are not calibrated probabilities; the 0.80 bar is applied '
          'to them as fixed before the run.', '']
    L += ['**ROUND8_DEV** is the data key `REAL_BLIND8`: questions authored from the accepted 005I diagnosis of the two round-8 '
          'houses. They are development evidence, not blind generalisation (post-review F14).', '']
    L += ['**Each arm ran on a different, non-random subset of one pool** (the runs were cut at a declared time); pooled rows '
          'therefore mix different questions. §8 scores every pair of arms on the questions both were asked (post-review B1).', '',
          '**Configurations, as run (post-review B2, B8).** SmolVLM2-500M: `do_image_splitting=False`, one 512² tile = **64 image '
          'tokens** (the snapshot default is 16 tiles + a global view = 1,088 tokens), fp32 vision encoder, int8 decoder, forced '
          'JSON prefix — its deployable on-device configuration. Moondream 0.5B: at 512² the 0.0.6 client picks one 378² global '
          'view and no crops. Florence-2-base: no VQA task, so ENUM_SCORE measures its decoder\'s text prior.', '']
    L += ['## 1. Headline: CANDIDATE_OVERLAY, all sets', '', '| model | read-out | n | answered | accuracy among answered | CONFIDENT_WRONG_RATE | USEFUL_COVERAGE | mirror consistency (pairs with an answer) | rotation consistency (pairs with an answer) | counterfactual: same answer to both | ECE |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for m in ORDER + sorted(set(M) - set(ORDER)):
        if m not in M:
            continue
        for ro, modes in M[m].items():
            b = modes.get('CANDIDATE_OVERLAY')
            if not b:
                continue
            t = b['all']
            cal = b.get('calibration') or {}
            L.append(f"| {m} | {ro} | {t['total']} | {pct(t['coverage'])} | {pct(t['accuracyAnswered'])} | **{pct(t['confidentWrongRate'])}** | {pct(t['usefulCoverage'])} | {pct(b['mirror']['rateWithAnAnswer'])} | {pct(b['rotation']['rateWithAnAnswer'])} | {pct(b['counterfactual']['insensitiveRate'])} | {cal.get('ece', '—')} |")
    L += ['', '## 2. By set and mode (ENUM_SCORE / ORACLE_JSON / STRUCTURED)', '', '| model | read-out | mode | set | n | accuracy among answered | coverage | CONFIDENT_WRONG_RATE | USEFUL_COVERAGE |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for m in ORDER + sorted(set(M) - set(ORDER)):
        if m not in M:
            continue
        for ro, modes in M[m].items():
            if ro in ('GEN_STRICT',):
                continue
            for mode, b in modes.items():
                for s in ('SYNTHETIC', 'REAL_DEV', 'REAL_BLIND8'):
                    if s in b:
                        t = b[s]['all']
                        L.append(f"| {m} | {ro} | {mode} | {lab(s)} | {t['total']} | {pct(t['accuracyAnswered'])} | {pct(t['coverage'])} | {pct(t['confidentWrongRate'])} | {pct(t['usefulCoverage'])} |")
    L += ['', '## 3. Per class, CANDIDATE_OVERLAY, all sets pooled per model (ENUM_SCORE; oracle: ORACLE_JSON)', '']
    classes = set()
    for m in M:
        for ro, modes in M[m].items():
            b = modes.get('CANDIDATE_OVERLAY')
            if b:
                for s in ('SYNTHETIC', 'REAL_DEV', 'REAL_BLIND8'):
                    classes |= set(b.get(s, {}).get('byClass', {}).keys())
    hdr = [m for m in ORDER if m in M]
    L.append('| class | ' + ' | '.join(f'{m} acc / confWrong' for m in hdr) + ' |')
    L.append('| --- | ' + ' | '.join('---' for _ in hdr) + ' |')
    for c in sorted(classes):
        cells = []
        for m in hdr:
            ro = primary_ro(m)
            b = M[m].get(ro, {}).get('CANDIDATE_OVERLAY')
            if not b:
                cells.append('—')
                continue
            n = cor = ans = cw = 0
            for s in ('SYNTHETIC', 'REAL_DEV', 'REAL_BLIND8'):
                t = b.get(s, {}).get('byClass', {}).get(c)
                if t:
                    n += t['total']
                    cor += t['correct']
                    ans += t['correct'] + t['wrong']
                    cw += t['wrongConfident']
            cells.append('—' if n == 0 else f"{cor}/{ans} of {n}; cw {cw}")
        L.append(f'| {c} | ' + ' | '.join(cells) + ' |')
    L += ['', '## 4. ROUND8_DEV questions (the two round-8 houses; development evidence), CANDIDATE_OVERLAY, NORMAL', '']
    rows = {}
    for m in ORDER:
        if m not in M:
            continue
        ro = primary_ro(m)
        b = M[m].get(ro, {}).get('CANDIDATE_OVERLAY')
        if not b:
            continue
        for x in b['blind8Answers']:
            if x['transform'] != 'NORMAL':
                continue
            rows.setdefault(x['qid'], {'cls': x['cls'], 'expected': x['expected']})[m] = f"{x['answer']} ({x['conf']:.2f})" if x['conf'] is not None else str(x['answer'])
    hdr2 = [m for m in ORDER if m in M]
    L.append('| question | class | expected | ' + ' | '.join(hdr2) + ' |')
    L.append('| --- | --- | --- | ' + ' | '.join('---' for _ in hdr2) + ' |')
    for q, r in sorted(rows.items()):
        L.append(f"| `{q.replace('real-', '').replace('-NORMAL', '')}` | {r['cls']} | {r['expected']} | " + ' | '.join(r.get(m, '—') for m in hdr2) + ' |')
    L += ['', '## 5. Risk–coverage (ENUM_SCORE, CANDIDATE_OVERLAY, REAL sets): confident-wrong rate as the threshold rises', '']
    L.append('| model | ' + ' | '.join(f'≥{t}' for t in d['preregistered']['sweep']) + ' |')
    L.append('| --- | ' + ' | '.join('---' for _ in d['preregistered']['sweep']) + ' |')
    for m in hdr:
        ro = primary_ro(m)
        b = M[m].get(ro, {}).get('CANDIDATE_OVERLAY')
        if not b or 'REAL_DEV' not in b:
            continue
        sw = b['REAL_DEV']['sweepConfidentWrong']
        L.append(f'| {m} (REAL_DEV) | ' + ' | '.join(pct(sw[str(t)]) for t in d['preregistered']['sweep']) + ' |')
    L += ['', '## 6. Majority baseline and minority answers (CANDIDATE_OVERLAY, primary read-out)', '',
          'The real sets are one-sided in several classes (all 126 REAL_DEV OPENING_VS_PATTERN questions expect OPENING; 126 of 130 '
          'WALL_CONTINUATION expect CONTINUES). A constant guesser scores the majority share and gets every minority question wrong, '
          'so the minority columns are where a model shows it reads the drawing.', '',
          '| model | set | majority-share floor (pooled) | minority n (imbalanced classes only) | minority right / answered | minority confident wrong |', '| --- | --- | --- | --- | --- | --- |']
    for m in hdr:
        b = M[m].get(primary_ro(m), {}).get('CANDIDATE_OVERLAY')
        if not b:
            continue
        for s_ in ('SYNTHETIC', 'REAL_DEV', 'REAL_BLIND8'):
            if s_ not in b or 'minority' not in b[s_]:
                continue
            mb = b[s_]['majorityBaseline']
            n_all = sum(v['n'] for v in mb.values())
            floor = sum(v['accuracy'] * v['n'] for v in mb.values()) / n_all if n_all else None
            t = b[s_]['minority']['all']
            L.append(f"| {m} | {lab(s_)} | {pct(floor)} | {t['total']} | {t['correct']}/{t['correct'] + t['wrong']} | {t['wrongConfident']} |")
    L += ['', '## 7. Latency (desktop x86-64 CPU, image path, contended 4-core container)', '', '| model / read-out | n | median ms | p95 ms |', '| --- | --- | --- | --- |']
    for k, v in sorted(d.get('latencyMs', {}).items()):
        L.append(f"| {k} | {v['n']} | {v['median']} | {v['p95']} |")
    mt = d.get('matched')
    if mt:
        def ta(t):
            return f"{t['correct']}/{t['correct'] + t['wrong']} answered right, cw {t['wrongConfident']}"
        L += ['', '## 8. Matched subsets (post-review B1, B7)', '',
              'The arms were stopped at a declared cut-off and cover different, non-random subsets of one pool, so §1 compares '
              'different question mixes (SmolVLM2: 63 % synthetic; Florence-2: 67 % blind-8; oracle: 69 % stratified synthetic). '
              'Here each pair of arms is scored on the questions both were asked (primary read-out, CANDIDATE_OVERLAY; cw = '
              'confident wrong at ≥ 0.80). The small VLMs\' mirror / rotation figures in §1 are almost entirely synthetic plus '
              '16 blind-8 base questions.', '',
              '| arms | n (by set) | first arm | second arm |', '| --- | --- | --- | --- |']
        for p_ in mt['pairs']:
            a1, a2 = p_['arms']
            L.append(f"| {a1} ∩ {a2} | {p_['n']} ({', '.join(f'{lab(k)} {v}' for k, v in p_['bySet'].items())}) | {ta(p_[a1])} | {ta(p_[a2])} |")
        L += ['', 'Modes on the questions a model has in all three modes (ENUM_SCORE):', '',
              '| model | n (by set) | RAW | CANDIDATE_OVERLAY | SEMANTIC_OVERLAY |', '| --- | --- | --- | --- | --- |']
        for m, v in mt['modesMatched'].items():
            L.append(f"| {m} | {v['n']} ({', '.join(f'{lab(k)} {x}' for k, x in v['bySet'].items())}) | " + ' | '.join(ta(v[mo]) for mo in ('RAW', 'CANDIDATE_OVERLAY', 'SEMANTIC_OVERLAY')) + ' |')
        L += ['', 'The majority floor on the **answered** subset (a constant per-class guesser over the questions the model chose '
              'to answer, classes pooled across sets), and counterfactual pairs whose truth differs and which **both** members answered:', '',
              '| model | answered | floor on answered | right among answered | cf. pairs both answered | both right | same answer to both |',
              '| --- | --- | --- | --- | --- | --- | --- |']
        for m in hdr:
            f_ = mt['answeredFloor'].get(m)
            c_ = mt['counterfactualAnswered'].get(m)
            if not f_:
                continue
            cf = (f"{c_['pairsBothAnswered']} | {pct(c_['bothRight'] / c_['pairsBothAnswered'])} | {pct(c_['sameAnswer'] / c_['pairsBothAnswered'])}" if c_ else '— | — | —')
            L.append(f"| {m} | {f_['answered']} | {pct(f_['floor'])} | {pct(f_['accuracyAnswered'])} | {cf} |")
    open(a.out, 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L[:40]))


if __name__ == '__main__':
    main()
