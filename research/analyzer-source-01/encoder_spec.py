"""SOURCE-01 (research, one-off): describe the exported encoder's ONNX graph WITHOUT its weights, and say for every
initializer which upstream timm tensors make it (a convolution's weight/bias with the BatchNorm that follows it folded
in). The spec is committed; the weights are not — tools/fetch-image-role.mjs rebuilds the ONNX from the pinned upstream
safetensors with it.
  $PY encoder_spec.py <model.onnx> <spec-out.json>"""
import json, sys
import numpy as np, onnx, timm, torch
from onnx import numpy_helper
m = onnx.load(sys.argv[1])
net = timm.create_model('mobilenetv4_conv_small.e2400_r224_in1k', pretrained=True, num_classes=0).eval()
sd = {k: v.detach().numpy().astype(np.float32) for k, v in net.state_dict().items()}
# every (conv, following norm) pair timm builds: ConvNormAct-style modules hold .conv and .bn/.bn1/.norm
pairs = []
mods = dict(net.named_modules())
for name, mod in mods.items():
    if isinstance(mod, torch.nn.Conv2d):
        parent = name.rsplit('.', 1)[0] if '.' in name else ''
        leaf = name.rsplit('.', 1)[-1]
        cands = []
        p = mods.get(parent)
        for bn_name, bn in (p.named_children() if p is not None else []):
            if isinstance(bn, torch.nn.BatchNorm2d): cands.append((f'{parent}.{bn_name}' if parent else bn_name, bn))
        pairs.append((name, cands))
def fold(conv, bn):
    w = sd[f'{conv}.weight']; b = sd.get(f'{conv}.bias', np.zeros(w.shape[0], np.float32))
    if bn is None: return w, b
    g, be, mu, var = sd[f'{bn}.weight'], sd[f'{bn}.bias'], sd[f'{bn}.running_mean'], sd[f'{bn}.running_var']
    s = g / np.sqrt(var + mods[bn].eps)
    return w * s[:, None, None, None], (b - mu) * s + be
inits = {i.name: numpy_helper.to_array(i) for i in m.graph.initializer}
spec_init = []
used = set()
for node in m.graph.node:
    if node.op_type != 'Conv': continue
    W = inits[node.input[1]]; B = inits[node.input[2]] if len(node.input) > 2 else None
    hit = None
    for conv, cands in pairs:
        if conv in used or sd[f'{conv}.weight'].shape != W.shape: continue
        for bn_name, bn in cands + [(None, None)]:
            if bn is not None and bn.num_features != W.shape[0]: continue
            fw, fb = fold(conv, bn_name)
            if np.allclose(fw, W, atol=1e-5, rtol=1e-4) and (B is None or np.allclose(fb, B, atol=1e-5, rtol=1e-4)):
                hit = (conv, bn_name); break
        if hit: break
    assert hit, node.name
    used.add(hit[0])
    conv, bn = hit
    eps = float(mods[bn].eps) if bn else None
    spec_init.append({'name': node.input[1], 'dims': list(W.shape), 'from': {'kind': 'weight', 'conv': conv, 'bn': bn, 'eps': eps}})
    if B is not None: spec_init.append({'name': node.input[2], 'dims': list(B.shape), 'from': {'kind': 'bias', 'conv': conv, 'bn': bn, 'eps': eps, 'convHasBias': f'{conv}.bias' in sd}})
other = [i for i in m.graph.initializer if i.name not in {s['name'] for s in spec_init}]
assert not other, [o.name for o in other]
def attr(a):
    if a.type == onnx.AttributeProto.INT: return {'name': a.name, 'i': a.i}
    if a.type == onnx.AttributeProto.INTS: return {'name': a.name, 'ints': list(a.ints)}
    if a.type == onnx.AttributeProto.FLOAT: return {'name': a.name, 'f': a.f}
    raise ValueError(a)
def vi(v): return {'name': v.name, 'dims': [d.dim_value for d in v.type.tensor_type.shape.dim]}
spec = {'schema': 'buildapp.image-role-encoder-spec', 'upstream': 'timm/mobilenetv4_conv_small.e2400_r224_in1k', 'opset': 17, 'irVersion': m.ir_version,
        'inputs': [vi(v) for v in m.graph.input], 'outputs': [vi(v) for v in m.graph.output],
        'nodes': [{'op': n.op_type, 'name': n.name, 'inputs': list(n.input), 'outputs': list(n.output), 'attributes': [attr(a) for a in n.attribute]} for n in m.graph.node],
        'initializers': spec_init}
json.dump(spec, open(sys.argv[2], 'w'), indent=0)
print(len(spec['nodes']), 'nodes', len(spec_init), 'initializers; ops', sorted({n['op'] for n in spec['nodes']}))
