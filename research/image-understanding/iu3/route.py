"""IU-03A: three routing strategies over the same images, as pure functions of evidence already computed.

LEGACY       the production text path (archonRoleClaims -> normalizeRoles -> readsAsFacade), no pixels.
STRICT_IU02  IU-02's gate, unchanged: the classifier must say ELEVATION with p >= tauE AND the projection test inside
             the building mask must be ORTHOGRAPHIC_SUPPORTED; the publisher's words are ignored.
VETO_ONLY    keeps the LEGACY route unless the pixels give strong, independent evidence that it is wrong. It can only
             take an image AWAY from the orthographic facade extractor; it never adds one, never changes the storey,
             the elevation side or any other role, and every disagreement it does not act on is still reported.

VETO_ONLY rules (the brief's, made explicit):
  * projection PERSPECTIVE_EVIDENT                      -> STOP before the orthographic extractor (a vanishing point
                                                           is evidence; its absence is not)
  * projection NOT_SINGLE_FACADE                         -> REVIEW (multi-view sheet)
  * the classifier puts probability >= t_veto on NOT being an elevation (the sum over the seven other classes)
                                                      -> REVIEW naming the most likely class (interior, multi-view/other,
                                                         section, exterior perspective, plan, site, detail)
    (dev: a single confident non-elevation class, 'family A', let 95 dev non-elevations through at a 2 % elevation
    loss; the summed form, 'family B', reached 0 at 20 %; the choice of family and threshold was made on dev only)
  * INCONCLUSIVE alone                                  -> no action (diagnostic only)
  * classifier agrees with the caption                  -> no action: agreement is not an ACCEPT, the route simply
                                                           stays what it was
  * evidence missing (no features, no projection)       -> no action, diagnostic EVIDENCE_MISSING (never silent)
"""
from dataclasses import dataclass, field

CLASSES = ['FLOOR_PLAN', 'ORTHOGRAPHIC_ELEVATION', 'TECHNICAL_SECTION', 'EXTERIOR_PERSPECTIVE', 'INTERIOR_PERSPECTIVE',
           'SITE_PLAN', 'ARCHITECTURAL_DETAIL', 'OTHER']
ELEV = 'ORTHOGRAPHIC_ELEVATION'
VETO_CLASSES = {'ARCHITECTURAL_DETAIL': 'REVIEW_DETAIL', 'INTERIOR_PERSPECTIVE': 'REVIEW_INTERIOR', 'OTHER': 'REVIEW_MULTI_VIEW_OR_OTHER', 'TECHNICAL_SECTION': 'REVIEW_SECTION',
                'EXTERIOR_PERSPECTIVE': 'REVIEW_PERSPECTIVE', 'FLOOR_PLAN': 'REVIEW_PLAN', 'SITE_PLAN': 'REVIEW_SITE_PLAN'}


@dataclass
class Decision:
    facade: bool               # does the image reach the orthographic facade extractor
    route: str                 # FACADE / STOP_PERSPECTIVE / REVIEW_* / the legacy non-facade route / UNKNOWN
    roles: dict | None         # the roles handed downstream — VETO_ONLY returns LEGACY's untouched
    diagnostics: list = field(default_factory=list)


def legacy(legacy_route, roles):
    return Decision(legacy_route == 'FACADE', legacy_route, roles)


def strict_iu02(p, masked_state, tau_e=0.60):
    c = max(range(len(p)), key=lambda i: p[i])
    if CLASSES[c] == ELEV and p[c] >= tau_e and masked_state == 'ORTHOGRAPHIC_SUPPORTED':
        return Decision(True, 'FACADE', None)
    if CLASSES[c] == ELEV and p[c] >= tau_e:
        return Decision(False, f'REVIEW_GEOMETRY_{masked_state or "NOT_MEASURED"}', None)
    return Decision(False, 'UNKNOWN', None)  # IU-02 class acceptance is off (tau = 1.01): nothing else is routed


def veto_only(legacy_route, roles, p, projection_state, t_veto):
    diag = []
    if p is None or projection_state is None:
        diag.append('EVIDENCE_MISSING: ' + ', '.join(x for x, v in (('classifier', p), ('projection', projection_state)) if v is None))
    c = max(range(len(p)), key=lambda i: p[i]) if p is not None else None
    cls, conf = (CLASSES[c], float(p[c])) if c is not None else (None, 0.0)
    if legacy_route != 'FACADE':
        if cls == ELEV and conf >= t_veto:
            diag.append(f'DISAGREES_NOT_ACTED: legacy {legacy_route}, pixels say elevation p={conf:.2f} (VETO_ONLY never adds a facade route)')
        return Decision(False, legacy_route, roles, diag)
    if projection_state == 'PERSPECTIVE_EVIDENT':
        return Decision(False, 'STOP_PERSPECTIVE', roles, diag + ['VETO: vanishing-point evidence (PERSPECTIVE_EVIDENT)'])
    if projection_state == 'NOT_SINGLE_FACADE':
        return Decision(False, 'REVIEW_MULTI_VIEW_OR_OTHER', roles, diag + ['VETO: panels (NOT_SINGLE_FACADE)'])
    if p is not None:
        e = CLASSES.index(ELEV)
        not_elev = 1.0 - float(p[e])
        if not_elev >= t_veto:
            top = max((i for i in range(len(p)) if i != e), key=lambda i: p[i])
            return Decision(False, VETO_CLASSES.get(CLASSES[top], 'REVIEW_OTHER'), roles,
                            diag + [f'VETO: classifier P(not elevation)={not_elev:.2f} >= {t_veto}, most likely {CLASSES[top]} p={float(p[top]):.2f}'])
    if projection_state == 'INCONCLUSIVE':
        diag.append('INCONCLUSIVE_NO_ACTION')
    if cls is not None and cls != ELEV:
        diag.append(f'WEAK_DISAGREEMENT: classifier {cls} p={conf:.2f} < {t_veto}')
    return Decision(True, 'FACADE', roles, diag)
