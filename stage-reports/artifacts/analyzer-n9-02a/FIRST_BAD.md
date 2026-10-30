# N9-02A — FIRST_BAD: why 12 of 32 elevations were not registered

## Sources and baseline

- **Baseline:** the N9-01 regression (`f113a7b`, solver 2.17.0, same sealed inputs).
- **Count:** the solver's view audit reports **12** views as `NOT_REGISTERED`. The N9-00 audit, taken at `0d03d60` with its own probe, reported 11; on the same sealed inputs today the view audit counts 12.
- **Further breakdown:** 11 views are only partly used (OPENINGS_ONLY, or REGISTERED with the opening heights refused), and 9 are FULL.
- **Evidence:** the board for each view is in `boards/<house>/` (source pixels, private), and the measurements are in `ELEVATIONS-32.md`.

## Class F1 — the side of an unlabelled sheet is decided by a width measured at a scale taken from the height (8 views)

**Views:**
- A01 `…ad8fd1a56b`
- Goździkowce `…22c3997a33` and `…9fc0f059cb`
- Trytomach `…a91e112fb3`
- Arganiach `…15d78fb30b` and `…3fca1cf71a`
- Sasanki `…1c45ae540e` and `…9b7902ddb2`

**First bad step:** `packages/reconstruction/src/views.ts` `registerElevations` → `chooseSide`.
- The sheet is labelled `SIDE_UNSPECIFIED`. Its scale is taken from the silhouette's **height** (ridge, or wall top, against the outline's pixel height).
- The width at that scale then picks the axis.
- On a render the outline takes in terrain, trees, a pergola or the eaves. The width therefore lands on the wrong axis ("16.19 m … more than the footprint width"), or is shorter than either wall (Arganiach, 8.85 m).
- The view is then refused as "both walls on that axis are already assigned".

**The real signal lost:**
- In every one of these houses the other sheets are labelled FRONT and REAR. The labels alone already say the view shows the left or the right wall.
- Several of these views carry a clear wall band whose ends are the plan's walled depth.

**N9-02A:** SIDE by elimination of the other sheets' labels (`LABEL_ELIMINATION`). Two unlabelled sides keep the axis with the hand UNKNOWN (`LEFT_OR_RIGHT`). ALONG comes from the band, read on five columns, not one, and with the background excluded. The band must not be cut by the outline, and it is held to the sheet scale of the solver's same-size registrations.

**Outcome in the production regression:**
- **SPAN_ONLY gained (3):**
  - A01 `…ad8f`: the 8.28 m characteristic depth at 0.017029 m/px, 0.09 % from the sheet scale.
  - Cieszynianki `…20f0`.
  - Sasanki `…1c45`: −2.8 % from the sheet scale.
- **Still UNCHECKED or REFUSED, each with its measurement:**
  - Goździkowce `…22c3`: the band 280..881 is cut by the outline's left edge.
  - Goździkowce `…9fc0`: the outline is not the building.
  - Trytomach `…a91e`: the outline is not the building.
  - Arganiach `…15d7` and `…3fca`: no uncut band.
  - Sasanki `…9b79`: its band (0.035 m/px) is refused against the sheet scale (0.016), and its vertical-only scale (0.0175) is 10 % off that scale.

## Class F2 — no ridge datum: no view is hung, and the fallback reads one column (2 views)

**Views:** Goździkowce FRONT `…df2d450fd1`, REAR `…9a3be616c4`.

**First bad step:** `reconstruct-v2.ts:813–826`.
- Without a ridge datum only the corner registration is tried.
- It reads `neutralBands` on **one column**, through the silhouette's centre.
- On these renders that column crosses timber cladding, a door and a garage door, so no band is found.

**The real signal lost:** the walls are drawn, but in several finishes, so no single neutral run spans them.

**N9-02A:** five columns, plus bands of built pixels admitted at a sheet scale.
- There is no other registered view of this house on the same sheet size, so no sheet scale exists.
- The built band of the front (152..1102 px) is 8.6 % wider than the plan's width at the only band scale available: it takes in a balcony and a tree. It is refused, not forced.
- **Still UNREGISTERED**, with the measurements named.

## Class F3 — a vertical failure removes a sound along axis (2 views)

**Views:** Cieszynianki RIGHT `…20f0eef8f3`, Trytomach LEFT `…4db3572da1`.

**First bad step:** `reconstruct-v2.ts:780–795`.
- The view registered on its wall band is hung from the ridge. Where its ground lands more than 0.3 m from the median of the other views, the **whole view is dropped**.
- Its along axis (the band's ends on the plan's span) did not depend on that ground.

**N9-02A:**
- ALONG and VERTICAL are judged apart.
- **Cieszynianki RIGHT:** SIDE is `LEFT_OR_RIGHT` and ALONG is `SPAN_ONLY` (0.017096 m/px, the same as the solver's LEFT view, 0.017096). VERTICAL is REFUSED: the ground lands at −0.92 m, outside a plinth below ±0.00.
- **Trytomach LEFT:** the band gives 0.01678 m/px against the solver's front registration 0.01605 (4.6 % off the sheet scale), so it stays UNCHECKED and is not forced.

## Class F4 — the outline is not the building (traced extent of a render) (3 views; reported, not fixed)

**Views:** Goździkowce `…9fc0f059cb` (outline 144 px tall against 536 px on its sibling sheets), Trytomach `…a91e112fb3` (232 vs 465), and the control Kruszczyki `…7159ac8d2c` (202 vs 402).

**First bad step:** `views.ts` `buildingExtent` → `architecturalBounds`. When the traced silhouette covers the whole render, the measured bounds can be a strip along the ground.

**N9-02A:** such an outline is refused as an anchor (`EXTENT_HEIGHT_MIN_SHARE`, a gross test against the same-size sibling sheets). No band on it is used. The extent itself is not repaired: that is the reader, not this stage.

## Found on the way: defects of the solver's own registration (not fixed here — no geometry change)

**Larchfield (synthetic: true scale 38 px/m, 0.026316 m/px).**
- The solver registers FRONT and REAR at 0.023821 m/px, −9.5 % against the truth. Their ground lands at +0.75 m, inside the solver's 0.9 m tolerance.
- The multi-column wall band of both views gives 0.026301 m/px (−0.06 %), and the side views 0.026277 m/px (−0.15 %).
- N9-02A marks the solver's front and rear ALONG as **contested** (two agreeing bands against one registration) and does not take either scale.

**Trytomach FRONT.**
- The solver's 0.016046 m/px (REGISTERED, FULL before) is contradicted by the front's band (0.014677) and by the rear's band and registration (0.014694): 8.5 % apart.
- No other view of that sheet size stands at either scale. Under N9-02A it is contested: **FULL → UNREGISTERED**, the one view lost.
- This view carries a source-fidelity CONFLICT in N9-01 (R5). That conflict may come from the registration rather than from the model, which is a question for N9-02B or the solver, not decided here.
