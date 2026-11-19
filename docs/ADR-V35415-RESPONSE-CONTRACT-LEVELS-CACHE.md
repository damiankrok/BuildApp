# ADR v3.54.15 — one response contract per observation class, levels admitted by the drawing reach the model, measured prompt caching

## Context

v3.54.14 delivered the metric consultant and the automatic sketches, but the coordinator's audit found information that
arrived and was lost: Ballina's elevation tuples parsed to empty lists, its level marks read by the API and used by
nothing (a template datum +15.50 stood for +5,54), sketches accepted without looking at where their openings were, and
LOCAL's readings in an orientation LOCAL itself had rejected shown to the API as LOCAL's claims.

## Decisions

1. **Contract per class.** Dimension observations 1.2.0 (role, `roleFrom`, `ft-in`), elevation sketch 1.1.0 with parser 4
   (object / unambiguous tuple / bare polygon / unknown, a fate for every element, raw kept, unknown fields named,
   response COMPLETE / TRUNCATED / REFUSED / NO_TOOL_CALL). Strict tools on the transport; the schema's numeric and
   length constraints are kept locally. A strict grammar the provider refuses as too large is sent once more without
   strict for that request (recorded as `strictFallback`).
2. **Levels reach geometry only through the drawing.** The API's level marks on a section are admitted by the same
   ladder check as LOCAL's (symbol, ladder, printed zero); they supersede unvalidated template datums and never
   validated ones. Ridge and eaves by role only; a dispute leaves the role unset; an angle witnesses a pitch, never a
   height.
3. **Per-property sketch verdict** (registration, vertical, form, finish); a moved opening refuses the form, not the
   finish.
4. **View registration never loses a view to a new datum.** Side labels bind the side; a view the ridge cannot hang
   falls back to the wall band's corners (positions only). A sill read within the view's ground error does not decide
   door or window.
5. **LOCAL's table shows LOCAL's claims only** (the way up its chain decided; both readings when undecided); vertical
   orientation decided by the ratio to the other axis's scale, not by flipping digits.
6. **Prompt caching opt-in on the host** (`ANALYZER_PROMPT_CACHE=5m|1h`, one breakpoint on tools + system), priced per
   model and TTL (`cost.ts`); replays and accepted-revision reuse stay NOT_SENT at 0 USD.
7. **Fact trace** per API fact to the model parameter and element ids; NOT_CONSUMED is not a closure.

## Consequences

Ballina gains its roof (ridge 5.54 from the section), Murcja (fresh control) its storey heights (2.80 / 4.30 instead of
12.72); Bakopy's model is unchanged, its sketch form refused (openings 0.16–0.57 m off), losing the chimney the
v3.54.14 form gave. Houses without dimension lines (Coastal, Kardamon) still have no model — named, not guessed.
