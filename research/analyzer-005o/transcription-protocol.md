# 005O transcription protocol (offline scorer truth) — exact prompt and data flow

This records how `labels/truth.json` (outside the repository) was produced, so the step can be audited and re-run.
Post-review LMP-1.

- **Transcribers.** Two independent model-based transcriber sub-agents per sheet (`A`, `B`), launched by the session's
  workflow tool with the prompt below. They were the same cloud-hosted vision-capable assistant model that ran this
  session, with no tools other than reading the one sheet image, and with no access to reader outputs, values, case names
  or other sheets. They are **not human**. 26 sheets × 2 = 52 transcriptions; workflow run `wf_d6bc14b1-951`.
- **Data flow.** The sheets (enlarged statement crops cut from publisher plan rasters, plus synthetic controls) were
  sent to the model provider's API as images, exactly as every image the assistant reads in a session is. Nothing was
  published, committed or stored elsewhere; the sheets stay in `/home/user/work005o/labels/sheets/` (outside the
  repository).
- **Role.** Truth is used **only** by the offline scorer (`score.py`, `truth.py`, `m4_orientation_diag.py`); no
  challenger and no view generator reads it (asserted in `tests/architecture/research-isolation.test.ts`). It is not a
  runtime adjudicator. Whether a model-based truth labeller is acceptable under the brief's "no cloud/VLM automatic
  adjudicator" (which addresses the analyzer's own decisions) is flagged to the coordinator in the stage report §N.
- **Independent check.** On the 62 crops that overlap the labels accepted in 005E (`development-labels.json`), the
  005O truth agrees on 62/62 (`truth-crosscheck.json`); controls: A 102/104, B 101/104 (errors concentrated on 180°
  turned controls); no control was wrongly read the same way by both.
- **Disclosed bias (post-review L7).** A third of the synthetic control values were drawn from
  `[541, 501, 870, 810, 346, 432, 120, 224, 180, 280]`, values known from the Phase A forensics of
  `dom-w-glogownikach`; 31 of 104 controls came from that list. The glogownikach 541 and 870 crops never shared a sheet
  with a same-value control; its 224 and 280 crops did (sheets 0 and 13). A rerun should draw control values from a
  list not derived from evaluated houses.
- **What truth is.** A transcription of the token box (+35 % pad) — the same pixels PP-OCRv6 reads (post-review L8).
  "0/507 corroborating PP-OCRv6 readings wrong" therefore means agreement with a blind transcription of the same crop,
  not proof that the box holds the whole printed dimension.

Prompt template (`${s}` = sheet number, `${who}` = A/B; SHA-256 of the template text `1321359ecce195dc46528fe92376ee6b94fe34bd5ff11e5c749cc0b2540b347a`):

```text
You are transcriber ${who} in an offline labelling task. Use ONLY the Read tool, ONLY on this one image: ${args.dir}/sheet-${String(s).padStart(2, '0')}.png . Do not open any other file, do not run commands, do not search.
The image is a grid of numbered tiles (#1, #2, ...). Each tile shows one small crop cut from an architectural drawing, enlarged with blocky pixels. Most tiles are a printed dimension label (a number such as 541, 1260, 4,56). Some are upside down or rotated: read them in their natural upright orientation and set upsideDown=true if you had to turn the text 180 degrees. Some tiles are not a label at all (a picture, hatching, furniture, a fragment of a word) - answer NOT_A_LABEL. If you cannot make out every character, answer ILLEGIBLE (or give your best reading with confidence GUESS and an alternative).
Transcribe what is PRINTED, character by character, including a comma or dot if one is printed. Do not correct, round or guess what a dimension "should" be; small figures are as likely as large ones. Look closely at lookalike digits (1/7, 3/8, 4/0/9, 5/6, 0/8). If a tile holds two separate numbers, give the most prominent one and mention the other as alternative.
Return one item per tile number present on the sheet, in order. Zoom by re-reading the image if needed.
```

Structured output schema:

```js
{
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          reading: { type: 'string', description: 'the characters exactly as printed (digits, comma/dot if printed), read upright; or NOT_A_LABEL; or ILLEGIBLE' },
          upsideDown: { type: 'boolean' },
          confidence: { type: 'string', enum: ['CERTAIN', 'PROBABLE', 'GUESS'] },
          alternative: { type: 'string', description: 'a second plausible reading when not CERTAIN, else empty' },
        },
        required: ['n', 'reading', 'upsideDown', 'confidence', 'alternative'],
      },
    },
  },
  required: ['items'],
}
```
