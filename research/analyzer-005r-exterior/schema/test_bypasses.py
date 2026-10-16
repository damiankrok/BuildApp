#!/usr/bin/env python3
"""
test_bypasses.py — the independent audit's forgery suite (addendum E), kept as a regression test. Every document is
built from the COMMITTED manifest and B1 output and must be refused by the research contract.

    python3 -I research/analyzer-005r-exterior/schema/test_bypasses.py
"""
import copy
import json
import os
import sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, R)
sys.path.insert(0, os.path.join(R, 'schema'))
import contenders  # noqa: E402
import validate  # noqa: E402

m = json.load(open(os.path.join(R, 'results/corpus-manifest.json')))
ctx = validate.ctx_from(m)
P = json.load(open(os.path.join(R, 'results/proposals-B1.json')))['proposals']


def find(ed, cls, scope='EDITION'):
    return [p for p in P if p['projectEditionId'] == ed and p['featureClass'] == cls and p['scope'] == scope]


A = contenders.anchor
OWN = 'archon:m3ea28300f9b3e'
G2E = 'archon:m84f2903cb8e14'
EOZE = 'archon:m738275b7537b0'
res = {}


def run(name, q):
    q['proposalId'] = 'p-forged-' + name
    res[name] = validate.check(q, 0, ctx)


def run(name,q):
    q['proposalId']='p-forged-'+name
    e=validate.check(q,0,ctx); res[name]=e
# 1 forged schedule anchor on OWNER for TERRACE -> corroborated
q=copy.deepcopy(find(OWN,'TERRACE')[0]) if find(OWN,'TERRACE') else None
q=copy.deepcopy([p for p in P if p['projectEditionId']==OWN and p['scope']=='EDITION' and p['featureClass']=='TERRACE'][0])
q['sourceEvidence'].append(A('TECHNICAL_SCHEDULE',OWN,'schedule:TERRACE:1','TERRACE','ORTHOGRAPHIC_PLAN',group='schedule:'+OWN,provenance='PRINTED_SCHEDULE'))
q.update(verificationStatus='TECHNICALLY_CORROBORATED',confidenceOrAbstain={'confidence':0.8}); q['channels']['orthographicTechnicalConfirmation']='CONFIRMED'
run('B1_forged_schedule_on_owner',q)
# 2 launder G2E TERRACE into OWNER, production anchors re-kinded as TECHNICAL_SCHEDULE w/o bytes
q=copy.deepcopy(find(G2E,'TERRACE')[0]); q['projectEditionId']=OWN; q['correlationGroup']='edition:'+OWN
for a in q['sourceEvidence']:
    a['editionKey']=OWN
    if a['anchorKind']=='PRODUCTION_TECHNICAL_FEATURE':
        a['anchorKind']='TECHNICAL_SCHEDULE'; a['byteHashes']=[]; a['provenance']='PRINTED_SCHEDULE'
run('B2_launder_rekinded',q)
# 3 provenance forgery: bratkach ATTACHED_ROOF ASSUMED_FOR_RENDERING -> claim SOURCE_EXACT
ed='archon:m953292c7d56c7'; f=[f for f in m['editions'][ed]['technical']['features'] if f['productionFamily']=='ATTACHED_ROOF'][0]
a=contenders.tech_anchor(ed,f); a['provenance']='SOURCE_EXACT'
q=contenders.proposal(scope='EDITION',projectEditionId=ed,role='NOT_APPLICABLE',projection='NOT_APPLICABLE',viewSide='NOT_APPLICABLE',sourceKind='EDITION_FUSION',proposalKind='FEATURE',featureClass='UNKNOWN_ASSEMBLY',featureRelation='SOLID_COVER',featureRelationBasis='TECHNICAL',confidenceOrAbstain={'confidence':0.6},sourceEvidence=[a],correlationGroup='edition:'+ed,metricAuthority='SOURCE_DERIVED',verificationStatus='TECHNICAL_ONLY',refusalReason=None,alternatives=[],channels=contenders.channels('NONE','NOT_ATTEMPTED','CONFIRMED'))
run('B3_assumed_for_rendering_relabelled_exact',q)
# 3b denied recess (G2E) used as TECHNICAL_ONLY
f=[f for f in m['editions'][G2E]['technical']['features'] if f['productionDeniesRecess']][0]
q2=copy.deepcopy(q); q2['projectEditionId']=G2E; q2['correlationGroup']='edition:'+G2E; q2['sourceEvidence']=[contenders.tech_anchor(G2E,f)]; q2['featureRelation']=None; q2['featureRelationBasis']='NONE'
run('B3b_denied_recess_as_evidence',q2)
# 4 SOURCE_EXACT via TECHNICAL_PARAM on a TECHNICAL_ELEVATION frame proposal
fr=[p for p in P if p['scope']=='FRAME' and p['role']=='TECHNICAL_ELEVATION' and p['projectEditionId']==G2E and p['proposalKind']=='SCENE_ROLE'][0]
q=copy.deepcopy(fr); q.update(proposalKind='FEATURE',featureClass='GARAGE_ENCLOSED',metricAuthority='SOURCE_EXACT',verificationStatus='TECHNICAL_ONLY')
q['sourceEvidence'].append(A('TECHNICAL_PARAM',G2E,'param:garageAreaPrinted','GARAGE_ENCLOSED',group='schedule:'+G2E,provenance='PRINTED_SCHEDULE'))
q['channels']['orthographicTechnicalConfirmation']='CONFIRMED'
run('B4_source_exact_param_on_frame',q)
# 5 perspective frame, FEATURE kind (not FEATURE_VISIBILITY) abstaining
fv=[p for p in P if p['proposalKind']=='FEATURE_VISIBILITY'][0]
q=copy.deepcopy(fv); q['proposalKind']='FEATURE'
run('B5_perspective_FEATURE_abstain',q)
# 6 corroborated with PUBLISHER_STRUCTURE (gallery membership) as the claim + forged schedule
ed=EOZE; q=copy.deepcopy([p for p in P if p['projectEditionId']==ed and p['featureClass']=='PERGOLA' and p['scope']=='EDITION'][0])
q['sourceEvidence']=[A('PUBLISHER_STRUCTURE',ed,'structure:PAGE:fancybox3ProdBigImg0:N/A','BALCONY'),A('TECHNICAL_SCHEDULE',ed,'schedule:BALCONY:1','BALCONY','ORTHOGRAPHIC_PLAN',provenance='PRINTED_SCHEDULE')]
for a in q['sourceEvidence']: a['polarity']='POSITIVE'
q.update(featureClass='BALCONY',featureRelation=None,featureRelationBasis='NONE',verificationStatus='TECHNICALLY_CORROBORATED',confidenceOrAbstain={'confidence':0.8}); q['channels']['orthographicTechnicalConfirmation']='CONFIRMED'
run('B6_structure_membership_as_claim',q)
# 6b publisher anchor of a different class (expected REJECT)
q3=copy.deepcopy(q); q3['sourceEvidence'][0].update(anchorKind='PUBLISHER_CATEGORY',featureClass='PERGOLA')
run('B6b_publisher_other_class',q3)
# 7 polarity flip: m738 (category NEGATIVE garage) negative schedule anchor flipped POSITIVE, negative claim kept
g=copy.deepcopy(find(EOZE,'GARAGE_ENCLOSED')[0])
for a in g['sourceEvidence']:
    if a['anchorKind']=='TECHNICAL_SCHEDULE': a['polarity']='POSITIVE'
g['sourceEvidence'].append(A('PUBLISHER_DESCRIPTION',EOZE,'description:GARAGE_ENCLOSED','GARAGE_ENCLOSED',group='publisher:'+EOZE))
g.update(verificationStatus='TECHNICALLY_CORROBORATED',confidenceOrAbstain={'confidence':0.8},metricAuthority='SOURCE_EXACT',featureRelation='SOLID_COVER',featureRelationBasis='TECHNICAL'); g['channels']['orthographicTechnicalConfirmation']='CONFIRMED'
run('B7_polarity_flip_and_conflict_ignored',g)
# 8 interior asset, role OTHER_UNKNOWN, non-abstaining FEATURE with SOURCE_DERIVED (G2/G3 contract bypass)
by={a['assetByteHash']:a for a in m['assets']}
ip=[p for p in P if p['scope']=='FRAME' and p['proposalKind']=='SCENE_ROLE' and by[p['assetByteHash']]['structureRole005r']=='INTERIOR_RENDER' and p['projectEditionId']==G2E][0]
f=[f for f in m['editions'][G2E]['technical']['features'] if f['productionFamily']=='TERRACE'][0]
q=copy.deepcopy(ip); q.update(role='OTHER_UNKNOWN',projection='UNKNOWN',sourceKind='UNKNOWN_FRAME',proposalKind='FEATURE',featureClass='TERRACE',metricAuthority='SOURCE_DERIVED',verificationStatus='TECHNICAL_ONLY',confidenceOrAbstain={'confidence':0.9},refusalReason=None)
q['sourceEvidence']=[contenders.tech_anchor(G2E,f)]; q['channels']['orthographicTechnicalConfirmation']='CONFIRMED'; q['channels']['pixelInterpretation']='NOT_ATTEMPTED'
run('B8_interior_bytes_feature_with_authority',q)
# 9 key synonym (expected REJECT)
q=copy.deepcopy(P[0]); q['caption']='x'; run('B9_extra_key',q)
q=copy.deepcopy(P[0]); q['featureclass']=q.pop('featureClass'); run('B9b_key_synonym',q)
# 10 VISUAL_ONLY status with zero anchors
q=copy.deepcopy(find(G2E,'TERRACE')[0]); q.update(verificationStatus='VISUAL_ONLY_NOT_INDEPENDENTLY_VERIFIED',sourceEvidence=[]); q['channels']['orthographicTechnicalConfirmation']='VISUAL_TONE_ONLY'
run('B10_visual_only_no_anchor',q)
q=copy.deepcopy(fr); q['sourceEvidence']=[a for a in q['sourceEvidence'] if a['anchorKind']!='PIXEL_ROUTER_V1']; q['channels']['pixelInterpretation']='NOT_ATTEMPTED'
q.update(proposalKind='FEATURE',featureClass='GARAGE_ENCLOSED',metricAuthority='SOURCE_EXACT',verificationStatus='TECHNICAL_ONLY')
q['sourceEvidence'].append(A('TECHNICAL_PARAM',G2E,'param:garageAreaPrinted','GARAGE_ENCLOSED',group='schedule:'+G2E,provenance='PRINTED_SCHEDULE'))
q['channels']['orthographicTechnicalConfirmation']='CONFIRMED'
run('B4b_source_exact_param_on_frame_clean',q)

accepted = sorted(k for k, v in res.items() if not v)
for k in sorted(res):
    print('ACCEPTED' if not res[k] else 'refused ', k, (res[k] or [''])[0][:110])
if accepted:
    raise SystemExit(f'{len(accepted)} forgeries accepted: {accepted}')
print(f'OK: {len(res)} forgeries refused')
