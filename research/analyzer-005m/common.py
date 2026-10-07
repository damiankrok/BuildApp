#!/usr/bin/env python3
"""common.py - shared definitions of BUILDPLAN-ANALYZER-005M (RESEARCH ONLY; never imported by production).

One closed question contract for every model, every input mode and every corpus set:

  * a question class names a semantic fact and its options (semantic keys, e.g. YES / NO, OPENING / PATTERN);
  * every question shows its options as letters A, B, C in an order drawn once per *base* question (the same order
    for its mirror / rotation twins and for both members of a counterfactual pair, so a constant letter cannot look
    like reading), plus UNRESOLVED, which is always allowed and never scored as wrong;
  * the reply is JSON {"answer": "A|B|C|UNRESOLVED", "confidence": "LOW|MEDIUM|HIGH"}, decoded under a JSON schema
    (grammar-constrained), so no free-form text is ever scored.

The five input modes (brief section 5) and their wording live here so a mode means the same thing for every model.
"""
import hashlib
import random

# ROI marker: cyan, never red (publishers draw dimensions in red). Analyzer overlay: purple, neutral, never green/red.
ROI = (0, 190, 230)
ROI_FILL = (0, 190, 230, 46)
OVERLAY = (150, 70, 200)

PLAN_MAX_SIDE = 768     # the whole plan, longest side, downscale only
CROP_SIDE = 448         # the close-up, square

MODES = ['A_CROP_ONLY', 'B_FULL_PLAN', 'C_FULL_PLAN_MARKED_ROI', 'D_MARKED_ROI_PLUS_CROP', 'E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY']
MODE_LETTER = {m: m[0] for m in MODES}

PREAMBLE = ('You are reading an architectural floor plan: a drawing of a building seen from above. Walls are drawn as '
            'thick dark bands; windows, doors and garage doors are gaps in walls with thin symbols across them; '
            'terraces and paving may be textured.')

# class -> (question, [(semantic key, option text), ...]); UNRESOLVED is appended to every class
CLASSES = {
    'BODY_REGION': ('Is the marked area part of the enclosed building body, that is inside the exterior walls of the house (rooms, hall, garage)?',
                    [('YES', 'yes: inside the enclosed building body'), ('NO', 'no: outside it (terrace, porch, patio, drive or open space)')]),
    'TERRACE_VS_BODY': ('Is the marked area enclosed building interior, or an external terrace, porch or patio?',
                        [('ENCLOSED', 'enclosed building interior'), ('EXTERNAL', 'an external terrace, porch or patio')]),
    'GARAGE_BODY': ('Is the marked garage area part of the enclosed building footprint, attached to the house and closed by walls and a garage door?',
                    [('YES', 'yes: an enclosed garage that is part of the building'), ('NO', 'no: detached, open or outside the building')]),
    'BAY_OR_RISALIT': ('Is the marked protrusion part of the enclosed building body (a walled bay or projection of the house)?',
                       [('YES', 'yes: a walled part of the building body'), ('NO', 'no: not enclosed building (terrace, canopy, steps)')]),
    'OPENING_VS_PATTERN': ('Is the marked gap a real window or door opening in a wall, or only a break in hatching, texture or a decorative pattern?',
                           [('OPENING', 'a real window or door opening in a wall'), ('PATTERN', 'only a break in hatching, texture or pattern')]),
    'WALL_CONTINUATION': ('Does the wall continue across the marked gap (the gap is a window, door or garage door in one continuing wall), or does the wall end there so that the building is open or steps back?',
                          [('CONTINUES', 'the wall continues across the gap (an opening in one wall)'), ('TERMINATES', 'the wall ends there (the building is open or steps back)'),
                           ('NOT_SAME_WALL', 'the pieces on either side are not parts of one wall line')]),
    'CANOPY_PERGOLA_VS_WALL': ('Is the marked line an exterior wall of the building, or only roof, roof overhang, pergola or canopy geometry?',
                               [('WALL', 'an exterior wall'), ('NOT_WALL', 'only roof, overhang, pergola or canopy geometry')]),
    'OUTER_BOUNDARY_A_OR_B': ('Which candidate outline better follows the exterior walls of the enclosed building (not terraces or open areas)?',
                              [('OUTLINE_1', 'outline 1'), ('OUTLINE_2', 'outline 2'), ('NEITHER', 'neither outline')]),
    'OPEN_SIDE_VS_OPENINGS': ('Is the marked stretch of the facade one single place where the building is open, or several separate openings (doors, a garage door, a recessed entrance) within a continuing building front?',
                              [('ONE_OPEN_SIDE', 'one single open side'), ('SEVERAL_OPENINGS', 'several separate openings in a continuing front')]),
    'STOREY_COVERAGE': ('The plan shows the ground floor and the upper floor of the same house. Does the upper floor extend over the marked area of the ground floor?',
                        [('YES', 'yes: the upper floor is built over the marked area'), ('NO', 'no: there is no upper floor over the marked area')]),
    'VOID_VS_OUTSIDE': ('Is the marked area an internal stair opening or void inside the building, or open-air space outside the building such as a courtyard?',
                        [('VOID', 'an internal stair opening or void'), ('OUTSIDE', 'open-air space outside the building')]),
    'DIMENSION_LINE_VS_BUILDING_LINE': ('Is the marked line part of the building drawing (a wall, terrace edge or roof line), or annotation such as a dimension line?',
                                        [('BUILDING', 'part of the building drawing'), ('ANNOTATION', 'annotation such as a dimension line')]),
    'COLUMN_VS_WALL': ('Is the marked dark element an isolated column or post, or part of a continuous wall?',
                       [('COLUMN', 'an isolated column or post'), ('WALL', 'part of a continuous wall')]),
    'GAP_KIND': ('What is the marked stretch of the line?',
                 [('OPENING', 'an opening (door, window, glazed wall, garage door) in a wall that continues across it'),
                  ('OPEN', 'no wall continues across it: an open side, porch mouth, recessed entrance, carport, loggia or wall end'),
                  ('NOT_A_WALL_LINE', 'not a wall line at all (room interior, terrace or paving edge, step, dimension line, furniture, hatching)')]),
    'GARAGE_DOOR_VS_CARPORT': ('Is the marked stretch a garage door closing an enclosed garage, or the open mouth of a carport or open parking space?',
                               [('GARAGE_DOOR', 'a garage door of an enclosed garage'), ('OPEN_CARPORT', 'the open mouth of a carport or open parking space')]),
    'LOGGIA_VS_ROOM': ('Is the marked area an enclosed room, or an open loggia or recessed porch under the building (open to the outside on at least one side)?',
                       [('ROOM', 'an enclosed room'), ('LOGGIA', 'an open loggia or recessed porch')]),
    # post-review B-2 / D-1: replaces GARAGE_DOOR_VS_CARPORT for the generator's garage family (vrgen2 >= 2.1.0), whose
    # front gap is unmarked in both members; what differs, and what the drawing shows, is the back of the bay
    'BAY_BACK_CLOSED_VS_DRIVE_THROUGH': ('Behind the marked opening is a bay for a car. Is the bay closed at the back (an enclosed bay such as a garage), or open at the back so that a car can drive straight through (a drive-through carport)?',
                                         [('CLOSED_BACK', 'closed at the back'), ('DRIVE_THROUGH', 'open at the back: a drive-through carport')]),
}

# post-review B-1: where the two storey panels are after the scene transform (vrgen.tf_point: MIRROR x -> -x,
# ROT90 (x, y) -> (-y, x), ROT180 both negated); real storey composites are NORMAL
STOREY_LAYOUT = {'NORMAL': 'ground floor on the left, upper floor on the right', 'MIRROR': 'upper floor on the left, ground floor on the right',
                 'ROT180': 'upper floor on the left, ground floor on the right', 'ROT90': 'ground floor at the top, upper floor at the bottom'}

MARKER_TEXT = {
    'REGION': 'the area outlined and lightly shaded in cyan',
    'SEGMENT': 'the stretch of line between the two cyan brackets',
    'AB_REGIONS': 'two candidate outlines drawn in cyan, outline 1 (solid line) and outline 2 (dashed line)',
}


def option_order(order_key, n):
    """A permutation of n options drawn once per base question (deterministic, independent of mode and model)."""
    rng = random.Random(int(hashlib.sha256(order_key.encode()).hexdigest()[:12], 16))
    idx = list(range(n))
    rng.shuffle(idx)
    return idx


def options_for(cls, order_key):
    q, opts = CLASSES[cls]
    perm = option_order(order_key, len(opts))
    letters = 'ABC'
    shown = [(letters[i], opts[j][0], opts[j][1]) for i, j in enumerate(perm)]
    return q, shown   # [(letter, semantic key, text)]


def letter_of(shown, key):
    for letter, k, _ in shown:
        if k == key:
            return letter
    return None


def key_of(shown, letter):
    if letter == 'UNRESOLVED':
        return 'UNRESOLVED'
    for l, k, _ in shown:
        if l == letter:
            return k
    return None


def norm1000(v, size):
    return int(round(1000 * v / size))


def coord_text(kind, target_plan_px, plan_size):
    """Mode B: where the detail is, in the 0..1000 frame of the plan image (no mark drawn)."""
    W, H = plan_size
    P = lambda p: f'({norm1000(p[0], W)}, {norm1000(p[1], H)})'
    if kind == 'REGION':
        xs = [p[0] for p in target_plan_px]
        ys = [p[1] for p in target_plan_px]
        return f'the area inside the box from {P((min(xs), min(ys)))} to {P((max(xs), max(ys)))}'
    if kind == 'SEGMENT':
        a, b = target_plan_px
        return f'the stretch of line from {P(a)} to {P(b)}'
    if kind == 'AB_REGIONS':
        o1 = ', '.join(P(p) for p in target_plan_px['A'])
        o2 = ', '.join(P(p) for p in target_plan_px['B'])
        return f'two candidate outlines: outline 1 with corners {o1}; outline 2 with corners {o2}'
    raise ValueError(kind)


def prompt_for(q, mode, plan_size, target_plan_px, overlay_has_bands):
    kind = q['targetKind']
    question, shown = options_for(q['cls'], q['orderKey'])
    marker = MARKER_TEXT[kind]
    storey = q['cls'] == 'STOREY_COVERAGE'
    plan_word = f"the two floor plans ({STOREY_LAYOUT[q.get('transform') or 'NORMAL']})" if storey else 'the whole floor plan'
    if mode == 'A_CROP_ONLY':
        where = f'The image is a close-up crop of the plan around the detail in question. The detail is {marker}.'
    elif mode == 'B_FULL_PLAN':
        where = (f'The image shows {plan_word}. The detail in question is not drawn on the image: it is '
                 f'{coord_text(kind, target_plan_px, plan_size)}, in coordinates where the image spans 0 to 1000 in both directions (x to the right, y downwards).')
    elif mode == 'C_FULL_PLAN_MARKED_ROI':
        where = f'The image shows {plan_word}. The detail in question is {marker}.'
    else:
        where = (f'The first image shows {plan_word}; the second image is a close-up crop around the detail in question. '
                 f'In both images the detail is {marker}.')
        if mode == 'E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY':
            where += (' In the first image, thin purple lines show the axes of wall-thick ink that an automatic analyzer detected. '
                      'These marks can be incomplete or wrong.' if overlay_has_bands else
                      ' The automatic analyzer detected no wall-thick ink on this plan, so no purple marks are drawn.')
    lines = [PREAMBLE, where, f'Question: {question}', 'Options:']
    lines += [f'{l}. {t}' for l, _, t in shown]
    lines.append('UNRESOLVED. The drawing does not let you decide.')
    letters = '|'.join([l for l, _, _ in shown] + ['UNRESOLVED'])
    lines.append(f'Reply with JSON only, in exactly this form: {{"answer": "<{letters}>", "confidence": "<LOW|MEDIUM|HIGH>"}}. '
                 'Use HIGH only when the drawing settles the question.')
    return '\n'.join(lines), shown


def answer_schema(shown):
    return {'type': 'object', 'properties': {'answer': {'enum': [l for l, _, _ in shown] + ['UNRESOLVED']},
                                             'confidence': {'enum': ['LOW', 'MEDIUM', 'HIGH']}},
            'required': ['answer', 'confidence']}
