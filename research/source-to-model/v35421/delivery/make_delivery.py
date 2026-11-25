#!/usr/bin/env python3
"""v3.54.21 (from v3.54.20) — the private delivery. As before, per house: the publisher's originals, every sketch (PNG / SVG /
JSON), the four side slots, real renders of every variant from the same renderer, the comparison board, the interior on
the publisher's plan. New in this stage, per house: the publisher's PERSPECTIVES beside the model's oblique views, the
ROOF FROM ABOVE with every join drawn (valleys, abutments, ridges, hips — `roof_plan.py`) for every variant, the PACKET
the structure read was actually sent (the exact PNG bytes, in order), its raw and agreed answers, and the OMISSION TRACE
(feature → read → agreed → model → cause; `omissions.py`). Nothing here goes into Git.

  make_delivery.py <manifest.json> <out dir>
manifest.json: { "commit": ..., "title": ..., "houses": [ { "house", "title", "publisher", "set", "url", "package": <package.json>,
     "cache": <byte cache dir>, "sketchRun": <run dir>, "variants": [ { "key", "label", "kind", "run": <run dir>, "commit" } ] } ] }
The LAST variant of a house is the delivered one; the first is its baseline.
"""
import json, os, shutil, subprocess, sys, hashlib, html
here = os.path.dirname(os.path.abspath(__file__))
old = os.path.abspath(os.path.join(here, '../../v35418/delivery'))
sys.path.insert(0, here)
import omissions as OM
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
    subprocess.run(PY + [os.path.join(old, 'export_sources.py'), h['package'], h['cache'], src], check=True, capture_output=True)
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
        for f in ('model.json', 'scene.json', 'result.json', 'corrections.json', 'quality.json', 'facades.json', 'events.json', 'metric-read.json', 'body-arbitration.json', 'sketches.json', 'local-model.json', 'turns.json', 'sketch-turns.json', 'check-turns.json', 'outline-turns.json', 'fact-trace.json', 'observation-fates.json', 'massing.json', 'massing-model.json', 'record.json', 'status.json'):
            p = os.path.join(v['run'], f)
            if os.path.exists(p): shutil.copy2(p, os.path.join(rd, f))
        ex = os.path.join(v['run'], 'exchanges')
        # the pictures sent with each request are the sources and renders already in this delivery: kept once, for the
        # final / host variants (the request JSON names each by its hash); the answers are kept for every variant
        if os.path.isdir(ex): shutil.copytree(ex, os.path.join(rd, 'exchanges'), dirs_exist_ok=True, ignore=(None if not v['key'].startswith('baseline') else shutil.ignore_patterns('img')))
        ren = os.path.join(hd, 'renders')
        os.makedirs(ren, exist_ok=True)
        if os.path.exists(os.path.join(v['run'], 'model.json')):
            subprocess.run(['npx', 'vite-node', 'research/source-to-model/v35418/render.ts', '--', '--model', os.path.join(v['run'], 'model.json'), '--out', ren, '--name', v['key'], '--tile', '900'], cwd=root, check=True, capture_output=True)
        # v3.54.21: the roof from above with its joins, and the structure read's packet
        if os.path.exists(os.path.join(v['run'], 'model.json')):
            subprocess.run(PY + [os.path.join(here, 'roof_plan.py'), os.path.join(v['run'], 'model.json'), os.path.join(ren, f"{v['key']}-ROOFPLAN.png"), f"{h['title']} — {v['label']}"], capture_output=True)
        sr = os.path.join(v['run'], 'structure-read')
        if os.path.isdir(sr): shutil.copytree(sr, os.path.join(rd, 'structure-read'), dirs_exist_ok=True)
        for f in ('massing.json', 'massing-rejected.json'):
            if os.path.exists(os.path.join(v['run'], f)): shutil.copy2(os.path.join(v['run'], f), os.path.join(rd, f))
        # v3.54.19: the model's ground-storey walls on the publisher's ground plan, in the frame the run recorded (a baseline
        # that recorded none: its own massing record, else the same LOCAL registration of the final run, else a named fit)
        ov = os.path.join(hd, 'overlay')
        os.makedirs(ov, exist_ok=True)
        other = next((w['run'] for w in h['variants'] if w is not v and os.path.exists(os.path.join(w['run'], 'events.json'))), None)
        subprocess.run(['npx', 'vite-node', 'research/source-to-model/v35419/plan-overlay.ts', '--', '--run', v['run'], '--cache', h['cache'], '--out', ov, '--name', v['key']] + (['--frame-from', other, '--fit-from', other] if other else []), cwd=root, capture_output=True)
        overlay = jload(os.path.join(ov, f"{v['key']}-plan-overlay.json"), {}) or {}
        res = jload(os.path.join(v['run'], 'result.json'), {}) or {}
        q = (jload(os.path.join(v['run'], 'quality.json'), {}) or {}).get('quality') or {}
        info = jload(os.path.join(ren, f"{v['key']}.json"), {}) or {}
        model_file = os.path.join(v['run'], 'model.json')
        rev = hashlib.sha256(open(model_file, 'rb').read()).hexdigest()[:12] if os.path.exists(model_file) else None
        variants.append({**v, 'render': ren, 'name': v['key'], 'modelFileSha256_12': rev, 'usd': res.get('usd'), 'seconds': res.get('seconds'), 'final': res.get('final'), 'quality': q.get('state'), 'qualityWhy': (q.get('why') or '')[:400], 'counts': info.get('counts'), 'overlay': overlay, 'noModel': not os.path.exists(model_file)})
    spec = {'house': name, 'title': h['title'], 'publisher': h['publisher'], 'set': h['set'], 'url': h['url'], 'sources': src, 'sketchRun': h['sketchRun'], 'variants': [{k: v[k] for k in ('key', 'label', 'kind', 'render', 'name')} | {'commit': v.get('commit'), 'revision': v.get('modelFileSha256_12')} for v in variants]}
    json.dump(spec, open(os.path.join(hd, 'board-spec.json'), 'w'), indent=1, ensure_ascii=False)
    subprocess.run(PY + [os.path.join(old, 'boards.py'), os.path.join(hd, 'board-spec.json'), out], check=True)
    # v3.54.21: the omission trace of the delivered variant against the baseline, from the runs' own records
    last, first = h['variants'][-1], h['variants'][0]
    om = OM.house(name, last['run'], first['run'] if first is not last else None)
    json.dump(om, open(os.path.join(hd, 'omissions.json'), 'w'), indent=1, ensure_ascii=False, sort_keys=True)
    open(os.path.join(hd, 'omissions.md'), 'w').write(OM.md(om))
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
    persp = [i for i in src_index if 'file' in i and (i.get('roles', {}).get('projection') == 'PERSPECTIVE' or 'PERSPECTIVE' in str(i.get('roles', {}).get('document')) or i.get('roles', {}).get('document') == 'VISUALIZATION')]
    cards.append({'h': h, 'variants': variants, 'slots': slots, 'unassigned': unassigned, 'om': om, 'persp': persp, 'srcdir': src})

# ---- the gallery ------------------------------------------------------------------------------------------------------
E = html.escape
def a(href, text): return f'<a href="{E(href)}">{E(text)}</a>' if href and (href.startswith('http') or os.path.exists(os.path.join(out, href))) else f'<span class="none">{E(text)}: brak (ten bieg go nie zapisał)</span>'
def img(href, alt, cls='thumb'): return f'<a href="{E(href)}"><img class="{cls}" src="{E(href)}" alt="{E(alt)}" loading="lazy"></a>' if href and os.path.exists(os.path.join(out, href)) else '<div class="none box">brak</div>'
css = """body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f4f3f0;color:#1d1d1b}header{background:#22313f;color:#fff;padding:18px 24px}
main{padding:16px 24px;max-width:1500px;margin:auto}h2{margin:28px 0 6px}section.house{background:#fff;border:1px solid #d9d6cf;border-radius:8px;padding:14px 18px;margin:18px 0}
table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #d9d6cf;padding:6px 8px;vertical-align:top;font-size:14px;text-align:left}th{background:#efede8}
img.thumb{max-width:230px;max-height:170px;border:1px solid #ccc;background:#fff}img.board{max-width:100%;border:1px solid #ccc}.none{color:#8a2be2;font-style:italic}.box{width:200px;height:60px;display:flex;align-items:center;justify-content:center;background:#eee;border:1px dashed #aaa}
.tag{display:inline-block;padding:1px 7px;border-radius:10px;font-size:12px;font-weight:600;margin-right:4px}.LIVE{background:#d6f0d6}.REPLAY{background:#dde7f7}.KONTROLA{background:#ffe7b8}.HOST{background:#e8d6f5}
.legend td{font-size:13px}img.thumb2{max-width:330px;max-height:240px;border:1px solid #ccc;background:#fff;margin:2px}tr.open td,td.open{background:#fff3e0}small{color:#555}"""
doc = [f'<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>{E(man.get("title","BuildPlan v3.54.21 — galeria"))}</title><style>{css}</style></head><body>',
       f'<header><h1>{E(man.get("title","BuildPlan v3.54.21 — galeria"))} (prywatna, offline)</h1><div>commit kodu końcowego: <code>{E(man.get("commit","?"))}</code> · wszystkie obrazy modeli to rzeczywiste rendery tego samego renderera (neutral-flat/1): te same kamery, paleta i światło</div></header><main>',
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
    # v3.54.21 ---- perspectives of the publisher beside the model's oblique views
    last = c['variants'][-1]
    pfiles = [os.path.relpath(os.path.join(c['srcdir'], p['file']), out) for p in c['persp']][:4]
    doc.append('<h3>Perspektywy wydawcy (jakościowo, bez wymiarów) i widoki ukośne modelu oddanego</h3><table><tr><th>Oryginalne perspektywy</th><th>Model oddany: cztery narożniki</th></tr><tr><td>' + (''.join(img(p, 'perspektywa wydawcy', 'thumb2') for p in pfiles) or '<span class="none">pakiet nie ma perspektyw</span>') + '</td><td>' + ''.join(img(f"tiles/{name}/{last['key']}-{t}.png", t, 'thumb2') for t in ('AXO-front-right', 'AXO-front-left', 'AXO-rear-left', 'AXO-rear-right')) + '</td></tr></table>')
    doc.append('<h3>Dach z góry: połączenia połaci (czerwone = kosz, pomarańczowe = dojście niższego dachu do ściany, czarne = kalenica, niebieskie = naroże)</h3><table><tr>' + ''.join(f'<th>{E(v["label"])}</th>' for v in c['variants']) + '</tr><tr>' + ''.join(f'<td>{img(f"houses/{name}/renders/{v["key"]}-ROOFPLAN.png", "dach z góry", "board")}</td>' for v in c['variants']) + '</tr></table>')
    om = c['om']
    sr = om.get('structureRead')
    doc.append('<h3>Obrazy rzeczywiście wysłane do odczytu struktury (oryginały wydawcy, nie szkice)</h3>')
    if sr:
        pk = f"houses/{name}/runs/{last['key']}/structure-read"
        req = jload(os.path.join(out, pk, 'request.json'), {}) or {}
        doc.append(f'<p>Kontrakt <code>{E(str(sr.get("promptVersion")))}</code>. ' + (' · '.join(a(f"{pk}/{f}", f) for f in ('request.json', 'answer-raw.json', 'agreed.json')) if req else '<span class="none">pakiet obrazów nie został zapisany przez ten bieg (odczyt odtworzony z nagrania)</span>') + '</p>')
        doc.append('<table><tr><th>Rola</th><th>Podpis</th><th>px źródła → px wysłane</th><th>Skala</th><th>Wysłany obraz</th></tr>')
        pics = req.get('pictures') or []
        for k, i in enumerate(sr['sent']):
            pf = f"{pk}/{pics[k]['file']}" if k < len(pics) else None
            doc.append(f'<tr><td>{E(str(i["role"]))}{" " + str(i["n"]) if i.get("n") else ""}</td><td>{E(str(i["caption"]))}</td><td>{i["sourcePx"][0]}×{i["sourcePx"][1]} → {i["sentPx"][0]}×{i["sentPx"][1]}</td><td>1:{i["factor"]}</td><td>{img(pf, "wysłany obraz") if pf else "—"}</td></tr>')
        doc.append('</table>')
        if sr['skipped']: doc.append('<p><b>Pominięte, z przyczyną:</b></p><ul>' + ''.join(f'<li>{E(str(x.get("role")))} <code>{E(str(x.get("frameId", ""))[-28:])}</code> {E(str(x.get("px")))}: {E(str(x.get("why")))}</li>' for x in sr['skipped']) + '</ul>')
        if sr['missing']: doc.append('<p><b>Brak w pakiecie:</b> ' + E('; '.join(str(x) for x in sr['missing'])) + '</p>')
    else: doc.append('<p class="none">Odczyt struktury nie został zapytany w tym biegu.</p>')
    ft = om.get('features')
    doc.append(f'<h3>Ślad pominięć: cecha → odczyt → uzgodnienie → model → przyczyna</h3><p>{a(f"houses/{name}/omissions.md", "pełny ślad (Markdown)")} · {a(f"houses/{name}/omissions.json", "JSON")}</p>')
    if ft:
        doc.append(f'<p>Wynik: {E(str(ft["byResult"]))}; przyczyny: {E(str(ft["byCause"]))}; otwarte cechy kluczowe: {E(str(ft["keyOpen"] or "brak"))}.</p><table><tr><th>Cecha</th><th>Waga</th><th>Odczytano ze źródeł</th><th>Uzgodnienie</th><th>W modelu</th><th>Przyczyna</th><th>Opis</th></tr>')
        for r in ft['rows']:
            cls = '' if r['result'] == 'BUILT_AS_STATED' else ' class="open"'
            doc.append(f'<tr{cls}><td>{E(r["id"])}</td><td>{E(str(r["weight"]))}</td><td>{E(r["stated"])}{" (" + E(r["status"]) + ")" if r.get("status") else ""}</td><td>{E(str(r["agreed"]))}</td><td>{E(r["result"])}</td><td>{E(str(r["cause"] or "—"))}</td><td><small>{E((r["why"] or "")[:260])}</small></td></tr>')
        doc.append('</table>')
    rs = om.get('roofSystem')
    if rs:
        doc.append('<p><b>Układ dachów:</b> ' + E('; '.join(f"{q['a']} → {q['b']} {q['kind']}" for q in rs['relations']) or 'żadne dwa dachy się nie stykają') + f'; kosze z przecięcia połaci: {len(rs["valleys"])}; naruszenia: {len(rs["violations"])}.</p>')
        if rs['fates']:
            doc.append('<table><tr><th>Bryła</th><th>Własność</th><th>Los</th><th>Przyjęto</th><th>Zbudowano</th><th>Dlaczego</th></tr>' + ''.join(f'<tr><td>{E(str(q.get("bodyId")))}</td><td>{E(str(q.get("property")))}</td><td>{E(str(q.get("fate")))}</td><td>{E(str(q.get("taken", "—")))}</td><td>{E(str(q.get("built", "—")))}</td><td><small>{E((q.get("why") or "")[:220])}</small></td></tr>' for q in rs['fates']) + '</table>')
    rb = om.get('readback')
    if rb: doc.append(f'<p><b>Odczyt zwrotny z modelu:</b> zgodnych {rb["agree"]} z {rb["of"]}' + ('' if rb['agree'] == rb['of'] else '; niezgodne: ' + E('; '.join(f"{x['property']}: przyjęto {x['taken']}, zbudowano {x['built']}" for x in rb['checks'] if not x.get('agrees')))) + '.</p>')
    cn = om['counts']
    if cn['baseline'] and cn['after']:
        keys = ('exteriorWalls', 'interiorWalls', 'exteriorOpenings', 'interiorOpenings', 'windows', 'doors', 'chimneys', 'roofWindows', 'valleys', 'abutments')
        doc.append('<table><tr><th></th>' + ''.join(f'<th>{k}</th>' for k in keys) + '</tr><tr><td>baseline</td>' + ''.join(f'<td>{cn["baseline"][k]}</td>' for k in keys) + '</tr><tr><td>oddany</td>' + ''.join(f'<td{" class=open" if cn["after"][k] < cn["baseline"][k] and k not in ("valleys", "abutments") else ""}>{cn["after"][k]}</td>' for k in keys) + '</tr></table>')
    doc.append('<h3>Wnętrze bez dachu na rzucie wydawcy (niebieskie: ściany zewnętrzne modelu, czerwone: wewnętrzne, zielone: drzwi wewnętrzne, błękitne: otwory zewnętrzne)</h3><table><tr>' + ''.join(f'<th>{E(v["label"])}</th>' for v in c['variants']) + '</tr><tr>')
    for v in c['variants']:
        o = v.get('overlay') or {}
        cnt = o.get('counts') or {}
        fr = o.get('frame') or {}
        note = (f'ściany wewn. {cnt.get("interior")} ({o.get("interiorLengthM")} m), drzwi wewn. {cnt.get("interiorDoors")}, otwory zewn. {cnt.get("exteriorOpenings")}; udział długości ścian wewn. na tuszu ścian rzutu: {o.get("onWallInk")}; układ: {fr.get("basis")}' + (f' — {fr.get("note")}' if fr.get('note') else '')) if cnt else (o.get('why') or 'brak modelu')
        doc.append(f'<td>{img(f"houses/{name}/overlay/{v["key"]}-plan-overlay.png", "wnętrze na rzucie", "board")}<br><small>{E(str(note))}</small></td>')
    doc.append('</tr></table>')
    doc.append('<h3>Perspektywy i rzut bez dachu</h3><table><tr>' + ''.join(f'<th>{E(v["label"])}</th>' for v in c['variants']) + '</tr>')
    for t in ('AXO-front-right', 'AXO-front-left', 'AXO-rear-left', 'AXO-rear-right', 'TOP', 'STOREY-0'):
        doc.append('<tr>' + ''.join(f'<td>{img(f"tiles/{name}/{v["key"]}-{t}.png", t)}<br><small>{t}</small></td>' for v in c['variants']) + '</tr>')
    doc.append('</table></section>')
# ---- the host's jobs and what stands beside the houses (given in the manifest as `extras`) -----------------------------
ex = man.get('extras') or {}
if ex.get('host'):
    doc.append('<section class="house" id="host"><h2>Publiczny host na commicie końcowym</h2><table><tr><th>Zadanie</th><th>Wynik</th><th>USD / żądania</th><th>Pliki</th><th>Render (jeżeli model)</th></tr>')
    for j in ex['host']:
        dst = os.path.join(out, 'host', j['key'])
        shutil.copytree(j['dir'], dst, dirs_exist_ok=True)
        rec = jload(os.path.join(dst, 'record.json'), {}) or {}
        files = ' · '.join(a(f"host/{j['key']}/{f}", f) for f in ('record.json', 'status.json', 'result.json', 'model.json', 'scene.json') if os.path.exists(os.path.join(dst, f)))
        ren = ''
        if os.path.exists(os.path.join(dst, 'model.json')):
            subprocess.run(['npx', 'vite-node', 'research/source-to-model/v35418/render.ts', '--', '--model', os.path.join(dst, 'model.json'), '--out', dst, '--name', 'render', '--tile', '700'], cwd=root, check=True, capture_output=True)
            ren = img(f"host/{j['key']}/render-SIDES.png", 'elewacje', 'board') + img(f"host/{j['key']}/render-AROUND.png", 'aksonometrie', 'board')
        doc.append(f'<tr><td><b>{E(j["label"])}</b><br><small>{E(j.get("url", ""))}</small></td><td><span class="tag HOST">HOST</span> {E(str(rec.get("status")))}{(" — " + E(str((rec.get("error") or {}).get("code")))) if rec.get("error") else ""}<br><small>{E(str(rec.get("seconds")))} s</small></td><td>{E(str(rec.get("booksDeltaUsd")))} / {E(str(rec.get("booksDeltaRequests")))}</td><td>{files}</td><td>{ren}</td></tr>')
    doc.append('</table>')
    for f in ex.get('hostFiles', []):
        os.makedirs(os.path.join(out, 'host'), exist_ok=True); shutil.copy2(f['from'], os.path.join(out, 'host', f['to']))
    doc.append('<p>' + ' · '.join(a(f"host/{f['to']}", f['to']) for f in ex.get('hostFiles', [])) + '</p></section>')
for d in ex.get('dirs', []):
    shutil.copytree(d['from'], os.path.join(out, d['to']), dirs_exist_ok=True)
if ex.get('dirs'):
    doc.append('<section class="house" id="extra"><h2>Oceny i protokół</h2><ul>' + ''.join(f'<li>{a(d["to"] + "/" + d["index"], d["label"])}</li>' for d in ex['dirs'] if d.get('index')) + '</ul></section>')
doc.append('</main></body></html>')
open(os.path.join(out, 'gallery.html'), 'w').write('\n'.join(doc))
# link check
import re
links = set(re.findall(r'(?:href|src)="([^"#]+)"', '\n'.join(doc)))
missing = sorted(l for l in links if not l.startswith('http') and not os.path.exists(os.path.join(out, l)))
json.dump({'links': len(links), 'missing': missing}, open(os.path.join(out, 'gallery-link-check.json'), 'w'), indent=1)
print('gallery:', len(links), 'links,', len(missing), 'missing')
