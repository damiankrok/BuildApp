# v3.54.10 — the one live Marcówki job: plan stated before it runs (2026-11-18)

Build: 397a809 (apps/analyzer-api dist from that revision). Host data dir fresh: /home/user/rd/v35410/host-data (no accepted revision to reuse).
Books before: 23.2994 of 24.11036 USD (0.81096 left). Host ceiling --max-usd 24.0994 on --spent-usd 23.2994: the job can spend at most 0.80 USD;
the host refuses any request whose reservation would pass the ceiling (a refused DETAILS / STOREY is recorded absent, a refused REVIEW round ends the review as NOT_SENT).

Requests, in order (Sonnet 5.5 rate 2 / 10 USD per MTok; reservation = estimated input + the step's full output limit):
1. INVENTORY — page pictures as thumbnails (~0.043 reserved in v3.54.9)
2. PLAN — ground plan (detail) + upper plans (context) (~0.075)
3. FACADES — ground plan, section, 4 elevations (detail), 2 views (~0.146); follow-ups only for an elevation left undescribed (≤4, none in v3.54.9)
4. DETAILS (new) — the 4 elevations as sent to FACADES, with the openings listed by stable id (~0.11)
5. STOREY ground (new) — ground plan (detail) (~0.09)
6. STOREY attic (new) — first upper plan (detail) (~0.09)
7. REVIEW round 1 — 4 elevations + 4 side renders in their frames + ≤3 close-ups + storey plans beside the model's storey cuts + ≤4 plan-callout crops + SIDES/AROUND renders (~0.13)
8. REVIEW round 2 — as round 1 without the storey/callout packets (~0.12)
Sum of reservations ≈ 0.80–0.89 USD: above 0.80 only if every request settled at its full reservation; expected spend ≈ 0.55–0.65 USD.
If the ceiling is reached, what is cut is the last review round (named in the report as unverified scope), never the new-field reads.
Then two repeat jobs on the same URL (expected 0 USD: the accepted revision reused) and one job without the token (no requests).
