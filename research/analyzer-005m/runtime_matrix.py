#!/usr/bin/env python3
"""runtime_matrix.py - runtime-size-matrix.md for BUILDPLAN-ANALYZER-005M (RESEARCH ONLY).

    python -I -B research/analyzer-005m/runtime_matrix.py --manifest stage-reports/artifacts/analyzer-005m-vr2/model-manifest.json \
        --runs <W>/runs --libs <W>/llama.cpp/build/bin --quant stage-reports/artifacts/analyzer-005m-vr2/quantised-sizes.json \
        --out stage-reports/artifacts/analyzer-005m-vr2/runtime-size-matrix.md

Measured here:
  * bytes of every GGUF that ran;
  * runtime library bytes of this x86-64 build;
  * per mode: wall time, image tokens, anonymous RSS, time to load (server log).
From the publishers: BF16 checkpoint bytes, quantisation bytes (quantised-sizes.json, pinned), layer shapes.

Post-review E-1 / E-2:
  * the benchmark asked A, B, C, D, E of one question in a row with the prompt cache on, so D always reused C's plan
    image. That wall time is printed as a benchmark artefact; the STANDALONE figure, what one isolated question costs,
    is the median over cold records (nothing cached) and, for D, an estimate from a least-squares fit of cold prompt
    time on image and text tokens;
  * deployment RAM is estimated from parts (model files, KV cache at a stated context, compute buffers), not as
    "pack + peak anon RSS", which counted the vision weights twice and the benchmark's 2 GiB prompt cache.
Phones were not available: no phone latency is measured; published figures are quoted with their provenance.
"""
import argparse
import json
import os
import re

MODES = ['A_CROP_ONLY', 'B_FULL_PLAN', 'C_FULL_PLAN_MARKED_ROI', 'D_MARKED_ROI_PLUS_CROP', 'E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY']
RUNS = {'qwen3-vl-2b': ('Qwen/Qwen3-VL-2B-Instruct', 'qwen3-vl-2b'), 'qwen3-vl-4b': ('Qwen/Qwen3-VL-4B-Instruct', 'qwen3-vl-4b'),
        'internvl3.5-2b-instruct': ('OpenGVLab/InternVL3_5-2B-Instruct', 'internvl3.5-2b'), 'smolvlm2-2.2b': ('HuggingFaceTB/SmolVLM2-2.2B-Instruct', 'smolvlm2-2.2b')}
# language-model shapes from each config.json at the pinned revision: layers, KV heads, head dim (f16 K and V)
KV_SHAPE = {'qwen3-vl-2b': (28, 8, 128), 'qwen3-vl-4b': (36, 8, 128), 'internvl3.5-2b-instruct': (28, 8, 128), 'smolvlm2-2.2b': (24, 32, 64)}
WHERE = {'internvl3.5-2b-instruct': 'disk (page cache)'}
DEPLOY_CTX = 2048          # a mode-D prompt is ~965 tokens for Qwen3-VL, ~1,750 for InternVL3.5
COMPUTE_GB = 0.3           # compute buffers: an assumption, not measured
GB = 1e9
COLD = 16                  # cachedTokens at or below this = only the chat-template prefix was reused
# Publisher figures, read 2026-10-07 from huggingface.co/qualcomm/Qwen3-VL-2B-Instruct@cbab248c0d20 and
# .../Qwen3-VL-4B-Instruct@dcc61618d13b and the Gemma 3n LiteRT-LM card; quoted, never measured here.
PHONES = [
    '## Phones: published figures only (nothing below was measured in 005M)', '',
    'Qualcomm\'s cards give three rows per device and runtime **without saying which compute unit each row is**. '
    '"Prefill" below is derived here as context ÷ the longest time to first token; it is not a published column. '
    'Time to first token is defined by prompt length; the cards do not say that an image was included.', '',
    '| model / artifact | device, runtime, context | decode tok/s (three rows) | time to first token (s) | derived prefill (tok/s) | source |',
    '| --- | --- | --- | --- | --- | --- |',
    '| Qwen3-VL-2B, q4_0 GGUF | Snapdragon 8 Elite for Galaxy (S25), GENIEX_LLAMACPP, 512 | 47.6 / 41.0 / 36.1 | 0.35–1.40 / 0.18–0.71 / 0.05–0.22 | 365 / 722 / 2,340 | huggingface.co/qualcomm/Qwen3-VL-2B-Instruct |',
    '| Qwen3-VL-4B, q4_0 GGUF | same device, GENIEX_LLAMACPP, 512 | 21.0 / 19.8 / 17.2 | 1.11–4.44 / 0.51–2.04 / 0.12–0.49 | 115 / 250 / 1,040 | huggingface.co/qualcomm/Qwen3-VL-4B-Instruct |',
    '| Qwen3-VL-4B, q4_0 GGUF | same device, GENIEX_LLAMACPP, **4096** | 5.1 / 12.5 / 7.9 | 2.96–**94.7** / 1.14–36.4 / 0.19–6.09 | 43 / 113 / 673 | same |',
    '| Qwen3-VL-4B, w4a16 | same device, GENIEX_QAIRT, 512 / 1024 | 15.9 / 15.5 | 0.09–0.34 / 0.10–0.77 | 1,490 / 1,330 | same; its vision-encoder rows carry no figures |',
    '| Gemma 3n E2B, int4 `.litertlm` | S24 Ultra, LiteRT-LM CPU / GPU | 16.1 / 15.6 | no published figure with an image | 110.5 / 816.4 (published) | huggingface.co/google/gemma-3n-E2B-it-litert-lm |',
    '| SmolVLM2-2.2B / 500M | — | — | none published for phones | — | inference memory 4.9 GB / 1.2 GB: arxiv.org/abs/2504.05299 |',
    '| InternVL3.5-2B | — | — | no phone report found | — | — |', '',
    'The 4096-context rows show the long-prompt penalty: a time to first token of up to 94.7 s for Qwen3-VL-4B. A 512-token '
    'figure is not a floor for a ~1,000-token image prompt. **Measured on this CPU, the vision tower dominates** (fit '
    'below), and none of the phone figures says it includes one.', '',
    '**Delivery limits** (Google Play, read 2026-10-07):',
    '- each asset or AI pack is at most 1.5 GB of *compressed download*;',
    '- install-time content is at most 4 GB cumulative; fast-follow and on-demand packs are at most 30 GB cumulative;',
    '- the AI-pack page says "4GB" cumulative app size and names only LiteRT and MediaPipe as runtimes.',
    '',
    'Source: support.google.com/googleplay/android-developer/answer/9859372 and developer.android.com/google/play/on-device-ai.',
    '',
    'A two-file pack (LLM GGUF + vision GGUF) goes naturally into two AI packs. A single GGUF over 1.5 GB would need '
    '`gguf-split` shards, which llama.cpp loads, but this was not tested here. Install-time packs are installed as APKs, '
    'so llama.cpp would need an uncompressed, aligned asset or a copy-out; fast-follow and on-demand packs land in '
    'internal storage, which can be memory-mapped.', '']


def size_class(b):
    return '≤ 1.0 GB' if b <= 1.0 * GB else ('1.0–2.0 GB' if b <= 2.0 * GB else ('2.0–4.0 GB' if b <= 4.0 * GB else '> 4.0 GB'))


def med(xs):
    xs = sorted(xs)
    return xs[len(xs) // 2] if xs else None


def fit(rows):
    """Least squares: promptMs ~ a * imageTokens + b * textTokens, over cold records. Returns (a, b, r2, n)."""
    pts = [(r['imageTokens'], r['promptTokens'] - r['imageTokens'], r['promptMs']) for r in rows
           if (r.get('cachedTokens') or 0) <= COLD and r.get('imageTokens') and r.get('promptMs')]
    if len(pts) < 10:
        return None
    sxx = sum(x * x for x, _, _ in pts)
    syy = sum(y * y for _, y, _ in pts)
    sxy = sum(x * y for x, y, _ in pts)
    sxz = sum(x * z for x, _, z in pts)
    syz = sum(y * z for _, y, z in pts)
    det = sxx * syy - sxy * sxy
    a = (sxz * syy - syz * sxy) / det
    b = (syz * sxx - sxz * sxy) / det
    mean = sum(z for _, _, z in pts) / len(pts)
    ss_res = sum((z - a * x - b * y) ** 2 for x, y, z in pts)
    ss_tot = sum((z - mean) ** 2 for _, _, z in pts)
    return a, b, 1 - ss_res / ss_tot, len(pts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--runs', required=True)
    ap.add_argument('--libs', required=True)
    ap.add_argument('--quant', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    man = {m['id']: m for m in json.load(open(a.manifest))['models']}
    quant = json.load(open(a.quant))
    libs = {f: os.path.getsize(os.path.join(a.libs, f)) for f in os.listdir(a.libs)
            if re.match(r'lib(llama|ggml|ggml-base|ggml-cpu|mtmd)\.so\.\d', f) and not os.path.islink(os.path.join(a.libs, f))}
    lib_bytes = sum(libs.values())
    L = ['# 005M runtime and size matrix (generated by research/analyzer-005m/runtime_matrix.py)', '',
         '**Setup.**',
         '- Container: 4 vCPU Xeon @ 2.8 GHz (AVX-512 + VNNI, no GPU); llama.cpp `988190680d5a` CPU build, 4 threads, 8k '
         'context.',
         '- **Not a phone.** Latencies are this desktop CPU, and RSS is the server process.',
         f'- Runtime libraries of this **x86-64** build (libllama + libggml* + libmtmd, symlinks counted once): '
         f'**{lib_bytes / 1e6:.2f} MB**. On Android they ship in the APK base module, not in an AI pack. arm64 was not '
         'built. The tokenizer travels inside the GGUF.', '',
         '## Bytes (model files only)', '',
         '| model | BF16 checkpoint (publisher) | LLM Q8_0 (ran) | vision F16 (ran) | **files as run** | LLM Q4_K_M | vision Q8_0 | **smallest files (Q4_K_M + Q8_0 vision): quality unmeasured** | class as run / smallest |',
         '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for label, (mid, _) in RUNS.items():
        m = man[mid]
        ran = m.get('ranGguf') or {}
        llm = next((v['bytes'] for k, v in ran.items() if not k.startswith('mmproj') and v.get('bytes')), None)
        vis = next((v['bytes'] for k, v in ran.items() if k.startswith('mmproj') and v.get('bytes')), None)
        bf16 = m['upstreamWeightBytes'] / (2 if 'SmolVLM2' in mid else 1)   # SmolVLM2-2.2B's safetensors are FP32
        q = quant[label]
        files = (llm or 0) + (vis or 0)
        small = q['llmQ4_K_M'] + q['visionQ8_0']
        tag = lambda s: s.split(' ')[0].rstrip(':')
        L.append(f"| {label} | {bf16 / GB:.2f} GB{' (FP32 on the hub, halved)' if 'SmolVLM2' in mid else ''} | {llm / GB:.2f} GB | {vis / GB:.2f} GB | **{files / GB:.2f} GB** | "
                 f"{q['llmQ4_K_M'] / GB:.2f} GB ({tag(q['llmQ4_K_M_source'])}) | {q['visionQ8_0'] / GB:.2f} GB ({tag(q['visionQ8_0_source'])}) | **{small / GB:.3f} GB** | {size_class(files)} / {size_class(small)} |")
    L += ['', 'OFFICIAL = the publisher\'s own GGUF; REFERENCE = a third-party listing used for its size only (never run); '
          'ESTIMATE = no listing exists. Each figure\'s repository and revision is in `quantised-sizes.json`. Every '
          'accuracy number in 005M is for the files **as run** (LLM Q8_0, vision F16). A smaller pack must be re-run on the '
          'same items before it carries any result.', '']

    # time, tokens and memory
    L += ['## Time and tokens (measured; one question at a time, 4 threads)', '',
          '- **"with A→E cache reuse"** is what the benchmark measured. Each question ran A, B, C, D, E in a row with the '
          'prompt cache on, so D reused C\'s plan image and B sometimes reused an earlier question\'s plan. This is a '
          'benchmark artefact.',
          '- **"standalone"** is what one isolated question costs.',
          '  - For A, B, C and E it is the median over cold records: only the chat-template prefix cached.',
          '  - D was never cold. Its standalone figure is estimated from the fit below: the fitted time for its image and '
          'text tokens, plus its measured decode time.', '',
          '| model | records | load | mode | median, with A→E cache reuse | p90 | **standalone median** (n cold) | median image tokens |',
          '| --- | --- | --- | --- | --- | --- | --- | --- |']
    fits, mem = {}, {}
    for label, (mid, stem) in RUNS.items():
        path = os.path.join(a.runs, f'p2-{stem}.jsonl')
        if not os.path.exists(path) or sum(1 for _ in open(path)) < 835:
            path = os.path.join(a.runs, f'p1-{stem}.jsonl')
        recs = [json.loads(l) for l in open(path)]
        log = open(path.replace('.jsonl', '.server.log')).read() if os.path.exists(path.replace('.jsonl', '.server.log')) else ''
        mt = re.search(r'^(\d+)\.(\d+)\.(\d+)\.\d+ I srv\s+\S+: model loaded', log, re.M)
        load = f'{int(mt.group(1)) * 60 + int(mt.group(2)) + int(mt.group(3)) / 1000:.1f} s' if mt else '—'
        f = fit(recs)
        fits[label] = (f, os.path.basename(path), len(recs))
        for mode in MODES:
            rs = [r for r in recs if r['mode'] == mode and 'wallMs' in r]
            w = sorted(r['wallMs'] for r in rs)
            if mode == 'D_MARKED_ROI_PLUS_CROP':
                est = [f[0] * r['imageTokens'] + f[1] * (r['promptTokens'] - r['imageTokens']) + (r.get('predictedMs') or 0) for r in rs if f and r.get('imageTokens')]
                sa = f"**{med(est) / 1000:.1f} s** (estimate, fit)" if est else '—, all cache-aided'
            else:
                cold = [r['wallMs'] for r in rs if (r.get('cachedTokens') or 0) <= COLD]
                sa = f"**{med(cold) / 1000:.1f} s** ({len(cold)})" if cold else '—, all cache-aided'
            tok = med([r.get('imageTokens') or 0 for r in rs])
            L.append(f"| {label} | {len(recs)} | {load if mode == MODES[0] else ''} | {mode[0]} | {w[len(w) // 2] / 1000:.1f} s | {w[int(len(w) * 0.9)] / 1000:.1f} s | {sa} | {tok} |")
        anon = [((r.get('rss') or {}).get('RssAnon') or 0) for r in recs]
        mem[label] = (anon[0] if anon else 0, max(anon) if anon else 0, path)
    L += ['', '"load" is the time to the server\'s "model loaded" line in the last server log of the run. It measures the storage '
          'here, not the model. Two runs were resumed after a container restart: Qwen3-VL-4B from freshly downloaded tmpfs files, '
          'and InternVL3.5-2B from its GGUF on disk with an empty page cache (2.8 GB read cold). Warm loads from tmpfs were '
          '3.9–4.7 s for every model.', '']
    L += ['', '**Cost per token on this CPU** (least squares over cold records: prompt ms = a × image tokens + b × text tokens)', '',
          '| model | run file | cold records | a: ms per image token | b: ms per text token | R² | image share of a 776 + 190-token mode-D prompt |',
          '| --- | --- | --- | --- | --- | --- | --- |']
    for label, (f, path, n) in fits.items():
        if f:
            L.append(f"| {label} | `{path}` ({n}) | {f[3]} | {f[0]:.1f} | {f[1]:.1f} | {f[2]:.3f} | {100 * f[0] * 776 / (f[0] * 776 + f[1] * 190):.0f} % |")
    L += ['', 'Image tokens include the vision tower\'s work (llama.cpp encodes the image while it processes the prompt). '
          'That is why an image token costs several text tokens here.', '']

    L += ['## Memory', '', f'Measured (server process, {DEPLOY_CTX * 4} context, 2 GiB prompt-cache cap):', '',
          '| model | weights mapped from | anon RSS after the first request | peak anon RSS | of which the prompt cache and its growth |',
          '| --- | --- | --- | --- | --- |']
    for label, (first, peak, path) in mem.items():
        L.append(f"| {label} | {WHERE.get(label, 'tmpfs (/dev/shm)')} | {first / GB:.2f} GB | {peak / GB:.2f} GB | ≈ {(peak - first) / GB:.2f} GB |")
    L += ['', 'Anonymous RSS holds the vision weights (llama.cpp loads them into its own buffers, so they are not in the '
          'mapped-file RSS), the KV cache at 8k, compute buffers and the prompt cache. A one-shot question needs none of '
          'the prompt cache and far less context.', '',
          f'**Deployment RAM, estimated from parts (not measured)**: LLM file (memory-mapped) + vision file + KV cache at '
          f'{DEPLOY_CTX} tokens (f16 K and V, the layer shapes of each config.json) + ≈ {COMPUTE_GB} GB compute buffers + no '
          'prompt cache:', '',
          '| model | KV per token | KV at 2,048 | as run (Q8_0 + F16 vision) | smallest files (Q4_K_M + Q8_0 vision) |', '| --- | --- | --- | --- | --- |']
    for label, (mid, _) in RUNS.items():
        layers, kvh, hd = KV_SHAPE[label]
        per = layers * kvh * hd * 2 * 2
        kv = per * DEPLOY_CTX
        ran = man[mid].get('ranGguf') or {}
        files = sum(v['bytes'] for v in ran.values() if v.get('bytes'))
        q = quant[label]
        small = q['llmQ4_K_M'] + q['visionQ8_0']
        L.append(f"| {label} | {per / 1024:.0f} KiB | {kv / GB:.2f} GB | ≈ {(files + kv) / GB + COMPUTE_GB:.1f} GB | ≈ {(small + kv) / GB + COMPUTE_GB:.1f} GB |")
    L += ['', 'For one Qwen3-VL-2B mode-D question, ~1,000 tokens would do. 2,048 leaves room for InternVL3.5\'s ~1,750-token '
          'prompts. To confirm the estimate, measure once with `-c 2048 --cache-ram 0`.', '']
    L += PHONES
    open(a.out, 'w').write('\n'.join(L) + '\n')
    print(a.out)


if __name__ == '__main__':
    main()
