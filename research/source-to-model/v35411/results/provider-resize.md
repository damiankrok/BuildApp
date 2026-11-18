# v3.54.11 — does the provider resize or pad what H sends? (no API call; documentation + recorded answers)

Question (prompt §LOCAL, "provider resize/padding"): a reading in image pixels is only usable if the picture the model
saw is the picture whose pixels we measure. If the provider downsizes or pads it, every returned coordinate is in the
processed image and must be mapped back.

What the provider's vision documentation says (read during v3.54.11; no request sent):
- images above the model's size limit are scaled down, aspect kept, before the model sees them; the high-resolution
  tier allows a long edge of up to 2576 px (about 4784 image tokens at the limit);
- a scaled image may be padded at its bottom/right to a multiple of the patch size (28 px); coordinates the model
  returns are in the processed (resized, padded) image, not the original.

What H sends: every picture is prepared locally to a long edge of at most 1568 px before it is encoded
(`packages/analysis-service/src/house/pictures.ts`, `PICTURE_LIMITS.detailLongSidePx = 1568`; thumbnails 512), which
is below the limit — the provider has nothing to scale. Padding at bottom/right would not move a coordinate measured
from the top-left corner.

Evidence on recorded answers (v3.54.10 live job, Marcówki GE): the ground plan was sent at 1568 px on its long edge
and the returned outline reached y = 1422 px — a coordinate that only exists in the unscaled picture (a picture scaled
down would cap it below its own height), and every registered elevation frame of that job lands on the published
picture's own features within the tolerances the scorers use (27 rows, 16 features).

Conclusion: no resize or padding correction is needed for H's current requests; a coordinate in an answer is a
coordinate in the bytes we sent. If the request size is ever raised above the provider limit, the mapping
(scale = original / processed, padding ignored from the top-left origin) must be applied before any measurement —
recorded here as the rule, not implemented, because nothing sends such a picture.
