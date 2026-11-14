# s5311 — evidence questions to a vision model (prepared, not run)

A research harness. It asks a vision model **narrow evidence questions** about published house plans: what fills one
stretch of wall, whether a shape is the publisher's logo, which number is printed on one dimension line. It compares
two ways of showing the region. Nothing paid has run, and no product code changed.

| variant | pictures sent | status |
|---|---|---|
| **B** | picture 1 = the original published plan, unchanged | prepared |
| **C** | the same picture 1, plus picture 2 made from it that points at the region: an enlarged **crop** with a red rectangle (Q1, Q3, Q3B, Q4, Q5, Q6) or a **mask** that fades everything outside the region (Q2) | prepared |
| **D** | a sketch of the region drawn by an image-editing model | **not available**: Claude's Messages API returns only text or JSON, never an image, so this toolchain cannot produce D |

B and C use the same system prompt, the same question text (it gives the region in picture 1's pixels and says what a
further picture is, if there is one), the same JSON schema and the same model. The only difference between them is the
second picture.

## Why nothing was run

There is no API key in this environment, and no billing has been agreed for this experiment. The campaign ledger
(`research/ai-assist/spend-ledger.json`) stands at **2.72807938 USD of its 5 USD limit**, over 92 entries, with billing
UNCONFIRMED. This folder therefore delivers:

- frozen questions and references, sealed before anything was scored;
- the prepared request payloads (kept privately, outside the repository);
- an offline replay path with three synthetic fixtures;
- the scoring;
- a cost and size estimate;
- one command the owner can run on their own host.

## Files

- `questions.json`: 7 frozen questions, their regions and the references. A reference is what the drawing shows,
  written from the sheet. A per-sheet `corrections` list records what changed from the brief after looking at the
  plans. `questions.seal.json` holds its sha256 (`0794ae9e…`). `prepare.ts` and `run.ts` refuse an unsealed or changed
  set.
- `harness.ts`: question text and schema, crop and mask pictures, token and cost estimates, admission, scoring,
  evidence-box checks and `verifiedOnOriginal`. It reuses the product seam in
  `packages/source-vision/src/house-reader.ts`: `StructuredVisionRequest`, `fixtureStructuredVision` and
  `structuredVisionKey`.
- `runner.ts`: writes the payloads, replays them, and runs live. The live path uses `anthropicStructuredVision`
  wrapped in `spendGuardedStructuredVision` (`apps/analyzer-api/src/house-reader-spend.ts`).
- `prepare.ts` and `run.ts`: the command lines.
- `fixtures/`: three **synthetic** fixtures keyed by request hash: `all-correct`, `wrong-hint` (Q1 answered OPEN_GAP,
  Q3 answered 1100) and `all-unknown`. They hold keys and answers only, no pictures, and are never model answers.
- `harness.test.ts` and `vitest.config.ts`: tests on pictures generated inside the test. Run them with
  `npx vitest run -c research/source-to-model/s5311/evidence-questions/vitest.config.ts`. `research/` is outside the
  root vitest include, which is why the folder has its own config.

**Billing class.** Every request goes out with purpose `HOUSE_TRIAGE`, which is the spend books' class for short
questions with a 4096-token answer ceiling. The live adapter sends `HOUSE_TRIAGE` to its triage model slot, and
`run.ts` sets that slot to `--model`.

**An answer is an observation.** Each answer is stored with:
- the model requested and the model served;
- the request key;
- the sha256, size and transform of every picture. A transform maps picture pixels back to the original:
  `x_o = offsetX + x/scale`.

Each answer is scored CORRECT, WRONG or UNKNOWN against the scored fields of its question. UNKNOWN never counts as
correct, and an answer that does not fit the schema counts as UNKNOWN. The evidence box is checked twice: that it lies
inside the picture it names, and that, mapped back to the original, it overlaps the question's region (IoU is
recorded).

`verifiedOnOriginal` is computed locally, never from the reference:
- **Dimension literal:** the chain the package detected inside the region has to split, from its first tick to its
  last, into one span per printed number. Each span's scale (value ÷ pixel span) has to agree with the sheet's
  registration within 3 %. Otherwise the result is VERIFIED or CONTRADICTED, or UNVERIFIED with a reason (no chain, no
  registration).
- **Callout literal:** verified only against an *accepted* local callout reading. None exists for Q4.
- **Class answer:** always UNVERIFIED. No local signal tells a window from a wall, and none was invented.

## The one command, on the owner's host

The command needs Node 22 and `npm ci`, and is run from the repository root. The payloads live in
`/home/user/rd/v35311/api/payloads`. On another machine, first run
`npx vite-node research/source-to-model/s5311/evidence-questions/prepare.ts -- --sources <sources.json> --out <dir>`,
where `sources.json` maps each sheet to its package and byte cache. The key is typed without echo, is never an argument
and never reaches a log. The run uses the campaign's one set of books (default `~/.buildplan/house-reader-books`). Each
request is reserved before it leaves, there are no retries, and a timeout keeps its whole reservation. The run then
appends one entry to the campaign ledger; commit that change. `--max-usd` is what this run may add. Add `--dry-run` to
print the plan and the reserved cost without a key.

bash:
```bash
read -rs ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY; unset ANTHROPIC_BASE_URL
npx vite-node research/source-to-model/s5311/evidence-questions/run.ts -- --payloads /home/user/rd/v35311/api/payloads --mode live --model claude-sonnet-5-5 --max-usd 1 --out /home/user/rd/v35311/api/runs/live-sonnet; echo "exit code: $?"; unset ANTHROPIC_API_KEY
```

PowerShell 7.1+ (on Windows PowerShell 5.1:
`$s = Read-Host -AsSecureString "API key"; $env:ANTHROPIC_API_KEY = [System.Net.NetworkCredential]::new('', $s).Password`):
```powershell
$env:ANTHROPIC_API_KEY = Read-Host -MaskInput "API key"; Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
npx vite-node research/source-to-model/s5311/evidence-questions/run.ts -- --payloads "$HOME\buildplan-private\s5311\payloads" --mode live --model claude-sonnet-5-5 --max-usd 1 --out "$HOME\buildplan-private\s5311\runs\live-sonnet"; "exit code: $LASTEXITCODE"; Remove-Item Env:ANTHROPIC_API_KEY
```

Exit codes: 0 means every request was answered; 2 means the run was asked and stopped (budget, transport or refusal);
3 means nothing was asked; 1 means a crash.

The run writes:
- `observations.json` and `summary.json` (B against C);
- `recorded-fixture.json`, so the same payloads replay offline: `--mode replay --fixtures <it>`;
- `calls.json`;
- `answer-cache/`, keyed by picture sha256, question, schema, model and harness version. A repeated run is answered
  from the cache and books nothing.

## Estimated size and cost (from `prepare.ts`; estimates, not `count_tokens` — no key)

Image tokens are `ceil(w×h/750)`. Every picture is at most 1560 px on its long edge and at most 1.15 MP, so neither
the legacy rule (long edge ≤ 1568 px, about 1600 tokens) nor the 2576-px high-res tier downscales it, and both rules
give the same count. Text is counted at 3.5 characters per token, plus 400 tokens per request. Output is assumed at
600 tokens per question: about 150 of JSON plus adaptive thinking at the default effort. Prices are the list prices in
`HOUSE_READER_PRICES`. "Reserved" is what the books hold back before a request leaves.

| request | pictures (w×h, bytes) | in tok | sonnet-5-5 USD | haiku-5-5 USD | reserved (sonnet) |
|---|---|---|---|---|---|
| Q1-B | original 853×853 GIF, 114 500 | 2113 | 0.0102 | 0.0005 | 0.0560 |
| Q1-C | + crop 288×624 PNG, 13 603 | 2353 | 0.0107 | 0.0005 | 0.0660 |
| Q2-B | original 853×853, 114 500 | 2091 | 0.0102 | 0.0005 | 0.0560 |
| Q2-C | + mask 853×853 PNG, 280 615 | 3062 | 0.0121 | 0.0006 | 0.0660 |
| Q3-B | original 853×853, 114 500 | 2200 | 0.0104 | 0.0005 | 0.0563 |
| Q3-C | + crop 1446×216, 19 079 | 2617 | 0.0112 | 0.0006 | 0.0663 |
| Q3B-B | original 853×853, 114 500 | 2210 | 0.0104 | 0.0005 | 0.0563 |
| Q3B-C | + crop 1446×216, 30 532 | 2627 | 0.0113 | 0.0006 | 0.0663 |
| Q4-B | original 853×853, 110 695 | 2079 | 0.0102 | 0.0005 | 0.0559 |
| Q4-C | + crop 1040×448, 29 013 | 2701 | 0.0114 | 0.0006 | 0.0659 |
| Q5-B | original 853×853, 115 945 | 2199 | 0.0104 | 0.0005 | 0.0563 |
| Q5-C | + crop 1480×168, 22 220 | 2531 | 0.0111 | 0.0006 | 0.0663 |
| Q6-B | original 853×853, 73 713 | 2199 | 0.0104 | 0.0005 | 0.0563 |
| Q6-C | + crop 1488×216, 18 367 | 2628 | 0.0113 | 0.0006 | 0.0663 |

| model | all B | all C | B + C (the experiment) | reserved, B + C | cascade best | cascade worst |
|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 0.072 | 0.079 | **0.151** | 0.856 | 0.052 | 0.131 |
| claude-haiku-5-5 | 0.004 | 0.004 | **0.008** | 0.043 | 0.003 | 0.007 |

The cascade sends one request per sheet with all of that sheet's questions batched (Nigelle carries 4, the other
sheets 1 each), then one C request for each question the first round left UNKNOWN. "Best" assumes none were left
UNKNOWN and "worst" assumes all were.

## What the replay of the synthetic fixtures shows (offline, on the real payloads)

The B and C results are identical in every replay; that only shows the replay plumbing works.

- **all-correct:** 7/7 CORRECT. Q3 and Q3B are VERIFIED by their chains (1400 over 233–642.5 px gives −0.05 %; 474
  gives −2.4 % and 926 gives +0.6 %).
- **Q5:** UNVERIFIED, because the package detected no chain on the Wrotycze top line.
- **Q6:** CONTRADICTED. The Supertunie 2 registration (1.906 cm/px) disagrees with 690 over 305 px (2.262 cm/px,
  +18.7 %). The sheet's own 1350 over about 602 px (2.24 cm/px) agrees with 690, so the **registration** looks wrong
  (its 11.5 m anchor over 602 px suggests 1350 was read as 1150). The check reports the disagreement and does not
  decide which side is at fault.
- **wrong-hint:** Q1 and Q3 are WRONG, and 1100 is CONTRADICTED by its chain (−21.5 %).
- **all-unknown:** 0 CORRECT and 0 VERIFIED.
