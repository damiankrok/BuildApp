# v3.46: PRZED/PO with the v3.46 scorers (per-sign section numbers, one-to-one callouts, three-layer views) on given run
# roots. The v3.45 tables are history and are not rewritten; this produces new tables beside them.
# usage: przed_po_v346.py <config.json> <out.json> <out.md>
#   config: {"columns": [{"name": "PRZED", "DEV": {"runs": dir, "traces": dir}, "EVAL": {...}}, ...]}
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', '..', 'reading-v345', 'annotations')
SIGNS = os.path.join(HERE, '..', 'annotations', 'section-signs.txt')
VIEWS = {'DEV': os.path.join(A, 'views-dev.json'), 'EVAL': os.path.join(A, 'views-eval.json')}
CALLOUTS = f"{os.path.join(A, 'callouts-dev.json')},{os.path.join(A, 'callouts-eval.json')}"


def run(script, args, out):
    subprocess.run([sys.executable, os.path.join(HERE, script), *args, out], check=True, capture_output=True)
    return json.load(open(out))


def main(cfg_path, out_json, out_md):
    cfg = json.load(open(cfg_path))
    tmp = os.path.dirname(os.path.abspath(out_json))
    res = {}
    for col in cfg['columns']:
        for split in ('DEV', 'EVAL'):
            r = col[split]
            key = f"{col['name']}-{split}"
            o = {}
            o['views'] = run('score_views_v2.py', [VIEWS[split], r['runs']], os.path.join(tmp, f'{key}-views.json'))
            o['signs'] = run('score_section_signs.py', [SIGNS, f"{VIEWS['DEV']},{VIEWS['EVAL']}", r.get('signs', r['traces'])], os.path.join(tmp, f'{key}-signs.json'))
            o['callouts'] = run('score_callouts_v2.py', [CALLOUTS, f"{VIEWS['DEV']},{VIEWS['EVAL']}", r['runs'], r['traces']], os.path.join(tmp, f'{key}-callouts.json'))
            res[key] = {'views': {k: o['views'][k] for k in ('n', 'graph', 'pixels', 'side')}, 'signs': o['signs']['totals'], 'callouts': o['callouts']['totals']}
    json.dump(res, open(out_json, 'w'), indent=1)
    cols = [c['name'] for c in cfg['columns']]
    L = ['| skill (v3.46 scorer) | split | ' + ' | '.join(cols) + ' |', '|---|---|' + '---|' * len(cols)]

    def cell(key, f):
        try:
            return f(res[key])
        except KeyError:
            return '—'

    def sg(sp, k, layer):
        return lambda r: f"{r['signs'].get(f'{sp}|{k}|{layer}', 0)}/{r['signs'].get(f'{sp}|{k}|n', 0)}"

    rowspec = []
    for sp in ('DEV', 'EVAL'):
        rowspec += [
            ('view roles, graph macro F1', sp, lambda r: f"{r['views']['graph']['macroF1']:.4f} (N={r['views']['n']})"),
            ('view roles, pixels macro F1 on decided (coverage)', sp, lambda r: f"{r['views']['pixels']['macroF1OnDecided']:.4f} ({r['views']['pixels']['coverage'].get('decided', 0)}/{r['views']['n']})"),
            ('elevation side coarse F/R/S', sp, lambda r: f"{r['views']['side'].get('coarseOk', 0)}/{r['views']['side'].get('coarseN', 0)}"),
            ('elevation side exact L/R', sp, lambda r: f"{r['views']['side'].get('exactOk', 0)}/{r['views']['side'].get('exactN', 0)} (not measured {r['views']['side'].get('exactNotMeasured', 0)})"),
        ]
        for k, name in (('LEVEL', 'section levels'), ('R', '  ridge'), ('E', '  eaves'), ('F', '  storey floor'), ('T', '  terrain'), ('ANGLE', 'roof pitch'), ('HEIGHT', 'vertical dimensions')):
            rowspec.append((f'{name}: read at the sign', sp, sg(sp, k, 'read')))
            if k in ('LEVEL', 'ANGLE', 'HEIGHT'):
                rowspec.append((f'{name}: raw text exact', sp, sg(sp, k, 'rawExact')))
                rowspec.append((f'{name}: OCR token right at the sign (any reader)', sp, sg(sp, k, 'ocrRaw')))
                rowspec.append((f'{name}: conflicting claims / additions', sp, lambda r, sp=sp, k=k: f"{r['signs'].get(f'{sp}|{k}|conflict', 0)} / {r['signs'].get(f'{sp}|{k}|additions', 0)}"))
        rowspec += [
            ('callout ring found', sp, lambda r, sp=sp: f"{r['callouts'].get(f'{sp}|ringFound', 0)}/{r['callouts'].get(f'{sp}|n', 0)}"),
            ('callout digits exact', sp, lambda r, sp=sp: f"{r['callouts'].get(f'{sp}|digits', 0)}/{r['callouts'].get(f'{sp}|n', 0)}"),
            ('callout → its own opening, complete (OK)', sp, lambda r, sp=sp: f"{r['callouts'].get(f'{sp}|OK', 0)}/{r['callouts'].get(f'{sp}|n', 0)}"),
            ('  merged / split / missing opening / no model', sp, lambda r, sp=sp: '/'.join(str(r['callouts'].get(f'{sp}|{e}', 0)) for e in ('MERGED_GAP', 'SPLIT_GAP', 'MISSING_OPENING', 'NO_MODEL'))),
            ('  not bound / wrong binding / wrong digits / wrong kind', sp, lambda r, sp=sp: '/'.join(str(r['callouts'].get(f'{sp}|{e}', 0)) for e in ('NOT_BOUND', 'WRONG_BINDING', 'WRONG_DIGITS', 'WRONG_KIND'))),
            ('  additions (bound gaps at no callout)', sp, lambda r, sp=sp: str(r['callouts'].get(f'{sp}|additions', 0))),
        ]
    for name, sp, f in rowspec:
        L.append(f'| {name} | {sp} | ' + ' | '.join(cell(f'{c}-{sp}', f) for c in cols) + ' |')
    open(out_md, 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main(*sys.argv[1:4])
