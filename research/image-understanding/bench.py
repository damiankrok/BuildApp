"""IU-01 runtime measurements (x86-64 container CPU, offline). Batch 1, 1 and 4 threads, per backbone: latency,
parameter count, fp32 weight size, peak RSS of a fresh process. Also exports the MobileNetV3 trunk to ONNX and times
it in onnxruntime (the runtime the repo already ships on Android for OCR). Phone numbers are NOT measured here.

  python bench.py <backbone>    # one backbone per process so peak RSS is attributable
"""
import json, os, resource, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.backbones import offline_guard, load, letterbox, to_tensor
offline_guard()
import numpy as np, torch
from PIL import Image

bid = sys.argv[1]
WORK = os.environ.get('IU_WORK', '/home/user/workiu01')
rss0 = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
model, meta = load(bid)
net = getattr(model, 'm', model)
trunk = net.visual if hasattr(net, 'visual') else net
params = sum(p.numel() for p in trunk.parameters())
im = Image.new('RGB', (1280, 853), (200, 210, 220))
x = to_tensor([letterbox(im, meta['size'])], meta)
out = {'backbone': bid, 'inputSize': meta['size'], 'imageTowerParams': params, 'fp32MB': round(params * 4 / 1e6, 1)}
for th in (1, 4):
    torch.set_num_threads(th)
    with torch.inference_mode():
        for _ in range(3):
            model(x)
        ts = []
        for _ in range(10):
            t = time.perf_counter(); model(x); ts.append(time.perf_counter() - t)
    out[f'torchMsBatch1Threads{th}'] = round(1000 * float(np.median(ts)), 1)
out['peakRssMB'] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
if bid == 'mobilenetv3_large_100':
    import onnxruntime as ort
    p = os.path.join(WORK, 'model', 'mobilenetv3_trunk.onnx')
    torch.onnx.export(model, x, p, input_names=['image'], output_names=['embedding'], opset_version=17, dynamo=False)
    so = ort.SessionOptions(); so.intra_op_num_threads = 1
    s = ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
    xi = x.numpy()
    for _ in range(3):
        s.run(None, {'image': xi})
    ts = []
    for _ in range(20):
        t = time.perf_counter(); s.run(None, {'image': xi}); ts.append(time.perf_counter() - t)
    with torch.inference_mode():
        ref = model(x).numpy()
    out['onnx'] = {'fileMB': round(os.path.getsize(p) / 1e6, 1), 'ortMsBatch1Threads1': round(1000 * float(np.median(ts)), 1), 'maxAbsDiffVsTorch': float(np.abs(s.run(None, {'image': xi})[0] - ref).max())}
print(json.dumps(out))
os.makedirs(os.path.join(WORK, 'results'), exist_ok=True)
with open(os.path.join(WORK, 'results', 'bench.jsonl'), 'a') as f:
    f.write(json.dumps(out) + '\n')
