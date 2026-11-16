# PROTOCOL_V3542: the API as consultant and controller of the analyzer

Sealed before the first API call of v3.54.2 (2026-11-16). The seal is the SHA-256 in `PROTOCOL.seal`. Any change after sealing is an addendum below the line, with its time and reason.

## 1. Roles and the path under test

- **The analyzer (LOCAL)** builds every model: sources, frames, readings, metric, plan, model, compiler.
- **The consultant (Claude API)** is asked about one problem the analyzer could not settle and proposes typed, bounded corrections.
  - It is never shown a reference and never asked to describe the house.
- **The loop** (`packages/analysis-service/src/consult/`) does the rest:
  - selects the problem from the analyzer's own evidence;
  - executes the consultant's tool requests from frozen bytes;
  - validates proposals;
  - re-runs the analyzer with the accepted ones;
  - keeps or rolls back the result.
- **The global house-description branch (B/H1, `analyseLink` + `houseReader`) is not on this path.**
  - `consultAnalysis` never receives a `houseReader`.
  - Every run records `PATH CONSULTANT globalDescription DISABLED` as its first event.
  - The ablation in §7 checks that the analyzer with the consultant off is byte-identical to the stage-A baseline.

## 2. Base

| Item | Value |
|---|---|
| Code base | `b740118` (v3.54.1 head + the v3.54.2 scorer) |
| Analyzer | service 1.11.0, solver 2.43.0 |
| Model | `claude-sonnet-5-5`, the same model as the v3.54.1 reader; list price 2 / 10 USD per MTok, checked against the claude-api reference on 2026-11-16 |
| Default behaviour | unchanged: the consulted readings and the cross-axis rule run only when passed explicitly (`AnalysisOptions.consulted`, `crossAxisWitness`) |
| Sources | the sealed v3.54.1 packages and byte caches (`research/source-to-model/v3541/sources/`, `INDEX.json`), never refetched |

Stage-A LOCAL on the sealed bytes reproduces v3.54.1 byte for byte:

| House | Stage-A result |
|---|---|
| Kukliki | model `2d6e919f3dbc476d` |
| Madera | model `12c9ace7da67f8d1` |
| plan23-504 | model `ad95fc778eb767f7` |
| Torenie 3 | model `4ab60f281626b257` |
| Supertunie 2 E | refusal `RECONSTRUCTION_FAILED/PLAN_NO_WALLED_ENVELOPE` (`METRIC_RESOLUTION_INCONCLUSIVE`), the same message as v3.54 |
| plan5-737 | refusal `PLAN_NO_DIMENSION_FRAME` |

## 3. Sets

### DEV (6, three publishers, three non-ARCHON)

| House | Publisher | Stage-A LOCAL | Role in the pilot |
|---|---|---|---|
| Kukliki | archon | model, size OK, IoU 1.00, ridge ✓ | correct model to protect (control) |
| Supertunie 2 E | archon | refusal: scale not settled | numeric case: refusal |
| Torenie 3 | archon | model, size NEAR (width −6.5 %), IoU 0.85 | outline case |
| Madera | domywstylu | model on the published-area fallback, width −31 %, IoU 0.38 | numeric/outline, non-ARCHON |
| plan23-504 | monsterhouseplans | model, size OK, IoU 0.65, no main roof planes | roof/orientation, imperial |
| plan5-737 | monsterhouseplans | refusal: no dimension frame (0 labels read on ft-in) | imperial units, refusal |

The brief calls plan5-737 "Houseplans"; its sealed page is monsterhouseplans.com.

### Stage B, first three (chosen before any call)

1. Supertunie (numeric, refusal, ARCHON).
2. Kukliki (control).
3. Madera (outline and decimal-metre labels, non-ARCHON).

### CONFIRM_KNOWN (4)

The rule was fixed now: for each publisher of the sealed FINAL-12 draw, the lowest draw order not in DEV. That gives:
- archon: Aksamitki (order 1);
- domywstylu: Puszek (order 0);
- monsterhouseplans: plan63-411 (order 1);
- houseplans: sp318422 (order 0).

These are four families, four publishers and three non-ARCHON houses. They were all analysed in v3.54.1, so the set is CONFIRM_KNOWN, not FRESH. Their v3.54.1 results are known, which is why the selection is mechanical. None of them is used to tune anything.

## 4. Consultation contract

### Problem selection

Only from the analyzer's evidence (`problems.ts`): the selected plan frame's labels are asked about when either holds:
- no reading of the ink is CLEAR;
- the frame's metric solution names a reading of it as a conflict or as a witness.

The selection skips frames whose scale is STRONG/SUPPORTED with CLEAR primaries. It orders by bound span and takes at most 10 labels.

### Steps (one round)

1. **Literal reading.** The consultant sees the overview with the boxes and the crops. No local reading, span or scale is shown. It may call `get_source_region`.
2. **Context.** The consultant sees the readers' readings, spans, implied scales and the scales the frame weighed. It answers again; both answers are kept.

### Answer and proposal

The answer is `submit_review` (status VERIFIED_IN_SCOPE / ISSUE_FOUND / NEED_EVIDENCE / UNKNOWN; observations, requestedEvidence and proposedCorrections kept separate; checked / notChecked).

A proposal carries:
- proposalId and baseRevision (the metric evidence hash, 12 hex);
- the operation and targetId;
- the literal with its unit and reading direction;
- evidence regions, justification, alternatives, uncertainty and expected effect.

### Consumer (one family with a consumer)

- **READ_LABEL**: the literal becomes a consulted reading of that label's lattice (`source-metrics/consulted.ts`), parsed by the analyzer's own parser.
  - It is SUPPORTED, or CLEAR only when a confident second reader of this run read the same literal (005H's AGREES standard).
  - The old reading stays a full-strength rival.
  - The scale is still decided by the metric resolver from the chains.
- **The solver's cross-axis rule** (`crossAxisWitness`) applies only on candidate runs. It is measured separately as A′ (§7).

### Validator

The validator **rejects**:
- a duplicate proposalId or duplicate target;
- an unknown target;
- a stale revision;
- a literal that is not digits with at most one separator;
- a unit mismatch (cm with a separator, m without);
- evidence from a foreign source;
- a direction for which the label has no reading.

It **records as CAPABILITY_MISSING** (never applied):
- a feet-inch literal;
- any operation other than READ_LABEL.

It **holds** a HIGH-uncertainty reading: recorded as a hypothesis, never applied.

### Transaction

The steps are: snapshot → validate → candidate (same frozen package and graph) → recompute (full pipeline) → compare → ACCEPT / ROLLBACK / PARTIAL / NO_CHANGE.

`compareRuns` rules:
- **refusal → model**: ACCEPT only on a scale the readings settle (SUPPORTED or STRONG).
- **model → refusal**: ROLLBACK.
- **model → model**:
  - ACCEPT when the scale becomes settled;
  - ROLLBACK when a settled scale moves by more than 3 %, or the scale becomes less settled.
- **refusal → refusal**: PARTIAL when the scale became more settled. The readings carry into round 2, and the result stays LOCAL's.

### Limits and stop

- At most 2 rounds per house that may change the model.
- At most 4 evidence requests per round.
- 1 transport retry.
- At most 6 turns per step.
- A consultant failure leaves LOCAL's result.

### Post-build check (4B)

After the final state, if there is a model, the consultant sees:
- the selected plan;
- the package's elevation drawings, as they are;
- the model's nine views (front, right, rear, left, top, four axonometrics).

It answers with observations and proposals of the families ASSIGN_VIEW, ROOF_FORM, OUTLINE_REGION, OPENING and MISSING_ELEMENT. None has a consumer in the pilot: they are recorded as CAPABILITY_MISSING and form CAPABILITY_GAPS.md.

## 5. Evaluation

The scorer is `research/source-to-model/v3542/score.py`. Its self-test passed before any result (13 checks + 9 roof checks).

| Check | Rule |
|---|---|
| Size | per axis, model-own scale, OK ≤ 3 % < NEAR ≤ 10 % < WRONG |
| IoU | fixed frame: front-left corner alignment only; no rotation or translation search |
| Mirror | diagnostic only |
| Ridge | `roof_axis.py`, RIDGE edges first; a hip is not a wrong ridge |
| Refusals | counted, never averaged away; the common group and N always stated |

Additional checks:
- per proposal: the raw read against the source; the applied value; the model value; the scene effect; the first loss point (brief §9);
- false alarms on the control;
- cost per house and per accepted improvement.

References:

| Reference | Sealed hash file | Hash of that file |
|---|---|---|
| Hash files of the refs | refs-final.sha256 | `2ab08fc7…` |
| | refs-v354.sha256 | `89dab282…` |
| | refs-s53.sha256 | `3bcc15ca…` |

The references are unchanged and never sent to the API.

## 6. Budget

- **Books:** `/home/user/rd/v3542/books`, opened at 4.11036 USD (the v3.54.1 usage-priced total, carried, not zeroed). The S53 CLI estimate of 2.72807938 USD stays separate.
- **Ceilings (cumulative):**

  | Scope | Ceiling |
  |---|---|
  | First recognition (stage B) | 9.11036 USD (+5) |
  | Whole pilot plus confirmation | 24.11036 USD (+20) |
  | Project | 100 USD |

- **Bookkeeping:**
  - Every request is reserved before sending: pictures × 2600 tokens, text at 2.5 characters per token, and the full output ceiling of 8000 tokens.
  - Every request is settled to its usage.
  - Every request gets a ledger line (`research/ai-assist/spend-ledger-v3542.json`) with requestId, model, usage and cost.

## 7. Variants and ablations

| Variant | What it is |
|---|---|
| A | LOCAL, consultant off (stage A) |
| A′ | LOCAL + cross-axis rule, no consultation (isolates the solver change) |
| R | the consultation recorded, never consumed |
| C | consumed, at most 2 rounds |

On the control and on any house where C changes the model, R and C share step 1 by replay of the recorded answers (`consult-run.ts --replay`), so that C is R's answers consumed. A fresh call is made only where R did not exist. Confirmation runs C once, with the frozen candidate.

## 8. Counter-trials

Counter-trials use recorded answers modified offline and are marked SYNTHETIC:
- a wrong digit;
- a wrong unit;
- a stale revision;
- a repeated proposalId;
- an unknown target;
- a foreign evidence source;
- a reading the wrong way up;
- a HIGH-uncertainty reading;
- a timeout or transport failure (with a single retry);
- no network / no key.

Brief items without a consumer in the pilot are recorded as not testable:
- a false porch closure;
- an L/R swap;
- another storey.

---
Addenda (after sealing): none yet.

## Addendum 1: candidate frozen before stage D (2026-11-16, after stage C)

The changes made during development on DEV (stages B and C) are logged in INTERVENTIONS.md and CAPABILITY_GAPS.md. The frozen candidate is the commit that carries this addendum:

| Component | Frozen version |
|---|---|
| Contract | 0.1.0 |
| Prompt | 0.2.0 (READ_LABEL + READ_DIMENSION) |
| Model | `claude-sonnet-5-5` |
| Consumers | `metrics.consulted-reading` 0.1.0; `metrics.consulted-spans` 0.1.0, with snap ink < 200, the line-end fallback (line ink < 235), search ±12 px and the two-line agreement within 3 %; the cross-axis rule (candidate runs only) |
| Transaction | `compareRuns` gains one rule: the same model whose scale becomes settled is ACCEPT, verified rather than changed |
| Loop | problem selection drops inks already consulted; proposal ids scoped per round |
| Limits | 2 model-changing rounds; 4 evidence requests per round; 1 transport retry; 6 turns per step |
| Budget | ceiling 24.11036 USD cumulative (books at 5.608742 when frozen) |

The DEV results of this candidate come from the recorded stage-C answers, consumed by the frozen code. That is round 1 only (`consult-run.ts --replay C2 --max-rounds 1`): round 1's question is identical under both codes, so no answer is applied to a question it was not given.

Stage D runs once, live, with this candidate, on CONFIRM_KNOWN (Aksamitki, Puszek, plan63-411, sp318422). Nothing is changed after its result is seen.
