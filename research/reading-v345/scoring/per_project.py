# v3.45: PRZED/PO per project from the scorer outputs przed_po.py wrote (score/<SPLIT>-<WHEN>-*.json).
# Columns per house: section levels hit/n (+wrong), pitch hit/n (+wrong), callouts complete/n, digits, not bound,
# missing opening, additions; room numbers right/n (+wrong) where annotated; model built or not, and its failure.
# usage: per_project.py <score-dir> <po-runs> <out.md>
import json, os, sys
S, PO, OUT = sys.argv[1:4]
R = '/home/user/rd'
def load(k):
    f = f'{S}/{k}.json'
    return json.load(open(f)) if os.path.exists(f) else None
rows = []
for split in ('DEV', 'EVAL'):
    data = {w: {n: load(f'{split}-{w}-{n}') for n in ('levels', 'callouts', 'rooms')} for w in ('PRZED', 'PO')}
    houses = sorted({p['project'] for p in data['PRZED']['levels']['projects']} | {p['project'] for p in data['PRZED']['callouts']['projects']})
    for h in houses:
        cells = [split, h[:34]]
        for w in ('PRZED', 'PO'):
            lv = next((p for p in data[w]['levels']['projects'] if p['project'] == h), None)
            if lv:
                it = [i for i in lv['items'] if i['legible']]
                L = [i for i in it if i['group'] == 'LEVEL']; A = [i for i in it if i['group'] == 'ANGLE']
                addL = sum(1 for a in lv.get('additions', []) if a['group'] == 'LEVEL'); addA = sum(1 for a in lv.get('additions', []) if a['group'] == 'ANGLE')
                cells.append(f"{sum(i['read'] for i in L)}/{len(L)}{f' +{addL}' if addL else ''}")
                cells.append(f"{sum(i['read'] for i in A)}/{len(A)}{f' +{addA}' if addA else ''}")
            else: cells += ['–', '–']
            cl = next((p for p in data[w]['callouts']['projects'] if p['project'] == h), None)
            if cl and cl.get('rows'):
                rs = cl['rows']; n = len(rs)
                ok = sum(r['result'] == 'OK' for r in rs); miss = sum(r['result'] == 'MISSING_OPENING' for r in rs); nb = sum(r['result'] == 'NOT_BOUND' for r in rs)
                cells.append(f"{ok}/{n} (nb {nb}, miss {miss}, +{cl.get('additions', 0) if isinstance(cl.get('additions'), int) else len(cl.get('additions', []))})")
            else: cells.append('–')
            rm = data[w]['rooms']
            sh = [x for x in (rm['sheets'] if rm else []) if x['project'] == h]
            if sh and all('withSetAside' in x for x in sh):
                c = sum(q['result'] == 'CORRECT' for x in sh for q in x['withSetAside']['rows']); wr = sum(q['result'] == 'WRONG' for x in sh for q in x['withSetAside']['rows']); n = sum(x['n'] for x in sh)
                cells.append(f"{c}/{n}{f' ✗{wr}' if wr else ''}")
            else: cells.append('–')
        built = os.path.exists(f'{PO}/{h}/model.json')
        cells.append('model' if built else 'NO MODEL')
        rows.append(cells)
hdr = '| split | house | PRZED levels | PRZED pitch | PRZED callouts | PRZED rooms | PO levels | PO pitch | PO callouts | PO rooms | PO model |'
md = [hdr, '|' + '---|' * 11] + ['| ' + ' | '.join(r) + ' |' for r in rows]
open(OUT, 'w').write('\n'.join(md) + '\n'); print('\n'.join(md))
