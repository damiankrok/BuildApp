import json,sys
for l in open(sys.argv[1]):
    e=json.loads(l); k=e['kind']
    if k=='RESPONSE':
        print(k, e['note'], 'usd', e['usd'], e['stopReason'], 'in', e['usage'].get('inputTokens'), 'out', e['usage'].get('outputTokens'), [ (c.get('type'), c.get('name')) for c in e['content']], e.get('latencyMs'))
        for c in e['content']:
            if c.get('type')=='tool_use' and c.get('name')=='get_source_region': print('   TOOL', c['input'])
            if c.get('type')=='text': print('   TEXT', c['text'][:300])
    elif k=='REVIEW':
        r=e.get('review') or {}
        print(k, 'step', e['step'], r.get('status'), 'refused' if e.get('refused') else '')
        for o in r.get('observations',[]): print('   OBS', o['about'], '|', o['seen'][:160], '|', o['certainty'])
        for p in r.get('proposedCorrections',[]): print('   PROP', p['proposalId'], p['targetId'], p['operation'], repr(p['proposed']), p['uncertainty'], [x['sourceId'] for x in p['evidence']], [a['literal'] for a in p['alternatives']])
        print('   checked', r.get('checked'), 'not', r.get('notChecked'))
    elif k in ('VALIDATION',):
        for v in e['verdicts']: print('   VERDICT', v['proposalId'], v['targetId'], v['literal'], v['status'], v['why'][:90])
    elif k in ('ROUND','FINAL','LOCAL','MODEL_CHECK','EVIDENCE_GIVEN','EVIDENCE_REFUSED','CAPABILITY_MISSING','TRANSPORT_ERROR','NO_REVIEW','NO_PROBLEM','MODEL_CHECK_FAILED'):
        print(k, json.dumps({x:y for x,y in e.items() if x not in ('at','kind')})[:600])
    elif k=='PROBLEM':
        print(k, 'round', e['round'], [(l['labelId'], [x['asRead'] for x in l['lattices']], (l.get('binding') or {}).get('spanPx')) for l in e['problem']['labels']])
