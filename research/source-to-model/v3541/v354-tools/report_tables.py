#!/usr/bin/env python3
"""report_tables.py <strategy...>: markdown tables (per house, per publisher, per split, first loss) from table-*.json."""
import json,sys,os,collections
R='/home/user/rd/v354'; strats=sys.argv[1:] or ['A','B']
rows=json.load(open(R+'/table-%s.json'%'-'.join(strats)))
def stage(s):
    if s is None: return '—'
    if not s['model']:
        c=s.get('code') or ''; ff=s.get('firstFailure') or ''
        if c=='METRIC_RESOLUTION_INCONCLUSIVE' and ff=='PLAN_NO_DIMENSION_FRAME': return '5 metryka: brak ramy wymiarowej'
        if c=='METRIC_RESOLUTION_INCONCLUSIVE' and ff=='PLAN_NO_WALLED_ENVELOPE': return '5+6 metryka i obwiednia'
        if c=='METRIC_RESOLUTION_INCONCLUSIVE': return '5+6 metryka (%s)'%ff
        if c=='PLAN_RESOLUTION_INCONCLUSIVE': return '7/9 arbitraż odczytu (%s)'%ff
        if c=='DESCRIPTION_REFUSED': return 'opis odrzucony (schemat)'
        return c
    d=[]
    if s.get('size')=='WRONG': d.append('5/6 rozmiar %d%%'%round(100*s['sizeErr']))
    elif s.get('size')=='NEAR': d.append('rozmiar ~%d%%'%round(100*s['sizeErr']))
    if s.get('area') in ('NEAR','WRONG'): d.append('6 obrys %.2f'%s['areaVsRef'])
    if s.get('storeys') is False: d.append('3/7 kondygnacje %s≠%s'%(s.get('wallLevels'),s.get('refStoreys')))
    if s.get('roofKind') is False: d.append('7 dach %s≠%s'%(s.get('modelRoof'),s.get('refRoof')))
    elif s.get('roofRidge') is False: d.append('7 kalenica')
    if s.get('openings')=='OFF': d.append('4/7 otwory ×%s'%s.get('openingsRatio'))
    return '; '.join(d) or 'bez wykrytej wady'
def cell(s):
    if s is None: return '—'
    if not s['model']: return 'odmowa'
    return 'UŻYWALNY' if s['verdict']=='SCENE_USABLE' else 'model z wadą'
print('| grupa | wydawca | dom | '+' | '.join('%s wynik | %s etap/wady'%(k,k) for k in strats)+' |')
print('|'+'---|'*(3+2*len(strats)))
for r in rows:
    print('| %s | %s | %s | '%(r['split'],r['publisher'],r['house'][:40])+' | '.join('%s | %s'%(cell(r.get(k)),stage(r.get(k))) for k in strats)+' |')
print()
for key in ('publisher','split'):
    agg=collections.OrderedDict()
    for r in rows:
        a=agg.setdefault(r[key],collections.Counter()); a['N']+=1
        for k in strats:
            s=r.get(k)
            if s is None: a[k+'_none']+=1; continue
            a[k+'_model']+=s['model']; a[k+'_usable']+=(s.get('verdict')=='SCENE_USABLE')
    print('| %s | N | '%key+' | '.join('%s modele | %s używalne'%(k,k) for k in strats)+' |'); print('|'+'---|'*(2+2*len(strats)))
    for g,a in agg.items(): print('| %s | %d | '%(g,a['N'])+' | '.join('%d%s | %d'%(a[k+'_model'],(' (brak %d)'%a[k+'_none']) if a[k+'_none'] else '',a[k+'_usable']) for k in strats)+' |')
    print()
