#!/usr/bin/env python3
"""
prereg_hashes.py — print the §10 hash table of the 005R preregistration (RESEARCH ONLY).

    python3 -I research/analyzer-005r/prereg_hashes.py <synth-out-dir>

SHA-256 of every harness file that decides an outcome (code, prompts, scorers, truth procedure), of the frozen corpus
manifest, and of the synthetic corpus manifest and truth. A later change to any of them must appear as an addendum.
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()

files = []
for root, _, names in os.walk(HERE):
    if '__pycache__' in root:
        continue
    for n in sorted(names):
        if n.endswith(('.py', '.mjs', '.sh')) and n != 'prereg_hashes.py':
            files.append(os.path.relpath(os.path.join(root, n), REPO))
rows = [(f, sha(os.path.join(REPO, f))) for f in sorted(files)]
src = open(os.path.join(HERE, 'v2', 'run_owlvit.py')).read()
ns = {}
exec(compile(re.search(r'PROMPTS = \{.*?\n\}\n', src, re.S).group(0), 'prompts', 'exec'), ns)
prompts = hashlib.sha256(json.dumps(ns['PROMPTS'], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
synth = sys.argv[1]
print('| artifact | SHA-256 |')
print('| --- | --- |')
for f, h in rows:
    print(f'| `{f}` | `{h}` |')
print(f"| V2 prompts (canonical JSON of `PROMPTS`) | `{prompts}` |")
print('| V2 weights `model.safetensors` (google/owlvit-base-patch32 @ cbc355fb…) | `4dbe0399f0b7d7c8dddf1535a98769cc30743bebc877aea681998c8d984ce52b` |')
print(f"| `stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json` | `{sha(os.path.join(REPO, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json'))}` |")
print(f"| synthetic `manifest.json` (seed 5005, 12 houses) | `{sha(os.path.join(synth, 'manifest.json'))}` |")
print(f"| synthetic `truth.json` | `{sha(os.path.join(synth, 'truth.json'))}` |")
