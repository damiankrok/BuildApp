#!/usr/bin/env python3
"""vrgen2.py - BuildPlan-owned global-context synthetic corpus (RESEARCH ONLY, BUILDPLAN-ANALYZER-005M).

Never imported by production code. It reuses the 005J scene model and rasteriser (research/analyzer-005j/synthetic/
vrgen.py) and adds families whose answer depends on the whole plan. Every drawing is generated from a semantic scene in
metres; every expected answer is read from that scene - never from a model, a published figure or a picture.

    python -I -B vrgen2.py --out <dir outside the repository> [--splits TRAIN,VAL,TEST] [--pairs 22,5,5] [--compat 2.0.0]

Version 2.1.0 (post-review round 1) changes two families; --compat 2.0.0 reproduces the 2.0.0 corpus byte for byte (the
sealed TEST split the bake-off used was generated with it):
  * garage_vs_carport (B-2 / D-1): the front gap is unmarked in both members, so "garage door or carport mouth" was not
    settled by the drawing. The question now asks what the drawing does show, whether the bay is closed at the back
    (BAY_BACK_CLOSED_VS_DRIVE_THROUGH); the BODY_REGION question on the bay is dropped
  * inset_upper (D-8): member A no longer draws a terrace over the strip on the upper plan; an upper-level terrace made
    "no upper floor over the area" arguable
  * a SEALED split (540000+) that no model, teacher or student has seen: the evaluation split for any student

Families (each a counterfactual pair: A and B share seed, style and every random draw, and differ by one fact):

  context-dependent - the A/B difference lies outside the local crop, so a crop alone cannot decide; the composer
  verifies that the two crops are pixel-identical and records it:
    garage_vs_carport    an unmarked wide front gap: enclosed garage (back wall) / drive-through carport (open back)
    corridor_vs_passage  a strip through the building: hall closed by both facades / covered passage open at both ends
    wing_storey          ground + upper plan: the upper floor covers the one-storey wing / ends before it
    inset_upper          ground + upper plan: the upper floor is set back from the front / flush with it
  local - the evidence is in the crop:
    loggia_vs_room       a corner of the body: walled room / open loggia on a post
    compound_front       door + garage door separated by narrow piers / one open side to a covered porch
    glazed_front         a wide glazed wall / the same span open to a recessed terrace
    phantom_line         a partition with a door gap / a thin floor-finish line with the same gap

A fixed sheet frame (the same rectangle in both members) pins the pixel mapping, so a difference far away cannot shift
the crop. Transforms (NORMAL, MIRROR, ROT90, ROT180) are applied before rasterisation. Splits use disjoint seed ranges:
TRAIN 510000+, VAL 520000+, TEST 530000+ (shown to the bake-off models only; never to a teacher or a student),
SEALED 540000+ (never shown to any model).
"""
import argparse
import hashlib
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'analyzer-005j', 'synthetic'))
import vrgen  # noqa: E402  (005J scene model and rasteriser, research only)
from vrgen import Scene, render, sample_style, TRANSFORMS  # noqa: E402

GENERATOR_VERSION = '2.1.0'
SPLIT_BASE = {'TRAIN': 510000, 'VAL': 520000, 'TEST': 530000, 'SEALED': 540000}
COMPAT = {'version': GENERATOR_VERSION}   # set from --compat; 2.0.0 reproduces the first corpus exactly

TARGET = {'BODY_REGION': 'REGION', 'GARAGE_DOOR_VS_CARPORT': 'SEGMENT', 'BAY_BACK_CLOSED_VS_DRIVE_THROUGH': 'SEGMENT', 'STOREY_COVERAGE': 'REGION', 'LOGGIA_VS_ROOM': 'REGION',
          'OPEN_SIDE_VS_OPENINGS': 'SEGMENT', 'WALL_CONTINUATION': 'SEGMENT', 'GAP_KIND': 'SEGMENT', 'GARAGE_BODY': 'REGION'}


def frame(sc, x0, y0, x1, y1):
    """The sheet frame: identical in both members, so the render bounds and pixel mapping are identical."""
    sc.rect_line(x0, y0, x1, y1, w='thin')


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def body_windows(sc, W, D):
    return {'N': sc.windows_on(W, sc.rng.choice([2, 3])), 'E': sc.windows_on(D, 1), 'W': sc.windows_on(D, 1)}


def fam_garage_vs_carport(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(9, 11)
    gw, gd = rng.uniform(3.4, 4.2), rng.uniform(7.2, 8.2)
    gd = min(gd, D - 0.5)
    gdw = rng.uniform(2.6, min(3.1, gw - 0.6))
    win = body_windows(sc, W, D)
    front = sc.windows_on(W - 1.6, rng.choice([1, 2]))
    dpos = rng.uniform(0.6, W - 1.6)
    front = [o for o in front if o[1] < dpos - 0.4 or o[0] > dpos + 1.4] + [(dpos, dpos + 1.0, 'DOOR')]
    gy0 = D - gd
    s0 = (gw - gdw) / 2
    part = rng.uniform(3.0, W - 3.0)
    pdoor = rng.uniform(0.6, D - 1.6)
    car_on = rng.random() < 0.7
    sc.rect_walls(0, 0, W, D, {'N': win['N'], 'W': win['W'], 'E': [(gy0 + 1.0, gy0 + 1.9, 'DOOR')], 'S': sorted(front)})
    sc.wall((part, 0), (part, D), ext=False, inside=1, ops=[(pdoor, pdoor + 0.9, 'DOOR')])
    sc.furnish_room(0, 0, part, D)
    sc.furnish_room(part, 0, W, D)
    sc.text((part / 2, D * 0.4), rng.choice(['SALON', 'POKOJ']))
    # the garage / carport: side walls and an unmarked front gap in both members
    sc.wall((W + gw, gy0), (W + gw, D), inside=1)
    sc.wall((W, D), (W + gw, D), inside=-1, ops=[(s0, s0 + gdw, 'OPEN')])
    if car_on:
        sc.car(W + gw / 2, D - 2.6)
    if v == 'A':
        sc.wall((W, gy0), (W + gw, gy0), inside=1)
        sc.region('garage', 'GARAGE', rect(W, gy0, W + gw, D))
    else:
        sc.texture(rect(W + 0.2, gy0 - 2.0, W + gw - 0.2, gy0 + 0.6))
        sc.region('garage', 'CARPORT', rect(W, gy0, W + gw, D))
    frame(sc, -2.0, -2.5, W + gw + 2.0, D + 2.0)
    gap = [(W + s0, D), (W + s0 + gdw, D)]
    deep = rect(W + 0.4, gy0 + 0.4, W + gw - 0.4, gy0 + 2.2)
    if COMPAT['version'] == '2.0.0':
        return sc, [
            {'cls': 'GARAGE_DOOR_VS_CARPORT', 'target': gap, 'answer': 'GARAGE_DOOR' if v == 'A' else 'OPEN_CARPORT', 'fact': 'closed at the back' if v == 'A' else 'open at the back (drive-through)', 'contextDependent': True},
            {'cls': 'BODY_REGION', 'target': deep, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'inside the enclosed garage' if v == 'A' else 'under an open carport', 'contextDependent': False},
        ]
    return sc, [
        {'cls': 'BAY_BACK_CLOSED_VS_DRIVE_THROUGH', 'target': gap, 'answer': 'CLOSED_BACK' if v == 'A' else 'DRIVE_THROUGH', 'fact': 'closed at the back' if v == 'A' else 'open at the back (drive-through)', 'contextDependent': True},
    ]


def fam_corridor_vs_passage(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(11, 14), rng.uniform(11, 13)
    cw = rng.uniform(1.6, 2.2)
    px0 = rng.uniform(3.5, W - 3.5 - cw)
    px1 = px0 + cw
    t = 0.3
    win = body_windows(sc, W, D)
    left_front = sc.windows_on(px0 - 0.3, 1)
    right_front = sc.windows_on(W - px1 - 0.3, 1)
    dl, dr = rng.uniform(D * 0.35, D * 0.55), rng.uniform(D * 0.35, D * 0.55)
    sc.rect_walls(0, 0, W, D, {'W': win['W'], 'E': win['E']}, skip=('N', 'S'))
    sc.wall((0, 0), (px0, 0), inside=1, ops=sc.windows_on(px0 - 0.3, 1))
    sc.wall((px1, 0), (W, 0), inside=1, ops=sc.windows_on(W - px1 - 0.3, 1))
    sc.wall((0, D), (px0, D), inside=-1, ops=left_front)
    sc.wall((px1, D), (W, D), inside=-1, ops=[(s0, s1, k) for s0, s1, k in right_front])
    sc.wall((px0, 0), (px0, D), t=t, ext=False, inside=-1, ops=[(dl, dl + 0.9, 'DOOR')])
    sc.wall((px1, 0), (px1, D), t=t, ext=False, inside=1, ops=[(dr, dr + 0.9, 'DOOR')])
    sc.furnish_room(0, 0, px0, D)
    sc.furnish_room(px1, 0, W, D)
    if v == 'A':
        sc.wall((px0, D), (px1, D), inside=-1, ops=[((cw - 1.0) / 2, (cw + 1.0) / 2, 'DOOR')])
        sc.wall((px0, 0), (px1, 0), inside=1, ops=[((cw - 0.9) / 2, (cw + 0.9) / 2, 'DOOR')])
    frame(sc, -2.0, -2.0, W + 2.0, D + 2.0)
    mid = rect(px0 + 0.25, D / 2 - 1.0, px1 - 0.25, D / 2 + 1.0)
    end = [(px0, D), (px1, D)]
    return sc, [
        {'cls': 'BODY_REGION', 'target': mid, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'hall closed by both facades' if v == 'A' else 'covered passage open at both ends', 'contextDependent': True},
        {'cls': 'GAP_KIND', 'target': end, 'answer': 'OPENING' if v == 'A' else 'OPEN', 'fact': 'front door' if v == 'A' else 'passage mouth', 'contextDependent': False},
    ]


def _two_panel_ground(sc, rng, W, D, ww, wd):
    win = body_windows(sc, W, D)
    front = sc.windows_on(W - 1.5, rng.choice([1, 2]))
    sc.rect_walls(0, 0, W, D, {'N': win['N'], 'W': win['W'], 'S': front, 'E': [(D - wd + 0.6, D - wd + 1.5, 'DOOR')]})
    sc.rect_walls(W, D - wd, W + ww, D, {'S': [(0.5, ww - 0.5, 'GARAGE_DOOR')], 'N': sc.windows_on(ww, 1, wmax=1.0)}, skip=('W',))
    part = rng.uniform(3.0, W - 3.0)
    pdoor = rng.uniform(0.6, D - 1.6)
    sc.wall((part, 0), (part, D), ext=False, inside=1, ops=[(pdoor, pdoor + 0.9, 'DOOR')])
    sc.furnish_room(0, 0, part, D)
    sc.car(W + ww / 2, D - wd / 2)
    sc.text((W / 2, -0.8), 'PARTER', size=0.45)


def fam_wing_storey(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(8, 10), rng.uniform(8, 10)
    ww, wd = rng.uniform(3.4, 4.2), rng.uniform(5.5, 7.0)
    wd = min(wd, D)
    gap = 3.0
    _two_panel_ground(sc, rng, W, D, ww, wd)
    ox = W + ww + gap
    up = {'N': sc.windows_on(W, 2), 'S': sc.windows_on(W, 2), 'W': sc.windows_on(D, 1)}
    wing_up = {'E': sc.windows_on(wd, 1), 'S': sc.windows_on(ww, 1)}
    if v == 'A':
        sc.rect_walls(ox, 0, ox + W, D, dict(up, E=[]), skip=('E',))
        sc.rect_walls(ox + W, D - wd, ox + W + ww, D, wing_up, skip=('W',))
        sc.wall((ox + W, 0), (ox + W, D - wd), inside=1)
        sc.wall((ox + W, D - wd), (ox + W, D), ext=False, inside=1, ops=[(0.8, 1.7, 'DOOR')])
    else:
        sc.rect_walls(ox, 0, ox + W, D, dict(up, E=sc.windows_on(D, 1)))
        sc.line([(ox + W, D - wd), (ox + W + ww, D - wd), (ox + W + ww, D), (ox + W, D)], dash=(0.3, 0.2))
    sc.text((ox + W / 2, -0.8), 'PIETRO', size=0.45)
    frame(sc, -2.0, -2.5, ox + W + ww + 2.0, D + 2.0)
    sc.panels = ['GROUND', 'UPPER']
    wing = rect(W + 0.3, D - wd + 0.3, W + ww - 0.3, D - 0.3)
    body = rect(0.6, 0.6, min(W * 0.5, 4.0), D * 0.5)
    panel = (-2.0, -2.5, W + ww + gap / 2, D + 2.0)
    return sc, [
        {'cls': 'STOREY_COVERAGE', 'target': wing, 'answer': 'YES' if v == 'A' else 'NO', 'fact': 'upper covers the wing' if v == 'A' else 'one-storey wing', 'contextDependent': True, 'panel': panel},
        {'cls': 'STOREY_COVERAGE', 'target': body, 'answer': 'YES', 'fact': 'main body under the upper floor (both)', 'contextDependent': True, 'panel': panel},
    ]


def fam_inset_upper(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(9, 12), rng.uniform(8, 10)
    inset = rng.uniform(2.0, 2.8)
    gap = 3.0
    win = body_windows(sc, W, D)
    front = sc.windows_on(W - 1.5, rng.choice([2, 3]))
    sc.rect_walls(0, 0, W, D, {'N': win['N'], 'W': win['W'], 'E': win['E'], 'S': front})
    part = rng.uniform(3.0, W - 3.0)
    pdoor = rng.uniform(0.6, D - 1.6)
    sc.wall((part, 0), (part, D), ext=False, inside=1, ops=[(pdoor, pdoor + 0.9, 'DOOR')])
    sc.furnish_room(0, 0, part, D)
    sc.furnish_room(part, 0, W, D)
    sc.text((W / 2, -0.8), 'PARTER', size=0.45)
    ox = W + gap
    up = {'N': sc.windows_on(W, 2), 'W': sc.windows_on(D - inset, 1), 'E': sc.windows_on(D - inset, 1)}
    upfront = sc.windows_on(W, 2)
    if v == 'A':
        sc.rect_walls(ox, 0, ox + W, D - inset, dict(up, S=upfront))
        if COMPAT['version'] == '2.0.0':
            sc.rect_line(ox + 0.15, D - inset + 0.15, ox + W - 0.15, D - 0.1)
            sc.texture(rect(ox + 0.15, D - inset + 0.15, ox + W - 0.15, D - 0.1))
            sc.text((ox + W / 2, D - inset / 2), 'TARAS', size=0.35)
    else:
        sc.rect_walls(ox, 0, ox + W, D, {'N': up['N'], 'W': up['W'] + [], 'E': up['E'], 'S': upfront})
    sc.text((ox + W / 2, -0.8), 'PIETRO', size=0.45)
    frame(sc, -2.0, -2.5, ox + W + 2.0, D + 2.0)
    sc.panels = ['GROUND', 'UPPER']
    strip = rect(0.6, D - inset + 0.3, W - 0.6, D - 0.4)
    rear = rect(0.6, 0.6, W - 0.6, min(2.6, D - inset - 1.0))
    panel = (-2.0, -2.5, W + gap / 2, D + 2.0)
    return sc, [
        {'cls': 'STOREY_COVERAGE', 'target': strip, 'answer': 'NO' if v == 'A' else 'YES', 'fact': 'upper floor set back from the front' if v == 'A' else 'upper floor flush with the front', 'contextDependent': True, 'panel': panel},
        {'cls': 'STOREY_COVERAGE', 'target': rear, 'answer': 'YES', 'fact': 'rear of the body under the upper floor (both)', 'contextDependent': True, 'panel': panel},
    ]


def fam_loggia_vs_room(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(10, 13), rng.uniform(8, 10)
    lw, ld = rng.uniform(3.0, 4.0), rng.uniform(2.6, 3.4)
    win = body_windows(sc, W, D)
    front = sc.windows_on(W - lw - 0.4, rng.choice([1, 2]))
    side = sc.windows_on(D - ld - 0.4, 1)
    lwin, sdwin = sc.windows_on(lw, 1, wmax=1.6), sc.windows_on(ld, 1, wmax=1.4)
    sc.rect_walls(0, 0, W, D, {'N': win['N'], 'W': win['W']}, skip=('S', 'E'))
    sc.wall((0, D), (W - lw, D), inside=-1, ops=front)
    sc.wall((W, 0), (W, D - ld), inside=1, ops=side)
    sc.wall((W - lw, D - ld), (W, D - ld), t=0.3, ext=False, inside=1, ops=[(0.5, 2.3, 'SLIDING')])
    sc.wall((W - lw, D - ld), (W - lw, D), t=0.3, ext=False, inside=-1)
    sc.furnish_room(0, 0, W - lw, D)
    if v == 'A':
        sc.wall((W - lw, D), (W, D), inside=-1, ops=lwin)
        sc.wall((W, D - ld), (W, D), inside=1, ops=sdwin)
    else:
        sc.column(W - 0.15, D - 0.15, 0.3)
        sc.line([(W - lw + 0.2, D - 0.05), (W - 0.3, D - 0.05)])
        sc.line([(W - 0.05, D - ld + 0.2), (W - 0.05, D - 0.3)])
        sc.texture(rect(W - lw + 0.15, D - ld + 0.15, W - 0.1, D - 0.1))
    frame(sc, -2.0, -2.0, W + 2.0, D + 2.0)
    area = rect(W - lw + 0.4, D - ld + 0.4, W - 0.4, D - 0.4)
    return sc, [{'cls': 'LOGGIA_VS_ROOM', 'target': area, 'answer': 'ROOM' if v == 'A' else 'LOGGIA', 'fact': 'walled corner room' if v == 'A' else 'open loggia on a post', 'contextDependent': False}]


def fam_compound_front(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(13, 16), rng.uniform(9, 11)
    x0 = rng.uniform(2.5, 4.0)
    dw, p1, gdw, p2 = rng.uniform(1.0, 1.2), rng.uniform(0.35, 0.6), rng.uniform(2.6, 3.0), rng.uniform(0.35, 0.6)
    dep = rng.uniform(3.0, 4.0)
    win = body_windows(sc, W, D)
    x1 = x0 + dw + p1 + gdw
    left = sc.windows_on(x0 - 0.4, 1)
    right_w = sc.windows_on(max(1.0, W - x1 - p2 - 0.4), 1)
    sc.rect_walls(0, 0, W, D, {'N': win['N'], 'W': win['W'], 'E': win['E']}, skip=('S',))
    sc.wall((0, D), (x0, D), inside=-1, ops=left)
    sc.wall((x1, D), (W, D), inside=-1, ops=[(p2 + s0, p2 + s1, k) for s0, s1, k in right_w if p2 + s1 < W - x1 - 0.3])
    sc.wall((x0, D - dep), (x1, D - dep), ext=False, t=0.3, inside=1, ops=[(0.3, 1.2, 'DOOR')])
    sc.wall((x0, D - dep), (x0, D), ext=False, t=0.3, inside=-1)
    sc.furnish_room(0, 0, x0, D)
    if v == 'A':
        sc.wall((x0, D), (x1, D), inside=-1, ops=[(0.0, dw, 'DOOR'), (dw + p1, dw + p1 + gdw, 'GARAGE_DOOR')])
        sc.wall((x0 + dw + p1 / 2, D - dep), (x0 + dw + p1 / 2, D), ext=False, t=0.2, inside=1)
    else:
        sc.texture(rect(x0 + 0.15, D - dep + 0.15, x1 - 0.1, D))
        sc.column(x0 + dw + p1 / 2, D - 0.2, 0.25)
    frame(sc, -2.0, -2.0, W + 2.0, D + 2.0)
    stretch = [(x0, D), (x1, D)]
    return sc, [{'cls': 'OPEN_SIDE_VS_OPENINGS', 'target': stretch, 'answer': 'SEVERAL_OPENINGS' if v == 'A' else 'ONE_OPEN_SIDE', 'fact': 'door + narrow pier + garage door' if v == 'A' else 'one open side to a covered porch', 'contextDependent': False}]


def fam_glazed_front(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(11, 14), rng.uniform(9, 11)
    gw = rng.uniform(4.0, 6.0)
    gx0 = rng.uniform(2.0, W - gw - 2.0)
    dep = rng.uniform(1.8, 2.6)
    win = body_windows(sc, W, D)
    left, right = sc.windows_on(gx0 - 0.4, 1), sc.windows_on(W - gx0 - gw - 0.4, 1)
    sc.rect_walls(0, 0, W, D, {'N': win['N'], 'W': win['W'], 'E': win['E']}, skip=('S',))
    sc.wall((0, D), (gx0, D), inside=-1, ops=left)
    sc.wall((gx0 + gw, D), (W, D), inside=-1, ops=right)
    sc.furnish_room(0, 0, W, D - dep)
    if v == 'A':
        sc.wall((gx0, D), (gx0 + gw, D), inside=-1, ops=[(0.0, gw, 'GLAZED')])
    else:
        sc.wall((gx0, D - dep), (gx0 + gw, D - dep), ext=False, t=0.3, inside=1, ops=[(0.4, min(gw - 0.4, 3.0), 'SLIDING')])
        sc.wall((gx0, D - dep), (gx0, D), ext=False, t=0.3, inside=-1)
        sc.wall((gx0 + gw, D - dep), (gx0 + gw, D), ext=False, t=0.3, inside=1)
        sc.texture(rect(gx0 + 0.15, D - dep + 0.15, gx0 + gw - 0.15, D))
    frame(sc, -2.0, -2.0, W + 2.0, D + 2.0)
    return sc, [{'cls': 'WALL_CONTINUATION', 'target': [(gx0, D), (gx0 + gw, D)], 'answer': 'CONTINUES' if v == 'A' else 'TERMINATES', 'fact': 'glazed wall' if v == 'A' else 'recessed terrace mouth', 'contextDependent': False}]


def fam_phantom_line(rng, st, v):
    sc = Scene(rng, st)
    W, D = rng.uniform(10, 13), rng.uniform(8, 10)
    xm = rng.uniform(4.0, W - 4.0)
    g0 = rng.uniform(1.2, D - 2.4)
    gwid = rng.uniform(0.9, 1.2)
    win = body_windows(sc, W, D)
    sc.rect_walls(0, 0, W, D, dict(win, S=sc.windows_on(W, 2)))
    sc.furnish_room(0, 0, xm, D)
    sc.furnish_room(xm, 0, W, D)
    if v == 'A':
        sc.wall((xm, 0), (xm, D), ext=False, inside=1, ops=[(g0, g0 + gwid, 'DOOR')])
    else:
        sc.line([(xm, 0.2), (xm, g0)])
        sc.line([(xm, g0 + gwid), (xm, D - 0.2)])
        sc.texture(rect(xm + 0.05, 0.2, W - 0.2, D - 0.2), kind='TILES')
    frame(sc, -2.0, -2.0, W + 2.0, D + 2.0)
    return sc, [{'cls': 'GAP_KIND', 'target': [(xm, g0), (xm, g0 + gwid)], 'answer': 'OPENING' if v == 'A' else 'NOT_A_WALL_LINE', 'fact': 'door in a partition' if v == 'A' else 'floor-finish line', 'contextDependent': False}]


CONTEXT_FAMILIES = ('garage_vs_carport', 'corridor_vs_passage', 'wing_storey', 'inset_upper')

FAMILIES = {
    'garage_vs_carport': fam_garage_vs_carport,
    'corridor_vs_passage': fam_corridor_vs_passage,
    'wing_storey': fam_wing_storey,
    'inset_upper': fam_inset_upper,
    'loggia_vs_room': fam_loggia_vs_room,
    'compound_front': fam_compound_front,
    'glazed_front': fam_glazed_front,
    'phantom_line': fam_phantom_line,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--splits', default='TRAIN,VAL,TEST')
    ap.add_argument('--pairs', default='22,5,5', help='pairs per family per split, in --splits order')
    ap.add_argument('--families', default='all')
    ap.add_argument('--compat', default=GENERATOR_VERSION, choices=['2.0.0', GENERATOR_VERSION])
    a = ap.parse_args()
    COMPAT['version'] = a.compat
    if os.path.realpath(a.out).startswith(os.path.realpath(os.path.join(HERE, '..', '..', '..'))):
        raise SystemExit('renders stay outside the repository')
    os.makedirs(os.path.join(a.out, 'renders'), exist_ok=True)
    fams = list(FAMILIES) if a.families == 'all' else a.families.split(',')
    scenes, questions = [], []
    for split, npairs in zip(a.splits.split(','), [int(x) for x in a.pairs.split(',')]):
        for fam in fams:
            for k in range(npairs):
                seed = SPLIT_BASE[split] + 1000 * list(FAMILIES).index(fam) + k
                style = sample_style(random.Random(seed * 7 + 1))
                if fam in CONTEXT_FAMILIES:
                    # 005J's rasteriser phases the wall hatch per wall polygon, and a skewed outline whose far end moves
                    # rasterises with different stair-steps along its whole length: either would let a difference far
                    # outside the crop change pixels inside it. Context-dependent pairs draw unskewed, without hatch.
                    style = dict(style, skewDeg=0.0, wallFill='OUTLINE' if style['wallFill'] == 'HATCH' else style['wallFill'])
                pair = f'{split.lower()}-{fam}-s{k}'
                for variant in ('A', 'B'):
                    for tf in TRANSFORMS:
                        rng = random.Random(seed)
                        sc, qs = FAMILIES[fam](rng, style, variant)
                        sid = f'{pair}-{variant}-{tf}'
                        png = os.path.join(a.out, 'renders', f'{sid}.png')
                        info = render(sc, tf, png)
                        M = info['map']
                        with open(png, 'rb') as fh:
                            pix_sha = hashlib.sha256(fh.read()).hexdigest()
                        scenes.append({'sceneId': sid, 'split': split, 'family': fam, 'pair': pair, 'variant': variant, 'transform': tf, 'seed': seed, 'style': style,
                                       'size': info['size'], 'pngSha256': pix_sha, 'panels': sc.panels,
                                       'regions': [{'id': r['id'], 'role': r['role'], 'px': [M(p) for p in r['pts']]} for r in sc.regions]})
                        for qi, q in enumerate(qs):
                            tpx = [list(M(p)) for p in q['target']]
                            rec = {'qid': f'{sid}-q{qi}', 'baseQid': f'{pair}-{variant}-q{qi}', 'pairQid': f'{pair}-{"B" if variant == "A" else "A"}-q{qi}', 'sceneId': sid,
                                   'split': split, 'family': fam, 'pair': pair, 'variant': variant, 'transform': tf, 'cls': q['cls'], 'targetKind': TARGET[q['cls']],
                                   'targetPx': tpx, 'expected': q['answer'], 'fact': q['fact'], 'contextDependent': q['contextDependent']}
                            if 'panel' in q:
                                x0, y0, x1, y1 = q['panel']
                                corners = [M(p) for p in rect(x0, y0, x1, y1)]
                                rec['cropPanel'] = [min(c[0] for c in corners), min(c[1] for c in corners), max(c[0] for c in corners), max(c[1] for c in corners)]
                            questions.append(rec)
    meta = {'generator': 'research/analyzer-005m/synthetic/vrgen2.py', 'version': a.compat, 'rasteriser': 'research/analyzer-005j/synthetic/vrgen.py ' + vrgen.GENERATOR_VERSION,
            'splitSeedBase': SPLIT_BASE, 'families': fams, 'transforms': TRANSFORMS, 'scenes': scenes, 'questions': questions}
    with open(os.path.join(a.out, 'corpus.json'), 'w') as fh:
        json.dump(meta, fh)
    from collections import Counter
    print(json.dumps({'scenes': len(scenes), 'questions': len(questions), 'bySplit': Counter(q['split'] for q in questions), 'byClass': Counter(q['cls'] for q in questions)}, indent=1))


if __name__ == '__main__':
    main()
