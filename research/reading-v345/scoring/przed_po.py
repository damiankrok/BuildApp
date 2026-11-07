# v3.45: PRZED/PO per skill and per project, same frozen annotations, same inputs.
# usage: przed_po.py <out.json> <out.md> [<po-runs> <po-traces>]   (default PO: po2)
import json, subprocess, sys, os, collections
R = '/home/user/rd'; S = '/home/user/BuildApp/research/reading-v345/scoring'
PO, POT = (sys.argv[3], sys.argv[4]) if len(sys.argv) > 4 else (f'{R}/po2', f'{R}/trace-po2')
RUNS = {
    ('DEV', 'PRZED'): (f'{R}/links/przed-dev', f'{R}/links/trace-przed-dev'),
    ('EVAL', 'PRZED'): (f'{R}/eval', f'{R}/trace-przed-eval'),
    ('DEV', 'PO'): (PO, POT),
    ('EVAL', 'PO'): (PO, POT),
}
ROOMS = f'{S}/../annotations/room-numbers-eval.json'
LAB = {'DEV': (f'{R}/labels/views-dev.json', f'{R}/labels/levels-dev.txt', f'{R}/labels/callouts-dev.json'),
       'EVAL': (f'{R}/labels/views-eval.json', f'{R}/labels/levels-eval.txt', f'{R}/labels/callouts-eval.json')}
def run(args):
    p = subprocess.run(['python3', *args], capture_output=True, text=True)
    return p.stdout
out = {}
for (split, when), (runs, traces) in RUNS.items():
    v, l, c = LAB[split]; key = f'{split}-{when}'; o = {}
    tmp = f'{R}/score/{key}'
    run([f'{S}/score_views.py', v, runs, f'{tmp}-views.json']); o['views'] = json.load(open(f'{tmp}-views.json'))
    run([f'{S}/score_content.py', v, runs, f'{tmp}-content.json']); o['content'] = json.load(open(f'{tmp}-content.json'))
    run([f'{S}/score_levels.py', l, v, runs, f'{tmp}-levels.json']); o['levels'] = json.load(open(f'{tmp}-levels.json'))
    run([f'{R}/tools/score_callouts.py', c, v, runs, traces, f'{tmp}-callouts.json']); o['callouts'] = json.load(open(f'{tmp}-callouts.json'))
    if split == 'EVAL':
        run([f'{S}/score_room_numbers.py', ROOMS, runs, f'{tmp}-rooms.json']); o['rooms'] = json.load(open(f'{tmp}-rooms.json'))
    out[key] = o
json.dump(out, open(sys.argv[1], 'w'), indent=1)

def lev(o, g):
    t = o['levels']['totals']; n = t.get(f'legible|{g}|n', 0); h = t.get(f'legible|{g}|hit', 0)
    return n, h, t.get(f'extra|{g}', 0)
def cal(o, split):
    t = o['callouts']['totals']
    return {k.split('|')[1]: v for k, v in t.items() if k.startswith(split + '|')}
md = ['| skill | split | N | PRZED | PO | PRZED wrong/added | PO wrong/added |', '|---|---|---|---|---|---|---|']
for split in ('DEV', 'EVAL'):
    a, b = out[f'{split}-PRZED'], out[f'{split}-PO']
    md.append(f"| view roles (macro F1, graph) | {split} | {a['views']['n']} | {a['views']['macroF1']:.3f} | {b['views']['macroF1']:.3f} | | |")
    md.append(f"| storey of plans | {split} | {a['views']['storey']['n']} | {a['views']['storey']['correct']} | {b['views']['storey']['correct']} | | |")
    md.append(f"| elevation side | {split} | {a['views']['side']['n']} | {a['views']['side']['correct']} | {b['views']['side']['correct']} | | |")
    for g, name in (('LEVEL', 'section levels exact'), ('ANGLE', 'section pitch exact'), ('HEIGHT', 'section vertical dims exact')):
        n, ha, ea = lev(a, g); _, hb, eb = lev(b, g)
        md.append(f'| {name} | {split} | {n} | {ha} ({ha / max(1, n):.0%}) | {hb} ({hb / max(1, n):.0%}) | {ea} | {eb} |')
    for sp in (('EVAL', 'DEV') if split == 'EVAL' else ('DEV',)):
        ca, cb = cal(a, sp), cal(b, sp)
        if not ca.get('n'): continue
        n = ca['n']
        md.append(f"| callout digits exact ({sp} projects) | {split} | {n} | {ca.get('digits', 0)} ({ca.get('digits', 0) / n:.0%}) | {cb.get('digits', 0)} ({cb.get('digits', 0) / n:.0%}) | | |")
        md.append(f"| callout → opening complete ({sp} projects) | {split} | {n} | {ca.get('OK', 0)} ({ca.get('OK', 0) / n:.0%}) | {cb.get('OK', 0)} ({cb.get('OK', 0) / n:.0%}) | {ca.get('additions', 0)} | {cb.get('additions', 0)} |")
a, b = out['EVAL-PRZED']['rooms']['totals'], out['EVAL-PO']['rooms']['totals']
for sp in ('EVAL', 'DEV'):
    n = a.get(f'{sp}|kept|n', 0)
    for mode, name in (('kept', 'room numbers shown (kept)'), ('withSetAside', 'room numbers shown (incl. set-aside)')):
        ca, cb = a.get(f'{sp}|{mode}|CORRECT', 0), b.get(f'{sp}|{mode}|CORRECT', 0)
        wa, wb = a.get(f'{sp}|{mode}|WRONG', 0), b.get(f'{sp}|{mode}|WRONG', 0)
        md.append(f"| {name} ({'EVAL blind' if sp == 'EVAL' else 'Balsamowce, non-blind'}) | EVAL | {n} | {ca} ({ca / max(1, n):.0%}) | {cb} ({cb / max(1, n):.0%}) | {wa}/{a.get(f'{sp}|{mode}|additions', 0)} | {wb}/{b.get(f'{sp}|{mode}|additions', 0)} |")
open(sys.argv[2], 'w').write('\n'.join(md) + '\n')
print('\n'.join(md))
