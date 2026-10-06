#!/usr/bin/env node
/**
 * labels.mjs — BUILDPLAN-ANALYZER-005K fresh-sheet gap set: blind review batches and the label decision (RESEARCH ONLY).
 *
 *   node research/analyzer-005k/labels.mjs batches --label <gapset/label> --freeze-sha <40hex> [--size 22]
 *   node research/analyzer-005k/labels.mjs collect --label <gapset/label> --manifest <gap-set-manifest.json> --out <gap-set-labels.json>
 *
 * batches  reviewers A and B each get every picture, in an order of their own (SHA-256 of freeze:reviewer:qid), cut into
 *          batches of `--size`: `<label>/batches/<reviewer>-<n>.txt`, one picture path a line. A reviewer is given
 *          label-instructions.md verbatim and one batch file, nothing else, and answers into
 *          `<label>/answers/<reviewer>-<n>.ndjson`.
 * collect  joins the answers by picture name. A and B agree → their label (TWO_REVIEWER_AGREEMENT). They disagree →
 *          the picture goes to reviewer C (`<label>/batches/C-<n>.txt`, same rules); once C has answered, a majority of
 *          three decides (INDEPENDENT_SOURCE_REVIEW), otherwise UNRESOLVED (gap-set-protocol.md §5). Every reviewer is a
 *          blind sub-agent of the session's own model: the labels are not human ground truth.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const LABELS = ['OPENING', 'OPEN', 'NOT_A_WALL_LINE', 'UNRESOLVED']
const cmd = process.argv[2]
const dir = resolve(arg('label', '/home/user/work005k/gapset/label'))
const size = Number(arg('size', '22'))
const pictures = () => readdirSync(join(dir, 'img')).filter((f) => /^q\d{3}\.png$/.test(f)).map((f) => f.slice(0, -4)).sort()

const writeBatches = (reviewer, qids, freeze) => {
  mkdirSync(join(dir, 'batches'), { recursive: true })
  const order = [...qids].sort((p, q) => (sha256(`${freeze}:${reviewer}:${p}`) < sha256(`${freeze}:${reviewer}:${q}`) ? -1 : 1))
  const files = []
  for (let i = 0; i * size < order.length; i += 1) {
    const file = join(dir, 'batches', `${reviewer}-${i + 1}.txt`)
    writeFileSync(file, `${order.slice(i * size, (i + 1) * size).map((q) => join(dir, 'img', `${q}.png`)).join('\n')}\n`)
    files.push(file)
  }
  return files
}

/** Every answer of one reviewer, by picture; a malformed line or a label outside the four is refused. */
const answersOf = (reviewer) => {
  const out = new Map()
  const root = join(dir, 'answers')
  if (!existsSync(root)) return out
  for (const f of readdirSync(root).filter((x) => x.startsWith(`${reviewer}-`) && x.endsWith('.ndjson')).sort()) {
    for (const line of readFileSync(join(root, f), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
      const a = JSON.parse(line)
      if (!LABELS.includes(a.label)) throw new Error(`${f}: label ${a.label} is not one of the four`)
      if (out.has(a.q)) throw new Error(`${f}: ${a.q} answered twice by ${reviewer}`)
      out.set(a.q, { label: a.label, confidence: a.confidence ?? null, why: a.why ?? '' })
    }
  }
  return out
}

/** Cohen's kappa of two raters over the same items. */
const kappa = (pairs) => {
  const n = pairs.length
  if (n === 0) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pe = LABELS.reduce((s, l) => s + (pairs.filter(([a]) => a === l).length / n) * (pairs.filter(([, b]) => b === l).length / n), 0)
  return pe === 1 ? 1 : Math.round(((po - pe) / (1 - pe)) * 10000) / 10000
}

if (cmd === 'batches') {
  const freeze = arg('freeze-sha', '')
  if (!/^[0-9a-f]{40}$/.test(freeze)) throw new Error('--freeze-sha must be 40 lowercase hex')
  const qids = pictures()
  for (const r of ['A', 'B']) process.stdout.write(`${r}: ${writeBatches(r, qids, freeze).length} batches\n`)
} else if (cmd === 'collect') {
  const manifest = JSON.parse(readFileSync(resolve(arg('manifest', 'gap-set-manifest.json')), 'utf8'))
  const A = answersOf('A')
  const B = answersOf('B')
  const C = answersOf('C')
  const missing = manifest.gaps.filter((g) => !A.has(g.qid) || !B.has(g.qid)).map((g) => g.qid)
  if (missing.length) throw new Error(`A or B has not answered ${missing.length}: ${missing.slice(0, 10).join(' ')}`)
  const disagree = manifest.gaps.filter((g) => A.get(g.qid).label !== B.get(g.qid).label).map((g) => g.qid)
  const waiting = disagree.filter((q) => !C.has(q))
  if (waiting.length) {
    const freeze = manifest.freezeSha
    const files = writeBatches('C', waiting, freeze)
    process.stdout.write(`${disagree.length} disagreements; ${waiting.length} wait for reviewer C in ${files.length} batches\n`)
    process.exit(3)
  }
  const labels = manifest.gaps.map((g) => {
    const a = A.get(g.qid)
    const b = B.get(g.qid)
    const c = C.get(g.qid) ?? null
    let label
    let source
    if (a.label === b.label) {
      label = a.label
      source = 'TWO_REVIEWER_AGREEMENT'
    } else if (c && (c.label === a.label || c.label === b.label)) {
      label = c.label
      source = 'INDEPENDENT_SOURCE_REVIEW'
    } else {
      label = 'UNRESOLVED'
      source = 'UNRESOLVED'
    }
    const vote = (x) => (x ? { reviewer: 'AI_SUBAGENT', label: x.label, confidence: x.confidence, why: x.why } : null)
    return { key: g.key, qid: g.qid, label, label_source: source, votes: { A: vote(a), B: vote(b), C: vote(c) } }
  })
  const doc = {
    stage: 'BUILDPLAN-ANALYZER-005K',
    kind: 'fresh-sheet gap set: labels, sealed before any evaluation (gap-set-protocol.md §5)',
    freezeSha: manifest.freezeSha,
    manifestListSha256: manifest.listSha256,
    note: 'NOT HUMAN GROUND TRUTH. Every vote is a blind sub-agent of this session\'s own model (AI_SUBAGENT), shown only the neutral picture and the label definitions (research/analyzer-005k/label-instructions.md). TWO_REVIEWER_AGREEMENT: A and B agree. INDEPENDENT_SOURCE_REVIEW: A and B disagree and a third blind sub-agent sides with one of them. UNRESOLVED: no majority, or the majority says the drawing does not settle it.',
    reviewers: { A: 'AI_SUBAGENT', B: 'AI_SUBAGENT', C: 'AI_SUBAGENT (disagreements only)' },
    agreement: { pairs: manifest.gaps.length, agree: manifest.gaps.length - disagree.length, cohenKappaAB: kappa(manifest.gaps.map((g) => [A.get(g.qid).label, B.get(g.qid).label])) },
    counts: Object.fromEntries(LABELS.map((l) => [l, labels.filter((x) => x.label === l).length])),
    bySource: Object.fromEntries(['TWO_REVIEWER_AGREEMENT', 'INDEPENDENT_SOURCE_REVIEW', 'UNRESOLVED'].map((s) => [s, labels.filter((x) => x.label_source === s).length])),
    labels,
  }
  writeFileSync(resolve(arg('out', 'gap-set-labels.json')), `${JSON.stringify(doc, null, 1)}\n`)
  process.stdout.write(`${labels.length} labels ${JSON.stringify(doc.counts)} by source ${JSON.stringify(doc.bySource)} kappa ${doc.agreement.cohenKappaAB}\n`)
} else {
  process.stderr.write('usage: labels.mjs batches|collect ...\n')
  process.exit(2)
}
