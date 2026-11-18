#!/usr/bin/env python3
"""v3.54.9 — every storey of a compiled scene seen from above, roof removed: its walls cut at a height above the floor,
its rooms, doors, stair and the openings of its floor; beside the source plan of that storey when one is given.

    /usr/bin/python3 -I research/source-to-model/v3549/plan-board.py <scene.json> <out.png> [<level>=<plan picture> …] [--title T]
        [--truth <source truth json>]

With --truth, the source's room polygons (T2-ROOM-*, in the truth frame: x east of the west outer face, z north of the
front outer plane) are outlined in red over the cut, registered by the scene's exterior extent (its west and front
outer faces) — the overlay of final walls and rooms on what the plan draws.

The cut is a horizontal plane CUT_M above each storey's floor: a wall is drawn where its triangles cross that plane
(exterior walls dark, partitions mid-grey), rooms as their floor polygons (pale, labelled with their id), a stair as
its outline, the storey's floor as light grey with its holes left white. Scale is common to every storey; the source
plan is shown beside it as published (no registration is implied by the board). The board stays outside Git.
"""
import json
import sys

from PIL import Image, ImageDraw

CUT_M = 1.2
PX_PER_M = 40
skip = {i + 1 for i, a in enumerate(sys.argv) if a in ('--title', '--truth')}
args = [a for i, a in enumerate(sys.argv) if i > 0 and i not in skip and not a.startswith('--')]
title = sys.argv[sys.argv.index('--title') + 1] if '--title' in sys.argv else ''
truth = json.load(open(sys.argv[sys.argv.index('--truth') + 1])) if '--truth' in sys.argv else None
scene_path, out = args[0], args[1]
plans = dict(a.split('=', 1) for a in args[2:] if '=' in a)
b = json.load(open(scene_path))
s = b['scene']
levels = sorted(b.get('levels') or [], key=lambda l: l.get('elevation', 0))
bx = s['bounds']
x0, x1, z0, z1 = bx['min']['x'] - 0.5, bx['max']['x'] + 0.5, bx['min']['z'] - 0.5, bx['max']['z'] + 0.5
W, H = int((x1 - x0) * PX_PER_M), int((z1 - z0) * PX_PER_M)
# drawn as published plans are: the front (z = 0) at the bottom
P = lambda x, z: ((x - x0) * PX_PER_M, (z1 - z) * PX_PER_M)


def tris(m):
    p = m['positions']
    for i in range(0, len(p) - 8, 9):
        yield [(p[i], p[i + 1], p[i + 2]), (p[i + 3], p[i + 4], p[i + 5]), (p[i + 6], p[i + 7], p[i + 8])]


def cut(t, y):
    # the segment where the triangle crosses the plane at height y
    pts = []
    for a, c in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        if (a[1] - y) * (c[1] - y) < 0:
            k = (y - a[1]) / (c[1] - a[1])
            pts.append((a[0] + k * (c[0] - a[0]), a[2] + k * (c[2] - a[2])))
    return pts if len(pts) == 2 else None


tiles = []
for lv in levels:
    lid, elev = lv['id'], lv.get('elevation', 0)
    y = elev + CUT_M
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    mine = [m for m in s['meshes'] if m.get('levelId') == lid]
    for m in mine:
        if m.get('objectKind') == 'slab':
            for t in tris(m):
                if abs(t[0][1] - t[1][1]) < 1e-6 and abs(t[1][1] - t[2][1]) < 1e-6:
                    d.polygon([P(q[0], q[2]) for q in t], fill=(232, 232, 228))
    for m in mine:
        if m.get('objectKind') == 'room':
            for t in tris(m):
                d.polygon([P(q[0], q[2]) for q in t], fill=(214, 228, 240))
    for m in mine:
        if m.get('objectKind') == 'stair':
            for t in tris(m):
                if max(q[1] for q in t) <= y + 1.5:
                    d.polygon([P(q[0], q[2]) for q in t], outline=(150, 110, 60))
    # walls, cut: every wall mesh whose height spans the plane, on this level or (exterior walls run from the ground) below
    for m in s['meshes']:
        if m.get('objectKind') not in ('wall', 'wallPanel'):
            continue
        interior = m.get('semanticGroup') == 'WALL_INTERIOR'
        if interior and m.get('levelId') != lid:
            continue
        col = (120, 120, 120) if interior else (30, 30, 30)
        for t in tris(m):
            seg = cut(t, y)
            if seg:
                d.line([P(*seg[0]), P(*seg[1])], fill=col, width=3)
    for m in mine:
        if m.get('objectKind') in ('door',) and m.get('part') in ('DOOR_LEAF', 'LEAF', None):
            for t in tris(m):
                seg = cut(t, elev + 1.0)
                if seg:
                    d.line([P(*seg[0]), P(*seg[1])], fill=(176, 122, 74), width=2)
    if truth:
        ext = [m for m in s['meshes'] if m.get('objectKind') == 'wall' and m.get('semanticGroup') != 'WALL_INTERIOR']
        xs0 = min(min(m['positions'][0::3]) for m in ext) if ext else 0
        zs0 = min(min(m['positions'][2::3]) for m in ext) if ext else 0
        storey = sorted(levels, key=lambda l: l.get('elevation', 0)).index(lv)
        for it in truth['items']:
            v = it.get('value') or {}
            if it['id'].startswith('T2-ROOM-') and v.get('storey') == storey:
                pts = [P(xs0 + q[0], zs0 + q[1]) for q in v['polygon']]
                d.line(pts + [pts[0]], fill=(210, 30, 30), width=2)
    # room ids at their centres
    for m in mine:
        if m.get('objectKind') == 'room':
            xs = m['positions'][0::3]
            zs = m['positions'][2::3]
            d.text(P(sum(xs) / len(xs) - 0.6, sum(zs) / len(zs)), m['objectId'][-12:], fill=(20, 40, 90))
    d.text((6, 4), f'{title} {lid} +{elev:.2f} m — cut at +{y:.2f} m, roof removed', fill='black')
    src = plans.get(lid) or plans.get(str(lv.get('index')))
    if src:
        sp = Image.open(src).convert('RGB')
        k = H / sp.height
        sp = sp.resize((int(sp.width * k), H))
        tile = Image.new('RGB', (sp.width + W + 10, H), 'white')
        tile.paste(sp, (0, 0))
        tile.paste(im, (sp.width + 10, 0))
        tiles.append(tile)
    else:
        tiles.append(im)
Wt = max(t.width for t in tiles)
board = Image.new('RGB', (Wt, sum(t.height + 10 for t in tiles)), 'white')
yy = 0
for t in tiles:
    board.paste(t, (0, yy))
    yy += t.height + 10
board.save(out)
print(out, board.size)
