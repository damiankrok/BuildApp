# v3.54.1 protocol — written before any live API call, any C/H run and any run on the final sample

Written 2026-11-16 on branch claude/new-session-3kzcgh @fca6dad. Production code = 133df81 (= v3.54 production 226c9ac
plus the live adapter's usage/raw fields; the only behavioural change: an answer that is not JSON or cut at max_tokens is
refused by name as NO_ANSWER and booked at its usage). Brief: BuildPlan_Prompt_Claude_v3.54.1_Hybryda_API.md; Master Plan
v3.54.1 at docs/MASTER_PLAN.md (sha256 39b94331…).

## 1. Sets

S30 — the 30 projects of v3.54 (set.txt + fresh.txt of /home/user/rd/v354), with their original history labels
(DEV 13 / HELD 10 / FRESH 7). FRESH and HELD are KNOWN sets now: A and V1 results of all 30 were read in v3.54. S30 is
development, comparison and regression; nothing measured on it is called blind.

PILOT 4 (from S30, chosen from source properties recorded in v3.54, before any live answer):
- projekt-dom-w-toreniach-3-e (ARCHON; LOCAL builds a complete-looking but wrong model: ~85 % of the closed outline);
- lipinscy-pl-2 (other publisher, plan prints dimension lines: 11 linear dimensions read by LOCAL);
- houseplans-com-2 (imperial ft-in labels; 0 linear dimensions read by LOCAL);
- domoweklimaty-pl-1 (plans print no dimension lines).
Pilot purpose: transport, schema, cost per house, answer completeness. Ceiling 5 USD cumulative.

C12 (from S30; chosen now, before any B/C difference is known, by source features recorded in the references):
pilot 4 + projekt-dom-w-nigellach-4-g2 (hip, four chimneys, LOCAL area false positive), fresh-piwonie-3-g (hip, 330/230
front glazing, named in brief §8), fresh-saponarie-g2e (hip, 400/230 rear slider, two wings), fresh-sa-awans-ii (full-length
glazed niche, logo banners), fresh-sa-amber-xi (gable along front, wide living glazing, deck), architecturaldesigns-com-2
(imperial), extradom-pl-2 (aggregator page, watermark/logo), dobredomy-pl-2 (plans with small text). C = same model,
same questions, same source bytes as B, plus crops/aux layers chosen by a fixed rule (written before C is built: §4).

FINAL 12 — new projects, drawn by draw.py (seed sha256('fca6dad'+'BUILDPLAN-V3541-FINAL'), recorded in final-draw.json):
- archon.pl 3 (pool: current sitemap less every family analysed, drawn or used as regression before: 628 families),
- domywstylu.pl 3 (NEVER used before; wholly held out from development and tuning),
- monsterhouseplans.com 3 (NEVER used before; wholly held out; ft-in),
- houseplans.com 3 (known publisher, new plans; ft-in; v3.54 pages excluded).
Four publishers, two of them never used for tuning; metric and imperial; one family per draw. A candidate is taken in
draw order if its page passes the availability rule (avail.py; source metadata of the product's acquisition only:
package acquired, >= 3 decoded pictures with short side >= 200 px, >= 1 published numeric figure — amended from
"area figure" before its first application, because US pages publish building dimensions, not areas). Every skip is
logged with its reason (acquire-log.jsonl). No analyzer, no AI reader and no strategy is run on FINAL 12 before the
candidate is frozen (§6). Same-design check for the US plans: a drawn plan whose published width, depth and height all
equal those of a US page of S30 within 1 % is replaced by the next in draw order (logged).
Rejected publisher: z500.pl (HTTP 403 to automated access; recorded, not worked around).

## 2. Budget and books

- Key only from BUILDPLAN_ANTHROPIC_API_KEY (environment setting), explicit host https://api.anthropic.com; never printed,
  never in a file, argument, ledger, ZIP, APK or Git (scrubbed from every output; self-check 15/15).
- Models: description claude-sonnet-5-5, triage claude-haiku-5-5 (model IDs from the official model list; availability
  checked by check-key.ts before the first billed call). A stronger model only on a small hard subset, if needed.
- Prices (official pricing page, read 2026-11-16, USD per MTok): Sonnet 5.5 2 / 10, Haiku 5.5 0.10 / 0.50. Cost = usage
  priced at list price ("USAGE_PRICED"), not an invoice.
- Ceilings, cumulative in the campaign books (/home/user/rd/v3541/books), in USD with 1 EUR = 1.00 USD (USD < EUR, so the
  USD figure is the stricter): pilot 5, development 20, acceptance 45. 100 EUR is the OWNER's authorised ceiling; whether
  it is a balance, a monthly limit or a shared budget is UNKNOWN to this session (no admin access) — reported as such.
- Reservation before every request (pictures at 5000 tokens each, question at 2.5 chars/token + 1500, answer at its
  max_tokens); settled to usage; a timeout keeps its reservation. One request at a time; no SDK retry; a house whose
  answers are recorded is never asked again (identical question, model and bytes).
- The S53 history (2.72807938 USD / 92 CLI_TOKEN_ESTIMATE entries) stays a separate unreconciled record; it is not
  subtracted and does not block.

## 3. Strategies

A — LOCAL production (v3.54 results on S30; on FINAL 12 run once, at acceptance).
B — live: the product's runDescribedAnalysis (sorting + one whole-house description + checker + builder + compiler),
    no drawings-path anchor. Answers recorded (answers.json, raw.jsonl).
C — B's model and questions over B's bytes plus crops/aux layers (§4).
H — a hybrid consumer over the SAME recorded B/C answers plus confirmed LOCAL data (scale/overall from read dimension
    chains, storey registration, roof axis per property), entering before the decision it changes; behind a flag; measured
    first on recorded answers so a scene change is the consumer's.
Order on S30: pilot B → B on all 30 → C on C12 → H development on S30 (DEV only for tuning: S30 is DEV for H) → freeze H
→ FINAL 12: references first, then A, B (live), C if C was kept, H.

## 4. C rule (fixed now)
Per sent plan/elevation: the whole picture at the product size + up to 2 crops chosen by a deterministic rule on the
picture itself (the densest text band and the largest dark-line bounding box at ≤ 1568 px long edge), each with an
explicit transform (scale, offset, rotation, mirror) recorded and inverted for every coordinate in the answer. No
watermark removal. One request per house (no per-opening questions); at most one follow-up question naming a concrete
uncertainty, without suggesting the answer.

## 5. Metrics (per house, refusals in every denominator; never averaged without N)
- S1 outcome MODEL / PARTIAL / refusal + first cause.
- Scale: W, D vs printed overall (sizeErr = max relative error of sorted W,D): OK ≤ 3 %, NEAR ≤ 8 %, WRONG > 8 %;
  missing/conflicting anchor named.
- Outline (where the reference has a polygon traced from printed chains): model ground enclosed polygon in the MODEL's own
  scale (never refitted), registration = one of 4 rotations + translation (search ±1.5 m, 0.05 m), no mirror;
  IoU, missing area (ref − model) and excess area (model − ref) as % of ref area, mean boundary distance (m).
- Open zones (driveway/terrace/loggia/carport/porch): present, open, enclosed-by-mistake.
- Storeys: full storeys above ground (+ habitable attic allowed as a level); correct plan-to-storey registration.
- Roof: main kind, ridge direction relative to front per main body, assignment to bodies.
- Openings: count ratio (0.7–1.3 OK) and per facade where the reference counts per facade.
- Rooms: polygons, merges, missing, label assignment (secondary this stage).
- Compile errors, save/reload, quantity usefulness range; API cost, latency, total p50/p95, memory, calls, user questions.
Reference error (frozen): printed dimension read ±0.01 m; polygon vertex from a printed chain ±0.05 m; vertex traced
without a printed chain ±5 % of the side and flagged; a property the source does not show is UNKNOWN and scored as
not comparable.

## 6. Acceptance thresholds (frozen; never lowered after results)
Per house, improved = one of: size band rises (WRONG→NEAR/OK or NEAR→OK); IoU +0.05 or more; missing+excess area down
≥ 10 points; ridge direction becomes right; storeys become right; refusal → model with size not WRONG.
Critical regression = any of: model lost; size band falls to WRONG; IoU −0.05 or worse; a wing lost (missing area up
≥ 10 points); an open zone enclosed; ridge becomes wrong; a new compile error.
Stage target (brief §9): real improvement of final scenes in held-out families of ≥ 2 publishers of FINAL 12, from more
than one mechanism, no new critical regression on S30 or FINAL 12, consumed by the full production path. Otherwise the
measured, bounded improvement stays a flagged candidate/pilot with its scope stated.
References: FINAL 12 references are made from source pictures only, before any strategy runs on them, by a reader that
sees no analyzer output; the same AI family as B (correlated-error risk, named): printed text, chains and plan geometry
are the evidence, spot-checked by the executor on ≥ 6 houses; corrections are shown separately, never fitted to a candidate.

## Addendum 1 (sealing of FINAL 12; acquisition metadata only, no analyzer output read)
- Monster House Plans: 2 of the first 12 drawn pages passed the availability rule (most pages give the product's
  acquisition no picture at all — a product finding, reported as such); its draw order was continued with the same seed
  up to 30 candidates (amendment recorded in draw.py before continuing); the 3rd passing page was candidate 17. 18 pages
  were acquired for it in total; 15 skipped (FEWER_THAN_3_PICTURES), each logged.
- ARCHON, domywstylu and houseplans: the first 3 drawn pages of each passed.
- Same-design check (same_design.py): none of the 6 US plans matches a US page of S30 (14 pages) on published
  width, depth and height within 1 %.
- FINAL 12 (final-sample.txt), one family each:
  archon: dom-w-kuklikach (ver. 2), dom-w-aksamitkach (2 ver. 2), dom-pod-sakura (E);
  domywstylu: puszek (_2_dr-t), madera, miodowy (_2);
  monsterhouseplans: plan23-504, plan63-411, plan5-737;
  houseplans: sp318422, sp324651, sp368685.

## Addendum 2 (2026-11-16T10:20:05Z) — candidate frozen before FINAL 12 is opened
- Frozen code: 0c11cd03273c016d38502f3332a4089e4dc67048 (branch claude/new-session-3kzcgh). Candidate H1 = analyseLink with readEveryModel (host switch
  ANALYZER_HOUSE_READER_EVERY_MODEL=on), floor-to-floor storey height, per-axis hold of a measured complete outline
  (builder 0.8.0), reader 0.3.0 (description through one non-strict answer tool), admission 0.2.1. P1 = the same code
  with readEveryModel off (the host default).
- Not adopted: C (crops). On C12 its differences from B fall within B's own run-to-run spread, measured by repeating B
  on 4 houses (IoU 0.94 vs 0.79 on one house, size band NEAR vs WRONG on another, a model vs a refusal on a third).
- DEV result (S30, read before this freeze): H1 vs the production path before this stage (P0): 1 improved
  (Torenie 3 E: size NEAR→OK, IoU +0.13), 0 critical regressions; H1 vs A: 17 improved, 4 critical regressions (all on
  LOCAL models without a verified scale, which P0 already describes).
- FINAL 12 now: references were sealed before (refs-final.sha256); B live once per house (development ceiling,
  cumulative 20 USD); A = LOCAL alone; P1 and H1 replay B's recorded answers through analyseLink. Thresholds of §6
  unchanged. The baseline for "improvement" is A: before this stage the live reader refused every description
  (compiled grammar too large), so the product's scene was LOCAL's.
