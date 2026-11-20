#!/usr/bin/env python3
"""v3.54.16 audit addendum — the private package the audit asked for: the frozen bytes of every FLOOR_PLAN and SECTION
asset of each case (all variants, exactly as cached), with the package that names them, plus the audit's rerun records.
Publisher drawings: private ZIP only, never Git. MANIFEST.sha256 lists every member; the caller scans for the key.
    /usr/bin/python3 -I assemble-addendum.py <out.zip> <repo> <house>=<package.json>,<cache dir> …
"""
import hashlib, json, os, sys, zipfile
out, repo, *specs = sys.argv[1:]
members, index = [], {}
for spec in specs:
    house, rest = spec.split('=', 1)
    pkgp, cache = rest.split(',')
    pkg = json.load(open(pkgp))
    members.append((f'sources/{house}/package.json', open(pkgp, 'rb').read()))
    rows = []
    for a in pkg['assets']:
        role = a['roles']
        if role.get('document') not in ('FLOOR_PLAN', 'SECTION'): continue
        for v in a['variants']:
            p = os.path.join(cache, hashlib.sha256(v['url'].encode()).hexdigest()[:32] + '.bin')
            if not os.path.exists(p):
                rows.append({'asset': a['id'], 'document': role['document'], 'storey': role.get('storey'), 'url': v['url'], 'byteHash': v['byteHash'], 'present': False}); continue
            data = open(p, 'rb').read()
            ext = '.png' if data[:4] == b'\x89PNG' else '.pdf' if data[:4] == b'%PDF' else '.webp' if data[8:12] == b'WEBP' else '.jpg'
            name = f'sources/{house}/{role["document"].lower()}-{(role.get("storey") or "x").lower()}-{v["byteHash"][:12]}{ext}'
            members.append((name, data))
            rows.append({'asset': a['id'], 'document': role['document'], 'storey': role.get('storey'), 'url': v['url'], 'byteHash': v['byteHash'], 'sha256': hashlib.sha256(data).hexdigest(), 'file': name, 'present': True})
    index[house] = rows
    print(house, sum(1 for r in rows if r['present']), 'of', len(rows), 'plan/section variants')
A = os.path.join(repo, 'research', 'source-to-model', 'v35416', 'audit')
for f in sorted(os.listdir(A)):
    members.append((f'audit/{f}', open(os.path.join(A, f), 'rb').read()))
for f in ('stage-reports/SOURCE_TO_MODEL_V35416.md', 'docs/ADR-V35416-CORRECTION-EXECUTOR.md'):
    members.append((f'reports/{os.path.basename(f)}', open(os.path.join(repo, f), 'rb').read()))
members.append(('sources/INDEX.json', json.dumps(index, indent=1).encode()))
manifest = [f'{hashlib.sha256(d).hexdigest()}  {a}' for a, d in members]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, allowZip64=True) as z:
    for a, d in members: z.writestr(a, d, compress_type=zipfile.ZIP_STORED if a.endswith(('.png', '.jpg', '.webp', '.pdf')) else zipfile.ZIP_DEFLATED)
    z.writestr('MANIFEST.sha256', '\n'.join(manifest) + '\n')
    z.writestr('README.txt', 'BuildPlan v3.54.16 audit addendum — private (publisher drawings inside). sources/<house>/: the frozen bytes of every floor plan and section variant the runs read, with the package naming them (INDEX.json: url, byteHash, sha256). audit/: the A1–A4 rerun records. Verify: sha256sum -c MANIFEST.sha256 after unpacking.\n')
print(len(members), 'members')
