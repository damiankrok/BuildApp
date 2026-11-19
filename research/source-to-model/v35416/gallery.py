#!/usr/bin/env python3
"""v3.54.16 §7 — gallery.html for the delivery: offline (relative paths, no script, no network), per house the source,
the sketch with its verdict and why, and the boards. /usr/bin/python3 -I gallery.py <delivery dir>"""
import html, json, os, sys
d = sys.argv[1]
idx = json.load(open(os.path.join(d, 'sketches', 'index.json')))['houses']
COL = {'ACCEPTED': '#1e823c', 'PARTIAL': '#c88200', 'REJECTED': '#be1e1e', 'UNCHECKED': '#6e6e6e', 'MISSING_SOURCE': '#6e6e6e', 'FAILED': '#be1e1e'}
h = ['<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BuildPlan v3.54.16 — szkice</title>',
     '<style>body{font:14px system-ui,sans-serif;margin:16px;background:#fff;color:#222}h2{margin-top:32px}.g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}figure{margin:0;border:1px solid #ddd;padding:6px}img{width:100%;height:auto;display:block}.v{color:#fff;padding:2px 6px;font-weight:600;display:inline-block;margin:4px 0}figcaption{font-size:12px}small{color:#555}.b img{max-width:100%}@media(max-width:700px){.g{grid-template-columns:repeat(2,minmax(0,1fr))}}</style></head><body>',
     '<h1>BuildPlan v3.54.16 — cztery szkice każdego ocenianego domu</h1><p>Szkic: kontury z odpowiedzi API narysowane lokalnie (PNG/SVG), werdykt per właściwość. Pod szkicami: decyzje wspólnego wykonawcy korekt (przyjęte COMMITTED, odrzucone przez źródło, wymagające dowodu) i stan jakości dostarczonej rewizji. ACCEPTED — forma i wykończenie przyjęte; PARTIAL — tylko wykończenie (forma odrzucona, powód podany); REJECTED — odrzucony; UNCHECKED — brak modelu, z którym można sprawdzić proporcje; MISSING_SOURCE — źródło nie ma tej elewacji.</p>']
for house, rows in idx.items():
    h.append(f'<h2>{html.escape(house)}</h2><div class="g">')
    for r in rows:
        s = r['side']; src = next((f'sources/{house}/{s}{e}' for e in ('.jpg', '.png') if os.path.exists(os.path.join(d, 'sources', house, s + e))), None)
        sk = f'sketches/{house}/{s}.png' if os.path.exists(os.path.join(d, 'sketches', house, s + '.png')) else None
        h.append(f'<figure><figcaption><b>{s}</b></figcaption>')
        if src: h.append(f'<img src="{src}" alt="{house} {s} — źródło">')
        if sk: h.append(f'<img src="{sk}" alt="{house} {s} — szkic">')
        h.append(f'<span class="v" style="background:{COL.get(r["verdict"], "#6e6e6e")}">{r["verdict"]}</span><br><small>{html.escape((r.get("why") or "")[:400])}</small>')
        if sk: h.append(f'<br><small><a href="sketches/{house}/{s}.svg">SVG</a> · <a href="sketches/{house}/{s}.json">JSON</a> · <a href="sketches/{house}/raw/{s}.json">raw</a> · <a href="sketches/{house}/rejected/{s}.json">rejected</a></small>')
        h.append('</figure>')
    h.append('</div>')
    dec = os.path.join(d, 'decisions', f'{house}.json')
    if os.path.exists(dec):
        D = json.load(open(dec))
        q = D.get('quality') or {}
        h.append(f'<p><b>Jakość dostarczonej rewizji:</b> {html.escape(str(q.get("state", "—")))} <small>{html.escape(str(q.get("why", ""))[:500])}</small></p>')
        h.append('<table style="border-collapse:collapse;font-size:12px"><tr><th align="left">poprawka</th><th align="left">operacja</th><th align="left">cel</th><th align="left">decyzja</th><th align="left">powód / pomiar</th></tr>')
        for r in D.get('decisions', []):
            col = '#1e823c' if r['status'] == 'COMMITTED' else '#be1e1e' if r['status'] in ('REJECTED_BY_SOURCE', 'ROLLED_BACK', 'GROUP_ROLLED_BACK', 'INVALID') else '#c88200'
            h.append(f'<tr style="border-top:1px solid #ddd"><td>{html.escape(r["proposalId"][-40:])}</td><td>{html.escape(r["operation"])}</td><td>{html.escape(r["targetId"])}</td><td style="color:{col};font-weight:600">{html.escape(r["status"])}</td><td>{html.escape((r.get("why") or "")[:220])}</td></tr>')
        h.append('</table>')
    h.append('<div class="b">')
    for kind in ('sides', 'perspective', 'storeys', 'overlay'):
        p = f'boards/{house}/{house}-{kind}.png'
        if os.path.exists(os.path.join(d, p)): h.append(f'<p><b>{kind}</b><br><a href="{p}"><img src="{p}" alt="{house} {kind}"></a></p>')
    h.append('</div>')
h.append('</body></html>')
open(os.path.join(d, 'gallery.html'), 'w').write('\n'.join(h))
print('gallery', os.path.join(d, 'gallery.html'))
