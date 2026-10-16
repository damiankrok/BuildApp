/*
 * review-ui.js — the OWNER review page (RESEARCH ONLY). Local files only: pictures are read from the reviewer's own
 * disk, hashed here, and shown through blob: URLs; nothing is uploaded and no request leaves the page (see the CSP in
 * review.html). The rules live in review-core.js; this file only draws and forwards clicks.
 */
(function () {
  'use strict'
  const Core = window.OwnerReviewCore
  const queue = window.OWNER_REVIEW_QUEUE
  const QUEUE_SHA = window.OWNER_REVIEW_QUEUE_SHA256
  const DIR = window.OWNER_REVIEW_PACK_DIR
  const app = document.getElementById('app')
  const STORE_KEY = 'owner-review:' + queue.packId + ':' + QUEUE_SHA
  const SYN = queue.packKind === 'SYNTHETIC'
  const SEEN_KEY = STORE_KEY + ':crosscheck-seen' // survives a reset: once phase 2 was shown, phase 1 is never blind again here
  function crosscheckSeen() { try { return localStorage.getItem(SEEN_KEY) === '1' } catch (e) { return false } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1') } catch (e) { /* no storage: the export still carries the seal */ } }

  const T = {
    prompt: {
      PERGOLA: 'Czy na obrazie widać pergolę — konstrukcję z belek lub rusztu nad tarasem, wejściem albo przy domu?',
      CARPORT: 'Czy widać wiatę na samochód — zadaszone miejsce postojowe otwarte z boków, bez bramy?',
      ENTRANCE_CANOPY: 'Czy widać daszek nad wejściem — zadaszenie nad drzwiami wejściowymi?',
      COLUMN: 'Czy widać zewnętrzny słup lub kolumnę, która coś podpiera (dach, taras, daszek, balkon)?',
      BALCONY: 'Czy widać balkon — płytę wysuniętą przed elewację na piętrze?',
      LOGGIA: 'Czy widać loggię — wnękę w bryle na piętrze, otwartą na zewnątrz?',
      RAILING: 'Czy widać balustradę na zewnątrz budynku?',
      TERRACE: 'Czy widać taras przy domu?',
      GARAGE: 'Czy widać garaż zamknięty — z bramą garażową?',
      ROOFCOVER: 'Czy pokrycie dachu widać na tyle wyraźnie, żeby je rozpoznać?',
      OPENING_GLAZING: 'Czy widać duże przeszklenie — okno lub drzwi tarasowe wyraźnie większe niż zwykłe okno?',
      UNKNOWN_ASSEMBLY: 'Czy widać dobudowaną część z własnym dachem (np. garaż, zadaszony taras, daszek, wiata)?',
      SCENE: 'Co przedstawia obraz?',
    },
    feature: {
      PRESENT: 'Widać', ABSENT: 'Nie ma — miejsce, w którym by była, jest widoczne', NOT_SHOWN: 'To miejsce nie jest pokazane na obrazie',
      CANNOT_TELL: 'Nie da się ocenić',
    },
    scene: {
      EXTERIOR: 'Zewnętrze budynku', INTERIOR: 'Wnętrze', BOTH_VISIBLE: 'Widać i wnętrze, i zewnętrze',
      NOT_A_SCENE: 'Rysunek techniczny, rzut lub schemat — nie scena', CANNOT_TELL: 'Nie da się ocenić',
    },
    cover: { OPEN_MEMBERS: 'Ażurowe (belki, ruszt, prześwity)', CONTINUOUS_COVER: 'Pełne pokrycie (dach, płyta)', NO_COVER: 'Bez zadaszenia', UNKNOWN: 'Nie wiem' },
    assembly: { GARAGE: 'Garaż', COVERED_TERRACE: 'Zadaszony taras', ENTRANCE_CANOPY: 'Daszek nad wejściem', CARPORT: 'Wiata', OTHER: 'Inne', UNKNOWN: 'Nie wiem' },
    side: { FRONT: 'frontowa', GARDEN: 'ogrodowa', LEFT: 'lewa', RIGHT: 'prawa' },
    mirrored: { YES: 'tak, lustrzane odbicie', NO: 'nie' },
    technicalEvidence: {
      TECHNICAL_SHOWS: 'Rysunek techniczny to pokazuje', TECHNICAL_DOES_NOT_SHOW: 'Rysunek techniczny tego nie pokazuje',
      NO_TECHNICAL_EVIDENCE: 'Brak rysunku, który by to rozstrzygał', CANNOT_TELL: 'Nie da się ocenić',
    },
    evidenceSource: { ELEVATION_IN_PACK: 'elewacja z tego pakietu', PLAN_OR_SECTION_ON_PAGE: 'rzut lub przekrój na stronie', ELEVATION_ON_PAGE: 'elewacja na stronie', OTHER: 'inne' },
    sourceContext: { AGREES: 'Kontekst źródła zgadza się z moją odpowiedzią', DISAGREES: 'Kontekst źródła się nie zgadza', NO_CONTEXT: 'Brak kontekstu' },
  }

  // ---------- state ----------
  let state = Core.newState(queue, QUEUE_SHA)
  let cur = 0
  let filter = 'ALL'
  let includeTime = false
  let drawing = false
  const images = {} // imageId -> { sha, url }
  const manual = {} // questionId -> true once the reviewer chose the non-blind page fallback
  const pending2 = {} // questionId -> an incomplete phase-2 entry (UI only; never exported)
  let fileStats = null
  let cross = null
  let locator = null
  let toastTimer = null

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ state, manual, includeTime })) } catch (e) { /* storage off: the export is the record */ }
  }
  async function restore() {
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') } catch (e) { saved = null }
    if (!saved || !saved.state) return
    // a saved session is re-validated with the import rules, so a stale or edited copy can never slip in
    const doc = Core.exportObject(saved.state, queue)
    const r = await Core.importLabels(Core.canonicalPretty(doc), queue, QUEUE_SHA)
    if (r.ok) {
      state = r.state
      Object.assign(manual, saved.manual || {})
      includeTime = Boolean(saved.includeTime)
      if (Object.keys(manual).length) await loadLocator()
    } else toast('Zapisana sesja nie przeszła kontroli i została pominięta: ' + r.errors.slice(0, 2).join('; '))
  }

  // ---------- helpers ----------
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue
      if (k === 'class') e.className = v
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
      else e.setAttribute(k, v === true ? '' : v)
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.append(kid.nodeType ? kid : String(kid))
    return e
  }
  function toast(msg) {
    let t = document.querySelector('.toast')
    if (!t) { t = el('div', { class: 'toast', role: 'status' }); document.body.append(t) }
    t.textContent = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => t.remove(), 4500)
  }
  const visible = () => queue.questions.filter((q) => filter === 'ALL' || (filter === 'PRIORITY' ? q.tier === 'PRIORITY' : state.labels[q.questionId].status === 'UNREVIEWED'))
  const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  // ---------- local files ----------
  async function addFiles(fileList) {
    const hashed = []
    let n = 0
    for (const f of Array.from(fileList)) {
      if (f.size > 64 * 2 ** 20) continue
      const buf = await f.arrayBuffer()
      hashed.push({ sha256: await Core.sha256Hex(buf), file: f })
      n++
    }
    const m = Core.matchFiles(queue, hashed)
    for (const [imageId, sha] of Object.entries(m.byImage)) {
      if (images[imageId]) continue
      const f = hashed.find((h) => h.sha256 === sha).file
      images[imageId] = { sha, url: URL.createObjectURL(f) }
    }
    fileStats = { scanned: n, matchedImages: Object.keys(images).length, unmatched: m.unmatched, duplicates: m.duplicates }
    render()
  }

  // ---------- answering ----------
  function ctxFor(q) {
    if (manual[q.questionId]) return { humanAction: true, viewingMode: 'MANUAL_PAGE_FALLBACK_NOT_BLIND', reviewedByteHash: null }
    const img = images[q.imageId]
    return { humanAction: true, viewingMode: 'LOCAL_BYTES_HASH_MATCHED', reviewedByteHash: img ? img.sha : null }
  }
  function setPhase1(q, patch) {
    const l = state.labels[q.questionId]
    const base = l.phase1 ? { ...l.phase1 } : { answer: null, cover: null, assembly: null, region: null, side: null, mirrored: null, notes: null, answeredAt: null }
    const next = { ...base, ...patch }
    if (next.answer !== 'PRESENT') { next.cover = null; next.assembly = null; next.region = null }
    if (!next.answer) { toast('Najpierw wybierz odpowiedź.'); return }
    if ('answer' in patch) next.answeredAt = includeTime ? now() : null
    const r = Core.answerPhase1(state, queue, q.questionId, next, ctxFor(q))
    if (!r.ok) toast('Nie zapisano: ' + r.errors.join('; '))
    save()
    render()
  }
  function setPhase2(q, patch) {
    const l = state.labels[q.questionId]
    const next = { ...(pending2[q.questionId] || l.phase2 || { technicalEvidence: null, evidenceSource: null, sourceContext: null, notes: null }), ...patch }
    if (q.kind === 'FEATURE_VISIBILITY' && (!next.technicalEvidence ||
        (['TECHNICAL_SHOWS', 'TECHNICAL_DOES_NOT_SHOW'].includes(next.technicalEvidence) && !next.evidenceSource))) {
      pending2[q.questionId] = next // nothing is recorded until the value is complete
      render()
      return
    }
    delete pending2[q.questionId]
    const r = Core.answerPhase2(state, queue, q.questionId, next, { humanAction: true })
    if (!r.ok) toast('Nie zapisano: ' + r.errors.join('; '))
    save()
    render()
  }

  async function doSeal() {
    const c = Core.counts(state, queue)
    const msg = `Zapieczętować odpowiedzi ślepe?\n\nOdpowiedzi: ${c.questions - c.UNREVIEWED} z ${c.questions}. ` +
      `Po zapieczętowaniu nie da się ich zmienić, a ${c.UNREVIEWED} pytań bez odpowiedzi zostanie UNREVIEWED na stałe ` +
      '(okno ślepe zamyka się dla wszystkich). Dopiero wtedy pojawi się kontekst techniczny i wydawcy.'
    if (!window.confirm(msg)) return
    const r = await Core.seal(state, queue, { humanAction: true })
    if (!r.ok) { toast(r.errors.join('; ')); return }
    save()
    await loadCross()
    render()
  }
  async function loadCross() {
    if (cross || !state.phase1Seal) return
    await window.OwnerReviewLoadScript(DIR + 'crosscheck.js')
    const c = window.OWNER_REVIEW_CROSSCHECK
    if (!c || c.queueSha256 !== QUEUE_SHA) { toast('Plik kontroli technicznej nie pasuje do pakietu.'); return }
    cross = new Map(c.questions.map((x) => [x.questionId, x]))
    markSeen()
  }
  async function loadLocator() {
    if (locator) return true
    await window.OwnerReviewLoadScript(DIR + 'manual-locator.js')
    const L = window.OWNER_REVIEW_LOCATOR
    if (!L || L.queueSha256 !== QUEUE_SHA) { toast('Lokalizator nie pasuje do pakietu.'); return false }
    locator = new Map(L.questions.map((x) => [x.questionId, x]))
    return true
  }
  async function useManual(q) {
    const ok = window.confirm('Obejrzysz obraz na stronie wydawcy. Zobaczysz wtedy też jego opisy i kategorie, więc ta odpowiedź ' +
      'zostanie zapisana jako NIE ślepa (MANUAL_PAGE_FALLBACK_NOT_BLIND), bez skrótu bajtów. Kontynuować?')
    if (!ok) return
    if (!(await loadLocator())) return
    manual[q.questionId] = true
    save()
    render()
  }

  // ---------- export / import ----------
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = el('a', { href: url, download: name })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  async function doImport(file) {
    const r = await Core.importLabels(await file.text(), queue, QUEUE_SHA)
    if (!r.ok) { window.alert('Import odrzucony:\n' + r.errors.slice(0, 20).join('\n')); return }
    if (!r.state.phase1Seal && crosscheckSeen()) {
      window.alert('Import odrzucony: w tej przeglądarce kontekst fazy 2 był już pokazany, więc niezapieczętowanych odpowiedzi nie da się już uznać za ślepe.')
      return
    }
    if (!window.confirm('Plik jest poprawny. Zastąpić bieżącą sesję jego zawartością?')) return
    state = r.state
    save()
    if (state.phase1Seal) await loadCross()
    render()
  }

  // ---------- drawing a region ----------
  function attachRegion(stage, q) {
    const overlay = stage.querySelector('.overlay')
    let start = null
    const pos = (ev) => {
      const r = overlay.getBoundingClientRect()
      return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))]
    }
    overlay.addEventListener('pointerdown', (ev) => { if (!drawing) return; start = pos(ev); overlay.setPointerCapture(ev.pointerId) })
    overlay.addEventListener('pointerup', (ev) => {
      if (!drawing || !start) return
      const end = pos(ev)
      const r3 = (v) => Math.round(v * 1000) / 1000
      const reg = [r3(Math.min(start[0], end[0])), r3(Math.min(start[1], end[1])), r3(Math.max(start[0], end[0])), r3(Math.max(start[1], end[1]))]
      start = null
      drawing = false
      if (reg[0] < reg[2] && reg[1] < reg[3]) setPhase1(q, { region: reg })
      else render()
    })
  }

  // ---------- rendering ----------
  function header() {
    const c = Core.counts(state, queue)
    const pri = queue.questions.filter((q) => q.tier === 'PRIORITY')
    const priDone = pri.filter((q) => state.labels[q.questionId].status !== 'UNREVIEWED').length
    return el('div', {},
      el('div', { class: 'bar' },
        el('h1', {}, 'Recenzja zewnętrza — pakiet OWNER-a'),
        el('span', { class: 'pill ' + (state.phase1Seal ? 'sealed' : 'phase1') }, state.phase1Seal ? 'Faza 2: kontrola techniczna (faza 1 zapieczętowana)' : 'Faza 1: ślepa, tylko obraz'),
        el('span', { class: 'pill' }, `odpowiedzi ${c.questions - c.UNREVIEWED}/${c.questions}`),
        el('span', { class: 'pill' }, `priorytet ${priDone}/${pri.length}`),
        c.conflicts ? el('span', { class: 'pill' }, `konflikty ${c.conflicts}`) : null,
        el('span', { class: 'pill small muted' }, 'offline · pliki nie opuszczają komputera')),
      SYN ? el('div', { class: 'banner syn' }, 'PAKIET SYNTETYCZNY — DEMO. Obrazy i odpowiedzi są wymyślone; nic tu nie jest prawdą o żadnym domu.') : null)
  }

  function filesCard() {
    const total = queue.images.length
    const drop = el('div', { class: 'drop' },
      el('div', { class: 'row' },
        el('label', {}, 'Folder z obrazami: ', el('input', { type: 'file', webkitdirectory: true, multiple: true, onchange: (e) => addFiles(e.target.files) })),
        el('label', {}, 'albo pliki: ', el('input', { type: 'file', multiple: true, accept: 'image/*', onchange: (e) => addFiles(e.target.files) }))),
      el('p', { class: 'small muted' }, 'Możesz też upuścić pliki tutaj. Strona liczy SHA-256 każdego pliku na tym komputerze i pokazuje tylko te, ' +
        'których skrót zgadza się z pakietem. Nic nie jest wysyłane.'))
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over') })
    drop.addEventListener('dragleave', () => drop.classList.remove('over'))
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files) })
    return el('section', { class: 'card', 'aria-label': 'Obrazy' },
      el('h2', {}, '1. Obrazy z Twojego dysku'),
      drop,
      el('p', { 'data-testid': 'file-status' }, fileStats
        ? `Dopasowano ${Object.keys(images).length} z ${total} obrazów pakietu (przejrzane pliki: ${fileStats.scanned}, spoza pakietu: ${fileStats.unmatched}, powtórzone: ${fileStats.duplicates}).`
        : `Nie wczytano jeszcze obrazów (pakiet ma ${total}).`))
  }

  function viewer(q) {
    const img = images[q.imageId]
    const l = state.labels[q.questionId]
    if (!img && !manual[q.questionId]) {
      return el('div', { class: 'viewer', 'data-testid': 'viewer' }, el('div', { class: 'unavailable' },
        el('p', { class: 'code', 'data-testid': 'unavailable' }, 'SOURCE_IMAGE_UNAVAILABLE'),
        el('p', {}, 'Na tym komputerze nie ma pliku o skrócie zgodnym z tym pytaniem. Odpowiedź jest zablokowana — brak obrazu nie jest odpowiedzią.'),
        state.phase1Seal ? null : el('button', { onclick: () => useManual(q) }, 'Obejrzę obraz na stronie wydawcy (odpowiedź NIE będzie ślepa)')))
    }
    if (!img) {
      const loc = locator && locator.get(q.questionId)
      return el('div', { class: 'viewer' }, el('div', { class: 'unavailable' },
        el('p', { class: 'code' }, 'MANUAL_PAGE_FALLBACK_NOT_BLIND'),
        loc && loc.projectPageUrl ? el('p', {}, el('a', { href: loc.projectPageUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Otwórz stronę projektu'), ' (poza tym narzędziem)') : el('p', {}, 'Brak strony (pakiet syntetyczny).'),
        loc ? el('p', { class: 'small' }, `Miejsce na stronie: ${loc.section}${loc.publisherImageNumber ? ', obraz nr ' + loc.publisherImageNumber : ''}`) : null))
    }
    const stage = el('div', { class: 'stage' },
      el('img', { src: img.url, alt: 'Obraz ' + q.imageId + ' wczytany z Twojego dysku', draggable: 'false' }),
      el('div', { class: 'overlay', 'data-testid': 'overlay' }))
    const reg = l.phase1 && l.phase1.region
    if (reg) {
      // CSSOM, not a style attribute: the page's CSP forbids inline style attributes
      const box = el('div', { class: 'region', 'data-testid': 'region' })
      Object.assign(box.style, { left: `${reg[0] * 100}%`, top: `${reg[1] * 100}%`, width: `${(reg[2] - reg[0]) * 100}%`, height: `${(reg[3] - reg[1]) * 100}%` })
      stage.append(box)
    }
    attachRegion(stage, q)
    return el('div', { class: 'viewer' + (drawing ? ' drawing' : ''), 'data-testid': 'viewer' }, stage)
  }

  function choice(group, options, value, onPick, disabled, testPrefix) {
    return el('div', { class: 'answers', role: 'group', 'aria-label': group },
      Object.entries(options).map(([code, label], i) => el('button', {
        'aria-pressed': String(value === code), disabled, 'data-testid': `${testPrefix}-${code}`,
        onclick: () => onPick(code),
      }, el('span', {}, `${i + 1}. ${label}`), el('span', { class: 'code' }, code))))
  }

  function phase1Panel(q) {
    const l = state.labels[q.questionId]
    const p = l.phase1 || {}
    const sealed = Boolean(state.phase1Seal)
    const reopened = !sealed && crosscheckSeen()
    const canAnswer = !sealed && !reopened && (Boolean(images[q.imageId]) || manual[q.questionId])
    const scene = q.kind === 'SCENE_SCOPE'
    const kids = [
      reopened ? el('p', { class: 'notice' }, 'Kontekst fazy 2 był już w tej przeglądarce pokazany — odpowiedzi ślepe nie są tu już możliwe. Zaimportuj zapieczętowany eksport.') : null,
      el('p', { class: 'prompt' }, scene ? T.prompt.SCENE : T.prompt[q.featureClass]),
      scene ? null : el('p', { class: 'hint' }, 'Jeśli obraz pokazuje wnętrze, cecha zewnętrzna nie jest na nim widoczna — okno czy słup we wnętrzu to nie jest odpowiedź „Widać”.'),
      choice('Odpowiedź', scene ? T.scene : T.feature, p.answer, (code) => setPhase1(q, { answer: code }), !canAnswer, 'answer'),
    ]
    if (!scene && p.answer === 'PRESENT' && q.subAnswer === 'COVER') {
      kids.push(el('fieldset', {}, el('legend', {}, 'Jakie ma zadaszenie? (opcjonalnie)'),
        choice('Zadaszenie', T.cover, p.cover, (code) => setPhase1(q, { cover: code }), !canAnswer, 'cover')))
    }
    if (!scene && p.answer === 'PRESENT' && q.subAnswer === 'ASSEMBLY') {
      kids.push(el('fieldset', {}, el('legend', {}, 'Co to za część? (opcjonalnie)'),
        choice('Rodzaj', T.assembly, p.assembly, (code) => setPhase1(q, { assembly: code }), !canAnswer, 'assembly')))
    }
    if (!scene && p.answer === 'PRESENT' && images[q.imageId]) {
      kids.push(el('fieldset', {}, el('legend', {}, 'Obszar na obrazie (opcjonalnie)'),
        el('div', { class: 'row' },
          el('button', { disabled: !canAnswer, 'data-testid': 'draw', onclick: () => { drawing = true; render() } }, drawing ? 'Przeciągnij po obrazie…' : 'Zaznacz obszar'),
          p.region ? el('span', { class: 'small qid' }, `[${p.region.join(', ')}]`) : null,
          p.region ? el('button', { disabled: !canAnswer, onclick: () => setPhase1(q, { region: null }) }, 'Usuń obszar') : null)))
    }
    if (p.answer) {
      const sel = (name, opts, val, key) => el('label', { class: 'small' }, name + ' ',
        el('select', { disabled: !canAnswer, onchange: (e) => setPhase1(q, { [key]: e.target.value || null }) },
          el('option', { value: '' }, '— nie wiem / nie podaję —'),
          Object.entries(opts).map(([c, t]) => el('option', { value: c, selected: val === c }, t))))
      kids.push(el('fieldset', {}, el('legend', {}, 'Tylko jeśli masz pewność'),
        el('div', { class: 'row' }, sel('Strona domu:', T.side, p.side, 'side'), sel('Lustrzane odbicie:', T.mirrored, p.mirrored, 'mirrored'))))
      const notes = el('textarea', { maxlength: 500, disabled: !canAnswer, placeholder: 'Notatka (opcjonalnie, bez adresów)', 'aria-label': 'Notatka' })
      notes.value = p.notes || ''
      notes.addEventListener('change', () => setPhase1(q, { notes: notes.value.trim() || null }))
      kids.push(notes)
      if (!sealed) kids.push(el('div', { class: 'nav' }, el('button', { onclick: () => { Core.clearPhase1(state, queue, q.questionId, { humanAction: true }); save(); render() } }, 'Wyczyść odpowiedź')))
    }
    return el('div', {}, kids)
  }

  function phase2Panel(q) {
    const l = state.labels[q.questionId]
    if (!state.phase1Seal) return null
    const x = cross && cross.get(q.questionId)
    const rows = x ? [
      ['Rodzaj źródła', x.sourceKind], ['Kanał wydawcy', (x.publisherChannels || []).join(', ')], ['Klasa podpisu', (x.captionClasses || []).join(', ')],
      ['Podpowiedź widoku (nazwa pliku)', x.viewHint], ['Rola sceny wg B1', x.b1SceneRole], ['Status edycji wg B1', x.b1EditionStatus],
      ['Przeliczenie ścisłe (E)', x.strictRecount || '—'], ['Kategoria wydawcy', x.publisherCategory || '—'], ['Opis wydawcy (rodzaj)', x.publisherDescriptionKind || '—'],
      ['Zadaszenie wg wydawcy', (x.publisherCover || []).join(', ') || '—'], ['Plan pomieszczeń (rodzaje)', JSON.stringify(x.scheduleKinds)],
      ['Cechy z produkcji (ta klasa)', x.productionFeatures.length ? x.productionFeatures.map((f) => `${f.productionFamily}/${f.provenance}/${f.viewFamilies.join('+')}${f.productionDeniesRecess ? '/wnęka zaprzeczona' : ''}`).join('; ') : '—'],
      ['Dostęp do strony', typeof x.pageAccess === 'object' ? x.pageAccess.class : x.pageAccess],
      ['Izolacja edycji', x.isolationNote || '—'],
    ] : []
    const kids = [
      el('h2', {}, 'Faza 2 — kontrola techniczna'),
      el('p', { class: 'small muted' }, 'Kontekst, nie autorytet. Odpowiedź z fazy 1 zostaje bez zmian; niezgodność jest zapisywana jako konflikt. Żadna liczba ani wymiar nie są tu zapisywane.'),
      el('table', { class: 'info' }, rows.map(([k, v]) => el('tr', {}, el('th', {}, k), el('td', {}, String(v))))),
      x && x.sameEditionQuestionIds.length ? el('div', { class: 'small' }, 'Inne pytania tej samej edycji: ',
        x.sameEditionQuestionIds.map((id) => el('button', { onclick: () => jumpTo(id) }, id))) : null,
      x && x.projectPageUrl ? el('p', { class: 'small' }, el('a', { href: x.projectPageUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Otwórz stronę projektu (rzut, przekrój, elewacje)'), ' — ręcznie, poza narzędziem') : null,
    ]
    if (!l.phase1) {
      kids.push(el('p', { class: 'notice' }, 'To pytanie nie dostało odpowiedzi przed zapieczętowaniem: zostaje UNREVIEWED i nie ma kontroli technicznej.'))
      return el('section', { class: 'card', 'data-testid': 'phase2' }, kids)
    }
    const p2 = pending2[q.questionId] || l.phase2 || {}
    if (q.kind === 'SCENE_SCOPE') {
      kids.push(choice('Kontekst źródła', T.sourceContext, p2.sourceContext, (code) => setPhase2(q, { sourceContext: code }), false, 'context'))
    } else {
      kids.push(choice('Dowód techniczny', T.technicalEvidence, p2.technicalEvidence, (code) => setPhase2(q, { technicalEvidence: code }), false, 'tech'))
      kids.push(el('label', { class: 'small' }, 'Źródło dowodu: ',
        el('select', { 'data-testid': 'evidence-source', onchange: (e) => setPhase2(q, { evidenceSource: e.target.value || null }) },
          el('option', { value: '' }, '—'),
          Object.entries(T.evidenceSource).map(([c, t]) => el('option', { value: c, selected: p2.evidenceSource === c }, t)))))
      if (pending2[q.questionId]) kids.push(el('p', { class: 'notice' }, 'Wybierz źródło dowodu, żeby zapisać kontrolę techniczną.'))
    }
    const n2 = el('textarea', { maxlength: 500, placeholder: 'Notatka do kontroli (opcjonalnie)', 'aria-label': 'Notatka do kontroli' })
    n2.value = p2.notes || ''
    n2.addEventListener('change', () => { if (l.phase2) setPhase2(q, { notes: n2.value.trim() || null }) })
    kids.push(n2)
    if (l.conflict) kids.push(el('p', { class: 'conflict', 'data-testid': 'conflict' }, 'KONFLIKT: obraz i kontekst techniczny mówią co innego. Obie odpowiedzi zostają zapisane.'))
    return el('section', { class: 'card', 'data-testid': 'phase2' }, kids)
  }

  function jumpTo(id) {
    const vis = visible()
    let i = vis.findIndex((q) => q.questionId === id)
    if (i < 0) { filter = 'ALL'; i = queue.questions.findIndex((q) => q.questionId === id) }
    cur = Math.max(0, i)
    drawing = false
    render()
  }

  function questionList(vis) {
    return el('div', { class: 'list', role: 'navigation', 'aria-label': 'Lista pytań' }, vis.map((q, i) => {
      const done = state.labels[q.questionId].status !== 'UNREVIEWED'
      const cls = [done ? 'done' : '', i === cur ? 'cur' : '', images[q.imageId] ? '' : 'unavail'].join(' ').trim()
      return el('button', { class: cls, title: q.questionId, 'aria-current': i === cur ? 'true' : null, onclick: () => { cur = i; drawing = false; render() } }, String(q.order))
    }))
  }

  function mainArea() {
    const vis = visible()
    if (!vis.length) return el('section', { class: 'card' }, 'Brak pytań w tym filtrze.')
    if (cur >= vis.length) cur = vis.length - 1
    const q = vis[cur]
    const l = state.labels[q.questionId]
    const filt = el('div', { class: 'row' }, 'Pokaż: ', [['PRIORITY', 'priorytet'], ['ALL', 'wszystkie'], ['OPEN', 'bez odpowiedzi']].map(([k, t]) =>
      el('button', { 'aria-pressed': String(filter === k), onclick: () => { filter = k; cur = 0; drawing = false; render() } }, t)))
    const panel = el('section', { class: 'card', 'data-testid': 'question', 'data-question-id': q.questionId },
      el('div', { class: 'qhead' },
        el('span', {}, `Pytanie ${q.order} z ${queue.questions.length} · ${q.tier === 'PRIORITY' ? 'priorytet' : 'dodatkowe'}`),
        el('span', { class: 'status ' + l.status, 'data-testid': 'status' }, l.status)),
      el('div', { class: 'qid' }, `${q.questionId} · ${q.imageId}`),
      manual[q.questionId] ? el('p', { class: 'notice' }, 'Ta odpowiedź NIE jest ślepa (obraz oglądany na stronie wydawcy).') : null,
      phase1Panel(q),
      el('div', { class: 'nav' },
        el('button', { onclick: () => { cur = Math.max(0, cur - 1); drawing = false; render() } }, '← Poprzednie'),
        el('button', { onclick: () => { cur = Math.min(vis.length - 1, cur + 1); drawing = false; render() } }, 'Następne →'),
        el('button', { onclick: () => { const j = vis.findIndex((x, k) => k > cur && state.labels[x.questionId].status === 'UNREVIEWED'); if (j >= 0) { cur = j; drawing = false; render() } } }, 'Następne bez odpowiedzi')),
      el('p', { class: 'small muted' }, 'Skróty: ', el('kbd', {}, '1'), '–', el('kbd', {}, '5'), ' odpowiedź, ', el('kbd', {}, '←'), ' ', el('kbd', {}, '→'), ' nawigacja.'))
    return el('div', {}, el('section', { class: 'card' }, filt, questionList(vis)),
      el('div', { class: 'grid' }, viewer(q), el('div', {}, panel, phase2Panel(q))))
  }

  function sealCard() {
    const c = Core.counts(state, queue)
    return el('section', { class: 'card' },
      el('h2', {}, '2. Zapieczętuj odpowiedzi ślepe'),
      state.phase1Seal
        ? el('p', { 'data-testid': 'seal-status' }, `Zapieczętowano ${state.phase1Seal.sealedCount} odpowiedzi. Skrót: `, el('span', { class: 'qid' }, state.phase1Seal.digest))
        : el('div', {}, el('p', { class: 'small' }, `Masz ${c.questions - c.UNREVIEWED} odpowiedzi. Pieczęć zamyka fazę ślepą dla wszystkich pytań i dopiero wtedy pokazuje kontekst wydawcy i rysunki techniczne.`),
          el('button', { class: 'primary', 'data-testid': 'seal', onclick: doSeal, disabled: c.questions === c.UNREVIEWED }, 'Zapieczętuj fazę 1')))
  }

  function exportCard() {
    return el('section', { class: 'card' },
      el('h2', {}, '3. Eksport i import'),
      el('div', { class: 'row' },
        el('button', { 'data-testid': 'export-json', onclick: () => download(`owner-review-labels-${queue.packId}.json`, Core.exportJSON(state, queue), 'application/json') }, 'Eksport JSON'),
        el('button', { 'data-testid': 'export-csv', onclick: () => download(`owner-review-labels-${queue.packId}.csv`, Core.exportCSV(state, queue), 'text/csv') }, 'Eksport CSV'),
        el('label', {}, 'Import JSON: ', el('input', { type: 'file', accept: 'application/json,.json', 'data-testid': 'import', onchange: (e) => e.target.files[0] && doImport(e.target.files[0]) })),
        el('label', { class: 'small' }, el('input', { type: 'checkbox', checked: includeTime, onchange: (e) => { includeTime = e.target.checked; save() } }), ' zapisuj czas odpowiedzi (domyślnie nie)')),
      el('p', { class: 'small muted' }, 'Eksport zawiera wyłącznie identyfikatory, skróty bajtów i Twoje odpowiedzi — bez obrazów, adresów i tekstu wydawcy. ' +
        'Pytanie bez odpowiedzi jest eksportowane jako UNREVIEWED, nigdy jako ABSENT. Sesja zapisuje się też w tej przeglądarce.'),
      el('div', { class: 'row' }, el('button', {
        onclick: () => {
          if (!window.confirm('Usunąć zapisaną w tej przeglądarce sesję tego pakietu? Wyeksportowane pliki zostaną.')) return
          try { localStorage.removeItem(STORE_KEY) } catch (e) { /* nothing stored */ }
          state = Core.newState(queue, QUEUE_SHA); cross = null
          for (const m of [manual, pending2]) for (const k of Object.keys(m)) delete m[k]
          render()
        },
      }, 'Wyczyść sesję w tej przeglądarce')))
  }

  function render() {
    const y = window.scrollY
    app.replaceChildren(header(), filesCard(), mainArea(), sealCard(), exportCard())
    window.scrollTo(0, y)
  }

  document.addEventListener('keydown', (e) => {
    if (e.target && ['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) return
    const vis = visible()
    if (e.key === 'ArrowRight') { cur = Math.min(vis.length - 1, cur + 1); drawing = false; render() } else if (e.key === 'ArrowLeft') { cur = Math.max(0, cur - 1); drawing = false; render() } else if (/^[1-5]$/.test(e.key)) {
      const q = vis[cur]
      if (!q || state.phase1Seal || !(images[q.imageId] || manual[q.questionId])) return
      const codes = Object.keys(q.kind === 'SCENE_SCOPE' ? T.scene : T.feature)
      const code = codes[Number(e.key) - 1]
      if (code && !crosscheckSeen()) setPhase1(q, { answer: code })
    }
  })

  ;(async function start() {
    const chk = await Core.checkQueue(queue, QUEUE_SHA)
    if (!chk.ok) {
      app.replaceChildren(el('div', { class: 'banner err' }, 'Pakiet nie przeszedł kontroli integralności: ' + chk.errors.join('; ')))
      return
    }
    await restore()
    if (state.phase1Seal) await loadCross()
    render()
  })()
})()
