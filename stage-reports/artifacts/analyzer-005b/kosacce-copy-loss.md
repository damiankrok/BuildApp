# Kosaćce tracked link — the phone's copy loss (BUILDPLAN-ANALYZER-005B §25)

Bounded investigation. Text facts only; no page or drawing is stored.

## The question

005A: on the OWNER's phone the tracked Kosaćce link produced a package with **one** ground-plan
copy (the area table); on the desktop the same link produces **four** (853 px dimensioned, 853 px
area table, 550 px, 400 px). 005A could not observe why and made the acquisition record every lost
plan address with the role it claimed.

## What was compared (offline, same bytes)

The page and every drawing, as the desktop fetched them for this stage's baseline, acquired again
offline by the production `acquireSourcePackage` with both production adapters, under three
runtimes:

| runtime | text support | `Intl` | package content hash | assets | floor-plan copies | failures |
|---|---|---|---|---|---|---|
| Node 22, desktop | ICU | present | `9cb4f5207c0e…` | 31 | 4 | 12 (7 `OFFLINE_CACHE_MISS`, 5 `BYTE_IDENTICAL`) |
| Node 22 with ICU removed as on Android (`test/support/no-icu.cjs`) **and** the phone's text adapter | embedded tables | absent | `9cb4f5207c0e…` | 31 | 4 | 12, same codes |
| the same bare runtime **without** the adapter | none | absent | `4e3c1bd3a03d…` | 31 | 4 | 12, same codes |
| Node 22, desktop, the clean link | ICU | present | `9cb4f5207c0e…` | 31 | 4 | 12, same codes |

- The seven `OFFLINE_CACHE_MISS` are the resolution convention's guessed larger copies, which the
  live fetch was refused (HTTP 404) and so never cached; the five `BYTE_IDENTICAL` are copies the
  publisher serves twice. Neither is a plan copy lost.
- **With the phone's text adapter, the phone's runtime makes the desktop's package, byte for byte.**
  Without it the package differs (ordering and names), but no copy is lost either.

## Conclusion

The copy loss is **not** in how the acquisition orders, folds or names text, nor in the tracked
query: the same bytes give the same four copies under every runtime the phone can be in. What
remains is the network the phone saw (a fetch that failed, timed out or was cut by the size limit on
a mobile connection), which cannot be reproduced from here. Per the stage brief, **no fix is
invented**.

## What 005B adds

- **A sealed parity test** (`apps/local-analyzer/test/source-parity.test.ts`): a page in the
  publisher's shape built in the test — four copies of one ground plan, an attic plan, a section
  named only by its diacritic caption — acquired on the desktop runtime and on the phone's runtime
  with its text adapter must give the same floor-plan copies, roles, failures, published facts and
  content hash; a control shows the bare runtime does not, so the parity is the adapter's. It runs
  in CI (`Analyzer / dimension evidence`, source parity).
- **Diagnostics that name the dropped copy**: every lost floor-plan address in the phone's
  diagnostics bundle now carries the publisher's file name, the acquisition stage and the failure's
  own words, besides its code and claimed roles (`packages/analysis-service/src/diagnostics.ts`,
  `LostPlanAddress`). The next phone run that keeps one copy of four says which three it dropped and
  why.
