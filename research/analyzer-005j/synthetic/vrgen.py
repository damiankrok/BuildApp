#!/usr/bin/env python3
"""vrgen.py - BuildPlan Visual Referee synthetic question corpus (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

Never imported by production code. Every drawing is generated from a semantic scene in metres; the expected answer of
every question is read from that scene, never from a model, a published figure or a picture.

    python -I -B vrgen.py --out <dir outside the repository> [--seeds 4] [--families all]

Writes `<out>/renders/<sceneId>.png` (the full degraded drawing) and `<out>/corpus.json` (scenes, styles, transforms,
question targets in render pixels, expected answers, counterfactual pair links). Overlay composition and crops are
done by `compose.py` so every model sees the same bytes.

Conventions follow the analyzer's own synthetic drawings (packages/synthetic-drawings: black ink on white, wall-thick
solids, slash dimension ticks) and widen them on purpose (hatch, grey or outline walls, anti-aliasing, blur, JPEG,
low contrast, skew) so a model has to learn architecture, not one publisher's pen.
"""
import argparse
import hashlib
import io
import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
GENERATOR_VERSION = '1.0.0'

# ----------------------------------------------------------------------------------------------------------------------
# Question classes: closed answer enums. UNRESOLVED is always allowed (brief section 18).
CLASSES = {
    'BODY_REGION': {'enum': ['YES', 'NO', 'UNRESOLVED'], 'target': 'REGION'},
    'WALL_CONTINUATION': {'enum': ['CONTINUES', 'TERMINATES', 'NOT_SAME_WALL', 'UNRESOLVED'], 'target': 'AB_SEGMENTS'},
    'GARAGE_BODY': {'enum': ['YES', 'NO', 'UNRESOLVED'], 'target': 'REGION'},
    'TERRACE_VS_BODY': {'enum': ['ENCLOSED', 'EXTERNAL', 'UNRESOLVED'], 'target': 'REGION'},
    'CANOPY_PERGOLA_VS_WALL': {'enum': ['WALL', 'NOT_WALL', 'UNRESOLVED'], 'target': 'SEGMENT'},
    'OUTER_BOUNDARY_A_OR_B': {'enum': ['A', 'B', 'NEITHER', 'UNRESOLVED'], 'target': 'AB_REGIONS'},
    'OPENING_VS_PATTERN': {'enum': ['OPENING', 'PATTERN', 'UNRESOLVED'], 'target': 'SEGMENT'},
    'OPEN_SIDE_VS_OPENINGS': {'enum': ['ONE_OPEN_SIDE', 'SEVERAL_OPENINGS', 'UNRESOLVED'], 'target': 'SEGMENT'},
    'BAY_OR_RISALIT': {'enum': ['YES', 'NO', 'UNRESOLVED'], 'target': 'REGION'},
    'STOREY_COVERAGE': {'enum': ['YES', 'NO', 'UNRESOLVED'], 'target': 'REGION'},
    'VOID_VS_OUTSIDE': {'enum': ['VOID', 'OUTSIDE', 'UNRESOLVED'], 'target': 'REGION'},
    'DIMENSION_LINE_VS_BUILDING_LINE': {'enum': ['BUILDING', 'ANNOTATION', 'UNRESOLVED'], 'target': 'SEGMENT'},
    'COLUMN_VS_WALL': {'enum': ['COLUMN', 'WALL', 'UNRESOLVED'], 'target': 'REGION'},
}


# ----------------------------------------------------------------------------------------------------------------------
def sample_style(rng):
    """One drawing convention per counterfactual pair: both members share it, so they differ by one semantic fact."""
    low = rng.random() < 0.2
    return {
        'pxPerM': rng.choice([22, 26, 30, 34, 40]),
        'wallFill': rng.choice(['SOLID', 'SOLID', 'HATCH', 'GREY', 'OUTLINE']),
        'thinPx': rng.choice([1, 1, 2]),
        'winLines': rng.choice([2, 3]),
        'doorArcs': rng.random() < 0.8,
        'garageDoor': rng.choice(['DASHED_MID', 'THIN_DOUBLE', 'THIN_SINGLE']),
        'furniture': rng.choice([0, 1, 2]),
        'labels': rng.random() < 0.7,
        'dims': rng.choice([0, 1, 1, 2]),
        'terraceTexture': rng.choice(['TILES', 'HATCH', 'BOARDS', 'DOTS', 'NONE']),
        'antialias': rng.random() < 0.5,
        'blur': rng.choice([0.0, 0.0, 0.5, 0.9, 1.3]),
        'jpegQuality': rng.choice([None, None, 75, 45, 30]),
        'skewDeg': rng.choice([0.0, 0.0, 0.0, 0.8, -1.5, 2.2]),
        'ink': rng.choice([0, 0, 30]) if not low else rng.choice([95, 120]),
        'paper': 255 if not low else rng.choice([215, 230]),
        'noise': rng.choice([0.0, 0.0, 0.01, 0.03]),
        'extWall': rng.choice([0.30, 0.38, 0.45]),
    }


class Scene:
    """A semantic scene in metres (x right, y down). Render primitives are point lists; truth is regions/targets."""

    def __init__(self, rng, style):
        self.rng, self.st = rng, style
        self.walls = []      # {'a','b','t','ext','inside','ops':[(s0,s1,kind)]}
        self.lines = []      # {'pts','w','dash','closed'}
        self.solids = []     # filled polygons drawn in ink (columns, posts)
        self.textures = []   # {'pts','kind'}
        self.texts = []      # {'pos','s','size','vertical'}
        self.dims = []       # {'a','b','off','text'}
        self.regions = []    # truth: {'id','role','pts'}
        self.panels = None   # for two-panel (storey) scenes: list of (dx) offsets, informational

    # --- building blocks ------------------------------------------------------------------------------------------
    def wall(self, a, b, t=None, ext=True, inside=1, ops=()):
        self.walls.append({'a': a, 'b': b, 't': t or (self.st['extWall'] if ext else 0.12), 'ext': ext, 'inside': inside, 'ops': sorted(ops)})

    def rect_walls(self, x0, y0, x1, y1, ops=None, skip=(), t=None):
        """Four exterior walls on the centreline rectangle; ops per side measured from the side's start point."""
        ops = ops or {}
        sides = {'N': ((x0, y0), (x1, y0), 1), 'E': ((x1, y0), (x1, y1), 1), 'S': ((x0, y1), (x1, y1), -1), 'W': ((x0, y0), (x0, y1), -1)}
        for k, (a, b, ins) in sides.items():
            if k in skip:
                continue
            self.wall(a, b, t=t, ext=True, inside=ins, ops=ops.get(k, ()))

    def line(self, pts, w='thin', dash=None, closed=False):
        self.lines.append({'pts': [tuple(p) for p in pts], 'w': w, 'dash': dash, 'closed': closed})

    def rect_line(self, x0, y0, x1, y1, w='thin', dash=None):
        self.line([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], w=w, dash=dash, closed=True)

    def region(self, rid, role, pts):
        self.regions.append({'id': rid, 'role': role, 'pts': [tuple(p) for p in pts]})

    def text(self, pos, s, size=0.35, vertical=False):
        if self.st['labels']:
            self.texts.append({'pos': pos, 's': s, 'size': size, 'vertical': vertical})

    def texture(self, pts, kind=None):
        k = kind or self.st['terraceTexture']
        if k != 'NONE':
            self.textures.append({'pts': [tuple(p) for p in pts], 'kind': k})

    def column(self, cx, cy, s=0.3):
        self.solids.append([(cx - s / 2, cy - s / 2), (cx + s / 2, cy - s / 2), (cx + s / 2, cy + s / 2), (cx - s / 2, cy + s / 2)])

    def dim(self, a, b, off, text):
        if self.st['dims'] > 0:
            self.dims.append({'a': a, 'b': b, 'off': off, 'text': text})

    def furniture_rect(self, x0, y0, x1, y1):
        if self.st['furniture'] > 0:
            self.rect_line(x0, y0, x1, y1)

    def car(self, cx, cy, vertical=True):
        w, l = 1.8, 4.4
        hw, hl = (w / 2, l / 2) if vertical else (l / 2, w / 2)
        self.rect_line(cx - hw, cy - hl, cx + hw, cy + hl)
        if vertical:
            self.line([(cx - hw, cy - hl + 1.2), (cx + hw, cy - hl + 1.2)])
            self.line([(cx - hw, cy + hl - 1.0), (cx + hw, cy + hl - 1.0)])
        else:
            self.line([(cx - hl + 1.2, cy - hw), (cx - hl + 1.2, cy + hw)])
            self.line([(cx + hl - 1.0, cy - hw), (cx + hl - 1.0, cy + hw)])

    def stair(self, x0, y0, x1, y1, n=None):
        n = n or 12
        self.rect_line(x0, y0, x1, y1)
        horizontal = (x1 - x0) > (y1 - y0)
        for i in range(1, n):
            if horizontal:
                x = x0 + (x1 - x0) * i / n
                self.line([(x, y0), (x, y1)])
            else:
                y = y0 + (y1 - y0) * i / n
                self.line([(x0, y), (x1, y)])
        if horizontal:
            ym = (y0 + y1) / 2
            self.line([(x0 + 0.2, ym), (x1 - 0.3, ym)])
            self.line([(x1 - 0.6, ym - 0.2), (x1 - 0.3, ym), (x1 - 0.6, ym + 0.2)])
        else:
            xm = (x0 + x1) / 2
            self.line([(xm, y0 + 0.2), (xm, y1 - 0.3)])
            self.line([(xm - 0.2, y1 - 0.6), (xm, y1 - 0.3), (xm + 0.2, y1 - 0.6)])

    def furnish_room(self, x0, y0, x1, y1):
        """Furniture noise inside a room: a table with chairs, a sofa, a bed - none of it a wall."""
        f = self.st['furniture']
        if f == 0 or (x1 - x0) < 2.4 or (y1 - y0) < 2.4:
            return
        r = self.rng
        cx, cy = r.uniform(x0 + 1.2, x1 - 1.2), r.uniform(y0 + 1.2, y1 - 1.2)
        self.rect_line(cx - 0.6, cy - 0.4, cx + 0.6, cy + 0.4)
        for dx in (-0.4, 0.4):
            self.rect_line(cx + dx - 0.2, cy - 0.75, cx + dx + 0.2, cy - 0.45)
            self.rect_line(cx + dx - 0.2, cy + 0.45, cx + dx + 0.2, cy + 0.75)
        if f == 2:
            sx, sy = x0 + 0.35, r.uniform(y0 + 0.4, max(y0 + 0.5, y1 - 2.4))
            self.rect_line(sx, sy, sx + 0.85, sy + 2.0)
            self.line([(sx + 0.25, sy), (sx + 0.25, sy + 2.0)])

    def windows_on(self, length, k, avoid=(), wmin=0.9, wmax=1.8, margin=0.6):
        """k windows placed along a wall of a given length, clear of the intervals in `avoid`."""
        ops, tries = [], 0
        while len(ops) < k and tries < 60:
            tries += 1
            w = round(self.rng.uniform(wmin, wmax), 2)
            if length - 2 * margin < w:
                break
            s0 = round(self.rng.uniform(margin, length - margin - w), 2)
            s1 = s0 + w
            if any(not (s1 + 0.4 <= a or s0 >= b + 0.4) for a, b, *_ in list(avoid) + ops):
                continue
            ops.append((s0, s1, 'WINDOW'))
        return ops

    # --- compile to drawing primitives -----------------------------------------------------------------------------
    def compile(self):
        """Wall pieces (polygons), opening symbols (lines) and dimension graphics, all in metres."""
        pieces, sym = [], []
        for w in self.walls:
            ax, ay = w['a']
            bx, by = w['b']
            L = math.hypot(bx - ax, by - ay)
            ux, uy = (bx - ax) / L, (by - ay) / L
            nx, ny = -uy, ux
            t = w['t']
            ext = t / 2   # square caps so corners and T-junctions close
            cuts = [(-ext, -ext)] + [(s0, s1) for s0, s1, _ in w['ops']] + [(L + ext, L + ext)]
            for (p_a, p_b), (q_a, q_b) in zip(cuts[:-1], cuts[1:]):
                p0, p1 = p_b, q_a
                if p1 - p0 < 0.02:
                    continue
                P = lambda s, o: (ax + ux * s + nx * o, ay + uy * s + ny * o)
                pieces.append({'pts': [P(p0, -t / 2), P(p1, -t / 2), P(p1, t / 2), P(p0, t / 2)], 'ext': w['ext']})
            for s0, s1, kind in w['ops']:
                P = lambda s, o: (ax + ux * s + nx * o, ay + uy * s + ny * o)
                width = s1 - s0
                ins = w['inside']
                if kind in ('WINDOW', 'GLAZED'):
                    offs = [-t / 2, t / 2] + ([0.0] if self.st['winLines'] == 3 else [])
                    for o in offs:
                        sym.append({'pts': [P(s0, o), P(s1, o)], 'w': 'thin', 'dash': None})
                    sym.append({'pts': [P(s0, -t / 2), P(s0, t / 2)], 'w': 'thin', 'dash': None})
                    sym.append({'pts': [P(s1, -t / 2), P(s1, t / 2)], 'w': 'thin', 'dash': None})
                elif kind in ('DOOR', 'DOUBLE_DOOR'):
                    leaves = [(s0, 1, width)] if kind == 'DOOR' else [(s0, 1, width / 2), (s1, -1, width / 2)]
                    for hinge, dirn, lw in leaves:
                        hx, hy = P(hinge, ins * t / 2)
                        ex, ey = hx + nx * ins * lw, hy + ny * ins * lw
                        sym.append({'pts': [(hx, hy), (ex, ey)], 'w': 'thin', 'dash': None})
                        if self.st['doorArcs']:
                            arc = []
                            for i in range(13):
                                th = (math.pi / 2) * i / 12
                                vx = math.cos(th) * nx * ins + math.sin(th) * ux * dirn
                                vy = math.cos(th) * ny * ins + math.sin(th) * uy * dirn
                                arc.append((hx + vx * lw, hy + vy * lw))
                            sym.append({'pts': arc, 'w': 'thin', 'dash': None})
                elif kind == 'SLIDING':
                    sym.append({'pts': [P(s0, -t / 6), P(s0 + width * 0.6, -t / 6)], 'w': 'thin', 'dash': None})
                    sym.append({'pts': [P(s1 - width * 0.6, t / 6), P(s1, t / 6)], 'w': 'thin', 'dash': None})
                    for o in (-t / 2, t / 2):
                        sym.append({'pts': [P(s0, o), P(s0, o)], 'w': 'thin', 'dash': None})
                elif kind == 'GARAGE_DOOR':
                    g = self.st['garageDoor']
                    if g == 'DASHED_MID':
                        sym.append({'pts': [P(s0, 0), P(s1, 0)], 'w': 'thin', 'dash': (0.25, 0.15)})
                    elif g == 'THIN_DOUBLE':
                        sym.append({'pts': [P(s0, -t / 4), P(s1, -t / 4)], 'w': 'thin', 'dash': None})
                        sym.append({'pts': [P(s0, t / 4), P(s1, t / 4)], 'w': 'thin', 'dash': None})
                    else:
                        sym.append({'pts': [P(s0, ins * t / 2), P(s1, ins * t / 2)], 'w': 'thin', 'dash': None})
                # 'OPEN': nothing drawn across - the wall stops here.
        dimg = []
        for d in self.dims:
            (ax, ay), (bx, by) = d['a'], d['b']
            L = math.hypot(bx - ax, by - ay)
            ux, uy = (bx - ax) / L, (by - ay) / L
            nx, ny = -uy * d['off'], ux * d['off']
            pa, pb = (ax + nx, ay + ny), (bx + nx, by + ny)
            dimg.append({'pts': [pa, pb], 'w': 'thin', 'dash': None})
            sgn = 1 if d['off'] > 0 else -1
            for (px, py), (qx, qy) in (((ax, ay), pa), ((bx, by), pb)):
                dimg.append({'pts': [(px + (-uy) * sgn * 0.15, py + ux * sgn * 0.15), (qx + (-uy) * sgn * 0.2, qy + ux * sgn * 0.2)], 'w': 'thin', 'dash': None})
                tk = 0.15
                dimg.append({'pts': [(qx - (ux + (-uy)) * tk, qy - (uy + ux) * tk), (qx + (ux + (-uy)) * tk, qy + (uy + ux) * tk)], 'w': 'mid', 'dash': None})
            mx, my = (pa[0] + pb[0]) / 2 + (-uy) * sgn * 0.3, (pa[1] + pb[1]) / 2 + ux * sgn * 0.3
            self.texts.append({'pos': (mx, my), 's': d['text'], 'size': 0.3, 'vertical': abs(uy) > abs(ux), 'dim': True})
        return pieces, sym, dimg


# ----------------------------------------------------------------------------------------------------------------------
# Geometry transforms (scene level, before rasterisation, so text stays upright like on a real mirrored sheet).
TRANSFORMS = ['NORMAL', 'MIRROR', 'ROT90', 'ROT180']


def tf_point(p, name, skew):
    x, y = p
    if name == 'MIRROR':
        x = -x
    elif name == 'ROT90':
        x, y = -y, x
    elif name == 'ROT180':
        x, y = -x, -y
    if skew:
        a = math.radians(skew)
        x, y = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
    return (x, y)


def render(scene, transform, out_png):
    """Rasterise a scene after a transform; return the pixel mapping and the truth in render pixels."""
    st = scene.st
    pieces, sym, dimg = scene.compile()
    T = lambda p: tf_point(p, transform, st['skewDeg'])
    allpts = [T(p) for pc in pieces for p in pc['pts']] + [T(p) for l in scene.lines for p in l['pts']] + [T(p) for l in dimg for p in l['pts']]
    allpts += [T(p) for r in scene.regions for p in r['pts']] + [T(t['pos']) for t in scene.texts]
    mnx, mny = min(p[0] for p in allpts) - 1.2, min(p[1] for p in allpts) - 1.2
    mxx, mxy = max(p[0] for p in allpts) + 1.2, max(p[1] for p in allpts) + 1.2
    ppm = st['pxPerM']
    ss = 3 if st['antialias'] else 1
    W, H = int(math.ceil((mxx - mnx) * ppm)), int(math.ceil((mxy - mny) * ppm))
    P = lambda p: ((T(p)[0] - mnx) * ppm * ss, (T(p)[1] - mny) * ppm * ss)
    Pr = lambda p: ((T(p)[0] - mnx) * ppm, (T(p)[1] - mny) * ppm)   # final-resolution pixels
    img = Image.new('L', (W * ss, H * ss), st['paper'])
    d = ImageDraw.Draw(img)
    ink = st['ink']
    thin = max(1, st['thinPx'] * ss)
    mid = max(1, (st['thinPx'] + 1) * ss)

    # textures (terrace fills), clipped to their polygons
    for tx in scene.textures:
        poly = [P(p) for p in tx['pts']]
        layer = Image.new('L', img.size, 0)
        ld = ImageDraw.Draw(layer)
        xs, ys = [p[0] for p in poly], [p[1] for p in poly]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        k = tx['kind']
        if k == 'TILES':
            step = 0.5 * ppm * ss
            x = x0
            while x <= x1:
                ld.line([(x, y0), (x, y1)], fill=255, width=thin)
                x += step
            y = y0
            while y <= y1:
                ld.line([(x0, y), (x1, y)], fill=255, width=thin)
                y += step
        elif k == 'HATCH':
            step = 0.25 * ppm * ss
            s = -(y1 - y0)
            while s <= (x1 - x0):
                ld.line([(x0 + s, y1), (x0 + s + (y1 - y0), y0)], fill=255, width=thin)
                s += step
        elif k == 'BOARDS':
            step = 0.14 * ppm * ss
            horizontal = (x1 - x0) >= (y1 - y0)
            if horizontal:
                y = y0
                while y <= y1:
                    ld.line([(x0, y), (x1, y)], fill=255, width=thin)
                    y += step
            else:
                x = x0
                while x <= x1:
                    ld.line([(x, y0), (x, y1)], fill=255, width=thin)
                    x += step
        elif k == 'DOTS':
            rr = random.Random(int(x0 * 7 + y0 * 13))
            for _ in range(int((x1 - x0) * (y1 - y0) / (ss * ss * ppm * ppm) * 30)):
                px, py = rr.uniform(x0, x1), rr.uniform(y0, y1)
                ld.ellipse([px - ss, py - ss, px + ss, py + ss], fill=255)
        mask = Image.new('L', img.size, 0)
        ImageDraw.Draw(mask).polygon(poly, fill=255)
        from PIL import ImageChops
        layer = ImageChops.multiply(layer, mask)
        img.paste(Image.new('L', img.size, ink), mask=layer)

    def draw_line(l):
        pts = [P(p) for p in l['pts']]
        if l.get('closed'):
            pts = pts + [pts[0]]
        width = thin if l['w'] == 'thin' else mid
        if l['dash']:
            on, off = l['dash'][0] * ppm * ss, l['dash'][1] * ppm * ss
            for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
                L = math.hypot(x1 - x0, y1 - y0)
                if L == 0:
                    continue
                s = 0.0
                while s < L:
                    e = min(L, s + on)
                    d.line([(x0 + (x1 - x0) * s / L, y0 + (y1 - y0) * s / L), (x0 + (x1 - x0) * e / L, y0 + (y1 - y0) * e / L)], fill=ink, width=width)
                    s = e + off
        else:
            d.line(pts, fill=ink, width=width)

    for l in scene.lines + sym + dimg:
        draw_line(l)
    for s in scene.solids:
        d.polygon([P(p) for p in s], fill=ink)

    # walls: the union of all pieces, filled in the sheet's convention
    union = unary_union([Polygon([P(p) for p in pc['pts']]).buffer(0) for pc in pieces])
    polys = [union] if union.geom_type == 'Polygon' else list(union.geoms)
    fill = st['wallFill']
    for poly in polys:
        ext = [tuple(c) for c in poly.exterior.coords]
        holes = [[tuple(c) for c in h.coords] for h in poly.interiors]
        if fill in ('SOLID', 'GREY'):
            val = ink if fill == 'SOLID' else min(255, ink + 110)
            d.polygon(ext, fill=val)
            for h in holes:
                d.polygon(h, fill=st['paper'])
            if fill == 'GREY':
                d.line(ext, fill=ink, width=thin)
        else:
            d.polygon(ext, fill=st['paper'])
            for h in holes:
                d.polygon(h, fill=st['paper'])
            if fill == 'HATCH':
                layer = Image.new('L', img.size, 0)
                ld = ImageDraw.Draw(layer)
                xs, ys = [p[0] for p in ext], [p[1] for p in ext]
                x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
                step = 0.09 * ppm * ss
                s = -(y1 - y0)
                while s <= (x1 - x0):
                    ld.line([(x0 + s, y1), (x0 + s + (y1 - y0), y0)], fill=255, width=thin)
                    s += step
                mask = Image.new('L', img.size, 0)
                ImageDraw.Draw(mask).polygon(ext, fill=255)
                for h in holes:
                    ImageDraw.Draw(mask).polygon(h, fill=0)
                from PIL import ImageChops
                img.paste(Image.new('L', img.size, ink), mask=ImageChops.multiply(layer, mask))
            d.line(ext + [ext[0]], fill=ink, width=mid)
            for h in holes:
                d.line(h + [h[0]], fill=ink, width=mid)

    # text, upright
    for t in scene.texts:
        size = max(7, int(t['size'] * ppm * ss))
        font = ImageFont.truetype(FONT, size)
        x, y = P(t['pos'])
        tw = d.textlength(t['s'], font=font)
        if t['vertical']:
            tmp = Image.new('L', (int(tw) + 4, size + 4), 0)
            ImageDraw.Draw(tmp).text((2, 0), t['s'], font=font, fill=255)
            tmp = tmp.rotate(90, expand=True)
            img.paste(Image.new('L', tmp.size, ink), (int(x - tmp.size[0] / 2), int(y - tmp.size[1] / 2)), mask=tmp)
        else:
            d.text((x - tw / 2, y - size / 2), t['s'], font=font, fill=ink)

    if ss > 1:
        img = img.resize((W, H), Image.LANCZOS)
    # source degradations: the sheet, not the question
    if st['blur'] > 0:
        img = img.filter(ImageFilter.GaussianBlur(st['blur']))
    if st['noise'] > 0:
        rr = random.Random(W * 31 + H)
        px = img.load()
        for _ in range(int(W * H * st['noise'])):
            x, y = rr.randrange(W), rr.randrange(H)
            px[x, y] = max(0, min(255, px[x, y] + rr.choice([-60, 60])))
    if st['jpegQuality']:
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=st['jpegQuality'])
        img = Image.open(io.BytesIO(buf.getvalue())).convert('L')
    img.save(out_png)
    return {'size': [W, H], 'map': Pr}


# ----------------------------------------------------------------------------------------------------------------------
# Families. Each returns (scene, questions) for variant 'A' or 'B' of a counterfactual pair; both variants share the
# seed and the style, and differ by the one semantic fact the pair is about. Question targets are in metres.

def _rooms(sc, x0, y0, x1, y1, door_side='S'):
    """One partition with a door to break the body into rooms (noise, and realism)."""
    r = sc.rng
    if x1 - x0 > 6:
        xm = round(r.uniform(x0 + 2.8, x1 - 2.8), 2)
        dpos = round(r.uniform(0.6, (y1 - y0) - 1.6), 2)
        sc.wall((xm, y0), (xm, y1), ext=False, inside=r.choice([1, -1]), ops=[(dpos, dpos + 0.9, 'DOOR')])
        sc.furnish_room(x0, y0, xm, y1)
        sc.furnish_room(xm, y0, x1, y1)
    else:
        sc.furnish_room(x0, y0, x1, y1)


def _main_body(sc, W, D, front_ops=None, other=None, label=True):
    """A rectangular main body (0,0)-(W,D) with windows on every side unless told otherwise."""
    r = sc.rng
    ops = {}
    for side, L in (('N', W), ('E', D), ('S', W), ('W', D)):
        if other and side in other:
            ops[side] = other[side]
        else:
            ops[side] = sc.windows_on(L, r.choice([1, 2, 2, 3]))
    if front_ops is not None:
        ops['S'] = front_ops
    sc.rect_walls(0, 0, W, D, ops)
    if label:
        sc.text((W * 0.3, D * 0.4), r.choice(['SALON', 'POKOJ', 'KUCHNIA', 'HOL']))
    return ops


def fam_garage_link(rng, st, v):
    """Garage tied to the body by an enclosed connector (A) / the same drawing with the connector removed (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    _main_body(sc, W, D)
    _rooms(sc, 0, 0, W, D)
    g = rng.uniform(1.6, 2.6)
    gw, gd = rng.uniform(3.4, 4.2), rng.uniform(5.5, 6.5)
    gx0, gy0 = W + g, D - gd
    gdw = rng.uniform(2.4, 3.0)
    s0 = (gw - gdw) / 2
    sc.rect_walls(gx0, gy0, gx0 + gw, D, {'S': [(s0, s0 + gdw, 'GARAGE_DOOR')], 'N': sc.windows_on(gw, 1, wmax=1.0)})
    sc.car(gx0 + gw / 2, (gy0 + D) / 2)
    sc.text((gx0 + gw / 2, gy0 + 0.8), 'GARAZ')
    cy0, cy1 = D - rng.uniform(3.0, 4.0), D - 0.6
    conn = [(W, cy0), (gx0, cy0), (gx0, cy1), (W, cy1)]
    if v == 'A':
        sc.wall((W, cy0), (gx0, cy0), inside=1)
        sc.wall((W, cy1), (gx0, cy1), inside=-1, ops=[(0.3, min(g - 0.2, 1.2), 'DOOR')])
        sc.region('connector', 'BODY', conn)
    else:
        sc.line([(W + 0.3, cy1 + 0.6), (gx0 - 0.3, cy1 + 0.6)], dash=(0.3, 0.2))
        sc.region('connector', 'OUTSIDE', conn)
    garage = [(gx0, gy0), (gx0 + gw, gy0), (gx0 + gw, D), (gx0, D)]
    sc.region('garage', 'GARAGE' if v == 'A' else 'DETACHED_GARAGE', garage)
    qs = [
        {'cls': 'GARAGE_BODY', 'target': garage, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'connector enclosed' if v == 'A' else 'connector removed'},
        {'cls': 'BODY_REGION', 'target': conn, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'enclosed link' if v == 'A' else 'gap between buildings'},
    ]
    return sc, qs


def fam_detached_garage(rng, st, v):
    """Garage sharing the body's wall (A) / standing 1-2 m away with no connection (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    _main_body(sc, W, D, other={'E': []})
    _rooms(sc, 0, 0, W, D)
    gw, gd = rng.uniform(3.4, 4.2), rng.uniform(5.5, 6.5)
    gap = 0.0 if v == 'A' else rng.uniform(1.0, 2.0)
    gx0, gy0 = W + gap, D - gd
    gdw = rng.uniform(2.4, 3.0)
    s0 = (gw - gdw) / 2
    skip = ('W',) if v == 'A' else ()
    sc.rect_walls(gx0, gy0, gx0 + gw, D, {'S': [(s0, s0 + gdw, 'GARAGE_DOOR')]}, skip=skip)
    if v == 'A':
        # the shared wall carries a door from the garage into the house
        sc.walls[-1]['ops'] = sc.walls[-1]['ops']
        dpos = rng.uniform(0.5, gd - 1.5)
        sc.walls[1]['ops'] = [(D - gd + dpos, D - gd + dpos + 0.9, 'DOOR')]
    sc.car(gx0 + gw / 2, (gy0 + D) / 2)
    sc.text((gx0 + gw / 2, gy0 + 0.8), 'GARAZ')
    garage = [(gx0, gy0), (gx0 + gw, gy0), (gx0 + gw, D), (gx0, D)]
    sc.region('garage', 'GARAGE' if v == 'A' else 'DETACHED_GARAGE', garage)
    return sc, [{'cls': 'GARAGE_BODY', 'target': garage, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'attached' if v == 'A' else 'detached'}]


def fam_garage_door_vs_open(rng, st, v):
    """A garage door in a continuing facade (A) / the same gap with nothing across it: an open carport (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(11, 14), rng.uniform(8, 10)
    gw = rng.uniform(3.4, 4.0)
    gdw = rng.uniform(2.4, min(3.2, gw - 0.6))
    gs0 = W - gw + (gw - gdw) / 2
    front = sc.windows_on(W - gw - 0.4, rng.choice([1, 2])) + [(gs0, gs0 + gdw, 'GARAGE_DOOR' if v == 'A' else 'OPEN')]
    _main_body(sc, W, D, front_ops=front)
    sc.wall((W - gw, D - rng.uniform(5.5, 6.5)), (W - gw, D), ext=False, inside=1)
    sc.walls[-1]['t'] = 0.25
    gy0 = sc.walls[-1]['a'][1]
    sc.wall((W - gw, gy0), (W, gy0), ext=False, inside=1, ops=[(0.6, 1.5, 'DOOR')])
    sc.walls[-1]['t'] = 0.25
    _rooms(sc, 0, 0, W - gw, D)
    sc.car(W - gw / 2, (gy0 + D) / 2)
    sc.text((W - gw / 2, gy0 + 0.8), 'GARAZ' if v == 'A' else 'WIATA')
    garage = [(W - gw, gy0), (W, gy0), (W, D), (W - gw, D)]
    sc.region('garage', 'GARAGE' if v == 'A' else 'CARPORT', garage)
    t = st['extWall']
    a_seg = [(gs0 - 0.7, D), (gs0, D)]
    b_seg = [(gs0 + gdw, D), (min(W + t / 2, gs0 + gdw + 0.7), D)]
    return sc, [
        {'cls': 'WALL_CONTINUATION', 'target': {'A': a_seg, 'B': b_seg}, 'answer': 'CONTINUES' if v == 'A' else 'TERMINATES', 'fact': 'garage door' if v == 'A' else 'open side'},
        {'cls': 'GARAGE_BODY', 'target': garage, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'closed garage' if v == 'A' else 'open carport'},
    ]


def fam_porch_recess(rng, st, v):
    """A recessed entrance porch (A) / the same front with the vestibule enclosed in the facade line (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(10, 13), rng.uniform(8, 10)
    pw, pd = rng.uniform(2.2, 3.4), rng.uniform(1.2, 1.8)
    px0 = rng.uniform(2.5, W - pw - 2.5)
    px1 = px0 + pw
    t = st['extWall']
    left = sc.windows_on(px0 - 0.2, 1)
    right = [(px1 + s0, px1 + s1, k) for s0, s1, k in sc.windows_on(W - px1, 1)]
    if v == 'A':
        sc.rect_walls(0, 0, W, D, {'N': sc.windows_on(W, 2), 'E': sc.windows_on(D, 1), 'W': sc.windows_on(D, 1)}, skip=('S',))
        sc.wall((0, D), (px0, D), inside=-1, ops=left)
        sc.wall((px1, D), (W, D), inside=-1, ops=[(s0 - px1, s1 - px1, k) for s0, s1, k in right])
        sc.wall((px0, D - pd), (px0, D), inside=-1)
        sc.wall((px1, D - pd), (px1, D), inside=1)
        dpos = (pw - 1.0) / 2
        sc.wall((px0, D - pd), (px1, D - pd), inside=-1, ops=[(dpos, dpos + 1.0, 'DOOR')])
        porch_role = 'PORCH'
    else:
        dpos = px0 + (pw - 1.0) / 2
        sc.rect_walls(0, 0, W, D, {'N': sc.windows_on(W, 2), 'E': sc.windows_on(D, 1), 'W': sc.windows_on(D, 1), 'S': left + [(dpos, dpos + 1.0, 'DOOR')] + right})
        sc.wall((px0, D - pd), (px0, D), ext=False, inside=-1)
        sc.wall((px1, D - pd), (px1, D), ext=False, inside=1)
        sc.wall((px0, D - pd), (px1, D - pd), ext=False, inside=-1, ops=[((pw - 0.9) / 2, (pw + 0.9) / 2, 'DOOR')])
        porch_role = 'BODY'
    hall = [(px0, D - pd - rng.uniform(2.5, 3.5)), (px1, D - pd - 2.5), (px1, D - pd), (px0, D - pd)]
    hall = [(px0, hall[0][1]), (px1, hall[0][1]), (px1, D - pd), (px0, D - pd)]
    sc.wall((px0, hall[0][1]), (px1, hall[0][1]), ext=False, inside=1, ops=[(0.4, 1.3, 'DOOR')])
    sc.text(((px0 + px1) / 2, hall[0][1] + 0.8), 'HOL')
    _rooms(sc, 0, 0, px0, D)
    porch = [(px0, D - pd), (px1, D - pd), (px1, D), (px0, D)]
    sc.region('porch', porch_role, porch)
    sc.region('hall', 'BODY', hall)
    a_seg = [(px0 - 0.8, D), (px0 + t / 2, D)]
    b_seg = [(px1 - t / 2, D), (px1 + 0.8, D)]
    return sc, [
        {'cls': 'WALL_CONTINUATION', 'target': {'A': a_seg, 'B': b_seg}, 'answer': 'TERMINATES' if v == 'A' else 'CONTINUES', 'fact': 'recess mouth' if v == 'A' else 'entrance door in facade'},
        {'cls': 'BODY_REGION', 'target': porch, 'answer': 'NO' if v == 'A' else 'YES', 'fact': 'open porch' if v == 'A' else 'vestibule'},
        {'cls': 'BODY_REGION', 'target': hall, 'answer': 'YES', 'fact': 'hall behind the entrance (both variants)'},
    ]


def fam_porch_plus_garage(rng, st, v):
    """gozdzikowcach analogue. A: a recessed porch beside a garage door, separated by a pier, the hall behind the porch
    enclosed - several openings in a continuing facade. B: the same stretch is one genuinely open side: the two wings
    end, nothing is drawn across, and behind it lies an open patio."""
    sc = Scene(rng, st)
    W, D = rng.uniform(13, 16), rng.uniform(9, 11)
    t = st['extWall']
    lw = rng.uniform(4.0, 5.5)           # left wing width
    pw, pd = rng.uniform(2.4, 3.2), rng.uniform(1.4, 2.2)
    pier = rng.uniform(0.5, 0.9)
    gdw = rng.uniform(2.6, 3.2)
    px0, px1 = lw, lw + pw
    gs0, gs1 = px1 + pier, px1 + pier + gdw
    gw_end = gs1 + rng.uniform(0.5, 0.9)
    W = max(W, gw_end + 0.5)
    sc.rect_walls(0, 0, W, D, {'N': sc.windows_on(W, 3), 'E': sc.windows_on(D, 1), 'W': sc.windows_on(D, 1)}, skip=('S',))
    sc.wall((0, D), (px0, D), inside=-1, ops=sc.windows_on(px0 - 0.3, 1))
    if v == 'A':
        sc.wall((px1, D), (W, D), inside=-1, ops=[(gs0 - px1, gs1 - px1, 'GARAGE_DOOR')])
        sc.wall((px0, D - pd), (px0, D), inside=-1)
        sc.wall((px1, D - pd), (px1, D), inside=1)
        sc.wall((px0, D - pd), (px1, D - pd), inside=-1, ops=[((pw - 1.05) / 2, (pw + 1.05) / 2, 'DOOR')])
        sc.wall((px1, D - 6.0), (px1, D - pd), ext=False, inside=1)
        sc.wall((px1, D - 6.0), (W, D - 6.0), ext=False, inside=1, ops=[(0.8, 1.7, 'DOOR')])
        sc.car((gs0 + gs1) / 2, D - 3.0)
        sc.text(((gs0 + gs1) / 2, D - 5.3), 'GARAZ')
        behind = [(px0, D - pd - 3.0), (px1, D - pd - 3.0), (px1, D - pd), (px0, D - pd)]
        sc.wall((px0, D - pd - 3.0), (px1, D - pd - 3.0), ext=False, inside=1, ops=[(0.5, 1.4, 'DOOR')])
        sc.stair(px0 + 0.2, D - pd - 2.9, px0 + 1.1, D - pd - 0.2, n=10)
        sc.region('hall', 'BODY', behind)
        sc.region('porch', 'PORCH', [(px0, D - pd), (px1, D - pd), (px1, D), (px0, D)])
        ans_side, ans_behind, fact = 'SEVERAL_OPENINGS', 'YES', 'porch mouth + pier + garage door'
    else:
        # the wings end; an open patio between them, closed only by the main body's inner wall
        ow = gs1 - px0
        rw0 = px0 + ow
        sc.wall((rw0, D), (W, D), inside=-1)
        pdeep = rng.uniform(3.0, 4.0)
        sc.wall((px0, D - pdeep), (px0, D), inside=-1)
        sc.wall((rw0, D - pdeep), (rw0, D), inside=1)
        sc.wall((px0, D - pdeep), (rw0, D - pdeep), inside=-1, ops=[(0.6, 2.4, 'SLIDING')])
        sc.texture([(px0 + t / 2, D - pdeep + t / 2), (rw0 - t / 2, D - pdeep + t / 2), (rw0 - t / 2, D), (px0 + t / 2, D)])
        sc.text(((px0 + rw0) / 2, D - pdeep / 2), 'PATIO')
        behind = [(px0, D - pdeep), (rw0, D - pdeep), (rw0, D), (px0, D)]
        sc.region('patio', 'TERRACE', behind)
        ans_side, ans_behind, fact = 'ONE_OPEN_SIDE', 'NO', 'one open side to a patio'
    _rooms(sc, 0, 0, px0, D)
    stretch = [(px0 - 0.1, D), (gs1 + 0.1, D)]
    return sc, [
        {'cls': 'OPEN_SIDE_VS_OPENINGS', 'target': stretch, 'answer': ans_side, 'fact': fact},
        {'cls': 'BODY_REGION', 'target': behind, 'answer': ans_behind, 'fact': 'hall behind porch' if v == 'A' else 'open patio'},
    ]


def fam_terrace_vs_room(rng, st, v):
    """A rectangle beside the body closed by exterior walls (A, a room) / the same rectangle drawn as a terrace (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    tw, td = rng.uniform(3.0, 4.5), rng.uniform(4.0, D - 1.0)
    ty0 = rng.uniform(0, D - td)
    if v == 'A':
        _main_body(sc, W, D, other={'E': [(ty0 + 0.6, ty0 + td - 0.6, 'OPEN')]})
        sc.wall((W, ty0), (W + tw, ty0), inside=1, ops=sc.windows_on(tw, 1, wmax=1.2))
        sc.wall((W + tw, ty0), (W + tw, ty0 + td), inside=1, ops=sc.windows_on(td, 1))
        sc.wall((W, ty0 + td), (W + tw, ty0 + td), inside=-1, ops=sc.windows_on(tw, 1, wmax=1.2))
        sc.text((W + tw / 2, ty0 + td / 2), 'POKOJ')
        role = 'BODY'
    else:
        _main_body(sc, W, D, other={'E': [(ty0 + 0.8, ty0 + 2.6, 'SLIDING')]})
        sc.rect_line(W + st['extWall'] / 2, ty0, W + tw, ty0 + td)
        sc.texture([(W + st['extWall'] / 2, ty0), (W + tw, ty0), (W + tw, ty0 + td), (W + st['extWall'] / 2, ty0 + td)])
        sc.text((W + tw / 2, ty0 + td / 2), 'TARAS')
        role = 'TERRACE'
    _rooms(sc, 0, 0, W, D)
    rect = [(W, ty0), (W + tw, ty0), (W + tw, ty0 + td), (W, ty0 + td)]
    sc.region('annex', role, rect)
    body = [(0, 0), (W, 0), (W, D), (0, D)]
    with_annex = list(Polygon(body).union(Polygon(rect)).exterior.coords)[:-1]
    right, wrong = (with_annex, body) if v == 'A' else (body, with_annex)
    return sc, [
        {'cls': 'TERRACE_VS_BODY', 'target': rect, 'answer': 'ENCLOSED' if v == 'A' else 'EXTERNAL', 'fact': 'walled annex' if v == 'A' else 'terrace'},
        {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {'A': right, 'B': wrong}, 'answer': 'A', 'fact': 'outline with/without annex'},
        {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {'A': wrong, 'B': right}, 'answer': 'B', 'fact': 'outline with/without annex (letters swapped)'},
    ]


def fam_pergola_line(rng, st, v):
    """A pergola beam line on posts (A) / the same line built as an enclosing exterior wall (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    pd = rng.uniform(2.5, 3.5)
    x0, x1 = rng.uniform(1.0, 2.5), W - rng.uniform(1.0, 2.5)
    if v == 'A':
        _main_body(sc, W, D, front_ops=[(x0 + 0.5, x0 + 2.6, 'SLIDING')])
        sc.texture([(x0, D + st['extWall'] / 2), (x1, D + st['extWall'] / 2), (x1, D + pd), (x0, D + pd)])
        for xx in (x0, x1):
            sc.line([(xx, D), (xx, D + pd)], w='thin')
        sc.line([(x0, D + pd - 0.08), (x1, D + pd - 0.08)])
        sc.line([(x0, D + pd + 0.08), (x1, D + pd + 0.08)])
        k = int((x1 - x0) / 0.6)
        for i in range(1, k):
            xx = x0 + (x1 - x0) * i / k
            sc.line([(xx, D + 0.2), (xx, D + pd + 0.2)], dash=(0.2, 0.12))
        for xx in (x0, x1):
            sc.column(xx, D + pd, 0.25)
        sc.text(((x0 + x1) / 2, D + pd / 2), 'PERGOLA')
        role = 'PERGOLA'
    else:
        _main_body(sc, W, D, front_ops=[(x0 + 0.5, x0 + 1.5, 'DOOR')])
        sc.wall((x0, D), (x0, D + pd), inside=-1)
        sc.wall((x1, D), (x1, D + pd), inside=1)
        sc.wall((x0, D + pd), (x1, D + pd), inside=-1, ops=sc.windows_on(x1 - x0, 2))
        sc.text(((x0 + x1) / 2, D + pd / 2), 'OGROD ZIM.')
        role = 'BODY'
    _rooms(sc, 0, 0, W, D)
    sc.region('front', role, [(x0, D), (x1, D), (x1, D + pd), (x0, D + pd)])
    xm = (x0 + x1) / 2
    seg = [(xm - 0.9, D + pd), (xm + 0.9, D + pd)]
    for s0, s1, k in (sc.walls[-1]['ops'] if v == 'B' else []):
        if not (x0 + s1 < xm - 0.9 or x0 + s0 > xm + 0.9):
            pass
    return sc, [{'cls': 'CANOPY_PERGOLA_VS_WALL', 'target': seg, 'answer': 'NOT_WALL' if v == 'A' else 'WALL', 'fact': 'pergola beam' if v == 'A' else 'enclosing wall'}]


def fam_canopy_roofline(rng, st, v):
    """A dashed roof projection beyond the facade (A) / a wall at the same place, the room extended (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    ov = rng.uniform(0.6, 1.2)
    if v == 'A':
        _main_body(sc, W, D)
        sc.line([(-ov, -ov), (W + ov, -ov), (W + ov, D + ov), (-ov, D + ov)], dash=(0.35, 0.2), closed=True)
        role = 'ROOF_PROJECTION'
    else:
        _main_body(sc, W, D, other={'E': []})
        sc.wall((W, 0), (W + ov + 0.6, 0), inside=1)
        sc.wall((W + ov + 0.6, 0), (W + ov + 0.6, D), inside=1, ops=sc.windows_on(D, 2))
        sc.wall((W, D), (W + ov + 0.6, D), inside=-1)
        sc.walls[1]['ext'] = False
        sc.walls[1]['t'] = 0.12
        sc.walls[1]['ops'] = [(1.0, 1.9, 'DOOR')]
        role = 'BODY'
    _rooms(sc, 0, 0, W, D)
    ym = D / 2
    x = W + ov if v == 'A' else W + ov + 0.6
    seg = [(x, ym - 0.9), (x, ym + 0.9)]
    for s0, s1, k in (sc.walls[-2]['ops'] if v == 'B' else []):
        if s0 - 0.2 < ym + 0.9 and s1 + 0.2 > ym - 0.9:
            sc.walls[-2]['ops'] = [o for o in sc.walls[-2]['ops'] if o != (s0, s1, k)]
    return sc, [{'cls': 'CANOPY_PERGOLA_VS_WALL', 'target': seg, 'answer': 'NOT_WALL' if v == 'A' else 'WALL', 'fact': 'roof projection' if v == 'A' else 'exterior wall'}]


def fam_podcien(rng, st, v):
    """An undercut corner on a column under the upper floor (A) / the same corner enclosed by walls (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(10, 13), rng.uniform(8, 10)
    cw, cd = rng.uniform(2.5, 3.5), rng.uniform(2.0, 3.0)
    t = st['extWall']
    if v == 'A':
        sc.wall((0, 0), (W, 0), inside=1, ops=sc.windows_on(W, 2))
        sc.wall((0, 0), (0, D), inside=-1, ops=sc.windows_on(D, 1))
        sc.wall((W, 0), (W, D - cd), inside=1, ops=sc.windows_on(D - cd, 1))
        sc.wall((W - cw, D - cd), (W, D - cd), inside=-1)
        sc.wall((W - cw, D - cd), (W - cw, D), inside=1, ops=[(0.4, 1.4, 'DOOR')])
        sc.wall((0, D), (W - cw, D), inside=-1, ops=sc.windows_on(W - cw, 1))
        sc.line([(W - cw, D), (W, D), (W, D - cd)], dash=(0.3, 0.18))
        sc.column(W, D, 0.35)
        role, colans = 'UNDERCUT', 'COLUMN'
    else:
        _main_body(sc, W, D)
        role, colans = 'BODY', 'WALL'
    _rooms(sc, 0, 0, W - cw, D)
    corner = [(W - cw, D - cd), (W, D - cd), (W, D), (W - cw, D)]
    sc.region('corner', role, corner)
    cb = [(W - 0.35, D - 0.35), (W + 0.35, D - 0.35), (W + 0.35, D + 0.35), (W - 0.35, D + 0.35)]
    return sc, [
        {'cls': 'BODY_REGION', 'target': corner, 'answer': 'NO' if v == 'A' else 'YES', 'fact': 'podcien' if v == 'A' else 'enclosed corner'},
        {'cls': 'COLUMN_VS_WALL', 'target': cb, 'answer': colans, 'fact': 'free column' if v == 'A' else 'wall corner'},
    ]


def fam_bay(rng, st, v):
    """A walled bay or risalit with windows (A) / the same outline as a thin planter or steps (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    bw, bd = rng.uniform(2.4, 4.0), rng.uniform(0.9, 1.6)
    bx0 = rng.uniform(1.5, W - bw - 1.5)
    if v == 'A':
        _main_body(sc, W, D, front_ops=[(bx0 + 0.3, bx0 + bw - 0.3, 'OPEN')])
        sc.wall((bx0, D), (bx0, D + bd), inside=-1)
        sc.wall((bx0 + bw, D), (bx0 + bw, D + bd), inside=1)
        sc.wall((bx0, D + bd), (bx0 + bw, D + bd), inside=-1, ops=[(0.5, bw - 0.5, 'WINDOW')])
        role = 'BAY'
    else:
        _main_body(sc, W, D, front_ops=sc.windows_on(W, 2))
        sc.rect_line(bx0, D + st['extWall'] / 2, bx0 + bw, D + bd)
        for i in range(1, 3):
            sc.line([(bx0, D + bd * i / 3), (bx0 + bw, D + bd * i / 3)])
        sc.text((bx0 + bw / 2, D + bd + 0.4), 'SCHODY', size=0.25)
        role = 'STEPS'
    _rooms(sc, 0, 0, W, D)
    bay = [(bx0, D), (bx0 + bw, D), (bx0 + bw, D + bd), (bx0, D + bd)]
    sc.region('bay', role, bay)
    return sc, [{'cls': 'BAY_OR_RISALIT', 'target': bay, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'walled bay' if v == 'A' else 'steps outline'}]


def fam_glazing_terrace(rng, st, v):
    """cyklamenach analogue. A: a window and a double door in the wall beside a densely textured terrace - openings.
    B: the dark band at the same place is the terrace's textured kerb with a break in its texture - pattern."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    t = st['extWall']
    ww = rng.uniform(1.6, 2.0)
    s0 = rng.uniform(1.0, W / 2 - ww)
    dd0 = s0 + ww + rng.uniform(1.0, 2.0)
    td = rng.uniform(2.5, 3.5)
    if v == 'A':
        _main_body(sc, W, D, other={'N': [(s0, s0 + ww, 'WINDOW'), (dd0, dd0 + 1.8, 'DOUBLE_DOOR')]})
        sc.texture([(0, -td), (W, -td), (W, -t / 2), (0, -t / 2)], kind='BOARDS')
        sc.rect_line(0, -td, W, -t / 2)
        seg = [(s0, 0), (s0 + ww, 0)]
        ans = 'OPENING'
    else:
        # the house's north wall is plain; the terrace beyond it has a wall-thick textured kerb with a gap for steps
        _main_body(sc, W, D, other={'N': sc.windows_on(W, 1, wmin=0.8, wmax=1.0)})
        ky = -td
        sc.texture([(0, -td + t), (W, -td + t), (W, -t / 2), (0, -t / 2)], kind='BOARDS')
        sc.texture([(0, ky - t / 2), (s0, ky - t / 2), (s0, ky + t / 2), (0, ky + t / 2)], kind='HATCH')
        sc.texture([(s0 + ww, ky - t / 2), (W, ky - t / 2), (W, ky + t / 2), (s0 + ww, ky + t / 2)], kind='HATCH')
        sc.rect_line(0, ky - t / 2, W, -t / 2)
        seg = [(s0, ky), (s0 + ww, ky)]
        ans = 'PATTERN'
    _rooms(sc, 0, 0, W, D)
    sc.region('terrace', 'TERRACE', [(0, -td), (W, -td), (W, 0), (0, 0)])
    return sc, [{'cls': 'OPENING_VS_PATTERN', 'target': seg, 'answer': ans, 'fact': 'window beside textured terrace' if v == 'A' else 'break in textured kerb'}]


def fam_multi_window(rng, st, v):
    """Glazing or a wide sliding door in a continuing wall (A) / the same gap where the walls genuinely end (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(10, 13), rng.uniform(8, 10)
    t = st['extWall']
    gw = rng.uniform(2.8, 4.5)
    g0 = rng.uniform(1.5, W - gw - 1.5)
    kind = rng.choice(['SLIDING', 'GLAZED', 'WINDOW'])
    if v == 'A':
        ops = [(g0, g0 + gw, kind)]
        if rng.random() < 0.5:
            ops = [(g0, g0 + gw / 2 - 0.15, 'WINDOW'), (g0 + gw / 2 + 0.15, g0 + gw, 'WINDOW')]
        _main_body(sc, W, D, front_ops=ops)
        ans = 'CONTINUES'
    else:
        _main_body(sc, W, D, front_ops=[(g0, g0 + gw, 'OPEN')])
        sc.texture([(g0, D + t / 2), (g0 + gw, D + t / 2), (g0 + gw, D + 2.5), (g0, D + 2.5)])
        sc.rect_line(g0 - 1.0, D + t / 2, g0 + gw + 1.0, D + 2.5)
        ans = 'TERMINATES'
    _rooms(sc, 0, 0, W, D)
    a_seg = [(g0 - 0.7, D), (g0, D)]
    b_seg = [(g0 + gw, D), (g0 + gw + 0.7, D)]
    qs = [{'cls': 'WALL_CONTINUATION', 'target': {'A': a_seg, 'B': b_seg}, 'answer': ans, 'fact': kind if v == 'A' else 'open side'}]
    if v == 'A':
        qs.append({'cls': 'OPENING_VS_PATTERN', 'target': [(g0, D), (g0 + gw, D)], 'answer': 'OPENING', 'fact': kind})
    return sc, qs


def fam_void_vs_courtyard(rng, st, v):
    """A stair void inside the upper floor (A) / an open courtyard of the same size inside the body (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(11, 14), rng.uniform(10, 12)
    vw, vd = rng.uniform(2.5, 3.5), rng.uniform(2.5, 3.5)
    vx0, vy0 = rng.uniform(3.5, W - vw - 3.5), rng.uniform(3.0, D - vd - 3.0)
    _main_body(sc, W, D)
    rect = [(vx0, vy0), (vx0 + vw, vy0), (vx0 + vw, vy0 + vd), (vx0, vy0 + vd)]
    if v == 'A':
        sc.rect_line(vx0, vy0, vx0 + vw, vy0 + vd, w='mid')
        sc.line([(vx0, vy0), (vx0 + vw, vy0 + vd)])
        sc.line([(vx0 + vw, vy0), (vx0, vy0 + vd)])
        sc.stair(vx0 + 0.1, vy0 + 0.1, vx0 + 1.0, vy0 + vd - 0.1, n=10)
        sc.text((vx0 + vw / 2 + 0.4, vy0 + vd + 0.4), 'PUSTKA', size=0.25)
        role, ans = 'VOID', 'VOID'
    else:
        sc.rect_walls(vx0, vy0, vx0 + vw, vy0 + vd, {'N': [(0.6, vw - 0.6, 'WINDOW')], 'S': [(0.5, 1.5, 'DOOR')]})
        for w in sc.walls[-4:]:
            w['inside'] = -w['inside']
        sc.texture([(vx0 + 0.2, vy0 + 0.2), (vx0 + vw - 0.2, vy0 + 0.2), (vx0 + vw - 0.2, vy0 + vd - 0.2), (vx0 + 0.2, vy0 + vd - 0.2)], kind='TILES')
        sc.text((vx0 + vw / 2, vy0 + vd / 2), 'ATRIUM', size=0.25)
        role, ans = 'COURTYARD', 'OUTSIDE'
    sc.region('void', role, rect)
    return sc, [{'cls': 'VOID_VS_OUTSIDE', 'target': rect, 'answer': ans, 'fact': 'stair void' if v == 'A' else 'courtyard'}]


def fam_storey(rng, st, v):
    """Two panels: ground floor with a wing, upper floor that covers the wing (A) / ends before it (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(8, 10), rng.uniform(8, 10)
    ww = rng.uniform(3.4, 4.2)
    wd = rng.uniform(5.0, D)
    gap = 3.0
    # ground: body + wing on the east
    _main_body(sc, W, D, other={'E': [(D - wd + 0.5, D - wd + 1.4, 'DOOR')] if wd < D else [(1.0, 1.9, 'DOOR')]})
    sc.rect_walls(W, D - wd, W + ww, D, {'S': [(0.5, ww - 0.5, 'GARAGE_DOOR')]}, skip=('W',))
    sc.car(W + ww / 2, D - wd / 2)
    sc.text((W / 2, -0.8), 'PARTER', size=0.45)
    # upper: offset to the right
    ox = W + ww + gap
    cover = v == 'A'
    UW = W + (ww if cover else 0)
    sc.rect_walls(ox, 0, ox + W, D, {'N': sc.windows_on(W, 2), 'S': sc.windows_on(W, 2), 'W': sc.windows_on(D, 1), 'E': [] if cover else sc.windows_on(D, 1)}, skip=('E',) if cover else ())
    if cover:
        sc.rect_walls(ox + W, D - wd, ox + W + ww, D, {'E': sc.windows_on(wd, 1), 'S': sc.windows_on(ww, 1)}, skip=('W',))
        sc.wall((ox + W, 0), (ox + W, D - wd), inside=1, ops=sc.windows_on(D - wd, 1) if D - wd > 2 else [])
        sc.wall((ox + W, D - wd), (ox + W, D), ext=False, inside=1, ops=[(0.8, 1.7, 'DOOR')])
    else:
        sc.line([(ox + W, D - wd), (ox + W + ww, D - wd), (ox + W + ww, D), (ox + W, D)], dash=(0.3, 0.2))
        sc.text((ox + W + ww / 2, D - wd / 2), 'DACH', size=0.3)
    sc.text((ox + W / 2, -0.8), 'PIETRO', size=0.45)
    wing = [(W, D - wd), (W + ww, D - wd), (W + ww, D), (W, D)]
    sc.region('wing', 'GARAGE', wing)
    sc.panels = ['GROUND', 'UPPER']
    return sc, [{'cls': 'STOREY_COVERAGE', 'target': wing, 'answer': 'YES' if cover else 'NO', 'fact': 'upper covers wing' if cover else 'upper ends before wing', 'wholeImage': True}]


def fam_dim_vs_building(rng, st, v):
    """A dimension line outside the facade (A) / a terrace edge line at the same place (B)."""
    sc = Scene(rng, st)
    st2 = dict(st)
    st2['dims'] = 1
    sc.st = st2
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    _main_body(sc, W, D)
    _rooms(sc, 0, 0, W, D)
    off = rng.uniform(1.0, 1.6)
    if v == 'A':
        sc.dim((0, D), (W, D), off, str(int(round(W * 100))))
        x0, x1 = 0.0, W
        ans = 'ANNOTATION'
    else:
        x0, x1 = rng.uniform(0.5, 2.0), W - rng.uniform(0.5, 2.0)
        sc.rect_line(x0, D + st['extWall'] / 2, x1, D + off)
        sc.texture([(x0, D + st['extWall'] / 2), (x1, D + st['extWall'] / 2), (x1, D + off), (x0, D + off)])
        ans = 'BUILDING'
    xm = (x0 + x1) / 2
    seg = [(xm - 1.0, D + off), (xm + 1.0, D + off)]
    qs = [{'cls': 'DIMENSION_LINE_VS_BUILDING_LINE', 'target': seg, 'answer': ans, 'fact': 'dimension line' if v == 'A' else 'terrace edge'}]
    if v == 'A':
        qs.append({'cls': 'DIMENSION_LINE_VS_BUILDING_LINE', 'target': [(xm - 1.0, D), (xm + 1.0, D)], 'answer': 'BUILDING', 'fact': 'facade wall'})
    return sc, qs


def fam_column_vs_pier(rng, st, v):
    """An isolated post (A) / the same dark square as a pier between two windows in a facade (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    s = st['extWall']
    cx = rng.uniform(2.5, W - 2.5)
    if v == 'A':
        _main_body(sc, W, D)
        cy = D + rng.uniform(1.8, 2.5)
        sc.column(cx, cy, s)
        sc.column(cx + rng.uniform(2.0, 3.0), cy, s)
        sc.line([(cx - 1.0, D), (cx - 1.0, cy + 0.4), (cx + 4.0, cy + 0.4), (cx + 4.0, D)], dash=(0.3, 0.2))
        ans = 'COLUMN'
    else:
        cy = D
        _main_body(sc, W, D, front_ops=[(cx - s / 2 - 1.4, cx - s / 2, 'WINDOW'), (cx + s / 2, cx + s / 2 + 1.4, 'WINDOW')])
        ans = 'WALL'
    _rooms(sc, 0, 0, W, D)
    tb = [(cx - s * 1.2, cy - s * 1.2), (cx + s * 1.2, cy - s * 1.2), (cx + s * 1.2, cy + s * 1.2), (cx - s * 1.2, cy + s * 1.2)]
    return sc, [{'cls': 'COLUMN_VS_WALL', 'target': tb, 'answer': ans, 'fact': 'free post' if v == 'A' else 'pier between windows'}]


def fam_car_garage(rng, st, v):
    """A car in an enclosed garage (A) / the same car on an open driveway beside the house (B)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    gw, gd = rng.uniform(3.4, 4.0), rng.uniform(5.5, 6.5)
    if v == 'A':
        _main_body(sc, W, D, other={'E': [(D - gd + 1.0, D - gd + 1.9, 'DOOR')]})
        sc.rect_walls(W, D - gd, W + gw, D, {'S': [(0.4, gw - 0.4, 'GARAGE_DOOR')]}, skip=('W',))
        role, ans = 'GARAGE', 'YES'
    else:
        _main_body(sc, W, D)
        sc.texture([(W + 0.5, D - gd), (W + 0.5 + gw, D - gd), (W + 0.5 + gw, D + 2.0), (W + 0.5, D + 2.0)], kind='TILES')
        role, ans = 'DRIVEWAY', 'NO'
    _rooms(sc, 0, 0, W, D)
    cx = W + gw / 2 + (0 if v == 'A' else 0.5)
    sc.car(cx, D - gd / 2)
    reg = [(W + (0 if v == 'A' else 0.5), D - gd), (W + gw + (0 if v == 'A' else 0.5), D - gd), (W + gw + (0 if v == 'A' else 0.5), D), (W + (0 if v == 'A' else 0.5), D)]
    sc.region('garage', role, reg)
    return sc, [{'cls': 'GARAGE_BODY', 'target': reg, 'answer': ans, 'fact': 'closed garage' if v == 'A' else 'open driveway'}]


def fam_outer_boundary_mix(rng, st, v):
    """An L-shaped body with a garage and a terrace; two candidate outlines. A: one is right. B: both wrong (NEITHER)."""
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    gw, gd = rng.uniform(3.4, 4.0), rng.uniform(5.5, 6.5)
    _main_body(sc, W, D, other={'E': [(D - gd + 1.0, D - gd + 1.9, 'DOOR')]})
    sc.rect_walls(W, D - gd, W + gw, D, {'S': [(0.4, gw - 0.4, 'GARAGE_DOOR')]}, skip=('W',))
    sc.car(W + gw / 2, D - gd / 2)
    td = rng.uniform(2.5, 3.5)
    tx1 = rng.uniform(W * 0.5, W)
    sc.rect_line(0, -td, tx1, -st['extWall'] / 2)
    sc.texture([(0, -td), (tx1, -td), (tx1, -st['extWall'] / 2), (0, -st['extWall'] / 2)])
    sc.text((tx1 / 2, -td / 2), 'TARAS')
    _rooms(sc, 0, 0, W, D)
    body = Polygon([(0, 0), (W, 0), (W, D), (0, D)])
    garage = Polygon([(W, D - gd), (W + gw, D - gd), (W + gw, D), (W, D)])
    terr = Polygon([(0, -td), (tx1, -td), (tx1, 0), (0, 0)])
    right = list(body.union(garage).exterior.coords)[:-1]
    no_garage = list(body.exterior.coords)[:-1]
    with_terrace = list(body.union(garage).union(terr).exterior.coords)[:-1]
    if v == 'A':
        wrong = rng.choice([no_garage, with_terrace])
        return sc, [
            {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {'A': right, 'B': wrong}, 'answer': 'A', 'fact': 'one right outline'},
            {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {'A': wrong, 'B': right}, 'answer': 'B', 'fact': 'one right outline (letters swapped)'},
        ]
    return sc, [
        {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {'A': no_garage, 'B': with_terrace}, 'answer': 'NEITHER', 'fact': 'both outlines wrong'},
        {'cls': 'OUTER_BOUNDARY_A_OR_B', 'target': {'A': with_terrace, 'B': no_garage}, 'answer': 'NEITHER', 'fact': 'both outlines wrong (letters swapped)'},
    ]


FAMILIES = {
    'garage_link': fam_garage_link,
    'detached_garage': fam_detached_garage,
    'garage_door_vs_open': fam_garage_door_vs_open,
    'porch_recess': fam_porch_recess,
    'porch_plus_garage': fam_porch_plus_garage,
    'terrace_vs_room': fam_terrace_vs_room,
    'pergola_line': fam_pergola_line,
    'canopy_roofline': fam_canopy_roofline,
    'podcien': fam_podcien,
    'bay': fam_bay,
    'glazing_terrace': fam_glazing_terrace,
    'multi_window': fam_multi_window,
    'void_vs_courtyard': fam_void_vs_courtyard,
    'storey': fam_storey,
    'dim_vs_building': fam_dim_vs_building,
    'column_vs_pier': fam_column_vs_pier,
    'car_garage': fam_car_garage,
    'outer_boundary_mix': fam_outer_boundary_mix,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--seeds', type=int, default=4)
    ap.add_argument('--seed-base', type=int, default=50050)
    ap.add_argument('--families', default='all')
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, 'renders'), exist_ok=True)
    fams = list(FAMILIES) if a.families == 'all' else a.families.split(',')
    scenes, questions = [], []
    for fam in fams:
        for k in range(a.seeds):
            seed = a.seed_base + 1000 * fams.index(fam) + k
            style = sample_style(random.Random(seed * 7 + 1))
            pair = f'{fam}-s{k}'
            for variant in ('A', 'B'):
                for tf in TRANSFORMS:
                    rng = random.Random(seed)       # the same draw for both members of the pair
                    sc, qs = FAMILIES[fam](rng, style, variant)
                    sid = f'{pair}-{variant}-{tf}'
                    png = os.path.join(a.out, 'renders', f'{sid}.png')
                    info = render(sc, tf, png)
                    M = info['map']
                    with open(png, 'rb') as fh:
                        pix_sha = hashlib.sha256(fh.read()).hexdigest()
                    scenes.append({'sceneId': sid, 'family': fam, 'pair': pair, 'variant': variant, 'transform': tf, 'seed': seed, 'style': style, 'size': info['size'], 'pngSha256': pix_sha,
                                   'regions': [{'id': r['id'], 'role': r['role'], 'px': [M(p) for p in r['pts']]} for r in sc.regions], 'panels': sc.panels})
                    for qi, q in enumerate(qs):
                        tgt = q['target']
                        if isinstance(tgt, dict):
                            tpx = {k2: [M(p) for p in v2] for k2, v2 in tgt.items()}
                        else:
                            tpx = [M(p) for p in tgt]
                        questions.append({'qid': f'{sid}-q{qi}', 'baseQid': f'{pair}-{variant}-q{qi}', 'pairQid': f'{pair}-{"B" if variant == "A" else "A"}-q{qi}', 'sceneId': sid, 'family': fam, 'pair': pair,
                                          'variant': variant, 'transform': tf, 'cls': q['cls'], 'enum': CLASSES[q['cls']]['enum'], 'targetKind': CLASSES[q['cls']]['target'],
                                          'targetPx': tpx, 'expected': q['answer'], 'fact': q['fact'], 'wholeImage': bool(q.get('wholeImage'))})
    meta = {'generator': 'research/analyzer-005j/synthetic/vrgen.py', 'version': GENERATOR_VERSION, 'seeds': a.seeds, 'seedBase': a.seed_base, 'families': fams, 'transforms': TRANSFORMS,
            'classes': CLASSES, 'scenes': scenes, 'questions': questions}
    with open(os.path.join(a.out, 'corpus.json'), 'w') as fh:
        json.dump(meta, fh, indent=0)
    print(json.dumps({'scenes': len(scenes), 'questions': len(questions), 'byClass': {c: sum(1 for q in questions if q['cls'] == c) for c in CLASSES}}, indent=1))


if __name__ == '__main__':
    main()
