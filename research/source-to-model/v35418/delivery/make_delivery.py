#!/usr/bin/env python3
"""v3.54.18 — the private delivery of the trial: per house the publisher's originals, every sketch (PNG / SVG / JSON),
the four side slots with the verdict of use, real renders of every variant (baseline | after | delivered) from the same
renderer, the comparison board, and one offline gallery with relative links. Nothing here goes into Git.

  make_delivery.py <manifest.json> <out dir>
manifest.json: { "commit": ..., "houses": [ { "house", "title", "publisher", "set", "url", "package": <package.json>,
     "cache": <byte cache dir>, "sketchRun": <run dir>, "variants": [ { "key", "label", "kind", "run": <run dir>, "commit" } ] } ] }
A variant's run dir holds model.json (absent: NO_MODEL), result.json, corrections.json, quality.json, facades.json.
"""
import json, os, shutil, subprocess, sys, hashlib, html
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '../../../..'))
man = json.load(open(sys.argv[1]))
out = os.path.abspath(sys.argv[2])
os.makedirs(out, exist_ok=True)
PY = ['/usr/bin/python3', '-I']
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
PL = {'FRONT': 'front', 'RIGHT': 'prawa', 'REAR': 'tył', 'LEFT': 'lewa'}

def jload(p, d=None):
    try: return json.load(open(p))
    except Exception: return d

cards = []
for h in man['houses']:
    name = h['house']
    hd = os.path.join(out, 'houses', name)
    src = os.path.join(hd, 'sources')
    os.makedirs(hd, exist_ok=True)
    subprocess.run(PY + [os.path.join(here, 'export_sources.py'), h['package'], h['cache'], src], check=True, capture_output=True)
    # sketches: every frame the sketch run read, by frame
    sk_out = os.path.join(hd, 'sketches')
    os.makedirs(sk_out, exist_ok=True)
    by_frame = os.path.join(h['sketchRun'], 'sketches', 'by-frame')
    if os.path.isdir(by_frame):
        for f in sorted(os.listdir(by_frame)): shutil.copy2(os.path.join(by_frame, f), os.path.join(sk_out, f))
    raw = os.path.join(h['sketchRun'], 'sketches', 'raw')
    if os.path.isdir(raw): shutil.copytree(raw, os.path.join(sk_out, 'raw-answers'), dirs_exist_ok=True)
    facades = (jload(os.path.join(h['sketchRun'], 'facades.json'), {}) or {}).get('facades', [])
    # renders of every variant
    variants = []
    for v in h['variants']:
        rd = os.path.join(hd, 'runs', v['key'])
        os.makedirs(rd, exist_ok=True)
        for f in ('model.json', 'scene.json', 'result.json', 'corrections.json', 'quality.json', 'facades.json', 'events.json', 'metric-read.json', 'body-arbitration.json', 'sketches.json', 'local-model.json', 'turns.json', 'sketch-turns.json', 'check-turns.json', 'outline-turns.json', 'fact-trace.json'):
            p = os.path.join(v['run'], f)
            if os.path.exists(p): shutil.copy2(p, os.path.join(rd, f))
        ex = os.path.join(v['run'], 'exchanges')
        if os.path.isdir(ex): shutil.copytree(ex, os.path.join(rd, 'exchanges'), dirs_exist_ok=True)
        ren = os.path.join(hd, 'renders')
        subprocess.run(['npx', 'vite-node', 'research/source-to-model/v35418/render.ts', '--', '--model', os.path.join(v['run'], 'model.json'), '--out', ren, '--name', v['key'], '--tile', '900'], cwd=root, check=True, capture_output=True)
        res = jload(os.path.join(v['run'], 'result.json'), {}) or {}
        q = (jload(os.path.join(v['run'], 'quality.json'), {}) or {}).get('quality') or {}
        info = jload(os.path.join(ren, f"{v['key']}.json"), {}) or {}
        model_file = os.path.join(v['run'], 'model.json')
        rev = hashlib.sha256(open(model_file, 'rb').read()).hexdigest()[:12] if os.path.exists(model_file) else None
        variants.append({**v, 'render': ren, 'name': v['key'], 'modelFileSha256_12': rev, 'usd': res.get('usd'), 'seconds': res.get('seconds'), 'final': res.get('final'), 'quality': q.get('state'), 'qualityWhy': (q.get('why') or '')[:400], 'counts': info.get('counts'), 'noModel': not os.path.exists(model_file)})
    spec = {'house': name, 'title': h['title'], 'publisher': h['publisher'], 'set': h['set'], 'url': h['url'], 'sources': src, 'sketchRun': h['sketchRun'], 'variants': [{k: v[k] for k in ('key', 'label', 'kind', 'render', 'name')} | {'commit': v.get('commit'), 'revision': v.get('modelFileSha256_12')} for v in variants]}
    json.dump(spec, open(os.path.join(hd, 'board-spec.json'), 'w'), indent=1, ensure_ascii=False)
    subprocess.run(PY + [os.path.join(here, 'boards.py'), os.path.join(hd, 'board-spec.json'), out], check=True)
    # the four side slots
    src_index = jload(os.path.join(src, 'index.json'), [])
    elevations = [i for i in src_index if i.get('roles', {}).get('document') == 'ELEVATION' and 'file' in i]
    slots = []
    for s in SIDES:
        f = next((x for x in facades if x.get('side') == s), None)
        if f:
            tail = f['frameId'][-10:]
            slots.append({'side': s, 'status': 'ZE ŹRÓDŁA', 'frame': tail, 'label': f['label'], 'sideBasis': f.get('sideBasis'), 'original': f"tiles/{name}/source-{tail}.png", 'sketchPng': f"houses/{name}/sketches/{tail}.png", 'sketchSvg': f"houses/{name}/sketches/{tail}.svg", 'json': f"houses/{name}/sketches/{tail}.json", 'verdict': f.get('verdict'), 'use': {k: f.get(k) for k in ('openings', 'roofWindows', 'chimneys', 'finishes', 'roof', 'adoption')}, 'skipped': f.get('skipped', [])})
        else:
            slots.append({'side': s, 'status': 'BRAK ŹRÓDŁA TEJ STRONY (żadna elewacja źródła nie została przypisana do tej strony modelu)', 'original': None, 'sketchPng': None, 'sketchSvg': None, 'json': None, 'verdict': 'BRAK'})
    unassigned = [{'frame': x['frameId'][-10:], 'label': x['label'], 'verdict': x.get('verdict'), 'read': x.get('read'), 'sketchPng': f"houses/{name}/sketches/{x['frameId'][-10:]}.png"} for x in facades if not x.get('side')]
    json.dump({'house': name, 'slots': slots, 'unassignedElevations': unassigned, 'sourceElevations': len(elevations)}, open(os.path.join(hd, 'slots.json'), 'w'), indent=1, ensure_ascii=False)
    cards.append({'h': h, 'variants': variants, 'slots': slots, 'unassigned': unassigned})

# ---- the gallery ------------------------------------------------------------------------------------------------------
E = html.escape
def a(href, text): return f'<a href="{E(href)}">{E(text)}</a>' if href else '<span class="none">brak</span>'
def img(href, alt, cls='thumb'): return f'<a href="{E(href)}"><img class="{cls}" src="{E(href)}" alt="{E(alt)}" loading="lazy"></a>' if href and os.path.exists(os.path.join(out, href)) else '<div class="none box">brak</div>'
css = """body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f4f3f0;color:#1d1d1b}header{background:#22313f;color:#fff;padding:18px 24px}
main{padding:16px 24px;max-width:1500px;margin:auto}h2{margin:28px 0 6px}section.house{background:#fff;border:1px solid #d9d6cf;border-radius:8px;padding:14px 18px;margin:18px 0}
table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #d9d6cf;padding:6px 8px;vertical-align:top;font-size:14px;text-align:left}th{background:#efede8}
img.thumb{max-width:230px;max-height:170px;border:1px solid #ccc;background:#fff}img.board{max-width:100%;border:1px solid #ccc}.none{color:#8a2be2;font-style:italic}.box{width:200px;height:60px;display:flex;align-items:center;justify-content:center;background:#eee;border:1px dashed #aaa}
.tag{display:inline-block;padding:1px 7px;border-radius:10px;font-size:12px;font-weight:600;margin-right:4px}.LIVE{background:#d6f0d6}.REPLAY{background:#dde7f7}.KONTROLA{background:#ffe7b8}.HOST{background:#e8d6f5}
.legend td{font-size:13px}small{color:#555}"""
doc = [f'<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>BuildPlan v3.54.18 — galeria próby</title><style>{css}</style></head><body>',
       f'<header><h1>BuildPlan v3.54.18 — galeria próby (prywatna, offline)</h1><div>commit kodu końcowego: <code>{E(man.get("commit","?"))}</code> · wszystkie obrazy modeli to rzeczywiste rendery tego samego renderera (neutral-flat/1): te same kamery, paleta i światło</div></header><main>',
       '<table class="legend"><tr><th>Znacznik</th><th>Znaczenie</th></tr>'
       '<tr><td><span class="tag LIVE">LIVE</span></td><td>świeże żądania do Claude API w tym biegu (zaksięgowane)</td></tr>'
       '<tr><td><span class="tag REPLAY">REPLAY</span></td><td>te same nagrane odpowiedzi API co w biegu wskazanym w opisie, kod inny — 0 USD; porównuje algorytm, nie odczyt</td></tr>'
       '<tr><td><span class="tag HOST">HOST</span></td><td>publiczny host aplikacji (apps/analyzer-api), konfiguracja jak w produkcie</td></tr>'
       '<tr><td><span class="tag KONTROLA">KONTROLA</span></td><td>jawnie kontrolowana próba (np. wstrzymany model LOCAL albo wstrzyknięte uszkodzenie) — nigdy wynik organiczny</td></tr></table>']
for c in cards:
    h = c['h']; name = h['house']
    doc.append(f'<section class="house" id="{E(name)}"><h2>{E(h["title"])} <small>— {E(h["publisher"])} · zbiór {E(h["set"])}</small></h2><div><small>{E(h["url"])}</small></div>')
    doc.append('<table><tr><th>Wariant</th><th>Bieg</th><th>Commit</th><th>Rewizja modelu (sha256/12 pliku)</th><th>Stan jakości z biegu</th><th>USD</th><th>s</th><th>Model / scena</th></tr>')
    for v in c['variants']:
        doc.append(f'<tr><td>{E(v["label"])}</td><td><span class="tag {E(v["kind"])}">{E(v["kind"])}</span></td><td><code>{E(str(v.get("commit") or "—"))}</code></td><td><code>{E(str(v.get("modelFileSha256_12") or "NO_MODEL"))}</code></td><td>{E(str(v.get("quality") or "—"))}</td><td>{E(str(v.get("usd")))}</td><td>{E(str(v.get("seconds")))}</td><td>{a(f"houses/{name}/runs/{v["key"]}/model.json", "model.json") if not v["noModel"] else "<span class=none>NO_MODEL</span>"} · {a(f"houses/{name}/runs/{v["key"]}/facades.json", "facades.json")} · {a(f"houses/{name}/runs/{v["key"]}/corrections.json", "corrections.json")}</td></tr>')
    doc.append('</table>')
    doc.append(f'<h3>Plansza: źródło | szkic | warianty (te same kamery)</h3>{img(f"boards/{name}-board.png", "plansza", "board")}')
    doc.append('<h3>Cztery strony: oryginał · szkic PNG/SVG · semantyczny JSON · werdykt wykorzystania</h3><table><tr><th>Strona modelu</th><th>Oryginał</th><th>Szkic</th><th>Pliki</th><th>Werdykt wykorzystania</th>' + ''.join(f'<th>{E(v["label"])}</th>' for v in c['variants']) + '</tr>')
    for s in c['slots']:
        use = s.get('use') or {}
        o = use.get('openings') or {}
        verdict = E(str(s.get('verdict'))) + (f'<br><small>podstawa strony: {E(str(s.get("sideBasis")))}<br>otwory: zweryfikowane źródłem {o.get("verified",0)}, przyjęte z elewacją (niezweryfikowane) {o.get("adopted",0)}, odrzucone źródłem {o.get("refusedBySource",0)}, nierozstrzygnięte {o.get("undecided",0)}, zgodne z modelem {o.get("agreedWithModel",0)}<br>okna połaciowe {((use.get("roofWindows") or {}).get("built",0))}, kominy {((use.get("chimneys") or {}).get("built",0))}, strefy wykończenia {((use.get("finishes") or {}).get("zonesApplied",0))}' + (f'<br>przyjęcie elewacji: {E(str((use.get("adoption") or {}).get("decision")))}' if use.get('adoption') else '') + '</small>' if s.get('frame') else f'<br><small>{E(s["status"])}</small>')
        doc.append(f'<tr><td><b>{PL[s["side"]]}</b><br><small>{E(str(s.get("label") or ""))}</small></td><td>{img(s.get("original"), "oryginał")}</td><td>{img(s.get("sketchPng"), "szkic")}</td><td>{a(s.get("sketchPng"), "PNG")} · {a(s.get("sketchSvg"), "SVG")} · {a(s.get("json"), "JSON")}</td><td>{verdict}</td>' + ''.join(f'<td>{img(f"tiles/{name}/{v["key"]}-{s["side"]}.png", v["label"])}</td>' for v in c['variants']) + '</tr>')
    doc.append('</table>')
    if c['unassigned']:
        doc.append('<p><b>Elewacje źródła nieprzypisane do żadnej strony:</b> ' + '; '.join(f'{E(u["label"])} ({E(u["frame"])}): {E(str(u["verdict"]))} — {a(u["sketchPng"], "szkic")}' for u in c['unassigned']) + '</p>')
    doc.append('<h3>Perspektywy i rzut bez dachu</h3><table><tr>' + ''.join(f'<th>{E(v["label"])}</th>' for v in c['variants']) + '</tr>')
    for t in ('AXO-front-right', 'AXO-front-left', 'AXO-rear-left', 'AXO-rear-right', 'TOP', 'STOREY-0'):
        doc.append('<tr>' + ''.join(f'<td>{img(f"tiles/{name}/{v["key"]}-{t}.png", t)}<br><small>{t}</small></td>' for v in c['variants']) + '</tr>')
    doc.append('</table></section>')
doc.append('</main></body></html>')
open(os.path.join(out, 'gallery.html'), 'w').write('\n'.join(doc))
# link check
import re
links = set(re.findall(r'(?:href|src)="([^"#]+)"', '\n'.join(doc)))
missing = sorted(l for l in links if not l.startswith('http') and not os.path.exists(os.path.join(out, l)))
json.dump({'links': len(links), 'missing': missing}, open(os.path.join(out, 'gallery-link-check.json'), 'w'), indent=1)
print('gallery:', len(links), 'links,', len(missing), 'missing')
