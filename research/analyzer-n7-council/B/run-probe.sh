#!/bin/bash
# research only: run metric-probe.ts on the 8 sealed corpus houses; outputs OUTSIDE the repo ($1)
OUT=$1; mkdir -p $OUT; cd /home/user/BuildApp
for h in a01 gozd marcowki ciesz rary trytomach arganiach sasankach3; do
 case $h in a01) C=/home/user/work005k/gapset/cache;; gozd) C=/home/user/work005i-a/blind8/cache;; marcowki|rary) C=/home/user/work005r/corpus/v0/cache;; ciesz) C=/home/user/work005l/blind/cache;; *) C=/home/user/work005yn3/analogs/cache;; esac
 case $h in trytomach|arganiach|sasankach3) R=/home/user/work005yn6/prod-r4/an/$h;; *) R=/home/user/work005yn6/prod-r4/p/$h;; esac
 ( npx vite-node research/analyzer-n7-council/B/metric-probe.ts -- --run $R --package $R/source-package.json --cache $C > $OUT/$h.json 2>$OUT/$h.err ) &
done
wait
