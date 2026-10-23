"""IU-01 synthetic derivatives, built ONLY from images of the same split (no cross-split leakage).

  collage2x2 / collage1x2  -> OTHER        (a sheet of several pictures is not one view)
  simplified_line          -> ORTHOGRAPHIC_ELEVATION, style SIMPLIFIED (edge drawing of a rendered elevation:
                              the nearest offline stand-in for OWNER's simplified elevations, which are not in the corpus)
  simplified_flat          -> ORTHOGRAPHIC_ELEVATION, style SIMPLIFIED (posterised, sky/trees flattened)
  resize400 / resize1200   -> unchanged label (resolution copies; test-time consistency only)
All derivatives inherit the project of their parent(s); a collage takes the project of its first tile.
"""
import hashlib, io, random
import numpy as np
from PIL import Image, ImageFilter, ImageOps

def _sha(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return hashlib.sha256(b.getvalue()).hexdigest()

def collage(ims, grid):
    cols, rows = grid
    W, H = 400 * cols, 300 * rows
    out = Image.new('RGB', (W, H), 'white')
    for k, im in enumerate(ims[:cols * rows]):
        t = im.copy(); t.thumbnail((392, 292))
        x, y = (k % cols) * 400 + (400 - t.size[0]) // 2, (k // cols) * 300 + (300 - t.size[1]) // 2
        out.paste(t, (x, y))
    return out

def simplified_line(im):
    g = ImageOps.grayscale(im)
    e = g.filter(ImageFilter.FIND_EDGES)
    a = np.asarray(e, dtype=np.float32)
    thr = np.percentile(a, 90)
    line = np.where(a > thr, 0, 255).astype(np.uint8)
    return Image.fromarray(line).convert('RGB')

def simplified_flat(im):
    return ImageOps.posterize(im.filter(ImageFilter.ModeFilter(7)), 2)

def resize_long(im, n):
    w, h = im.size; s = n / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BICUBIC)

def build(rows, open_image, seed, n_collage=40):
    """rows: labelled rows of ONE split with 'path'. Returns derived (row, PIL image) pairs."""
    rnd = random.Random(seed)
    out = []
    pool = [r for r in rows if r['path']]
    for k in range(n_collage):
        grid = (2, 2) if k % 2 == 0 else (2, 1)
        picks = rnd.sample(pool, grid[0] * grid[1])
        im = collage([open_image(p['path']) for p in picks], grid)
        out.append(({'sha256': _sha(im), 'label': 'OTHER', 'derived': 'collage2x2' if grid == (2, 2) else 'collage1x2', 'project': picks[0]['project'], 'split': picks[0]['split'], 'parents': [p['sha256'] for p in picks]}, im))
    for r in pool:
        if r['label'] == 'ORTHOGRAPHIC_ELEVATION' and rnd.random() < 0.35:
            src = open_image(r['path'])
            for kind, f in (('simplified_line', simplified_line), ('simplified_flat', simplified_flat)):
                im = f(src)
                out.append(({'sha256': _sha(im), 'label': 'ORTHOGRAPHIC_ELEVATION', 'elevationStyle': 'SIMPLIFIED', 'derived': kind, 'project': r['project'], 'split': r['split'], 'parents': [r['sha256']]}, im))
    return out
