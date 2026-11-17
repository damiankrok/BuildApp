"""v3.54.4: one line per house of a house-run root (runs.jsonl). /usr/bin/python3 -I summary.py <root>"""
import json, sys
seen = {}
for l in open(sys.argv[1] + '/runs.jsonl'):
    s = json.loads(l); seen[s['house']] = s
for h, s in seen.items():
    c = s.get('counts') or {}
    r = s.get('review') or {}
    print(f"{h[-30:]:30} {s['status']:14} fail={s.get('failedChecks')} checks={((s.get('checks') or {}).get('pass'))}/{((s.get('checks') or {}).get('fail'))} held={s.get('held')} kern={s.get('kernelRefusals')} comp={s.get('compileErrors')} {s.get('widthM')}x{s.get('depthM')} h={s.get('heightAboveTerrainM')} win={c.get('windows')} door={c.get('doors')} roofs={c.get('roofPlanes')} -> {s.get('accepted')} | {(s.get('why') or s.get('error') or '')[:210]} | review {r.get('verdicts')} {r.get('applied')}/{r.get('proposals')} | ${s.get('spentUsd')}")
