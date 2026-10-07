#!/usr/bin/env python3
"""bands_prep.py - the analyzer-overlay inputs of mode E (RESEARCH ONLY; pictures stay outside the repository).

    python -I -B research/analyzer-005m/bands_prep.py link --pool <W>/corpus/pool.json --selection <W>/corpus/selection.json --dir <W>/bands/src
    npx vite-node research/analyzer-005j/bands.ts -- --dir <W>/bands/src --out <W>/bands/raw.json
    python -I -B research/analyzer-005m/bands_prep.py index --raw <W>/bands/raw.json --out <W>/bands/bands.json

`link` exposes each distinct plan image the selection uses as <sha256>.png (symlinks, no copy); 005J's read-only
`bands.ts` runs the production planSheet wall-band pass over them; `index` keys its output by image SHA-256, which is
what compose5.py looks up.
"""
import argparse
import json
import os

REPO = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('step', choices=['link', 'index'])
    ap.add_argument('--pool')
    ap.add_argument('--selection')
    ap.add_argument('--dir')
    ap.add_argument('--raw')
    ap.add_argument('--out')
    a = ap.parse_args()
    if a.step == 'link':
        if os.path.realpath(a.dir).startswith(REPO):
            raise SystemExit('pictures stay outside the repository')
        os.makedirs(a.dir, exist_ok=True)
        pool = {q['qid']: q for q in json.load(open(a.pool))['questions']}
        n = 0
        for qid in json.load(open(a.selection))['phase2']:
            s = pool[qid]['sources'][0]
            dst = os.path.join(a.dir, s['sha256'] + '.png')
            if not os.path.exists(dst):
                os.symlink(s['path'], dst)
                n += 1
        print(n, 'distinct plan images')
    else:
        r = json.load(open(a.raw))
        json.dump({'layer': r['layer'], 'files': {k[:-4]: v for k, v in r['files'].items()}}, open(a.out, 'w'))
        print(len(r['files']), 'images indexed')


if __name__ == '__main__':
    main()
