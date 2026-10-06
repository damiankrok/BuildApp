#!/usr/bin/env python3
"""realmasks.py - real development evaluation masks for the wall proof (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B realmasks.py --repo /home/user/BuildApp --work /home/user/work005j

From the 005I manual truth (exterior outline, exterior wall thickness, exterior openings, exclusions) of the seven
development plans: the exterior-wall band (inside the outline, one wall thick, openings removed), the openings' band
rectangles, the exclusion areas (terrace, pergola, porch, paving...) away from the walls, and the production
source-cv wall bands (005I observations, SCV-WALL) rasterised. Interior walls are not annotated, so the real scores are
about EXTERIOR walls only (a stated limitation). Masks are publisher-derived and stay under $WORK.
"""
import argparse
import glob
import json
import os

from PIL import Image, ImageDraw
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union


def raster(geom, size):
    im = Image.new('L', size, 0)
    d = ImageDraw.Draw(im)
    geoms = [] if geom.is_empty else ([geom] if geom.geom_type == 'Polygon' else list(geom.geoms))
    for g in geoms:
        if g.geom_type != 'Polygon':
            continue
        d.polygon([tuple(c) for c in g.exterior.coords], fill=255)
        for h in g.interiors:
            d.polygon([tuple(c) for c in h.coords], fill=0)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default='/home/user/BuildApp')
    ap.add_argument('--work', default='/home/user/work005j')
    a = ap.parse_args()
    out = os.path.join(a.work, 'wall', 'real')
    os.makedirs(out, exist_ok=True)
    houses = []
    for f in sorted(glob.glob(os.path.join(a.repo, 'research/analyzer-005i-boundary-bakeoff/truth/real/*.json'))):
        t = json.load(open(f))
        h = t['house']
        frame = f'/home/user/work005i/frames/real/{h}.rgb.png'
        size = Image.open(frame).size
        ext = Polygon(t['exterior']).buffer(0)
        th = t['exteriorWallThicknessPx']
        band = ext.difference(ext.buffer(-th))
        op = unary_union([LineString([o['a'], o['b']]).buffer(th * 1.2, cap_style=2) for o in t.get('openings', [])]) if t.get('openings') else Polygon()
        wall = band.difference(op)
        openings = band.intersection(op)
        excl = unary_union([Polygon(e['polygon']).buffer(0) for e in t.get('exclusions', [])]).difference(ext.buffer(4)) if t.get('exclusions') else Polygon()
        obs = json.load(open(f'/home/user/work005i/obs/source-cv/real/{h}.json'))['observations']
        # source-cv's wall evidence = the run-length wall bands (SCV-WALL) UNION the wall-solid layer's parts (SCV-SOLID,
        # bounds only, so it over-covers L-shaped parts: conservative for any "additional evidence" claim). Bands alone
        # are kept as a second mask: on some sheets (azaliach) the band survey's thickness window misses thick walls
        # that the solid layer holds.
        scv_bands = Image.new('L', size, 0)
        db = ImageDraw.Draw(scv_bands)
        for o in obs:
            if o.get('configId') != 'SCV-WALL':
                continue
            (ax, ay), (bx, by) = o['geometry']['a'], o['geometry']['b']
            r = o['geometry'].get('thicknessPx', 6) / 2
            if ax == bx:
                db.rectangle([ax - r, min(ay, by), ax + r, max(ay, by)], fill=255)
            else:
                db.rectangle([min(ax, bx), ay - r, max(ax, bx), ay + r], fill=255)
        scv = scv_bands.copy()
        d = ImageDraw.Draw(scv)
        for o in obs:
            if o.get('configId') != 'SCV-SOLID':
                continue
            ring = o['geometry']['rings'][0]
            d.polygon([tuple(p) for p in ring], fill=255)
        paths = {}
        for name, im in (('extWallMask', raster(wall, size)), ('openingMask', raster(openings, size)), ('exclusionMask', raster(excl, size)), ('scvMask', scv), ('scvBandsMask', scv_bands)):
            p = os.path.join(out, f'{h}.{name}.png')
            im.save(p)
            paths[name] = p
        houses.append({'house': h, 'frame': frame, 'exteriorWallThicknessPx': th, **paths})
    json.dump({'houses': houses, 'truth': 'research/analyzer-005i-boundary-bakeoff/truth/real (005I manual truth, exterior walls only)'}, open(os.path.join(out, 'real-eval.json'), 'w'), indent=1)
    print(len(houses), 'houses')


if __name__ == '__main__':
    main()
