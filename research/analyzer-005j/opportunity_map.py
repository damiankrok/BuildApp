#!/usr/bin/env python3
"""opportunity_map.py - consolidates the two decision-seam audits into the Visual Referee opportunity map
(RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B opportunity_map.py --reconstruction <seams-reconstruction.json> --upstream <seams-upstream.json> --out <dir>

The audits were made by reading the production code at 64b78b4 (file:line in every record; the decisive lines of the
two blind-8 failures were re-read by hand). This script only merges, normalises the brief's field names (section 7),
adds the bake-off class that measures each seam, and renders the markdown table.
"""
import argparse
import json
import os

FIELDS = ['id', 'package_file_function', 'stage', 'decision_type', 'candidate_count', 'candidate_representation', 'current_selection_rule', 'source_evidence_available',
          'confidence_or_score', 'does_it_refuse', 'does_wrong_choice_change_model', 'crop_or_region_available', 'could_question_be_local', 'possible_AI_question', 'answer_type',
          'risk_if_wrong', 'known_development_examples', 'known_blind_examples', 'frequency_estimate']

BENCH = {  # the bake-off class that measures a seam's question (None: not measured in 005J)
    'BODY_REGION': 'BODY_REGION', 'WALL_CONTINUATION': 'WALL_CONTINUATION', 'GARAGE_BODY': 'GARAGE_BODY', 'TERRACE_VS_BODY': 'TERRACE_VS_BODY',
    'CANOPY_PERGOLA_VS_WALL': 'CANOPY_PERGOLA_VS_WALL', 'OUTER_BOUNDARY_A_OR_B': 'OUTER_BOUNDARY_A_OR_B', 'OPENING_VS_PATTERN': 'OPENING_VS_PATTERN',
    'BAY_OR_RISALIT': 'BAY_OR_RISALIT', 'STOREY_COVERAGE': 'STOREY_COVERAGE', 'VOID_VS_OUTSIDE': 'VOID_VS_OUTSIDE',
    'DIMENSION_LINE_VS_BUILDING_LINE': 'DIMENSION_LINE_VS_BUILDING_LINE', 'COLUMN_VS_WALL': 'COLUMN_VS_WALL',
}


def norm_class(c):
    c = (c or '').replace('NEW: ', '').strip()
    return c.split(' (')[0].strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reconstruction', required=True)
    ap.add_argument('--upstream', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    rec = json.load(open(a.reconstruction))
    up = json.load(open(a.upstream))
    seams = []
    for src, data in (('reconstruction', rec), ('upstream', up)):
        for s in data['seams']:
            row = {k: s.get(k) for k in FIELDS}
            vrc = norm_class(s.get('visual_referee_class'))
            row['visual_referee_class'] = vrc
            row['priority'] = s.get('priority')
            row['audit'] = src
            row['bakeoff_class'] = BENCH.get(vrc)
            # gozdzikowcach's first bad decision is a gap-STRUCTURE question; 005J measures it as its own class
            if s['id'] in ('REC-01', 'UP-06'):
                row['bakeoff_class'] = 'OPEN_SIDE_VS_OPENINGS + WALL_CONTINUATION'
            seams.append(row)
    p0 = [s for s in seams if (s['priority'] or '').startswith('P0')]
    out = {
        'stage': 'BUILDPLAN-ANALYZER-005J',
        'code': 'damiankrok/BuildApp @ 64b78b4bce50d7ae060119dbe3ebc7c00dc0be56 (production unchanged in 005J)',
        'method': 'two independent read-only audits of the production analyzer (reconstruction; source-cv / source-metrics / source-analyzer / source-vision / analysis-service / evidence-pack), every claim with file:line; decisive lines of both blind-8 failures re-read by hand',
        'counts': {'seams': len(seams), 'P0': len(p0), 'P1': sum(1 for s in seams if (s['priority'] or '').startswith('P1')), 'P2': sum(1 for s in seams if (s['priority'] or '').startswith('P2'))},
        'seams': seams,
        'blind_traces': rec.get('blind_traces', []),
        'injection_points': rec.get('injection_points', []),
        'injection_contract': up.get('injection_contract'),
        'vision_reasoner': up.get('vision_reasoner'),
        'evidence_pack_crop_support': up.get('evidence_pack_crop_support'),
        'refusal_codes': up.get('refusal_codes'),
    }
    os.makedirs(a.out, exist_ok=True)
    json.dump(out, open(os.path.join(a.out, 'visual-referee-opportunity-map.json'), 'w'), indent=1, ensure_ascii=False)
    # markdown
    L = ['# Visual Referee opportunity map (BUILDPLAN-ANALYZER-005J)', '',
         f"Production code `64b78b4` (unchanged). {out['counts']['seams']} decision seams: {out['counts']['P0']} P0, {out['counts']['P1']} P1, {out['counts']['P2']} P2. "
         'Full records (every field of brief §7, with file:line) are in `visual-referee-opportunity-map.json`; this page is the index.', '',
         '## P0 seams', '',
         '| id | where | decision | current rule (short) | refuses? | local question | answer enum | bake-off class |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
    def short(x, n=150):
        x = str(x or '').replace('|', '/').replace('\n', ' ')
        return x if len(x) <= n else x[:n - 1] + '…'
    for s in p0:
        L.append(f"| {s['id']} | `{short(s['package_file_function'], 90)}` | {s['decision_type']} | {short(s['current_selection_rule'])} | {short(s['does_it_refuse'], 60)} | {short(s['possible_AI_question'], 140)} | {short(s['answer_type'], 60)} | {s['bakeoff_class'] or '—'} |")
    L += ['', '## All seams', '', '| id | priority | class | where | candidates | wrong choice changes model? | crop available? | dev examples | blind examples |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for s in seams:
        L.append(f"| {s['id']} | {short(s['priority'], 3)} | {s['visual_referee_class']} | `{short(s['package_file_function'], 70)}` | {short(s['candidate_count'], 50)} | {short(s['does_wrong_choice_change_model'], 70)} | {short(s['crop_or_region_available'], 60)} | {short(s['known_development_examples'], 60)} | {short(s['known_blind_examples'], 50)} |")
    L += ['', '## The two blind-8 failures, traced to the deciding lines', '']
    for t in out['blind_traces']:
        if t['house'] not in ('dom-w-gozdzikowcach', 'dom-w-cyklamenach'):
            continue
        L.append(f"### {t['house']}")
        L.append('')
        L.append(f"- reported: {t.get('first_bad_decision_reported')}")
        for c in t.get('deciding_code', []):
            L.append(f"- {c}")
        L.append(f"- referee leverage: {t.get('referee_leverage')}")
        L.append('')
    L += ['## Other development traces', '']
    for t in out['blind_traces']:
        if t['house'] in ('dom-w-gozdzikowcach', 'dom-w-cyklamenach'):
            continue
        L.append(f"- **{t['house']}**: {short(t.get('first_bad_decision_reported'), 300)} — seams {', '.join(t.get('seams', []))}")
    L += ['', '## Where an observation could enter without changing resolver semantics', '']
    for ip in out['injection_points']:
        L.append(f"- **{ip['id']}** `{short(ip['where'], 160)}` — {short(ip['what'], 300)} Resolver semantics changed: {ip.get('resolver_semantics_changed')}. Seams: {', '.join(ip.get('seams', []))}.")
    ic = out['injection_contract'] or {}
    L += ['', '## Injection contract (upstream audit)', '']
    for k in ('principle', 'recommended_seam', 'non_circularity', 'application_rule', 'validation', 'open_owner_decisions'):
        if k in ic:
            v = ic[k]
            L.append(f"- **{k}**: {short(json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v, 700)}")
    vr = out['vision_reasoner'] or {}
    L += ['', '## The existing VisionReasoner (source-vision) is not a referee', '']
    for k, v in vr.items():
        if k in ('interface', 'tasks'):
            continue
        L.append(f"- **{k}**: {short(json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v, 500)}")
    open(os.path.join(a.out, 'visual-referee-opportunity-map.md'), 'w').write('\n'.join(L) + '\n')
    print(out['counts'])


if __name__ == '__main__':
    main()
