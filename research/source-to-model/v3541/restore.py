"""v3.54.1: rebuild the private byte caches of the campaign on a fresh machine, from the committed source-package
metadata only (sources/*.source-package.json: URLs, media types and the SHA-256 of every published picture).

No publisher image is in Git. Each variant is fetched again from its public URL and kept ONLY if its bytes hash to the
recorded byteHash: the restored cache is then byte-identical to the sealed one, so every earlier result replays on the
same bytes. A variant whose bytes changed or vanished is listed (CHANGED / GONE) and not written — a house with a
missing picture is reported, never silently analysed on other bytes.

  python3 -I research/source-to-model/v3541/restore.py <out dir> [house ...]
writes <out dir>/cache (fileByteCache layout: sha256(url)[:32].bin/.type) and <out dir>/restore-report.json.
"""
import hashlib, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
only = set(sys.argv[2:])
cache = os.path.join(out, 'cache')
os.makedirs(cache, exist_ok=True)
index = json.load(open(os.path.join(HERE, 'sources', 'INDEX.json')))
report = {'houses': [], 'ok': 0, 'changed': 0, 'gone': 0, 'skippedNoHash': 0}
for row in index:
    if only and row['house'] not in only:
        continue
    pkg = json.load(open(os.path.join(HERE, 'sources', row['house'] + '.source-package.json')))
    h = {'house': row['house'], 'ok': 0, 'changed': [], 'gone': [], 'noHash': 0}
    for a in pkg['assets']:
        for v in a['variants']:
            want = v.get('byteHash')
            if not want:
                h['noHash'] += 1
                continue
            key = hashlib.sha256(v['url'].encode()).hexdigest()[:32]
            base = os.path.join(cache, key)
            if os.path.exists(base + '.bin') and hashlib.sha256(open(base + '.bin', 'rb').read()).hexdigest() == want:
                h['ok'] += 1
                continue
            with tempfile.NamedTemporaryFile(dir=cache, delete=False) as tmp:
                path = tmp.name
            r = subprocess.run(['curl', '-sSL', '--max-time', '60', '-A', 'Mozilla/5.0', '-o', path, v['url']], capture_output=True)
            data = open(path, 'rb').read() if r.returncode == 0 and os.path.exists(path) else b''
            os.unlink(path)
            if not data:
                h['gone'].append(v['url'])
            elif hashlib.sha256(data).hexdigest() != want:
                h['changed'].append(v['url'])
            else:
                open(base + '.bin', 'wb').write(data)
                open(base + '.type', 'w').write(v.get('mediaType') or 'application/octet-stream')
                h['ok'] += 1
    report['houses'].append({**h, 'changed': len(h['changed']), 'gone': len(h['gone']), 'changedUrls': h['changed'][:20], 'goneUrls': h['gone'][:20]})
    report['ok'] += h['ok']; report['changed'] += len(h['changed']); report['gone'] += len(h['gone']); report['skippedNoHash'] += h['noHash']
    print(row['house'], 'ok', h['ok'], 'changed', len(h['changed']), 'gone', len(h['gone']), flush=True)
json.dump(report, open(os.path.join(out, 'restore-report.json'), 'w'), indent=1)
print(json.dumps({k: report[k] for k in ('ok', 'changed', 'gone', 'skippedNoHash')}))
