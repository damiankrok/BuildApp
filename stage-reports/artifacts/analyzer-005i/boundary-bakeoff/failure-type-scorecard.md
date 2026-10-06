# 005I Track B — failure-type scorecard (real development set)

Rules: `methodology.md` §8, fixed before scoring and applied mechanically by `aggregate.py`. Baselines are the same-frame
source-cv layers: `SCV-UNION` (SCV-LINES ∪ wall bands ∪ boundary pieces ∪ bridged gaps) for line providers, `SCV-OUTLINE` (the
default reading's opening-aware outline) for masks. Truth is the agent's manual annotation (a limitation). No single scalar.

**†** = FRAGILE: the cell changes when the truth is displaced by ±u (u = the house's largest stated vertex uncertainty,
2–5 px; `development-results.json` → `truthBufferFragility`). Rule fixes after review B8 (window-rule kinds, not-applicable
before NEUTRAL when no mask is selected) are listed in `methodology.md` §11.

## ELSED-DEFAULT

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | n/a | n/a |
| `dom-w-arkadiach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | n/a | n/a |
| `dom-w-azaliach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | n/a | n/a |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | n/a | n/a |
| `dom-w-morelach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | n/a | n/a |
| `dom-w-zurawkach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | NEUTRAL | n/a | n/a |
| `willa-miranda` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | **HURT** | n/a | n/a |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: +0.00 m of 21.10 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 3.02 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): elsed-elsed-default-10, elsed-elsed-default-102, elsed-elsed-default-104, elsed-elsed-default-193, elsed-elsed-default-213, elsed-elsed-default-228
- `dom-w-arkadiach` — wall interrupted by windows: +0.00 m of 9.24 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): elsed-elsed-default-145, elsed-elsed-default-146, elsed-elsed-default-148, elsed-elsed-default-172, elsed-elsed-default-34, elsed-elsed-default-35
- `dom-w-azaliach` — wall interrupted by windows: +0.00 m of 12.54 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +2.53 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): elsed-elsed-default-15, elsed-elsed-default-174, elsed-elsed-default-19, elsed-elsed-default-333, elsed-elsed-default-422
- `dom-w-helikoniach` — wall interrupted by windows: +0.00 m of 15.07 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): elsed-elsed-default-211, elsed-elsed-default-213, elsed-elsed-default-214, elsed-elsed-default-22, elsed-elsed-default-23, elsed-elsed-default-318
- `dom-w-morelach` — wall interrupted by windows: +0.00 m of 15.46 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.41 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +0.02 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): elsed-elsed-default-1, elsed-elsed-default-105, elsed-elsed-default-155, elsed-elsed-default-26, elsed-elsed-default-27, elsed-elsed-default-280
- `dom-w-zurawkach` — wall interrupted by windows: elsed-elsed-default-203; +0.20 m of 12.30 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.57 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): elsed-elsed-default-132, elsed-elsed-default-34, elsed-elsed-default-60, elsed-elsed-default-8, elsed-elsed-default-9
- `willa-miranda` — wall interrupted by windows: +0.00 m of 17.86 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 5.01 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +7.75 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): elsed-elsed-default-11, elsed-elsed-default-152, elsed-elsed-default-17, elsed-elsed-default-247, elsed-elsed-default-248, elsed-elsed-default-249

## DEEPLSD-MD

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | **HURT** | n/a | n/a |
| `dom-w-arkadiach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | n/a | n/a |
| `dom-w-azaliach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | n/a | n/a |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | n/a | n/a |
| `dom-w-morelach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | n/a | n/a |
| `dom-w-zurawkach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | **HURT** | n/a | n/a |
| `willa-miranda` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | **HURT** | n/a | n/a |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: +0.00 m of 21.10 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 3.02 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +3.30 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-123, deeplsd-deeplsd-md-149, deeplsd-deeplsd-md-167, deeplsd-deeplsd-md-171, deeplsd-deeplsd-md-232, deeplsd-deeplsd-md-239
- `dom-w-arkadiach` — wall interrupted by windows: +0.00 m of 9.24 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +6.41 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-112, deeplsd-deeplsd-md-189, deeplsd-deeplsd-md-235, deeplsd-deeplsd-md-259, deeplsd-deeplsd-md-415, deeplsd-deeplsd-md-449
- `dom-w-azaliach` — wall interrupted by windows: +0.00 m of 12.54 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +4.59 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-11, deeplsd-deeplsd-md-232, deeplsd-deeplsd-md-241, deeplsd-deeplsd-md-291, deeplsd-deeplsd-md-325, deeplsd-deeplsd-md-364
- `dom-w-helikoniach` — wall interrupted by windows: +0.00 m of 15.07 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-142, deeplsd-deeplsd-md-143, deeplsd-deeplsd-md-163, deeplsd-deeplsd-md-186, deeplsd-deeplsd-md-193, deeplsd-deeplsd-md-21
- `dom-w-morelach` — wall interrupted by windows: +0.02 m of 15.46 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.41 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +0.10 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-127, deeplsd-deeplsd-md-137, deeplsd-deeplsd-md-138, deeplsd-deeplsd-md-167, deeplsd-deeplsd-md-209, deeplsd-deeplsd-md-278
- `dom-w-zurawkach` — wall interrupted by windows: deeplsd-deeplsd-md-35; +0.22 m of 12.30 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.57 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +4.65 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-14, deeplsd-deeplsd-md-160, deeplsd-deeplsd-md-259, deeplsd-deeplsd-md-340, deeplsd-deeplsd-md-530, deeplsd-deeplsd-md-97
- `willa-miranda` — wall interrupted by windows: +0.00 m of 17.86 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 5.01 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +7.83 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-181, deeplsd-deeplsd-md-182, deeplsd-deeplsd-md-196, deeplsd-deeplsd-md-345, deeplsd-deeplsd-md-376, deeplsd-deeplsd-md-393

## DEEPLSD-WF

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | **HURT** | n/a | n/a |
| `dom-w-arkadiach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | n/a | n/a |
| `dom-w-azaliach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | n/a | n/a |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | n/a | n/a |
| `dom-w-morelach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | n/a | n/a |
| `dom-w-zurawkach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | NEUTRAL | n/a | n/a |
| `willa-miranda` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | **HURT** | n/a | n/a |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: +0.00 m of 21.10 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 3.02 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +3.33 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-wf-0, deeplsd-deeplsd-wf-104, deeplsd-deeplsd-wf-108, deeplsd-deeplsd-wf-110, deeplsd-deeplsd-wf-113, deeplsd-deeplsd-wf-115
- `dom-w-arkadiach` — wall interrupted by windows: +0.00 m of 9.24 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +8.85 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-wf-168, deeplsd-deeplsd-wf-183, deeplsd-deeplsd-wf-21, deeplsd-deeplsd-wf-271, deeplsd-deeplsd-wf-339, deeplsd-deeplsd-wf-340
- `dom-w-azaliach` — wall interrupted by windows: +0.00 m of 12.54 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +3.16 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-wf-150, deeplsd-deeplsd-wf-216, deeplsd-deeplsd-wf-229, deeplsd-deeplsd-wf-266, deeplsd-deeplsd-wf-294, deeplsd-deeplsd-wf-314
- `dom-w-helikoniach` — wall interrupted by windows: +0.00 m of 15.07 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-wf-104, deeplsd-deeplsd-wf-170, deeplsd-deeplsd-wf-178, deeplsd-deeplsd-wf-187, deeplsd-deeplsd-wf-188, deeplsd-deeplsd-wf-199
- `dom-w-morelach` — wall interrupted by windows: +0.00 m of 15.46 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.41 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +0.04 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-wf-102, deeplsd-deeplsd-wf-126, deeplsd-deeplsd-wf-143, deeplsd-deeplsd-wf-171, deeplsd-deeplsd-wf-183, deeplsd-deeplsd-wf-21
- `dom-w-zurawkach` — wall interrupted by windows: deeplsd-deeplsd-wf-38; +0.22 m of 12.30 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.57 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-wf-123, deeplsd-deeplsd-wf-21, deeplsd-deeplsd-wf-337, deeplsd-deeplsd-wf-393, deeplsd-deeplsd-wf-45, deeplsd-deeplsd-wf-467
- `willa-miranda` — wall interrupted by windows: +0.00 m of 17.86 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 5.01 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +7.86 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-wf-13, deeplsd-deeplsd-wf-16, deeplsd-deeplsd-wf-194, deeplsd-deeplsd-wf-260, deeplsd-deeplsd-wf-265, deeplsd-deeplsd-wf-267

## DEEPLSD-MD-REFINE-SCV

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | **HURT** | n/a | n/a |
| `dom-w-arkadiach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | n/a | n/a |
| `dom-w-azaliach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | n/a | n/a |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | n/a | n/a |
| `dom-w-morelach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | NEUTRAL | n/a | n/a |
| `dom-w-zurawkach` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | NEUTRAL | n/a | n/a |
| `willa-miranda` | n/a | NEUTRAL | NEUTRAL | NEUTRAL | n/a | NEUTRAL | n/a | n/a |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: +0.00 m of 21.10 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 3.02 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +3.44 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-refine-scv-191, deeplsd-deeplsd-md-refine-scv-192, deeplsd-deeplsd-md-refine-scv-193, deeplsd-deeplsd-md-refine-scv-195, deeplsd-deeplsd-md-refine-scv-199, deeplsd-deeplsd-md-refine-scv-2
- `dom-w-arkadiach` — wall interrupted by windows: +0.00 m of 9.24 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +1.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-refine-scv-160, deeplsd-deeplsd-md-refine-scv-179, deeplsd-deeplsd-md-refine-scv-241, deeplsd-deeplsd-md-refine-scv-274, deeplsd-deeplsd-md-refine-scv-283, deeplsd-deeplsd-md-refine-scv-294
- `dom-w-azaliach` — wall interrupted by windows: +0.00 m of 12.54 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +0.69 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-refine-scv-16, deeplsd-deeplsd-md-refine-scv-231, deeplsd-deeplsd-md-refine-scv-234, deeplsd-deeplsd-md-refine-scv-235, deeplsd-deeplsd-md-refine-scv-378, deeplsd-deeplsd-md-refine-scv-421
- `dom-w-helikoniach` — wall interrupted by windows: +0.00 m of 15.07 m window / glazing / door runs beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-refine-scv-136, deeplsd-deeplsd-md-refine-scv-137, deeplsd-deeplsd-md-refine-scv-2, deeplsd-deeplsd-md-refine-scv-226, deeplsd-deeplsd-md-refine-scv-227, deeplsd-deeplsd-md-refine-scv-230
- `dom-w-morelach` — wall interrupted by windows: +0.00 m of 15.46 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.41 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · bay: +0.00 m on 3 BAY edges beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-refine-scv-1068, deeplsd-deeplsd-md-refine-scv-27, deeplsd-deeplsd-md-refine-scv-302, deeplsd-deeplsd-md-refine-scv-303, deeplsd-deeplsd-md-refine-scv-304, deeplsd-deeplsd-md-refine-scv-305
- `dom-w-zurawkach` — wall interrupted by windows: deeplsd-deeplsd-md-refine-scv-365; +0.31 m of 12.30 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 2.57 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +0.00 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-refine-scv-0, deeplsd-deeplsd-md-refine-scv-1, deeplsd-deeplsd-md-refine-scv-154, deeplsd-deeplsd-md-refine-scv-353, deeplsd-deeplsd-md-refine-scv-376, deeplsd-deeplsd-md-refine-scv-377
- `willa-miranda` — wall interrupted by windows: +0.00 m of 17.86 m window / glazing / door runs beyond SCV-UNION · garage-door facade: +0.00 m of 5.01 m garage-door run beyond SCV-UNION · attached garage: +0.00 m on 3 GARAGE edges beyond SCV-UNION · exterior vs terrace: +1.80 m of exclusion-outline lines not in SCV-LINES; segments on exclusion outlines (some also in SCV-LINES): deeplsd-deeplsd-md-refine-scv-150, deeplsd-deeplsd-md-refine-scv-185, deeplsd-deeplsd-md-refine-scv-187, deeplsd-deeplsd-md-refine-scv-232, deeplsd-deeplsd-md-refine-scv-329, deeplsd-deeplsd-md-refine-scv-335

## MSAM-BOX

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | **HURT** | **HURT** | NEUTRAL | **HELPED** | **HURT** | **HURT** † | **HELPED** |
| `dom-w-arkadiach` | n/a | **HELPED** | n/a | n/a | n/a | NEUTRAL | **HELPED** | NEUTRAL |
| `dom-w-azaliach` | n/a | NEUTRAL † | n/a | n/a | n/a | NEUTRAL | **HELPED** | **HELPED** |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | **HELPED** † | NEUTRAL |
| `dom-w-morelach` | n/a | NEUTRAL † | NEUTRAL † | NEUTRAL | NEUTRAL | NEUTRAL | **HELPED** | **HELPED** |
| `dom-w-zurawkach` | n/a | **HELPED** | **HELPED** | NEUTRAL | n/a | NEUTRAL | **HELPED** | NEUTRAL |
| `willa-miranda` | n/a | **HURT** | **HURT** | NEUTRAL | n/a | **HURT** | NEUTRAL | NEUTRAL |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: mobilesam-msam-box-base; LEAK_THROUGH_OPENING 0.195 · garage-door facade: mobilesam-msam-box-base; LEAK_THROUGH_OPENING · attached garage: mobilesam-msam-box-base; GARAGE covered 1.0 vs SCV-OUTLINE 0.9731 · bay: mobilesam-msam-box-base; BAY covered 0.96 vs SCV-OUTLINE 0.16 · exterior vs terrace: mobilesam-msam-box-base; overreach {'TERRACE': 0.9299, 'PERGOLA': 0.994} · main-body mask: mobilesam-msam-box-base; IoU 0.694 vs SCV-OUTLINE 0.248 (trivial extent 0.745) · inner room vs building: mobilesam-msam-box-base; building coverage 0.99 vs SCV-OUTLINE 0.25
- `dom-w-arkadiach` — wall interrupted by windows: mobilesam-msam-box-base; openingRecall 0.95 vs SCV-OUTLINE 0.61 · exterior vs terrace: mobilesam-msam-box-base; overreach {'TERRACE': 0.0003, 'PERGOLA': 0.0001, 'PORCH': 0.09} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} · main-body mask: mobilesam-msam-box-base; IoU 0.960 vs SCV-OUTLINE 0.898 (trivial extent 0.984) · inner room vs building: mobilesam-msam-box-base; building coverage 0.98 vs SCV-OUTLINE 0.91
- `dom-w-azaliach` — wall interrupted by windows: mobilesam-msam-box-base; openingRecall 0.7184, leakage 0.0004 · exterior vs terrace: mobilesam-msam-box-base; overreach {'TERRACE': 0.0139, 'PERGOLA': 0.0106, 'PORCH': 0.028} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0048} · main-body mask: mobilesam-msam-box-base; IoU 0.958 vs SCV-OUTLINE 0.139 (trivial extent 0.992) · inner room vs building: mobilesam-msam-box-base; building coverage 0.97 vs SCV-OUTLINE 0.14
- `dom-w-helikoniach` — wall interrupted by windows: mobilesam-msam-box-base; openingRecall 0.6003, leakage 0.0131 · exterior vs terrace: mobilesam-msam-box-base; overreach {'TERRACE': 0.0002, 'PERGOLA': 0.0, 'PORCH': 0.9371} · main-body mask: mobilesam-msam-box-base; IoU 0.922 vs SCV-OUTLINE 0.867 (trivial extent 0.947) · inner room vs building: mobilesam-msam-box-base; building coverage 0.96 vs SCV-OUTLINE 0.90
- `dom-w-morelach` — wall interrupted by windows: mobilesam-msam-box-base; openingRecall 0.6933, leakage 0.0152 · garage-door facade: mobilesam-msam-box-base · attached garage: mobilesam-msam-box-base; GARAGE covered 0.9633 vs SCV-OUTLINE 0.9487 · bay: mobilesam-msam-box-base; BAY covered 0.9947 vs SCV-OUTLINE 0.7975 · exterior vs terrace: mobilesam-msam-box-base; overreach {'TERRACE': 0.0394, 'PORCH': 0.1686} vs SCV-OUTLINE {'TERRACE': 0.0, 'PORCH': 0.0} · main-body mask: mobilesam-msam-box-base; IoU 0.940 vs SCV-OUTLINE 0.349 (trivial extent 0.878) · inner room vs building: mobilesam-msam-box-base; building coverage 0.98 vs SCV-OUTLINE 0.35
- `dom-w-zurawkach` — wall interrupted by windows: mobilesam-msam-box-base; openingRecall 0.89 vs SCV-OUTLINE 0.64 · garage-door facade: mobilesam-msam-box-base; garage covered 0.96, leakage 0.003 · attached garage: mobilesam-msam-box-base; GARAGE covered 0.9567 vs SCV-OUTLINE 0.8253 · exterior vs terrace: mobilesam-msam-box-base; overreach {'TERRACE': 0.0001, 'PORCH': 0.0363} vs SCV-OUTLINE {'TERRACE': 0.0, 'PORCH': 0.0678} · main-body mask: mobilesam-msam-box-base; IoU 0.968 vs SCV-OUTLINE 0.872 (trivial extent 0.888) · inner room vs building: mobilesam-msam-box-base; building coverage 0.97 vs SCV-OUTLINE 0.88
- `willa-miranda` — wall interrupted by windows: mobilesam-msam-box-base; LEAK_THROUGH_OPENING 0.080 · garage-door facade: mobilesam-msam-box-base; LEAK_THROUGH_OPENING · attached garage: mobilesam-msam-box-base; GARAGE covered 0.9955 vs SCV-OUTLINE 0.9828 · exterior vs terrace: mobilesam-msam-box-base; overreach {'TERRACE': 0.3088, 'PERGOLA': 0.0056, 'PORCH': 0.985} · main-body mask: mobilesam-msam-box-base; IoU 0.821 vs SCV-OUTLINE 0.935 (trivial extent 0.797) · inner room vs building: mobilesam-msam-box-base; building coverage 0.99 vs SCV-OUTLINE 0.96

## MSAM-SOURCE-PROMPTS

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | **HURT** | **HURT** | NEUTRAL | **HELPED** | **HURT** | NEUTRAL † | **HELPED** |
| `dom-w-arkadiach` | n/a | **HURT** | n/a | n/a | n/a | **HURT** | **HURT** | NEUTRAL |
| `dom-w-azaliach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | **HURT** | **HURT** |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | **HURT** | NEUTRAL |
| `dom-w-morelach` | n/a | **HURT** | **HURT** | NEUTRAL | NEUTRAL | **HURT** | **HELPED** † | **HELPED** |
| `dom-w-zurawkach` | n/a | **HURT** | **HURT** | NEUTRAL | n/a | **HURT** | NEUTRAL | NEUTRAL |
| `willa-miranda` | n/a | **HURT** | **HURT** | NEUTRAL | n/a | **HURT** | **HURT** | NEUTRAL |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING 0.184 · garage-door facade: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING · attached garage: mobilesam-msam-source-prompts-base; GARAGE covered 1.0 vs SCV-OUTLINE 0.9731 · bay: mobilesam-msam-source-prompts-base; BAY covered 0.93 vs SCV-OUTLINE 0.16 · exterior vs terrace: mobilesam-msam-source-prompts-base; overreach {'TERRACE': 0.7619, 'PERGOLA': 0.7579} · main-body mask: mobilesam-msam-source-prompts-base; IoU 0.703 vs SCV-OUTLINE 0.248 (trivial extent 0.745) · inner room vs building: mobilesam-msam-source-prompts-base; building coverage 0.99 vs SCV-OUTLINE 0.25
- `dom-w-arkadiach` — wall interrupted by windows: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING 0.209 · exterior vs terrace: mobilesam-msam-source-prompts-base; overreach {'TERRACE': 0.992, 'PERGOLA': 1.0, 'PORCH': 0.1645} · main-body mask: mobilesam-msam-source-prompts-base; IoU 0.672 vs SCV-OUTLINE 0.898 (trivial extent 0.984) · inner room vs building: mobilesam-msam-source-prompts-base; building coverage 0.96 vs SCV-OUTLINE 0.91
- `dom-w-azaliach` — wall interrupted by windows: mobilesam-msam-source-prompts-base; openingRecall 0.0316, leakage 0.0005 · exterior vs terrace: mobilesam-msam-source-prompts-base; overreach {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0798} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0048} · main-body mask: mobilesam-msam-source-prompts-base; IoU 0.147 vs SCV-OUTLINE 0.139 (trivial extent 0.992) · inner room vs building: mobilesam-msam-source-prompts-base; INTERNAL_ROOM_SELECTED
- `dom-w-helikoniach` — wall interrupted by windows: mobilesam-msam-source-prompts-base; openingRecall 0.4655, leakage 0.0182 · exterior vs terrace: mobilesam-msam-source-prompts-base; overreach {'TERRACE': 0.0163, 'PERGOLA': 0.023, 'PORCH': 0.6633} · main-body mask: mobilesam-msam-source-prompts-base; IoU 0.560 vs SCV-OUTLINE 0.867 (trivial extent 0.947) · inner room vs building: mobilesam-msam-source-prompts-base; building coverage 0.58 vs SCV-OUTLINE 0.90
- `dom-w-morelach` — wall interrupted by windows: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING 0.072 · garage-door facade: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING · attached garage: mobilesam-msam-source-prompts-base; GARAGE covered 0.9614 vs SCV-OUTLINE 0.9487 · bay: mobilesam-msam-source-prompts-base; BAY covered 0.9981 vs SCV-OUTLINE 0.7975 · exterior vs terrace: mobilesam-msam-source-prompts-base; overreach {'TERRACE': 0.0712, 'PORCH': 0.7541} · main-body mask: mobilesam-msam-source-prompts-base; IoU 0.859 vs SCV-OUTLINE 0.349 (trivial extent 0.878) · inner room vs building: mobilesam-msam-source-prompts-base; building coverage 0.96 vs SCV-OUTLINE 0.35
- `dom-w-zurawkach` — wall interrupted by windows: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING 0.080 · garage-door facade: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING · attached garage: mobilesam-msam-source-prompts-base; GARAGE covered 0.985 vs SCV-OUTLINE 0.8253 · exterior vs terrace: mobilesam-msam-source-prompts-base; overreach {'TERRACE': 0.13, 'PORCH': 0.5626} · main-body mask: mobilesam-msam-source-prompts-base; IoU 0.780 vs SCV-OUTLINE 0.872 (trivial extent 0.888) · inner room vs building: mobilesam-msam-source-prompts-base; building coverage 0.99 vs SCV-OUTLINE 0.88
- `willa-miranda` — wall interrupted by windows: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING 0.151 · garage-door facade: mobilesam-msam-source-prompts-base; LEAK_THROUGH_OPENING · attached garage: mobilesam-msam-source-prompts-base; GARAGE covered 0.9869 vs SCV-OUTLINE 0.9828 · exterior vs terrace: mobilesam-msam-source-prompts-base; overreach {'TERRACE': 0.914, 'PERGOLA': 0.6708, 'PORCH': 0.9849} · main-body mask: mobilesam-msam-source-prompts-base; IoU 0.692 vs SCV-OUTLINE 0.935 (trivial extent 0.797) · inner room vs building: mobilesam-msam-source-prompts-base; building coverage 0.99 vs SCV-OUTLINE 0.96

## MSAM-AUTO

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | NEUTRAL | **HURT** | **HURT** | NEUTRAL | NEUTRAL | **HURT** | **HURT** |
| `dom-w-arkadiach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | **HURT** | **HURT** |
| `dom-w-azaliach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | **HURT** | **HURT** |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | **HURT** | **HURT** | NEUTRAL |
| `dom-w-morelach` | n/a | NEUTRAL | **HURT** | **HURT** | NEUTRAL † | NEUTRAL | **HURT** | **HURT** |
| `dom-w-zurawkach` | n/a | NEUTRAL | **HURT** | **HURT** | n/a | NEUTRAL | **HURT** | **HURT** |
| `willa-miranda` | n/a | NEUTRAL | **HURT** | **HURT** | n/a | NEUTRAL | **HURT** | **HURT** |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: mobilesam-msam-auto-selected; openingRecall 0.0, leakage 0.0 · garage-door facade: mobilesam-msam-auto-selected; GARAGE_EXCLUDED · attached garage: mobilesam-msam-auto-selected; GARAGE covered 0.21 vs SCV-OUTLINE 0.97 · bay: mobilesam-msam-auto-selected; BAY covered 0.0 vs SCV-OUTLINE 0.1628 · exterior vs terrace: mobilesam-msam-auto-selected; overreach {'TERRACE': 0.0, 'PERGOLA': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0} · main-body mask: mobilesam-msam-auto-selected; IoU 0.043 vs SCV-OUTLINE 0.248 (trivial extent 0.745) · inner room vs building: mobilesam-msam-auto-selected; INTERNAL_ROOM_SELECTED
- `dom-w-arkadiach` — wall interrupted by windows: mobilesam-msam-auto-selected; openingRecall 0.0, leakage 0.0 · exterior vs terrace: mobilesam-msam-auto-selected; overreach {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} · main-body mask: mobilesam-msam-auto-selected; IoU 0.037 vs SCV-OUTLINE 0.898 (trivial extent 0.984) · inner room vs building: mobilesam-msam-auto-selected; INTERNAL_ROOM_SELECTED
- `dom-w-azaliach` — wall interrupted by windows: mobilesam-msam-auto-selected; openingRecall 0.0, leakage 0.0 · exterior vs terrace: mobilesam-msam-auto-selected; overreach {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0048} · main-body mask: mobilesam-msam-auto-selected; IoU 0.058 vs SCV-OUTLINE 0.139 (trivial extent 0.992) · inner room vs building: mobilesam-msam-auto-selected; INTERNAL_ROOM_SELECTED
- `dom-w-helikoniach` — wall interrupted by windows: mobilesam-msam-auto-selected; openingRecall 0.0995, leakage 0.0137 · exterior vs terrace: mobilesam-msam-auto-selected; overreach {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.9889} · main-body mask: mobilesam-msam-auto-selected; IoU 0.003 vs SCV-OUTLINE 0.867 (trivial extent 0.947) · inner room vs building: mobilesam-msam-auto-selected; building coverage 0.00 vs SCV-OUTLINE 0.90
- `dom-w-morelach` — wall interrupted by windows: mobilesam-msam-auto-selected; openingRecall 0.0, leakage 0.0 · garage-door facade: mobilesam-msam-auto-selected; GARAGE_EXCLUDED · attached garage: mobilesam-msam-auto-selected; GARAGE covered 0.21 vs SCV-OUTLINE 0.95 · bay: mobilesam-msam-auto-selected; BAY covered 0.0 vs SCV-OUTLINE 0.7975 · exterior vs terrace: mobilesam-msam-auto-selected; overreach {'TERRACE': 0.0, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PORCH': 0.0} · main-body mask: mobilesam-msam-auto-selected; IoU 0.059 vs SCV-OUTLINE 0.349 (trivial extent 0.878) · inner room vs building: mobilesam-msam-auto-selected; INTERNAL_ROOM_SELECTED
- `dom-w-zurawkach` — wall interrupted by windows: mobilesam-msam-auto-selected; openingRecall 0.0, leakage 0.0 · garage-door facade: mobilesam-msam-auto-selected; GARAGE_EXCLUDED · attached garage: mobilesam-msam-auto-selected; GARAGE covered 0.18 vs SCV-OUTLINE 0.83 · exterior vs terrace: mobilesam-msam-auto-selected; overreach {'TERRACE': 0.0, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PORCH': 0.0678} · main-body mask: mobilesam-msam-auto-selected; IoU 0.075 vs SCV-OUTLINE 0.872 (trivial extent 0.888) · inner room vs building: mobilesam-msam-auto-selected; INTERNAL_ROOM_SELECTED
- `willa-miranda` — wall interrupted by windows: mobilesam-msam-auto-selected; openingRecall 0.0, leakage 0.0 · garage-door facade: mobilesam-msam-auto-selected; GARAGE_EXCLUDED · attached garage: mobilesam-msam-auto-selected; GARAGE covered 0.16 vs SCV-OUTLINE 0.98 · exterior vs terrace: mobilesam-msam-auto-selected; overreach {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.8631, 'PERGOLA': 0.0032, 'PORCH': 0.0001} · main-body mask: mobilesam-msam-auto-selected; IoU 0.046 vs SCV-OUTLINE 0.935 (trivial extent 0.797) · inner room vs building: mobilesam-msam-auto-selected; INTERNAL_ROOM_SELECTED

## Reference: TRIVIAL-EXTENT (no model)

The same mask rules applied to the production plan-extent rectangle itself (the information the MSAM-BOX prompt
already carries). Not a provider; added so the MobileSAM cells can be read against what the box alone earns.

## TRIVIAL-EXTENT

| house | long weak ext. wall | wall interrupted by windows | garage-door facade | attached garage | bay | exterior vs terrace | main-body mask | inner room vs building |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | n/a | **HURT** | **HURT** | NEUTRAL | **HELPED** | **HURT** | NEUTRAL | **HELPED** |
| `dom-w-arkadiach` | n/a | **HELPED** | n/a | n/a | n/a | NEUTRAL | **HELPED** | NEUTRAL |
| `dom-w-azaliach` | n/a | **HELPED** | n/a | n/a | n/a | NEUTRAL | **HELPED** | **HELPED** |
| `dom-w-helikoniach` | n/a | NEUTRAL | n/a | n/a | n/a | NEUTRAL | **HELPED** | NEUTRAL |
| `dom-w-morelach` | n/a | **HURT** | **HURT** | NEUTRAL | NEUTRAL | NEUTRAL | **HELPED** † | **HELPED** |
| `dom-w-zurawkach` | n/a | **HURT** | **HURT** | NEUTRAL | n/a | **HURT** | NEUTRAL † | NEUTRAL |
| `willa-miranda` | n/a | **HURT** | **HURT** | NEUTRAL | n/a | **HURT** | NEUTRAL | NEUTRAL |

Supporting observations / measurements:

- `dom-pod-jarzabem` — wall interrupted by windows: trivial-extent (no model); LEAK_THROUGH_OPENING 0.117 · garage-door facade: trivial-extent (no model); LEAK_THROUGH_OPENING · attached garage: trivial-extent (no model); GARAGE covered 1.0 vs SCV-OUTLINE 0.9731 · bay: trivial-extent (no model); BAY covered 0.94 vs SCV-OUTLINE 0.16 · exterior vs terrace: trivial-extent (no model); overreach {'TERRACE': 0.5898, 'PERGOLA': 0.6734} · main-body mask: trivial-extent (no model); IoU 0.745 vs SCV-OUTLINE 0.248 (trivial extent 0.745) · inner room vs building: trivial-extent (no model); building coverage 0.95 vs SCV-OUTLINE 0.25
- `dom-w-arkadiach` — wall interrupted by windows: trivial-extent (no model); openingRecall 1.00 vs SCV-OUTLINE 0.61 · exterior vs terrace: trivial-extent (no model); overreach {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} · main-body mask: trivial-extent (no model); IoU 0.984 vs SCV-OUTLINE 0.898 (trivial extent 0.984) · inner room vs building: trivial-extent (no model); building coverage 0.99 vs SCV-OUTLINE 0.91
- `dom-w-azaliach` — wall interrupted by windows: trivial-extent (no model); openingRecall 1.00 vs SCV-OUTLINE 0.32 · exterior vs terrace: trivial-extent (no model); overreach {'TERRACE': 0.0046, 'PERGOLA': 0.0, 'PORCH': 0.0098} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0048} · main-body mask: trivial-extent (no model); IoU 0.992 vs SCV-OUTLINE 0.139 (trivial extent 0.992) · inner room vs building: trivial-extent (no model); building coverage 1.00 vs SCV-OUTLINE 0.14
- `dom-w-helikoniach` — wall interrupted by windows: trivial-extent (no model); openingRecall 0.9005, leakage 0.0102 · exterior vs terrace: trivial-extent (no model); overreach {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PERGOLA': 0.0, 'PORCH': 0.0} · main-body mask: trivial-extent (no model); IoU 0.947 vs SCV-OUTLINE 0.867 (trivial extent 0.947) · inner room vs building: trivial-extent (no model); building coverage 0.99 vs SCV-OUTLINE 0.90
- `dom-w-morelach` — wall interrupted by windows: trivial-extent (no model); LEAK_THROUGH_OPENING 0.055 · garage-door facade: trivial-extent (no model); LEAK_THROUGH_OPENING · attached garage: trivial-extent (no model); GARAGE covered 1.0 vs SCV-OUTLINE 0.9487 · bay: trivial-extent (no model); BAY covered 1.0 vs SCV-OUTLINE 0.7975 · exterior vs terrace: trivial-extent (no model); overreach {'TERRACE': 0.0302, 'PORCH': 0.0} vs SCV-OUTLINE {'TERRACE': 0.0, 'PORCH': 0.0} · main-body mask: trivial-extent (no model); IoU 0.878 vs SCV-OUTLINE 0.349 (trivial extent 0.878) · inner room vs building: trivial-extent (no model); building coverage 1.00 vs SCV-OUTLINE 0.35
- `dom-w-zurawkach` — wall interrupted by windows: trivial-extent (no model); LEAK_THROUGH_OPENING 0.039 · garage-door facade: trivial-extent (no model); LEAK_THROUGH_OPENING · attached garage: trivial-extent (no model); GARAGE covered 1.0 vs SCV-OUTLINE 0.8253 · exterior vs terrace: trivial-extent (no model); overreach {'TERRACE': 0.0156, 'PORCH': 1.0} · main-body mask: trivial-extent (no model); IoU 0.888 vs SCV-OUTLINE 0.872 (trivial extent 0.888) · inner room vs building: trivial-extent (no model); building coverage 1.00 vs SCV-OUTLINE 0.88
- `willa-miranda` — wall interrupted by windows: trivial-extent (no model); LEAK_THROUGH_OPENING 0.088 · garage-door facade: trivial-extent (no model); LEAK_THROUGH_OPENING · attached garage: trivial-extent (no model); GARAGE covered 0.9962 vs SCV-OUTLINE 0.9828 · exterior vs terrace: trivial-extent (no model); overreach {'TERRACE': 1.0, 'PERGOLA': 0.0062, 'PORCH': 0.8927} · main-body mask: trivial-extent (no model); IoU 0.797 vs SCV-OUTLINE 0.935 (trivial extent 0.797) · inner room vs building: trivial-extent (no model); building coverage 1.00 vs SCV-OUTLINE 0.96

## Totals (cells, all classes and houses)

| provider | HELPED | NEUTRAL | HURT | n/a | fragile (±u) |
| --- | --- | --- | --- | --- | --- |
| ELSED-DEFAULT | 0 | 22 | 2 | 32 | 0 |
| DEEPLSD-MD | 0 | 19 | 5 | 32 | 0 |
| DEEPLSD-WF | 0 | 20 | 4 | 32 | 0 |
| DEEPLSD-MD-REFINE-SCV | 0 | 23 | 1 | 32 | 0 |
| MSAM-BOX | 12 | 18 | 8 | 18 | 5 |
| MSAM-SOURCE-PROMPTS | 4 | 14 | 20 | 18 | 2 |
| MSAM-AUTO | 0 | 16 | 22 | 18 | 1 |
| TRIVIAL-EXTENT | 10 | 17 | 11 | 18 | 2 |

## Fragile cells (±u truth buffer)

| house | provider | class | stated truth | −u | +u |
| --- | --- | --- | --- | --- | --- |
| `dom-pod-jarzabem` | MSAM-BOX | main-body mask | HURT | HURT | NEUTRAL |
| `dom-pod-jarzabem` | MSAM-SOURCE-PROMPTS | main-body mask | NEUTRAL | HURT | NEUTRAL |
| `dom-w-azaliach` | MSAM-BOX | wall interrupted by windows | NEUTRAL | HELPED | NEUTRAL |
| `dom-w-helikoniach` | MSAM-BOX | main-body mask | HELPED | HELPED | NEUTRAL |
| `dom-w-morelach` | MSAM-AUTO | bay | NEUTRAL | HURT | NEUTRAL |
| `dom-w-morelach` | MSAM-BOX | garage-door facade | NEUTRAL | HURT | NEUTRAL |
| `dom-w-morelach` | MSAM-BOX | wall interrupted by windows | NEUTRAL | HURT | NEUTRAL |
| `dom-w-morelach` | MSAM-SOURCE-PROMPTS | main-body mask | HELPED | NEUTRAL | NEUTRAL |
| `dom-w-morelach` | TRIVIAL-EXTENT | main-body mask | HELPED | NEUTRAL | HELPED |
| `dom-w-zurawkach` | TRIVIAL-EXTENT | main-body mask | NEUTRAL | NEUTRAL | HELPED |
