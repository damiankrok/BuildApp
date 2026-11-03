import torch, timm, hashlib, sys
name = sys.argv[1]; out = sys.argv[2]
m = timm.create_model(name, pretrained=True, num_classes=0).eval()
x = torch.zeros(1, 3, 224, 224)
torch.onnx.export(m, x, out, input_names=['image'], output_names=['embedding'], opset_version=17, dynamo=False)
print(name, sum(p.numel() for p in m.parameters()), hashlib.sha256(open(out, 'rb').read()).hexdigest(), m(x).shape)
print(timm.data.resolve_data_config({}, model=m))
