/*
 * review-core.js — the OWNER review pack's rules, with no DOM and no network (RESEARCH ONLY).
 *
 * The page (review.html) and Node (validate-labels.mjs, test/core.test.mjs) run this same file, so a labels file is
 * judged by one validator. Nothing here assigns an answer: phase-1 answers enter only through answerPhase1() with
 * { humanAction: true }, which the page passes from click handlers alone. See preregistration.md.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sha256.js'))
  else root.OwnerReviewCore = factory(root.OwnerReviewSha256)
})(typeof self !== 'undefined' ? self : this, function (Sha) {
  'use strict'
  const QUEUE_SCHEMA = 'research.005r-exterior.owner-review-queue.0.1'
  const LABELS_SCHEMA = 'research.005r-exterior.owner-review-labels.0.1'
  const ORIGIN = { REAL: 'OWNER_LOCAL_REVIEW', SYNTHETIC: 'SYNTHETIC_EXAMPLE' }
  const VIEWING = ['LOCAL_BYTES_HASH_MATCHED', 'MANUAL_PAGE_FALLBACK_NOT_BLIND']
  const STATUS = ['UNREVIEWED', 'REVIEWED_VISUAL', 'TECHNICALLY_CROSSCHECKED']
  const LABEL_KEYS = ['anchorByteHash', 'conflict', 'featureClass', 'kind', 'lineageGroup', 'metricAuthority', 'phase1', 'phase2',
    'projectEditionId', 'questionId', 'reviewedByteHash', 'reviewerOrigin', 'status', 'viewingMode']
  const PHASE1_KEYS = ['answer', 'answeredAt', 'assembly', 'cover', 'mirrored', 'notes', 'region', 'side']
  const PHASE2_KEYS = ['evidenceSource', 'notes', 'sourceContext', 'technicalEvidence']
  const TOP_KEYS = ['counts', 'labels', 'packId', 'packKind', 'phase1Seal', 'queueSha256', 'schema']
  const NOTES_MAX = 500
  const HEX64 = /^[0-9a-f]{64}$/
  // nothing that looks like an address, an embedded picture or a long encoded blob may ride in the reviewer's notes
  const FORBIDDEN_TEXT = /(https?:\/\/|www\.|data:[a-z]+\/|base64|[A-Za-z0-9+/]{80,}|\b[\w-]+(\.[\w-]+)*\.(pl|com|eu|net|org|io)\b|\.(jpe?g|png|gif|webp|bmp|avif)\b)/i

  // ---------- canonical JSON (byte-identical to build_pack.py: sort_keys, ensure_ascii=False) ----------
  function sortKeys(x) {
    if (Array.isArray(x)) return x.map(sortKeys)
    if (x && typeof x === 'object') {
      const o = {}
      for (const k of Object.keys(x).sort()) o[k] = sortKeys(x[k])
      return o
    }
    return x
  }
  const canonicalPretty = (x) => JSON.stringify(sortKeys(x), null, 1) + '\n' // == Python json.dumps(indent=1) + '\n'
  const canonicalCompact = (x) => JSON.stringify(sortKeys(x))

  async function sha256Hex(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
    const subtle = typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle
    if (subtle) {
      try {
        const d = await subtle.digest('SHA-256', bytes)
        return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
      } catch (e) {
        // some browsers expose subtle but refuse it on file:// pages; the pure implementation gives the same digest
        if (!(e && /secure|support|not allowed/i.test(String(e.message || e)))) throw e
      }
    }
    return Sha.sha256Hex(bytes)
  }

  // ---------- queue ----------
  async function checkQueue(queue, expectedSha) {
    const errors = []
    if (!queue || queue.schema !== QUEUE_SCHEMA) errors.push('QUEUE_SCHEMA')
    if (queue && !['REAL', 'SYNTHETIC'].includes(queue.packKind)) errors.push('PACK_KIND')
    const sha = queue ? await sha256Hex(canonicalPretty(queue)) : null
    if (expectedSha && sha !== expectedSha) errors.push('QUEUE_HASH_MISMATCH')
    const ids = new Set()
    const owner = new Map()
    for (const q of (queue && queue.questions) || []) {
      if (ids.has(q.questionId)) errors.push(`DUPLICATE_QUESTION ${q.questionId}`)
      ids.add(q.questionId)
      if (!q.acceptedByteHashes.includes(q.anchorByteHash)) errors.push(`ANCHOR_NOT_ACCEPTED ${q.questionId}`)
      for (const h of q.acceptedByteHashes) {
        // one byte file may serve one edition only: the same pixels in two editions are two separate questions
        const key = h
        if (owner.has(key) && owner.get(key) !== q.projectEditionId) errors.push(`BYTES_SHARED_ACROSS_EDITIONS ${q.questionId}`)
        owner.set(key, q.projectEditionId)
      }
    }
    return { ok: errors.length === 0, sha, errors }
  }

  function byId(queue) {
    const m = new Map()
    for (const q of queue.questions) m.set(q.questionId, q)
    return m
  }

  function emptyLabel(q) {
    return {
      questionId: q.questionId, projectEditionId: q.projectEditionId, lineageGroup: q.lineageGroup, anchorByteHash: q.anchorByteHash,
      reviewedByteHash: null, kind: q.kind, featureClass: q.featureClass, status: 'UNREVIEWED', metricAuthority: 'NONE',
      reviewerOrigin: null, viewingMode: null, phase1: null, phase2: null, conflict: null,
    }
  }

  function newState(queue, queueSha) {
    const labels = {}
    for (const q of queue.questions) labels[q.questionId] = emptyLabel(q)
    return { packId: queue.packId, packKind: queue.packKind, queueSha256: queueSha, phase1Seal: null, labels }
  }

  // ---------- file matching (bytes never leave the machine; only their SHA-256 is compared) ----------
  function matchFiles(queue, hashed) {
    const want = new Map()
    for (const q of queue.questions) for (const h of q.acceptedByteHashes) want.set(h, q.imageId)
    const byImage = {}
    let unmatched = 0
    let duplicates = 0
    const seen = new Set()
    for (const f of hashed) {
      if (seen.has(f.sha256)) { duplicates++; continue }
      seen.add(f.sha256)
      const img = want.get(f.sha256)
      if (!img) { unmatched++; continue }
      if (!byImage[img] || f.sha256 < byImage[img]) byImage[img] = f.sha256 // deterministic among accepted variants
    }
    return { byImage, unmatched, duplicates }
  }

  // ---------- validation of one phase-1 / phase-2 value ----------
  function checkNotes(n, where, errors) {
    if (n === null || n === undefined) return
    if (typeof n !== 'string' || n.length > NOTES_MAX) errors.push(`${where}: NOTES_INVALID`)
    else if (FORBIDDEN_TEXT.test(n)) errors.push(`${where}: NOTES_CARRY_URL_OR_ENCODED_DATA`)
  }

  function checkRegion(r, where, errors) {
    if (r === null || r === undefined) return
    const ok = Array.isArray(r) && r.length === 4 && r.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 &&
      Math.round(v * 1000) / 1000 === v) && r[0] < r[2] && r[1] < r[3]
    if (!ok) errors.push(`${where}: REGION_INVALID`)
  }

  function checkPhase1(q, p, vocab, where, errors) {
    if (!p || typeof p !== 'object') { errors.push(`${where}: PHASE1_MISSING`); return }
    for (const k of Object.keys(p)) if (!PHASE1_KEYS.includes(k)) errors.push(`${where}: PHASE1_KEY ${k}`)
    const answers = q.kind === 'SCENE_SCOPE' ? vocab.sceneAnswer : vocab.featureAnswer
    if (!answers.includes(p.answer)) errors.push(`${where}: ANSWER_OUT_OF_VOCABULARY`)
    const present = q.kind === 'FEATURE_VISIBILITY' && p.answer === 'PRESENT'
    if (p.cover != null && !(q.subAnswer === 'COVER' && present && vocab.cover.includes(p.cover))) errors.push(`${where}: COVER_NOT_ALLOWED`)
    if (p.assembly != null && !(q.subAnswer === 'ASSEMBLY' && present && vocab.assembly.includes(p.assembly))) errors.push(`${where}: ASSEMBLY_NOT_ALLOWED`)
    if (p.side != null && !vocab.side.includes(p.side)) errors.push(`${where}: SIDE_OUT_OF_VOCABULARY`)
    if (p.mirrored != null && !vocab.mirrored.includes(p.mirrored)) errors.push(`${where}: MIRRORED_OUT_OF_VOCABULARY`)
    if (p.region != null && !(q.kind === 'FEATURE_VISIBILITY' && present)) errors.push(`${where}: REGION_ONLY_FOR_PRESENT`)
    checkRegion(p.region, where, errors)
    checkNotes(p.notes, where, errors)
    if (p.answeredAt != null && !(typeof p.answeredAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p.answeredAt))) errors.push(`${where}: ANSWERED_AT_INVALID`)
  }

  function checkPhase2(q, p, vocab, where, errors) {
    if (!p || typeof p !== 'object') { errors.push(`${where}: PHASE2_MISSING`); return }
    for (const k of Object.keys(p)) if (!PHASE2_KEYS.includes(k)) errors.push(`${where}: PHASE2_KEY ${k}`)
    if (q.kind === 'SCENE_SCOPE') {
      if (!vocab.sourceContext.includes(p.sourceContext)) errors.push(`${where}: SOURCE_CONTEXT_OUT_OF_VOCABULARY`)
      if (p.technicalEvidence != null || p.evidenceSource != null) errors.push(`${where}: SCENE_HAS_NO_TECHNICAL_EVIDENCE`)
    } else {
      if (!vocab.technicalEvidence.includes(p.technicalEvidence)) errors.push(`${where}: TECHNICAL_EVIDENCE_OUT_OF_VOCABULARY`)
      if (p.sourceContext != null) errors.push(`${where}: SOURCE_CONTEXT_ONLY_FOR_SCENE`)
      const needsSource = ['TECHNICAL_SHOWS', 'TECHNICAL_DOES_NOT_SHOW'].includes(p.technicalEvidence)
      if (needsSource && !vocab.evidenceSource.includes(p.evidenceSource)) errors.push(`${where}: EVIDENCE_SOURCE_REQUIRED`)
      if (!needsSource && p.evidenceSource != null && !vocab.evidenceSource.includes(p.evidenceSource)) errors.push(`${where}: EVIDENCE_SOURCE_OUT_OF_VOCABULARY`)
    }
    checkNotes(p.notes, where, errors)
  }

  function conflictOf(q, p1, p2) {
    if (!p1 || !p2) return null
    if (q.kind === 'SCENE_SCOPE') return p2.sourceContext === 'DISAGREES'
    return (p1.answer === 'PRESENT' && p2.technicalEvidence === 'TECHNICAL_DOES_NOT_SHOW') ||
      (p1.answer === 'ABSENT' && p2.technicalEvidence === 'TECHNICAL_SHOWS')
  }

  function statusOf(q, label) {
    if (!label.phase1) return 'UNREVIEWED'
    // addendum B: only a drawing that actually shows or rules out the feature is a technical cross-check
    if (q.kind === 'FEATURE_VISIBILITY' && label.phase2 && ['TECHNICAL_SHOWS', 'TECHNICAL_DOES_NOT_SHOW'].includes(label.phase2.technicalEvidence)) return 'TECHNICALLY_CROSSCHECKED'
    return 'REVIEWED_VISUAL'
  }

  // ---------- answering ----------
  const norm = (v) => (v === undefined || v === '' ? null : v)

  function answerPhase1(state, queue, questionId, input, ctx) {
    const q = byId(queue).get(questionId)
    if (!q) return { ok: false, errors: ['UNKNOWN_QUESTION'] }
    if (!ctx || ctx.humanAction !== true) return { ok: false, errors: ['HUMAN_ACTION_REQUIRED'] }
    if (state.phase1Seal) return { ok: false, errors: ['SEALED: phase-1 answers are read-only after the seal'] }
    const errors = []
    if (!VIEWING.includes(ctx.viewingMode)) errors.push('VIEWING_MODE')
    if (ctx.viewingMode === 'LOCAL_BYTES_HASH_MATCHED' && !q.acceptedByteHashes.includes(ctx.reviewedByteHash)) errors.push('SOURCE_IMAGE_UNAVAILABLE')
    if (ctx.viewingMode === 'MANUAL_PAGE_FALLBACK_NOT_BLIND' && ctx.reviewedByteHash != null) errors.push('MANUAL_FALLBACK_HAS_NO_BYTES')
    const p = {
      answer: norm(input.answer), cover: norm(input.cover), assembly: norm(input.assembly), region: norm(input.region),
      side: norm(input.side), mirrored: norm(input.mirrored), notes: norm(input.notes), answeredAt: norm(input.answeredAt),
    }
    checkPhase1(q, p, queue.vocab, questionId, errors)
    if (errors.length) return { ok: false, errors }
    const label = state.labels[questionId]
    label.phase1 = p
    label.reviewedByteHash = ctx.viewingMode === 'LOCAL_BYTES_HASH_MATCHED' ? ctx.reviewedByteHash : null
    label.viewingMode = ctx.viewingMode
    label.reviewerOrigin = ORIGIN[state.packKind]
    label.status = statusOf(q, label)
    return { ok: true }
  }

  function clearPhase1(state, queue, questionId, ctx) {
    if (!ctx || ctx.humanAction !== true) return { ok: false, errors: ['HUMAN_ACTION_REQUIRED'] }
    if (state.phase1Seal) return { ok: false, errors: ['SEALED'] }
    const q = byId(queue).get(questionId)
    if (!q) return { ok: false, errors: ['UNKNOWN_QUESTION'] }
    state.labels[questionId] = emptyLabel(q)
    return { ok: true }
  }

  function phase1Payload(state, queue) {
    return queue.questions.map((q) => state.labels[q.questionId]).filter((l) => l.phase1).map((l) => ({
      questionId: l.questionId, reviewedByteHash: l.reviewedByteHash, viewingMode: l.viewingMode, reviewerOrigin: l.reviewerOrigin, phase1: l.phase1,
    }))
  }

  async function seal(state, queue, ctx) {
    if (!ctx || ctx.humanAction !== true) return { ok: false, errors: ['HUMAN_ACTION_REQUIRED'] }
    if (state.phase1Seal) return { ok: false, errors: ['ALREADY_SEALED'] }
    const payload = phase1Payload(state, queue)
    state.phase1Seal = { digest: await sha256Hex(canonicalCompact(payload)), sealedCount: payload.length }
    return { ok: true, seal: state.phase1Seal }
  }

  function answerPhase2(state, queue, questionId, input, ctx) {
    const q = byId(queue).get(questionId)
    if (!q) return { ok: false, errors: ['UNKNOWN_QUESTION'] }
    if (!ctx || ctx.humanAction !== true) return { ok: false, errors: ['HUMAN_ACTION_REQUIRED'] }
    if (!state.phase1Seal) return { ok: false, errors: ['NOT_SEALED: the cross-check opens only after the blind answers are sealed'] }
    const label = state.labels[questionId]
    if (!label.phase1) return { ok: false, errors: ['NO_BLIND_ANSWER: an unanswered question stays UNREVIEWED'] }
    const p = { technicalEvidence: norm(input.technicalEvidence), evidenceSource: norm(input.evidenceSource), sourceContext: norm(input.sourceContext), notes: norm(input.notes) }
    const errors = []
    checkPhase2(q, p, queue.vocab, questionId, errors)
    if (errors.length) return { ok: false, errors }
    label.phase2 = p // phase1 is never touched here
    label.conflict = conflictOf(q, label.phase1, p)
    label.status = statusOf(q, label)
    return { ok: true }
  }

  // ---------- export ----------
  function counts(state, queue) {
    const c = { questions: queue.questions.length, UNREVIEWED: 0, REVIEWED_VISUAL: 0, TECHNICALLY_CROSSCHECKED: 0, conflicts: 0, notBlind: 0 }
    for (const q of queue.questions) {
      const l = state.labels[q.questionId]
      c[l.status]++
      if (l.conflict) c.conflicts++
      if (l.viewingMode === 'MANUAL_PAGE_FALLBACK_NOT_BLIND') c.notBlind++
    }
    return c
  }

  function exportObject(state, queue) {
    return {
      schema: LABELS_SCHEMA, packId: state.packId, packKind: state.packKind, queueSha256: state.queueSha256, phase1Seal: state.phase1Seal,
      counts: counts(state, queue), labels: queue.questions.map((q) => state.labels[q.questionId]),
    }
  }
  const exportJSON = (state, queue) => canonicalPretty(exportObject(state, queue))

  const CSV_COLUMNS = ['order', 'questionId', 'tier', 'projectEditionId', 'lineageGroup', 'anchorByteHash', 'reviewedByteHash', 'kind', 'featureClass',
    'status', 'metricAuthority', 'reviewerOrigin', 'viewingMode', 'answer', 'cover', 'assembly', 'region', 'side', 'mirrored', 'answeredAt', 'notes',
    'technicalEvidence', 'evidenceSource', 'sourceContext', 'phase2Notes', 'conflict']
  function csvCell(v) {
    if (v === null || v === undefined) return ''
    let s = Array.isArray(v) ? v.join(' ') : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // a spreadsheet must never evaluate a note as a formula
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  function exportCSV(state, queue) {
    const rows = [CSV_COLUMNS.join(',')]
    for (const q of queue.questions) {
      const l = state.labels[q.questionId]
      const p1 = l.phase1 || {}
      const p2 = l.phase2 || {}
      const row = { order: q.order, tier: q.tier, ...l, ...p1, technicalEvidence: p2.technicalEvidence, evidenceSource: p2.evidenceSource,
        sourceContext: p2.sourceContext, phase2Notes: p2.notes, notes: p1.notes }
      rows.push(CSV_COLUMNS.map((k) => csvCell(row[k])).join(','))
    }
    return rows.join('\n') + '\n'
  }

  // ---------- import (refuses instead of repairing) ----------
  async function importLabels(text, queue, queueSha) {
    const errors = []
    let doc
    try { doc = JSON.parse(text) } catch (e) { return { ok: false, errors: ['NOT_JSON'] } }
    if (FORBIDDEN_TEXT.test(text.replace(/"[0-9a-f]{64}"/g, '""'))) errors.push('CARRIES_URL_OR_ENCODED_DATA')
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: ['NOT_AN_OBJECT'] }
    for (const k of Object.keys(doc)) if (!TOP_KEYS.includes(k)) errors.push(`TOP_KEY ${k}`)
    if (doc.schema !== LABELS_SCHEMA) errors.push('LABELS_SCHEMA')
    if (doc.packId !== queue.packId) errors.push('PACK_ID_MISMATCH')
    if (doc.packKind !== queue.packKind) errors.push('PACK_KIND_MISMATCH')
    if (doc.queueSha256 !== queueSha) errors.push('QUEUE_HASH_MISMATCH')
    if (!Array.isArray(doc.labels)) return { ok: false, errors: errors.concat('LABELS_NOT_A_LIST') }
    const qs = byId(queue)
    const state = newState(queue, queueSha)
    const seen = new Set()
    for (const l of doc.labels) {
      const where = (l && l.questionId) || '?'
      const q = l && qs.get(l.questionId)
      if (!q) { errors.push(`${where}: UNKNOWN_QUESTION`); continue }
      if (seen.has(q.questionId)) { errors.push(`${where}: DUPLICATE_QUESTION`); continue }
      seen.add(q.questionId)
      for (const k of Object.keys(l)) if (!LABEL_KEYS.includes(k)) errors.push(`${where}: LABEL_KEY ${k}`)
      for (const k of LABEL_KEYS) if (!(k in l)) errors.push(`${where}: LABEL_KEY_MISSING ${k}`)
      // anchors are the queue's, never the file's: an answer cannot be moved to another edition, group or image
      for (const k of ['projectEditionId', 'lineageGroup', 'anchorByteHash', 'kind', 'featureClass'])
        if (l[k] !== q[k]) errors.push(`${where}: ANCHOR_MISMATCH ${k}`)
      if (l.metricAuthority !== 'NONE') errors.push(`${where}: METRIC_AUTHORITY`)
      if (!STATUS.includes(l.status)) errors.push(`${where}: STATUS`)
      if (l.status === 'UNREVIEWED' || l.phase1 == null) {
        for (const k of ['reviewedByteHash', 'reviewerOrigin', 'viewingMode', 'phase1', 'phase2', 'conflict'])
          if (l[k] != null) errors.push(`${where}: UNREVIEWED_CARRIES ${k}`)
        if (l.status !== 'UNREVIEWED') errors.push(`${where}: STATUS_WITHOUT_ANSWER`)
        continue
      }
      if (l.reviewerOrigin !== ORIGIN[queue.packKind]) errors.push(`${where}: REVIEWER_ORIGIN`)
      if (!VIEWING.includes(l.viewingMode)) errors.push(`${where}: VIEWING_MODE`)
      if (l.viewingMode === 'LOCAL_BYTES_HASH_MATCHED' && !q.acceptedByteHashes.includes(l.reviewedByteHash)) errors.push(`${where}: REVIEWED_BYTES_NOT_ACCEPTED`)
      if (l.viewingMode === 'MANUAL_PAGE_FALLBACK_NOT_BLIND' && l.reviewedByteHash != null) errors.push(`${where}: MANUAL_FALLBACK_HAS_NO_BYTES`)
      checkPhase1(q, l.phase1, queue.vocab, where, errors)
      if (l.phase2 != null) {
        if (!doc.phase1Seal) errors.push(`${where}: PHASE2_WITHOUT_SEAL`)
        checkPhase2(q, l.phase2, queue.vocab, where, errors)
      }
      const expectConflict = l.phase2 != null ? conflictOf(q, l.phase1, l.phase2) : null
      if (l.conflict !== expectConflict) errors.push(`${where}: CONFLICT_NOT_RECOMPUTABLE`)
      if (l.status !== statusOf(q, l)) errors.push(`${where}: STATUS_NOT_RECOMPUTABLE`)
      state.labels[q.questionId] = JSON.parse(JSON.stringify(l))
    }
    if (seen.size !== queue.questions.length) errors.push(`MISSING_QUESTIONS ${queue.questions.length - seen.size}`)
    if (doc.phase1Seal != null) {
      const s = doc.phase1Seal
      if (!s || !HEX64.test(s.digest) || !Number.isInteger(s.sealedCount) || Object.keys(s).sort().join() !== 'digest,sealedCount') errors.push('SEAL_MALFORMED')
      else {
        const payload = phase1Payload(state, queue)
        const digest = await sha256Hex(canonicalCompact(payload))
        if (digest !== s.digest || payload.length !== s.sealedCount) errors.push('SEAL_DIGEST_MISMATCH: blind answers changed after the seal')
        else state.phase1Seal = { digest, sealedCount: payload.length }
      }
    }
    if (errors.length === 0 && canonicalCompact(doc.counts) !== canonicalCompact(counts(state, queue))) errors.push('COUNTS_NOT_RECOMPUTABLE')
    return errors.length ? { ok: false, errors } : { ok: true, state }
  }

  return {
    QUEUE_SCHEMA, LABELS_SCHEMA, ORIGIN, VIEWING, STATUS, canonicalPretty, canonicalCompact, sha256Hex, checkQueue, newState, emptyLabel,
    matchFiles, answerPhase1, clearPhase1, seal, answerPhase2, exportObject, exportJSON, exportCSV, importLabels, counts, phase1Payload,
  }
})
