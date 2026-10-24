"""IU-02: turn the visual labelling of the anonymised LoC contact sheets (index → class [m] [h]) into
data/labels-loc.json. Labels are the agent's, from pixels only (sheets show an index, no title or search hint);
they are not OWNER-verified. `m` = several drawings on one sheet (never a single facade), `h` = hard case.

    python3 -I data/build_loc_labels.py <loc dir with loc-manifest.json> <sheets/loc-index.json> <raw labels txt>
"""
import json, os, sys

CODE = {'P': 'FLOOR_PLAN', 'E': 'ORTHOGRAPHIC_ELEVATION', 'S': 'TECHNICAL_SECTION', 'X': 'EXTERIOR_PERSPECTIVE',
        'I': 'INTERIOR_PERSPECTIVE', 'T': 'SITE_PLAN', 'D': 'ARCHITECTURAL_DETAIL', 'O': 'OTHER'}
# labels the agent could not settle from the pixels (faded or ambiguous sheets)
DISPUTED = {99, 191, 323, 508, 541}


def main():
    loc, index, raw = sys.argv[1:4]
    man = {r['sha256']: r for r in json.load(open(os.path.join(loc, 'loc-manifest.json')))}
    idx = {r['i']: r['sha256'] for r in json.load(open(index))}
    rows = []
    for line in open(raw):
        parts = line.split()
        if not parts:
            continue
        i, code, flags = int(parts[0]), parts[1], set(parts[2:])
        m = man[idx[i]]
        rows.append({'sha256': m['sha256'], 'file': m['file'], 'label': CODE[code], 'multiView': 'm' in flags, 'hard': 'h' in flags,
                     'labelStatus': 'DISPUTED' if i in DISPUTED else 'CONFIRMED', 'labelSource': 'AGENT_VISUAL_PIXELS_ONLY',
                     'split': m['split'], 'survey': m['survey'], 'rights': m['rights'], 'itemUrl': m['itemUrl'], 'title': m['title']})
    assert len(rows) == len(man) == len({r['sha256'] for r in rows}), 'every image labelled exactly once'
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'labels-loc.json')
    json.dump({'schema': 'iu02.labels-loc/1', 'note': 'agent labels from anonymised sheets; not OWNER-verified', 'rows': rows}, open(out, 'w'), indent=0)
    from collections import Counter
    print(len(rows), Counter((r['split'], r['label']) for r in rows))
    print('single elevations', sum(r['label'] == 'ORTHOGRAPHIC_ELEVATION' and not r['multiView'] for r in rows))


if __name__ == '__main__':
    main()
