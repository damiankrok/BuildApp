"""Forensic measurement of the two dimensioned 853px plans. Pixel -> metres through the printed chains, then row/column scans."""
import json, sys
from PIL import Image, ImageDraw
import os; S=os.environ.get('MARCOWKI_IMG_DIR', 'scratchpad/src-images') + '/../'
G=S+'src-images/853x853-projekt-dom-w-marcowkach-ge-7af59bb86c46a8a68634e3630da6cd81.png'
A=S+'src-images/853x853-projekt-dom-w-marcowkach-ge-9d1547b712997f93462fc19e9eefb963.png'
def load(p):
    im=Image.open(p).convert('RGB'); w,h=im.size; px=im.load()
    return im,w,h,px
def luma(c): return 0.299*c[0]+0.587*c[1]+0.114*c[2]
def ink(px,x,y,t=90): return luma(px[x,y])<t
def runs1d(vals):
    out=[]; s=None
    for i,v in enumerate(vals):
        if v and s is None: s=i
        if not v and s is not None: out.append((s,i-1)); s=None
    if s is not None: out.append((s,len(vals)-1))
    return out
def row_runs(px,w,y,t=90): return runs1d([ink(px,x,y,t) for x in range(w)])
def col_runs(px,h,x,t=90): return runs1d([ink(px,x,y,t) for y in range(h)])

out={}
for name,path in (('ground',G),('attic',A)):
    im,w,h,px=load(path)
    # thick vertical bands: columns where a dark run >= 8px thick exists across many rows -> wall candidates
    # find outer wall faces: scan a row through the middle of the main body
    print('=====',name,im.size)
    # long horizontal black runs per row (>= 60 px) = wall bands along X
    hb=[]
    for y in range(h):
        for a,b in row_runs(px,w,y):
            if b-a>=60: hb.append((y,a,b))
    vb=[]
    for x in range(w):
        for a,b in col_runs(px,h,x):
            if b-a>=60: vb.append((x,a,b))
    # group consecutive rows with similar extents into bands
    def group(items):
        bands=[]
        for k,a,b in items:
            if bands and k-bands[-1]['k1']<=1 and abs(a-bands[-1]['a'])<12 and abs(b-bands[-1]['b'])<12:
                bd=bands[-1]; bd['k1']=k; bd['a']=min(bd['a'],a); bd['b']=max(bd['b'],b)
            else: bands.append({'k0':k,'k1':k,'a':a,'b':b})
        return [bd for bd in bands if bd['k1']-bd['k0']>=6]
    HB=group(hb); VB=group(vb)
    print('horizontal wall bands (y0,y1 | x0..x1):'); [print('  ',bd['k0'],bd['k1'],'|',bd['a'],bd['b']) for bd in HB]
    print('vertical wall bands (x0,x1 | y0..y1):'); [print('  ',bd['k0'],bd['k1'],'|',bd['a'],bd['b']) for bd in VB]
    out[name]={'size':[w,h],'hbands':HB,'vbands':VB}
json.dump(out,open(S+'audit/plan-bands.json','w'),indent=1)
