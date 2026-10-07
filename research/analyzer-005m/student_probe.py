#!/usr/bin/env python3
"""student_probe.py - a measured CPU feasibility probe of BuildPlan student training (RESEARCH ONLY; not a trained model).

    python -I -B research/analyzer-005m/student_probe.py --model <SmolVLM2-500M snapshot dir, outside the repo> \
        --items <W>/items-train/items.jsonl --img <W>/items-train/img --steps 6 --out <W>/student/probe.json

What it measures, on this container's CPU: one LoRA (r=16 on the language model's attention and MLP projections)
optimisation step of SmolVLM2-500M on a real 005M TRAIN item in the bake-off's own prompt, with the generator target
as the label - trainable parameters, seconds per step, peak RSS and whether the loss moves. It saves nothing that
could be mistaken for a student: no adapter is written. The numbers size the GPU plan in student-training.md.
"""
import argparse
import json
import os
import resource
import time

import torch
from PIL import Image
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForImageTextToText, AutoProcessor


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--items', required=True)
    ap.add_argument('--img', required=True)
    ap.add_argument('--steps', type=int, default=6)
    ap.add_argument('--mode', default='D_MARKED_ROI_PLUS_CROP')
    ap.add_argument('--threads', type=int, default=4)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    torch.manual_seed(0)
    torch.set_num_threads(a.threads)
    items = [json.loads(l) for l in open(a.items)]
    items = [it for it in items if it['mode'] == a.mode][: a.steps]
    proc = AutoProcessor.from_pretrained(a.model)
    t0 = time.time()
    model = AutoModelForImageTextToText.from_pretrained(a.model, torch_dtype=torch.float32)
    load_s = time.time() - t0
    cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.0, target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'])
    model = get_peft_model(model, cfg)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=2e-4)
    model.train()
    steps = []
    for it in items:
        images = [Image.open(os.path.join(a.img, n)).convert('RGB') for n in it['images']]
        target = json.dumps({'answer': it['expectedLetter'] if not (it['contextDependent'] and it['mode'] == 'A_CROP_ONLY') else 'UNRESOLVED',
                             'confidence': 'HIGH' if not (it['contextDependent'] and it['mode'] == 'A_CROP_ONLY') else 'LOW'})
        msgs = [{'role': 'user', 'content': [{'type': 'image'} for _ in images] + [{'type': 'text', 'text': it['prompt']}]},
                {'role': 'assistant', 'content': [{'type': 'text', 'text': target}]}]
        text = proc.apply_chat_template(msgs, add_generation_prompt=False)
        prompt_only = proc.apply_chat_template(msgs[:1], add_generation_prompt=True)
        batch = proc(text=[text], images=[images], return_tensors='pt')
        n_prompt = len(proc(text=[prompt_only], images=[images], return_tensors='pt')['input_ids'][0])
        labels = batch['input_ids'].clone()
        labels[:, :n_prompt] = -100
        t = time.time()
        out = model(**batch, labels=labels)
        out.loss.backward()
        opt.step()
        opt.zero_grad()
        steps.append({'qid': it['qid'], 'tokens': int(batch['input_ids'].shape[1]), 'targetTokens': int((labels != -100).sum()), 'loss': round(float(out.loss), 4), 'seconds': round(time.time() - t, 2)})
        print(steps[-1], flush=True)
    rec = {'model': a.model, 'mode': a.mode, 'dtype': 'float32 (CPU)', 'threads': a.threads, 'loadSeconds': round(load_s, 1), 'trainableParams': trainable, 'totalParams': total,
           'steps': steps, 'medianStepSeconds': sorted(s['seconds'] for s in steps)[len(steps) // 2] if steps else None,
           'peakRssBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024, 'adapterSaved': False}
    json.dump(rec, open(a.out, 'w'), indent=1)
    print(json.dumps({k: v for k, v in rec.items() if k != 'steps'}))


if __name__ == '__main__':
    main()
