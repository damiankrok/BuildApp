#!/usr/bin/env python3
"""select_items.py - the bake-off's fixed item selection (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

Chosen before any model output was scored, from the corpus alone, to fit a 4-core CPU budget:
  SYNTHETIC  CANDIDATE_OVERLAY on every transform; RAW and SEMANTIC_OVERLAY on NORMAL and MIRROR.
  REAL_DEV   CANDIDATE_OVERLAY on NORMAL and MIRROR; RAW and SEMANTIC_OVERLAY on NORMAL.
  REAL_BLIND8 every mode on every transform (the two houses the stage is about).
Florence-2 (no VQA task) and the GEN_JSON read-out of Moondream run on the CORE subset only: CANDIDATE_OVERLAY on
NORMAL and MIRROR, every set.
"""
import json
import sys

synth, real, out = sys.argv[1], sys.argv[2], sys.argv[3]
sel, core = [], []
for path in (synth, real):
    for q in json.load(open(path))['questions']:
        s, t = q.get('set', 'SYNTHETIC'), q['transform']
        modes = []
        if s == 'SYNTHETIC':
            modes = ['CANDIDATE_OVERLAY'] + (['RAW', 'SEMANTIC_OVERLAY'] if t in ('NORMAL', 'MIRROR') else [])
        elif s == 'REAL_DEV':
            modes = (['CANDIDATE_OVERLAY'] if t in ('NORMAL', 'MIRROR') else []) + (['RAW', 'SEMANTIC_OVERLAY'] if t == 'NORMAL' else [])
        else:
            modes = ['CANDIDATE_OVERLAY', 'RAW', 'SEMANTIC_OVERLAY']
        for m in modes:
            sel.append(f"{q['qid']} {m}")
        if t in ('NORMAL', 'MIRROR'):
            core.append(f"{q['qid']} CANDIDATE_OVERLAY")
open(out + '.all.txt', 'w').write('\n'.join(sel) + '\n')
open(out + '.core.txt', 'w').write('\n'.join(core) + '\n')
print(len(sel), len(core))
