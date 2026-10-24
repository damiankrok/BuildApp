"""IU-02: aggregate eval_clean_synth.py output per style — projection states, building IoU, opening preservation
(kept / misclassified / missing / missing-behind-occluder / added) and point shifts (px and share of building width),
with a 95% bootstrap interval on the medians over images. Text only; reads a JSON written outside the repository.

    python3 -I summarise_clean_synth.py <clean-synth.json> [<summary.json outside the repo>]
"""
import json, os, random, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo


def boot(xs, f=statistics.median, n=2000, seed=11):
    if not xs:
        return None
    rnd = random.Random(seed)
    s = sorted(f([rnd.choice(xs) for _ in xs]) for _ in range(n))
    return [round(s[int(0.025 * n)], 3), round(s[int(0.975 * n) - 1], 3)]


def pct(xs, q):
    s = sorted(xs)
    return s[min(len(s) - 1, int(q * len(s)))] if s else None


def main():
    rows = json.load(open(sys.argv[1]))
    out = {}
    for style in sorted({r['style'] for r in rows}):
        rs = [r for r in rows if r['style'] == style]
        states = {}
        for r in rs:
            states[r['projection']] = states.get(r['projection'], 0) + 1
        iou = [r['seg']['buildingIoU'] for r in rs if r['seg'].get('buildingIoU') is not None]
        win = {}
        for g in ('GLASS', 'DOOR_OR_GATE'):
            t = {k: sum(r['windows'][g][k] for r in rs) for k in ('gt', 'kept', 'misclassified', 'missing', 'missingOccluded', 'added')}
            t['keptShare'] = round(t['kept'] / t['gt'], 3) if t['gt'] else None
            win[g] = t
        exact = sum(1 for r in rs if all(r['windows'][g]['missing'] == 0 and r['windows'][g]['added'] == 0 and r['windows'][g]['misclassified'] == 0 for g in ('GLASS', 'DOOR_OR_GATE')))
        med = [r['points']['srcToCleanMedianPx'] for r in rs if r['points'].get('srcToCleanMedianPx') is not None]
        p95 = [r['points']['srcToCleanP95Px'] for r in rs if r['points'].get('srcToCleanP95Px') is not None]
        share = [r['pointsShareOfWidthP95'] for r in rs if r.get('pointsShareOfWidthP95') is not None]
        ortho = [r for r in rs if r['projection'] == 'ORTHOGRAPHIC_SUPPORTED']
        omed = [r['points']['srcToCleanMedianPx'] for r in ortho if r['points'].get('srcToCleanMedianPx') is not None]
        op95 = [r['points']['srcToCleanP95Px'] for r in ortho if r['points'].get('srcToCleanP95Px') is not None]
        out[style] = {'images': len(rs), 'projection': states,
                      'buildingIoU': {'median': round(statistics.median(iou), 4) if iou else None, 'p10': pct(iou, 0.10), 'ci95Median': boot(iou)},
                      'openings': win, 'imagesWithExactOpeningSet': exact,
                      'pointShiftPx': {'medianOfImageMedians': round(statistics.median(med), 2) if med else None, 'ci95': boot(med),
                                       'medianOfImageP95': round(statistics.median(p95), 2) if p95 else None, 'worstImageP95': round(max(p95), 2) if p95 else None,
                                       'imagesMeetingTarget(med<=2,p95<=5)': sum(1 for a, b in zip(med, p95) if a <= 2 and b <= 5), 'imagesMeasured': len(med)},
                      'pointShiftP95ShareOfWidth': {'median': round(statistics.median(share), 5) if share else None, 'max': round(max(share), 5) if share else None},
                      'orthographicOnly': {'images': len(ortho), 'medianOfImageMedians': round(statistics.median(omed), 2) if omed else None,
                                           'medianOfImageP95': round(statistics.median(op95), 2) if op95 else None,
                                           'meetingTarget': sum(1 for a, b in zip(omed, op95) if a <= 2 and b <= 5)},
                      'timingS': {k: round(statistics.median([r['timing'][k] for r in rs if k in r['timing']]), 3) for k in ('segmentS', 'projectionS', 'cleanS')}}
    txt = json.dumps(out, indent=1)
    if len(sys.argv) > 2:
        refuse_inside_repo(sys.argv[2], 'summary')
        open(sys.argv[2], 'w').write(txt + '\n')
    print(txt)


if __name__ == '__main__':
    main()
