#!/usr/bin/env python3
"""score.py <strategy dir> <refs dir...> -> per-house scores (frozen definitions of PROTOCOL_V354 §3)."""
import json,os,sys
sys.path.insert(0,os.path.dirname(__file__))
from extract import facts
def band(e,ok,near): return None if e is None else ('OK' if e<=ok else ('NEAR' if e<=near else 'WRONG'))
def ref_openings(r):
    n=0;shown=0
    for f,v in (r.get('openings') or {}).items():
        if isinstance(v,dict) and v.get('shown'):
            shown+=1; n+=sum((s.get('count') or 0) for s in v.get('byStorey',[]))
    return n,shown
def roofkind(k):
    k=(k or '').upper()
    return {'SHED':'MONO_PITCH','MONOPITCH':'MONO_PITCH'}.get(k,k)
def score(run_dir, ref):
    f=facts(run_dir); s={'house':f['dir'],'model':f['model'],'code':f.get('reason') or f.get('code')}
    if not f['model']:
        s.update(stage=f.get('stage'),substage=f.get('substage'),firstFailure=(f.get('diagnostics') or {}).get('firstFailure') or (f.get('diagnostics') or {}).get('firstReading'),verdict='NO_MODEL'); return s,f
    ov=ref.get('overall') or {}; W,D=ov.get('widthM'),ov.get('depthM'); gb=f.get('groundBox')
    if W and D and gb:
        a=sorted([gb['w'],gb['d']]); b=sorted([W,D]); err=max(abs(a[0]-b[0])/b[0],abs(a[1]-b[1])/b[1])
        s['sizeErr']=round(err,3); s['size']=band(err,0.03,0.08)
        s['frontOriented']= abs(gb['w']-W)/W<=0.08 and abs(gb['d']-D)/D<=0.08
    else: s['size']=None
    pub=(f.get('coverage') or {})
    s['coverage']=pub.get('status'); s['coverageShare']=pub.get('share')
    go=(ref.get('groundOutline') or {}); 
    if go.get('closedAreaM2') and f.get('groundSlabM2'):
        e=abs(f['groundSlabM2']-go['closedAreaM2'])/go['closedAreaM2']; s['areaVsRef']=round(f['groundSlabM2']/go['closedAreaM2'],3); s['area']=band(e,0.06,0.20)
    st=(ref.get('storeys') or {}).get('fullStoreysAboveGround')
    att=bool((ref.get('storeys') or {}).get('habitableAttic'))
    # an attic built as a level of its own is allowed, not required (PROTOCOL §3 S4, clarified before any A result was read)
    s['storeys']=None if st is None else (f.get('wallLevels')==st or (att and f.get('wallLevels')==st+1)); s['wallLevels']=f.get('wallLevels'); s['refStoreys']=st
    rr=dict(ref.get('mainRoof') or {}); mr=f.get('mainRoof') or {}
    # reference vocabulary normalised (readers wrote FRONT_TO_BACK / SIDE_TO_SIDE for the same two directions)
    rr['ridge']={'FRONT_TO_BACK':'ACROSS_FRONT','SIDE_TO_SIDE':'ALONG_FRONT','LEFT_TO_RIGHT':'ALONG_FRONT'}.get(rr.get('ridge'),rr.get('ridge'))
    s['roofKind']=None if not rr.get('kind') else (roofkind(mr.get('kind'))==roofkind(rr.get('kind')))
    s['roofRidge']=None if rr.get('ridge') in (None,'NA') or not mr else (mr.get('ridge')==rr.get('ridge'))
    s['modelRoof']=mr.get('kind'); s['refRoof']=rr.get('kind')
    n,shown=ref_openings(ref)
    if n: s['openingsRatio']=round(f.get('extOpenings',0)/n,2); s['openings']='OK' if 0.7<=s['openingsRatio']<=1.3 else 'OFF'
    s['verdict']='SCENE_USABLE' if (s.get('size') in ('OK','NEAR') and s.get('storeys') and s.get('roofKind')) else 'MODEL_FLAWED'
    s['quantities']=f.get('quantities'); s['scale']=(f.get('scale') or {}).get('status')
    return s,f
if __name__=='__main__':
    d=sys.argv[1]; refdirs=sys.argv[2:]; rows=[]
    for h in sorted(os.listdir(d)):
        p=os.path.join(d,h)
        if not os.path.isdir(p): continue
        ref=None
        for rd in refdirs:
            if os.path.exists(os.path.join(rd,h+'.json')): ref=json.load(open(os.path.join(rd,h+'.json'))); break
        s,_=score(p,ref or {}); s['ref']=bool(ref); rows.append(s)
    print(json.dumps(rows,indent=0,ensure_ascii=False))
