"""IU-01 approach B0: CLIP zero-shot (no training at all). Prompt ensembles per class; the image embedding is
compared to the mean text embedding. Reported as a reference for what a pretrained model knows unaided."""
import numpy as np
from .classes import CLASSES

PROMPTS = {
    'FLOOR_PLAN': ['an architectural floor plan of a house', 'a black and white floor plan drawing with rooms and walls', 'a technical drawing of a house layout seen from above'],
    'ORTHOGRAPHIC_ELEVATION': ['a flat frontal elevation view of a house facade', 'an orthographic elevation of a building with no perspective', 'a straight-on side view of a house, facade elevation'],
    'TECHNICAL_SECTION': ['an architectural cross section drawing of a house', 'a technical section drawing showing floors and roof structure', 'a black and white building section with heights'],
    'EXTERIOR_PERSPECTIVE': ['a 3d rendering of a house exterior seen from an angle', 'a perspective photo of a house with garden', 'an exterior visualization of a modern house'],
    'INTERIOR_PERSPECTIVE': ['an interior of a living room', 'a photo of a kitchen interior', 'a rendering of a bathroom interior'],
    'SITE_PLAN': ['a site plan of a house on a plot seen from above', 'a top view of a roof on a green lot with dimensions', 'an architectural site plan'],
    'ARCHITECTURAL_DETAIL': ['an architectural construction detail drawing', 'a detailed technical drawing of a building joint', 'a construction detail section with materials'],
    'OTHER': ['a collage of several pictures', 'a logo or icon', 'a photo that is not of a building'],
}

def text_matrix(clip_meta):
    import torch
    m, tok = clip_meta['clip'], clip_meta['tokenizer']
    rows = []
    with torch.inference_mode():
        for c in CLASSES:
            t = m.encode_text(tok(PROMPTS[c])).float()
            t = torch.nn.functional.normalize(t, dim=-1).mean(0)
            rows.append(torch.nn.functional.normalize(t, dim=0).numpy())
    return np.stack(rows)

def logits(img_emb, text_mat, scale=100.0):
    return scale * img_emb @ text_mat.T
