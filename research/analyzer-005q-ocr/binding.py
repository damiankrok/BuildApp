"""binding.py - BUILDPLAN-ANALYZER-005Q-OCR pure geometry for truth binding, blind binding (B2) and scale clusters
(RESEARCH ONLY). Boxes are page boxes {x0,x1,y0,y1}; a line is {axis, baselinePx, ticks: [{atPx}]}.
No file, no pixel, no scale input to `assign_blind`."""
import re
import statistics

INT = re.compile(r'^[0-9]{2,5}$')
ON_LINE_ACROSS = 2.2      # production onDimensionLine: within 2.2 label heights across
PROPORTIONAL = 0.03       # truth binding: value/px within 3 % of a peer on the same line
UNRESOLVED_MARGIN = 0.25  # B2: best and second-best costs closer than this -> UNRESOLVED
SAME_SEG_PX = 3.0


def axis_of(orientation):
    return 'HORIZONTAL' if orientation in ('HORIZONTAL', 'INVERTED') else 'VERTICAL'


def center(b):
    return ((b['x0'] + b['x1']) / 2, (b['y0'] + b['y1']) / 2)


def contains(b, p, m=2.0):
    return b['x0'] - m <= p[0] <= b['x1'] + m and b['y0'] - m <= p[1] <= b['y1'] + m


def short_side(b):
    return max(1.0, min(b['x1'] - b['x0'], b['y1'] - b['y0']))


def corroborating(r):
    """The frozen ensemble's three tests on one reading (top p and greedy mean p >= 0.9; stable; greedy = top)."""
    top = r.get('top') or ''
    return bool(top) and r.get('p', 0) >= 0.9 and r['greedy'].get('meanP', 0) >= 0.9 and bool(r.get('stable')) and r['greedy'].get('text') == top


def _along_across(line, box):
    cx, cy = center(box)
    return (cx, cy) if line['axis'] == 'HORIZONTAL' else (cy, cx)


def on_line(line, box, axis, h):
    """Production's onDimensionLine test: same axis, inside the tick span, within 2.2 label heights across."""
    if axis != line['axis'] or len(line['ticks']) < 2:
        return False
    along, across = _along_across(line, box)
    return abs(across - line['baselinePx']) / max(1.0, h) <= ON_LINE_ACROSS and line['ticks'][0]['atPx'] <= along <= line['ticks'][-1]['atPx']


def tick_marks(line):
    """Addendum C: only marks production classes TICK (a ticked run carries no class and keeps every mark)."""
    return [k['atPx'] for k in line['ticks'] if k.get('class', 'TICK') == 'TICK']


def segments_of(line):
    t = tick_marks(line)
    return [{'axis': line['axis'], 'baselinePx': line['baselinePx'], 'fromPx': a, 'toPx': b, 'line': line['id']} for a, b in zip(t, t[1:]) if b > a]


def segment_at(line, box):
    """The tick-to-tick segment that contains the box centre along the line."""
    along, _ = _along_across(line, box)
    for s in segments_of(line):
        if s['fromPx'] <= along <= s['toPx']:
            return s
    return None


def same_segment(a, b):
    return a['axis'] == b['axis'] and abs(a['baselinePx'] - b['baselinePx']) <= SAME_SEG_PX and abs(a['fromPx'] - b['fromPx']) <= SAME_SEG_PX and abs(a['toPx'] - b['toPx']) <= SAME_SEG_PX


def _dedupe_segments(segs):
    out = []
    for s in segs:
        if not any(same_segment(s, o) for o in out):
            out.append(s)
    return out


def truth_binding(item, dims, lines):
    """Addendum C: the segment (TICK marks only), among EVERY segment of every frozen line the label lies on, whose length
    makes the label's value proportional (within 3 %) to another truth label on the same line, that peer measured on the
    segment under its own position. Unique -> TRUTH; several equal ones of which one lies under the label -> TRUTH
    (tie broken by position, flagged); else AMBIGUOUS_BINDING / NO_LINE_TRUTH. Line-internal only: no page scale."""
    if not item.get('value') or not INT.match(item['value']):
        return {'status': 'NO_VALUE'}
    hits = []
    for ln in lines:
        if not on_line(ln, item['box'], item['axis'], item['h']):
            continue
        segs = segments_of(ln)
        peers = [o for o in dims if o is not item and o.get('value') and INT.match(o['value']) and int(o['value']) > 0 and on_line(ln, o['box'], o['axis'], o['h'])]
        for seg in segs:  # addendum C: every segment of the line, not only the one under the label's centre
            r = int(item['value']) / max(1e-6, seg['toPx'] - seg['fromPx'])
            if r <= 0:
                continue
            # each peer contributes the segment under its own position; only the item's segment is left free
            for o in peers:
                so = segment_at(ln, o['box'])
                if so and not same_segment(so, seg) and abs(r / (int(o['value']) / max(1e-6, so['toPx'] - so['fromPx'])) - 1) <= PROPORTIONAL:
                    hits.append(seg)
                    break
    hits = _dedupe_segments(hits)
    if len(hits) == 1:
        return {'status': 'TRUTH', 'segment': hits[0]}
    # equal-length segments are equally proportional: only then does the label's position break the tie
    along = {ln['id']: _along_across(ln, item['box'])[0] for ln in lines}
    under = [h for h in hits if h['fromPx'] <= along[h['line']] <= h['toPx']]
    if len(hits) > 1 and len(under) == 1:
        return {'status': 'TRUTH', 'segment': under[0], 'tieBrokenByPosition': True}
    return {'status': 'AMBIGUOUS_BINDING' if hits else 'NO_LINE_TRUTH', **({'segments': hits} if hits else {})}


def assign_blind(cands, lines, h_page):
    """B2: each candidate to a segment of a frozen line with its axis, inside the tick span, within 2.2 label heights.
    Cost = across / h + |centre - segment middle| / segment length. Greedy global, one candidate per segment; a margin
    under 0.25 to a different segment is UNRESOLVED. Reads boxes and axes only: never a value, a scale or an area."""
    options = []
    for n, c in enumerate(cands):
        h = short_side(c['box']) if c['box'] else h_page
        opts = []
        for ln in lines:
            if not on_line(ln, c['box'], c['axis'], h):
                continue
            seg = segment_at(ln, c['box'])
            if not seg:
                continue
            along, across = _along_across(ln, c['box'])
            length = max(1e-6, seg['toPx'] - seg['fromPx'])
            cost = abs(across - ln['baselinePx']) / h + abs(along - (seg['fromPx'] + seg['toPx']) / 2) / length
            opts.append((round(cost, 6), seg))
        opts.sort(key=lambda o: (o[0], o[1]['baselinePx'], o[1]['fromPx']))
        options.append(opts)
    result = [{'status': 'NO_LINE'} for _ in cands]
    for n, opts in enumerate(options):
        if not opts:
            continue
        rivals = [o for o in opts[1:] if not same_segment(o[1], opts[0][1])]
        if rivals and rivals[0][0] - opts[0][0] < UNRESOLVED_MARGIN:
            result[n] = {'status': 'UNRESOLVED', 'segments': [opts[0][1], rivals[0][1]]}
    pending = sorted(((opts[0][0], n) for n, opts in enumerate(options) if opts and result[n]['status'] == 'NO_LINE'), key=lambda x: (x[0], x[1]))
    taken = []
    for cost, n in pending:
        seg = options[n][0][1]
        if any(same_segment(seg, t) for t in taken):
            result[n] = {'status': 'SEGMENT_TAKEN'}
            continue
        taken.append(seg)
        result[n] = {'status': 'BOUND', 'segment': seg, 'cost': cost}
    return result


def scale_cluster(pairs, tol=0.015, min_labels=3, min_lines=2):
    """The largest group of value/px ratios within ±1.5 % of its median, from >= 3 labels on >= 2 distinct lines."""
    if not pairs:
        return None
    ratios = sorted((p['value'] / max(1e-6, p['px']), p['line']) for p in pairs if p['px'] > 0 and p['value'] > 0)
    best = None
    for r0, _ in ratios:
        grp = [(r, ln) for r, ln in ratios if abs(r / r0 - 1) <= tol]
        if best is None or len(grp) > len(best):
            best = grp
    if not best or len(best) < min_labels or len({ln for _, ln in best}) < min_lines:
        return None
    return {'scale': round(statistics.median(r for r, _ in best), 5), 'labels': len(best), 'lines': len({ln for _, ln in best}), 'of': len(ratios)}
