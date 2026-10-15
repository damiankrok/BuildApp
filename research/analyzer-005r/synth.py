#!/usr/bin/env python3
"""
synth.py - BUILDPLAN-ANALYZER-005R synthetic known-truth architectural images (RESEARCH ONLY; never imported by
production).

    python3 -I research/analyzer-005r/synth.py <out-dir> [--seed 5005] [--houses 12]

What this is. A deterministic generator of SYNTHETIC drawings and renders of INVENTED houses. Every dimension, colour
and assembly is drawn from a seeded RNG (numpy.random.default_rng([seed, houseIndex])); nothing here is a
reconstruction of, or traced from, any real project or publisher image, and the script reads no file except itself
(for its own sha256) and fetches nothing. It exists to test (a) image-asset routing (role, projection, view side,
lineage, edition pairing) and (b) exterior-feature detectors, against exact pixel-box truth and hard look-alike
negatives. Same arguments -> byte-identical PNGs, truth.json and manifest.json.

Outputs: <out>/images/<syntheticId>.png, <out>/truth.json (houses, images, editionPairs, semantics) and
<out>/manifest.json (sha256 of every PNG and of truth.json, the generator's own sha256, seed and house count).

Per family (synthetic-family-NN, edition synthetic:fNN-e1): 4 orthographic TECHNICAL_ELEVATIONs (FRONT/REAR/LEFT/
RIGHT), 2 perspective EXTERIOR_RENDERs (one front-oblique, one rear-oblique corner), FLOOR_PLAN, SECTION, SITE_PLAN,
INTERIOR_RENDER, and 3 lineage variants (mirror of the front elevation, a crop of the front-oblique render that loses
at least one feature, a 0.5x downscale of the rear-oblique render). Up to 3 families get an edition e2 that differs
from e1 by exactly one assembly swap (elevations, renders, plan, section, site plan only). Two DETAIL close-ups
(a railing, a window) are rendered once for the whole corpus.

Geometry (metres): Y up; the house body occupies x in [0,W], z in [-D,0]; the FRONT facade is the plane z=0 facing +z.
LEFT/RIGHT are the viewer's left/right when facing the front (LEFT = plane x=0, RIGHT = plane x=W). An oblique view
side names the two facades it shows (FRONT_LEFT_OBLIQUE = camera in front of and left of the house).

Truth semantics.
  * Elevations, exterior renders and details are rendered from one 3D scene of axis-aligned boxes and planar polygons
    with a z-buffer and a primitive-id buffer. Occlusion IS modelled: a feature's `box` is the axis-aligned bounding
    box [x0,y0,x1,y1) (inclusive-exclusive, pixels) of the pixels where one of the feature's primitives won the depth
    test, padded by 1 px on every side for the outline stroke and clipped to the image.
  * `visibility` is FULL, or PARTIAL with `partialReasons` CLIPPED (some projected part lies outside the image or
    behind the near plane) and/or OCCLUDED (visible pixels < 98% of the pixels the feature's own primitives cover in
    the image; self-occlusion inside one feature does not count). `visibleFraction` = visible / covered-in-image.
  * A feature or look-alike with zero visible pixels is not listed in `features`/`lookalikes`; it is listed in
    `hiddenFeatures` (present in the house, not visible in this view).
  * Features share their parent's `assemblyId`: the posts of a covered terrace, carport, pergola or entrance canopy
    are COLUMN_POST features (one per post, `part` = post index) and a balcony's or loggia's balusters are its RAILING;
    the garage door shares the closed garage's id. Pergola posts are COLUMN_POSTs too.
  * `lookalikes` are hard negatives: `kind` names what is drawn, `isNot` the feature classes it resembles but is not.
    A look-alike can coincide with a positive of another class (the solid slab of a covered terrace is a
    COVERED_TERRACE and also a SOLID_ROOFED_CANOPY look-alike for PERGOLA_OPEN).
  * `absentKinds` is house-level and certain: the generator placed no assembly of that kind anywhere in the house.
    For INTERIOR_RENDER it lists every exterior kind, since an interior view is not facade evidence.
  * FLOOR_PLAN, SECTION and SITE_PLAN carry `featuresAnnotated: false` and empty feature lists: they are routing
    fixtures, not detector truth.
  * Lineage: mirror flips boxes about the vertical centre line; downscale maps [x0,y0,x1,y1) to
    [floor(x0/2), floor(y0/2), ceil(x1/2), ceil(y1/2)); a crop recomputes truth from the parent's id buffer inside
    the crop window and lists the parent features it removed in `excludedByCrop`.
Limitations: no shadows, textures or anti-aliasing; balusters thinner than ~1 px can drop out at small scale; plans,
sections and site plans are schematic and not consistent with a structural design; label "text" is dashes.
"""
import argparse
import hashlib
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

STAGE = 'BUILDPLAN-ANALYZER-005R'
KINDS = ('TERRACE_AT_GRADE', 'COVERED_TERRACE', 'PERGOLA_OPEN', 'CANOPY_ENTRANCE', 'CARPORT', 'BALCONY', 'LOGGIA',
         'RAILING', 'COLUMN_POST', 'EXTERIOR_STEPS', 'GARAGE_DOOR', 'WINDOW', 'EXTERIOR_DOOR')
LOOKALIKES = {'CLOSED_GARAGE': ('CARPORT',), 'SOLID_ROOFED_CANOPY': ('PERGOLA_OPEN',),
              'EAVES_OVERHANG': ('CANOPY_ENTRANCE',), 'TERRACE_BELOW_WINDOW': ('BALCONY',),
              'SOLID_PARAPET': ('RAILING',), 'PARKING_BAY': ('CARPORT', 'GARAGE_DOOR'),
              'DARK_WINDOW_NEAR_GARAGE': ('GARAGE_DOOR',)}
LA_ORDER = tuple(LOOKALIKES)
FEATURE_ROT = ('PERGOLA_OPEN', 'COVERED_TERRACE', 'CARPORT', 'BALCONY', 'LOGGIA', 'CANOPY_ENTRANCE')
REAR_KINDS = ('TERRACE_AT_GRADE', 'COVERED_TERRACE', 'PERGOLA_OPEN')
OBLIQUE = {'FRONT_LEFT_OBLIQUE': (-1, 1), 'FRONT_RIGHT_OBLIQUE': (1, 1),
           'REAR_LEFT_OBLIQUE': (-1, -1), 'REAR_RIGHT_OBLIQUE': (1, -1)}
FACADE_N = {'FRONT': (0, 0, 1), 'REAR': (0, 0, -1), 'LEFT': (-1, 0, 0), 'RIGHT': (1, 0, 0)}
MOUNTED = ('WINDOW', 'EXTERIOR_DOOR', 'GARAGE_DOOR', 'DARK_WINDOW_NEAR_GARAGE')
EDGE_ON_COS, MIN_SIDE_PX, MIN_PIXELS = 0.2, 3, 12
ORTHO_FWD = {'FRONT': (0, 0, -1), 'REAR': (0, 0, 1), 'LEFT': (1, 0, 0), 'RIGHT': (-1, 0, 0)}
STOREY, OVERHANG, GARAGE_W, SIDE_DEPTH = 3.0, 0.4, 4.2, 6.0
WALLS = ((238, 230, 214), (243, 239, 231), (228, 224, 216), (240, 228, 208), (224, 230, 232))
ROOFS = ((152, 72, 56), (92, 92, 98), (122, 86, 60), (72, 78, 88))
ELEV_SIZE, RENDER_SIZE, PLAN_SIZE, SECTION_SIZE, SITE_SIZE, DETAIL_SIZE = \
    (1280, 512), (1280, 853), (1200, 900), (1280, 640), (1024, 1024), (1024, 768)


def unit(*v):
    a = np.array(v, float)
    return a / np.linalg.norm(a)


LIGHT = unit(-0.45, 0.8, 0.4)


def mix(c, d, t):
    return tuple(int(round(a * (1 - t) + b * t)) for a, b in zip(c, d))


# ----------------------------------------------------------------------------------------------- parameters

def free_slots(lo, hi, blocked):
    segs = [(lo, hi)]
    for b0, b1 in sorted(blocked):
        nxt = []
        for s0, s1 in segs:
            if b1 <= s0 or b0 >= s1:
                nxt.append((s0, s1))
                continue
            if b0 > s0:
                nxt.append((s0, b0))
            if b1 < s1:
                nxt.append((b1, s1))
        segs = nxt
    return segs


def place(rng, segs, gap=0.7):
    out = []
    for s0, s1 in segs:
        w = float(rng.uniform(0.8, 1.6))
        k = min(int((s1 - s0 - gap) // (w + gap)), int(rng.integers(1, 4)))
        if k < 1:
            continue
        g = (s1 - s0 - k * w) / (k + 1)
        out += [(round(s0 + g + j * (w + g), 3), round(s0 + g + j * (w + g) + w, 3)) for j in range(k)]
    return out


def draw_params(seed, i):
    rng = np.random.default_rng([seed, i])
    u = lambda a, b: round(float(rng.uniform(a, b)), 2)
    ch = dict(storeys=int(rng.integers(1, 3)), roof=str(rng.choice(['GABLE', 'HIP', 'FLAT'])),
              steps=bool(rng.random() < 0.6), canopy=bool(rng.random() < 0.5), canopyPosts=bool(rng.random() < 0.5),
              side=str(rng.choice(['NONE', 'CARPORT', 'GARAGE'], p=[0.3, 0.35, 0.35])),
              darkWindow=bool(rng.random() < 0.6), parking=bool(rng.random() < 0.4),
              balcony=bool(rng.random() < 0.7), loggia=bool(rng.random() < 0.5),
              balconyGuard=str(rng.choice(['RAILING', 'PARAPET'], p=[0.7, 0.3])))
    rear = [str(k) for k in rng.permutation(list(REAR_KINDS))][:int(rng.integers(0, 3))]
    forced = [FEATURE_ROT[i % len(FEATURE_ROT)], LA_ORDER[i % 7], LA_ORDER[(i + 3) % 7]]
    # coverage schedule: look-alike requirements are applied last and win; CLOSED_GARAGE is not forced on its own
    # (every forced DARK_WINDOW_NEAR_GARAGE brings a closed garage) so that carports are not crowded out
    for f in forced:
        if f in ('PERGOLA_OPEN', 'COVERED_TERRACE', 'SOLID_ROOFED_CANOPY', 'TERRACE_BELOW_WINDOW'):
            rear.insert(0, {'SOLID_ROOFED_CANOPY': 'COVERED_TERRACE', 'TERRACE_BELOW_WINDOW': 'TERRACE_AT_GRADE'}.get(f, f))
        if f in ('BALCONY', 'LOGGIA', 'TERRACE_BELOW_WINDOW'):
            ch['storeys'] = 2
        ch.update({'CARPORT': dict(side='CARPORT'), 'BALCONY': dict(balcony=True), 'LOGGIA': dict(loggia=True),
                   'CANOPY_ENTRANCE': dict(canopy=True),
                   'SOLID_PARAPET': dict(roof='FLAT'), 'PARKING_BAY': dict(parking=True),
                   'DARK_WINDOW_NEAR_GARAGE': dict(side='GARAGE', darkWindow=True)}.get(f, {}))
        if f == 'EAVES_OVERHANG':
            ch.update(storeys=1, canopy=False, roof='GABLE' if ch['roof'] == 'FLAT' else ch['roof'])
    if ch['side'] != 'GARAGE':
        ch['darkWindow'] = False
    if ch['storeys'] == 1:
        ch['balcony'] = ch['loggia'] = False
    rear = list(dict.fromkeys(rear))[:2]
    if ch['roof'] == 'HIP':
        D = u(7, 11); W = u(max(8.0, D + 0.8), 16)
    else:
        W = u(8, 16); D = u(7, 12)
    nsteps = int(rng.integers(2, 5)) if ch['steps'] else 0
    ffl = round(0.16 * nsteps, 2)
    H1 = ffl + STOREY
    T = W / 3
    dw = u(1.0, 1.2); xc = W / 2 + u(-T / 4, T / 4)
    door = (round(xc - dw / 2, 2), round(xc + dw / 2, 2))
    slots = [(0.5, T - 0.2), (2 * T + 0.2, W - 0.5)]
    if rng.random() < 0.5:
        slots.reverse()

    def centred(slot, w):
        w = min(w, slot[1] - slot[0]); c = (slot[0] + slot[1]) / 2
        return round(c - w / 2, 2), round(c + w / 2, 2)
    balcony = centred(slots[0], u(2.2, 3.4)) if ch['balcony'] else None
    loggia = centred(slots[1], u(2.2, 3.0)) if ch['loggia'] else None
    rear_items = []
    if len(rear) == 1:
        w = u(3.0, min(6.0, W - 1.0)); x0 = u(0.5, W - 0.5 - w)
        rear_items = [dict(kind=rear[0], x0=x0, x1=round(x0 + w, 2), dep=u(2.5, 3.5))]
    elif len(rear) == 2:
        rear_items = [dict(kind=rear[0], x0=0.4, x1=round(W / 2 - 0.2, 2), dep=u(2.5, 3.5)),
                      dict(kind=rear[1], x0=round(W / 2 + 0.2, 2), x1=round(W - 0.4, 2), dep=u(2.5, 3.5))]
    wins = []

    def add(facade, storey, spans, tall=False):
        base = ffl if storey == 0 else H1
        for a0, a1 in spans:
            wins.append(dict(facade=facade, storey=storey, a0=a0, a1=a1, y0=round(base + (0.5 if tall else 0.9), 2),
                             y1=round(base + 2.1, 2)))
    add('FRONT', 0, place(rng, free_slots(0.6, W - 0.6, [(door[0] - 0.9, door[1] + 0.9)])))
    if ch['storeys'] == 2:
        blocked = []
        if balcony:
            blocked.append((balcony[0] - 0.3, balcony[1] + 0.3))
            add('FRONT', 1, [centred(balcony, min(1.4, balcony[1] - balcony[0] - 0.6))], tall=True)
        if loggia:
            blocked.append((loggia[0] - 0.3, loggia[1] + 0.3))
        add('FRONT', 1, place(rng, free_slots(0.6, W - 0.6, blocked)))
    add('REAR', 0, place(rng, free_slots(0.6, W - 0.6, [])))
    if ch['storeys'] == 2:
        blocked = []
        for r in rear_items:
            if r['kind'] == 'TERRACE_AT_GRADE':
                span = centred((r['x0'], r['x1']), 1.2)
                add('REAR', 1, [span]); blocked.append((span[0] - 0.6, span[1] + 0.6))
        add('REAR', 1, place(rng, free_slots(0.6, W - 0.6, blocked)))
    for s in range(ch['storeys']):
        add('LEFT', s, place(rng, free_slots(0.6, D - 0.6, [])))
        lo = SIDE_DEPTH + 0.6 if (s == 0 and ch['side'] != 'NONE') else 0.6
        add('RIGHT', s, place(rng, free_slots(lo, D - 0.6, [])) if lo < D - 1.4 else [])
    for k, w in enumerate(wins):
        w['id'] = 'win-%02d' % (k + 1)
    return dict(index=i, family=i + 1, edition=1, W=W, D=D, storeys=ch['storeys'], roof=ch['roof'], pitchDeg=u(30, 42),
                ffl=ffl, nsteps=nsteps, door=door, canopy=ch['canopy'], canopyPosts=ch['canopyPosts'],
                side=ch['side'], darkWindow=ch['darkWindow'], parking=ch['parking'], balcony=balcony,
                balconyGuard=ch['balconyGuard'], loggia=loggia, rear=rear_items, windows=wins,
                wall=list(WALLS[int(rng.integers(len(WALLS)))]), roofRgb=list(ROOFS[int(rng.integers(len(ROOFS)))]),
                frameDark=bool(rng.random() < 0.4), forced=forced,
                cam=dict(front=str(rng.choice(['FRONT_LEFT_OBLIQUE', 'FRONT_RIGHT_OBLIQUE'])),
                         rear=str(rng.choice(['REAR_LEFT_OBLIQUE', 'REAR_RIGHT_OBLIQUE'])),
                         az=u(32, 52), h=u(1.7, 4.5), fov=u(50, 60)),
                plan=dict(split=u(0.4, 0.6), zl=u(0.35, 0.65), zr=u(0.3, 0.7)),
                site=dict(north=u(-40, 40), trees=[[u(0, 1), u(0, 1), u(1.5, 3.2)] for _ in range(int(rng.integers(4, 9)))]),
                interior=dict(w=u(4.5, 6.5), d=u(4.0, 5.5), win=u(1.2, 2.0), yaw=u(-14, 14), sofaLeft=bool(rng.random() < 0.5),
                              wall=list(mix(WALLS[int(rng.integers(len(WALLS)))], (255, 255, 255), 0.2))))


# ----------------------------------------------------------------------------------------------- scene

def newell(v):
    n = np.zeros(3)
    for a, b in zip(v, np.roll(v, -1, 0)):
        n += ((a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1]))
    return n / np.linalg.norm(n)


def clip(poly, n, c):
    """Convex polygon (k,3) clipped to the half-space n.p <= c."""
    out = []
    for a, b in zip(poly, np.roll(poly, -1, 0)):
        da, db = a @ n - c, b @ n - c
        if da <= 0:
            out.append(a)
        if da < 0 < db or db < 0 < da:
            out.append(a + (b - a) * (da / (da - db)))
    return np.array(out).reshape(-1, 3)


class Scene:
    def __init__(self, mats):
        self.mats, self.faces, self.prims, self.tags, self._tag, self._key, self.host = mats, [], [], [], {}, {}, {}

    def mount(self, prim, facade, anchor):
        """Record the host facade of the facade-mounted features of a primitive (for the EDGE_ON rule)."""
        for t in self.prims[prim]:
            if self.tags[t][1] in MOUNTED:
                self.host[t] = (np.array(FACADE_N[facade], float), np.asarray(anchor, float))

    def prim(self, *tags):
        ids = []
        for t in tags:
            if t not in self._tag:
                self._tag[t] = len(self.tags); self.tags.append(t)
            ids.append(self._tag[t])
        self.prims.append(tuple(ids))
        return len(self.prims) - 1

    def face(self, verts, mat, prim, group=None, cull=False, n=None):
        v = np.asarray(verts, float)
        if len(v) < 3:
            return
        n = newell(v) if n is None else np.asarray(n, float)
        key = (group or ('p', prim), tuple(float(x) + 0.0 for x in np.round(n, 3)), round(float(n @ v[0]), 3) + 0.0)
        self.faces.append((v, n, prim, self._key.setdefault(key, len(self._key)), mat, cull))

    def box(self, lo, hi, mat, prim, group=None):
        (x0, y0, z0), (x1, y1, z1) = lo, hi
        c = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for idx, n in (((0, 4, 7, 3), (-1, 0, 0)), ((1, 2, 6, 5), (1, 0, 0)), ((0, 1, 5, 4), (0, -1, 0)),
                       ((3, 7, 6, 2), (0, 1, 0)), ((0, 3, 2, 1), (0, 0, -1)), ((4, 5, 6, 7), (0, 0, 1))):
            self.face([c[k] for k in idx], mat, prim, group, True, n)

    def verts(self):
        return np.concatenate([f[0] for f in self.faces])


def materials(p):
    wall, roof = tuple(p['wall']), tuple(p['roofRgb'])
    frame = (64, 66, 70) if p['frameDark'] else (246, 246, 244)
    W = (255, 255, 255)
    return {'wall': (wall, mix(wall, W, 0.55)), 'recess': (mix(wall, (0, 0, 0), 0.3), mix(wall, (90, 90, 90), 0.35)),
            'roof': (roof, mix(roof, W, 0.55)), 'frame': (frame, mix(frame, W, 0.5)), 'glass': ((150, 178, 202), (212, 228, 242)),
            'darkglass': ((36, 40, 46), (70, 74, 80)), 'door': ((116, 78, 52), (205, 186, 166)),
            'paving': ((190, 184, 172), (228, 224, 216)), 'park': ((148, 148, 146), (214, 214, 212)),
            'slab': ((214, 212, 206), (236, 236, 232)), 'wood': ((152, 116, 80), (224, 206, 186)),
            'metal': ((60, 62, 66), (40, 40, 40)), 'gdoor': ((216, 216, 210), (242, 242, 238)), 'rib': ((150, 150, 148), (120, 120, 120)),
            'floor': ((176, 138, 98), (176, 138, 98)), 'ceil': ((246, 246, 244), (246, 246, 244)),
            'iwall': (tuple(p['interior']['wall']), tuple(p['interior']['wall'])), 'sofa': ((96, 112, 140), (96, 112, 140)),
            'table': ((120, 90, 62), (120, 90, 62)), 'rug': ((196, 176, 150), (196, 176, 150))}


def fbox(p, facade, a0, a1, y0, y1, d0, d1):
    """Box on a facade: a along the facade, y up, d outward from the wall plane."""
    W, D = p['W'], p['D']
    if facade == 'FRONT':
        return (a0, y0, d0), (a1, y1, d1)
    if facade == 'REAR':
        return (a0, y0, -D - d1), (a1, y1, -D - d0)
    if facade == 'LEFT':
        return (-d1, y0, -a1), (-d0, y1, -a0)
    return (W + d0, y0, -a1), (W + d1, y1, -a0)


def rail_run(sc, pr, xa, za, xb, zb, y0, h=1.0, t=0.04, step=0.12):
    n = max(1, int(round((abs(xb - xa) + abs(zb - za)) / step)))
    for j in range(n + 1):
        x, z = xa + (xb - xa) * j / n, za + (zb - za) * j / n
        sc.box((x - t / 2, y0, z - t / 2), (x + t / 2, y0 + h, z + t / 2), 'metal', pr)
    sc.box((min(xa, xb) - t, y0 + h - 0.05, min(za, zb) - t), (max(xa, xb) + t, y0 + h, max(za, zb) + t), 'metal', pr)


def window(sc, p, w, *extra):
    pr = sc.prim(('F', 'WINDOW', w['id'], None), *extra)
    f, a0, a1, y0, y1, b = w['facade'], w['a0'], w['a1'], w['y0'], w['y1'], w.get('plane', 0.0)
    sc.box(*fbox(p, f, a0, a1, y0, y1, b, b + 0.05), 'frame', pr)
    sc.box(*fbox(p, f, a0 + 0.07, a1 - 0.07, y0 + 0.07, y1 - 0.07, b + 0.05, b + 0.07), 'darkglass' if w.get('dark') else 'glass', pr)
    if a1 - a0 >= 1.2:
        m = (a0 + a1) / 2
        sc.box(*fbox(p, f, m - 0.035, m + 0.035, y0 + 0.07, y1 - 0.07, b + 0.07, b + 0.08), 'frame', pr)
    sc.box(*fbox(p, f, a0 - 0.05, a1 + 0.05, y0 - 0.06, y0, b, b + 0.1), 'frame', pr)
    lo, hi = fbox(p, f, a0, a1, y0, y1, b, b)
    sc.mount(pr, f, (np.array(lo) + np.array(hi)) / 2)


def posts(sc, aid, pts, y0, y1, mat, extra, t=0.14):
    for k, (x, z) in enumerate(pts):
        pr = sc.prim(('F', 'COLUMN_POST', aid, k + 1), *extra)
        sc.box((x - t / 2, y0, z - t / 2), (x + t / 2, y1, z + t / 2), mat, pr)


def build(p):
    sc = Scene(materials(p))
    W, D, ffl, o = p['W'], p['D'], p['ffl'], OVERHANG
    H1, Ht = ffl + STOREY, ffl + STOREY * p['storeys']
    xd0, xd1 = p['door']
    body = sc.prim()
    if p['loggia']:
        lx0, lx1 = p['loggia']; ld, lh = 1.2, H1 + 2.5
        for lo, hi in (((0, 0, -D), (W, H1, 0)), ((0, H1, -D), (W, Ht, -ld)), ((0, H1, -ld), (lx0, Ht, 0)),
                       ((lx1, H1, -ld), (W, Ht, 0)), ((lx0, lh, -ld), (lx1, Ht, 0))):
            sc.box(lo, hi, 'wall', body, 'wall')
        lg = ('F', 'LOGGIA', 'loggia-1', None)
        pr = sc.prim(lg)
        for lo, hi in (((lx0, H1, -ld), (lx1, lh, -ld + 0.01)), ((lx0, H1, -ld), (lx1, H1 + 0.01, 0)),
                       ((lx0, H1, -ld), (lx0 + 0.01, lh, 0)), ((lx1 - 0.01, H1, -ld), (lx1, lh, 0)), ((lx0, lh - 0.01, -ld), (lx1, lh, 0))):
            sc.box(lo, hi, 'recess', pr)
        rail_run(sc, sc.prim(('F', 'RAILING', 'loggia-1', None), lg), lx0 + 0.05, -0.08, lx1 - 0.05, -0.08, H1 + 0.01)
        window(sc, p, dict(id='win-l1', facade='FRONT', a0=round((lx0 + lx1) / 2 - 0.6, 2), a1=round((lx0 + lx1) / 2 + 0.6, 2),
                           y0=H1 + 0.5, y1=H1 + 2.1, plane=-ld + 0.01), lg)
    else:
        sc.box((0, 0, -D), (W, Ht, 0), 'wall', body, 'wall')
    # roof
    if p['roof'] == 'FLAT':
        sc.box((-0.1, Ht, -D - 0.1), (W + 0.1, Ht + 0.3, 0.1), 'roof', sc.prim(), 'roofslab')
        pr = sc.prim(('L', 'SOLID_PARAPET', 'parapet-roof', None))
        for lo, hi in (((-0.1, 0, -0.1), (W + 0.1, 0, 0.1)), ((-0.1, 0, -D - 0.1), (W + 0.1, 0, -D + 0.1)),
                       ((-0.1, 0, -D + 0.1), (0.1, 0, -0.1)), ((W - 0.1, 0, -D + 0.1), (W + 0.1, 0, -0.1))):
            sc.box((lo[0], Ht + 0.3, lo[2]), (hi[0], Ht + 0.9, hi[2]), 'wall', pr, 'parapet')
    else:
        tp = math.tan(math.radians(p['pitchDeg'])); ye, Hr, th, a = Ht - o * tp, Ht + D / 2 * tp, 0.2, D / 2
        rp = sc.prim()
        if p['roof'] == 'GABLE':
            front = [(-o, ye, o), (W + o, ye, o), (W + o, Hr, -a), (-o, Hr, -a)]
            rest = [[(-o, ye, -D - o), (W + o, ye, -D - o), (W + o, Hr, -a), (-o, Hr, -a)]]
            for x, nx in ((0, -1), (W, 1)):
                sc.face([(x, Ht, 0), (x, Ht, -D), (x, Hr, -a)], 'wall', body, 'wall', False, (nx, 0, 0))
                xv = x + nx * o
                for ze in (o, -D - o):
                    sc.face([(xv, ye, ze), (xv, Hr, -a), (xv, Hr - th, -a), (xv, ye - th, ze)], 'roof', rp, 'fascia')
            fascias = [[(-o, ye - th, -D - o), (W + o, ye - th, -D - o), (W + o, ye, -D - o), (-o, ye, -D - o)]]
        else:
            front = [(-o, ye, o), (W + o, ye, o), (W - a, Hr, -a), (a, Hr, -a)]
            rest = [[(-o, ye, -D - o), (W + o, ye, -D - o), (W - a, Hr, -a), (a, Hr, -a)],
                    [(-o, ye, o), (-o, ye, -D - o), (a, Hr, -a)], [(W + o, ye, o), (W + o, ye, -D - o), (W - a, Hr, -a)]]
            fascias = [[(-o, ye - th, -D - o), (W + o, ye - th, -D - o), (W + o, ye, -D - o), (-o, ye, -D - o)],
                       [(-o, ye - th, o), (-o, ye - th, -D - o), (-o, ye, -D - o), (-o, ye, o)],
                       [(W + o, ye - th, o), (W + o, ye - th, -D - o), (W + o, ye, -D - o), (W + o, ye, o)]]
        for poly in rest:
            sc.face(poly, 'roof', rp, 'roof')
        for poly in fascias:
            sc.face(poly, 'roof', rp, 'fascia')
        ffront = np.array([(-o, ye - th, o), (W + o, ye - th, o), (W + o, ye, o), (-o, ye, o)], float)
        front = np.array(front, float)
        if p['canopy']:
            sc.face(front, 'roof', rp, 'roof'); sc.face(ffront, 'roof', rp, 'fascia')
        else:  # the eaves strip above the entrance is its own primitive: an EAVES_OVERHANG look-alike
            ea0, ea1 = xd0 - 0.6, xd1 + 0.6
            ep = sc.prim(('L', 'EAVES_OVERHANG', 'eaves-front', None))
            X, Z = np.array((1.0, 0, 0)), np.array((0, 0, 1.0))
            sc.face(clip(front, Z, 0), 'roof', rp, 'roof')
            strip = clip(front, -Z, 0)
            for poly, grp in ((strip, 'roof'), (ffront, 'fascia')):
                sc.face(clip(poly, X, ea0), 'roof', rp, grp); sc.face(clip(poly, -X, -ea1), 'roof', rp, grp)
                sc.face(clip(clip(poly, -X, -ea0), X, ea1), 'roof', ep, grp)
    # entrance
    pr = sc.prim(('F', 'EXTERIOR_DOOR', 'door-1', None))
    sc.box((xd0, ffl, 0), (xd1, ffl + 2.15, 0.04), 'frame', pr)
    sc.box((xd0 + 0.07, ffl, 0.04), (xd1 - 0.07, ffl + 2.08, 0.07), 'door', pr)
    sc.box((xd0 + 0.2, ffl + 0.4, 0.07), (xd0 + 0.32, ffl + 1.8, 0.08), 'glass', pr)
    sc.mount(pr, 'FRONT', ((xd0 + xd1) / 2, ffl + 1.0, 0))
    if p['nsteps']:
        pr = sc.prim(('F', 'EXTERIOR_STEPS', 'steps-1', None))
        for k in range(p['nsteps']):
            sc.box((xd0 - 0.3, k * 0.16, 0), (xd1 + 0.3, (k + 1) * 0.16, (p['nsteps'] - k) * 0.3), 'slab', pr)
    if p['canopy']:
        cf = ('F', 'CANOPY_ENTRANCE', 'canopy-1', None)
        sc.box((xd0 - 0.6, ffl + 2.35, 0), (xd1 + 0.6, ffl + 2.5, 1.3), 'slab',
               sc.prim(cf, ('L', 'SOLID_ROOFED_CANOPY', 'canopy-1', None)))
        if p['canopyPosts']:
            posts(sc, 'canopy-1', [(xd0 - 0.49, 1.16), (xd1 + 0.49, 1.16)], 0, ffl + 2.35, 'metal', [cf], t=0.12)
    # side slot
    if p['side'] == 'GARAGE':
        g = ('L', 'CLOSED_GARAGE', 'garage-1', None); gd = min(SIDE_DEPTH, D)
        sc.box((W, 0, -gd), (W + GARAGE_W, 2.6, 0), 'wall', sc.prim(g), 'garage')
        sc.box((W, 2.6, -gd - 0.15), (W + GARAGE_W + 0.15, 2.85, 0.15), 'slab', sc.prim(g), 'garageroof')
        pr = sc.prim(('F', 'GARAGE_DOOR', 'garage-1', None), g)
        sc.box((W + 0.35, 0, 0), (W + 2.85, 2.2, 0.03), 'gdoor', pr)
        for y in np.arange(0.4, 2.1, 0.4):
            sc.box((W + 0.4, y, 0.03), (W + 2.8, y + 0.035, 0.045), 'rib', pr)
        sc.mount(pr, 'FRONT', (W + 1.6, 1.1, 0))
        if p['darkWindow']:
            window(sc, p, dict(id='win-g1', facade='FRONT', a0=W + 3.1, a1=W + 3.85, y0=1.0, y1=1.9, dark=True),
                   ('L', 'DARK_WINDOW_NEAR_GARAGE', 'win-g1', None), g)
    elif p['side'] == 'CARPORT':
        cf = ('F', 'CARPORT', 'carport-1', None)
        sc.box((W + 0.3, 0, -5.9), (W + 3.75, 0.05, 0.5), 'paving', sc.prim(cf))
        sc.box((W + 0.3, 2.45, -5.9), (W + 3.75, 2.65, 0.5), 'slab', sc.prim(cf, ('L', 'SOLID_ROOFED_CANOPY', 'carport-1', None)))
        posts(sc, 'carport-1', [(W + 0.45, 0.35), (W + 3.6, 0.35), (W + 3.6, -5.75), (W + 0.45, -5.75)], 0.05, 2.45, 'metal', [cf], t=0.15)
    if p['parking']:
        sc.box((-3.3, 0, -5.0), (-0.5, 0.08, 1.0), 'park', sc.prim(('L', 'PARKING_BAY', 'parking-1', None)))
    # rear assemblies
    counters = {}
    for r in p['rear']:
        k = r['kind']; counters[k] = counters.get(k, 0) + 1
        aid = '%s-%d' % ({'TERRACE_AT_GRADE': 'terrace', 'COVERED_TERRACE': 'cterrace', 'PERGOLA_OPEN': 'pergola'}[k], counters[k])
        r['assemblyId'] = aid
        x0, x1, z0 = r['x0'], r['x1'], -D - r['dep']
        tf = ('F', k, aid, None)
        extra = []
        if k == 'TERRACE_AT_GRADE' and p['storeys'] == 2 and any(
                w['facade'] == 'REAR' and w['storey'] == 1 and w['a0'] < x1 and w['a1'] > x0 for w in p['windows']):
            extra = [('L', 'TERRACE_BELOW_WINDOW', aid, None)]
        sc.box((x0, 0, z0), (x1, 0.15, -D), 'paving', sc.prim(tf, *extra))
        if k == 'TERRACE_AT_GRADE':
            continue
        pts = [(x0 + 0.07, z0 + 0.07), (x1 - 0.07, z0 + 0.07)] + ([((x0 + x1) / 2, z0 + 0.07)] if x1 - x0 > 4 else [])
        posts(sc, aid, pts, 0.15, ffl + 2.35 if k == 'COVERED_TERRACE' else ffl + 2.2, 'wood', [tf])
        if k == 'COVERED_TERRACE':
            sc.box((x0 - 0.1, ffl + 2.35, z0 - 0.15), (x1 + 0.1, ffl + 2.55, -D), 'slab',
                   sc.prim(tf, ('L', 'SOLID_ROOFED_CANOPY', aid, None)))
        else:
            pr = sc.prim(tf)
            sc.box((x0 - 0.1, ffl + 2.2, z0), (x1 + 0.1, ffl + 2.38, z0 + 0.16), 'wood', pr)
            sc.box((x0, ffl + 2.2, -D - 0.12), (x1, ffl + 2.38, -D), 'wood', pr)
            for x in np.arange(x0, x1 + 1e-6, 0.45):
                sc.box((x, ffl + 2.38, z0 - 0.3), (x + 0.07, ffl + 2.58, -D), 'wood', pr)
    # balcony
    if p['balcony']:
        bx0, bx1 = p['balcony']; bf = ('F', 'BALCONY', 'balcony-1', None)
        sc.box((bx0, H1 - 0.2, 0), (bx1, H1, 1.3), 'slab', sc.prim(bf))
        if p['balconyGuard'] == 'RAILING':
            pr = sc.prim(('F', 'RAILING', 'balcony-1', None), bf)
            rail_run(sc, pr, bx0 + 0.03, 1.27, bx1 - 0.03, 1.27, H1)
            rail_run(sc, pr, bx0 + 0.03, 0.05, bx0 + 0.03, 1.27, H1)
            rail_run(sc, pr, bx1 - 0.03, 0.05, bx1 - 0.03, 1.27, H1)
        else:
            pr = sc.prim(bf, ('L', 'SOLID_PARAPET', 'balcony-1', None))
            for lo, hi in (((bx0, H1, 1.15), (bx1, H1 + 1.0, 1.3)), ((bx0, H1, 0), (bx0 + 0.15, H1 + 1.0, 1.15)),
                           ((bx1 - 0.15, H1, 0), (bx1, H1 + 1.0, 1.15))):
                sc.box(lo, hi, 'wall', pr, 'bparapet')
    for w in p['windows']:
        window(sc, p, w)
    return sc


# ----------------------------------------------------------------------------------------------- rendering

def ortho_cam(side, a_mid, y_mid, s, size):
    fwd = np.array(ORTHO_FWD[side], float); up = np.array((0, 1.0, 0)); right = np.cross(fwd, up)
    return dict(persp=False, fwd=fwd, up=up, right=right, eye=a_mid * right + y_mid * up - 300 * fwd, s=s,
                cx=size[0] / 2, cy=size[1] / 2)


def project(cam, pts):
    rel = pts - cam['eye']
    xc, yc, zc = rel @ cam['right'], rel @ cam['up'], rel @ cam['fwd']
    if cam['persp']:
        return cam['cx'] + cam['f'] * xc / zc, cam['cy'] - cam['f'] * yc / zc
    return cam['cx'] + cam['s'] * xc, cam['cy'] - cam['s'] * yc


def persp_cam(verts, side, eye_h, az, fov, size, target_h=0.38):
    sx, sz = OBLIQUE[side]
    lo, hi = verts.min(0), verts.max(0)
    target = np.array(((lo[0] + hi[0]) / 2, hi[1] * target_h, (lo[2] + hi[2]) / 2))
    d = unit(sx * math.sin(math.radians(az)), 0, sz * math.cos(math.radians(az)))
    f = size[0] / 2 / math.tan(math.radians(fov) / 2)
    R = 30.0
    for _ in range(10):
        eye = target + d * R; eye[1] = eye_h
        fwd = unit(*(target - eye)); right = unit(*np.cross(fwd, (0, 1.0, 0))); up = np.cross(right, fwd)
        cam = dict(persp=True, fwd=fwd, up=up, right=right, eye=eye, f=f, cx=size[0] / 2, cy=size[1] / 2)
        u, v = project(cam, verts)
        R = max(8.0, R * max(np.abs(u - cam['cx']).max() / (0.46 * size[0]), np.abs(v - cam['cy']).max() / (0.43 * size[1])))
    return cam


def background(cam, size, style):
    Wd, Hd = size
    if style == 'tech':
        return np.full((Hd, Wd, 3), 255.0)
    rows = np.arange(Hd) + 0.5
    ry = cam['fwd'][1] - (rows - cam['cy']) / cam['f'] * cam['up'][1]
    t = np.clip(ry * 2.5, 0, 1)[:, None]
    sky = np.array((206, 222, 238)) * (1 - t) + np.array((112, 158, 212)) * t
    dist = np.clip(cam['eye'][1] / np.maximum(-ry, 1e-6) / 90, 0, 1)[:, None]
    ground = np.array((104, 146, 84)) * (1 - dist) + np.array((150, 178, 128)) * dist
    col = np.where((ry > 0)[:, None], sky, ground)
    return np.repeat(col[:, None, :], Wd, axis=1)


def render(sc, cam, size, style):
    Wd, Hd = size
    zb = np.full((Hd, Wd), -np.inf); pb = np.full((Hd, Wd), -1, np.int32); kb = pb.copy()
    rgb = background(cam, size, style); raw = {}; clipped = set()
    for v, n, prim, kid, mat, cull in sc.faces:
        tocam = cam['eye'] - v.mean(0) if cam['persp'] else -cam['fwd']
        facing = n @ tocam > 0
        if cull and not facing:
            continue
        rel = v - cam['eye']
        pc = np.stack([rel @ cam['right'], rel @ cam['up'], rel @ cam['fwd']], 1)
        if cam['persp']:
            q = clip(pc, np.array((0, 0, -1.0)), -0.05)
            if len(q) != len(pc) or np.abs(q - pc).max() > 1e-9:
                clipped.add(prim)
            pc = q
            if len(pc) < 3:
                continue
            us, vs, ws = cam['cx'] + cam['f'] * pc[:, 0] / pc[:, 2], cam['cy'] - cam['f'] * pc[:, 1] / pc[:, 2], 1 / pc[:, 2]
        else:
            us, vs, ws = cam['cx'] + cam['s'] * pc[:, 0], cam['cy'] - cam['s'] * pc[:, 1], -pc[:, 2]
        if us.min() < 0 or vs.min() < 0 or us.max() > Wd or vs.max() > Hd:
            clipped.add(prim)
        base = sc.mats[mat][1 if style == 'tech' else 0]
        ne = n if facing else -n
        col = np.array(base, float) * (1.0 if style == 'tech' else 0.6 + 0.4 * max(0.0, float(ne @ LIGHT)))
        for j in range(1, len(us) - 1):
            tri = np.array([[us[0], vs[0]], [us[j], vs[j]], [us[j + 1], vs[j + 1]]]); w3 = ws[[0, j, j + 1]]
            x0, x1 = max(int(math.floor(tri[:, 0].min())), 0), min(int(math.ceil(tri[:, 0].max())), Wd)
            y0, y1 = max(int(math.floor(tri[:, 1].min())), 0), min(int(math.ceil(tri[:, 1].max())), Hd)
            (ax, ay), (bx, by), (cx, cy) = tri
            area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
            if x0 >= x1 or y0 >= y1 or abs(area) < 1e-12:
                continue
            X, Y = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
            l0 = ((bx - X) * (cy - Y) - (by - Y) * (cx - X)) / area
            l1 = ((cx - X) * (ay - Y) - (cy - Y) * (ax - X)) / area
            l2 = 1 - l0 - l1
            inside = (l0 >= -1e-9) & (l1 >= -1e-9) & (l2 >= -1e-9)
            if not inside.any():
                continue
            for t in sc.prims[prim]:
                raw.setdefault(t, np.zeros((Hd, Wd), bool))[y0:y1, x0:x1] |= inside
            dep = l0 * w3[0] + l1 * w3[1] + l2 * w3[2]
            zv = zb[y0:y1, x0:x1]
            win = inside & (dep > zv)
            zv[win] = dep[win]; pb[y0:y1, x0:x1][win] = prim; kb[y0:y1, x0:x1][win] = kid
            rgb[y0:y1, x0:x1][win] = col
    e = np.zeros((Hd, Wd), bool)
    d = kb[:, :-1] != kb[:, 1:]; e[:, :-1] |= d
    d = kb[:-1] != kb[1:]; e[:-1] |= d
    bg = kb < 0
    d = bg[:, :-1] != bg[:, 1:]; e[:, :-1] |= d; e[:, 1:] |= d
    d = bg[:-1] != bg[1:]; e[:-1] |= d; e[1:] |= d
    if style == 'tech':
        rgb[e] = 24
    else:
        rgb[e] *= 0.62
    return dict(rgb=rgb, prim=pb, raw=raw, clipped=clipped, size=size, cam=cam)


def to_png(arr, path):
    a = arr if arr.dtype == np.uint8 else np.clip(np.rint(arr), 0, 255).astype(np.uint8)
    Image.fromarray(a, 'RGB').save(path, format='PNG', optimize=False, compress_level=6)


def scene_truth(sc, res, crop=None):
    Wd, Hd = res['size']
    x0c, y0c, x1c, y1c = crop or (0, 0, Wd, Hd)
    pb = res['prim'][y0c:y1c, x0c:x1c] + 1
    h, w = pb.shape
    tag_prims = {}
    for pi, ts in enumerate(sc.prims):
        for t in ts:
            tag_prims.setdefault(t, []).append(pi + 1)
    feats, looks, hidden = [], [], []
    for ti, (cls, kind, aid, part) in enumerate(sc.tags):
        lut = np.zeros(len(sc.prims) + 1, bool); lut[tag_prims[ti]] = True
        m = lut[pb]; cnt = int(m.sum())
        rawm = res['raw'].get(ti)
        rows, cols = np.flatnonzero(m.any(1)), np.flatnonzero(m.any(0))
        why = None
        if ti in sc.host:
            n, anchor = sc.host[ti]; cam = res['cam']
            if n @ (unit(*(cam['eye'] - anchor)) if cam['persp'] else -cam['fwd']) < EDGE_ON_COS:
                why = 'EDGE_ON' if cnt else 'NOT_VISIBLE'
        if why is None and cnt == 0:
            why = 'NOT_VISIBLE'
        if why is None and (cnt < MIN_PIXELS or min(cols[-1] - cols[0], rows[-1] - rows[0]) + 1 < MIN_SIDE_PX):
            why = 'BELOW_MIN_SIZE'
        if why:
            hidden.append(dict(kind=kind, assemblyId=aid, part=part, lookalike=cls == 'L', reason=why))
            continue
        box = [max(int(cols[0]) - 1, 0), max(int(rows[0]) - 1, 0), min(int(cols[-1]) + 2, w), min(int(rows[-1]) + 2, h)]
        in_crop = int(rawm[y0c:y1c, x0c:x1c].sum())
        reasons = []
        if any(pi - 1 in res['clipped'] for pi in tag_prims[ti]) or in_crop < int(rawm.sum()):
            reasons.append('CLIPPED')
        if cnt < 0.98 * in_crop:
            reasons.append('OCCLUDED')
        rec = dict(kind=kind, assemblyId=aid, box=box, visibility='PARTIAL' if reasons else 'FULL',
                   partialReasons=reasons, visibleFraction=round(cnt / max(int(rawm.sum()), 1), 3))
        if cls == 'L':
            looks.append(dict(rec, isNot=list(LOOKALIKES[kind])))
        else:
            feats.append(dict(rec, part=part))
    key = lambda r: (r['kind'], r['assemblyId'], r.get('part') or 0)
    return sorted(feats, key=key), sorted(looks, key=key), sorted(hidden, key=key)


# ----------------------------------------------------------------------------------------------- 2D drawings

def dashed(dr, a, b, fill=0, width=1, dash=9, gap=6):
    L = math.hypot(b[0] - a[0], b[1] - a[1]); s = 0.0
    while s < L:
        e = min(s + dash, L)
        dr.line([(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L),
                 (a[0] + (b[0] - a[0]) * e / L, a[1] + (b[1] - a[1]) * e / L)], fill=fill, width=width)
        s += dash + gap


def dashed_rect(dr, r, **kw):
    x0, y0, x1, y1 = r
    for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        dashed(dr, a, b, **kw)


def label(dr, cx, cy, rows=2, n=4, size=6):
    """A block of short dark dashes standing in for a text label."""
    for r in range(rows):
        k = n - r
        x = cx - (k * (size + 3)) / 2
        for j in range(k):
            ln = size + (j * 7 + r * 3) % 4
            dr.line([(x, cy + r * 7 - rows * 3), (x + ln, cy + r * 7 - rows * 3)], fill=40, width=2); x += size + 3


def hatch_layer(size, sp=7):
    im = Image.new('L', size, 255); dr = ImageDraw.Draw(im)
    for c in range(-size[1], size[0], sp):
        dr.line([(c, size[1]), (c + size[1], 0)], fill=60, width=1)
    return im


def fill_hatched(im, hatch, poly):
    mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).polygon(poly, fill=255)
    im.paste(hatch, (0, 0), mask); ImageDraw.Draw(im).polygon(poly, outline=0)


def floor_plan(p):
    W, D, s_ = p['W'], p['D'], None
    dep = max([r['dep'] for r in p['rear']] or [0])
    xmin = -3.5 if p['parking'] else -0.6; xmax = W + GARAGE_W + 0.4 if p['side'] != 'NONE' else W + 0.6
    zmin, zmax = -D - dep - 0.4, max(p['nsteps'] * 0.3, 1.3 if p['canopy'] else 0, 1.0 if p['parking'] else 0) + 0.4
    Wd, Hd = PLAN_SIZE
    s = min((Wd - 170) / (xmax - xmin), (Hd - 170) / (zmax - zmin))
    ox, oy = 120 - s * xmin, 50 - s * zmin
    X = lambda x: ox + s * x
    Z = lambda z: oy + s * z
    im = Image.new('L', PLAN_SIZE, 255); dr = ImageDraw.Draw(im)
    for r in p['rear']:
        x0, x1, z0 = r['x0'], r['x1'], -D - r['dep']
        dashed_rect(dr, (X(x0), Z(z0), X(x1), Z(-D)), width=2)
        if r['kind'] != 'TERRACE_AT_GRADE':
            for x in (x0 + 0.07, x1 - 0.07):
                dr.rectangle((X(x) - 4, Z(z0 + 0.07) - 4, X(x) + 4, Z(z0 + 0.07) + 4), fill=0)
        if r['kind'] == 'PERGOLA_OPEN':
            for x in np.arange(x0, x1 + 1e-6, 0.45):
                dr.line([(X(x), Z(z0 - 0.3)), (X(x), Z(-D))], fill=120)
    if p['side'] == 'CARPORT':
        dashed_rect(dr, (X(W + 0.3), Z(-5.9), X(W + 3.75), Z(0.5)), width=2)
        for x, z in ((W + 0.45, 0.35), (W + 3.6, 0.35), (W + 3.6, -5.75), (W + 0.45, -5.75)):
            dr.rectangle((X(x) - 4, Z(z) - 4, X(x) + 4, Z(z) + 4), fill=0)
    if p['parking']:
        dr.rectangle((X(-3.3), Z(-5.0), X(-0.5), Z(1.0)), outline=90, width=1)
        dr.line([(X(-3.3), Z(-5.0)), (X(-0.5), Z(1.0))], fill=170)
    xd0, xd1 = p['door']
    for k in range(p['nsteps']):
        dr.rectangle((X(xd0 - 0.3), Z(0), X(xd1 + 0.3), Z((p['nsteps'] - k) * 0.3)), outline=0)
    if p['canopy']:
        dashed_rect(dr, (X(xd0 - 0.6), Z(0), X(xd1 + 0.6), Z(1.3)), fill=90)
    t = 0.35
    dr.rectangle((X(0), Z(-D), X(W), Z(0)), fill=0); dr.rectangle((X(t), Z(-D + t), X(W - t), Z(-t)), fill=255)
    if p['side'] == 'GARAGE':
        gd = min(SIDE_DEPTH, D)
        dr.rectangle((X(W), Z(-gd), X(W + GARAGE_W), Z(0)), fill=0)
        dr.rectangle((X(W + 0.25), Z(-gd + 0.25), X(W + GARAGE_W - 0.25), Z(-0.25)), fill=255)
        dr.rectangle((X(W + 0.35), Z(-0.25), X(W + 2.85), Z(0)), fill=255)
        dashed(dr, (X(W + 0.35), Z(-0.12)), (X(W + 2.85), Z(-0.12)))
    sx = W * p['plan']['split']
    walls = [((sx - 0.06, -D + t), (sx + 0.06, -t)), ((t, -D * p['plan']['zl'] - 0.06), (sx, -D * p['plan']['zl'] + 0.06)),
             ((sx, -D * p['plan']['zr'] - 0.06), (W - t, -D * p['plan']['zr'] + 0.06))]
    for (a0, b0), (a1, b1) in walls:
        dr.rectangle((X(a0), Z(b0), X(a1), Z(b1)), fill=0)
    for x, z in ((sx, -D * p['plan']['zl'] / 2 - 0.4), (sx, -D * (1 + p['plan']['zr']) / 2)):
        dr.rectangle((X(x - 0.1), Z(z - 0.45), X(x + 0.1), Z(z + 0.45)), fill=255)
    for x, z in ((sx / 2, -D * p['plan']['zl']), ((sx + W) / 2, -D * p['plan']['zr'])):
        dr.rectangle((X(x - 0.45), Z(z - 0.1), X(x + 0.45), Z(z + 0.1)), fill=255)
    for cx_, cz in ((sx / 2, -D * p['plan']['zl'] / 2), (sx / 2, -D * (1 + p['plan']['zl']) / 2),
                    ((sx + W) / 2, -D * p['plan']['zr'] / 2), ((sx + W) / 2, -D * (1 + p['plan']['zr']) / 2)):
        label(dr, X(cx_), Z(cz), rows=2, n=4)
    for w in (w for w in p['windows'] if w['storey'] == 0):
        a0, a1 = w['a0'], w['a1']
        r = {'FRONT': (X(a0), Z(-t), X(a1), Z(0)), 'REAR': (X(a0), Z(-D), X(a1), Z(-D + t)),
             'LEFT': (X(0), Z(-a1), X(t), Z(-a0)), 'RIGHT': (X(W - t), Z(-a1), X(W), Z(-a0))}[w['facade']]
        dr.rectangle(r, fill=255, outline=0)
        if w['facade'] in ('FRONT', 'REAR'):
            dr.line([(r[0], (r[1] + r[3]) / 2), (r[2], (r[1] + r[3]) / 2)], fill=0)
        else:
            dr.line([((r[0] + r[2]) / 2, r[1]), ((r[0] + r[2]) / 2, r[3])], fill=0)
    dr.rectangle((X(xd0), Z(-t), X(xd1), Z(0)), fill=255)
    rr = s * (xd1 - xd0)
    dr.arc((X(xd0) - rr, Z(-t) - rr, X(xd0) + rr, Z(-t) + rr), 270, 360, fill=0)
    dr.line([(X(xd0), Z(-t)), (X(xd0), Z(-t) - rr)], fill=0, width=2)
    # dimension chains
    yb = Z(zmax) + 40
    ticks = sorted({0.0, W, xd0, xd1} | {v for w in p['windows'] if w['facade'] == 'FRONT' and w['storey'] == 0 for v in (w['a0'], w['a1'])})
    dr.line([(X(ticks[0]), yb), (X(ticks[-1]), yb)], fill=0)
    dr.line([(X(0), yb + 28), (X(W), yb + 28)], fill=0)
    for x in ticks:
        dr.line([(X(x) - 5, yb + 5), (X(x) + 5, yb - 5)], fill=0, width=2); dr.line([(X(x), Z(0) + 8), (X(x), yb + 6)], fill=170)
    for x in (0, W):
        dr.line([(X(x) - 5, yb + 33), (X(x) + 5, yb + 23)], fill=0, width=2)
    for a, b in zip(ticks, ticks[1:]):
        if s * (b - a) > 34:
            label(dr, X((a + b) / 2), yb - 10, rows=1, n=3, size=5)
    label(dr, X(W / 2), yb + 18, rows=1, n=4, size=5)
    xl = X(xmin) - 45
    zt = sorted({0.0, -D} | {-v for w in p['windows'] if w['facade'] == 'LEFT' and w['storey'] == 0 for v in (w['a0'], w['a1'])})
    dr.line([(xl, Z(zt[0])), (xl, Z(zt[-1]))], fill=0)
    for z in zt:
        dr.line([(xl - 5, Z(z) + 5), (xl + 5, Z(z) - 5)], fill=0, width=2); dr.line([(xl + 6, Z(z)), (X(0) - 8, Z(z))], fill=200)
    for a, b in zip(zt, zt[1:]):
        if s * (b - a) > 34:
            label(dr, xl - 22, Z((a + b) / 2), rows=1, n=2, size=5)
    return np.array(im.convert('RGB'))


def section(p):
    W, D, ffl, o = p['W'], p['D'], p['ffl'], OVERHANG
    H1, Ht = ffl + STOREY, ffl + STOREY * p['storeys']
    tp = math.tan(math.radians(p['pitchDeg']))
    top = Ht + 0.9 if p['roof'] == 'FLAT' else Ht + D / 2 * tp + 0.3
    dep = max([r['dep'] for r in p['rear']] or [0])
    zl, zr = -D - dep - 1.0, 2.0
    Wd, Hd = SECTION_SIZE
    s = min((Wd - 260) / (zr - zl), (Hd - 90) / (top + 1.2))
    ox, oy = 80 + s * zr, 40 + s * top
    Xz = lambda z: ox - s * z
    Yy = lambda y: oy - s * y
    im = Image.new('L', SECTION_SIZE, 255); dr = ImageDraw.Draw(im); hatch = hatch_layer(SECTION_SIZE)
    fill_hatched(im, hatch, [(Xz(zr + 1), Yy(0)), (Xz(zl - 1), Yy(0)), (Xz(zl - 1), Yy(-1.0)), (Xz(zr + 1), Yy(-1.0))])
    dr.line([(Xz(zr + 1), Yy(0)), (Xz(zl - 1), Yy(0))], fill=0, width=2)
    t = 0.35
    for lv in [ffl] + ([H1] if p['storeys'] == 2 else []) + [Ht]:
        fill_hatched(im, hatch, [(Xz(-t), Yy(lv)), (Xz(-D + t), Yy(lv)), (Xz(-D + t), Yy(lv - 0.25)), (Xz(-t), Yy(lv - 0.25))])
    for z0, z1 in ((0, -t), (-D + t, -D)):
        dr.rectangle((Xz(z0), Yy(Ht), Xz(z1), Yy(min(ffl, 0) - 0.4)), fill=0)
    dr.rectangle((Xz(-D * 0.5 + 0.06), Yy(Ht - 0.25), Xz(-D * 0.5 - 0.06), Yy(ffl)), outline=0)
    if p['roof'] == 'FLAT':
        fill_hatched(im, hatch, [(Xz(0.1), Yy(Ht + 0.3)), (Xz(-D - 0.1), Yy(Ht + 0.3)), (Xz(-D - 0.1), Yy(Ht)), (Xz(0.1), Yy(Ht))])
        for z0, z1 in ((0.1, -0.1), (-D + 0.1, -D - 0.1)):
            dr.rectangle((Xz(z0), Yy(Ht + 0.9), Xz(z1), Yy(Ht + 0.3)), fill=0)
    else:
        ye, Hr, th = Ht - o * tp, Ht + D / 2 * tp, 0.25
        for ze in (o, -D - o):
            fill_hatched(im, hatch, [(Xz(ze), Yy(ye)), (Xz(-D / 2), Yy(Hr)), (Xz(-D / 2), Yy(Hr - th)), (Xz(ze), Yy(ye - th))])
    for r in p['rear'][:1]:
        dr.rectangle((Xz(-D), Yy(0.15), Xz(-D - r['dep']), Yy(0)), outline=0)
    if p['nsteps']:
        for k in range(p['nsteps']):
            dr.rectangle((Xz((p['nsteps'] - k) * 0.3), Yy((k + 1) * 0.16), Xz(0), Yy(k * 0.16)), fill=0)
    xm = Xz(zl) - 20
    lv = [0.0, ffl] + ([H1] if p['storeys'] == 2 else []) + [Ht, top - 0.3]
    for y in sorted(set(round(v, 2) for v in lv)):
        dr.line([(xm - 70, Yy(y)), (xm + 10, Yy(y))], fill=0)
        dr.polygon([(xm - 8, Yy(y) - 10), (xm + 8, Yy(y) - 10), (xm, Yy(y))], outline=0)
        label(dr, xm - 40, Yy(y) - 12, rows=1, n=3, size=5)
    return np.array(im.convert('RGB'))


def site_plan(p):
    W, D = p['W'], p['D']
    dep = max([r['dep'] for r in p['rear']] or [0])
    px0, px1 = (-3.5 if p['parking'] else -0.6) - 4, (W + GARAGE_W + 0.4 if p['side'] != 'NONE' else W) + 4
    pz0, pz1 = -D - dep - 9, 7.0
    Wd, Hd = SITE_SIZE
    s = min((Wd - 160) / (px1 - px0), (Hd - 200) / (pz1 - pz0))
    ox, oy = (Wd - s * (px1 + px0)) / 2, 60 - s * pz0
    X = lambda x: ox + s * x
    Z = lambda z: oy + s * z
    im = Image.new('RGB', SITE_SIZE, (255, 255, 255)); dr = ImageDraw.Draw(im)
    dr.rectangle((0, Z(pz1) + 6, Wd, Z(pz1) + 60), fill=(222, 222, 222)); dr.line([(0, Z(pz1) + 33), (Wd, Z(pz1) + 33)], fill=(255, 255, 255), width=2)
    if p['side'] != 'NONE':
        dr.rectangle((X(W + 0.3), Z(0.5), X(W + 3.75), Z(pz1)), fill=(214, 214, 214))
    if p['parking']:
        dr.rectangle((X(-3.3), Z(-5.0), X(-0.5), Z(pz1)), fill=(214, 214, 214))
    xd0, xd1 = p['door']
    dr.rectangle((X(xd0 - 0.1), Z(p['nsteps'] * 0.3), X(xd1 + 0.1), Z(pz1)), fill=(226, 226, 226))
    for r in p['rear']:
        dr.rectangle((X(r['x0']), Z(-D - r['dep']), X(r['x1']), Z(-D)), fill=(232, 232, 232), outline=(110, 110, 110))
    dr.rectangle((X(0), Z(-D), X(W), Z(0)), fill=(150, 150, 150), outline=(0, 0, 0), width=2)
    if p['roof'] == 'GABLE':
        dr.line([(X(0), Z(-D / 2)), (X(W), Z(-D / 2))], fill=(60, 60, 60))
    elif p['roof'] == 'HIP':
        a = D / 2
        dr.line([(X(a), Z(-a)), (X(W - a), Z(-a))], fill=(60, 60, 60))
        for c, e in (((0, 0), (a, -a)), ((0, -D), (a, -a)), ((W, 0), (W - a, -a)), ((W, -D), (W - a, -a))):
            dr.line([(X(c[0]), Z(c[1])), (X(e[0]), Z(e[1]))], fill=(60, 60, 60))
    if p['side'] == 'GARAGE':
        dr.rectangle((X(W), Z(-min(SIDE_DEPTH, D)), X(W + GARAGE_W), Z(0)), fill=(185, 185, 185), outline=(0, 0, 0), width=2)
    elif p['side'] == 'CARPORT':
        dashed_rect(dr, (X(W + 0.3), Z(-5.9), X(W + 3.75), Z(0.5)), fill=(0, 0, 0), width=2)
    for a, b in (((px0, pz0), (px1, pz0)), ((px1, pz0), (px1, pz1)), ((px1, pz1), (px0, pz1)), ((px0, pz1), (px0, pz0))):
        dashed(dr, (X(a[0]), Z(a[1])), (X(b[0]), Z(b[1])), fill=(0, 0, 0), width=3, dash=18, gap=8)
    for fx, fz, r in p['site']['trees']:
        r = min(r, 0.45 * (-D - dep - 1 - pz0))
        if fz < 0.7:  # rear garden
            x, z = px0 + r + fx * (px1 - px0 - 2 * r), pz0 + r + fz / 0.7 * max(-D - dep - 1 - pz0 - 2 * r, 0)
        else:  # front strip, at the plot side away from the drive
            x, z = (px0 + r if fx < 0.5 else px1 - r), 1.0 + (fz - 0.7) / 0.3 * max(pz1 - 2 - r, 0)
        dr.ellipse((X(x) - s * r, Z(z) - s * r, X(x) + s * r, Z(z) + s * r), fill=(206, 228, 196), outline=(60, 110, 60), width=2)
        dr.line([(X(x) - 4, Z(z)), (X(x) + 4, Z(z))], fill=(60, 110, 60)); dr.line([(X(x), Z(z) - 4), (X(x), Z(z) + 4)], fill=(60, 110, 60))
    cx, cy, R = Wd - 70, 70, 34
    ang = math.radians(p['site']['north'])
    rot = lambda dx, dy: (cx + dx * math.cos(ang) - dy * math.sin(ang), cy + dx * math.sin(ang) + dy * math.cos(ang))
    dr.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(0, 0, 0), width=2)
    dr.polygon([rot(0, -R + 4), rot(10, 14), rot(0, 6), rot(-10, 14)], fill=(0, 0, 0))
    dr.line([rot(-6, -R - 20), rot(-6, -R - 6), rot(6, -R - 20), rot(6, -R - 6)], fill=(0, 0, 0), width=2)
    for k in range(4):
        dr.rectangle((60 + k * s * 5, Hd - 50, 60 + (k + 1) * s * 5, Hd - 42), fill=(0, 0, 0) if k % 2 == 0 else (255, 255, 255), outline=(0, 0, 0))
    return np.array(im)


def interior(p):
    q = p['interior']; Wr, Dr, Hr = q['w'], q['d'], 2.7
    sc = Scene(materials(p)); pr = sc.prim()
    sc.face([(0, 0, 0), (Wr, 0, 0), (Wr, 0, -Dr), (0, 0, -Dr)], 'floor', pr, 'floor')
    sc.face([(0, Hr, 0), (Wr, Hr, 0), (Wr, Hr, -Dr), (0, Hr, -Dr)], 'ceil', pr, 'ceil')
    sc.face([(0, 0, 0), (0, Hr, 0), (0, Hr, -Dr), (0, 0, -Dr)], 'iwall', pr, 'lw')
    sc.face([(Wr, 0, 0), (Wr, Hr, 0), (Wr, Hr, -Dr), (Wr, 0, -Dr)], 'iwall', pr, 'rw')
    o0 = Wr / 2 - q['win'] / 2 + 0.4; o1 = o0 + q['win']
    for lo, hi in (((0, 0), (o0, Hr)), ((o1, 0), (Wr, Hr)), ((o0, 0), (o1, 0.9)), ((o0, 2.3), (o1, Hr))):
        sc.box((lo[0], lo[1], -Dr - 0.2), (hi[0], hi[1], -Dr), 'iwall', pr, 'bw')
    fp = sc.prim()
    for lo, hi in (((o0, 0.9), (o1, 0.97)), ((o0, 2.23), (o1, 2.3)), ((o0, 0.9), (o0 + 0.07, 2.3)), ((o1 - 0.07, 0.9), (o1, 2.3)),
                   (((o0 + o1) / 2 - 0.035, 0.9), ((o0 + o1) / 2 + 0.035, 2.3))):
        sc.box((lo[0], lo[1], -Dr - 0.12), (hi[0], hi[1], -Dr - 0.06), 'frame', fp)
    sx = 0.15 if q['sofaLeft'] else Wr - 1.05
    sp = sc.prim()
    sc.box((sx, 0, -Dr + 0.3), (sx + 0.9, 0.45, -Dr + 2.4), 'sofa', sp)
    bx = (sx, sx + 0.22) if q['sofaLeft'] else (sx + 0.68, sx + 0.9)
    sc.box((bx[0], 0.45, -Dr + 0.3), (bx[1], 0.9, -Dr + 2.4), 'sofa', sp)
    for z in (-Dr + 0.3, -Dr + 2.2):
        sc.box((sx, 0.45, z), (sx + 0.9, 0.65, z + 0.2), 'sofa', sp)
    tp_ = sc.prim(); tx = Wr / 2 - 0.5 + (0.3 if q['sofaLeft'] else -0.3)
    sc.box((tx - 0.3, 0.005, -Dr + 1.0), (tx + 1.3, 0.012, -Dr + 2.8), 'rug', tp_)
    sc.box((tx, 0.42, -Dr + 1.4), (tx + 1.0, 0.47, -Dr + 2.3), 'table', tp_)
    for lx, lz in ((tx + 0.05, -Dr + 1.45), (tx + 0.9, -Dr + 1.45), (tx + 0.05, -Dr + 2.2), (tx + 0.9, -Dr + 2.2)):
        sc.box((lx, 0, lz), (lx + 0.05, 0.42, lz + 0.05), 'table', tp_)
    yaw = math.radians(abs(q['yaw']) * (-1 if q['sofaLeft'] else 1))  # turn towards the sofa
    eye = np.array((Wr / 2, 1.45, -0.25)); fwd = unit(math.sin(yaw), -0.08, -math.cos(yaw))
    right = unit(*np.cross(fwd, (0, 1.0, 0))); up = np.cross(right, fwd)
    cam = dict(persp=True, fwd=fwd, up=up, right=right, eye=eye, f=RENDER_SIZE[0] / 2 / math.tan(math.radians(36)),
               cx=RENDER_SIZE[0] / 2, cy=RENDER_SIZE[1] / 2)
    return render(sc, cam, RENDER_SIZE, 'shade')['rgb']


# ----------------------------------------------------------------------------------------------- corpus

def present_kinds(sc):
    return sorted({t[1] for t in sc.tags if t[0] == 'F'})


def assemblies(sc):
    return sorted({(t[1], t[2], t[0] == 'L') for t in sc.tags})


class Corpus:
    def __init__(self, out):
        self.out, self.images, self.houses, self.pngs = out, [], [], {}

    def emit(self, arr, sid, p, role, proj, side, coverage, feats=(), looks=(), hidden=(), absent=(), annotated=True,
             lineage=None, extra=None):
        path = os.path.join(self.out, 'images', sid + '.png')
        to_png(arr, path)
        with open(path, 'rb') as fh:
            self.pngs['images/%s.png' % sid] = hashlib.sha256(fh.read()).hexdigest()
        e = dict(syntheticId=sid, editionKey=edition_key(p), family=family(p), roleTruth=role, projection=proj,
                 viewSideTruth=side, width=int(arr.shape[1]), height=int(arr.shape[0]), featuresAnnotated=annotated,
                 features=list(feats), lookalikes=list(looks), hiddenFeatures=list(hidden), absentKinds=list(absent),
                 coverage=list(coverage), lineage=lineage)
        e.update(extra or {})
        self.images.append(e)
        return e


def family(p):
    return 'synthetic-family-%02d' % p['family']


def edition_key(p):
    return 'synthetic:f%02d-e%d' % (p['family'], p['edition'])


def sid_of(p, suffix):
    return 'synthetic-f%02d-e%d-%s' % (p['family'], p['edition'], suffix)


def elevation_cams(sc):
    V = sc.verts(); m = 60
    spans = {}
    for side in ORTHO_FWD:
        right = np.cross(np.array(ORTHO_FWD[side], float), (0, 1.0, 0)); a = V @ right
        spans[side] = (float(a.min()), float(a.max()))
    top = float(V[:, 1].max())
    s = min(min((ELEV_SIZE[0] - 2 * m) / (b - a) for a, b in spans.values()), (ELEV_SIZE[1] - 80) / top)
    return {side: ortho_cam(side, (a + b) / 2, (ELEV_SIZE[1] / 2 - 40) / s, s, ELEV_SIZE) for side, (a, b) in spans.items()}


def tech_image(res, cam):
    rgb = res['rgb'].copy()
    _, v0 = project(cam, np.zeros((1, 3)))
    g = int(round(v0[0]))
    rgb[g:g + 2, 30:ELEV_SIZE[0] - 30] = 0
    return rgb


def crop_choice(sc, res):
    Wd, Hd = res['size']
    parent = {(f['kind'], f['assemblyId'], f['part']) for f in scene_truth(sc, res)[0]}
    best = None
    for fx0, fy0, fx1, fy1 in ((0, 0, 0.6, 1), (0.4, 0, 1, 1), (0, 0, 0.5, 1), (0.5, 0, 1, 1), (0.15, 0.1, 0.65, 0.9),
                               (0.35, 0.1, 0.85, 0.9), (0, 0.3, 0.5, 1), (0.5, 0.3, 1, 1)):
        c = (int(fx0 * Wd), int(fy0 * Hd), int(fx1 * Wd), int(fy1 * Hd))
        feats, looks, hidden = scene_truth(sc, res, c)
        kept = {(f['kind'], f['assemblyId'], f['part']) for f in feats}
        lost = sorted(parent - kept, key=lambda k: (k[0], k[1], k[2] or 0))
        score = (len(lost) > 0 and len(kept) >= 3, len({k[0] for k in lost}))
        if best is None or score > best[0]:
            best = (score, c, feats, looks, hidden, lost)
        if score[0] and score[1] >= 1:
            break
    return best[1:]


def emit_house(C, p, full):
    sc = build(p)
    kinds = present_kinds(sc)
    absent = [k for k in KINDS if k not in kinds]
    C.houses.append(dict(family=family(p), editionKey=edition_key(p), params=p, presentKinds=kinds, absentKinds=absent,
                         assemblies=[dict(kind=k, assemblyId=a, lookalike=l, isNot=list(LOOKALIKES[k]) if l else None)
                                     for k, a, l in assemblies(sc)]))
    elev = {}
    for side, cam in elevation_cams(sc).items():
        res = render(sc, cam, ELEV_SIZE, 'tech')
        f, l, h = scene_truth(sc, res)
        rgb = tech_image(res, cam)
        elev[side] = C.emit(rgb, sid_of(p, 'elev-' + side.lower()), p, 'TECHNICAL_ELEVATION', 'ORTHOGRAPHIC', side,
                            [side], f, l, h, absent)
        if side == 'FRONT':
            front_rgb = rgb
    rend = {}
    V = sc.verts()
    for which in ('front', 'rear'):
        side = p['cam'][which]
        cam = persp_cam(V, side, p['cam']['h'], p['cam']['az'], p['cam']['fov'], RENDER_SIZE)
        res = render(sc, cam, RENDER_SIZE, 'shade')
        f, l, h = scene_truth(sc, res)
        cov = [x for x in ('FRONT', 'REAR', 'LEFT', 'RIGHT') if x in side]
        rend[which] = (res, C.emit(res['rgb'], sid_of(p, 'render-' + which), p, 'EXTERIOR_RENDER', 'PERSPECTIVE', side, cov,
                                   f, l, h, absent))
    for suffix, role, fn in (('plan', 'FLOOR_PLAN', floor_plan), ('section', 'SECTION', section), ('site', 'SITE_PLAN', site_plan)):
        C.emit(fn(p), sid_of(p, suffix), p, role, 'ORTHOGRAPHIC', 'NOT_APPLICABLE', [], absent=absent, annotated=False)
    if not full:
        return sc
    C.emit(interior(p), sid_of(p, 'interior'), p, 'INTERIOR_RENDER', 'PERSPECTIVE', 'NOT_APPLICABLE', [], absent=list(KINDS),
           annotated=True)
    fe = elev['FRONT']; w = fe['width']
    mirror = lambda r: dict(r, box=[w - r['box'][2], r['box'][1], w - r['box'][0], r['box'][3]])
    C.emit(front_rgb[:, ::-1], sid_of(p, 'elev-front-mirror'), p, 'TECHNICAL_ELEVATION', 'ORTHOGRAPHIC', 'MIRROR_OF_FRONT',
           ['FRONT'], [mirror(r) for r in fe['features']], [mirror(r) for r in fe['lookalikes']], fe['hiddenFeatures'],
           absent, lineage=dict(parentId=fe['syntheticId'], op='mirror'))
    res, parent = rend['front']
    c, f, l, h, lost = crop_choice(sc, res)
    C.emit(res['rgb'][c[1]:c[3], c[0]:c[2]], sid_of(p, 'render-front-crop'), p, 'EXTERIOR_RENDER', 'PERSPECTIVE',
           parent['viewSideTruth'], parent['coverage'], f, l, h, absent,
           lineage=dict(parentId=parent['syntheticId'], op='crop', window=list(c)),
           extra=dict(excludedByCrop=[dict(kind=k, assemblyId=a, part=pt) for k, a, pt in lost]))
    res, parent = rend['rear']
    img = Image.fromarray(np.clip(np.rint(res['rgb']), 0, 255).astype(np.uint8), 'RGB')
    small = np.array(img.resize((img.width // 2, img.height // 2), Image.BOX))
    half = lambda r: dict(r, box=[r['box'][0] // 2, r['box'][1] // 2, -(-r['box'][2] // 2), -(-r['box'][3] // 2)])
    small_ok = lambda r: min(r['box'][2] - r['box'][0], r['box'][3] - r['box'][1]) - 2 >= MIN_SIDE_PX
    hf, hl = [half(r) for r in parent['features']], [half(r) for r in parent['lookalikes']]
    lost = [dict(kind=r['kind'], assemblyId=r['assemblyId'], part=r.get('part'), lookalike='isNot' in r, reason='BELOW_MIN_SIZE')
            for r in hf + hl if not small_ok(r)]
    C.emit(small, sid_of(p, 'render-rear-half'), p, 'EXTERIOR_RENDER', 'PERSPECTIVE', parent['viewSideTruth'],
           parent['coverage'], [r for r in hf if small_ok(r)], [r for r in hl if small_ok(r)],
           parent['hiddenFeatures'] + lost, absent, lineage=dict(parentId=parent['syntheticId'], op='downscale', factor=0.5))
    return sc


def swap(p, kind):
    q = json.loads(json.dumps(p)); q['edition'] = 2
    if kind == 'TERRACE':
        r = next(r for r in q['rear'] if r['kind'] in ('PERGOLA_OPEN', 'COVERED_TERRACE'))
        old = r['kind']; r['kind'] = 'COVERED_TERRACE' if old == 'PERGOLA_OPEN' else 'PERGOLA_OPEN'
        return q, dict(fromKind=old, toKind=r['kind'])
    if kind == 'SIDE':
        old = q['side']; q['side'] = 'GARAGE' if old == 'CARPORT' else 'CARPORT'
        return q, dict(fromKind='CARPORT' if old == 'CARPORT' else 'CLOSED_GARAGE', toKind='CLOSED_GARAGE' if old == 'CARPORT' else 'CARPORT',
                       note='the closed garage carries its own GARAGE_DOOR (and dark window, if any) as part of the garage assembly')
    q['balcony'] = None
    return q, dict(fromKind='BALCONY', toKind=None, note='the window behind the balcony stays')


def details(C, fams):
    out = []
    for p in fams:
        if p['balcony'] and p['balconyGuard'] == 'RAILING':
            b0, b1 = p['balcony']; H1 = p['ffl'] + STOREY
            out.append((p, 'detail-railing', 'FRONT', (b0 + b1) / 2, H1 + 0.45, 0.8 * DETAIL_SIZE[0] / (b1 - b0 + 0.3)))
            break
    p = fams[0]; w = next(w for w in p['windows'] if w['facade'] == 'FRONT' and w['storey'] == 0)
    out.append((p, 'detail-window', 'FRONT', (w['a0'] + w['a1']) / 2, (w['y0'] + w['y1']) / 2, 0.55 * DETAIL_SIZE[0] / (w['a1'] - w['a0'])))
    for p, suffix, side, a, y, s in out:
        sc = build(p)
        res = render(sc, ortho_cam(side, a, y, s, DETAIL_SIZE), DETAIL_SIZE, 'tech')
        f, l, h = scene_truth(sc, res)
        absent = [k for k in KINDS if k not in present_kinds(sc)]
        C.emit(res['rgb'], sid_of(p, suffix), p, 'DETAIL', 'ORTHOGRAPHIC', side, [side], f, l, h, absent)


def main():
    ap = argparse.ArgumentParser(description='Synthetic known-truth architectural images (research only).')
    ap.add_argument('out'); ap.add_argument('--seed', type=int, default=5005); ap.add_argument('--houses', type=int, default=12)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, 'images'), exist_ok=True)
    with open(os.path.abspath(__file__), 'rb') as fh:
        gen_sha = hashlib.sha256(fh.read()).hexdigest()
    C = Corpus(a.out)
    fams = [draw_params(a.seed, i) for i in range(a.houses)]
    for p in fams:
        emit_house(C, p, True)
    pairs, used = [], set()
    for kind, ok in (('TERRACE', lambda p: any(r['kind'] in ('PERGOLA_OPEN', 'COVERED_TERRACE') for r in p['rear'])),
                     ('SIDE', lambda p: p['side'] != 'NONE'), ('BALCONY', lambda p: bool(p['balcony']))):
        p = next((p for p in fams if p['family'] not in used and ok(p)), None)
        if p is None:
            continue
        used.add(p['family'])
        q, sw = swap(p, kind)
        emit_house(C, q, False)
        pairs.append(dict(family=family(p), e1=edition_key(p), e2=edition_key(q), swap=sw,
                          unchanged='every other parameter (dimensions, windows, colours, cameras) is identical'))
    details(C, fams)
    truth = dict(stage=STAGE, generator='research/analyzer-005r/synth.py', generatorSha256=gen_sha, seed=a.seed,
                 houses=C.houses, images=C.images, editionPairs=pairs, kinds=list(KINDS),
                 lookalikeKinds={k: list(v) for k, v in LOOKALIKES.items()},
                 semantics=__doc__.split('Truth semantics.')[1].split('Limitations:')[0].strip())
    tpath = os.path.join(a.out, 'truth.json')
    with open(tpath, 'w') as fh:
        json.dump(truth, fh, sort_keys=True, indent=1)
    with open(tpath, 'rb') as fh:
        tsha = hashlib.sha256(fh.read()).hexdigest()
    manifest = dict(stage=STAGE, generator=dict(path='research/analyzer-005r/synth.py', sha256=gen_sha), seed=a.seed,
                    houses=a.houses, files=dict(sorted(C.pngs.items())), truthSha256=tsha, imageCount=len(C.images))
    with open(os.path.join(a.out, 'manifest.json'), 'w') as fh:
        json.dump(manifest, fh, sort_keys=True, indent=1)
    roles = {}
    for e in C.images:
        roles[e['roleTruth']] = roles.get(e['roleTruth'], 0) + 1
    print(json.dumps(dict(images=len(C.images), roles=roles), sort_keys=True))


if __name__ == '__main__':
    main()
