# Source, licence and Git-history review — 005R-ROUTER

No publisher text is quoted here. Strings were compared through hashes and lengths in a private file outside Git
(`/home/user/work005r-router/history-quotes-private.json`, scanner `history_scan.py` beside it). **Nothing was
rewritten, force-pushed or filtered. No claim is made that any historical byte has been removed.**

## 1. Publishers this stage touched

| host | 005R status | used by 005R-ROUTER |
| --- | --- | --- |
| www.archon.pl (+ assets, cdn1) | `USABLE_FOR_LOCAL_RESEARCH` — local processing, no redistribution, no remote model; **not** a sublicence | yes: 37 sealed development packages and their cached bytes (offline), the 005R corpus already on disk |
| www.projektydomownowoczesnych.pl | `USABLE_FOR_LOCAL_RESEARCH` (an ARCHON reprint, same edition) | yes: 1 row (`alt-marcowki`) |
| www.dobredomy.pl | `SOURCE_NOT_USABLE` (terms §7.2) | **no**: rows D00–D05, aster-viii, galaktyka are refused by `replay.mjs` although their bytes are cached |
| archipelag.pl, domywstylu.pl | `SOURCE_NOT_USABLE` | no |

**OWNER_DECISION_PENDING:** earlier stages (005C, 005K, 005Q-CHAIN rows D00–D05, aster-viii, galaktyka) processed
DobreDomy pages and images. Whether consent exists is OWNER's question. This review gives no legal advice; it records
the fact.

No pixel was sent to any remote model in this stage. Claude opened no publisher image. The spot-review task list
points at local files only.

## 2. Publisher wording in 005R history (the brief's item)

005R's closing commit `91b4d61` redacted publisher wording from four files. Inventory of the removed quoted Polish
strings (27 occurrences, 6 distinct short marketing / caption phrases of 2–6 words, plus longer reviewer notes that
embed them):

| introduced in | path | category | quoted strings removed by `91b4d61` | still at HEAD in that path |
| --- | --- | --- | --- | --- |
| `c1ab121` | `research/analyzer-005r/current-pipeline-audit.md` | publisher description phrases, interior caption words | 7 | 0 |
| `20fffbd` | `stage-reports/artifacts/analyzer-005r/architecture/audit-raw.json` | reviewer notes embedding description phrases | 18 | 15 lines matched by a 60-character prefix (the lines were rewritten, not all phrases removed) — **needs a per-line check before any action** |
| `4980b95`, `dade188` | `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_VISUAL_ASSET_EXTERIOR_JSON.md` | one draft count sentence (not publisher text) and one phrase | 2 | 1 (the count sentence, not publisher text) |

All of it remains reachable in Git history (`c1ab121`, `20fffbd`, `4980b95`, `dade188` and their descendants on both
pushed branches).

## 3. A larger, older finding: publisher text at HEAD in sealed packages

The same phrases are **at HEAD**, outside 005R, in sealed `source-package.json` evidence files from earlier stages:
35 tracked `source-package.json` files carry publisher captions and `publishedSpecifications` prose (all 35), 3 of them
from DobreDomy. Examples by path (no text): `stage-reports/artifacts/analyzer-005a/before/*`, `analyzer-005b/dev/*`,
`analyzer-005e/holdout/*`, `analyzer-005i/dev/dom-pod-jarzabem/`, `rarytasy-generalization/{pre,post}-fix/`, and the
stage report `STAGE_BUILDPLAN_INTEGRATION_003B_PRODUCT_SHELL_RARYTASY_FIDELITY.md`. These packages are the tested
inputs of earlier stages' regression evidence. Removing them is a decision about other stages' evidence and is not
in this stage's scope.

## 4. Recommendation (for OWNER; nothing executed)

1. Decide first whether short captions, figures and specification phrases in sealed packages are acceptable
   "text facts" (AGENT rules allow titles, URLs, room names and published areas; descriptive prose is a grey zone).
2. If not: a separate, authorised stage replaces committed packages with hash-pinned redacted copies (captions and
   specification text dropped, every hash kept), and re-points the tests that read them.
3. History rewriting (`filter-repo`, force-push) is a separate OWNER decision with real costs (every clone, every CI
   run and every ledger SHA quoted in reports). This stage did not do it, and recommends deciding §4.1 before it.
4. DobreDomy: OWNER confirms or denies consent; until then the three DobreDomy packages at HEAD stay as they are
   and no new DobreDomy byte is fetched.

## 5. OWL-ViT licence wording (carried from 005R)

Code and weights: Apache-2.0 (as 005R recorded). Training-data licences are not stated by the model card; some
named datasets are non-commercial by their own documentation. `LICENSE_UNRESOLVED_FOR_SHIPPING` is a status, not a
finding of a legal prohibition. This stage adds **no** weights and runs no model.
