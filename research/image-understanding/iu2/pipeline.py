"""IU-02 per-image pipeline: segment → projection test inside the building → (if a single orthographic facade)
clean facade. Pure function of the pixels and the frozen models; the semantic class comes from `classify.py`.

Segmenter choice is by the image, not by its publisher: a drawing (near-uniform light border, low saturation)
goes to the classical segmenter, which is exact on line work; a render or photograph goes to an ADE20K model
(UperNet by default — MIT; SegFormer-B0 only for comparison, its licence is research-only).
"""
import hashlib, io, time
import numpy as np
from PIL import Image, ImageOps

from . import seg as segm
from . import clean as cl
from .projection import analyse

_MODELS = {}


def models(weights_dir, which=('UPERNET',)):
    for w in which:
        if w in _MODELS:
            continue
        if w == 'UPERNET':
            _MODELS[w] = segm.Ade(f'{weights_dir}/openmmlab_upernet-convnext-tiny', 'UPERNET')
        elif w == 'SEGFORMER':
            _MODELS[w] = segm.Ade(f'{weights_dir}/nvidia_segformer-b0-finetuned-ade-512-512', 'SEGFORMER')
        elif w == 'SAM':
            _MODELS[w] = segm.MobileSam(f'{weights_dir}/mobile_sam.pt')
    return _MODELS


def load(path_or_bytes):
    """Decode, apply EXIF orientation (recorded), RGB. Returns (rgb, meta)."""
    b = path_or_bytes if isinstance(path_or_bytes, (bytes, bytearray)) else open(path_or_bytes, 'rb').read()
    im = Image.open(io.BytesIO(b))
    orient = 1
    try:
        orient = int(im.getexif().get(274, 1))
    except Exception as e:  # a broken EXIF block is recorded, not fatal: orientation then stays 1
        orient = -1
    im = ImageOps.exif_transpose(im).convert('RGB')
    meta = {'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b), 'width': im.size[0], 'height': im.size[1],
            'aspect': round(im.size[0] / im.size[1], 4), 'exifOrientation': orient}
    return np.asarray(im), meta


def segment(rgb, weights_dir, which='UPERNET'):
    if segm.is_drawing(rgb):
        return segm.classic(rgb)
    return models(weights_dir, (which,))[which](rgb)


def run(rgb, meta, weights_dir, segmenter='UPERNET', do_clean=True, ground_line=False):
    t0 = time.time()
    s = segment(rgb, weights_dir, segmenter)
    t1 = time.time()
    filled, _ = cl.building_support(s)
    p = analyse(rgb, mask=filled if filled.any() else None)
    t2 = time.time()
    out = {'meta': meta, 'segmenter': s['method'], 'projection': p, 'timing': {'segmentS': round(t1 - t0, 3), 'projectionS': round(t2 - t1, 3)}}
    if do_clean:
        arrays, transform = cl.clean(rgb, s, p['state'], meta, ground_line=ground_line)
        out['timing']['cleanS'] = round(time.time() - t2, 3)
        out['arrays'] = arrays
        out['transform'] = transform
    out['seg'] = s
    return out
