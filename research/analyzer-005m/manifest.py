#!/usr/bin/env python3
"""manifest.py - model-manifest.json of BUILDPLAN-ANALYZER-005M (RESEARCH ONLY; no weight enters the repository).

    python -I -B research/analyzer-005m/manifest.py --manifests <W>/manifests --out stage-reports/artifacts/analyzer-005m-vr2/model-manifest.json

Inputs, all outside the repository: the Hugging Face API snapshot of every candidate (revision, licence tag, gating,
per-file sizes and LFS SHA-256), the download records of the checkpoints converted here, and the SHA-256 of every GGUF
that ran. Output: ids, exact revisions, licences, upstream sizes, hashes, runtime and quantisation - text only.
"""
import argparse
import glob
import json
import os

RUNTIME = 'llama.cpp ggml-org/llama.cpp@988190680d5a89fce97de3c20df2c2813731fd61 (built here, CPU, GGML_NATIVE on AVX-512 VNNI, 4 threads), llama-server OpenAI chat API, JSON-schema decoding'

CANDIDATES = [
    {'role': 'MANDATORY', 'id': 'Qwen/Qwen3-VL-2B-Instruct', 'gguf': 'Qwen/Qwen3-VL-2B-Instruct-GGUF', 'files': ['Qwen3VL-2B-Instruct-Q8_0.gguf', 'mmproj-Qwen3VL-2B-Instruct-F16.gguf'],
     'derivative': 'OFFICIAL_QUANTISATION by the same publisher (Qwen), base_model = the pinned checkpoint; LLM Q8_0, vision F16', 'local': 'qwen3vl-2b.gguf.sha256'},
    {'role': 'MANDATORY', 'id': 'Qwen/Qwen3-VL-4B-Instruct', 'gguf': 'Qwen/Qwen3-VL-4B-Instruct-GGUF', 'files': ['Qwen3VL-4B-Instruct-Q8_0.gguf', 'mmproj-Qwen3VL-4B-Instruct-F16.gguf'],
     'derivative': 'OFFICIAL_QUANTISATION by the same publisher (Qwen), base_model = the pinned checkpoint; LLM Q8_0, vision F16', 'local': 'qwen3vl-4b.gguf.sha256'},
    {'role': 'MANDATORY', 'id': 'HuggingFaceTB/SmolVLM2-2.2B-Instruct', 'gguf': None, 'files': [],
     'derivative': 'CONVERTED_HERE from the pinned safetensors with llama.cpp convert_hf_to_gguf.py at the runtime commit; LLM Q8_0, vision F16 (no third-party GGUF used)',
     'local': 'smolvlm2-2.2b.gguf.sha256', 'download': 'smolvlm2-2.2b.download.json'},
    {'role': 'MANDATORY', 'id': 'OpenGVLab/InternVL3_5-2B-Instruct', 'gguf': None, 'files': [],
     'derivative': 'CONVERTED_HERE from the pinned safetensors with llama.cpp convert_hf_to_gguf.py; LLM Q8_0, vision F16. The repository ships no preprocessor_config.json; the conversion was given the model card\'s own ImageNet mean/std and 448 input size (README lines 440-441), written outside the repository',
     'local': 'internvl35-2b-instruct.gguf.sha256', 'download': 'internvl35-2b-instruct.download.json'},
    {'role': 'CONDITIONAL', 'id': 'google/gemma-3n-E2B-it', 'gguf': None, 'files': [], 'derivative': None, 'local': None,
     'status': 'NOT_RUN_ACCESS_GATED: gated "manual" on the hub; an unauthenticated request for config.json at the pinned revision returned 401; no credential exists in this environment and none was created (brief section 3: absence is not a blocker)'},
    {'role': 'CONDITIONAL_REFERENCE', 'id': 'google/gemma-3n-E4B-it', 'gguf': None, 'files': [], 'derivative': None, 'local': None, 'status': 'NOT_RUN_ACCESS_GATED (MatFormer audit only)'},
    {'role': 'TEACHER_PRIMARY', 'id': 'Qwen/Qwen3-VL-8B-Instruct', 'gguf': 'Qwen/Qwen3-VL-8B-Instruct-GGUF', 'files': ['Qwen3VL-8B-Instruct-Q4_K_M.gguf', 'mmproj-Qwen3VL-8B-Instruct-F16.gguf'],
     'derivative': 'OFFICIAL_QUANTISATION by the same publisher (Qwen); LLM Q4_K_M (its Q8_0, 8.7 GB, plus runtime memory does not fit the 13.36 GiB cgroup), vision F16', 'local': 'qwen3vl-8b.gguf.sha256',
     'status': 'RUN_CPU_SUBSET: 24 phase-1 questions without the TEST split x 5 modes (120 records) and 42 TRAIN questions in mode D, plus 12 free-text rationales; the first 27 records ran with an 8k context and the 2 GiB prompt cache, the rest with -c 4096 --cache-ram 0 after an OOM kill; downloaded files matched the hub LFS SHA-256'},
    {'role': 'TEACHER_UPPER_ORACLE', 'id': 'Qwen/Qwen3-VL-32B-Instruct', 'gguf': None, 'files': [], 'derivative': None, 'local': None,
     'status': 'NOT_RUN_DEFERRED_ENV: 66.7 GB of BF16 weights; no GPU, a 13.36 GiB memory cgroup, under 1 GB of free disk; no hosted inference is authorised for this stage'},
    {'role': 'REFERENCE_005J', 'id': 'HuggingFaceTB/SmolVLM2-500M-Video-Instruct', 'gguf': None, 'files': [], 'derivative': None, 'local': None, 'download': 'smolvlm2-500m.download.json',
     'status': 'NOT_RE_RUN as a referee (its 005J results are joined on the exact question intersection). Its safetensors were downloaded at the pinned revision for the CPU student probe only (8 LoRA steps, no adapter saved)'},
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifests', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    out = {'researchOnly': 'BUILDPLAN-ANALYZER-005M', 'note': 'Weights live outside the repository (/dev/shm/models and the work directory) and never enter Git history, LFS or Releases. Sizes and hashes are upstream (Hugging Face API, LFS SHA-256) or computed locally over the exact bytes that ran.',
           'runtime': RUNTIME, 'models': []}
    for c in CANDIDATES:
        api = json.load(open(os.path.join(a.manifests, 'hfapi-' + c['id'].replace('/', '_') + '.json')))
        files = {s['rfilename']: {'bytes': s.get('size'), 'lfsSha256': (s.get('lfs') or {}).get('sha256')} for s in api['siblings']}
        weight_bytes = sum(v['bytes'] or 0 for k, v in files.items() if k.endswith(('.safetensors', '.bin', '.gguf', '.pt')))
        rec = {'role': c['role'], 'id': c['id'], 'revision': api['sha'], 'lastModified': api.get('lastModified'), 'licenseTag': [t for t in api.get('tags', []) if t.startswith('license:')],
               'gated': api.get('gated'), 'baseModel': (api.get('cardData') or {}).get('base_model'), 'upstreamWeightBytes': weight_bytes,
               'upstreamFiles': {k: v for k, v in files.items() if (v['bytes'] or 0) > 1_000_000}, 'derivative': c['derivative'], 'status': c.get('status', 'RUN')}
        if c['gguf']:
            g = json.load(open(os.path.join(a.manifests, 'hfapi-' + c['gguf'].replace('/', '_') + '.json')))
            gf = {s['rfilename']: {'bytes': s.get('size'), 'lfsSha256': (s.get('lfs') or {}).get('sha256')} for s in g['siblings']}
            rec['ggufRepo'] = {'id': c['gguf'], 'revision': g['sha'], 'licenseTag': [t for t in g.get('tags', []) if t.startswith('license:')], 'filesRun': {f: gf[f] for f in c['files']},
                               'allQuantisations': {k: v['bytes'] for k, v in gf.items() if k.endswith('.gguf')}}
        if c.get('download'):
            d = json.load(open(os.path.join(a.manifests, c['download'])))
            rec['downloadedAtRevision'] = d['revision']
            rec['downloadedFiles'] = {k: v for k, v in d['files'].items() if v['bytes'] > 1_000_000}
        if c.get('local') and os.path.exists(os.path.join(a.manifests, c['local'])):
            rec['ranGguf'] = {os.path.basename(line.split()[1]): {'sha256': line.split()[0]} for line in open(os.path.join(a.manifests, c['local'])) if line.strip()}
            sizes = os.path.join(a.manifests, c['local'].replace('.sha256', '.bytes.json'))
            if os.path.exists(sizes):
                for k, v in json.load(open(sizes)).items():
                    rec['ranGguf'].setdefault(k, {})['bytes'] = v
        out['models'].append(rec)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, 'w'), indent=1)
    print(json.dumps([(m['id'], m['revision'][:12], m['status'][:20]) for m in out['models']]))


if __name__ == '__main__':
    main()
