# N9-02A — control sheets frozen before implementation

## Selection and freezing

Three public ARCHON project pages not in the corpus (`https://www.archon.pl/projekty-domow/…`) were chosen from the publisher's listing:
- `projekt-dom-w-kruszczykach-22-md1827af5309ce`
- `projekt-dom-w-lipiennikach-6-ma30275c5800a9`
- `projekt-dom-w-skalnicach-3-ma7c291947b287`

They were acquired and analysed with the unchanged base pipeline (`f113a7b`) on 2026-10-30 between 14:52 and 14:58 UTC (`frozen.txt`). The sealed inputs and their sha256 are in `manifest.txt`. The pixels stay outside the repository.

**Before any run of the new module on them:**
- The module was being drafted while the freeze ran. It is not imported by the pipeline that produced the frozen inputs.
- No threshold was set or changed after looking at them.

**Code changes after the first control run:**
- What changed:
  - sky/paper exclusion (from the synthetic truth);
  - clipped-band refusal and contest arbitration (from the corpus);
  - the vertical-only sheet test (from the corpus).
- None of the three changes came from the controls.
- The controls were re-run on the final code: same classes as the first run.

## Results (no tuned threshold; real accuracy NOT_MEASURED — no independent manual truth for these sheets)

| control | solver (BEFORE) | N9-02A (AFTER) | refusals, with their measure |
|---|---|---|---|
| Kruszczyki 22 | FULL 2 · ALONG_ONLY 1 · UNREGISTERED 1 | FULL 2 · ALONG_ONLY 1 · UNREGISTERED 1 | `…7159` side: outline 202 px tall against 402 px on its sibling sheets (not the building); `…2df4` front: the apex not stated (top outline neither level nor two slopes) |
| Lipienniki 6 | FULL 3 · UNREGISTERED 1 | FULL 3 · UNREGISTERED 1 | `…ce54` side: band 415..1094 gives 0.014728 m/px, 7 % off the 0.013755 m/px sheet scale of the solver's registrations — refused |
| Skalnice 3 | — | — | The run fails at REGISTERING_VIEWS (`PLAN_LAYOUT_REJECTED`: the lowest storey 40.91 m² against the published 167.15 m²). With no plan reading there is no world frame and no span, so no axis is registered and no assessment exists for a failed run. |

**False matches added on the controls:** 0, judged by the internal cross-checks (sheet scale, opposite view, ground). They are not judged against an independent truth.

**Gains on the controls:** 0. That is reported as measured, not explained away.

## Synthetic truth (the only independent truth available)

The Larchfield sheets of `@buildapp/synthetic-drawings` are drawn at 38 px/m (0.026316 m/px). These are the API contract job's sheets.

| view | solver | N9-02A |
|---|---|---|
| FRONT | REGISTERED 0.023821 (−9.5 % against the truth; ground +0.75 m accepted by the solver's 0.9 m) | ALONG **contested**: band 0.026301 (−0.06 %), agreeing with the REAR band; neither scale is taken |
| REAR | same as FRONT | same as FRONT |
| two unlabelled sides | NOT_REGISTERED | SPAN_ONLY 0.026277 (−0.15 % against the truth), VERTICAL registered |

The first draft of the module, before sky/paper exclusion, read the paper as wall and gave −12.3 %. That draft never reached the regression.
