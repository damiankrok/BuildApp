"""IU-02 FINAL ARCHON draw (ONLINE-free; reads tracked files and local work directories only).

Pool: holdout/pool.txt (the publisher sitemap snapshot of BUILDPLAN-005A, POOL_SHA256 in holdout/pool.meta.json).
Excluded families: holdout/excluded-families-round-13.txt, every family in holdout/LEDGER.ndjson draws, every family of
the 005R corpus manifest, and every ARCHON project address found in the local work directories of later stages
(analogs, N-stage acquisitions). A family = first three slug tokens when the second is a preposition, else two
(holdout/README.md); it over-merges, which is the safe direction.

seed = SHA256(FREEZE_SHA + "BUILDPLAN-IU02-FINAL-ARCHON"); k families drawn without replacement in pool order by
successive hashes; one address per family (the first in pool order). FREEZE_SHA must be the pushed commit that
preregisters IU-02 (head hash, thresholds, this script), and the tree must be clean.

    python3 -I iu2_draw_archon.py <FREEZE_SHA> <k> <out.json outside the repo>
"""
import glob, hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.realpath(os.path.join(HERE, '..', '..'))
PREP = {'w', 'z', 'na', 'pod', 'nad', 'przy', 'u', 'o', 'po', 'za', 'ze', 'we', 'od', 'do'}
SLUG = re.compile(r'archon\.pl/projekty-domow/projekt-([a-z0-9-]+?)-m[0-9a-f]{13}')


def family(slug):
    t = slug.split('-')
    return '-'.join(t[:3]) if len(t) > 2 and t[1] in PREP else '-'.join(t[:2])


def slug_of(url):
    m = SLUG.search(url)
    return m.group(1) if m else None


def main():
    freeze, k, out = sys.argv[1], int(sys.argv[2]), os.path.realpath(sys.argv[3])
    if out.startswith(REPO + os.sep):
        sys.exit('REFUSED: the draw is written outside the repository until it is committed with the report')
    head = subprocess.check_output(['git', '-C', REPO, 'rev-parse', 'HEAD'], text=True).strip()
    dirty = subprocess.check_output(['git', '-C', REPO, 'status', '--porcelain'], text=True).strip()
    if head != freeze or dirty:
        sys.exit(f'REFUSED: HEAD {head} must equal FREEZE_SHA {freeze} with a clean tree')
    pool = [l.strip() for l in open(os.path.join(REPO, 'holdout', 'pool.txt')) if l.strip()]
    excluded = {l.strip() for l in open(os.path.join(REPO, 'holdout', 'excluded-families-round-13.txt')) if l.strip()}
    for line in open(os.path.join(REPO, 'holdout', 'LEDGER.ndjson')):
        for u in json.loads(line).get('urls', []):
            s = slug_of(u)
            if s:
                excluded.add(family(s))
    man = json.load(open(os.path.join(REPO, 'stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')))
    for a in man['assets']:
        f = a.get('family', '')
        if f.startswith('archon:'):
            excluded.add(f.split(':', 1)[1])
    seen_dirs = sorted(glob.glob('/home/user/work0*')) + sorted(glob.glob('/home/user/workiu0*'))
    for d in seen_dirs:
        for p in glob.glob(os.path.join(d, '**', '*.json'), recursive=True):
            if os.path.getsize(p) > 50_000_000:
                continue
            try:
                txt = open(p, errors='ignore').read()
            except OSError:
                continue
            for m in SLUG.finditer(txt):
                excluded.add(family(m.group(1)))
    eligible = [u for u in pool if slug_of(u) and family(slug_of(u)) not in excluded]
    fams = []
    for u in eligible:
        f = family(slug_of(u))
        if f not in fams:
            fams.append(f)
    seed = hashlib.sha256((freeze + 'BUILDPLAN-IU02-FINAL-ARCHON').encode()).hexdigest()
    picks, h = [], seed
    while len(picks) < k:
        h = hashlib.sha256(h.encode()).hexdigest()
        f = fams[int(h, 16) % len(fams)]
        if f not in picks:
            picks.append(f)
    urls = [next(u for u in eligible if family(slug_of(u)) == f) for f in picks]
    rec = {'freezeSha': freeze, 'seed': seed, 'k': k, 'poolSize': len(pool), 'excludedFamilies': len(excluded), 'eligibleFamilies': len(fams),
           'families': picks, 'urls': urls, 'all': urls}
    json.dump(rec, open(out, 'w'), indent=1)
    print(json.dumps({x: rec[x] for x in ('excludedFamilies', 'eligibleFamilies', 'families')}))


if __name__ == '__main__':
    main()
