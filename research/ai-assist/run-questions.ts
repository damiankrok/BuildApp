/**
 * EXTERIOR-COMPLETE E12 research: ask the analyzer's open questions to a live model, on two models, and score the
 * answers against reference answers read from the sources — the measure of whether an AI second look helps where the
 * deterministic reader gives up or goes wrong.
 *
 *   npx vite-node research/ai-assist/run-questions.ts -- <questions.json> <out-dir> [models=claude-haiku-5-5,claude-opus-5-5] [repeats=3]
 *
 * questions.json (outside the worktree, with the crops it names): [{ id, house, kind: 'CALLOUT' | 'CHOICE', png,
 * cropByteHash, assetByteHash, cropRectPx, question, hypotheses: [{id,text}], truth, cv, validator?, truthWhy }].
 *
 * - CALLOUT questions go through the production `secondLook` (the observation contract, its validation, its record).
 * - CHOICE questions ask one structured question about the crop: which hypothesis, or none of them, with the evidence.
 * - Every answer is `AI_SUGGESTED`. It is VALIDATED only where a deterministic check independent of the model agrees
 *   (`validator`): the plan gap a callout's width must fit, two levels whose difference is a published height, a
 *   printed chain or a wall band. Without one it stays a suggestion — a question for the user, never a fact.
 *
 * The owner consented to sending crops of these (disclosed DEV) drawings to the provider for this experiment. Crops stay
 * outside the worktree; the records hold hashes, rectangles, texts, costs and latencies — never pixels.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { secondLook } from '@buildapp/source-vision'
import { claudeCodeStructured, claudeCodeVisionReasoner } from './claude-code-reasoner.js'
import type { CliCall } from './claude-code-reasoner.js'

type Hyp = { id: string; text: string }
type Q = { id: string; house: string; kind: 'CALLOUT' | 'CHOICE'; png: string; cropByteHash: string; assetByteHash: string; cropRectPx: { x0: number; y0: number; x1: number; y1: number }; question: string; hypotheses: Hyp[]; truth: string; cv: string | null; validator?: { kind: string; [k: string]: unknown } | null; truthWhy: string }

const args = process.argv.slice(2).filter((a) => a !== '--')
const [questionsPath, out] = args
const models = (args[2] ?? 'claude-haiku-5-5,claude-opus-5-5').split(',')
const repeats = Number(args[3] ?? 3)
mkdirSync(out, { recursive: true })
const questions = JSON.parse(readFileSync(questionsPath, 'utf8')) as Q[]

const SYSTEM = 'You answer one narrow question about one image cropped from an architectural drawing. Look only at the image. If what is asked is not visible or not legible, answer NONE_OF_THESE and say why. Never guess to fit the options.'
const choiceSchema = (q: Q) => ({
  type: 'object',
  properties: {
    choice: { type: 'string', enum: [...q.hypotheses.map((h) => h.id), 'NONE_OF_THESE'] },
    readAs: { type: 'string', description: 'what you actually see printed or drawn, in your own words or characters' },
    legible: { type: 'boolean' },
    evidence: { type: 'string', description: 'the visual cue, in one sentence someone can check against the image' },
  },
  required: ['choice', 'readAs', 'legible', 'evidence'],
  additionalProperties: false,
})

type Answer = { questionId: string; model: string; run: number; status: string; aiHypothesisId: string | null; aiSays: string | null; correct: boolean; cvCorrect: boolean; validated: boolean | null; costUsd: number | null; latencyMs: number; evidence?: string }
const answers: Answer[] = []

// deterministic validators, independent of the model: each says whether a hypothesis passes a check the drawing or
// the page already supports
const validate = (q: Q, hypothesisId: string, partner: (id: string) => string | null): boolean | null => {
  const v = q.validator
  if (!v) return null
  const hyp = q.hypotheses.find((h) => h.id === hypothesisId)
  if (!hyp) return false
  if (v.kind === 'PLAN_GAP_WIDTH') {
    const w = Number(hyp.text.split('/')[0]) / 100
    return Math.abs(w - Number(v.gapM)) <= Number(v.toleranceM)
  }
  if (v.kind === 'PAIR_SUM') {
    const other = partner(String(v.with))
    if (!other) return null
    const num = (s: string) => Number(s.replace('±', '').replace(',', '.'))
    const a = num(hyp.text)
    const b = num(other)
    return Math.abs(Math.abs(a - b) - Number(v.publishedM)) <= Number(v.toleranceM)
  }
  // PRINTED_CHAIN / WALL_BAND: checks on the deterministic reading itself, recorded by the caller from the plan digest
  if (v.kind === 'PRINTED_CHAIN' || v.kind === 'WALL_BAND') return v.holds === true ? hypothesisId === q.truth : null
  return null
}

for (const model of models) {
  for (let run = 0; run < repeats; run += 1) {
    const byQuestion = new Map<string, string | null>()
    for (const q of questions) {
      const bytes = readFileSync(q.png)
      let call: CliCall | undefined
      const onCall = (c: CliCall) => (call = c)
      let aiHypothesisId: string | null = null
      let aiSays: string | null = null
      let status = 'ANSWERED'
      let evidence: string | undefined
      try {
        if (q.kind === 'CALLOUT') {
          const r = await secondLook(
            { id: q.id, ambiguity: q.question, source: { assetId: q.id, assetByteHash: q.assetByteHash, cropRectPx: q.cropRectPx }, crop: { bytes, byteHash: q.cropByteHash, mediaType: 'image/png', width: q.cropRectPx.x1 - q.cropRectPx.x0, height: q.cropRectPx.y1 - q.cropRectPx.y0 }, hypotheses: q.hypotheses, cv: { hypothesisId: q.cv, why: 'the deterministic reader' } },
            claudeCodeVisionReasoner({ model, onCall }),
            { ownerConsent: true },
          )
          status = r.status
          aiHypothesisId = r.aiHypothesisId
          aiSays = r.aiSays
        } else {
          const ans = (await claudeCodeStructured({ model, system: SYSTEM, imagePng: bytes, text: `${q.question}\nOptions: ${q.hypotheses.map((h) => `${h.id} = ${h.text}`).join('; ')}; or NONE_OF_THESE.`, schema: choiceSchema(q), onCall })) as { choice: string; readAs: string; legible: boolean; evidence: string }
          aiHypothesisId = ans.choice === 'NONE_OF_THESE' ? null : ans.choice
          aiSays = ans.readAs
          evidence = ans.evidence
          if (!ans.legible && aiHypothesisId === null) status = 'NOT_LEGIBLE'
        }
      } catch (e) {
        status = `ERROR: ${(e as Error).message.slice(0, 160)}`
      }
      byQuestion.set(q.id, aiHypothesisId)
      answers.push({ questionId: q.id, model, run, status, aiHypothesisId, aiSays, correct: aiHypothesisId === q.truth, cvCorrect: q.cv === q.truth, validated: null, costUsd: call?.costUsd ?? null, latencyMs: call?.latencyMs ?? 0, ...(evidence ? { evidence } : {}) })
      console.log(`${model} #${run} ${q.id}: ${status} ${aiHypothesisId ?? '-'} (${aiSays ?? ''}) truth ${q.truth} cv ${q.cv ?? 'none'} $${call?.costUsd?.toFixed(4) ?? '?'} ${call?.latencyMs ?? 0}ms`)
    }
    // validators that need the run's other answers (a pair of levels) are applied once the run is complete
    for (const a of answers.filter((x) => x.model === model && x.run === run)) {
      const q = questions.find((x) => x.id === a.questionId) as Q
      if (a.aiHypothesisId) {
        const partner = (id: string): string | null => {
          const p = questions.find((x) => x.id === id)
          const pid = byQuestion.get(id)
          return p && pid ? (p.hypotheses.find((h) => h.id === pid)?.text ?? null) : null
        }
        a.validated = validate(q, a.aiHypothesisId, partner)
      }
    }
  }
}

const summary = models.map((model) => {
  const mine = answers.filter((a) => a.model === model)
  const cost = mine.reduce((s, a) => s + (a.costUsd ?? 0), 0)
  return {
    model,
    asked: mine.length,
    correct: mine.filter((a) => a.correct).length,
    wrongButChosen: mine.filter((a) => !a.correct && a.aiHypothesisId !== null).length,
    abstained: mine.filter((a) => a.aiHypothesisId === null).length,
    validatedCorrect: mine.filter((a) => a.validated === true && a.correct).length,
    validatedWrong: mine.filter((a) => a.validated === true && !a.correct).length,
    costUsd: Number(cost.toFixed(4)),
    meanLatencyMs: Math.round(mine.reduce((s, a) => s + a.latencyMs, 0) / Math.max(1, mine.length)),
  }
})
writeFileSync(join(out, 'answers.json'), JSON.stringify({ questions: questions.map(({ png: _p, ...q }) => q), answers, summary }, null, 2))
console.log(JSON.stringify(summary, null, 2))
