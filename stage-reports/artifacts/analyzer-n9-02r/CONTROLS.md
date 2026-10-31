# N9-02R — the frozen ARCHON controls (N9-02A, frozen at f113a7b; not tuned on)

There is no human-labelled truth for these projects. The tables below give the R5 before/after and the four-axis adjudication, not an accuracy.

## projekt-dom-w-kruszczykach-22-md1827af5309ce

- Service 1.3.0 → 1.5.0. Candidate, model, scene and metric hashes identical: yes.
- Classes: {'ALONG_ONLY': 1, 'FULL': 2, 'UNREGISTERED': 1, 'VERTICAL_ONLY': 0}. Scorecard: {'executed': 12, 'independent': 0, 'potential': 30, 'rawObserved': 13}.

| view | class | ALONG / VERTICAL | R5 at freeze (service 1.3.0) | R5 now |
|---|---|---|---|---|
| …1953bbb039 | FULL | VALID / VALID | UNCHECKED DISAGREEMENT_NOT_STABLE | UNCHECKED DISAGREEMENT_NOT_STABLE |
| …2df4a59d54 | ALONG_ONLY | VALID / UNAVAILABLE | UNCHECKED VIEW_PARTLY_REGISTERED | UNCHECKED VIEW_PARTLY_REGISTERED |
| …5083ee5c5e | FULL | VALID / VALID | UNCHECKED DISAGREEMENT_NOT_STABLE | UNCHECKED DISAGREEMENT_NOT_STABLE |
| …7159ac8d2c | UNREGISTERED | UNAVAILABLE / UNAVAILABLE | UNCHECKED VIEW_NOT_REGISTERED | UNCHECKED VIEW_NOT_REGISTERED |

## projekt-dom-w-lipiennikach-6-ma30275c5800a9

- Service 1.3.0 → 1.5.0. Candidate, model, scene and metric hashes identical: yes.
- Classes: {'ALONG_ONLY': 0, 'FULL': 3, 'UNREGISTERED': 1, 'VERTICAL_ONLY': 0}. Scorecard: {'executed': 17, 'independent': 0, 'potential': 36, 'rawObserved': 20}.

| view | class | ALONG / VERTICAL | R5 at freeze (service 1.3.0) | R5 now |
|---|---|---|---|---|
| …2b4101e3ef | FULL | VALID / VALID | UNCHECKED DISAGREEMENT_NOT_STABLE | UNCHECKED DISAGREEMENT_NOT_STABLE |
| …5a629d94cb | FULL | VALID / VALID | CONFLICT ELEVATION_DISAGREES | CONFLICT ELEVATION_DISAGREES |
| …7c623015a5 | FULL | VALID / VALID | CONFLICT ELEVATION_DISAGREES | CONFLICT ELEVATION_DISAGREES |
| …ce54f77faa | UNREGISTERED | UNAVAILABLE / UNAVAILABLE | UNCHECKED VIEW_NOT_REGISTERED | UNCHECKED VIEW_NOT_REGISTERED |

## projekt-dom-w-skalnicach-3-ma7c291947b287

The run fails at the solver (RECONSTRUCTION_FAILED; PLAN_LAYOUT_REJECTED at the freeze), so no assessment exists. Nothing was invented for it.

## Research reader on the controls

It refused all 12 control views: accepted 0, false acceptances 0. See `reader/INDEX.md`.
