"""IU-02 synthetic houses with exact ground truth (truth by construction, no publisher pixels).

One parametric house (body, gable roof, chimney, windows, door, optional garage gate, balcony, storey band) is
rendered by a small polygon painter in several *styles* and *projections*:

  ELEVATION   orthographic front view          styles FLAT (OWNER-like simplified), RENDER (sky, grass, textures,
                                                shadows, trees), LINE (technical, hatching, level marks, dimensions)
  PERSPECTIVE pinhole camera, near-frontal (yaw 2–12°) or corner (25–60°)   styles FLAT, RENDER, LINE
  SECTION     vertical cut through the same house (poché or hatched walls/slabs, interior partitions, stair),
              optionally coloured so that it resembles an elevation
  INTERIOR    pinhole camera inside a furnished box room                     styles FLAT, RENDER
  PLAN        top view of walls, door arcs, windows, dimension chains        style LINE
  COLLAGE     2×2 / 1×2 sheet of the above (a multi-view document, not a single facade)

Every image comes with: class, projection, style, the camera, a semantic label map (see LABELS; the label map is what
was painted last at each pixel, so it is consistent with the pixels), the occluder mask (trees, bushes) and, for
elevations, architectural points (building, window, door, gate corners; eave line; ridge/apex; chimney; balcony) in
image pixels with an `occluded` flag. RESEARCH ONLY.
"""
import json, math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LABELS = {'BACKGROUND': 0, 'WALL': 1, 'ROOF': 2, 'CHIMNEY': 3, 'WINDOW': 4, 'DOOR': 5, 'GATE': 6, 'BALCONY': 7,
          'OCCLUDER': 8, 'SKY': 9, 'GROUND': 10, 'SECTION_CUT': 11, 'INTERIOR': 12, 'ANNOTATION': 13}
SS = 2  # supersampling of the painter

PALETTE = {
    'plaster': [(236, 233, 226), (222, 216, 204), (200, 200, 198), (240, 236, 220), (214, 205, 188)],
    'brick': [(160, 82, 60), (176, 104, 74), (128, 70, 56)],
    'wood': [(138, 98, 66), (110, 80, 58), (156, 120, 84)],
    'roof': [(64, 64, 68), (90, 50, 40), (52, 58, 66), (120, 66, 50), (80, 80, 84)],
    'glass': [(176, 196, 210), (160, 184, 204), (190, 206, 214)],
    'frame': [(60, 60, 64), (240, 240, 240), (90, 70, 56)],
    'gate': [(110, 110, 112), (200, 200, 200), (126, 92, 64)],
}


def house_params(rnd: random.Random):
    storeys = rnd.choice([1, 1, 2, 2, 2])
    sh = rnd.uniform(2.8, 3.2)
    plinth = rnd.uniform(0.15, 0.5)
    W = rnd.uniform(8.0, 16.0)
    D = rnd.uniform(7.0, 12.0)
    ridge_x = rnd.random() < 0.6  # ridge parallel to the front facade (eaves facing the viewer)
    pitch = math.radians(rnd.uniform(22, 45))
    over = rnd.uniform(0.3, 0.8)
    H = plinth + storeys * sh  # wall top
    wallmat = rnd.choice(['plaster', 'plaster', 'plaster', 'brick', 'wood'])
    p = {'storeys': storeys, 'storeyH': sh, 'plinth': plinth, 'W': W, 'D': D, 'H': H, 'ridgeAlongFront': ridge_x,
         'pitchDeg': math.degrees(pitch), 'overhang': over, 'wallMaterial': wallmat,
         'wallColor': rnd.choice(PALETTE[wallmat]), 'accentColor': rnd.choice(PALETTE['wood'] + PALETTE['brick']),
         'roofColor': rnd.choice(PALETTE['roof']), 'glassColor': rnd.choice(PALETTE['glass']),
         'frameColor': rnd.choice(PALETTE['frame']), 'gateColor': rnd.choice(PALETTE['gate']),
         'band': storeys == 2 and rnd.random() < 0.5}
    half = (D if ridge_x else W) / 2 + over
    p['ridgeH'] = H + half * math.tan(pitch)
    # openings on the front facade, per storey, non-overlapping
    openings = []
    gate = storeys >= 1 and rnd.random() < 0.35 and W > 10
    x = 0.8
    gate_w = rnd.uniform(2.4, 4.8) if gate else 0
    if gate:
        openings.append({'kind': 'GATE', 'x0': x, 'x1': x + gate_w, 'y0': plinth, 'y1': plinth + 2.2, 'storey': 0})
        x += gate_w + 0.8
    door_at = rnd.uniform(x, max(x, W - 2.2))
    openings.append({'kind': 'DOOR', 'x0': door_at, 'x1': door_at + 1.0, 'y0': plinth, 'y1': plinth + 2.15, 'storey': 0})
    for s in range(storeys):
        floor = plinth + s * sh
        n = rnd.randint(1, 4)
        ww = rnd.uniform(0.9, 1.8)
        wh = rnd.uniform(1.2, 1.6) if rnd.random() < 0.8 else rnd.uniform(2.0, 2.3)
        sill = floor + (rnd.uniform(0.85, 0.95) if wh < 1.9 else 0.05)
        slots = np.linspace(0.6, W - 0.6 - ww, max(2, n + 2))[1:-1] if n > 0 else []
        for sx in slots:
            box = {'kind': 'WINDOW', 'x0': float(sx), 'x1': float(sx) + ww, 'y0': sill, 'y1': sill + wh, 'storey': s,
                   'mullions': rnd.choice([0, 0, 1, 2])}
            if all(box['x1'] + 0.3 < o['x0'] or box['x0'] > o['x1'] + 0.3 or box['y1'] < o['y0'] or box['y0'] > o['y1'] for o in openings):
                openings.append(box)
    p['openings'] = openings
    p['balcony'] = None
    if storeys == 2 and rnd.random() < 0.4:
        bw = rnd.uniform(2.0, 4.0); bx = rnd.uniform(0.5, W - bw - 0.5)
        p['balcony'] = {'x0': bx, 'x1': bx + bw, 'y': plinth + sh, 'depth': rnd.uniform(0.9, 1.4), 'slab': 0.2, 'rail': 1.0,
                        'glassRail': rnd.random() < 0.5}
    if rnd.random() < 0.8:
        cx = rnd.uniform(0.2, 0.8) * W; cz = -rnd.uniform(0.25, 0.75) * D
        p['chimney'] = {'x0': cx, 'x1': cx + rnd.uniform(0.45, 0.8), 'z0': cz - 0.6, 'z1': cz, 'top': p['ridgeH'] + rnd.uniform(0.4, 1.2)}
    else:
        p['chimney'] = None
    return p


def roof_height_at(p, x, z):
    """Height of the roof surface over plan point (x, z) (z in [-D, 0])."""
    over, pitch = p['overhang'], math.radians(p['pitchDeg'])
    if p['ridgeAlongFront']:
        d = abs(z + p['D'] / 2)
        return p['ridgeH'] - d * math.tan(pitch)
    d = abs(x - p['W'] / 2)
    return p['ridgeH'] - d * math.tan(pitch)


def house_polys(p):
    """3D polygons (label, colour key, points[(x,y,z)], normal) of the house."""
    W, D, H, o = p['W'], p['D'], p['H'], p['overhang']
    P = []
    def add(label, key, pts, n):
        P.append({'label': label, 'key': key, 'pts': [tuple(map(float, q)) for q in pts], 'n': n})
    add('WALL', 'wall', [(0, 0, 0), (W, 0, 0), (W, H, 0), (0, H, 0)], (0, 0, 1))
    add('WALL', 'wall', [(W, 0, 0), (W, 0, -D), (W, H, -D), (W, H, 0)], (1, 0, 0))
    add('WALL', 'wall', [(0, 0, -D), (0, 0, 0), (0, H, 0), (0, H, -D)], (-1, 0, 0))
    add('WALL', 'wall', [(W, 0, -D), (0, 0, -D), (0, H, -D), (W, H, -D)], (0, 0, -1))
    R = p['ridgeH']
    pitch = math.radians(p['pitchDeg'])
    eaveY = H - o * math.tan(pitch)
    if p['ridgeAlongFront']:
        zc = -D / 2
        add('ROOF', 'roof', [(-o, eaveY, o), (W + o, eaveY, o), (W + o, R, zc), (-o, R, zc)], (0, math.cos(pitch), math.sin(pitch)))
        add('ROOF', 'roof', [(W + o, eaveY, -D - o), (-o, eaveY, -D - o), (-o, R, zc), (W + o, R, zc)], (0, math.cos(pitch), -math.sin(pitch)))
        add('WALL', 'wall', [(W, H, 0), (W, H, -D), (W, R, zc)], (1, 0, 0))
        add('WALL', 'wall', [(0, H, -D), (0, H, 0), (0, R, zc)], (-1, 0, 0))
    else:
        xc = W / 2
        add('ROOF', 'roof', [(-o, eaveY, -D - o), (-o, eaveY, o), (xc, R, o), (xc, R, -D - o)], (-math.sin(pitch), math.cos(pitch), 0))
        add('ROOF', 'roof', [(W + o, eaveY, o), (W + o, eaveY, -D - o), (xc, R, -D - o), (xc, R, o)], (math.sin(pitch), math.cos(pitch), 0))
        add('WALL', 'wall', [(0, H, 0), (W, H, 0), (xc, R, 0)], (0, 0, 1))
        add('WALL', 'wall', [(W, H, -D), (0, H, -D), (xc, R, -D)], (0, 0, -1))
    eps = 0.02
    for k, op in enumerate(p['openings']):
        key = {'WINDOW': 'glass', 'DOOR': 'accent', 'GATE': 'gate'}[op['kind']]
        add(op['kind'], key, [(op['x0'], op['y0'], eps), (op['x1'], op['y0'], eps), (op['x1'], op['y1'], eps), (op['x0'], op['y1'], eps)], (0, 0, 1))
    if p['band']:
        y = p['plinth'] + p['storeyH']
        add('WALL', 'accent', [(0, y - 0.15, 0.03), (W, y - 0.15, 0.03), (W, y + 0.15, 0.03), (0, y + 0.15, 0.03)], (0, 0, 1))
    b = p['balcony']
    if b:
        y, d, t = b['y'], b['depth'], b['slab']
        add('BALCONY', 'slab', [(b['x0'], y - t, d), (b['x1'], y - t, d), (b['x1'], y, d), (b['x0'], y, d)], (0, 0, 1))
        add('BALCONY', 'slab', [(b['x0'], y - t, 0.01), (b['x0'], y - t, d), (b['x0'], y, d), (b['x0'], y, 0.01)], (-1, 0, 0))
        add('BALCONY', 'slab', [(b['x1'], y - t, d), (b['x1'], y - t, 0.01), (b['x1'], y, 0.01), (b['x1'], y, d)], (1, 0, 0))
        add('BALCONY', 'rail', [(b['x0'], y, d), (b['x1'], y, d), (b['x1'], y + b['rail'], d), (b['x0'], y + b['rail'], d)], (0, 0, 1))
    c = p['chimney']
    if c:
        base = min(roof_height_at(p, xx, zz) for xx in (c['x0'], c['x1']) for zz in (c['z0'], c['z1'])) - 0.2
        x0, x1, z0, z1, top = c['x0'], c['x1'], c['z0'], c['z1'], c['top']
        add('CHIMNEY', 'chimney', [(x0, base, z1), (x1, base, z1), (x1, top, z1), (x0, top, z1)], (0, 0, 1))
        add('CHIMNEY', 'chimney', [(x1, base, z1), (x1, base, z0), (x1, top, z0), (x1, top, z1)], (1, 0, 0))
        add('CHIMNEY', 'chimney', [(x0, base, z0), (x0, base, z1), (x0, top, z1), (x0, top, z0)], (-1, 0, 0))
        add('CHIMNEY', 'chimney', [(x0, top, z1), (x1, top, z1), (x1, top, z0), (x0, top, z0)], (0, 1, 0))
    return P


class Camera:
    """kind 'ortho' (front, s px/m) or 'persp' (pinhole). project((x,y,z)) -> (u, v, depth)."""

    def __init__(self, kind, **k):
        self.kind = kind
        self.__dict__.update(k)
        if kind == 'persp':
            yaw, pitch = math.radians(k['yaw']), math.radians(k['pitch'])
            # camera looks along -forward; forward points from target to camera
            f = np.array([math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)])
            self.C = np.array(k['target']) + k['dist'] * f
            zc = -f
            xc = np.cross(zc, [0, 1, 0]); xc /= np.linalg.norm(xc)
            yc = np.cross(xc, zc)
            self.R = np.stack([xc, yc, zc])

    def project(self, q):
        if self.kind == 'ortho':
            return self.u0 + q[0] * self.s, self.v0 - q[1] * self.s, -q[2]
        c = self.R @ (np.array(q) - self.C)
        if c[2] <= 0.05:
            c[2] = 0.05
        return self.cx + self.f * c[0] / c[2], self.cy - self.f * c[1] / c[2], c[2]

    def facing(self, poly):
        n = np.array(poly['n'])
        if self.kind == 'ortho':
            return n[2] > 1e-6 or (abs(n[2]) < 1e-6 and n[1] > 0 and False)
        centre = np.mean(np.array(poly['pts']), axis=0)
        return float(np.dot(n, self.C - centre)) > 0

    def to_json(self):
        d = {k: v for k, v in self.__dict__.items() if k not in ('R', 'C')}
        if self.kind == 'persp':
            d['C'] = self.C.tolist(); d['R'] = self.R.tolist()
        return d


def _noise(rnd, h, w, scale):
    g = np.random.default_rng(rnd.randrange(1 << 30))
    small = g.normal(0, 1, (max(2, h // scale), max(2, w // scale))).astype(np.float32)
    im = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255 - 0.5


def paint(polys, cam, size, colors, style, rnd, line_w=1):
    """Painter's algorithm. Returns (rgb float HxWx3 0..255, label map, face id map, outline layer (uint8))."""
    w, h = size
    img = Image.new('RGB', (w * SS, h * SS), (255, 255, 255))
    lab = Image.new('L', (w * SS, h * SS), 0)
    fid = Image.new('I', (w * SS, h * SS), -1)
    ink = Image.new('L', (w * SS, h * SS), 0)
    di, dl, df, dk = ImageDraw.Draw(img), ImageDraw.Draw(lab), ImageDraw.Draw(fid), ImageDraw.Draw(ink)
    vis = []
    for k, poly in enumerate(polys):
        if not cam.facing(poly):
            continue
        pr = [cam.project(q) for q in poly['pts']]
        depth = float(np.mean([d for _, _, d in pr]))
        bias = {'WINDOW': -0.05, 'DOOR': -0.05, 'GATE': -0.05, 'BALCONY': -0.1, 'CHIMNEY': -0.02}.get(poly['label'], 0.0)
        vis.append((depth + bias, k, [(u * SS, v * SS) for u, v, _ in pr]))
    vis.sort(key=lambda t: -t[0])
    for _, k, pts in vis:
        poly = polys[k]
        di.polygon(pts, fill=colors(poly))
        dl.polygon(pts, fill=LABELS[poly['label']])
        df.polygon(pts, fill=k)
    if style in ('FLAT', 'LINE'):
        for _, k, pts in vis:
            dk.line(pts + [pts[0]], fill=255, width=line_w * SS)
    rgb = np.array(img.resize((w, h), Image.BOX), np.float32)
    labels = np.array(lab.resize((w, h), Image.NEAREST))
    faces = np.array(fid.resize((w, h), Image.NEAREST))
    outline = np.array(ink.resize((w, h), Image.BOX))
    return rgb, labels, faces, outline


def _colors(p, style):
    base = {'wall': p['wallColor'], 'roof': p['roofColor'], 'glass': p['glassColor'], 'accent': p['accentColor'],
            'gate': p['gateColor'], 'slab': (220, 220, 222), 'rail': (150, 170, 180) if (p['balcony'] or {}).get('glassRail') else (70, 70, 72),
            'chimney': p['roofColor'] if p['wallMaterial'] != 'plaster' else (150, 150, 150)}
    if style == 'LINE':
        return lambda poly: (255, 255, 255)
    def c(poly):
        col = np.array(base[poly['key']], np.float32)
        if style == 'RENDER':
            n = np.array(poly['n'], np.float32)
            shade = 0.72 + 0.28 * max(0.0, float(np.dot(n, np.array([0.45, 0.75, 0.48]))))
            col = col * shade
        elif style == 'FLAT' and poly['n'][2] < 0.5 and poly['label'] in ('WALL', 'ROOF'):
            col = col * 0.88
        return tuple(int(v) for v in np.clip(col, 0, 255))
    return c


def _trees(rnd, rgb, labels, ground_v, x_range, height_px, n):
    """Paint 0..n trees/bushes standing on the ground line; returns the occluder mask."""
    h, w = labels.shape
    occ = np.zeros((h, w), bool)
    yy, xx = np.mgrid[0:h, 0:w]
    tex = _noise(rnd, h, w, 6)
    for _ in range(n):
        cx = rnd.uniform(*x_range)
        th = rnd.uniform(0.25, 0.75) * height_px
        tw = th * rnd.uniform(0.35, 0.8)
        cy = ground_v - th * 0.55
        m = ((xx - cx) / (tw / 2)) ** 2 + ((yy - cy) / (th * 0.5)) ** 2 < 1
        m &= tex * 0.4 + rnd.uniform(-0.05, 0.05) < 0.25
        trunk = (abs(xx - cx) < max(2, tw * 0.05)) & (yy > cy) & (yy < ground_v)
        col = np.array(rnd.choice([(62, 100, 52), (84, 120, 60), (48, 82, 46), (100, 128, 70)]), np.float32)
        rgb[m] = col * (0.8 + 0.5 * tex[m, None])
        rgb[trunk] = (80, 60, 44)
        occ |= m | trunk
    labels[occ] = LABELS['OCCLUDER']
    return occ


def _frames(rgb, p, cam, style, rnd):
    """Window frames and mullions (drawn inside the opening; the opening's outline and corners do not move)."""
    fc = np.array(p['frameColor'] if style == 'RENDER' else (40, 40, 40), np.float32)
    w = max(1, int(round(0.05 * cam.s)))
    for op in p['openings']:
        if op['kind'] != 'WINDOW':
            continue
        u0, u1 = cam.u0 + op['x0'] * cam.s, cam.u0 + op['x1'] * cam.s
        v0, v1 = cam.v0 - op['y1'] * cam.s, cam.v0 - op['y0'] * cam.s
        a, b, c, d = int(math.ceil(u0)), int(math.floor(u1)), int(math.ceil(v0)), int(math.floor(v1))
        if style == 'RENDER':
            rgb[c:c + w, a:b] = fc; rgb[d - w:d, a:b] = fc; rgb[c:d, a:a + w] = fc; rgb[c:d, b - w:b] = fc
        for k in range(1, op.get('mullions', 0) + 1):
            x = int(round(u0 + (u1 - u0) * k / (op['mullions'] + 1)))
            rgb[c:d, x - w // 2:x - w // 2 + w] = fc


def elevation_points(p, cam):
    """Architectural points of the front elevation in image pixels (sub-pixel)."""
    W, H, o = p['W'], p['H'], p['overhang']
    pitch = math.radians(p['pitchDeg'])
    pts = []
    def add(name, q, kind):
        u, v, _ = cam.project(q)
        pts.append({'name': name, 'kind': kind, 'u': round(float(u), 3), 'v': round(float(v), 3)})
    for nm, q in (('wall-bl', (0, 0, 0)), ('wall-br', (W, 0, 0))):
        add(nm, q, 'BUILDING_CORNER')
    eaveY = H - o * math.tan(pitch)
    if p['ridgeAlongFront']:
        add('eave-l', (-o, eaveY, o), 'EAVE'); add('eave-r', (W + o, eaveY, o), 'EAVE')
        add('ridge-l', (-o, p['ridgeH'], -p['D'] / 2), 'RIDGE'); add('ridge-r', (W + o, p['ridgeH'], -p['D'] / 2), 'RIDGE')
        add('wall-tl', (0, H, 0), 'BUILDING_CORNER'); add('wall-tr', (W, H, 0), 'BUILDING_CORNER')
    else:
        add('eave-l', (-o, eaveY, o), 'EAVE'); add('eave-r', (W + o, eaveY, o), 'EAVE')
        add('apex', (W / 2, p['ridgeH'], o), 'RIDGE')
        add('wall-tl', (0, H, 0), 'BUILDING_CORNER'); add('wall-tr', (W, H, 0), 'BUILDING_CORNER')
    for k, op in enumerate(p['openings']):
        for nm, q in (('bl', (op['x0'], op['y0'], 0)), ('br', (op['x1'], op['y0'], 0)), ('tr', (op['x1'], op['y1'], 0)), ('tl', (op['x0'], op['y1'], 0))):
            add(f"{op['kind'].lower()}{k}-{nm}", q, op['kind'] + '_CORNER')
    c = p['chimney']
    if c:
        add('chimney-tl', (c['x0'], c['top'], 0), 'CHIMNEY'); add('chimney-tr', (c['x1'], c['top'], 0), 'CHIMNEY')
    b = p['balcony']
    if b:
        add('balcony-l', (b['x0'], b['y'] - b['slab'], b['depth']), 'BALCONY'); add('balcony-r', (b['x1'], b['y'] - b['slab'], b['depth']), 'BALCONY')
    return pts


def _finish_render(rnd, rgb, labels, outline, sky_rows, ground_v, w, h, stripes=True):
    """Sky gradient, grass, wall texture and soft lighting; returns uint8 RGB."""
    yy = np.arange(h)[:, None]
    bg = labels == LABELS['BACKGROUND']
    top = np.array(rnd.choice([(150, 190, 230), (170, 200, 230), (200, 214, 226)]), np.float32)
    sky = top + (np.array([235, 240, 245], np.float32) - top) * np.clip(yy / max(1, ground_v), 0, 1)[..., None]
    skym = bg & (yy < ground_v)
    rgb[skym] = np.broadcast_to(sky, rgb.shape)[skym]
    labels[skym] = LABELS['SKY']
    gm = bg & (yy >= ground_v)
    grass = np.array(rnd.choice([(110, 150, 80), (124, 160, 90), (150, 150, 140)]), np.float32)
    rgb[gm] = grass * (0.9 + 0.3 * _noise(rnd, h, w, 3)[gm, None])
    labels[gm] = LABELS['GROUND']
    tex = _noise(rnd, h, w, 2) * rnd.uniform(14, 30)
    wallm = labels == LABELS['WALL']
    rgb[wallm] += tex[wallm, None]
    roofm = labels == LABELS['ROOF']
    if stripes:  # tile courses run parallel to the eave: image rows only in a front orthographic view
        st = (np.sin(yy * rnd.uniform(0.6, 1.2)) * 12)
        rgb[roofm] += np.broadcast_to(st, (h, w))[roofm, None]
    glass = labels == LABELS['WINDOW']
    refl = np.clip((np.arange(w)[None, :] + yy) % 90 / 90.0, 0, 1)
    rgb[glass] = rgb[glass] * (0.65 + 0.45 * np.broadcast_to(refl, (h, w))[glass, None])
    return rgb


def _shadow_band(rgb, labels, faces, polys, cam, p, rnd):
    """Eave shadow on the front wall and reveal shadows at the top/left of every opening (ortho only)."""
    if cam.kind != 'ortho':
        return
    s = cam.s
    depth = p['overhang'] * rnd.uniform(0.6, 1.2)
    vtop = cam.v0 - p['H'] * s
    wall = labels == LABELS['WALL']
    yy, xx = np.mgrid[0:labels.shape[0], 0:labels.shape[1]]
    band = wall & (yy >= vtop) & (yy < vtop + depth * s)
    rgb[band] *= 0.72
    for op in p['openings']:
        u0, u1 = cam.u0 + op['x0'] * s, cam.u0 + op['x1'] * s
        v1 = cam.v0 - op['y1'] * s
        r = max(2, int(0.12 * s))
        m = (labels == LABELS[op['kind']]) & (((yy >= v1) & (yy < v1 + r)) | ((xx >= u0) & (xx < u0 + r)))
        rgb[m] *= 0.6


def render_elevation(p, rnd, style, width=1200):
    W = p['W']
    margin = 0.12
    s = width * (1 - 2 * margin) / (W + 2 * p['overhang'] + 1.0)
    top = p['chimney']['top'] if p['chimney'] else p['ridgeH']
    h = int((top + 1.5) * s + 0.25 * width)
    u0 = (width - W * s) / 2
    v0 = h - 0.12 * width
    cam = Camera('ortho', s=s, u0=u0, v0=v0)
    polys = house_polys(p)
    rgb, labels, faces, outline = paint(polys, cam, (width, h), _colors(p, style), style, rnd, line_w=max(1, int(width / 900)))
    occ = np.zeros(labels.shape, bool)
    if style == 'RENDER':
        rgb = _finish_render(rnd, rgb, labels, outline, None, v0, width, h)
        _shadow_band(rgb, labels, faces, polys, cam, p, rnd)
        if rnd.random() < 0.85:
            occ = _trees(rnd, rgb, labels, v0, (u0 - 0.5 * s, u0 + (W + 0.5) * s), (p['H']) * s, rnd.randint(1, 4))
    _frames(rgb, p, cam, style, rnd)
    ann = np.zeros(labels.shape, bool)
    if style in ('FLAT', 'LINE'):
        rgb[outline > 60] = rgb[outline > 60] * 0.15
        # ground line
        g = int(v0)
        rgb[g:g + max(2, width // 500), int(u0 - 0.6 * s):int(u0 + (W + 0.6) * s)] = 30
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    if style == 'LINE':
        im, ann = _technical_marks(im, rnd, p, cam, labels)
    labels = labels.copy(); labels[ann & (labels == 0)] = LABELS['ANNOTATION']
    points = elevation_points(p, cam)
    for q in points:
        ui, vi = int(round(q['u'])), int(round(q['v']))
        r = 2
        win = occ[max(0, vi - r):vi + r + 1, max(0, ui - r):ui + r + 1]
        q['occluded'] = bool(win.size and win.mean() > 0.3)
    return im, labels, occ, cam, points


def _technical_marks(im, rnd, p, cam, labels):
    """Level marks with tick text blocks and a dimension chain under the building (annotation, not architecture)."""
    d = ImageDraw.Draw(im)
    w, h = im.size
    ann = Image.new('L', (w, h), 0); da = ImageDraw.Draw(ann)
    s = cam.s
    xl = cam.u0 - 1.2 * s
    for y in sorted({0.0, p['plinth'], p['H'], p['ridgeH']} | {p['plinth'] + k * p['storeyH'] for k in range(p['storeys'])}):
        v = cam.v0 - y * s
        tri = [(xl, v), (xl - 8, v - 10), (xl + 8, v - 10)]
        for dd in (d, da):
            dd.polygon(tri, outline=0 if dd is d else 255, fill=None if dd is d else 255)
            dd.line([(xl - 40, v), (xl + 20, v)], fill=0 if dd is d else 255, width=1)
            dd.rectangle([xl - 46, v - 26, xl - 6, v - 14], outline=0 if dd is d else 255, fill=None if dd is d else 255)
    vy = cam.v0 + 0.06 * w
    xs = sorted({0.0, p['W']} | {o[k] for o in p['openings'] for k in ('x0', 'x1')})
    for dd in (d, da):
        col = 0 if dd is d else 255
        dd.line([(cam.u0, vy), (cam.u0 + p['W'] * s, vy)], fill=col, width=1)
        for x in xs:
            u = cam.u0 + x * s
            dd.line([(u - 5, vy + 5), (u + 5, vy - 5)], fill=col, width=1)
            dd.line([(u, vy - 8), (u, vy + 8)], fill=col, width=1)
    # roof hatch
    rgb = np.asarray(im).copy()
    roof = labels == LABELS['ROOF']
    yy, xx = np.mgrid[0:h, 0:w]
    hatch = roof & (((xx + yy) % max(6, w // 150)) == 0)
    rgb[hatch] = 60
    return Image.fromarray(rgb), np.asarray(ann) > 0


def render_perspective(p, rnd, style, kind, width=1200):
    yaw = rnd.uniform(2, 12) * rnd.choice([-1, 1]) if kind == 'NEAR_FRONTAL' else rnd.uniform(25, 60) * rnd.choice([-1, 1])
    eye = rnd.choice(['EYE', 'EYE', 'ELEVATED'])
    pitch = rnd.uniform(-2, 4) if eye == 'EYE' else rnd.uniform(8, 25)
    fov = rnd.uniform(35, 65)
    h = int(width * rnd.uniform(0.62, 0.8))
    f = (width / 2) / math.tan(math.radians(fov) / 2)
    target = (p['W'] / 2, p['H'] * 0.55, -p['D'] / 2 if kind == 'CORNER' else 0.0)
    vfov = 2 * math.atan(math.tan(math.radians(fov) / 2) * h / width)
    top = p['chimney']['top'] if p['chimney'] else p['ridgeH']
    span = p['W'] + 2 * p['overhang'] + (abs(math.sin(math.radians(yaw))) * p['D'] if kind == 'CORNER' else 0.0)
    dist = max(span / (2 * math.tan(math.radians(fov) / 2)), top * 1.25 / (2 * math.tan(vfov / 2))) * rnd.uniform(1.1, 1.5) + (p['D'] / 2 if kind == 'CORNER' else 0)
    target = (target[0], top * 0.45, target[2])
    cam = Camera('persp', yaw=yaw, pitch=pitch, f=f, cx=width / 2, cy=h / 2, target=target, dist=dist)
    polys = house_polys(p)
    rgb, labels, faces, outline = paint(polys, cam, (width, h), _colors(p, style), style, rnd, line_w=max(1, int(width / 900)))
    gv = int(cam.project((p['W'] / 2, 0, 0))[1])
    if style == 'RENDER':
        rgb = _finish_render(rnd, rgb, labels, outline, None, min(h - 1, max(1, gv)), width, h, stripes=False)
        if rnd.random() < 0.7:
            u0 = cam.project((0, 0, 0))[0]; u1 = cam.project((p['W'], 0, 0))[0]
            _trees(rnd, rgb, labels, min(h - 1, gv), (min(u0, u1), max(u0, u1)), p['H'] * f / dist, rnd.randint(1, 3))
    else:
        rgb[outline > 60] = rgb[outline > 60] * 0.15
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    return im, labels, cam, {'yaw': yaw, 'pitch': pitch, 'fov': fov, 'eye': eye}


def render_section(p, rnd, variant, width=1200):
    """Vertical cut across the depth, seen from the front: wall cuts and slabs as poché/hatch, interior visible."""
    W, H = p['W'], p['H']
    s = width * 0.76 / (W + 2 * p['overhang'] + 1.0)
    top = p['ridgeH']
    h = int((top + 2.5) * s + 0.2 * width)
    u0 = (width - W * s) / 2
    v0 = h - 0.16 * width
    im = Image.new('RGB', (width, h), (255, 255, 255))
    d = ImageDraw.Draw(im)
    lab = Image.new('L', (width, h), 0); dl = ImageDraw.Draw(lab)
    X = lambda x: u0 + x * s
    Y = lambda y: v0 - y * s
    t = rnd.uniform(0.3, 0.45)  # external wall
    slab = rnd.uniform(0.22, 0.3)
    coloured = variant == 'COLOURED'
    cut = (40, 40, 40) if variant == 'POCHE' else ((255, 255, 255) if variant == 'HATCH' else (200, 120, 90))
    def cutbox(x0, y0, x1, y1):
        box = [X(x0), Y(y1), X(x1), Y(y0)]
        d.rectangle(box, fill=cut, outline=(0, 0, 0), width=2)
        dl.rectangle(box, fill=LABELS['SECTION_CUT'])
        if variant == 'HATCH':
            for k in range(int(box[0]) - int(box[3] - box[1]), int(box[2]), 7):
                d.line([(max(box[0], k), box[3] - max(0, box[0] - k)), (min(box[2], k + (box[3] - box[1])), box[3] - min(box[3] - box[1], k + (box[3] - box[1]) - k))], fill=(0, 0, 0), width=1)
    if coloured:
        d.rectangle([X(0), Y(H), X(W), Y(0)], fill=tuple(int(c * 0.97) for c in p['wallColor']))
        dl.rectangle([X(0), Y(H), X(W), Y(0)], fill=LABELS['INTERIOR'])
    # foundations and ground
    cutbox(-0.1, -1.0, t + 0.1, 0); cutbox(W - t - 0.1, -1.0, W + 0.1, 0)
    for k in range(0, width, 9):
        d.line([(k, v0 + 2), (k + 9, v0 + 12)], fill=(90, 90, 90), width=1)
    d.line([(0, v0), (width, v0)], fill=(0, 0, 0), width=2)
    cutbox(0, 0, t, H); cutbox(W - t, 0, W, H)
    for k in range(p['storeys'] + 1):
        y = p['plinth'] + k * p['storeyH']
        if k == p['storeys']:
            y = H
        cutbox(t, y - slab, W - t, y)
    # roof as a thick sloped band (cut across the ridge)
    pitch = math.radians(p['pitchDeg'])
    o = p['overhang']
    th = rnd.uniform(0.25, 0.4)
    half = W / 2 + o
    apex = (W / 2, H + half * math.tan(pitch))
    for sgn in (-1, 1):
        x_e = W / 2 + sgn * half
        ey = H - o * math.tan(pitch) if True else H
        poly = [(X(x_e), Y(H - o * math.tan(pitch))), (X(apex[0]), Y(apex[1])), (X(apex[0]), Y(apex[1] + th / math.cos(pitch))), (X(x_e), Y(H - o * math.tan(pitch) + th / math.cos(pitch)))]
        d.polygon(poly, fill=cut if variant != 'HATCH' else (255, 255, 255), outline=(0, 0, 0))
        dl.polygon(poly, fill=LABELS['SECTION_CUT'])
    # interior: partitions with door gaps, stair, ceiling lines, window glass in cut walls
    for k in range(p['storeys']):
        y = p['plinth'] + k * p['storeyH']
        n = rnd.randint(1, 3)
        for j in range(n):
            x = rnd.uniform(0.25, 0.75) * W
            gap = rnd.random() < 0.6
            if gap:
                cutbox(x, y + 2.1, x + 0.12, y + p['storeyH'] - slab)
                d.rectangle([X(x), Y(y + 2.1), X(x + 0.9), Y(y)], outline=(0, 0, 0), width=1)
            else:
                cutbox(x, y, x + 0.12, y + p['storeyH'] - slab)
        for side in (0, 1):
            if rnd.random() < 0.7:
                wy0, wy1 = y + 0.9, y + 2.3
                xw0, xw1 = (0, t) if side == 0 else (W - t, W)
                d.rectangle([X(xw0), Y(wy1), X(xw1), Y(wy0)], fill=(255, 255, 255), outline=(0, 0, 0), width=1)
                d.line([(X((xw0 + xw1) / 2), Y(wy1)), (X((xw0 + xw1) / 2), Y(wy0))], fill=(0, 0, 0), width=1)
        if p['storeys'] > 1 and k == 0:
            sx = rnd.uniform(0.3, 0.6) * W
            n_st = 16
            for j in range(n_st):
                x = sx + j * 0.27; yv = y + (j + 1) * (p['storeyH'] / n_st)
                d.line([(X(x), Y(yv - p['storeyH'] / n_st)), (X(x), Y(yv)), (X(x + 0.27), Y(yv))], fill=(0, 0, 0), width=2)
    if rnd.random() < 0.6:
        im, _ = _technical_marks(im, rnd, {**p, 'openings': []}, Camera('ortho', s=s, u0=u0, v0=v0), np.asarray(lab))
    return im, np.asarray(lab).copy(), {'variant': variant}


def render_interior(rnd, style, width=1000):
    h = int(width * rnd.uniform(0.6, 0.75))
    Wr, Dr, Hr = rnd.uniform(4, 7), rnd.uniform(4, 7), rnd.uniform(2.5, 3.0)
    yaw = rnd.uniform(-35, 35)
    cam = Camera('persp', yaw=yaw, pitch=rnd.uniform(-8, 2), f=(width / 2) / math.tan(math.radians(rnd.uniform(55, 80)) / 2),
                 cx=width / 2, cy=h / 2, target=(Wr / 2, 1.3, -Dr / 2), dist=Dr * 0.45)
    wallc = rnd.choice(PALETTE['plaster']); floorc = rnd.choice(PALETTE['wood']); ceilc = (246, 246, 244)
    P = []
    def add(label, col, pts, n):
        P.append({'label': label, 'key': col, 'pts': pts, 'n': n})
    add('INTERIOR', floorc, [(0, 0, 0), (Wr, 0, 0), (Wr, 0, -Dr), (0, 0, -Dr)], (0, 1, 0))
    add('INTERIOR', ceilc, [(0, Hr, -Dr), (Wr, Hr, -Dr), (Wr, Hr, 0), (0, Hr, 0)], (0, -1, 0))
    add('INTERIOR', wallc, [(0, 0, -Dr), (Wr, 0, -Dr), (Wr, Hr, -Dr), (0, Hr, -Dr)], (0, 0, 1))
    add('INTERIOR', tuple(int(c * 0.93) for c in wallc), [(0, 0, 0), (0, 0, -Dr), (0, Hr, -Dr), (0, Hr, 0)], (1, 0, 0))
    add('INTERIOR', tuple(int(c * 0.9) for c in wallc), [(Wr, 0, -Dr), (Wr, 0, 0), (Wr, Hr, 0), (Wr, Hr, -Dr)], (-1, 0, 0))
    wx = rnd.uniform(0.5, Wr - 2.0)
    add('WINDOW', (200, 220, 236), [(wx, 0.9, -Dr + 0.01), (wx + 1.5, 0.9, -Dr + 0.01), (wx + 1.5, 2.3, -Dr + 0.01), (wx, 2.3, -Dr + 0.01)], (0, 0, 1))
    for _ in range(rnd.randint(1, 4)):
        bx, bz = rnd.uniform(0.3, Wr - 1.8), rnd.uniform(-Dr + 0.3, -1.5)
        bw, bd, bh = rnd.uniform(0.6, 1.8), rnd.uniform(0.5, 1.0), rnd.uniform(0.4, 1.1)
        col = rnd.choice([(90, 90, 96), (180, 160, 140), (120, 90, 70), (200, 200, 205)])
        for pts, n in (([(bx, 0, bz), (bx + bw, 0, bz), (bx + bw, bh, bz), (bx, bh, bz)], (0, 0, 1)),
                       ([(bx, bh, bz), (bx + bw, bh, bz), (bx + bw, bh, bz - bd), (bx, bh, bz - bd)], (0, 1, 0)),
                       ([(bx + bw, 0, bz), (bx + bw, 0, bz - bd), (bx + bw, bh, bz - bd), (bx + bw, bh, bz)], (1, 0, 0)),
                       ([(bx, 0, bz - bd), (bx, 0, bz), (bx, bh, bz), (bx, bh, bz - bd)], (-1, 0, 0))):
            add('INTERIOR', col, pts, n)
    colors = lambda poly: poly['key'] if style != 'LINE' else (255, 255, 255)
    for poly in P:
        poly['facing_override'] = True
    class Cam2(Camera):
        def facing(self, poly):
            n = np.array(poly['n']); centre = np.mean(np.array(poly['pts']), axis=0)
            return float(np.dot(n, self.C - centre)) > 0
    cam.__class__ = Cam2
    rgb, labels, faces, outline = paint(P, cam, (width, h), colors, style, rnd)
    if style == 'RENDER':
        rgb += _noise(rnd, h, width, 3)[..., None] * 18
        rgb *= (0.8 + 0.25 * np.linspace(1, 0, width))[None, :, None]
    else:
        rgb[outline > 60] *= 0.2
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)), labels, cam


def render_plan(p, rnd, width=1100):
    W, D = p['W'], p['D']
    s = width * 0.7 / max(W, D)
    h = int(D * s + 0.3 * width)
    im = Image.new('RGB', (width, h), (255, 255, 255)); d = ImageDraw.Draw(im)
    X = lambda x: (width - W * s) / 2 + x * s
    Z = lambda z: 0.15 * width + (-z) * s
    t = 0.4
    for (x0, z0, x1, z1) in ((0, 0, W, -t), (0, -D + t, W, -D), (0, 0, t, -D), (W - t, 0, W, -D)):
        d.rectangle([X(x0), Z(z0), X(x1), Z(z1)], fill=(30, 30, 30))
    for _ in range(rnd.randint(2, 5)):
        if rnd.random() < 0.5:
            x = rnd.uniform(0.25, 0.75) * W
            d.rectangle([X(x), Z(-t), X(x + 0.12), Z(-D + t)], fill=(30, 30, 30))
            zg = rnd.uniform(-D + 1.5, -1.5)
            d.rectangle([X(x) - 1, Z(zg), X(x + 0.12) + 1, Z(zg - 0.9)], fill=(255, 255, 255))
            d.arc([X(x) - 0.9 * s, Z(zg) - 0.9 * s, X(x) + 0.9 * s, Z(zg) + 0.9 * s], 270, 360, fill=(0, 0, 0))
        else:
            z = rnd.uniform(0.25, 0.75) * -D
            d.rectangle([X(t), Z(z), X(W - t), Z(z - 0.12)], fill=(30, 30, 30))
    for op in p['openings']:
        d.rectangle([X(op['x0']), Z(0), X(op['x1']), Z(-t)], fill=(255, 255, 255), outline=(0, 0, 0))
        d.line([(X(op['x0']), Z(-t / 2)), (X(op['x1']), Z(-t / 2))], fill=(0, 0, 0))
    if rnd.random() < 0.7:
        yv = Z(0) + 0.05 * width
        d.line([(X(0), yv), (X(W), yv)], fill=(0, 0, 0))
        for x in sorted({0, W} | {op[k] for op in p['openings'] for k in ('x0', 'x1')}):
            d.line([(X(x) - 4, yv + 4), (X(x) + 4, yv - 4)], fill=(0, 0, 0))
    return im


def collage(ims, rnd):
    grid = rnd.choice([(2, 2), (2, 1)])
    cols, rows = grid
    W, H = 600 * cols, 450 * rows
    out = Image.new('RGB', (W, H), 'white')
    for k, im in enumerate(ims[:cols * rows]):
        t = im.copy(); t.thumbnail((588, 438))
        out.paste(t, ((k % cols) * 600 + (600 - t.size[0]) // 2, (k // cols) * 450 + (450 - t.size[1]) // 2))
    return out, grid


def generate(out_dir, prefix, seed, n_houses):
    """Write images and truth for n_houses synthetic houses. Returns the manifest rows."""
    os.makedirs(out_dir, exist_ok=True)
    rnd = random.Random(seed)
    rows = []
    pool = []
    def save(name, im, row, labels=None, occ=None, jpeg=False):
        path = os.path.join(out_dir, name + ('.jpg' if jpeg else '.png'))
        if jpeg:
            im.save(path, quality=rnd.randint(78, 92))
        else:
            im.save(path)
        if labels is not None:
            Image.fromarray(labels.astype(np.uint8)).save(os.path.join(out_dir, name + '.labels.png'))
        if occ is not None:
            Image.fromarray((occ * 255).astype(np.uint8)).save(os.path.join(out_dir, name + '.occ.png'))
        row = {'file': os.path.basename(path), 'id': name, 'house': f'{prefix}-h{hk:03d}', **row}
        rows.append(row)
        pool.append(im)
    for hk in range(n_houses):
        p = house_params(rnd)
        hp = {k: v for k, v in p.items() if k not in ('wallColor', 'accentColor', 'roofColor', 'glassColor', 'frameColor', 'gateColor')}
        for style in ('FLAT', 'RENDER', 'LINE'):
            width = rnd.choice([1200, 1200, 1200, 800, 1600])
            im, labels, occ, cam, pts = render_elevation(p, rnd, style, width)
            save(f'{prefix}-h{hk:03d}-elev-{style.lower()}', im, {'label': 'ORTHOGRAPHIC_ELEVATION', 'projection': 'ORTHOGRAPHIC', 'style': style,
                 'camera': cam.to_json(), 'points': pts, 'house': hp}, labels, occ, jpeg=style == 'RENDER')
        for kind in ('NEAR_FRONTAL', 'CORNER'):
            style = rnd.choice(['FLAT', 'RENDER', 'RENDER', 'LINE'])
            im, labels, cam, meta = render_perspective(p, rnd, style, kind)
            save(f'{prefix}-h{hk:03d}-persp-{kind.lower()}-{style.lower()}', im, {'label': 'EXTERIOR_PERSPECTIVE', 'projection': 'PERSPECTIVE', 'style': style,
                 'perspectiveKind': kind, 'camera': cam.to_json(), **meta}, labels, jpeg=style == 'RENDER')
        variant = rnd.choice(['POCHE', 'HATCH', 'COLOURED'])
        im, labels, meta = render_section(p, rnd, variant)
        save(f'{prefix}-h{hk:03d}-section-{variant.lower()}', im, {'label': 'TECHNICAL_SECTION', 'projection': 'ORTHOGRAPHIC', 'style': variant, **meta}, labels)
        if hk % 2 == 0:
            st = rnd.choice(['FLAT', 'RENDER'])
            im, labels, cam = render_interior(rnd, st)
            save(f'{prefix}-h{hk:03d}-interior-{st.lower()}', im, {'label': 'INTERIOR_PERSPECTIVE', 'projection': 'PERSPECTIVE', 'style': st, 'camera': cam.to_json()}, labels, jpeg=st == 'RENDER')
        if hk % 2 == 1:
            save(f'{prefix}-h{hk:03d}-plan', render_plan(p, rnd), {'label': 'FLOOR_PLAN', 'projection': 'ORTHOGRAPHIC', 'style': 'LINE'})
        if hk % 4 == 3:
            im, grid = collage(rnd.sample(pool[-12:], 4), rnd)
            save(f'{prefix}-h{hk:03d}-collage', im, {'label': 'OTHER', 'projection': 'MULTI_VIEW', 'style': 'COLLAGE', 'grid': list(grid)})
    with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
        json.dump({'prefix': prefix, 'seed': seed, 'houses': n_houses, 'labels': LABELS, 'rows': rows}, f, indent=0)
    return rows


if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    from iu.paths import refuse_inside_repo, arg_value
    out = arg_value('--out'); refuse_inside_repo(out, 'synthetic images')
    rows = generate(out, arg_value('--prefix', 'dev'), int(arg_value('--seed', '20261024')), int(arg_value('--houses', '60')))
    from collections import Counter
    print(len(rows), Counter(r['label'] for r in rows))
