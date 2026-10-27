"""IU-03B: cost of stage 2 alone (classical mask + projection test inside it) in a process that imports only numpy,
OpenCV and PIL — what a phone port would carry. Peak RSS and wall time per image; desktop CPU, one thread.

    $PY iu3b/bench.py --rows <rows.json> [--n 60]
"""
import json, os, resource, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import arg_value


def main():
    import cv2
    cv2.setNumThreads(1)
    import numpy as np
    from PIL import Image
    from iu2 import projection as PJ
    from iu3b import masks
    rows = json.load(open(arg_value('--rows')))
    n = int(arg_value('--n', '60'))
    rows = [r for r in rows if os.path.exists(r['path'])][:: max(1, len(rows) // n)][:n]
    base = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    ts, px = [], []
    for r in rows:
        rgb = np.asarray(Image.open(r['path']).convert('RGB'))
        t = time.perf_counter(); m, _ = masks.classic(rgb); PJ.analyse(rgb, mask=m); ts.append(time.perf_counter() - t)
        px.append(rgb.shape[0] * rgb.shape[1] / 1e6)
    ts.sort()
    print(json.dumps({'images': len(ts), 'megapixelsMedian': round(sorted(px)[len(px) // 2], 2), 'megapixelsMax': round(max(px), 2),
                      'secondsMedian': round(ts[len(ts) // 2], 3), 'secondsP95': round(ts[int(0.95 * (len(ts) - 1))], 3), 'secondsMax': round(ts[-1], 3),
                      'peakRssMB': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1), 'rssAfterImportsMB': round(base / 1024, 1),
                      'threads': 1, 'cpu': open('/proc/cpuinfo').read().split('model name')[1].split('\n')[0].split(':', 1)[1].strip()}))


if __name__ == '__main__':
    main()
