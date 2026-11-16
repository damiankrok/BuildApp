#!/bin/bash
# make_board.sh <house> <before dir> <after dir> <before label> <after label> [note...]: ŹRÓDŁO | PRZED | PO with shared cameras
H=$1; BD=$(realpath $2); AD=$(realpath $3); BL=$4; AL=$5; shift 5
R=/home/user/rd/v354; O=$R/boards; mkdir -p $O/views
read SRC ELEV ASSET <<< $(/usr/bin/python3 -I - "$R/pics/$H" "$BD" "$AD" <<'PY'
import json,os,sys,glob
p,bd,ad=sys.argv[1:4]
d=json.load(open(p+'/index.json'))
plans=[x for x in d['pictures'] if x.get('doc')=='FLOOR_PLAN']
dim=[x for x in plans if (x.get('roles') or {}).get('annotation')=='DIMENSIONED'] or plans
src=max(dim,key=lambda x:x['origPx'][0]*x['origPx'][1])['file'] if dim else ''
el=[x for x in d['pictures'] if x.get('doc')=='ELEVATION']
fr=[x for x in el if 'front' in (x.get('caption') or '').lower()] or el
elev=fr[0]['file'] if fr else ''
asset=''
for run in (bd,ad):
    pngs=glob.glob(run+'/plan-diagnostics/*-all.png')
    if pngs: asset=os.path.basename(pngs[0])[:-8]; break
print(os.path.join(p,src) if src else '-', os.path.join(p,elev) if elev else '-', asset or 'none')
PY
)
MB=$BD/model.json; [ -f $MB ] || MB=-; MA=$AD/model.json; [ -f $MA ] || MA=-
(cd /home/user/BuildApp && npx vite-node research/source-to-model/s5312/pair-views.ts -- $MB $MA $O/views/$H > /dev/null 2>&1)
ARGS=(--source=$SRC --before $BD --after $AD --asset=$ASSET --title "$H" --out $O/$H-$(echo $AL | tr -cd 'A-Za-z0-9').png --views $O/views/$H --before-label "$BL" --after-label "$AL")
[ "$ELEV" != "-" ] && ARGS+=(--elevation $ELEV)
for n in "$@"; do ARGS+=(--note "$n"); done
/usr/bin/python3 -I /home/user/BuildApp/research/source-to-model/s5312/boards.py "${ARGS[@]}" && echo "board $H ok"
