"""IU-01 pretrained visual backbones, run frozen. Weights come from a one-time preparation step (prepare_models.py);
inference never touches the network: `offline_guard()` makes every socket connect and DNS lookup raise for the whole
process, so a hidden download would fail loudly instead of passing silently.

Preprocessing keeps the WHOLE picture: the long side is resized and the short side padded (letterbox). Centre-cropping
would cut the ends off a 550x220 elevation; stretching would teach the model the aspect ratio, which 005R showed is a
shortcut (A1). The pad colour is a parameter so the metamorphic test can vary it.
"""
import os, socket
import numpy as np
from PIL import Image

WEIGHTS = os.environ.get('IU_WEIGHTS', '/home/user/workiu01/weights')

def offline_guard():
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    def refuse(*a, **k):
        raise RuntimeError('IU-01 offline guard: network access attempted during inference')
    # connect/DNS are refused at the class level, so ssl and http subclasses inherit the refusal
    socket.socket.connect = refuse  # type: ignore[method-assign]
    socket.socket.connect_ex = refuse  # type: ignore[method-assign]
    socket.create_connection = refuse  # type: ignore[assignment]
    socket.getaddrinfo = refuse  # type: ignore[assignment]

def letterbox(im: Image.Image, size: int, pad=(255, 255, 255)) -> Image.Image:
    im = im.convert('RGB')
    w, h = im.size
    s = size / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BICUBIC)
    out = Image.new('RGB', (size, size), pad)
    out.paste(im, ((size - im.size[0]) // 2, (size - im.size[1]) // 2))
    return out

def open_image(path: str) -> Image.Image:
    im = Image.open(path)
    im.seek(0)  # first frame of an animated GIF
    return im.convert('RGB')

# ---------------------------------------------------------------------------------------------------------------
# Registry: id -> (loader, input size, mean, std). Each loader returns (torch module producing an embedding, meta).
# ---------------------------------------------------------------------------------------------------------------

def _timm(name):
    import timm, torch
    m = timm.create_model(name, pretrained=True, num_classes=0, pretrained_cfg_overlay=dict(file=os.path.join(WEIGHTS, name, 'model.safetensors')))
    m.eval()
    cfg = m.pretrained_cfg
    return m, {'mean': cfg['mean'], 'std': cfg['std'], 'size': cfg['input_size'][-1]}

def _clip(arch, tag):
    import open_clip
    m, _, _ = open_clip.create_model_and_transforms(arch, pretrained=os.path.join(WEIGHTS, f'{arch}-{tag}', 'open_clip_model.safetensors'))
    m.eval()
    tok = open_clip.get_tokenizer(arch)
    class Img:
        def __init__(self, m): self.m = m
        def __call__(self, x): return self.m.encode_image(x)
    mean = getattr(m.visual, 'image_mean', None) or (0.48145466, 0.4578275, 0.40821073)
    std = getattr(m.visual, 'image_std', None) or (0.26862954, 0.26130258, 0.27577711)
    return Img(m), {'mean': mean, 'std': std, 'size': m.visual.image_size[0] if isinstance(m.visual.image_size, (tuple, list)) else m.visual.image_size, 'clip': m, 'tokenizer': tok}

BACKBONES = {
    'mobilenetv3_large_100': lambda: _timm('mobilenetv3_large_100.ra_in1k'),
    'dinov2_vits14': lambda: _timm('vit_small_patch14_dinov2.lvd142m'),
    'clip_vitb32': lambda: _clip('ViT-B-32', 'laion2b_s34b_b79k'),
}

def load(bid):
    return BACKBONES[bid]()

def to_tensor(ims, meta):
    import torch
    a = np.stack([np.asarray(i, dtype=np.float32) / 255.0 for i in ims])
    a = (a - np.array(meta['mean'], dtype=np.float32)) / np.array(meta['std'], dtype=np.float32)
    return torch.from_numpy(a.transpose(0, 3, 1, 2).copy())

def embed(model, meta, images, pad=(255, 255, 255), batch=16):
    """L2-normalised embeddings for PIL images."""
    import torch
    out = []
    with torch.inference_mode():
        for i in range(0, len(images), batch):
            x = to_tensor([letterbox(im, meta['size'], pad) for im in images[i:i + batch]], meta)
            e = model(x).float()
            out.append(torch.nn.functional.normalize(e, dim=-1).numpy())
    return np.concatenate(out) if out else np.zeros((0, 1), np.float32)
