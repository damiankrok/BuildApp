#!/usr/bin/env python3
"""r1_server.py - BUILDPLAN-ANALYZER-005Q-OCR truth reader R1 (RESEARCH ONLY; never imported by production).

  python3 -I research/analyzer-005q-ocr/r1_server.py --pylib <dir with onnxruntime> --model <inference.onnx> --sha256 <pin>

The PP-OCRv6 MEDIUM recogniser on native ONNX Runtime (CPU), driven by truth.ts over stdin/stdout, one JSON line per
crop: in {"dims": [1, 3, 48, W], "data": <base64 float32, the tensor truth.ts built with the shared paddleTensor>},
out {"argmax": [...], "p": [...]} per CTC frame. The greedy collapse is done in truth.ts, exactly as greedyDecode does.
No pixel is written; nothing leaves the container.
"""
import argparse, base64, hashlib, json, sys

ap = argparse.ArgumentParser()
ap.add_argument('--pylib', required=True)
ap.add_argument('--model', required=True)
ap.add_argument('--sha256', required=True)
a = ap.parse_args()
sys.path.insert(0, a.pylib)
import numpy as np  # noqa: E402
import onnxruntime as ort  # noqa: E402

data = open(a.model, 'rb').read()
if hashlib.sha256(data).hexdigest() != a.sha256:
    sys.exit('the medium recogniser bytes are not the pinned ones: refused')
so = ort.SessionOptions()
so.intra_op_num_threads = 4
s = ort.InferenceSession(data, so, providers=['CPUExecutionProvider'])
iname, oname = s.get_inputs()[0].name, s.get_outputs()[0].name
sys.stdout.write(json.dumps({'ready': True, 'ort': ort.__version__}) + '\n')
sys.stdout.flush()
for line in sys.stdin:
    req = json.loads(line)
    x = np.frombuffer(base64.b64decode(req['data']), dtype=np.float32).reshape(req['dims'])
    probs = s.run([oname], {iname: x})[0][0]
    am = probs.argmax(axis=1)
    sys.stdout.write(json.dumps({'C': int(probs.shape[1]), 'argmax': am.tolist(), 'p': [float(probs[t, k]) for t, k in enumerate(am)]}) + '\n')
    sys.stdout.flush()
