"""IU-03B: VETO_ONLY with a masked perspective check. Pure decision over evidence already computed (`collect.py`
summaries), so the same function scores DEV, the control set and a phone-side port.

Stage 1 is IU-03A's `route.veto_only`, called unchanged (same rules, same t_veto, same roles handed back). Only when
it keeps the facade route does stage 2 look again, inside a building mask:

  * STOP when the projection test inside the mask is PERSPECTIVE_EVIDENT. With `base=False` the oblique-base-edge cue
    does not count there: it reads the lower half of the mask box as the building's base, and a sky/foliage-free mask
    does not end at the ground.
  * sensitive form (dev only, `z`/`d`): a family with enough well-spread edges and drift z >= z AND >= d px.
  * INCONCLUSIVE inside the mask changes nothing: absence of perspective is not orthography. When it disagrees with
    the classifier the disagreement is written down (`CONFLICT_RECORDED`) and no route comes from it.
  * with `trigger=True` stage 2 runs only when one of `triggers()` fires; otherwise it is skipped and says so.

Stage 2 never adds a facade route and never changes a role.
"""
from iu3 import route

ELEV = 1
T_VETO = 0.60            # IU-03A, unchanged
TRIGGER_P_ELEV = 0.95    # the classifier is not sure the picture is an elevation
TRIGGER_FOLIAGE = 0.05   # enough plants in the picture to hide or fake geometry
TRIGGER_Z = 3.0          # a perspective signal on the full image, below IU-02's EVIDENT bar
CONFLICT_P_ELEV = 0.80


def _sensitive(m, z_min, d_min):
    for k in ('h', 'v'):
        f = m.get(k) or {}
        if f.get('enough') and (f.get('z') or 0) >= z_min and (f.get('distortionPx') or 0) >= d_min:
            return f"{'horizontals' if k == 'h' else 'verticals'} converge inside the mask (z {f['z']}, {f['distortionPx']} px)"
    return None


def _masked_evident(m, base):
    if m['state'] != 'PERSPECTIVE_EVIDENT':
        return []
    return [w for w in (m.get('why') or '').split('; ') if base or not w.startswith('oblique base edges')]


def triggers(p, c):
    t = []
    if float(p[ELEV]) < TRIGGER_P_ELEV:
        t.append(f'classifier p(elevation) {float(p[ELEV]):.2f} < {TRIGGER_P_ELEV}')
    if c['full']['state'] == 'INCONCLUSIVE':
        t.append('full-image projection INCONCLUSIVE')
    if (c.get('classicInfo') or {}).get('foliageShare', 0) >= TRIGGER_FOLIAGE:
        t.append(f"foliage {c['classicInfo']['foliageShare']:.0%}")
    if any(((c['full'].get(k) or {}).get('z') or 0) >= TRIGGER_Z for k in ('h', 'v')):
        t.append(f'a perspective signal on the full image (z >= {TRIGGER_Z})')
    return t


def decide(p, c, masked=None, z=None, d=None, trigger=False, base=True, legacy_route='FACADE', roles=None, t_veto=T_VETO):
    """Returns {facade, reason, maskedRan, triggers, conflict, diagnostics, roles}."""
    v = route.veto_only(legacy_route, roles, list(p), c['full']['state'], t_veto)
    out = {'facade': v.facade, 'reason': v.route, 'maskedRan': 0, 'triggers': [], 'conflict': None, 'diagnostics': list(v.diagnostics), 'roles': v.roles}
    if not v.facade or not masked:
        return out
    tr = triggers(p, c) if trigger else ['always']
    out['triggers'] = tr
    if not tr:
        out['diagnostics'].append('MASKED_TEST_SKIPPED: no trigger')
        return out
    if masked not in c:
        out['diagnostics'].append(f'EVIDENCE_MISSING: {masked} mask')
        return out
    out['maskedRan'] = 1
    m = c[masked]
    ev = _masked_evident(m, base)
    why = ev[0] if ev else (_sensitive(m, z, d) if z is not None else None)
    if why:
        return {**out, 'facade': False, 'reason': 'STOP_PERSPECTIVE_MASKED', 'diagnostics': out['diagnostics'] + [f'VETO: inside the {masked} mask: {why}']}
    if m['state'] == 'INCONCLUSIVE' and float(p[ELEV]) < CONFLICT_P_ELEV:
        out['conflict'] = f'CONFLICT_RECORDED: masked projection INCONCLUSIVE and p(elevation) only {float(p[ELEV]):.2f}; no route change'
    return out
