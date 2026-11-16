"""Same-design check (PROTOCOL_V3541 §1): a drawn US plan whose published width, depth and height all equal those of a
US page of S30 within 1 % is a copy of a known design and is replaced by the next in draw order. Source facts only."""
import glob, json
S30_US = glob.glob('/home/user/rd/anylink/control*/houseplans-com*/source-package.json') + glob.glob('/home/user/rd/anylink/control*/architecturaldesigns-com*/source-package.json')
def dims(path):
    f = {x['key']: x['value'] for x in json.load(open(path))['publishedFacts'] if isinstance(x.get('value'), (int, float))}
    return tuple(f.get(k) for k in ('building_width', 'building_length', 'building_height'))
known = {p: dims(p) for p in S30_US}
same = lambda a, b: all(x is not None and y is not None and abs(x - y) <= 0.01 * max(x, y) for x, y in zip(a, b))
out = []
for line in open('/home/user/rd/v3541/final-sample.txt'):
    parts = line.split()
    if parts[1] not in ('houseplans', 'monsterhouseplans'): continue
    d = dims(f'{parts[2]}/{parts[4]}/source-package.json')
    hits = [p.split('/')[-2] for p, k in known.items() if same(d, k)]
    out.append({'slug': parts[4], 'dims': d, 'sameAs': hits})
print(json.dumps({'s30UsPages': len(known), 'checked': out}, indent=1))
