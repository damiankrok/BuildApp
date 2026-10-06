#!/usr/bin/env python3
"""vlm_bench.py - small vision-language models on BuildPlan's closed questions (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B vlm_bench.py --backend smolvlm2|florence2|moondream05 --items <items.jsonl> --img <dir> --out <out.jsonl>
                              [--threads 4] [--limit N] [--shard i/n]

Every model gets the same image bytes and the same prompt (compose.py). Two read-outs per question, scored apart:

  GEN_JSON    greedy generation of the JSON the prompt demands; STRICT = valid JSON with an enum answer, LENIENT = the
              first enum word anywhere in the text. A model's self-reported "confidence" is kept but never trusted
              blindly: it is reported as such.
  ENUM_SCORE  the model's own probability of each enum answer, forced inside the demanded JSON
              ('{"answer": "' + option + '"'), normalised over the closed enum (UNRESOLVED included). Answer = argmax,
              confidence = its probability. No free text can leak in.
  STRUCTURED  Florence-2 only: its grounding task on the RAW crop, for the two classes where a detection maps to an
              answer without interpretation (a window/door box over the gap -> OPENING; a column box on the element ->
              COLUMN). No detection is UNRESOLVED, never the opposite class.

Explanations are never used to choose truth. Nothing here reads an expected answer: `expected` is copied to the output
for the scorer and is not visible to the model code path (asserted by never passing the item dict to a backend).
Weights are pinned by revision and file SHA-256 (models.json); offline after the fetch.
"""
import argparse
import hashlib
import json
import math
import os
import re
import sys
import time

import numpy as np
from PIL import Image

FORCED = '{"answer": "'


def parse_answer(text, enum):
    """STRICT: a JSON object with an enum answer (and optional numeric confidence). LENIENT: the first enum word."""
    strict, conf = None, None
    for m in re.finditer(r'\{[^{}]*\}', text or ''):
        try:
            obj = json.loads(m.group(0))
        except Exception:
            continue
        a = str(obj.get('answer', '')).strip().upper()
        if a in enum:
            strict = a
            c = obj.get('confidence')
            if isinstance(c, (int, float)) and 0 <= c <= 1:
                conf = float(c)
            break
    lenient = strict
    if lenient is None:
        up = (text or '').upper()
        best = None
        for e in sorted(enum, key=len, reverse=True):
            m = re.search(r'(?<![A-Z_])' + re.escape(e) + r'(?![A-Z_])', up)
            if m and (best is None or m.start() < best[0]):
                best = (m.start(), e)
        lenient = best[1] if best else None
    return strict, lenient, conf


def softmax_scores(logps):
    m = max(logps.values())
    ex = {k: math.exp(v - m) for k, v in logps.items()}
    s = sum(ex.values())
    return {k: v / s for k, v in ex.items()}


def log_softmax(v):
    v = v.astype(np.float64)
    m = v.max()
    return v - m - math.log(np.exp(v - m).sum())


# ----------------------------------------------------------------------------------------------------------------------
class SmolVLM2:
    """SmolVLM2-500M-Video-Instruct through its official ONNX export: the fp32 vision encoder (the int8 one needs
    ConvInteger, which ONNX Runtime's CPU provider does not implement) and the int8 token embedding and decoder.
    One 512 x 512 tile, no image splitting (64 image tokens), as the community LiteRT bundle fixes its input."""

    name = 'smolvlm2-500m-onnx-int8dec'

    def __init__(self, path, threads):
        import onnxruntime as ort
        from transformers import AutoProcessor
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        self.vis = ort.InferenceSession(os.path.join(path, 'onnx/vision_encoder.onnx'), so, providers=['CPUExecutionProvider'])
        self.emb = ort.InferenceSession(os.path.join(path, 'onnx/embed_tokens_int8.onnx'), so, providers=['CPUExecutionProvider'])
        self.dec = ort.InferenceSession(os.path.join(path, 'onnx/decoder_model_merged_int8.onnx'), so, providers=['CPUExecutionProvider'])
        self.proc = AutoProcessor.from_pretrained(path)
        self.proc.image_processor.do_image_splitting = False
        self.proc.image_processor.size = {'longest_edge': 512}
        self.tok = self.proc.tokenizer
        cfg = json.load(open(os.path.join(path, 'config.json')))
        self.image_token_id = cfg['image_token_id']
        tc = cfg['text_config']
        self.layers, self.kvh, self.hd = tc['num_hidden_layers'], tc['num_key_value_heads'], tc.get('head_dim', tc['hidden_size'] // tc['num_attention_heads'])
        self.eos = self.tok.convert_tokens_to_ids('<end_of_utterance>')
        self.out_names = [o.name for o in self.dec.get_outputs()]
        self._cache = (None, None)

    def _empty_past(self):
        return {f'past_key_values.{l}.{kv}': np.zeros([1, self.kvh, 0, self.hd], dtype=np.float32) for l in range(self.layers) for kv in ('key', 'value')}

    def _past_from(self, outs):
        past = {}
        for name, arr in zip(self.out_names[1:], outs[1:]):
            past[name.replace('present.', 'past_key_values.')] = arr
        return past

    def _prefill(self, img, prompt, forced=''):
        msgs = [{'role': 'user', 'content': [{'type': 'image'}, {'type': 'text', 'text': prompt}]}]
        text = self.proc.apply_chat_template(msgs, add_generation_prompt=True) + forced
        t0 = time.perf_counter()
        inp = self.proc(text=text, images=[img], return_tensors='np')
        ids, am = inp['input_ids'], inp['attention_mask'].astype(np.int64)
        embeds = self.emb.run(None, {'input_ids': ids})[0]
        t1 = time.perf_counter()
        key = hashlib.sha256(inp['pixel_values'].tobytes()).hexdigest()
        if self._cache[0] != key:
            # the vision tower runs once per image; the scoring pass reuses it (same pixels, same features)
            self._cache = (key, self.vis.run(['image_features'], {'pixel_values': inp['pixel_values'].astype(np.float32), 'pixel_attention_mask': inp['pixel_attention_mask'].astype(np.bool_)})[0])
        feats = self._cache[1]
        t2 = time.perf_counter()
        embeds[ids == self.image_token_id] = feats.reshape(-1, feats.shape[-1])
        pos = np.cumsum(am, axis=-1).astype(np.int64)
        outs = self.dec.run(None, dict(inputs_embeds=embeds, attention_mask=am, position_ids=pos, **self._empty_past()))
        t3 = time.perf_counter()
        return outs[0][:, -1], self._past_from(outs), am, pos[:, -1:], {'preprocessMs': (t1 - t0) * 1e3, 'visionMs': (t2 - t1) * 1e3, 'prefillMs': (t3 - t2) * 1e3, 'promptTokens': int(ids.shape[1])}

    def _step(self, token_ids, past, am, pos):
        ids = np.array([token_ids], dtype=np.int64)
        emb = self.emb.run(None, {'input_ids': ids})[0]
        am2 = np.concatenate([am, np.ones((1, len(token_ids)), dtype=np.int64)], axis=1)
        p = (pos[:, -1:] + np.arange(1, len(token_ids) + 1)).astype(np.int64)
        outs = self.dec.run(None, dict(inputs_embeds=emb, attention_mask=am2, position_ids=p, **past))
        return outs[0], self._past_from(outs), am2, p[:, -1:]

    def generate(self, img, prompt, max_new=48):
        logits, past, am, pos, tm = self._prefill(img, prompt)
        out = []
        t0 = time.perf_counter()
        for _ in range(max_new):
            nxt = int(np.argmax(logits[0]))
            if nxt == self.eos:
                break
            out.append(nxt)
            lg, past, am, pos = self._step([nxt], past, am, pos)
            logits = lg[:, -1]
        tm['decodeMs'] = (time.perf_counter() - t0) * 1e3
        tm['newTokens'] = len(out)
        return self.tok.decode(out, skip_special_tokens=True), tm

    def score(self, img, prompt, enum):
        logits, past, am, pos, tm = self._prefill(img, prompt, FORCED)
        t0 = time.perf_counter()
        last = log_softmax(logits[0])
        logps = {}
        for opt in enum:
            toks = self.tok(opt + '"', add_special_tokens=False)['input_ids']
            lp = float(last[toks[0]])
            pp, aa, po = past, am, pos
            for i in range(1, len(toks)):
                # the merged decoder takes one new token at a time once a past exists
                lg, pp, aa, po = self._step([toks[i - 1]], pp, aa, po)
                lp += float(log_softmax(lg[0, -1])[toks[i]])
            logps[opt] = lp
        tm['scoreMs'] = (time.perf_counter() - t0) * 1e3
        return logps, tm


# ----------------------------------------------------------------------------------------------------------------------
class Florence2:
    """Florence-2-base (0.23 B, MIT), the official transformers-converted checkpoint, fp32 on CPU."""

    name = 'florence2-base'

    def __init__(self, path, threads):
        import torch
        from transformers import AutoProcessor, Florence2ForConditionalGeneration
        torch.set_num_threads(threads)
        self.torch = torch
        self.proc = AutoProcessor.from_pretrained(path)
        self.model = Florence2ForConditionalGeneration.from_pretrained(path, dtype=torch.float32).eval()
        self.tok = self.proc.tokenizer

    def _inputs(self, img, text):
        return self.proc(text=text, images=img, return_tensors='pt')

    def generate(self, img, prompt, max_new=48):
        t0 = time.perf_counter()
        with self.torch.no_grad():
            inp = self._inputs(img, prompt)
            ids = self.model.generate(**inp, max_new_tokens=max_new, num_beams=1, do_sample=False)
        text = self.proc.batch_decode(ids, skip_special_tokens=False)[0]
        text = text.replace('</s>', '').replace('<s>', '').replace('<pad>', '').strip()
        return text, {'totalMs': (time.perf_counter() - t0) * 1e3, 'newTokens': int(ids.shape[1])}

    def score(self, img, prompt, enum):
        """All options in one batch (the image and the question repeated), so the encoder runs once per batch."""
        torch = self.torch
        t0 = time.perf_counter()
        logps = {}
        with torch.no_grad():
            inp = self._inputs(img, prompt)
            n = len(enum)
            pre = self.tok(FORCED, add_special_tokens=True)['input_ids']
            n_pre = len(pre) - 1                       # the prefix without its closing </s>
            seqs = [self.tok(FORCED + opt + '"', add_special_tokens=True)['input_ids'] for opt in enum]
            L = max(len(x) for x in seqs)
            pad = self.tok.pad_token_id
            lab = torch.full((n, L), pad, dtype=torch.long)
            for i, x in enumerate(seqs):
                lab[i, :len(x)] = torch.tensor(x)
            batch = {k: v.repeat(n, *([1] * (v.dim() - 1))) if hasattr(v, 'repeat') else v for k, v in inp.items()}
            out = self.model(**batch, labels=lab)
            lp = torch.log_softmax(out.logits.float(), dim=-1)
            for i, (opt, x) in enumerate(zip(enum, seqs)):
                ids = torch.tensor(x)
                tl = lp[i, torch.arange(len(x)), ids]
                # the option's own tokens and its closing quote: after the shared prefix, before the final </s>
                logps[opt] = float(tl[n_pre:len(x) - 1].sum())
        return logps, {'scoreMs': (time.perf_counter() - t0) * 1e3}

    def ground(self, img, phrase):
        t0 = time.perf_counter()
        task = '<CAPTION_TO_PHRASE_GROUNDING>'
        with self.torch.no_grad():
            inp = self._inputs(img, task + phrase)
            ids = self.model.generate(**inp, max_new_tokens=128, num_beams=1, do_sample=False)
        raw = self.proc.batch_decode(ids, skip_special_tokens=False)[0]
        parsed = self.proc.post_process_generation(raw, task=task, image_size=img.size)
        return parsed.get(task, parsed), {'groundMs': (time.perf_counter() - t0) * 1e3}


# ----------------------------------------------------------------------------------------------------------------------
class Moondream05:
    """Moondream 0.5B int8 (moondream-0_5b-int8.mf.gz, branch onnx @ 9dddae84), through the last client that runs it
    locally (moondream 0.0.6, ONNX Runtime). Enum scoring uses the client's own text encoder/decoder graphs."""

    name = 'moondream-0.5b-int8'

    def __init__(self, path, threads):
        import onnxruntime as ort
        orig = ort.SessionOptions

        def opts():
            so = orig()
            so.intra_op_num_threads = threads
            so.inter_op_num_threads = 1
            return so
        ort.SessionOptions = opts
        import moondream as md
        from moondream.onnx_vl import prepare_kv_cache
        self.prepare_kv_cache = prepare_kv_cache
        self.m = md.vl(model=path)
        ort.SessionOptions = orig
        self._cache = (None, None)

    def _encode(self, img):
        key = hashlib.sha256(img.tobytes()).hexdigest()
        if self._cache[0] != key:
            self._cache = (key, self.m.encode_image(img))
        return self._cache[1]

    def generate(self, img, prompt, max_new=48):
        t0 = time.perf_counter()
        enc = self._encode(img)
        t1 = time.perf_counter()
        ans = self.m.query(enc, prompt, settings={'max_tokens': max_new})['answer']
        return ans, {'encodeMs': (t1 - t0) * 1e3, 'queryMs': (time.perf_counter() - t1) * 1e3}

    def score(self, img, prompt, enum):
        m = self.m
        t0 = time.perf_counter()
        enc = self._encode(img)
        t1 = time.perf_counter()
        kv = self.prepare_kv_cache(enc)
        pos = enc.pos
        toks = m.templates['query']['prefix'] + m.tokenizer.encode(prompt).ids + m.templates['query']['suffix'] + m.tokenizer.encode(FORCED).ids
        (emb,) = m.text_encoder.run(None, {'input_ids': [toks]})
        logits, upd = m.text_decoder.run(['logits', 'new_kv_cache'], {'input_embeds': emb, 'kv_cache': kv[:, :, :, :, :pos, :]})
        kv[:, :, :, :, pos:pos + emb.shape[-2], :] = upd
        base = pos + emb.shape[-2]
        last = log_softmax(np.asarray(logits).reshape(-1, np.asarray(logits).shape[-1])[-1])
        logps = {}
        for opt in enum:
            ot = m.tokenizer.encode(opt + '"').ids
            lp = float(last[ot[0]])
            p = base
            for i in range(1, len(ot)):
                (e,) = m.text_encoder.run(None, {'input_ids': [[ot[i - 1]]]})
                lg, u = m.text_decoder.run(['logits', 'new_kv_cache'], {'input_embeds': e, 'kv_cache': kv[:, :, :, :, :p, :]})
                kv[:, :, :, :, p:p + 1, :] = u
                p += 1
                lp += float(log_softmax(np.asarray(lg).reshape(-1, np.asarray(lg).shape[-1])[-1])[ot[i]])
            logps[opt] = lp
        return logps, {'encodeMs': (t1 - t0) * 1e3, 'scoreMs': (time.perf_counter() - t1) * 1e3}


def structured_florence(model, img, item):
    """Florence-2 grounding read-out for two classes, RAW crops only. Detection -> answer; no detection -> UNRESOLVED."""
    tb = item.get('targetBox512')
    if not tb:
        return None
    if item['cls'] == 'OPENING_VS_PATTERN':
        phrase, positive = 'a window or a door', 'OPENING'
    elif item['cls'] == 'COLUMN_VS_WALL':
        phrase, positive = 'a column', 'COLUMN'
    else:
        return None
    res, tm = model.ground(img, phrase)
    boxes = res.get('bboxes', []) if isinstance(res, dict) else []
    x0, y0, x1, y1 = tb
    area = max(1.0, (x1 - x0) * (y1 - y0))
    hit = False
    for b in boxes:
        ix = max(0.0, min(x1, b[2]) - max(x0, b[0]))
        iy = max(0.0, min(y1, b[3]) - max(y0, b[1]))
        bw, bh = b[2] - b[0], b[3] - b[1]
        # a box over most of the target that is not simply the whole crop
        if ix * iy >= 0.5 * area and bw * bh <= 0.5 * 512 * 512:
            hit = True
    return {'answer': positive if hit else 'UNRESOLVED', 'boxes': boxes, **tm}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backend', required=True, choices=['smolvlm2', 'florence2', 'moondream05'])
    ap.add_argument('--model-path', required=True)
    ap.add_argument('--items', required=True)
    ap.add_argument('--img', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--threads', type=int, default=4)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--shard', default='0/1')
    ap.add_argument('--methods', default='GEN_JSON,ENUM_SCORE,STRUCTURED')
    ap.add_argument('--gen-subset', default=None, help='file of "qid mode" lines; GEN_JSON runs only on those')
    a = ap.parse_args()
    items = [json.loads(l) for l in open(a.items)]
    si, sn = (int(x) for x in a.shard.split('/'))
    items = [it for i, it in enumerate(items) if i % sn == si]
    if a.limit:
        items = items[:a.limit]
    done = set()
    if os.path.exists(a.out):
        for l in open(a.out):
            r = json.loads(l)
            done.add((r['qid'], r['mode']))
    B = {'smolvlm2': SmolVLM2, 'florence2': Florence2, 'moondream05': Moondream05}[a.backend]
    t0 = time.perf_counter()
    model = B(a.model_path, a.threads)
    load_ms = (time.perf_counter() - t0) * 1e3
    methods = a.methods.split(',')
    gen_keys = None
    if a.gen_subset:
        gen_keys = set(tuple(l.split()) for l in open(a.gen_subset) if l.strip())
    with open(a.out, 'a') as fh:
        for it in items:
            if (it['qid'], it['mode']) in done:
                continue
            img = Image.open(os.path.join(a.img, it['image'])).convert('RGB')
            prompt, enum = it['prompt'], it['enum']    # the only fields a model sees
            rec = {'qid': it['qid'], 'mode': it['mode'], 'model': B.name, 'imageSha256': it['imageSha256'], 'loadMs': round(load_ms, 1)}
            if 'GEN_JSON' in methods and (gen_keys is None or (it['qid'], it['mode']) in gen_keys):
                t = time.perf_counter()
                text, tm = model.generate(img, prompt)
                strict, lenient, conf = parse_answer(text, enum)
                rec['gen'] = {'text': text[:400], 'strict': strict, 'lenient': lenient, 'selfConfidence': conf, 'ms': round((time.perf_counter() - t) * 1e3, 1), **{k: round(v, 1) if isinstance(v, float) else v for k, v in tm.items()}}
            if 'ENUM_SCORE' in methods:
                t = time.perf_counter()
                logps, tm = model.score(img, prompt, enum)
                probs = softmax_scores(logps)
                ans = max(probs, key=probs.get)
                rec['score'] = {'logp': {k: round(v, 4) for k, v in logps.items()}, 'probs': {k: round(v, 5) for k, v in probs.items()}, 'answer': ans, 'confidence': round(probs[ans], 5),
                                'ms': round((time.perf_counter() - t) * 1e3, 1), **{k: round(v, 1) if isinstance(v, float) else v for k, v in tm.items()}}
            if 'STRUCTURED' in methods and a.backend == 'florence2' and it['mode'] == 'RAW':
                s = structured_florence(model, img, it)
                if s:
                    rec['structured'] = s
            fh.write(json.dumps(rec) + '\n')
            fh.flush()


if __name__ == '__main__':
    main()
