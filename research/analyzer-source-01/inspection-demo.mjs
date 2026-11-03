// SOURCE-01 (research): a private, static demonstration of the source inspection — the run's own `sources` records
// drawn over the real sheets (copied from the byte cache into the OUTPUT directory, outside the repository).
//   node research/analyzer-source-01/inspection-demo.mjs <run-dir> <cache-dir> <out-dir> [<before-run-dir>]
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
const [runDir, cacheDir, outDir, beforeDir] = process.argv.slice(2)
if (resolve(outDir).startsWith(resolve('.'))) { console.error('REFUSED: publisher pixels stay outside the repository'); process.exit(2) }
const sum = JSON.parse(readFileSync(join(runDir, 'result-summary.json'), 'utf8'))
const before = beforeDir && existsSync(join(beforeDir, 'result-summary.json')) ? JSON.parse(readFileSync(join(beforeDir, 'result-summary.json'), 'utf8')) : undefined
const s = sum.sources
mkdirSync(join(outDir, 'img'), { recursive: true })
const key = (u) => createHash('sha256').update(u).digest('hex').slice(0, 32)
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const OUT = { READ: 'odczytany', REFUSED_BY_CONTENT: 'odrzucony: treść przeczy podpisowi', NOT_READ: 'nieodczytany', NO_READER: 'tylko jako źródło' }
const KIND = { FLOOR_PLAN: 'rzut', ELEVATION: 'elewacja', SECTION: 'przekrój', SITE_PLAN: 'plan sytuacyjny', EXTERIOR_PERSPECTIVE: 'widok zewnętrzny', INTERIOR: 'wnętrze' }
let html = `<!doctype html><meta charset="utf-8"><title>${esc(sum.title)} — arkusze źródłowe</title><style>body{font:14px system-ui;margin:16px;max-width:1100px}details{border-top:1px solid #ddd;padding:6px 0}summary{cursor:pointer}figure{position:relative;margin:8px 0;max-width:900px}figure img{width:100%;display:block}figure svg{position:absolute;inset:0;width:100%;height:100%}.m{color:#666}.r{font-family:ui-monospace,monospace;font-size:12px}li.sel{background:#ffe}</style>`
html += `<h1>${esc(sum.title)}</h1><p class="m">analizator ${esc(sum.analyzer.service)} / solver ${esc(sum.analyzer.solver)} · ${s.classifier ? `treść obrazów: ${esc(s.classifier.id)} (głowa ${esc(s.classifier.headVersion)})` : 'bez rozpoznawania treści'} · obrazy: ${s.counts.sheets}, odczytane ${s.counts.read}, odrzucone po treści ${s.counts.refusedByContent} · liczby: ${s.counts.readings} (wydrukowane i użyte ${s.counts.printedUsed}, wyliczone ${s.counts.derived})</p>`
if (before) html += `<p class="m">model PRZED ${esc(before.modelHash.slice(0, 12))} → PO ${esc(sum.modelHash.slice(0, 12))}${before.modelHash === sum.modelHash ? ' (bez zmian)' : ''}</p>`
for (const sh of s.sheets) {
  const file = join(cacheDir, `${key(sh.url)}.bin`)
  const img = existsSync(file) ? `img/${sh.byteHash.slice(0, 16)}.jpg` : null
  if (img) copyFileSync(file, join(outDir, img))
  const st = Math.max(2, Math.round(sh.width / 300))
  const overlay = sh.readings.map((r, i) => `<g data-i="${i}">${r.line ? `<line x1="${r.line.x0}" y1="${r.line.y0}" x2="${r.line.x1}" y2="${r.line.y1}" stroke="${r.printed ? '#0a7' : '#c80'}" stroke-width="${st}" ${r.printed ? '' : `stroke-dasharray="${st * 3} ${st * 2}"`}/>` : ''}${r.box ? `<rect x="${r.box.x0}" y="${r.box.y0}" width="${r.box.x1 - r.box.x0}" height="${r.box.y1 - r.box.y0}" fill="none" stroke="${r.use === 'USED_IN_MODEL' ? '#06c' : '#999'}" stroke-width="${st}"/>` : ''}</g>`).join('')
  const reading = (r) => `${r.measure.toLowerCase()} ${!r.printed ? 'wyliczone (niewydrukowane)' : r.origin === 'CHAIN_CORRECTED' ? `odczytane „${esc(r.rawText)}”, przyjęte (poprawione względem łańcucha)` : `wydrukowane „${esc(r.rawText)}”`} → ${r.value} ${r.unit} · ${r.use.toLowerCase()}${r.featureId ? ` → ${esc(r.featureId)}` : ''} — ${esc(r.why)}`
  html += `<details${sh.outcome === 'REFUSED_BY_CONTENT' ? ' open' : ''}><summary>${img ? `<img src="${img}" width="72" style="vertical-align:middle">` : ''} <b>${esc(sh.claimed.document)}</b>${sh.content ? ` · treść: ${KIND[sh.content.top] ?? sh.content.top} ${Math.round(sh.content.probability * 100)} %` : ''} · ${OUT[sh.outcome] ?? sh.outcome}${sh.readings.length ? ` · ${sh.readings.length} odczytów` : ''}</summary>`
  html += `<div class="m">wydawca: ${esc(sh.claimed.basis)}</div><div>${esc(sh.reader)}${sh.side ? ` (${esc(sh.side)}, ${esc(sh.sideBasis ?? '')})` : ''}: ${esc(sh.why)}</div>`
  if (img) html += `<figure><img src="${img}"><svg viewBox="0 0 ${sh.width} ${sh.height}">${overlay}</svg></figure>`
  if (sh.readings.length) html += `<ol class="r">${sh.readings.map((r, i) => `<li data-i="${i}">${reading(r)}</li>`).join('')}</ol>`
  html += `</details>`
}
html += `<script>for(const li of document.querySelectorAll('li[data-i]'))li.onclick=()=>{const d=li.closest('details');d.querySelectorAll('li').forEach(x=>x.classList.remove('sel'));li.classList.add('sel');d.querySelectorAll('svg g').forEach(g=>g.setAttribute('opacity',g.dataset.i===li.dataset.i?'1':'0.15'))}</script>`
writeFileSync(join(outDir, 'index.html'), html)
console.log(`${s.sheets.length} sheets → ${join(outDir, 'index.html')}`)
