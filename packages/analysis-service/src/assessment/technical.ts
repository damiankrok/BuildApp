/**
 * N9-01 (A): technical validity of the model the run delivers, from the checks the run already makes.
 *
 *   PROGRAM_REFUSALS  commands of the emitted program the validator refused (the delivered model is the last valid one
 *                     before them: a partial preview)
 *   MODEL_VALIDATION  the delivered model, validated again as a client would load it
 *   COMPILER          `compileBuilding`'s diagnostics, by their own severity (today `run.ts` used to drop them)
 *   CLOSURE           `geometryClosureAudit`'s findings, by their own severity: a WARNING stays a warning
 *   REPLAY            the sealed candidate replays to the model byte for byte (a run that fails it throws)
 *
 * Every number here is about the model alone. 0 ERROR is a necessary condition for a usable model, never evidence that
 * it is the house the drawings show.
 */
import { validateModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { ClosureReport, CompiledScene } from '@buildapp/geometry'
import type { PreviewFailure } from '@buildapp/reconstruction'
import { FINDINGS_LISTED } from './types.js'
import type { TechnicalCheck, TechnicalValidity } from './types.js'

type Finding = TechnicalCheck['findings'][number]

const listed = (fs: Finding[]): Finding[] => {
  const rank = { ERROR: 0, WARNING: 1, INFO: 2 } as const
  return [...fs].sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, FINDINGS_LISTED)
}

const check = (name: TechnicalCheck['check'], fs: Finding[], note?: string): TechnicalCheck => ({
  check: name,
  errors: fs.filter((f) => f.severity === 'ERROR').length,
  warnings: fs.filter((f) => f.severity === 'WARNING').length,
  findings: listed(fs),
  ...(note ? { note } : {}),
})

/**
 * The joint audit graded as the run has always gated it (`verification.closure.exteriorErrors`): an EXTERIOR ERROR is a
 * technical error; an INTERIOR finding (a crack between two partitions inside the envelope) and every WARNING are
 * warnings. Each finding keeps the audit's own severity in its record (`auditSeverity`), so nothing is renamed.
 */
function closureCheck(findings: ClosureReport['findings']): TechnicalCheck {
  const fs = findings.map((f) => {
    const severity = f.scope === 'EXTERIOR' ? f.severity : f.severity === 'INFO' ? ('INFO' as const) : ('WARNING' as const)
    return { code: `${f.scope}_${f.code}`, severity, ...(severity !== f.severity ? { auditSeverity: f.severity } : {}), ...(f.objects[0] ? { objectId: f.objects.join(' + ') } : {}), message: f.message }
  })
  const interiorErrors = findings.filter((f) => f.scope === 'INTERIOR' && f.severity === 'ERROR').length
  return { ...check('CLOSURE', fs), note: `exterior ERROR findings are technical errors; ${interiorErrors} interior finding${interiorErrors === 1 ? '' : 's'} the audit marks ERROR ${interiorErrors === 1 ? 'is' : 'are'} counted as warnings (inside the envelope, not seen from outside), with the audit’s severity kept on each` }
}

export function technicalValidityOf(input: {
  model: CanonicalBuildingModel
  scene: Pick<CompiledScene, 'diagnostics'>
  closure: Pick<ClosureReport, 'findings'>
  refusals: readonly PreviewFailure[]
  replay: 'BYTE_IDENTICAL'
}): TechnicalValidity {
  const validation = validateModel(input.model)
  const checks: TechnicalCheck[] = [
    check(
      'PROGRAM_REFUSALS',
      input.refusals.map((f) => ({ code: f.codes[0] ?? 'REFUSED', severity: 'ERROR' as const, ...(f.id ? { objectId: f.id } : {}), message: f.message })),
      input.refusals.length > 0 ? 'the delivered model is the last valid one before these commands; they are not built' : undefined,
    ),
    check(
      'MODEL_VALIDATION',
      validation.issues.map((i) => ({ code: i.code, severity: i.severity === 'ERROR' ? 'ERROR' : 'WARNING', ...(i.objectId ? { objectId: i.objectId } : {}), message: i.message })),
    ),
    check(
      'COMPILER',
      input.scene.diagnostics.map((d) => ({ code: d.code, severity: d.severity, ...(d.objectId ? { objectId: d.objectId } : {}), message: d.message })),
    ),
    closureCheck(input.closure.findings),
    check('REPLAY', [], input.replay === 'BYTE_IDENTICAL' ? 'the sealed candidate replays to this model byte for byte' : undefined),
  ]
  const errors = checks.reduce((a, c) => a + c.errors, 0)
  const warnings = checks.reduce((a, c) => a + c.warnings, 0)
  return {
    status: errors === 0 ? 'VALID' : 'ERRORS',
    errors,
    warnings,
    checks,
    note: errors === 0 ? 'technically valid: no validator, compiler or closure ERROR. This is about the model alone, not agreement with the drawings.' : `${errors} technical ERROR${errors === 1 ? '' : 's'}: the model is shown, but parts of it are not what its own program states (named per check)`,
  }
}
