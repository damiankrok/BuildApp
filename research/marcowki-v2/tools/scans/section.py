"""Section forensic: datum rows, roof lines, garage roof, stair steps."""
from PIL import Image
import os; S=os.environ.get('MARCOWKI_IMG_DIR', 'scratchpad/src-images') + '/../'
im=Image.open(S+'src-images/1138x854-przekroj-budynku-projekt-dom-w-marcowkach-ge-2bdfa17711fbe9d.png').convert('L'); w,h=im.size; px=im.load()
def ink(x,y,t=100): return px[x,y]<t
def runs(vals):
    out=[]; s=None
    for i,v in enumerate(vals):
        if v and s is None: s=i
        if not v and s is not None: out.append((s,i-1)); s=None
    if s is not None: out.append((s,len(vals)-1))
    return out
# 1. thick black runs per column at a few x: find the main body walls, slabs, roof
for x in (140,150,300,420,520,600,680,700,850,980,1000):
    r=[(a,b) for a,b in runs([ink(x,y) for y in range(h)]) if b-a>=6]
    print('col',x,r)
print()
for y in (100,200,250,300,330,400,435,450,500,560,600,640,660,700):
    r=[(a,b) for a,b in runs([ink(x,y) for x in range(w)]) if b-a>=6]
    print('row',y,r)
# thin long horizontals (datum lines / level rules): rows where a thin (<=2px) run >= 150px exists
print('\nlong thin horizontal lines:')
prev=None
for y in range(h):
    rr=[(a,b) for a,b in runs([ink(x,y,140) for x in range(w)]) if b-a>=120]
    if rr and (prev is None or y-prev>1): print('  y',y,rr[:4])
    if rr: prev=y
