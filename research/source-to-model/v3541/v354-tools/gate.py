#!/usr/bin/env python3
"""gate.py <run dir>: today's AI follow-up gate (analyse-link.ts drawingsWeaknesses), replicated on a saved result summary."""
import json,os,sys
def weaknesses(r):
    pv=r.get('preview') or {}; codes={p.get('code') for p in pv.get('provisional',[])}
    warned={w.get('code') for w in r.get('warningDetails',[])}
    out=[]
    if 'SCALE_NOT_VERIFIED' in codes and 'HEIGHT_ASSUMED_FOR_PREVIEW' in codes: out.append('NO_METRIC_ANCHOR')
    if pv.get('outcome')=='PARTIAL_3D_PREVIEW': out.append('PARTIAL_MODEL')
    if 'BODY_MISSING_FROM_MODEL' in warned or 'LAYOUT_BLOCKING_UNRESOLVED' in warned: out.append('BODY_MISSING')
    b=pv.get('built') or {}
    if b.get('walls',0)>0 and b.get('roofs',0)==0 and b.get('roofPlanes',0)==0: out.append('NO_ROOF_BUILT')
    return out
if __name__=='__main__':
    d=sys.argv[1]
    if os.path.exists(d+'/failure.json'): print('REFUSAL -> reader asked if RECONSTRUCTION_FAILED/NO_DRAWINGS/SOURCE_INCOMPLETE:', json.load(open(d+'/failure.json')).get('code'))
    else: r=json.load(open(d+'/result-summary.json')); w=weaknesses(r); print('MODEL weak=',w,'-> reader asked' if w else '-> reader NOT asked')
