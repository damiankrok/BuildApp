"""Plan forensic v2: metric frames from the printed chains, outer-wall gap scans (openings), return stubs in the zones,
internal wall histogram peaks, and the stair region line ladder. Everything in the APP frame:
x = metres east of the west outer face; z = metres north of the FRONT outer face (front recess mouth at z=-1, rear mouth at 13.60)."""
from PIL import Image
import os; S=os.environ.get('MARCOWKI_IMG_DIR', 'scratchpad/src-images') + '/../'
G=S+'src-images/853x853-projekt-dom-w-marcowkach-ge-7af59bb86c46a8a68634e3630da6cd81.png'
A=S+'src-images/853x853-projekt-dom-w-marcowkach-ge-9d1547b712997f93462fc19e9eefb963.png'
def load(p):
    im=Image.open(p).convert('L'); return im, im.load(), im.size
def runs(vals):
    out=[]; s=None
    for i,v in enumerate(vals):
        if v and s is None: s=i
        if not v and s is not None: out.append((s,i-1)); s=None
    if s is not None: out.append((s,len(vals)-1))
    return out
# ---- frames: verify the chain-derived faces by locating the outer black bands
for name,path,front_y,rear_y,x0,x1 in (('GROUND',G,735,259,58,514),('ATTIC',A,671,195,58,360)):
    im,px,(w,h)=load(path)
    dark=lambda x,y,t=90: px[x,y]<t
    print('=====',name)
    # locate outer faces precisely: scan a column through the main body at x=100 for black runs, and a row at y midway
    col=[(a,b) for a,b in runs([dark(100,y) for y in range(h)]) if b-a>=8]
    row=[(a,b) for a,b in runs([dark(x,(front_y+rear_y)//2+40) for x in range(w)]) if b-a>=8]
    print(' col x=100 thick runs',col); print(' row mid thick runs',row)
    sx=(x1-x0)/(12.05 if name=='GROUND' else 7.90); sz=(front_y-rear_y)/12.60
    print(f' px/m x={sx:.3f} z={sz:.3f}')
    X=lambda p:(p-x0)/sx; Z=lambda p:(front_y-p)/sz
    PX=lambda m:x0+m*sx; PY=lambda m:front_y-m*sz
    # ---- zones: row scans at z = -0.25,-0.5,-0.75 and 12.85,13.1,13.35 -> black runs >=6px in metres
    print(' zone row scans (black runs >= 6px, in x metres):')
    for zm in (-0.2,-0.45,-0.7,-0.95, 12.8,13.05,13.3,13.55):
        y=int(round(PY(zm)))
        if y<0 or y>=h: continue
        rr=[(round(X(a),2),round(X(b),2)) for a,b in runs([dark(x,y) for x in range(w)]) if b-a>=6]
        print(f'   z={zm:6.2f} y={y}: {rr}')
    # ---- outer wall gap scans: along each outer wall band centreline, where is it NOT black (openings)
    def gaps_along_row(y, xa, xb):
        vals=[not dark(x,y,110) for x in range(xa,xb)]
        return [(round(X(xa+a),2),round(X(xa+b),2),round((b-a)/sx,2)) for a,b in runs(vals) if b-a>=4]
    def gaps_along_col(x, ya, yb):
        vals=[not dark(x,y,110) for y in range(ya,yb)]
        return [(round(Z(ya+b),2),round(Z(ya+a),2),round((b-a)/sz,2)) for a,b in runs(vals) if b-a>=4]
    t=int(round(0.45*sx))
    if name=='GROUND':
        print(' FRONT wall (main, z 0..0.45) gaps:', gaps_along_row(int(PY(0.22)), int(PX(0)), int(PX(7.9))))
        print(' FRONT wall (garage) gaps:', gaps_along_row(int(PY(0.22)), int(PX(7.9)), int(PX(12.05))))
        print(' REAR wall gaps:', gaps_along_row(int(PY(12.38)), int(PX(0)), int(PX(7.9))))
        print(' WEST wall gaps:', gaps_along_col(int(PX(0.22)), int(PY(12.6)), int(PY(0))))
        print(' EAST main wall gaps (z 7.5..12.6 exterior):', gaps_along_col(int(PX(7.68)), int(PY(12.6)), int(PY(7.5))))
        print(' EAST main wall gaps (z 0..7.5 shared):', gaps_along_col(int(PX(7.68)), int(PY(7.5)), int(PY(0))))
        print(' GARAGE east wall gaps:', gaps_along_col(int(PX(11.83)), int(PY(7.5)), int(PY(0))))
        print(' GARAGE rear wall gaps (z 7.5):', gaps_along_row(int(PY(7.28)), int(PX(7.9)), int(PX(12.05))))
    else:
        print(' FRONT wall gaps:', gaps_along_row(int(PY(0.22)), int(PX(0)), int(PX(7.9))))
        print(' REAR wall gaps:', gaps_along_row(int(PY(12.38)), int(PX(0)), int(PX(7.9))))
        print(' WEST wall gaps:', gaps_along_col(int(PX(0.22)), int(PY(12.6)), int(PY(0))))
        print(' EAST wall gaps:', gaps_along_col(int(PX(7.68)), int(PY(12.6)), int(PY(0))))
    # ---- interior: column histogram of black within the interior, peaks = vertical walls
    ya,yb=int(PY(12.15)),int(PY(0.45)); xa,xb=int(PX(0.45)),int(PX(7.45))
    colh=[sum(1 for y in range(ya,yb) if dark(x,y)) for x in range(xa,xb)]
    rowh=[sum(1 for x in range(xa,xb) if dark(x,y)) for y in range(ya,yb)]
    def peaks(hist,off,conv,minv):
        out=[]
        for a,b in runs([v>=minv for v in hist]):
            if b-a>=2: out.append((round(conv(off+a),2),round(conv(off+b),2),max(hist[a:b+1])))
        return out
    print(' vertical wall candidates (x0,x1,max black px):', peaks(colh,xa,X,60))
    print(' horizontal wall candidates (z hi, z lo, max):', peaks(rowh,ya,Z,60))
    # ---- for each vertical wall candidate, its z-extent (black runs >=20px in its centre column)
    for a,b,_ in peaks(colh,xa,X,60):
        xc=int(PX((a+b)/2))
        ext=[(round(Z(q),2),round(Z(p),2)) for p,q in runs([dark(xc,y) for y in range(ya,yb)]) if q-p>=15]
        ext=[(round(Z(ya+q),2),round(Z(ya+p),2)) for p,q in runs([dark(xc,y) for y in range(ya,yb)]) if q-p>=15]
        print(f'   vwall x~{(a+b)/2:.2f}: z-extents {ext}')
    for a,b,_ in peaks(rowh,ya,Z,60):
        yc=int(PY((a+b)/2))
        ext=[(round(X(xa+p),2),round(X(xa+q),2)) for p,q in runs([dark(x,yc) for x in range(xa,xb)]) if q-p>=15]
        print(f'   hwall z~{(a+b)/2:.2f}: x-extents {ext}')
    # ---- stair region: thin lines. region x 4.8..7.5, z 3.0..8.6
    print(' stair region thin lines:')
    sxa,sxb=int(PX(4.8)),int(PX(7.45)); sya,syb=int(PY(8.6)),int(PY(3.0))
    hl=[]
    for y in range(sya,syb):
        for a,b in runs([dark(x,y,120) for x in range(sxa,sxb)]):
            if 12<=b-a<=60:
                # thin: the rows above and below at the midpoint are not dark (line thickness <=3)
                xm=(a+b)//2
                if not dark(xm,y-2,120) and not dark(xm,y+2,120): hl.append((y,a+sxa,b+sxa))
    # merge consecutive rows
    merged=[]
    for y,a,b in hl:
        if merged and y-merged[-1][1]<=1 and abs(a-merged[-1][2])<6 and abs(b-merged[-1][3])<6: merged[-1][1]=y
        else: merged.append([y,y,a,b])
    for y0,y1,a,b in merged: print(f'   H line z={Z((y0+y1)/2):.3f} x {X(a):.2f}..{X(b):.2f} (len {(b-a)/sx:.2f} m)')
    vl=[]
    for x in range(sxa,sxb):
        for a,b in runs([dark(x,y,120) for y in range(sya,syb)]):
            if 12<=b-a<=60:
                ym=(a+b)//2
                if not dark(x-2,ym,120) and not dark(x+2,ym,120): vl.append((x,a+sya,b+sya))
    mergedv=[]
    for x,a,b in vl:
        if mergedv and x-mergedv[-1][1]<=1 and abs(a-mergedv[-1][2])<6 and abs(b-mergedv[-1][3])<6: mergedv[-1][1]=x
        else: mergedv.append([x,x,a,b])
    for x0_,x1_,a,b in mergedv: print(f'   V line x={X((x0_+x1_)/2):.3f} z {Z(b):.2f}..{Z(a):.2f} (len {(b-a)/sz:.2f} m)')
    # ---- rooflights / chimney: dashed rectangles and solid black squares in attic
    if name=='ATTIC':
        # solid black blobs inside the interior that are not walls: squares >= 10px both ways
        print(' solid black squares (chimney) inside main body:')
        for y in range(ya,yb,2):
            for a,b in runs([dark(x,y,80) for x in range(xa,xb)]):
                if 12<=b-a<=40:
                    # check vertical extent at centre
                    xc=(a+b)//2+xa
                    va=[(p,q) for p,q in runs([dark(xc,yy,80) for yy in range(ya,yb)]) if p<=y-ya<=q]
                    if va and 12<=va[0][1]-va[0][0]<=40 and y-ya==va[0][0]:
                        print(f'   square x {X(a+xa):.2f}..{X(b+xa):.2f} z {Z(ya+va[0][1]):.2f}..{Z(ya+va[0][0]):.2f}')
