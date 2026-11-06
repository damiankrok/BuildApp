/**
 * EXTERIOR-COMPLETE research (E12, corrected in E13): ask the analyzer's open questions to a live model and score the
 * answers — the measure of whether an AI second look helps where the deterministic reader gives up or goes wrong.
 *
 *   npx vite-node research/ai-assist/run-questions.ts -- <questions.json> <out-dir> [models=claude-haiku-5-5,claude-opus-5-5] [repeats=3]
 *   npx vite-node research/ai-assist/run-questions.ts -- --rescore <questions.json> <answers.json> <out.json>
 *
 * questions.json (outside the worktree, with the crops it names): [{ id, house, kind: 'CALLOUT' | 'CHOICE', png,
 * cropByteHash, assetByteHash, cropRectPx, question, hypotheses: [{id,text,predicate?}], truth, cv, validator?, truthWhy }].
 *
 * E13 correction. In E12 two validators (PRINTED_CHAIN, WALL_BAND) returned `hypothesisId === q.truth`: they compared
 * the model's choice with the reference answer, so 6 of the 15 "independently validated" answers per model were graded,
 * not validated. Now two steps are kept apart by type:
 *
 *  - RUNTIME VALIDATION sees a `RuntimeQuestion` — the question without `truth` and `truthWhy` — and only facts the
 *    analyzer has at runtime: the plan gap's width, a published height, a printed chain or a wall band read by the
 *    deterministic reader. A fact entails a hypothesis through that hypothesis's own `predicate` (written with the
 *    question, on the quantity the fact measures), never through the reference answer. Each verdict says what it
 *    checked: a gap width checks the width half of "105/210" only (PARTIAL), a pair of levels whose difference is the
 *    published height checks the values but not where the labels stand (PARTIAL, unless the answer located them).
 *  - GRADING compares the choice with `truth`, afterwards, for the report only. Nothing graded feeds a decision.
 *
 * Every answer stays `AI_SUGGESTED`; only VALIDATED (whole) may be used as a CV_AI_VALIDATED reading.
 * The owner consented to sending crops of these (disclosed DEV) drawings for this experiment. Crops stay outside the
 * worktree; the records hold hashes, rectangles, texts, costs and latencies — never pixels. Calls are reserved and
 * settled in the experiment's spend ledger (`spend-ledger.json`, 5 USD, never reset).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { secondLook } from '@buildapp/source-vision'
import { claudeCodeStructured, claudeCodeVisionReasoner } from './claude-code-reasoner.js'
import type { CliCall } from './claude-code-reasoner.js'
import { ledgerGuard } from './spend-ledger.js'

type Predicate = { quantity: string; min?: number; max?: number }
type Hyp = { id: string; text: string; predicate?: Predicate }
type Validator =
  | { kind: 'PLAN_GAP_WIDTH'; gapM: number; toleranceM: number }
  | { kind: 'PAIR_SUM'; with: string; publishedM: number; toleranceM: number }
  | { kind: 'PRINTED_CHAIN' | 'WALL_BAND'; quantity: string; valueM: number; fact: string; why?: string }
export type Q = { id: string; house: string; kind: 'CALLOUT' | 'CHOICE'; png: string; cropByteHash: string; assetByteHash: string; cropRectPx: { x0: number; y0: number; x1: number; y1: number }; question: string; hypotheses: Hyp[]; truth: string; cv: string | null; validator?: Validator | null; truthWhy: string }
/** What runtime validation may see: no reference answer, by construction. */
export type RuntimeQuestion = Omit<Q, 'truth' | 'truthWhy'>
export const runtimeOf = (q: Q): RuntimeQuestion => {
  const { truth: _t, truthWhy: _w, ...rest } = q
  return rest
}

export type Verdict = { verdict: 'VALIDATED' | 'PARTIAL' | 'FAILED' | 'NO_CHECK'; checked: string; why: string }

/** Runtime validation: deterministic, independent of the model and of the reference answer. */
export function validate(q: RuntimeQuestion, hypothesisId: string, partner: (id: string) => string | null, located?: boolean): Verdict {
  const v = q.validator
  if (!v) return { verdict: 'NO_CHECK', checked: 'nothing', why: 'no deterministic check exists for this question: it stays a question to the user' }
  const hyp = q.hypotheses.find((h) => h.id === hypothesisId)
  if (!hyp) return { verdict: 'FAILED', checked: 'nothing', why: 'the answer names no hypothesis of the question' }
  if (v.kind === 'PLAN_GAP_WIDTH') {
    const w = Number(hyp.text.split('/')[0]) / 100
    const ok = Math.abs(w - v.gapM) <= v.toleranceM
    return ok ? { verdict: 'PARTIAL', checked: 'the width half only', why: `${w.toFixed(2)} m fits the ${v.gapM.toFixed(2)} m plan gap; the height half is not checked by the plan and stays a suggestion` } : { verdict: 'FAILED', checked: 'the width half', why: `${w.toFixed(2)} m does not fit the ${v.gapM.toFixed(2)} m plan gap` }
  }
  if (v.kind === 'PAIR_SUM') {
    const other = partner(v.with)
    if (!other) return { verdict: 'NO_CHECK', checked: 'nothing', why: `the partner question ${v.with} was not answered` }
    const num = (s: string) => Number(s.replace('±', '').replace(',', '.'))
    const ok = Math.abs(Math.abs(num(hyp.text) - num(other)) - v.publishedM) <= v.toleranceM
    if (!ok) return { verdict: 'FAILED', checked: 'the two values', why: `|${hyp.text} − ${other}| is not the published ${v.publishedM} m` }
    return located ? { verdict: 'VALIDATED', checked: 'the two values and where their labels stand', why: `|${hyp.text} − ${other}| = ${v.publishedM} m, the published height, at the located labels` } : { verdict: 'PARTIAL', checked: 'the two values only', why: `their difference is the published ${v.publishedM} m; where the labels stand on the drawing was not checked` }
  }
  // a printed chain or a wall band the deterministic reader measured, against the hypothesis's own predicate
  const p = hyp.predicate
  if (!p || p.quantity !== v.quantity) return { verdict: 'NO_CHECK', checked: 'nothing', why: `the hypothesis states no predicate on ${v.quantity}` }
  const ok = (p.min === undefined || v.valueM >= p.min) && (p.max === undefined || v.valueM <= p.max)
  return ok ? { verdict: 'VALIDATED', checked: `${v.quantity} = ${v.valueM} m (${v.fact})`, why: `the measured ${v.quantity} satisfies the hypothesis's ${p.min !== undefined ? `≥ ${p.min}` : ''}${p.max !== undefined ? ` ≤ ${p.max}` : ''}` } : { verdict: 'FAILED', checked: `${v.quantity} = ${v.valueM} m (${v.fact})`, why: `the measured ${v.quantity} contradicts the hypothesis` }
}

const SYSTEM = 'You answer one narrow question about one image cropped from an architectural drawing. Look only at the image. If what is asked is not visible or not legible, answer NONE_OF_THESE and say why. Never guess to fit the options.'
const choiceSchema = (q: RuntimeQuestion) => ({
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

type Answer = { questionId: string; model: string; run: number; status: string; aiHypothesisId: string | null; aiSays: string | null; validation: Verdict | null; costUsd: number | null; latencyMs: number; evidence?: string; call?: Omit<CliCall, 'raw'> }
type Graded = Answer & { correct: boolean; cvCorrect: boolean }

/** Grading, for the report only: after every runtime decision is recorded. */
function grade(questions: Q[], answers: Answer[]): Graded[] {
  return answers.map((a) => {
    const q = questions.find((x) => x.id === a.questionId) as Q
    return { ...a, correct: a.aiHypothesisId === q.truth, cvCorrect: q.cv === q.truth }
  })
}

function summarise(graded: Graded[]) {
  const models = [...new Set(graded.map((a) => a.model))]
  return models.map((model) => {
    const mine = graded.filter((a) => a.model === model)
    const count = (f: (a: Graded) => boolean) => mine.filter(f).length
    return {
      model,
      asked: mine.length,
      uniqueQuestions: new Set(mine.map((a) => a.questionId)).size,
      correct: count((a) => a.correct),
      wrongButChosen: count((a) => !a.correct && a.aiHypothesisId !== null),
      abstained: count((a) => a.aiHypothesisId === null),
      validated: count((a) => a.validation?.verdict === 'VALIDATED'),
      validatedWrong: count((a) => a.validation?.verdict === 'VALIDATED' && !a.correct),
      partial: count((a) => a.validation?.verdict === 'PARTIAL'),
      failedCheck: count((a) => a.validation?.verdict === 'FAILED'),
      failedCheckButCorrect: count((a) => a.validation?.verdict === 'FAILED' && a.correct),
      noCheck: count((a) => !a.validation || a.validation.verdict === 'NO_CHECK'),
      costUsd: Number(mine.reduce((s, a) => s + (a.costUsd ?? 0), 0).toFixed(4)),
      meanLatencyMs: Math.round(mine.reduce((s, a) => s + a.latencyMs, 0) / Math.max(1, mine.length)),
    }
  })
}

function validateRun(questions: RuntimeQuestion[], answers: Answer[]): void {
  for (const key of new Set(answers.map((a) => `${a.model}#${a.run}`))) {
    const run = answers.filter((a) => `${a.model}#${a.run}` === key)
    const byQuestion = new Map(run.map((a) => [a.questionId, a.aiHypothesisId]))
    for (const a of run) {
      const q = questions.find((x) => x.id === a.questionId) as RuntimeQuestion
      if (!a.aiHypothesisId) continue
      const partner = (id: string): string | null => {
        const p = questions.find((x) => x.id === id)
        const pid = byQuestion.get(id)
        return p && pid ? (p.hypotheses.find((h) => h.id === pid)?.text ?? null) : null
      }
      a.validation = validate(q, a.aiHypothesisId, partner, false)
    }
  }
}

const args = process.argv.slice(2).filter((a) => a !== '--')
if (args[0] === '--rescore') {
  // E13: the E12 answers again, through the corrected validators; no call is made
  const [, questionsPath, answersPath, outPath] = args
  const questions = JSON.parse(readFileSync(questionsPath, 'utf8')) as Q[]
  const old = JSON.parse(readFileSync(answersPath, 'utf8')) as { answers: Array<Answer & { validated?: boolean | null; correct?: boolean }> }
  const answers: Answer[] = old.answers.map(({ validated: _v, correct: _c, ...a }) => ({ ...a, validation: null }) as Answer)
  validateRun(questions.map(runtimeOf), answers)
  const graded = grade(questions, answers)
  const before = old.answers.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.model]: (acc[a.model] ?? 0) + (a.validated === true && a.correct ? 1 : 0) }), {})
  writeFileSync(outPath, JSON.stringify({ note: 'E12 answers re-validated with the E13 validators: runtime validation without the reference answer; grading kept apart', e12ValidatedCorrectAsReported: before, questions: questions.map(({ png: _p, ...q }) => q), answers: graded, summary: summarise(graded) }, null, 2))
  console.log(JSON.stringify({ e12ValidatedCorrectAsReported: before, summary: summarise(graded) }, null, 2))
} else {
  const [questionsPath, out] = args
  const models = (args[2] ?? 'claude-haiku-5-5,claude-opus-5-5').split(',')
  const repeats = Number(args[3] ?? 3)
  mkdirSync(out, { recursive: true })
  const questions = JSON.parse(readFileSync(questionsPath, 'utf8')) as Q[]
  const runtime = questions.map(runtimeOf)
  const guard = ledgerGuard(join(dirname(fileURLToPath(import.meta.url)), 'spend-ledger.json'), 'E13 run-questions')
  const answers: Answer[] = []
  for (const model of models) {
    for (let run = 0; run < repeats; run += 1) {
      for (const q of runtime) {
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
              claudeCodeVisionReasoner({ model, onCall, guard }),
              { ownerConsent: true },
            )
            status = r.status
            aiHypothesisId = r.aiHypothesisId
            aiSays = r.aiSays
          } else {
            const ans = (await claudeCodeStructured({ model, system: SYSTEM, imagePng: bytes, text: `${q.question}\nOptions: ${q.hypotheses.map((h) => `${h.id} = ${h.text}`).join('; ')}; or NONE_OF_THESE.`, schema: choiceSchema(q), onCall, guard, what: q.id, budgetUsd: model.includes('haiku') ? 0.05 : 0.3 })) as { choice: string; readAs: string; legible: boolean; evidence: string }
            aiHypothesisId = ans.choice === 'NONE_OF_THESE' ? null : ans.choice
            aiSays = ans.readAs
            evidence = ans.evidence
            if (!ans.legible && aiHypothesisId === null) status = 'NOT_LEGIBLE'
          }
        } catch (e) {
          status = `ERROR: ${(e as Error).message.slice(0, 160)}`
        }
        const c = call as CliCall | undefined
        answers.push({ questionId: q.id, model, run, status, aiHypothesisId, aiSays, validation: null, costUsd: c?.estimatedCostUsd ?? null, latencyMs: c?.latencyMs ?? 0, ...(evidence ? { evidence } : {}), ...(c ? { call: (({ raw: _r, ...rest }) => rest)(c) } : {}) })
        console.log(`${model} #${run} ${q.id}: ${status} ${aiHypothesisId ?? '-'} (${aiSays ?? ''}) $${c?.estimatedCostUsd?.toFixed(4) ?? '?'} ${c?.latencyMs ?? 0}ms`)
      }
    }
  }
  validateRun(runtime, answers)
  const graded = grade(questions, answers)
  writeFileSync(join(out, 'answers.json'), JSON.stringify({ questions: questions.map(({ png: _p, ...q }) => q), answers: graded, summary: summarise(graded) }, null, 2))
  console.log(JSON.stringify(summarise(graded), null, 2))
}
