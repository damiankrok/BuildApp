"""Elevation forensic: classify pixels into material classes and scan rows/columns."""
from PIL import Image
import os; S=os.environ.get('MARCOWKI_IMG_DIR', 'scratchpad/src-images') + '/'
FILES={'front':'1280x597-projekt-dom-w-marcowkach-ge-8a360613d4ba290cafcca0fbf7e8362c.png','rear':'1280x598-projekt-dom-w-marcowkach-ge-6ac4e6285d1a0b8cffcfc89f76bc4795.png','east':'1280x597-projekt-dom-w-marcowkach-ge-24f222ed091cf3f3e1813919bc611b95.png','west':'1280x598-projekt-dom-w-marcowkach-ge-8f98908ca2aeb8a51295fabdb1b26fb7.png'}
def cls(c):
    r,g,b=c; L=(r+g+b)/3; mx=max(c); mn=min(c); sat=(mx-mn)/max(1,mx)
    if L>200 and sat<0.12: return 'W'   # white render
    if L<75 and sat<0.25: return 'D'    # dark anthracite
    if 75<=L<150 and sat<0.2 and b>=r-5: return 'G'  # grey roof tile / concrete
    if r>g+15 and g>b+5 and L>90: return 'T'  # timber
    if b>r+15 and L>90: return 'S'    # sky/glass blue
    if g>r+10 and g>b+10: return 'V'  # vegetation
    return '?'
def runs(vals):
    out=[]; s=None; cur=None
    for i,v in enumerate(vals):
        if v!=cur:
            if cur is not None: out.append((cur,s,i-1))
            cur=v; s=i
    out.append((cur,s,len(vals)-1)); return out
def compress(rr,minlen=4):
    return [(c,a,b) for c,a,b in rr if b-a+1>=minlen and c!='?']
for name,f in FILES.items():
    im=Image.open(S+f).convert('RGB'); w,h=im.size; px=im.load()
    print('=====',name,im.size)
    for y in (110,150,200,250,300,330,360,390,400,420,450,480,500,520,540,560,575):
        rr=compress(runs([cls(px[x,y]) for x in range(w)]),6)
        print(' row',y,' '.join(f'{c}{a}-{b}' for c,a,b in rr))
    print(' columns:')
    for x in (230,300,380,420,470,520,560,600,640,700,740,800,860,900,950,1000,1050,1070):
        rr=compress(runs([cls(px[x,y]) for y in range(h)]),4)
        print(' col',x,' '.join(f'{c}{a}-{b}' for c,a,b in rr))
