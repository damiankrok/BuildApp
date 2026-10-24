"""IU-02 geometry feature vector for the classifier head: projection evidence and section cues only.

No colour, saturation or texture statistics on purpose — those describe a publisher's style, which is exactly what
IU-01's head learned instead of the projection. Every feature is a property of line segments or of thick strokes.
"""
import math
import numpy as np

from .projection import analyse
from . import section

STATES = ('ORTHOGRAPHIC_SUPPORTED', 'PERSPECTIVE_EVIDENT', 'INCONCLUSIVE', 'NOT_SINGLE_FACADE')
NAMES = ([f'state_{s}' for s in STATES]
         + [f'{f}_{k}' for f in ('h', 'v') for k in ('logN', 'enough', 'z', 'logDist', 'logDist95')]
         + ['nonParallelH', 'nonParallelV', 'radialSupport', 'radialQuadrants', 'obliqueLowerShare', 'logSegments',
            'slabBands', 'endWalls', 'hatchShare', 'pocheShare'])


def compute(rgb):
    """Projection analysis (no mask) and section cues → (feature list, raw record)."""
    p = analyse(rgb)
    c = section.cues(rgb)
    return vector(p, c), {'projection': {k: v for k, v in p.items() if k not in ('size',)}, 'section': c}


def vector(p, c):
    f = [1.0 if p.get('state') == s else 0.0 for s in STATES]
    for fam in ('horizontals', 'verticals'):
        d = p.get(fam) or {}
        f += [math.log1p(d.get('n', 0)), 1.0 if d.get('enough') else 0.0, min(50.0, d.get('z', 0.0)),
              math.log1p(min(1e4, d.get('distortionPx', 0.0))), math.log1p(min(1e4, d.get('distortionPx95', 0.0)))]
    npar = p.get('nonParallel') or {}
    rv = p.get('radial') or {}
    pl = p.get('planes') or {}
    f += [(npar.get('horizontals') or {}).get('share', 0.0), (npar.get('verticals') or {}).get('share', 0.0),
          float(rv.get('support', 0)), float(rv.get('quadrants', 0)), float(pl.get('obliqueLowerShare', 0.0)),
          math.log1p(p.get('segments', 0)),
          float(c.get('slabBands', 0)), 1.0 if c.get('endWalls') else 0.0, float(c.get('hatchShare', 0.0)), float(c.get('pocheShare', 0.0))]
    assert len(f) == len(NAMES)
    return f
