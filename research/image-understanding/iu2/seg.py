"""IU-02 architectural segmentation: building / occluders / background, by four methods on the same image.

  CLASSIC    deterministic CV: drawings (near-uniform background) -> filled main ink component; renders/photos ->
             sky flood-filled from the top border, vegetation by excess-green and texture, ground flood-filled from
             the bottom border, the rest's main component is the building.
  SEGFORMER  SegFormer-B0 ADE20K (NVIDIA Source Code License: research only), classes mapped to building /
             occluder / background.
  UPERNET    UperNet ConvNeXt-T ADE20K (MIT card; ADE20K data terms apply), same mapping.
  SAM_*      MobileSAM (Apache-2.0 code, weights from the kornia mirror) prompted with a box and points from one of the
             above. SAM returns *masks*, not classes: which mask is "the building" is decided by the prompt, and the
             semantic labels of anything inside it come from a separate region classifier (`regions.py`).

Nothing here reconstructs what is hidden: a pixel covered by a tree stays OCCLUDER (uncertain), never "wall".
"""
import math
import numpy as np

ADE_BUILDING = {'wall', 'building', 'house', 'windowpane', 'door', 'railing', 'column', 'awning', 'skyscraper', 'tower', 'hovel', 'stairs', 'stairway', 'step', 'bannister', 'canopy', 'base'}
ADE_OCCLUDER = {'tree', 'plant', 'palm', 'flower', 'person', 'car', 'fence', 'bicycle', 'truck', 'van', 'pot', 'bench', 'streetlight', 'pole', 'signboard', 'chair', 'armchair', 'sofa', 'table', 'cushion', 'swimming pool'}
ADE_BACKGROUND = {'sky', 'grass', 'earth', 'road', 'sidewalk', 'field', 'path', 'land', 'dirt track', 'sand', 'mountain', 'hill', 'water', 'sea', 'floor', 'rug', 'river', 'lake', 'rock'}


def _np(img):
    return np.asarray(img.convert('RGB'), np.uint8) if hasattr(img, 'convert') else img


def is_drawing(rgb):
    """Near-uniform light border and low saturation: a drawing on paper, not a render with sky."""
    b = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)]).astype(np.int16)
    spread = np.percentile(b, 90, axis=0) - np.percentile(b, 10, axis=0)
    light = np.median(b) > 200
    return bool(light and spread.max() < 30)


def _fill_holes(m):
    import cv2
    h, w = m.shape
    ff = m.astype(np.uint8).copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 1)
    holes = ff == 0
    return m | holes


def _largest(m, min_frac=0.0):
    import cv2
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    if n <= 1:
        return m
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return lab == k


def classic(img):
    import cv2
    rgb = _np(img)
    h, w, _ = rgb.shape
    out = {'method': 'CLASSIC'}
    if is_drawing(rgb):
        g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        bg = np.median(np.concatenate([g[0], g[-1], g[:, 0], g[:, -1]]))
        ink = np.abs(g.astype(np.int16) - bg) > 25
        k = max(3, int(0.01 * max(h, w)))
        closed = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) > 0
        # the outline of a light wall on white paper is a thin ring: fill first, then choose the main body;
        # a ground line or a dimension line running past the walls is thin: a vertical opening removes it
        filled = _fill_holes(closed)
        kv = max(5, int(0.012 * h))
        body = cv2.morphologyEx(filled.astype(np.uint8), cv2.MORPH_OPEN, np.ones((kv, 1), np.uint8)) > 0
        bld = _largest(body if body.any() else filled)
        out.update(building=bld, occluder=np.zeros_like(bld), background=~bld, kind='DRAWING')
        return out
    sm = cv2.bilateralFilter(rgb, 9, 30, 7)
    lab = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB).astype(np.int16)
    r, g_, b = [sm[..., i].astype(np.int16) for i in range(3)]
    gray = cv2.cvtColor(sm, cv2.COLOR_RGB2GRAY)
    tex = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    tex = cv2.GaussianBlur(np.abs(tex), (0, 0), 3)
    skyish = ((b > r + 5) & (b > 120)) | ((gray > 200) & (np.abs(r - b) < 25))
    sky = np.zeros((h, w), bool)
    seeds = np.zeros((h, w), np.uint8)
    seeds[0, :] = skyish[0, :]
    # sky: connected to the top border through sky-coloured, smooth pixels
    cand = (skyish & (tex < 6)).astype(np.uint8)
    n, comp = cv2.connectedComponents(cand, 4)
    top_ids = set(np.unique(comp[0][cand[0] > 0])) - {0}
    if top_ids:
        sky = np.isin(comp, list(top_ids))
    exg = 2 * g_ - r - b
    veg = (exg > 20) & (g_ > 50)
    veg = cv2.morphologyEx(veg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    # ground: bottom-connected low-lying smooth or green region (lawn, paving)
    groundish = veg | ((tex < 5) & (gray < 200))
    n2, comp2 = cv2.connectedComponents(groundish.astype(np.uint8), 4)
    bot_ids = set(np.unique(comp2[-1][groundish[-1]])) - {0}
    ground = np.isin(comp2, list(bot_ids)) if bot_ids else np.zeros((h, w), bool)
    yy = np.arange(h)[:, None]
    ground &= yy > h * 0.5
    rest = ~(sky | ground | veg)
    rest = cv2.morphologyEx(rest.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    bld = _largest(rest)
    bld = _fill_holes(bld) & ~sky
    occ = veg & ~ground
    # trees inside the building's horizontal span and below its top are occluders, not background
    if bld.any():
        ys, xs = np.nonzero(bld)
        span = np.zeros((h, w), bool); span[ys.min():ys.max() + 1, xs.min():xs.max() + 1] = True
        occ &= span
    out.update(building=bld & ~occ, occluder=occ, background=~(bld | occ), kind='RENDER_OR_PHOTO')
    return out


class Ade:
    """SegFormer or UperNet ADE20K semantic segmentation, class map → building/occluder/background."""

    def __init__(self, path, kind):
        import torch
        from transformers import AutoImageProcessor, SegformerForSemanticSegmentation, UperNetForSemanticSegmentation
        self.proc = AutoImageProcessor.from_pretrained(path)
        cls = SegformerForSemanticSegmentation if kind == 'SEGFORMER' else UperNetForSemanticSegmentation
        self.model = cls.from_pretrained(path).eval()
        self.kind = kind
        self.labels = {int(k): v.strip() for k, v in self.model.config.id2label.items()}
        self.torch = torch

    def __call__(self, img):
        torch = self.torch
        rgb = _np(img)
        h, w, _ = rgb.shape
        s = 512 / min(h, w)
        from PIL import Image
        im = Image.fromarray(rgb).resize((max(1, round(w * s)), max(1, round(h * s))), Image.BILINEAR)
        x = self.proc(images=im, return_tensors='pt', do_resize=False)
        with torch.no_grad():
            logits = self.model(**x).logits
        up = torch.nn.functional.interpolate(logits, size=(h, w), mode='bilinear', align_corners=False)[0]
        cls = up.argmax(0).numpy()
        names = np.array([self.labels[i] for i in range(len(self.labels))])
        lab = names[cls]
        bld = np.isin(lab, list(ADE_BUILDING))
        occ = np.isin(lab, list(ADE_OCCLUDER))
        win = np.isin(lab, ['windowpane', 'door'])
        return {'method': self.kind, 'building': bld, 'occluder': occ, 'background': ~(bld | occ), 'openings': win, 'classMap': cls, 'names': list(names)}


class MobileSam:
    MEAN = np.array([123.675, 116.28, 103.53], np.float32)
    STD = np.array([58.395, 57.12, 57.375], np.float32)

    def __init__(self, checkpoint):
        import torch
        from kornia.models.sam import Sam, SamConfig
        self.torch = torch
        self.model = Sam.from_config(SamConfig(model_type='mobile_sam', checkpoint=checkpoint)).eval()
        self._cache = None

    def embed(self, rgb):
        torch = self.torch
        h, w, _ = rgb.shape
        s = 1024 / max(h, w)
        nh, nw = round(h * s), round(w * s)
        from PIL import Image
        im = np.asarray(Image.fromarray(rgb).resize((nw, nh), Image.BILINEAR), np.float32)
        x = np.zeros((1024, 1024, 3), np.float32)
        x[:nh, :nw] = (im - self.MEAN) / self.STD
        t = torch.from_numpy(x).permute(2, 0, 1)[None]
        with torch.no_grad():
            emb = self.model.image_encoder(t)
        self._cache = (emb, s, nh, nw, h, w)

    def predict(self, box=None, pos=(), neg=()):
        torch = self.torch
        emb, s, nh, nw, h, w = self._cache
        pts = [(x * s, y * s, 1) for x, y in pos] + [(x * s, y * s, 0) for x, y in neg]
        points = (torch.tensor([[p[:2] for p in pts]], dtype=torch.float32), torch.tensor([[p[2] for p in pts]], dtype=torch.float32)) if pts else None
        boxes = torch.tensor([[box[0] * s, box[1] * s, box[2] * s, box[3] * s]], dtype=torch.float32) if box is not None else None
        with torch.no_grad():
            sp, de = self.model.prompt_encoder(points=points, boxes=boxes, masks=None)
            logits, iou = self.model.mask_decoder(image_embeddings=emb, image_pe=self.model.prompt_encoder.get_dense_pe(),
                                                  sparse_prompt_embeddings=sp, dense_prompt_embeddings=de, multimask_output=True)
        up = torch.nn.functional.interpolate(logits, size=(1024, 1024), mode='bilinear', align_corners=False)[..., :nh, :nw]
        up = torch.nn.functional.interpolate(up, size=(h, w), mode='bilinear', align_corners=False)[0]
        k = int(iou[0].argmax())
        return (up[k] > 0).numpy(), float(iou[0, k])


def sam_refine(sam, img, prior, name):
    """MobileSAM prompted from a prior segmentation: box = prior building bbox, positives inside the eroded building,
    negatives in the prior's background/occluders. Occluders stay as the prior says (SAM has no classes)."""
    import cv2
    rgb = _np(img)
    b = prior['building']
    if not b.any():
        return {**prior, 'method': name}
    ys, xs = np.nonzero(b)
    box = (xs.min(), ys.min(), xs.max(), ys.max())
    er = cv2.erode(b.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
    rng = np.random.default_rng(0)
    def sample(m, k):
        yy, xx = np.nonzero(m)
        if len(xx) == 0:
            return []
        idx = rng.choice(len(xx), min(k, len(xx)), replace=False)
        return [(float(xx[i]), float(yy[i])) for i in idx]
    pos = sample(er if er.any() else b, 4)
    bgm = prior['background'] & ~cv2.dilate(b.astype(np.uint8), np.ones((25, 25), np.uint8)).astype(bool)
    neg = sample(bgm, 3) + sample(prior['occluder'], 2)
    sam.embed(rgb)
    m, q = sam.predict(box, pos, neg)
    m = m & ~prior['occluder']
    return {**prior, 'method': name, 'building': m, 'background': ~(m | prior['occluder']), 'samIou': q}


def scores(pred, gt_building, gt_occluder):
    """IoU of building and occluder masks, and the boundary error of the building (px)."""
    import cv2
    def iou(a, b):
        u = (a | b).sum()
        return float((a & b).sum() / u) if u else 1.0
    pb = pred['building']
    out = {'buildingIoU': round(iou(pb, gt_building), 4)}
    if gt_occluder.any():
        out['occluderIoU'] = round(iou(pred['occluder'], gt_occluder), 4)
    def edge(m):
        m8 = m.astype(np.uint8)
        return (m8 - cv2.erode(m8, np.ones((3, 3), np.uint8))) > 0
    eg, ep = edge(gt_building), edge(pb)
    if eg.any() and ep.any():
        dt = cv2.distanceTransform((~eg).astype(np.uint8), cv2.DIST_L2, 3)
        d = dt[ep]
        out['boundaryMedianPx'] = round(float(np.median(d)), 2)
        out['boundaryP95Px'] = round(float(np.percentile(d, 95)), 2)
    return out
