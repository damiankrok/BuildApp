# v3.51 C2: offline migration of metric evidence written by reader 1.12.0 to the typed alternative fields of 1.13.0.
# The 1.12.0 reader said what a callout alternative is a reading OF only in the wording of `why` ("width candidate: ...",
# "height candidate: ...", and the PLAN_CORROBORATED_WIDTH mark); 1.13.0 writes `role` and `gate`. This copies exactly
# that information into the typed fields and changes nothing else, so a solver that reads only typed fields can replay a
# frozen 1.12.0 extraction. It is a research tool for replays; the runtime never reads prose for this.
# usage: migrate_evidence_role.py <in metric-evidence.json> <out metric-evidence.json>
import json, sys
m = json.load(open(sys.argv[1])); n = 0
for e in m['evidence']:
    for a in e.get('alternatives', []):
        w = a.get('why', '')
        if w.startswith('width candidate'):
            a['role'] = 'WIDTH'; n += 1
            if 'PLAN_CORROBORATED_WIDTH' in w:
                a['gate'] = 'PLAN_CORROBORATION_REQUIRED'
        elif w.startswith('height candidate'):
            a['role'] = 'HEIGHT'; n += 1
json.dump(m, open(sys.argv[2], 'w'))
print(n)
