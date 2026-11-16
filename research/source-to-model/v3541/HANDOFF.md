# v3.54.1 campaign — hand-off for the next session (text only; no key, no publisher image)

Why a next session: the OWNER's key reaches a cloud session only as an environment variable set BEFORE the session
starts (the environment's network-secret form refuses api.anthropic.com), and a new session runs on a fresh machine:
everything outside Git (/home/user/rd) is gone. This folder holds what is needed to continue on the same bytes.

## 0. First steps in the new session
1. Presence only, never the value: `[ -n "${BUILDPLAN_ANTHROPIC_API_KEY:-}" ] && echo present || echo absent`.
2. `npx vite-node research/source-to-model/v3541/check-key.ts` — lists models (not billed); exit 0 = usable.
3. Restore the sealed bytes (≈200 MB, every picture verified against its recorded SHA-256):
   `python3 -I research/source-to-model/v3541/restore.py /home/user/rd/v3541/restored`
   Houses with CHANGED/GONE pictures are listed in restored/restore-report.json — report them, never substitute.
4. Lists for the runner: `python3 -I research/source-to-model/v3541/lists.py /home/user/rd/v3541/restored/cache pilot > pilot.txt`
   (also `s30`, `c12`, `final`). Pilot = projekt-dom-w-toreniach-3-e-me822857280738, lipinscy-pl-2, houseplans-com-2,
   domoweklimaty-pl-1.
5. Pilot, ceiling 5 USD cumulative:
   `npx vite-node research/source-to-model/v3541/live-describe.ts -- --list pilot.txt --out /home/user/rd/v3541/B --books /home/user/rd/v3541/books --phase pilot --max-usd 5`
   Then B on all S30 with `--phase development --max-usd 20` (the books are cumulative; recorded houses are not asked again).
   Ledger: research/ai-assist/spend-ledger-v3541.json (commit it; it holds no key).

## 1. What is here
- campaign.ts, check-key.ts, live-describe.ts, campaign-run.ts, recording.ts, selfcheck.ts — the live runner and its
  offline self-check (15/15 on 2026-11-16: replay = live hashes, ceiling stops before sending, unusable answer booked at
  usage, transport keeps its reservation, the key reaches no file or line).
- sources/ — the 42 sealed source packages' metadata (30 S30 + 12 FINAL; URLs, roles, published facts, byte hashes;
  no image bytes) and INDEX.json (set, history label, publisher, content hash).
- restore.py — rebuilds the byte cache from the public URLs, keeping only hash-identical bytes.
- refs-s30/ — the 18 v3.54 references (sealed hashes refs-v354.sha256) + refs-s53.sha256 for the 12 S53 references
  committed in research/source-to-model/s53/reference*/ (identical, checked).
- refs-final/ — the FINAL 12 references, made from source pictures only before any strategy ran on them.
- v354-tools/ — the v3.54 scorer and tables (extract.py, score.py, table.py, gate.py, cmp.py, printed.py,
  report_tables.py, export_pics.py, make_board.sh; table-A-B.json, table-A-V1.json; A-hashes.json = the v3.54 A model and
  scene hashes per house, for a determinism check when A is re-run on restored bytes). Their paths point at
  /home/user/rd/v354; set R / REFS accordingly.
- stage-reports/artifacts/v3541/ — PROTOCOL_V3541.md (sealed; PROTOCOL.seal) and the FINAL 12 draw.

## 2. State at hand-off (2026-11-16)
- No billed call made; campaign ledger not yet created; books not opened.
- FINAL 12 sealed and NOT opened: no analyzer, reader or strategy has run on it. Keep it closed until H is frozen.
- Order (protocol §3): pilot B → B on S30 → C on C12 → H development on S30 → freeze H → FINAL 12 (A, B, C if kept, H).
- Restore check on 2026-11-16 (all 42): 1402 pictures byte-identical, 9 republished, 0 gone. Changed: a shop badge GIF
  on the 3 architecturaldesigns pages (not a drawing); extradom thumbnails of one design on extradom-pl / extradom-pl-2
  (235x157, 328x202, 656x404 sizes); and ONE drawing — architecturaldesigns-com-2 "850063PKE-F2-Bonus-Second-Floor.gif"
  (995x800 GIF, 106833 → 106841 bytes, re-encoded by the CDN). Those 3 houses do not run on the sealed bytes unless the
  changed pictures are restored with `--allow-changed`, and must then be reported as such.
- FINAL 12 references written 2026-11-16 by four source-only readers (no analyzer output), hashes in
  refs-final/refs-final.sha256. 11 of 12 have a ground polygon; houseplans sp324651 prints no overall dimension (W×D and
  polygon null). Outlines of monster plan23-504 and plan63-411 are TRACED at a scale from room labels (no overall printed):
  scored at the ±5 % reference error of the protocol. domywstylu miodowy is a semi-detached PAIR (published figures are one
  unit; the reference outlines the pair). Executor spot-check on ≥ 6 houses (protocol §6) still to do, before FINAL 12 opens.
- Findings so far: monsterhouseplans.com gives the product's acquisition no picture on most pages (15 of 18 drawn);
  z500.pl refuses automated access (403).

## 3. Final state (2026-11-16, end of v3.54.1)
- The key WAS used in this session (OWNER's decision); it lived in /root/.config/buildplan/campaign-key (outside Git).
  A new session needs it again as BUILDPLAN_ANTHROPIC_API_KEY; the OWNER was advised to revoke the pasted one.
- Spent 4.11036 USD usage-priced (ledger in research/ai-assist/spend-ledger-v3541.json); books in /home/user/rd/v3541/books.
- Done: pilot, B live on S30 and FINAL 12, C on C12, B repeat (variance), H0, H1 (S30 + FINAL), P1 (FINAL), A (FINAL),
  report stage-reports/SOURCE_TO_MODEL_V3541.md, private ZIP /home/user/BuildPlan-V3541-Private.zip (not in Git).
- FINAL 12 is now OPENED: any change tuned on its errors makes those houses DEV; a next candidate needs a new held-out draw.
